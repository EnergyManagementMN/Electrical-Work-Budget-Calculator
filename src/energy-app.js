/* UI for the energy load schedule & consumption calculator. Engine: src/energy-calc.js (window.EnergyCalc). */
(function () {
  'use strict';
  const E = window.EnergyCalc;
  const STORE = 'energy-calc-project-v1';

  // Labels from the workbook's Lists sheet (Mongolian is machine-assisted there, kept as-is).
  const LBL = {
    T_LS: ['Load schedule', 'Ачааллын хуваарь'], T_SUM: ['Summary', 'Хураангуй'], T_MP: ['Monthly profile', 'Сарын профайл'],
    T_SAV: ['Savings scenarios', 'Хэмнэлтийн хувилбар'], ByCat: ['Totals by category', 'Ангиллаар'], ByZone: ['Totals by zone', 'Бүсээр'],
    Top10: ['Top 10 consumers', 'Хамгийн их хэрэглэгч 10'], Checks: ['Checks', 'Тулгалтын шалгалт'], Month: ['Month', 'Сар'],
    kWh: ['Energy (kWh)', 'Эрчим хүч (кВт·ц)'], ECost: ['Energy cost', 'Эрчим хүчний төлбөр'], MaxD: ['Est. max demand (kW)', 'Тооцоот оргил ачаалал (кВт)'],
    DCh: ['Demand charge', 'Чадлын төлбөр'], TCost: ['Total bill', 'Нийт төлбөр'], CO2t: ['CO2 (t)', 'CO2 (т)'], InUse: ['Items in use', 'Ашиглагдаж буй тоо'],
    Items: ['Items', 'Тоо'], Share: ['Share of kWh', 'Эзлэх хувь'], Rank: ['Rank', 'Байр'], Total: ['TOTAL', 'НИЙТ'],
    Unlisted: ['Unlisted category', 'Жагсаалтад үгүй ангилал'], Unassigned: ['Unassigned / other zone', 'Бүс тодорхойгүй'],
    Meter: ['Metered kWh (from bills)', 'Тоолуурын кВт·ц (төлбөрөөс)'], Var: ['Model vs meter', 'Загвар/тоолуур зөрүү'],
    BillD: ['Billed demand', 'Төлбөрт чадал'], Fix: ['Fixed charge', 'Тогтмол төлбөр'], Tax: ['Tax on bill', 'Татвар'],
    kVArh: ['Excess kVArh', 'Илүүдэл кВАр·ц'], RPen: ['Reactive penalty', 'Реактив торгууль'],
    ID: ['ID', 'ID'], Zone: ['Area/Zone', 'Бүс/Хэсэг'], Cat: ['Category', 'Ангилал'], Desc: ['Description', 'Тайлбар'], Qty: ['Qty', 'Тоо ширхэг'],
    PVal: ['Power', 'Чадлын утга'], Unit: ['Unit', 'Нэгж'], LF: ['Load factor', 'Ачааллын коэф.'], DF: ['Diversity', 'Давхцлын коэф.'],
    Hrs: ['Hours/day', 'Цаг/өдөр'], Days: ['Days/week', 'Өдөр/7 хоног'], Mon: ['Months/yr', 'Ашиглах сар/жил'], SMon: ['Start month', 'Эхлэх сар'],
    SHr: ['Start hour', 'Эхлэх цаг'], RkW: ['Rated kW/unit', 'Нэрлэсэн кВт/ш'], Conn: ['Connected kW', 'Суурилагдсан чадал (кВт)'],
    Dem: ['Demand kW', 'Тооцооны чадал (кВт)'], Daily: ['Daily kWh', 'Өдрийн кВт·ц'], Mly: ['Monthly kWh', 'Сарын кВт·ц'],
    Ann: ['Annual kWh', 'Жилийн кВт·ц'], Cost: ['Annual cost', 'Жилийн зардал'], CO2: ['Annual CO2 (kg)', 'Жилийн CO2 (кг)'],
    Pct: ['% of total', 'Нийтэд эзлэх %'], Stat: ['Status', 'Төлөв'],
  };
  const MONTHS = [['Jan', '1-р сар'], ['Feb', '2-р сар'], ['Mar', '3-р сар'], ['Apr', '4-р сар'], ['May', '5-р сар'], ['Jun', '6-р сар'],
    ['Jul', '7-р сар'], ['Aug', '8-р сар'], ['Sep', '9-р сар'], ['Oct', '10-р сар'], ['Nov', '11-р сар'], ['Dec', '12-р сар']];

  let state = loadState();
  let res = E.compute(state);
  let outputs = [];   // [fn(res)] refreshers registered by the current renders
  let saveTimer = null;

  const mn = () => state.settings.language === 'Mongolian';
  const L = (k) => (LBL[k] ? LBL[k][mn() ? 1 : 0] : k);
  const M = (i) => MONTHS[i][mn() ? 1 : 0];
  const cur = () => state.settings.currency || 'MNT';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (d) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const f0 = (v) => (Number.isFinite(v) ? nf(0).format(v) : '—');
  const f1 = (v) => (Number.isFinite(v) ? nf(1).format(v) : '—');
  const f2 = (v) => (Number.isFinite(v) ? nf(2).format(v) : '—');
  const pct = (v, d = 1) => (Number.isFinite(v) ? nf(d).format(v * 100) + '%' : '—');
  const big = (v) => (!Number.isFinite(v) ? '—' : Math.abs(v) >= 1e6 ? nf(2).format(v / 1e6) + 'M' : f0(v));

  function blankProject() {
    return { settings: { ...E.DEFAULT_SETTINGS, zones: [...E.DEFAULT_SETTINGS.zones] }, loads: [], measures: [], metered: Array(12).fill('') };
  }
  function sampleProject() {
    const p = blankProject();
    p.loads = E.SAMPLE_LOADS.map((r) => ({ ...r, sample: true }));
    p.measures = E.SAMPLE_MEASURES.map((m) => ({ ...m, sample: true }));
    return p;
  }
  function normalise(p) {
    const base = blankProject();
    const out = {
      settings: { ...base.settings, ...(p.settings || {}) },
      loads: Array.isArray(p.loads) ? p.loads : [],
      measures: Array.isArray(p.measures) ? p.measures : [],
      metered: Array.isArray(p.metered) ? p.metered.slice(0, 12) : base.metered,
    };
    while (out.metered.length < 12) out.metered.push('');
    if (!Array.isArray(out.settings.zones)) out.settings.zones = base.settings.zones;
    while (out.settings.zones.length < 15) out.settings.zones.push('');
    return out;
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) return normalise(JSON.parse(raw));
    } catch (e) { /* storage blocked or corrupt: fall back to sample */ }
    return normalise(sampleProject());
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 250);
  }

  function recompute() {
    res = E.compute(state);
    for (const fn of outputs) fn(res);
    save();
  }

  /* ---------- tabs ---------- */
  let current = 'summary';
  try { current = localStorage.getItem(STORE + ':tab') || 'summary'; } catch (e) { /* ignore */ }
  const views = { summary: renderSummary, schedule: renderSchedule, monthly: renderMonthly, savings: renderSavings, settings: renderSettings, file: renderFile, method: () => {} };
  function show(tab) {
    if (!views[tab]) tab = 'summary';
    current = tab;
    try { localStorage.setItem(STORE + ':tab', tab); } catch (e) { /* ignore */ }
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('section[id^="view-"]').forEach((s) => { s.hidden = s.id !== 'view-' + tab; });
    outputs = [];
    views[tab]();
    for (const fn of outputs) fn(res);
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

  function header() {
    const pn = document.getElementById('project-name');
    const site = document.getElementById('site-name');
    const lang = document.getElementById('language');
    pn.value = state.settings.projectName || '';
    site.value = state.settings.site || '';
    lang.value = state.settings.language || 'English';
    document.documentElement.lang = mn() ? 'mn' : 'en';
    document.querySelectorAll('[data-l]').forEach((el) => { el.textContent = L(el.dataset.l); });
    document.title = (state.settings.projectName || 'Energy') + ' · Energy Consumption Calculator';
  }
  document.getElementById('project-name').addEventListener('input', (e) => { state.settings.projectName = e.target.value; document.title = e.target.value + ' · Energy Consumption Calculator'; save(); });
  document.getElementById('site-name').addEventListener('input', (e) => { state.settings.site = e.target.value; save(); });
  document.getElementById('language').addEventListener('change', (e) => { state.settings.language = e.target.value; header(); recompute(); show(current); });

  const view = (id) => document.getElementById('view-' + id);
  function bind(el, fn) { outputs.push(fn); return el; }

  /* ---------- summary ---------- */
  function renderSummary() {
    const v = view('summary');
    v.innerHTML = `
      <div class="kpis" id="kpis"></div>
      <div class="grid-2">
        <div class="panel"><h3>${esc(L('T_MP'))} <span class="muted">${esc(L('kWh'))} · ${esc(L('TCost'))}</span></h3><div id="sum-chart"></div></div>
        <div class="panel checks"><h3>${esc(L('Checks'))} <span id="verdict"></span></h3><div class="table-scroll" id="checks"></div></div>
      </div>
      <div class="grid-2">
        <div class="panel"><h3>${esc(L('ByCat'))}</h3><div class="table-scroll" id="bycat"></div></div>
        <div class="panel"><h3>${esc(L('ByZone'))}</h3><div class="table-scroll" id="byzone"></div></div>
      </div>
      <div class="panel"><h3>${esc(L('Top10'))}</h3><div class="table-scroll" id="top10"></div></div>`;
    bind(v, (r) => {
      const s = r.summary; const c = cur();
      const tiles = [
        ['key', 'Annual energy', f0(s.annualKwh), 'kWh', 'avg ' + f0(s.avgMonthlyKwh) + ' kWh/month'],
        ['key', 'Annual bill', big(s.annualBill), c, 'incl. demand, fixed charges & tax'],
        ['', 'Energy cost', big(s.annualEnergyCost), c, 'per year'],
        ['', 'Demand charges', big(s.annualDemandCharges), c, 'per year'],
        ['', 'All-in cost', f1(s.allInRate), c + '/kWh', 'bill ÷ kWh'],
        ['', 'Connected load', f1(s.connectedKw), 'kW', s.activeRows + ' active rows'],
        ['', 'Demand load (sum of rows)', f1(s.demandKw), 'kW', 'demand / connected ' + pct(s.demandRatio)],
        ['', 'Est. max demand', f1(s.maxDemandKw), 'kW', (s.peakMonth ? 'peak in ' + M(s.peakMonth - 1) : '—') + ' · ' + f1(s.maxDemandKva) + ' kVA at PF ' + f2(r.settings.powerFactor)],
        ['', 'Annual load factor', pct(s.loadFactor), '', 'kWh ÷ (max kW × 8,760 h)'],
        ['', 'Annual CO₂', f1(s.co2t), 't', 'at ' + r.settings.emissionFactor + ' kg/kWh'],
        ['', 'Bill calibration', '', '', s.calibration],
      ];
      document.getElementById('kpis').innerHTML = tiles.map(([cls, lab, val, unit, sub]) =>
        `<div class="kpi ${cls}"><span class="label">${esc(lab)}</span>${val ? `<span class="val">${esc(val)}<small>${esc(unit)}</small></span>` : ''}<span class="sub">${esc(sub)}</span></div>`).join('');
      document.getElementById('sum-chart').innerHTML = monthlyChart(r, 'kwh');
      document.getElementById('checks').innerHTML = checksTable(r);
      const vd = document.getElementById('verdict');
      vd.className = 'verdict ' + (r.allOk ? 'ok' : 'bad');
      vd.textContent = r.allOk ? 'ALL OK' : 'REVIEW';
      document.getElementById('bycat').innerHTML = groupTable(r.byCategory, r.summary.annualKwh, 'Cat', 'Unlisted');
      document.getElementById('byzone').innerHTML = groupTable(r.byZone, r.summary.annualKwh, 'Zone', 'Unassigned');
      document.getElementById('top10').innerHTML = topTable(r);
    });
  }

  function checksTable(r) {
    return `<table><thead><tr><th>Check</th><th class="num">Count</th><th>Result</th></tr></thead><tbody>${
      r.checks.map((c) => `<tr><td title="${esc(c.proves)}">${esc(c.name)}</td><td class="num">${c.value}</td><td class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'OK' : 'CHECK'}</td></tr>`).join('')
    }</tbody></table>`;
  }

  function groupTable(groups, total, key, otherKey) {
    const rows = groups.filter((g) => !g.other || g.items > 0);
    const max = Math.max(1e-9, ...rows.map((g) => g.annualKwh));
    const t = groups.reduce((a, g) => ({ items: a.items + g.items, c: a.c + g.connectedKw, d: a.d + g.demandKw, k: a.k + g.annualKwh, $: a.$ + g.annualCost }), { items: 0, c: 0, d: 0, k: 0, $: 0 });
    return `<table><thead><tr><th>${esc(L(key))}</th><th class="num">${esc(L('Items'))}</th><th class="num">${esc(L('Conn'))}</th><th class="num">${esc(L('Dem'))}</th><th class="num">${esc(L('Ann'))}</th><th class="num">${esc(L('Cost'))}</th><th>${esc(L('Share'))}</th></tr></thead><tbody>${
      rows.map((g) => `<tr><td>${esc(g.other ? L(otherKey) : g.key)}</td><td class="num">${g.items}</td><td class="num">${f2(g.connectedKw)}</td><td class="num">${f2(g.demandKw)}</td><td class="num">${f0(g.annualKwh)}</td><td class="num">${f0(g.annualCost)}</td><td><span class="share" style="width:${(g.annualKwh / max) * 60}px"></span><span class="num">${pct(total > 0 ? g.annualKwh / total : 0)}</span></td></tr>`).join('')
    }<tr class="total"><td>${esc(L('Total'))}</td><td class="num">${t.items}</td><td class="num">${f2(t.c)}</td><td class="num">${f2(t.d)}</td><td class="num">${f0(t.k)}</td><td class="num">${f0(t.$)}</td><td class="num">${t.k > 0 ? '100.0%' : '—'}</td></tr></tbody></table>`;
  }

  function topTable(r) {
    if (!r.top10.length) return '<div class="empty">No complete rows yet.</div>';
    return `<table><thead><tr><th>${esc(L('Rank'))}</th><th>${esc(L('ID'))}</th><th>${esc(L('Desc'))}</th><th>${esc(L('Zone'))}</th><th>${esc(L('Cat'))}</th><th class="num">${esc(L('Ann'))}</th><th class="num">${esc(L('Cost'))}</th><th>${esc(L('Share'))}</th></tr></thead><tbody>${
      r.top10.map((x, i) => `<tr><td class="num">${i + 1}</td><td>${esc(x.row.id)}</td><td>${esc(x.row.desc)}</td><td>${esc(x.row.zone)}</td><td>${esc(x.row.category)}</td><td class="num">${f0(x.annualKwh)}</td><td class="num">${f0(x.annualCost)}</td><td><span class="share" style="width:${x.share * 160}px"></span><span class="num">${pct(x.share)}</span></td></tr>`).join('')
    }</tbody></table>`;
  }

  /* Monthly bar chart: kWh bars with metered markers, or stacked bill. Inline SVG, theme colours via CSS. */
  function monthlyChart(r, mode) {
    const W = 640; const H = 220; const padL = 52; const padB = 24; const padT = 10; const padR = 8;
    const ms = r.monthly.months;
    const vals = mode === 'kwh' ? ms.map((m) => Math.max(m.kwh, m.metered || 0)) : ms.map((m) => m.total);
    const max = niceMax(Math.max(1, ...vals));
    const bw = (W - padL - padR) / 12;
    const y = (v) => padT + (H - padT - padB) * (1 - v / max);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max * i) / 4;
      g += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${esc(big(v))}</text>`;
    }
    ms.forEach((m, i) => {
      const x = padL + i * bw + bw * 0.18; const w = bw * 0.64;
      if (mode === 'kwh') {
        g += `<rect class="bar-kwh" x="${x}" y="${y(m.kwh)}" width="${w}" height="${Math.max(0, y(0) - y(m.kwh))}" rx="2"><title>${esc(M(i))}: ${f0(m.kwh)} kWh modelled${m.metered ? ', ' + f0(m.metered) + ' metered' : ''}</title></rect>`;
        if (m.metered) g += `<circle class="meter" cx="${x + w / 2}" cy="${y(m.metered)}" r="4.5"><title>${esc(M(i))}: ${f0(m.metered)} kWh metered (${pct(m.variance)})</title></circle>`;
      } else {
        const parts = [[m.cost, 'var(--accent)', 'Energy'], [m.demandCharge, 'var(--warn)', 'Demand'], [m.fixed + m.reactivePenalty + m.tax, 'var(--ink-2)', 'Fixed, reactive & tax']];
        let base = 0;
        for (const [val, col, name] of parts) {
          if (val <= 0) continue;
          const top = y(base + val); const bot = y(base);
          g += `<rect x="${x}" y="${top}" width="${w}" height="${Math.max(0, bot - top - (base > 0 ? 1 : 0))}" fill="${col}"><title>${esc(M(i))} · ${name}: ${f0(val)} ${esc(cur())}</title></rect>`;
          base += val;
        }
      }
      g += `<text x="${padL + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(M(i).replace('-р сар', ''))}</text>`;
    });
    const legend = mode === 'kwh'
      ? `<div class="legend"><span><i style="background:var(--accent)"></i>Modelled kWh</span><span><i style="background:var(--sheet);border:2px solid var(--warn);border-radius:50%"></i>Metered kWh</span></div>`
      : `<div class="legend"><span><i style="background:var(--accent)"></i>Energy</span><span><i style="background:var(--warn)"></i>Demand charge</span><span><i style="background:var(--ink-2)"></i>Fixed, reactive &amp; tax</span></div>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode === 'kwh' ? 'Monthly energy' : 'Monthly bill'}">${g}</svg>${legend}`;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* ---------- load schedule ---------- */
  const LOAD_COLS = [
    ['id', 'ID', 'id'], ['zone', 'Zone', 'zone'], ['category', 'Cat', 'cat'], ['desc', 'Desc', 'd'], ['qty', 'Qty', 'n'],
    ['power', 'PVal', 'n'], ['unit', 'Unit', 'unit'], ['lf', 'LF', 'n'], ['df', 'DF', 'n'], ['hours', 'Hrs', 'n'], ['days', 'Days', 'n'],
    ['months', 'Mon', 'n'], ['startMonth', 'SMon', 'n'], ['startHour', 'SHr', 'n'],
  ];
  const OUT_COLS = [
    ['RkW', (x) => (x.ratedKw === null ? '' : f2(x.ratedKw))], ['Conn', (x) => (x.active ? f2(x.connectedKw) : '')],
    ['Dem', (x) => (x.active ? f2(x.demandKw) : '')], ['Daily', (x) => (x.active ? f1(x.dailyKwh) : '')],
    ['Mly', (x) => (x.active ? f0(x.monthlyKwh) : '')], ['Ann', (x) => (x.active ? f0(x.annualKwh) : '')],
    ['Cost', (x) => (x.active ? f0(x.annualCost) : '')], ['CO2', (x) => (x.active ? f0(x.annualCo2Kg) : '')],
    ['Pct', (x) => (x.active ? pct(x.share) : '')],
  ];

  function inputCell(kind, val, attrs) {
    if (kind === 'unit') return `<select ${attrs}>${E.UNITS.map((u) => `<option${u === (val || 'kW') ? ' selected' : ''}>${u}</option>`).join('')}</select>`;
    if (kind === 'cat') {
      const opts = E.CATEGORIES.includes(val) || !val ? E.CATEGORIES : [val, ...E.CATEGORIES];
      return `<select ${attrs}><option value=""></option>${opts.map((c) => `<option${c === val ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
    }
    if (kind === 'zone') {
      const zones = state.settings.zones.filter((z) => String(z).trim());
      const opts = zones.includes(val) || !val ? zones : [val, ...zones];
      return `<select ${attrs}><option value=""></option>${opts.map((z) => `<option${z === val ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select>`;
    }
    if (kind === 'n') return `<input class="n" type="number" step="any" value="${esc(val)}" ${attrs}>`;
    return `<input class="${kind}" type="text" value="${esc(val)}" ${attrs}>`;
  }

  function renderSchedule() {
    const v = view('schedule');
    const hasSample = state.loads.some((r) => r.sample);
    v.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <button class="primary" id="add-row">Add load</button>
          ${hasSample ? '<button id="clear-sample">Clear sample rows</button>' : ''}
          <span class="spacer"></span>
          <span class="muted" id="ls-totals"></span>
        </div>
        <p class="muted">One row per item type. Power in kW, HP or W. Blank load/diversity factor = ${E.DEFAULT_SETTINGS.defLF}; blank months = 12; blank start month = January; blank days/week = working days ÷ 52. Orange IDs are sample rows.</p>
        <div class="table-scroll"><table id="ls"><thead><tr>${
          LOAD_COLS.map(([, k]) => `<th>${esc(L(k))}</th>`).join('') + OUT_COLS.map(([k]) => `<th class="num">${esc(L(k))}</th>`).join('')
        }<th>${esc(L('Stat'))}</th><th></th></tr></thead><tbody>${
          state.loads.map((row, i) => `<tr data-i="${i}" class="${row.sample ? 'sample' : ''}">${
            LOAD_COLS.map(([k, , kind]) => `<td class="in">${inputCell(kind, row[k] ?? '', `data-k="${k}" aria-label="${esc(L(LOAD_COLS.find((c) => c[0] === k)[1]))} row ${i + 1}"`)}</td>`).join('') +
            OUT_COLS.map(([k]) => `<td class="num" data-o="${k}"></td>`).join('')
          }<td class="state" data-o="status"></td><td><button class="ghost" data-del="${i}" aria-label="Delete row ${i + 1}">✕</button></td></tr>`).join('')
        }</tbody><tfoot><tr class="total"><td colspan="${LOAD_COLS.length}">${esc(L('Total'))}</td>${OUT_COLS.map(([k]) => `<td class="num" data-t="${k}"></td>`).join('')}<td data-t="status"></td><td></td></tr></tfoot></table></div>
        ${state.loads.length ? '' : '<div class="empty">No loads yet. Add one, or paste rows from the spreadsheet on the Project file tab.</div>'}
      </div>`;
    const tbody = v.querySelector('tbody');
    tbody.addEventListener('input', onEdit);
    tbody.addEventListener('change', onEdit);
    function onEdit(e) {
      const k = e.target.dataset.k; if (!k) return;
      const i = +e.target.closest('tr').dataset.i;
      const raw = e.target.value;
      state.loads[i][k] = e.target.type === 'number' && raw !== '' ? Number(raw) : raw;
      recompute();
    }
    v.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { state.loads.splice(+b.dataset.del, 1); recompute(); show('schedule'); }));
    v.querySelector('#add-row').addEventListener('click', () => {
      const ids = state.loads.map((r) => Number(r.id)).filter(Number.isFinite);
      state.loads.push({ id: String((ids.length ? Math.max(...ids) : 0) + 1), zone: '', category: '', desc: '', qty: '', power: '', unit: 'kW', lf: '', df: '', hours: '', days: '', months: '', startMonth: '', startHour: '' });
      recompute(); show('schedule');
      const last = view('schedule').querySelector('tbody tr:last-child [data-k="desc"]'); if (last) last.focus();
    });
    const cs = v.querySelector('#clear-sample');
    if (cs) cs.addEventListener('click', () => { state.loads = state.loads.filter((r) => !r.sample); state.measures = state.measures.filter((m) => !m.sample); recompute(); show('schedule'); });

    bind(v, (r) => {
      v.querySelectorAll('tbody tr').forEach((tr) => {
        const x = r.rows[+tr.dataset.i]; if (!x) return;
        for (const [k, fn] of OUT_COLS) tr.querySelector(`[data-o="${k}"]`).textContent = fn(x);
        const st = tr.querySelector('[data-o="status"]');
        st.textContent = x.status; st.classList.toggle('bad', !!x.status && x.status !== 'OK');
        tr.classList.toggle('excluded', !x.active);
      });
      const s = r.summary;
      const tot = { Conn: f2(s.connectedKw), Dem: f2(s.demandKw), Daily: f1(r.rows.reduce((a, x) => a + x.dailyKwh, 0)), Ann: f0(s.annualKwh), Cost: f0(s.annualEnergyCost), CO2: f0(s.annualKwh * r.settings.emissionFactor), Pct: s.annualKwh > 0 ? '100.0%' : '' };
      v.querySelectorAll('[data-t]').forEach((td) => { td.textContent = td.dataset.t === 'status' ? `${r.rows.filter((x) => x.status === 'OK').length} OK / ${r.rows.length} rows` : (tot[td.dataset.t] || ''); });
      v.querySelector('#ls-totals').textContent = `${f1(s.connectedKw)} kW connected · ${f1(s.demandKw)} kW demand · ${f0(s.annualKwh)} kWh/yr`;
    });
  }

  /* ---------- monthly profile ---------- */
  function renderMonthly() {
    const v = view('monthly');
    const cols = [['kWh', (m) => f0(m.kwh)], ['ECost', (m) => f0(m.cost)], ['MaxD', (m) => f2(m.maxDemandKw)], ['BillD', (m) => f2(m.billedDemand)],
      ['DCh', (m) => f0(m.demandCharge)], ['Fix', (m) => f0(m.fixed)], ['kVArh', (m) => f0(m.excessKvarh)], ['RPen', (m) => f0(m.reactivePenalty)],
      ['Tax', (m) => f0(m.tax)], ['TCost', (m) => f0(m.total)], ['CO2t', (m) => f2(m.co2t)], ['InUse', (m) => String(m.inUse)]];
    v.innerHTML = `
      <div class="grid-2">
        <div class="panel"><h3>${esc(L('kWh'))} <span class="muted">modelled vs metered</span></h3><div id="mc-kwh"></div></div>
        <div class="panel"><h3>${esc(L('TCost'))} <span class="muted">${esc(cur())}</span></h3><div id="mc-bill"></div></div>
      </div>
      <div class="panel">
        <p class="muted">Seasonal items are spread over their months in use. Max demand is the sum of demand kW of items in use that month (an estimate, not a metered peak). Type kWh from your utility bills to calibrate the model; months outside ±<span id="tol"></span> are flagged.</p>
        <div class="table-scroll"><table id="mp"><thead><tr><th>${esc(L('Month'))}</th>${cols.map(([k]) => `<th class="num">${esc(L(k))}</th>`).join('')}<th>${esc(L('Meter'))}</th><th class="num">${esc(L('Var'))}</th></tr></thead><tbody>${
          MONTHS.map((_, i) => `<tr data-m="${i}"><td>${esc(M(i))}</td>${cols.map(([k]) => `<td class="num" data-o="${k}"></td>`).join('')}<td class="in"><input class="n" type="number" step="any" min="0" data-meter="${i}" value="${esc(state.metered[i])}" aria-label="Metered kWh ${esc(M(i))}"></td><td class="num" data-o="var"></td></tr>`).join('')
        }</tbody><tfoot><tr class="total" data-m="t"><td>${esc(L('Total'))}</td>${cols.map(([k]) => `<td class="num" data-o="${k}"></td>`).join('')}<td class="num" data-o="meter"></td><td class="num" data-o="var"></td></tr></tfoot></table></div>
        <p><b>Calibration:</b> <span id="calib"></span></p>
      </div>`;
    v.querySelectorAll('[data-meter]').forEach((inp) => inp.addEventListener('input', () => { state.metered[+inp.dataset.meter] = inp.value === '' ? '' : Number(inp.value); recompute(); }));
    bind(v, (r) => {
      v.querySelector('#mc-kwh').innerHTML = monthlyChart(r, 'kwh');
      v.querySelector('#mc-bill').innerHTML = monthlyChart(r, 'bill');
      v.querySelector('#tol').textContent = pct(r.settings.calibTol, 0);
      v.querySelector('#calib').textContent = r.monthly.calibration;
      v.querySelectorAll('tbody tr').forEach((tr) => {
        const m = r.monthly.months[+tr.dataset.m];
        for (const [k, fn] of cols) tr.querySelector(`[data-o="${k}"]`).textContent = fn(m);
        const vc = tr.querySelector('[data-o="var"]');
        vc.textContent = m.variance === null ? '' : (m.variance > 0 ? '+' : '') + pct(m.variance);
        vc.className = 'num' + (m.flagged ? ' bad' : '');
      });
      const t = r.monthly.total; const tr = v.querySelector('tfoot tr');
      const tv = { kWh: f0(t.kwh), ECost: f0(t.cost), MaxD: f2(t.maxDemandKw), BillD: f2(t.billedDemand), DCh: f0(t.demandCharge), Fix: f0(t.fixed), kVArh: f0(t.excessKvarh), RPen: f0(t.reactivePenalty), Tax: f0(t.tax), TCost: f0(t.total), CO2t: f2(t.co2t), InUse: String(t.inUse), meter: t.metered ? f0(t.metered) : '', var: t.variance === null ? '' : (t.variance > 0 ? '+' : '') + pct(t.variance) };
      tr.querySelectorAll('[data-o]').forEach((td) => { td.textContent = tv[td.dataset.o] ?? ''; });
    });
  }

  /* ---------- savings ---------- */
  function renderSavings() {
    const v = view('savings');
    const ids = state.loads.map((r) => String(r.id ?? '').trim()).filter(Boolean);
    const outCols = [['Description (from schedule)', (m) => m.desc || ''], ['Current kWh', (m) => (m.ok ? f0(m.currentKwh) : '')], ['New kWh', (m) => (m.ok ? f0(m.newKwh) : '')],
      ['kWh saved/yr', (m) => (m.ok ? f0(m.kwhSaved) : '')], ['Cost saved/yr', (m) => (m.ok ? f0(m.costSaved) : '')], ['CO₂ saved t/yr', (m) => (m.ok ? f2(m.co2Saved) : '')],
      ['Payback yr', (m) => (!m.ok ? '' : m.payback === null ? 'n/a' : f1(m.payback))], ['NPV', (m) => (m.ok ? f0(m.npv) : '')],
      ['IRR', (m) => (!m.ok ? '' : m.irr === null ? 'n/a' : pct(m.irr))]];
    v.innerHTML = `
      <div class="kpis" id="sv-kpis"></div>
      <div class="panel">
        <div class="toolbar"><button class="primary" id="add-m">Add measure</button><span class="spacer"></span></div>
        <p class="muted">Pick a load ID and enter only what changes (blank keeps the current value). Savings use the row's energy rate; demand-charge, reactive-penalty and tax savings are not included. NPV at the discount rate in Settings.</p>
        <div class="table-scroll"><table><thead><tr><th>Load ID</th><th>New kW/unit</th><th>New hours/day</th><th>New load factor</th><th>Investment (${esc(cur())})</th><th>Life (yr)</th><th>Measure / note</th>${outCols.map(([h], j) => `<th class="${j ? 'num' : ''}">${esc(h)}</th>`).join('')}<th>Status</th><th></th></tr></thead><tbody>${
          state.measures.map((m, i) => `<tr data-i="${i}">
            <td class="in"><select data-k="loadId" aria-label="Load ID"><option value=""></option>${[...new Set([...(m.loadId && !ids.includes(String(m.loadId)) ? [String(m.loadId)] : []), ...ids])].map((id) => `<option${String(m.loadId) === id ? ' selected' : ''}>${esc(id)}</option>`).join('')}</select></td>
            ${['newKw', 'newHours', 'newLf', 'investment', 'life'].map((k) => `<td class="in"><input class="n" type="number" step="any" min="0" data-k="${k}" value="${esc(m[k] ?? '')}" aria-label="${k}"></td>`).join('')}
            <td class="in"><input class="d" type="text" data-k="note" value="${esc(m.note ?? '')}" aria-label="Measure note"></td>
            ${outCols.map((_, j) => `<td class="${j ? 'num' : ''}" data-o="${j}"></td>`).join('')}
            <td class="state" data-o="status"></td><td><button class="ghost" data-del="${i}" aria-label="Delete measure">✕</button></td></tr>`).join('')
        }</tbody></table></div>
        ${state.measures.length ? '' : '<div class="empty">No measures yet.</div>'}
      </div>`;
    const tb = v.querySelector('tbody');
    const onEdit = (e) => {
      const k = e.target.dataset.k; if (!k) return;
      const i = +e.target.closest('tr').dataset.i;
      state.measures[i][k] = e.target.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value;
      recompute();
    };
    tb.addEventListener('input', onEdit); tb.addEventListener('change', onEdit);
    v.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { state.measures.splice(+b.dataset.del, 1); recompute(); show('savings'); }));
    v.querySelector('#add-m').addEventListener('click', () => { state.measures.push({ loadId: '', newKw: '', newHours: '', newLf: '', investment: '', note: '', life: '' }); recompute(); show('savings'); });
    bind(v, (r) => {
      v.querySelectorAll('tbody tr').forEach((tr) => {
        const m = r.measures[+tr.dataset.i];
        tr.querySelectorAll('[data-o]').forEach((td) => {
          if (!m) { td.textContent = ''; return; }
          if (td.dataset.o === 'status') { td.textContent = m.status; td.classList.toggle('bad', m.status !== 'OK'); return; }
          td.textContent = outCols[+td.dataset.o][1](m);
        });
      });
      const p = r.portfolio; const c = cur();
      v.querySelector('#sv-kpis').innerHTML = [
        ['key', 'Cost saved / yr', big(p.costSaved), c, f0(p.kwhSaved) + ' kWh · ' + f1(p.co2Saved) + ' t CO₂'],
        ['', 'Investment', big(p.investment), c, r.measures.filter((m) => m && m.ok).length + ' measures'],
        ['', 'Portfolio payback', p.payback === null ? 'n/a' : f1(p.payback), 'yr', 'investment ÷ cost saved'],
        ['', 'Portfolio NPV', big(p.npv), c, 'at ' + pct(r.settings.discountRate, 1) + ' discount rate'],
        ['', 'Share of annual kWh', pct(r.summary.annualKwh > 0 ? p.kwhSaved / r.summary.annualKwh : 0), '', 'saved vs current total'],
      ].map(([cls, lab, val, unit, sub]) => `<div class="kpi ${cls}"><span class="label">${esc(lab)}</span><span class="val">${esc(val)}<small>${esc(unit)}</small></span><span class="sub">${esc(sub)}</span></div>`).join('');
    });
  }

  /* ---------- settings ---------- */
  const SETTINGS = [
    ['Tariff', [
      ['tariff', 'Flat energy rate (per kWh)', 'n', 'Used when time-of-use is off.', true],
      ['touOn', 'Use time-of-use tariff', 'bool', 'Each row is priced by how many of its hours fall in the peak window.'],
      ['peakRate', 'Peak rate (per kWh)', 'n', '', true],
      ['offPeakRate', 'Off-peak rate (per kWh)', 'n', '', true],
      ['peakStart', 'Peak window start hour (0–23)', 'n', 'Window is [start, end), same day.'],
      ['peakEnd', 'Peak window end hour (1–24)', 'n', ''],
      ['demandCharge', 'Demand charge (per kW or kVA per month)', 'n', 'Enter 0 if your tariff has none.', true],
      ['demandBasis', 'Demand charge basis', ['kW', 'kVA'], 'kVA = max kW ÷ site power factor.'],
      ['powerFactor', 'Site power factor (0.5–1)', 'n', 'Average PF from your bill or meter.', true],
      ['fixedCharge', 'Fixed charge per month', 'n', 'Meter / service charge. Copy from your bill.'],
      ['taxRate', 'Tax on bill (fraction, 0.10 = 10%)', 'n', '0 = prices already include tax.'],
      ['reactiveRate', 'Reactive penalty (per excess kVArh)', 'n', '0 = no reactive penalty.'],
      ['pfLimit', 'Power-factor limit before penalty', 'n', ''],
    ]],
    ['Calendar & emissions', [
      ['workDaysMonth', 'Working days per month', 'n', 'Cross-checked against days per year.'],
      ['workDays', 'Working days per year', 'n', 'Default when days/week is blank (÷ weeks/year).'],
      ['weeksPerYear', 'Weeks per year', 'n', 'Holidays are not deducted.'],
      ['emissionFactor', 'Grid CO₂ factor (kg/kWh)', 'n', 'Use your grid’s published location-based factor.', true],
    ]],
    ['Defaults, calibration & economics', [
      ['defLF', 'Default load factor if blank', 'n', ''],
      ['defDF', 'Default diversity factor if blank', 'n', ''],
      ['defMonths', 'Default months/year if blank', 'n', ''],
      ['defStartMonth', 'Default start month (1–12)', 'n', ''],
      ['defStartHour', 'Default start hour (0–23)', 'n', 'Used only for the TOU split.'],
      ['calibTol', 'Model vs meter tolerance (fraction)', 'n', '0.15 = ±15% per month.'],
      ['discountRate', 'Discount rate (real, per year)', 'n', 'Your cost of capital / hurdle rate.', true],
      ['defLife', 'Default measure life (years)', 'n', ''],
      ['currency', 'Currency code', 't', 'Shown in headers.'],
    ]],
  ];
  function renderSettings() {
    const v = view('settings');
    const s = state.settings;
    const ctl = (k, kind) => {
      if (kind === 'bool') return `<select data-s="${k}"><option value="no"${s[k] ? '' : ' selected'}>No</option><option value="yes"${s[k] ? ' selected' : ''}>Yes</option></select>`;
      if (Array.isArray(kind)) return `<select data-s="${k}">${kind.map((o) => `<option${s[k] === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      return `<input type="${kind === 'n' ? 'number' : 'text'}" step="any" data-s="${k}" value="${esc(s[k])}">`;
    };
    v.innerHTML = `<div class="settings">${SETTINGS.map(([title, items]) => `<div class="panel"><h3>${esc(title)}</h3><div>${
      items.map(([k, label, kind, note, ph]) => `<div class="setting"><label for="s-${k}">${esc(label)}${ph && s[k] === E.DEFAULT_SETTINGS[k] ? '<span class="ph">placeholder</span>' : ''}</label>${ctl(k, kind).replace('data-s=', `id="s-${k}" data-s=`)}${note ? `<span class="note">${esc(note)}</span>` : ''}</div>`).join('')
    }</div></div>`).join('')}
      <div class="panel"><h3>Zones</h3><p class="muted">Feed the Area/Zone dropdown and the totals by zone.</p><div class="zones">${
        s.zones.map((z, i) => `<input type="text" data-z="${i}" value="${esc(z)}" aria-label="Zone ${i + 1}" placeholder="Zone ${i + 1}">`).join('')
      }</div></div>
      <div class="panel"><h3>Reset</h3><p class="muted">Start a blank project or reload the workbook sample. This replaces the current project.</p>
        <div class="toolbar"><button id="new-blank">New blank project</button><button id="load-sample">Load sample project</button></div></div>
    </div>`;
    v.querySelectorAll('[data-s]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.s;
      if (k === 'touOn') s[k] = el.value === 'yes';
      else s[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      el.closest('.setting').querySelector('.ph')?.remove();
      recompute();
    }));
    v.querySelectorAll('[data-z]').forEach((el) => el.addEventListener('input', () => { s.zones[+el.dataset.z] = el.value; recompute(); }));
    v.querySelector('#new-blank').addEventListener('click', () => { if (confirm('Replace the current project with a blank one?')) replace(blankProject()); });
    v.querySelector('#load-sample').addEventListener('click', () => { if (confirm('Replace the current project with the workbook sample?')) replace(sampleProject()); });
  }
  function replace(p) { state = normalise(p); header(); recompute(); show(current); }

  /* ---------- project file ---------- */
  function renderFile() {
    const v = view('file');
    v.innerHTML = `
      <div class="panel">
        <h3>Paste rows from the spreadsheet</h3>
        <p class="muted">In the workbook, select Load_Schedule columns A–N (ID to Start hour) for the rows you want, copy, and paste here. Tab- or comma-separated. Header rows are skipped.</p>
        <textarea class="small" id="paste" placeholder="1&#9;Office&#9;Lighting&#9;LED panel 600x600, 36 W&#9;40&#9;36&#9;W&#9;1&#9;0.9&#9;10&#9;5&#9;12&#9;&#9;8"></textarea>
        <div class="toolbar"><button class="primary" id="paste-add">Add rows</button><button id="paste-replace">Replace all rows</button><span class="status" id="paste-status"></span></div>
      </div>
      <div class="panel">
        <h3>Save &amp; open</h3>
        <p class="muted">The project saves automatically in this browser. Download a file to move it to another device or share it.</p>
        <div class="toolbar">
          <button class="primary" id="dl-json">Download project (.json)</button>
          <button id="dl-csv">Download results (.csv)</button>
          <label class="field"><span>Open project file</span><input type="file" id="open-json" accept=".json,application/json"></label>
          <span class="status" id="file-status"></span>
        </div>
      </div>`;
    const status = (id, msg, bad) => { const el = v.querySelector(id); el.textContent = msg; el.classList.toggle('bad', !!bad); };
    const doPaste = (replaceAll) => {
      const rows = parseRows(v.querySelector('#paste').value);
      if (!rows.length) { status('#paste-status', 'No data rows found.', true); return; }
      state.loads = replaceAll ? rows : state.loads.concat(rows);
      recompute();
      status('#paste-status', `${rows.length} row${rows.length === 1 ? '' : 's'} ${replaceAll ? 'loaded' : 'added'}. See the Load schedule tab.`);
    };
    v.querySelector('#paste-add').addEventListener('click', () => doPaste(false));
    v.querySelector('#paste-replace').addEventListener('click', () => { if (confirm('Replace every load row?')) doPaste(true); });
    v.querySelector('#dl-json').addEventListener('click', () => download(slug() + '.json', JSON.stringify(state, null, 2), 'application/json'));
    v.querySelector('#dl-csv').addEventListener('click', () => download(slug() + '-results.csv', resultsCsv(), 'text/csv'));
    v.querySelector('#open-json').addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then((t) => { replace(JSON.parse(t)); status('#file-status', 'Opened ' + file.name + '.'); })
        .catch(() => status('#file-status', 'That file is not a valid project file.', true));
    });
  }
  function parseRows(text) {
    const keys = LOAD_COLS.map((c) => c[0]);
    const numeric = new Set(['qty', 'power', 'lf', 'df', 'hours', 'days', 'months', 'startMonth', 'startHour']);
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.includes('\t') ? line.split('\t') : splitCsv(line);
      const row = {};
      keys.forEach((k, i) => {
        const raw = (cells[i] ?? '').trim();
        row[k] = numeric.has(k) && raw !== '' && Number.isFinite(Number(raw.replace(/,/g, ''))) ? Number(raw.replace(/,/g, '')) : raw;
      });
      if (!row.unit) row.unit = 'kW';
      if (typeof row.qty !== 'number' && typeof row.power !== 'number') continue; // header or note line
      out.push(row);
    }
    return out;
  }
  function splitCsv(line) {
    const out = []; let cell = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cell); cell = ''; } else cell += ch;
    }
    out.push(cell); return out;
  }
  function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function resultsCsv() {
    const lines = [];
    lines.push(['Load schedule'].join(','));
    lines.push(['ID', 'Zone', 'Category', 'Description', 'Qty', 'Rated kW/unit', 'Connected kW', 'Demand kW', 'Daily kWh', 'Annual kWh', 'Energy rate', 'Annual cost', 'Annual CO2 kg', 'Share', 'Status'].join(','));
    for (const x of res.rows) lines.push([x.row.id, x.row.zone, x.row.category, x.row.desc, x.row.qty, x.ratedKw, x.connectedKw, x.demandKw, x.dailyKwh, x.annualKwh, x.rate, x.annualCost, x.annualCo2Kg, x.share, x.status].map(csvCell).join(','));
    lines.push('');
    lines.push('Monthly profile');
    lines.push(['Month', 'kWh', 'Energy cost', 'Max demand kW', 'Billed demand', 'Demand charge', 'Fixed', 'Excess kVArh', 'Reactive penalty', 'Tax', 'Total bill', 'CO2 t', 'Metered kWh', 'Variance'].join(','));
    res.monthly.months.forEach((m, i) => lines.push([MONTHS[i][0], m.kwh, m.cost, m.maxDemandKw, m.billedDemand, m.demandCharge, m.fixed, m.excessKvarh, m.reactivePenalty, m.tax, m.total, m.co2t, m.metered ?? '', m.variance ?? ''].map(csvCell).join(',')));
    lines.push('');
    lines.push('Savings scenarios');
    lines.push(['Load ID', 'Measure', 'Investment', 'kWh saved', 'Cost saved', 'Payback yr', 'NPV', 'IRR', 'Status'].join(','));
    for (const m of res.measures) if (m) lines.push([m.measure.loadId, m.measure.note, m.investment ?? '', m.kwhSaved ?? '', m.costSaved ?? '', m.payback ?? '', m.npv ?? '', m.irr ?? '', m.status].map(csvCell).join(','));
    return lines.join('\n');
  }
  const slug = () => (state.settings.projectName || 'energy-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'energy-project';
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  header();
  show(current);
})();
