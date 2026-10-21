/*
 * Load calculation & demand/diversity factors — SPEC 1 of the Electrical Calc App research log.
 * Pure functions, no DOM. Works as a browser global (window.LoadCalc) and as a CommonJS module.
 *
 * Tags used in comments mirror the spec: [SOURCED] from a cited source, [DERIVED] maths on sourced
 * inputs, [ASSUMED] an engineering convention that still needs verification.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoadCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SQRT3 = Math.sqrt(3);
  const PHASES = ['L1', 'L2', 'L3'];
  const CATEGORIES = ['lighting', 'sockets', 'heating', 'motor', 'lift', 'EV', 'other'];
  // Categories whose pf may default to 1.0 when left blank (resistive). [ASSUMED]
  const RESISTIVE_DEFAULT_PF = new Set(['heating']);

  const DEFAULT_SYSTEM = {
    voltageLL: 400, // [ASSUMED for Mongolia — legacy PUE/GOST nominal is 380/220 V; configurable]
    frequency: 50,
    summation: 'complex', // 'complex' (P/Q) or 'arithmetic' (kVA sum, conservative)
    unbalanceLimit: 0.1, // [ASSUMED] advisory threshold only, no sourced limit
  };

  /*
   * Factor library. Every row carries its source. These are the rows the research log could source;
   * none is authoritative for Mongolian design (spec §4 design decision).
   */
  const EIG = 'Schneider Electric Installation Guide (electrical-installation.org)';
  const DEFAULT_LIBRARY = [
    ...[['2–3 circuits', 0.9], ['4–5 circuits', 0.8], ['6–9 circuits', 0.7], ['10 or more circuits', 0.6],
      ['Electric actuator', 0.2], ['Motors ≤ 100 kW', 0.8], ['Motors > 100 kW', 1.0]].map(([name, value], i) => ({
      id: 'iec61439-' + i,
      table: 'IEC 61439-2 Table 101 (assembly rated diversity factor)',
      name, value, kind: 'assembly', region: 'International',
      source: EIG + ', Fig. A13',
      note: 'For assembly thermal rating when the load is not agreed. Not a design demand factor.',
    })),
    ...[['Lighting', 1], ['Heating and air conditioning', 1], ['Socket outlets (low)', 0.1], ['Socket outlets (high)', 0.2],
      ['Lifts: largest motor', 1], ['Lifts: second motor', 0.75], ['Lifts: all motors', 0.6]].map(([name, value], i) => ({
      id: 'ute-c15-105-' + i,
      table: 'UTE C 15-105 Table AC (ks by circuit function)',
      name, value, kind: 'ks', region: 'France',
      source: EIG + ', Fig. A14',
      note: name.startsWith('Lifts') ? 'Lift circuit current = Ib + ⅓ starting current.' : 'French local guide. Example only.',
    })),
    ...[['2–4 consumers', 1], ['5–9 consumers', 0.78], ['10–14 consumers', 0.63], ['15–19 consumers', 0.53],
      ['20–24 consumers', 0.49], ['25–29 consumers', 0.46], ['30–34 consumers', 0.44], ['35–39 consumers', 0.42],
      ['40–49 consumers', 0.41], ['50 or more consumers', 0.38], ['Electric heat-storage', 0.8]].map(([name, value], i) => ({
      id: 'nfc14-100-' + i,
      table: 'NF C 14-100 (apartment block ks by number of consumers)',
      name, value, kind: 'ks', region: 'France',
      source: EIG + ', "Estimation of actual maximum kVA demand"',
      note: 'French national rule. Not valid for Mongolia by default.',
    })),
    {
      id: 'eig-ku-motor', table: 'Utilisation factor ku (EIG)', name: 'Motors, average industrial', value: 0.75,
      kind: 'ku', region: 'International', source: EIG + ', "Estimation of actual maximum kVA demand"', note: '',
    },
    {
      id: 'eig-ku-ev', table: 'Utilisation factor ku (EIG)', name: 'EV charging (dedicated circuit)', value: 1,
      kind: 'ku', region: 'International', source: EIG + ', "Estimation of actual maximum kVA demand"', note: '',
    },
  ];

  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /* Step 1 + 2 for one load row. Returns per-unit and n-unit values, or errors. */
  function computeLoad(load) {
    const errors = [];
    const notes = [];
    const pn = num(load.pn);
    const qty = num(load.qty) ?? 1;
    const ku = num(load.ku) ?? 1; // [ASSUMED] conservative default
    let eff = num(load.eff);
    let pf = num(load.pf);

    if (!isNum(pn) || pn <= 0) errors.push('Rated power must be greater than 0 kW.');
    if (!Number.isInteger(qty) || qty < 1) errors.push('Quantity must be a whole number of 1 or more.');
    if (load.isMotor && eff === null) errors.push('Motor rating is shaft output: enter efficiency η from the nameplate.');
    if (eff === null) eff = 1;
    if (eff < 0.5 || eff > 1) errors.push('Efficiency must be between 0.5 and 1.0.');
    if (pf === null) {
      if (!load.isMotor && RESISTIVE_DEFAULT_PF.has(load.category)) { pf = 1; notes.push('cosφ defaulted to 1.0 (resistive).'); }
      else errors.push('Enter power factor cosφ (no default for ' + (load.isMotor ? 'motors' : 'this load type') + ').');
    }
    if (pf !== null && (pf < 0.1 || pf > 1)) errors.push('Power factor must be between 0.1 and 1.0.');
    if (ku < 0) errors.push('Utilisation factor ku cannot be negative.');
    if (errors.length) return { ok: false, errors, notes };

    const P1 = pn / eff;                 // kW input per unit [SOURCED EIG]
    const S1 = pn / (eff * pf);          // installed kVA per unit, Pa [SOURCED EIG]
    const Q1 = P1 * Math.tan(Math.acos(pf)); // kvar [DERIVED]
    const k = ku * qty;
    const res = {
      ok: true, errors, notes, eff, pf, ku, qty,
      unit: { P: P1, Q: Q1, S: S1 },
      connected: { P: P1 * qty, Q: Q1 * qty, S: S1 * qty },
      max: { P: P1 * k, Q: Q1 * k, S: S1 * k }, // Pa_max = Pa · ku · n [SOURCED EIG]
      phases: emptyPhases(),
    };
    // Split onto phases: three-phase loads split evenly; single-phase loads sit on one phase.
    const targets = load.phase && load.phase !== '3ph' ? [load.phase] : PHASES;
    for (const ph of targets) {
      const f = 1 / targets.length;
      res.phases[ph] = { P: res.max.P * f, Q: res.max.Q * f, S: res.max.S * f };
    }
    return res;
  }

  function emptyPhases() {
    return { L1: { P: 0, Q: 0, S: 0 }, L2: { P: 0, Q: 0, S: 0 }, L3: { P: 0, Q: 0, S: 0 } };
  }
  function addTo(acc, v, f = 1) { acc.P += v.P * f; acc.Q += v.Q * f; acc.S += v.S * f; }

  /*
   * Mutually-exclusive loads (e.g. winter heating vs summer cooling): within one board, loads sharing
   * an exclusive group are split by option; only the option with the largest demand counts.
   */
  function pickExclusive(rows) {
    const groups = new Map();
    for (const r of rows) {
      const g = (r.load.exGroup || '').trim();
      if (!g || r.load.standby || !r.calc.ok) continue;
      const opt = (r.load.exOption || '').trim() || '(blank)';
      if (!groups.has(g)) groups.set(g, new Map());
      const opts = groups.get(g);
      if (!opts.has(opt)) opts.set(opt, { P: 0, Q: 0, S: 0 });
      addTo(opts.get(opt), r.calc.max);
    }
    const chosen = {};
    for (const [g, opts] of groups) {
      let best = null; let bestS = -1;
      for (const [opt, v] of opts) {
        const s = Math.hypot(v.P, v.Q);
        if (s > bestS) { bestS = s; best = opt; }
      }
      chosen[g] = { option: best, options: [...opts.keys()] };
    }
    return chosen;
  }

  function libraryRow(library, id) {
    return id ? (library || []).find((r) => r.id === id) || null : null;
  }

  /* Steps 3–7 for one board and, recursively, everything below it. */
  function computeNode(node, system = DEFAULT_SYSTEM, library = DEFAULT_LIBRARY, depth = 0) {
    const sys = { ...DEFAULT_SYSTEM, ...system };
    const U = num(sys.voltageLL) || 400;
    const Vph = U / SQRT3;
    const ks = num(node.ks) ?? 1;      // [ASSUMED] default 1.0
    const kext = num(node.kext) ?? 1;  // [ASSUMED] default 1.0, no sourced value
    const warnings = [];

    const rows = (node.loads || []).map((load) => ({ load, calc: computeLoad(load) }));
    const exclusive = pickExclusive(rows);
    const children = (node.children || []).map((c) => computeNode(c, sys, library, depth + 1));

    const sum = { P: 0, Q: 0, S: 0 };       // S here is the arithmetic kVA sum
    const connected = { P: 0, Q: 0, S: 0 };
    const phases = emptyPhases();
    const catKVA = {};
    let largestUnit = { S: 0, name: '' };
    let errorCount = 0;

    for (const r of rows) {
      if (!r.calc.ok) { errorCount++; continue; }
      addTo(connected, r.calc.connected);
      catKVA[r.load.category || 'other'] = (catKVA[r.load.category || 'other'] || 0) + r.calc.connected.S;
      const unitMax = r.calc.unit.S * r.calc.ku;
      if (unitMax > largestUnit.S) largestUnit = { S: unitMax, name: r.load.name || 'unnamed load' };

      const g = (r.load.exGroup || '').trim();
      const opt = (r.load.exOption || '').trim() || '(blank)';
      r.counted = !r.load.standby && (!g || exclusive[g].option === opt);
      r.excludedReason = r.load.standby ? 'standby' : r.counted ? '' : 'non-simultaneous (' + g + ': ' + exclusive[g].option + ' governs)';
      if (!r.counted) continue;
      addTo(sum, r.calc.max);
      for (const ph of PHASES) addTo(phases[ph], r.calc.phases[ph]);
    }
    for (const c of children) {
      addTo(connected, c.connected);
      for (const [k, v] of Object.entries(c.catKVA)) catKVA[k] = (catKVA[k] || 0) + v;
      if (c.largestUnit.S > largestUnit.S) largestUnit = c.largestUnit;
      errorCount += c.errorCount;
      // A child's demand already includes its own ks: apply only this board's ks on top (step 4).
      sum.P += c.demand.P; sum.Q += c.demand.Q; sum.S += c.demand.Sarith;
      for (const ph of PHASES) addTo(phases[ph], c.phaseDemand[ph]);
    }

    const f = ks * kext; // step 3 (ks) and step 5 (k_ext)
    const demand = { P: sum.P * f, Q: sum.Q * f, Sarith: sum.S * f };
    demand.Scomplex = Math.hypot(demand.P, demand.Q);
    const S = sys.summation === 'arithmetic' ? demand.Sarith : demand.Scomplex;
    demand.S = S;
    const phaseDemand = emptyPhases();
    for (const ph of PHASES) addTo(phaseDemand[ph], phases[ph], f);

    // Step 6 — design current, balanced three-phase. [SOURCED EIG]
    const Ib = (S * 1000) / (SQRT3 * U);
    // Step 7 — per-phase currents and unbalance. [ASSUMED method]
    const phaseCurrent = {};
    for (const ph of PHASES) {
      const p = phaseDemand[ph];
      const sPh = sys.summation === 'arithmetic' ? p.S : Math.hypot(p.P, p.Q);
      phaseCurrent[ph] = (sPh * 1000) / Vph;
    }
    const Is = PHASES.map((ph) => phaseCurrent[ph]);
    const Imax = Math.max(...Is);
    const Iavg = (Is[0] + Is[1] + Is[2]) / 3;
    const unbalance = Iavg > 0 ? (Imax - Iavg) / Iavg : 0;
    const maxPhase = PHASES[Is.indexOf(Imax)];

    // Warnings (spec §5).
    const ksRow = libraryRow(library, node.ksRef);
    if (ks > 1) warnings.push(warn('error', 'ks is ' + fmt(ks, 2) + '. A coincidence factor must be 1.0 or less.'));
    if (ks <= 0) warnings.push(warn('error', 'ks must be greater than 0.'));
    if (kext < 1) warnings.push(warn('warning', 'Extension factor below 1.0 reduces the design load. Use 1.0 or more.'));
    for (const r of rows) {
      if (r.calc.ok && r.calc.ku > 1) warnings.push(warn('warning', (r.load.name || 'A load') + ': ku above 1.0 is unusual.'));
      if (r.load.category === 'motor' && !r.load.isMotor) warnings.push(warn('advisory', (r.load.name || 'A motor') + ': category is motor but the rating is not marked as shaft output. Check that Pn is electrical input.'));
      if (r.load.category === 'lift') warnings.push(warn('advisory', (r.load.name || 'A lift') + ': per UTE C 15-105 a lift circuit carries Ib + ⅓ starting current. Starting current is not modelled yet.'));
    }
    const totalCat = Object.values(catKVA).reduce((a, b) => a + b, 0);
    const lh = (catKVA.lighting || 0) + (catKVA.heating || 0);
    if (ks < 0.5 && totalCat > 0 && lh / totalCat > 0.5) {
      warnings.push(warn('warning', 'ks ' + fmt(ks, 2) + ' on a board that is mostly lighting and heating. EIG gives ks ≈ 1 for these.'));
    }
    if (largestUnit.S > 0 && S + 1e-9 < largestUnit.S) {
      warnings.push(warn('error', 'Demand ' + fmt(S, 1) + ' kVA is below the largest single load (' + largestUnit.name + ', ' + fmt(largestUnit.S, 1) + ' kVA). ks is too low.'));
    }
    if (Iavg > 0 && unbalance > sys.unbalanceLimit) {
      warnings.push(warn('warning', 'Phase unbalance ' + fmt(unbalance * 100, 0) + '% exceeds the ' + fmt(sys.unbalanceLimit * 100, 0) + '% limit (' + maxPhase + ' highest).'));
    }
    if (depth === 0 && kext === 1) warnings.push(warn('advisory', 'No spare capacity: extension factor is 1.0.'));
    if (ksRow && ksRow.kind === 'assembly') warnings.push(warn('warning', 'ks taken from ' + ksRow.table + '. That factor rates switchboard assemblies and is not a design demand factor.'));
    if (ksRow && ksRow.region && !/international|mongolia|user/i.test(ksRow.region)) warnings.push(warn('advisory', 'ks taken from a ' + ksRow.region + ' table. Not verified for local use.'));
    if (demand.Scomplex > 0 && Math.abs(demand.Sarith - demand.Scomplex) / demand.Scomplex > 0.05) {
      warnings.push(warn('advisory', 'Arithmetic kVA sum (' + fmt(demand.Sarith, 1) + ') and complex sum (' + fmt(demand.Scomplex, 1) + ') differ by more than 5% because of mixed power factors.'));
    }

    return {
      id: node.id, name: node.name, depth, ks, kext, ksRow,
      rows, children, exclusive,
      connected, catKVA, largestUnit, errorCount,
      demand, phaseDemand, phaseCurrent, unbalance, maxPhase,
      Ib, pf: demand.Scomplex > 0 ? demand.P / demand.Scomplex : null,
      effectiveKs: connected.S > 0 ? S / connected.S : null,
      warnings,
    };
  }

  function warn(level, text) { return { level, text }; }
  function fmt(v, d) { return isNum(v) ? v.toFixed(d) : '—'; }

  /* Collect warnings from a computed tree, each tagged with its board name. */
  function allWarnings(result) {
    const out = result.warnings.map((w) => ({ ...w, board: result.name }));
    for (const c of result.children) out.push(...allWarnings(c));
    return out;
  }

  return {
    SQRT3, PHASES, CATEGORIES, DEFAULT_SYSTEM, DEFAULT_LIBRARY,
    computeLoad, computeNode, allWarnings, fmt,
  };
});
