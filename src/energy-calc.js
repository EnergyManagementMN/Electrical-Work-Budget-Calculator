/*
 * Energy load schedule & consumption calculator.
 * A formula-for-formula port of the workbook "Energy_Load_Schedule_Calculator_2026-11-19.xlsx"
 * (sheets Settings, Load_Schedule, Summary, Monthly_Profile, Savings_Scenarios).
 * Pure functions, no DOM. Browser global window.EnergyCalc, or CommonJS module.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnergyCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = ['Lighting', 'HVAC', 'Motors/Pumps', 'IT/Office', 'Kitchen', 'Process', 'Other'];
  const UNITS = ['kW', 'HP', 'W'];

  // Settings sheet defaults. PLACEHOLDER values are the workbook's own placeholders, not a published tariff.
  const DEFAULT_SETTINGS = {
    projectName: 'Sample Office & Workshop',
    site: 'Ulaanbaatar, Mongolia',
    currency: 'MNT',
    language: 'English',
    tariff: 230, // PLACEHOLDER flat rate per kWh
    touOn: false,
    peakRate: 290, // PLACEHOLDER
    offPeakRate: 150, // PLACEHOLDER
    peakStart: 8,
    peakEnd: 20,
    demandCharge: 10000, // PLACEHOLDER per kW (or kVA) per month
    demandBasis: 'kW',
    powerFactor: 0.9, // PLACEHOLDER site PF
    fixedCharge: 0,
    taxRate: 0,
    reactiveRate: 0,
    pfLimit: 0.9,
    workDaysMonth: 22,
    workDays: 260,
    weeksPerYear: 52,
    emissionFactor: 1.0, // PLACEHOLDER kg CO2 / kWh
    hpKw: 0.7457,
    wKw: 0.001,
    defLF: 1,
    defDF: 1,
    defMonths: 12,
    defStartMonth: 1,
    defStartHour: 8,
    calibTol: 0.15,
    discountRate: 0.08, // PLACEHOLDER
    defLife: 15,
    zones: ['Office', 'Server room', 'Workshop', 'Boiler room', 'Kitchen'],
  };

  // Load_Schedule rows 7-16 of the workbook.
  const SAMPLE_LOADS = [
    { id: '1', zone: 'Office', category: 'Lighting', desc: 'LED panel 600x600, 36 W', qty: 40, power: 36, unit: 'W', lf: 1, df: 0.9, hours: 10, days: 5, months: 12, startMonth: '', startHour: 8 },
    { id: '2', zone: 'Office', category: 'HVAC', desc: 'Split AC (electrical input 1.2 kW), summer', qty: 6, power: 1.2, unit: 'kW', lf: 0.7, df: 0.8, hours: 8, days: 5, months: 3, startMonth: 6, startHour: 9 },
    { id: '3', zone: 'Office', category: 'IT/Office', desc: 'Desktop PC + monitor', qty: 30, power: 150, unit: 'W', lf: 0.6, df: 0.9, hours: 9, days: 5, months: 12, startMonth: '', startHour: 9 },
    { id: '4', zone: 'Server room', category: 'IT/Office', desc: 'Server rack + network', qty: 1, power: 3.5, unit: 'kW', lf: 0.7, df: 1, hours: 24, days: 7, months: 12, startMonth: '', startHour: 0 },
    { id: '5', zone: 'Workshop', category: 'Motors/Pumps', desc: 'Screw air compressor 15 HP', qty: 1, power: 15, unit: 'HP', lf: 0.7, df: 1, hours: 10, days: 6, months: 12, startMonth: '', startHour: 8 },
    { id: '6', zone: 'Workshop', category: 'Process', desc: 'CNC lathe', qty: 2, power: 11, unit: 'kW', lf: 0.5, df: 0.8, hours: 8, days: 5, months: 12, startMonth: '', startHour: 8 },
    { id: '7', zone: 'Workshop', category: 'Lighting', desc: 'LED high-bay 150 W', qty: 20, power: 150, unit: 'W', lf: 1, df: 1, hours: 10, days: 6, months: 12, startMonth: '', startHour: 8 },
    { id: '8', zone: 'Boiler room', category: 'Motors/Pumps', desc: 'Heating circulation pump (heating season)', qty: 2, power: 2.2, unit: 'kW', lf: 0.8, df: 1, hours: 24, days: 7, months: 8, startMonth: 9, startHour: 0 },
    { id: '9', zone: 'Kitchen', category: 'Kitchen', desc: 'Electric cooker / kettle', qty: 2, power: 2, unit: 'kW', lf: 0.5, df: 0.6, hours: 3, days: 5, months: 12, startMonth: '', startHour: 11 },
    { id: '10', zone: 'Office', category: 'HVAC', desc: 'Air handling unit fan 5.5 kW', qty: 1, power: 5.5, unit: 'kW', lf: 0.8, df: 1, hours: 10, days: 5, months: 12, startMonth: '', startHour: 8 },
  ];

  // Savings_Scenarios rows 7-10 of the workbook.
  const SAMPLE_MEASURES = [
    { loadId: '1', newKw: '', newHours: 8, newLf: '', investment: 2000000, note: 'Occupancy/daylight sensors: 10 h -> 8 h', life: 10 },
    { loadId: '5', newKw: '', newHours: '', newLf: 0.55, investment: 1500000, note: 'Compressed-air leak repair + pressure reduction', life: 5 },
    { loadId: '8', newKw: 1.1, newHours: '', newLf: '', investment: 4000000, note: 'EC variable-speed circulation pumps', life: 15 },
    { loadId: '10', newKw: '', newHours: '', newLf: 0.55, investment: 6000000, note: 'VSD on AHU fan', life: 15 },
  ];

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const blank = (v) => v === null || v === undefined || String(v).trim() === '';
  const mod = (a, n) => ((a % n) + n) % n;

  /* Fraction of month m (1-12) in use: MIN(1, MAX(0, Months − MOD(m − Start, 12))). */
  function monthFraction(m, months, startMonth) {
    return Math.min(1, Math.max(0, months - mod(m - startMonth, 12)));
  }

  /* Hours of [start, start+hours) inside the peak window, wrapping past midnight (workbook AG). */
  function peakHours(startHour, hours, peakStart, peakEnd) {
    const end = startHour + hours;
    const a = Math.max(0, Math.min(end, peakEnd) - Math.max(startHour, peakStart));
    const b = Math.max(0, Math.min(end, peakEnd + 24) - Math.max(startHour, peakStart + 24));
    return Math.min(hours, a + b);
  }

  function settingsDerived(s) {
    const pf = num(s.powerFactor) ?? 0.9;
    const pfLimit = num(s.pfLimit) ?? 0.9;
    const tanPhi = (x) => Math.tan(Math.acos(x));
    return {
      demandDiv: s.demandBasis === 'kVA' ? pf : 1,
      excessQ: Math.max(0, tanPhi(pf) - tanPhi(pfLimit)),
      defaultDays: s.weeksPerYear ? s.workDays / s.weeksPerYear : 0,
    };
  }

  /* One Load_Schedule row: columns O-X plus the hidden helpers Y-BK. */
  function computeRow(row, s, d) {
    const qty = num(row.qty);
    const power = num(row.power);
    const unitF = row.unit === 'HP' ? s.hpKw : row.unit === 'W' ? s.wKw : 1;
    const ratedKw = power === null ? null : power * unitF;
    const active = qty !== null && ratedKw !== null;

    const lf = blank(row.lf) ? s.defLF : num(row.lf);
    const df = blank(row.df) ? s.defDF : num(row.df);
    const hours = blank(row.hours) ? 0 : num(row.hours);
    const days = blank(row.days) ? d.defaultDays : num(row.days);
    const months = blank(row.months) ? s.defMonths : num(row.months);
    const startMonth = blank(row.startMonth) ? s.defStartMonth : num(row.startMonth);
    const startHour = blank(row.startHour) ? s.defStartHour : num(row.startHour);

    // Range checks the workbook enforces with data validation; here they become row errors.
    const problems = [];
    const range = (v, lo, hi, label) => { if (v === null || v < lo || v > hi) problems.push(label + ' must be ' + lo + '–' + hi); };
    if (active) {
      if (qty < 0) problems.push('Quantity cannot be negative');
      if (ratedKw < 0) problems.push('Power cannot be negative');
      range(lf, 0, 1, 'Load factor'); range(df, 0, 1, 'Diversity factor'); range(hours, 0, 24, 'Hours/day');
      range(days, 0, 7, 'Days/week'); range(months, 0, 12, 'Months/yr'); range(startMonth, 1, 12, 'Start month');
      range(startHour, 0, 23, 'Start hour');
      if (!UNITS.includes(row.unit || 'kW')) problems.push('Unit must be kW, HP or W');
    }
    const ok = active && problems.length === 0;

    let rate = s.tariff;
    let pkHours = 0;
    if (ok && s.touOn) {
      pkHours = peakHours(startHour, hours, s.peakStart, s.peakEnd);
      rate = hours > 0 ? (pkHours * s.peakRate + (hours - pkHours) * s.offPeakRate) / hours : s.offPeakRate;
    }

    const r = {
      row, active: ok, problems, ratedKw,
      eff: { lf, df, hours, days, months, startMonth, startHour },
      connectedKw: 0, demandKw: 0, dailyKwh: 0, monthlyKwh: 0, annualKwh: 0, annualCost: 0, annualCo2Kg: 0,
      rate, peakHours: pkHours, frac: new Array(12).fill(0), kwhByMonth: new Array(12).fill(0),
    };
    if (!ok) return r;
    r.connectedKw = qty * ratedKw;
    r.dailyKwh = qty * ratedKw * lf * hours;
    r.demandKw = qty * ratedKw * lf * df;
    r.monthlyKwh = (r.dailyKwh * days * s.weeksPerYear) / 12;
    r.annualKwh = (r.dailyKwh * days * s.weeksPerYear * months) / 12;
    r.annualCost = r.annualKwh * rate;
    r.annualCo2Kg = r.annualKwh * s.emissionFactor;
    for (let m = 1; m <= 12; m++) {
      r.frac[m - 1] = monthFraction(m, months, startMonth);
      r.kwhByMonth[m - 1] = r.monthlyKwh * r.frac[m - 1];
    }
    return r;
  }

  function rowStatus(r, rows, catSet) {
    const row = r.row;
    const filled = ['id', 'zone', 'category', 'desc', 'qty', 'power', 'lf', 'df', 'hours', 'days', 'months', 'startMonth', 'startHour']
      .some((k) => !blank(row[k]));
    if (!filled) return '';
    if (num(row.qty) === null || num(row.power) === null) return 'Incomplete: Qty and power needed';
    if (r.problems.length) return 'Invalid: ' + r.problems.join('; ');
    if (!blank(row.id) && rows.filter((x) => String(x.row.id).trim() === String(row.id).trim()).length > 1) return 'Duplicate ID';
    if (!catSet.has(row.category)) return 'Check category';
    if (blank(row.id)) return 'ID missing';
    if (blank(row.hours)) return 'Hours/day blank = 0 kWh';
    return 'OK';
  }

  function computeMonthly(rows, s, d, metered) {
    const months = [];
    for (let i = 0; i < 12; i++) {
      let kwh = 0; let cost = 0; let maxD = 0; let inUse = 0;
      for (const r of rows) {
        if (!r.active) continue;
        kwh += r.kwhByMonth[i];
        cost += r.kwhByMonth[i] * r.rate;
        if (r.frac[i] > 0) { maxD += r.demandKw; inUse++; }
      }
      const billedDemand = maxD / d.demandDiv;
      const demandCharge = billedDemand * s.demandCharge;
      const excessKvarh = kwh * d.excessQ;
      const reactivePenalty = excessKvarh * s.reactiveRate;
      const fixed = s.fixedCharge;
      const tax = (cost + demandCharge + fixed + reactivePenalty) * s.taxRate;
      const total = cost + demandCharge + fixed + reactivePenalty + tax;
      const meter = num(metered && metered[i]);
      const variance = meter ? (kwh - meter) / meter : null;
      months.push({
        month: i + 1, kwh, cost, maxDemandKw: maxD, billedDemand, demandCharge, fixed, excessKvarh, reactivePenalty, tax, total,
        co2t: (kwh * s.emissionFactor) / 1000, inUse, metered: meter, variance,
        flagged: variance !== null && Math.abs(variance) > s.calibTol,
      });
    }
    const sum = (k) => months.reduce((a, m) => a + m[k], 0);
    const withMeter = months.filter((m) => m.metered);
    const meteredTotal = withMeter.reduce((a, m) => a + m.metered, 0);
    const modelForMetered = withMeter.reduce((a, m) => a + m.kwh, 0);
    const total = {
      kwh: sum('kwh'), cost: sum('cost'), demandCharge: sum('demandCharge'), fixed: sum('fixed'), excessKvarh: sum('excessKvarh'),
      reactivePenalty: sum('reactivePenalty'), tax: sum('tax'), total: sum('total'), co2t: sum('co2t'),
      maxDemandKw: Math.max(...months.map((m) => m.maxDemandKw)),
      billedDemand: Math.max(...months.map((m) => m.billedDemand)),
      inUse: Math.max(...months.map((m) => m.inUse)),
      metered: meteredTotal || null,
      variance: meteredTotal ? (modelForMetered - meteredTotal) / meteredTotal : null,
    };
    let calibration = 'No bills entered';
    if (withMeter.length) {
      const flagged = months.filter((m) => m.flagged).length;
      calibration = flagged ? flagged + ' of ' + withMeter.length + ' months outside ±' + Math.round(s.calibTol * 100) + '%'
        : 'Within ±' + Math.round(s.calibTol * 100) + '% (' + withMeter.length + ' months)';
    }
    return { months, total, calibration };
  }

  /* Excel PV(rate, n, -pmt) for a constant annual saving. */
  function presentValue(rate, n, pmt) {
    return rate === 0 ? pmt * n : (pmt * (1 - Math.pow(1 + rate, -n))) / rate;
  }
  /* Excel RATE(n, pmt, -pv): the rate where PV of the savings equals the investment. Bisection, so it never diverges. */
  function irr(n, pmt, investment) {
    if (!(pmt > 0) || !(investment > 0) || !(n > 0)) return null;
    const f = (r) => presentValue(r, n, pmt) - investment;
    let lo = -0.9999; let hi = 1;
    while (f(hi) > 0 && hi < 1e6) hi *= 2;
    if (f(lo) < 0 || f(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function computeMeasure(m, rows, s) {
    if (blank(m.loadId)) return null;
    const idx = rows.findIndex((r) => String(r.row.id).trim() === String(m.loadId).trim());
    const out = { measure: m, status: '', ok: false };
    if (idx < 0) { out.status = 'ID not found'; return out; }
    const r = rows[idx];
    out.desc = r.row.desc || '';
    if (!r.active) { out.status = 'Schedule row incomplete'; return out; }
    const qty = num(r.row.qty);
    const kw = blank(m.newKw) ? r.ratedKw : num(m.newKw);
    const hrs = blank(m.newHours) ? r.eff.hours : num(m.newHours);
    const lf = blank(m.newLf) ? r.eff.lf : num(m.newLf);
    Object.assign(out, {
      currentKw: r.ratedKw, currentHours: r.eff.hours, currentLf: r.eff.lf, currentKwh: r.annualKwh,
      newKwh: (qty * kw * lf * hrs * r.eff.days * s.weeksPerYear * r.eff.months) / 12,
    });
    out.kwhSaved = out.currentKwh - out.newKwh;
    out.costSaved = out.kwhSaved * r.rate;
    out.co2Saved = (out.kwhSaved * s.emissionFactor) / 1000;
    const inv = num(m.investment);
    out.investment = inv ?? 0;
    out.payback = out.costSaved > 0 ? (inv !== null ? inv / out.costSaved : 0) : null;
    out.life = blank(m.life) ? s.defLife : num(m.life);
    out.npv = presentValue(s.discountRate, out.life, out.costSaved) - out.investment;
    out.irr = irr(out.life, out.costSaved, out.investment);
    if (blank(m.newKw) && blank(m.newHours) && blank(m.newLf)) out.status = 'Enter a change';
    else if (out.kwhSaved < 0) out.status = 'Consumption increases';
    else if (out.kwhSaved === 0) out.status = 'No saving';
    else out.status = 'OK';
    out.ok = true;
    return out;
  }

  function group(rows, keyFn, keys, otherKey) {
    const map = new Map(keys.map((k) => [k, { key: k, items: 0, connectedKw: 0, demandKw: 0, annualKwh: 0, annualCost: 0, co2t: 0 }]));
    map.set(otherKey, { key: otherKey, items: 0, connectedKw: 0, demandKw: 0, annualKwh: 0, annualCost: 0, co2t: 0, other: true });
    for (const r of rows) {
      if (!r.active) continue;
      const k = keyFn(r);
      const g = map.get(map.has(k) ? k : otherKey);
      g.items++; g.connectedKw += r.connectedKw; g.demandKw += r.demandKw; g.annualKwh += r.annualKwh;
      g.annualCost += r.annualCost; g.co2t += r.annualCo2Kg / 1000;
    }
    return [...map.values()];
  }

  /* Whole workbook: returns every output sheet. */
  function compute(project) {
    const s = { ...DEFAULT_SETTINGS, ...(project.settings || {}) };
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof DEFAULT_SETTINGS[k] === 'number') s[k] = num(s[k]) ?? DEFAULT_SETTINGS[k];
    }
    s.touOn = s.touOn === true || s.touOn === 'Yes';
    const d = settingsDerived(s);
    const catSet = new Set(CATEGORIES);
    const rows = (project.loads || []).map((row) => computeRow(row, s, d));
    for (const r of rows) r.status = rowStatus(r, rows, catSet);

    const annualKwh = rows.reduce((a, r) => a + r.annualKwh, 0);
    for (const r of rows) r.share = r.active && annualKwh > 0 ? r.annualKwh / annualKwh : 0;
    const monthly = computeMonthly(rows, s, d, project.metered || []);
    const zones = (s.zones || []).map((z) => String(z).trim()).filter(Boolean);

    const connectedKw = rows.reduce((a, r) => a + r.connectedKw, 0);
    const demandKw = rows.reduce((a, r) => a + r.demandKw, 0);
    const peakIdx = monthly.months.findIndex((m) => m.maxDemandKw === monthly.total.maxDemandKw);
    const attention = rows.filter((r) => r.status && r.status !== 'OK').length;

    const summary = {
      connectedKw, demandKw,
      maxDemandKw: monthly.total.maxDemandKw,
      peakMonth: monthly.total.maxDemandKw > 0 ? peakIdx + 1 : null,
      maxDemandKva: s.powerFactor > 0 ? monthly.total.maxDemandKw / s.powerFactor : 0,
      annualKwh, avgMonthlyKwh: annualKwh / 12,
      annualEnergyCost: monthly.total.cost,
      annualDemandCharges: monthly.total.demandCharge,
      annualBill: monthly.total.total,
      allInRate: annualKwh > 0 ? monthly.total.total / annualKwh : 0,
      co2t: monthly.total.co2t,
      loadFactor: monthly.total.maxDemandKw > 0 ? annualKwh / (monthly.total.maxDemandKw * 8760) : 0,
      demandRatio: connectedKw > 0 ? demandKw / connectedKw : 0,
      activeRows: rows.filter((r) => r.active).length,
      attentionRows: attention,
      calibration: monthly.calibration,
    };

    const ranked = rows.filter((r) => r.active).map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.annualKwh - a.r.annualKwh || a.i - b.i).map((x) => x.r);

    const measures = (project.measures || []).map((m) => computeMeasure(m, rows, s));
    const okM = measures.filter((m) => m && m.ok);
    const sumM = (k) => okM.reduce((a, m) => a + (m[k] || 0), 0);
    const portfolio = {
      investment: (project.measures || []).reduce((a, m) => a + (num(m.investment) || 0), 0),
      currentKwh: sumM('currentKwh'), newKwh: sumM('newKwh'), kwhSaved: sumM('kwhSaved'),
      costSaved: sumM('costSaved'), co2Saved: sumM('co2Saved'), npv: sumM('npv'),
    };
    portfolio.payback = portfolio.costSaved > 0 ? portfolio.investment / portfolio.costSaved : null;

    const ids = rows.map((r) => String(r.row.id ?? '').trim()).filter(Boolean);
    const checks = [
      { name: 'Duplicate IDs', value: ids.length - new Set(ids).size, proves: 'Savings look-ups need unique IDs.' },
      { name: 'Incomplete, invalid or unlisted-category rows', value: attention, proves: 'Rows excluded from totals or needing a fix.' },
      { name: 'Peak window end > start', value: s.peakEnd > s.peakStart ? 0 : 1, proves: 'TOU window must be a same-day window [start, end).' },
      { name: 'Implied days/week ≤ 7', value: d.defaultDays <= 7 ? 0 : 1, proves: 'Used for rows with blank Days/week.' },
      { name: 'Working days/month × 12 vs per year', value: Math.abs(s.workDaysMonth * 12 - s.workDays) <= 12 ? 0 : 1, proves: 'Should agree within ±12 days.' },
      { name: 'Duplicate zone names', value: zones.length - new Set(zones).size, proves: 'Zone totals double-count if a zone appears twice.' },
    ].map((c) => ({ ...c, ok: c.value === 0 }));

    return {
      settings: s, derived: d, rows, monthly, summary,
      byCategory: group(rows, (r) => r.row.category, CATEGORIES, 'Unlisted'),
      byZone: group(rows, (r) => String(r.row.zone || '').trim(), [...new Set(zones)], 'Unassigned'),
      top10: ranked.slice(0, 10),
      measures, portfolio, checks, allOk: checks.every((c) => c.ok),
    };
  }

  return {
    CATEGORIES, UNITS, DEFAULT_SETTINGS, SAMPLE_LOADS, SAMPLE_MEASURES,
    compute, computeRow, monthFraction, peakHours, presentValue, irr, num,
  };
});
