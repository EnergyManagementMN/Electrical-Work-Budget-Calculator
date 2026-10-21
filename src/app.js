/* UI for the load calculator. State lives in `project`; calc.js does all the engineering. */
(function () {
  'use strict';
  const C = window.LoadCalc;
  const STORE_KEY = 'electrical-load-calc:v1';
  const $ = (id) => document.getElementById(id);

  let seq = 0;
  const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function newLoad(over) {
    return {
      id: uid('l'), name: '', category: 'other', pn: null, isMotor: false, eff: null, pf: null, qty: 1,
      phase: '3ph', ku: 1, standby: false, exGroup: '', exOption: '', ...over,
    };
  }
  function newBoard(over) {
    return { id: uid('b'), name: 'New board', ks: 1, kext: 1, ksRef: null, loads: [], children: [], ...over };
  }
  const motor = (o) => newLoad({ category: 'motor', isMotor: true, ...o });

  const SAMPLES = {
    workshop: {
      label: 'Workshop and office',
      make: () => ({
        name: 'Workshop and office (example)', example: true,
        root: newBoard({
          name: 'MDB · Main LV board', ks: 0.9, kext: 1.2,
          loads: [newLoad({ name: 'EV charger, 32 A', category: 'EV', pn: 7.4, pf: 0.99, phase: 'L3', ku: 1 })],
          children: [
            newBoard({
              name: 'DB-1 · Machine shop', ks: 0.8,
              loads: [
                motor({ name: 'Lathe', pn: 11, eff: 0.9, pf: 0.85, qty: 2, ku: 0.75 }),
                motor({ name: 'Air compressor', pn: 22, eff: 0.92, pf: 0.86, ku: 0.75 }),
                motor({ name: 'Coolant pump, duty', pn: 4, eff: 0.87, pf: 0.82, ku: 0.75 }),
                motor({ name: 'Coolant pump, standby', pn: 4, eff: 0.87, pf: 0.82, ku: 0.75, standby: true }),
                newLoad({ name: 'Socket circuit', category: 'sockets', pn: 3.6, pf: 0.9, ku: 0.2, phase: 'L1' }),
                newLoad({ name: 'Socket circuit', category: 'sockets', pn: 3.6, pf: 0.9, ku: 0.2, phase: 'L2' }),
              ],
            }),
            newBoard({
              name: 'DB-2 · Office', ks: 0.9,
              loads: [
                newLoad({ name: 'LED panel, 36 W', category: 'lighting', pn: 0.036, pf: 0.9, qty: 40, phase: 'L1' }),
                newLoad({ name: 'LED panel, 36 W', category: 'lighting', pn: 0.036, pf: 0.9, qty: 40, phase: 'L2' }),
                newLoad({ name: 'Socket circuit', category: 'sockets', pn: 3.6, pf: 0.9, qty: 4, ku: 0.2, phase: 'L3' }),
                newLoad({ name: 'Panel heater, 2 kW', category: 'heating', pn: 2, qty: 6, exGroup: 'season', exOption: 'winter' }),
                newLoad({ name: 'Split AC, 3.5 kW', category: 'other', pn: 3.5, pf: 0.9, qty: 2, exGroup: 'season', exOption: 'summer' }),
              ],
            }),
          ],
        }),
      }),
    },
    eigA: {
      label: 'EIG example A: apartment block',
      make: () => ({
        name: 'EIG example A: 5-storey apartment block', example: true,
        root: newBoard({
          name: 'Rising main', ks: 0.46, ksRef: 'nfc14-100-5',
          loads: [newLoad({ name: 'Dwelling, 6 kVA each', pn: 6, pf: 1, qty: 25 })],
        }),
      }),
    },
    eigB: {
      label: 'EIG example B: third floor',
      make: () => ({
        name: 'EIG example B: third-floor supply', example: true,
        root: newBoard({
          name: 'Third floor', ks: 0.63, ksRef: 'nfc14-100-2',
          loads: [
            newLoad({ name: 'Consumers above, 36 kVA', pn: 36, pf: 1 }),
            newLoad({ name: 'Third-floor consumers, 24 kVA', pn: 24, pf: 1 }),
          ],
        }),
      }),
    },
  };

  function makeProject(sampleKey) {
    const base = sampleKey ? SAMPLES[sampleKey].make() : { name: 'New project', example: false, root: newBoard({ name: 'MDB · Main LV board' }) };
    return { version: 1, system: { ...C.DEFAULT_SYSTEM }, library: clone(C.DEFAULT_LIBRARY), ...base };
  }

  function isProject(p) { return p && typeof p === 'object' && p.root && Array.isArray(p.root.loads); }
  function normalise(p) {
    p.system = { ...C.DEFAULT_SYSTEM, ...(p.system || {}) };
    if (!Array.isArray(p.library)) p.library = clone(C.DEFAULT_LIBRARY);
    const fix = (b) => {
      b.id = b.id || uid('b'); b.loads = b.loads || []; b.children = b.children || [];
      b.loads.forEach((l) => { l.id = l.id || uid('l'); });
      b.children.forEach(fix);
    };
    fix(p.root);
    return p;
  }

  let project;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    project = isProject(saved) ? normalise(saved) : makeProject('workshop');
  } catch (e) {
    project = makeProject('workshop');
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(project)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = (v, d = 1) => C.fmt(v, d);
  const val = (v) => (v === null || v === undefined ? '' : esc(v));

  let boards = new Map(); // id -> { board, parent }
  let loads = new Map();  // id -> { load, board }
  function index() {
    boards = new Map(); loads = new Map();
    const walk = (b, parent) => {
      boards.set(b.id, { board: b, parent });
      b.loads.forEach((l) => loads.set(l.id, { load: l, board: b }));
      b.children.forEach((c) => walk(c, b));
    };
    walk(project.root, null);
  }

  /* ---------- header / system ---------- */
  function renderSystem() {
    const s = project.system;
    $('project-name').value = project.name || '';
    $('system').innerHTML = `
      <label class="field"><span>Voltage U, L–L</span>
        <select id="sys-voltage" data-sys="voltageLL">
          ${[400, 380, 690, 415].map((v) => `<option value="${v}"${+s.voltageLL === v ? ' selected' : ''}>${v} / ${Math.round(v / Math.sqrt(3))} V</option>`).join('')}
        </select></label>
      <label class="field"><span>Design basis</span>
        <select id="sys-summation" data-sys="summation">
          <option value="complex"${s.summation === 'complex' ? ' selected' : ''}>Complex sum (P, Q)</option>
          <option value="arithmetic"${s.summation === 'arithmetic' ? ' selected' : ''}>Arithmetic kVA sum</option>
        </select></label>
      <label class="field"><span>Unbalance limit, %</span>
        <input id="sys-unbalance" class="w-xs" type="number" min="0" step="1" data-sys="unbalanceLimit" value="${Math.round(s.unbalanceLimit * 100)}"></label>
      <label class="field"><span>Frequency</span><input id="sys-freq" class="w-xs" type="text" value="50 Hz" disabled></label>`;
  }

  /* ---------- schedule ---------- */
  function ksOptions(b) {
    const groups = new Map();
    project.library.filter((r) => r.kind === 'ks' || r.kind === 'assembly').forEach((r) => {
      if (!groups.has(r.table)) groups.set(r.table, []);
      groups.get(r.table).push(r);
    });
    let html = `<option value="">Manual entry</option>`;
    for (const [table, rows] of groups) {
      html += `<optgroup label="${esc(table)}">` + rows.map((r) =>
        `<option value="${esc(r.id)}"${b.ksRef === r.id ? ' selected' : ''}>${esc(r.name)} · ${r.value}</option>`).join('') + '</optgroup>';
    }
    return html;
  }

  const PHASE_OPTS = [['3ph', '3-phase'], ['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3']];
  function loadRow(l) {
    const sel = (opts, cur) => opts.map(([v, t]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${t}</option>`).join('');
    const n = (fld, cls, step, extra = '') => `<input class="${cls}" type="number" step="${step}" data-l="${l.id}" data-f="${fld}" value="${val(l[fld])}" aria-label="${fld}" ${extra}>`;
    return `<tr id="lr-${l.id}">
      <td class="keep"><input type="text" data-l="${l.id}" data-f="name" value="${val(l.name)}" placeholder="Load name" aria-label="Load name"></td>
      <td><select data-l="${l.id}" data-f="category" aria-label="Category">${sel(C.CATEGORIES.map((c) => [c, c]), l.category)}</select></td>
      <td>${n('pn', 'w-s', 'any', 'min="0"')}</td>
      <td style="text-align:center"><input type="checkbox" data-l="${l.id}" data-f="isMotor"${l.isMotor ? ' checked' : ''} aria-label="Rating is motor shaft output"></td>
      <td>${n('eff', 'w-xs', '0.01', 'min="0.5" max="1" placeholder="' + (l.isMotor ? 'req.' : '1.0') + '"')}</td>
      <td>${n('pf', 'w-xs', '0.01', 'min="0.1" max="1" placeholder="' + (l.category === 'heating' && !l.isMotor ? '1.0' : 'req.') + '"')}</td>
      <td>${n('qty', 'w-xs', '1', 'min="1"')}</td>
      <td><select data-l="${l.id}" data-f="phase" aria-label="Phase">${sel(PHASE_OPTS, l.phase)}</select></td>
      <td>${n('ku', 'w-xs', '0.05', 'min="0" max="1"')}</td>
      <td style="text-align:center"><input type="checkbox" data-l="${l.id}" data-f="standby"${l.standby ? ' checked' : ''} aria-label="Standby"></td>
      <td><input class="w-s" type="text" data-l="${l.id}" data-f="exGroup" value="${val(l.exGroup)}" placeholder="—" aria-label="Exclusive group"></td>
      <td><input class="w-s" type="text" data-l="${l.id}" data-f="exOption" value="${val(l.exOption)}" placeholder="—" aria-label="Option"></td>
      <td class="out" data-out="pa"></td>
      <td class="out" data-out="max"></td>
      <td class="state" data-out="state"></td>
      <td class="keep"><button class="ghost" data-act="del-load" data-l="${l.id}" aria-label="Remove load" title="Remove load">✕</button></td>
    </tr>`;
  }

  function boardHTML(b, depth) {
    const table = b.loads.length ? `
      <div class="table-scroll"><table>
        <thead><tr>
          <th>Load</th><th>Category</th><th>Pn <span class="u">kW</span></th><th title="Rating is motor shaft output">Motor</th>
          <th><span class="u">η</span></th><th><span class="u">cosφ</span></th><th>Qty</th><th>Phase</th><th>ku</th><th>Standby</th>
          <th title="Loads in the same group never run together">Excl. group</th><th>Option</th>
          <th style="text-align:right">Pa <span class="u">kVA ea.</span></th><th style="text-align:right">Pa·ku·n <span class="u">kVA</span></th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${b.loads.map(loadRow).join('')}</tbody>
      </table></div>` : `<div class="empty">No loads on this board yet. Add a load or a sub-board.</div>`;
    return `<div class="board" data-board="${b.id}">
      <div class="board-head">
        <label class="field"><span>${depth === 0 ? 'Main board' : 'Sub-board'}</span>
          <input class="board-name" type="text" data-b="${b.id}" data-f="name" value="${val(b.name)}" aria-label="Board name"></label>
        <label class="field"><span>ks (≤ 1)</span><input id="ks-${b.id}" class="w-xs" type="number" step="0.01" min="0" max="1" data-b="${b.id}" data-f="ks" value="${val(b.ks)}"></label>
        <label class="field"><span>ks from library</span><select id="ksref-${b.id}" class="w-l" data-b="${b.id}" data-f="ksRef">${ksOptions(b)}</select></label>
        <label class="field"><span>Extension k<sub>ext</sub></span><input class="w-xs" type="number" step="0.05" min="1" data-b="${b.id}" data-f="kext" value="${val(b.kext)}"></label>
        <span class="spacer"></span>
        <div class="actions">
          <button data-act="add-load" data-b="${b.id}">Add load</button>
          <button data-act="add-board" data-b="${b.id}">Add sub-board</button>
          ${depth > 0 ? `<button class="ghost" data-act="del-board" data-b="${b.id}">Remove board</button>` : ''}
        </div>
      </div>
      <div class="board-body">
        <div class="ks-src" id="kss-${b.id}"></div>
        ${table}
        <div class="board-result" id="res-${b.id}"></div>
        ${b.children.length ? `<div class="children">${b.children.map((c) => boardHTML(c, depth + 1)).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  function renderTree() {
    index();
    const banner = project.example
      ? `<div class="wn advisory" style="margin-bottom:12px"><span class="pill">Example</span><span>Example values, not from a real project. Edit them, or start a new project under <b>Project file</b>.</span></div>`
      : '';
    $('tree').innerHTML = banner + boardHTML(project.root, 0);
    updateResults();
  }

  function updateResults() {
    const r = C.computeNode(project.root, project.system, project.library);
    renderSummary(r);
    const walk = (res) => {
      const el = $('res-' + res.id);
      if (el) {
        el.innerHTML = `
          <span>Connected <b>${f(res.connected.S)}</b> kVA</span>
          <span>Before ks <b>${f(res.ks * res.kext > 0 ? res.demand.S / (res.ks * res.kext) : 0)}</b> kVA</span>
          <span>Demand <b>${f(res.demand.S)}</b> kVA</span>
          <span><b>${f(res.demand.P)}</b> kW · <b>${f(res.demand.Q)}</b> kvar</span>
          <span>cosφ <b>${f(res.pf, 2)}</b></span>
          <span>Ib <b>${f(res.Ib)}</b> A</span>
          <span>L1/L2/L3 <b>${f(res.phaseCurrent.L1)} / ${f(res.phaseCurrent.L2)} / ${f(res.phaseCurrent.L3)}</b> A</span>`;
      }
      const src = $('kss-' + res.id);
      if (src) {
        src.textContent = res.ksRow ? `ks source: ${res.ksRow.table}, “${res.ksRow.name}” (${res.ksRow.region}). ${res.ksRow.note}` : '';
        src.hidden = !res.ksRow;
      }
      for (const row of res.rows) {
        const tr = $('lr-' + row.load.id);
        if (!tr) continue;
        const cell = (k) => tr.querySelector(`[data-out="${k}"]`);
        const st = cell('state');
        if (!row.calc.ok) {
          cell('pa').textContent = '—'; cell('max').textContent = '—';
          st.textContent = row.calc.errors.join(' '); st.className = 'state bad';
          tr.classList.remove('excluded');
        } else {
          cell('pa').textContent = f(row.calc.unit.S, 2);
          cell('max').textContent = f(row.calc.max.S, 2);
          st.className = 'state';
          st.textContent = row.counted ? (row.calc.notes.join(' ') || 'Counted') : 'Excluded: ' + row.excludedReason;
          tr.classList.toggle('excluded', !row.counted);
        }
        for (const fld of ['pn', 'eff', 'pf', 'qty', 'ku']) {
          const inp = tr.querySelector(`[data-f="${fld}"]`);
          const bad = !row.calc.ok && row.calc.errors.some((e) => errorField(e) === fld);
          inp.classList.toggle('invalid', bad);
        }
      }
      res.children.forEach(walk);
    };
    walk(r);
    renderWarnings(r);
  }
  function errorField(e) {
    if (/Rated power/.test(e)) return 'pn';
    if (/Quantity/.test(e)) return 'qty';
    if (/fficiency/.test(e)) return 'eff';
    if (/power factor|cosφ/i.test(e)) return 'pf';
    if (/ku/.test(e)) return 'ku';
    return '';
  }

  function renderSummary(r) {
    const s = project.system;
    const basis = s.summation === 'arithmetic' ? 'arithmetic kVA sum' : 'complex P/Q sum';
    const Imax = Math.max(r.phaseCurrent.L1, r.phaseCurrent.L2, r.phaseCurrent.L3, 1e-9);
    const bar = (ph) => `<div class="phase-row">
        <span class="phase-tag" style="color:var(--${ph.toLowerCase()})">${ph}</span>
        <div class="bar"><i style="width:${(r.phaseCurrent[ph] / Imax) * 100}%;background:var(--${ph.toLowerCase()})"></i></div>
        <span class="num">${f(r.phaseCurrent[ph])} A</span></div>`;
    const over = r.unbalance > s.unbalanceLimit;
    $('summary').innerHTML = `
      <div class="stack">
        <div><span class="label">${esc(r.name)} · design maximum demand</span></div>
        <div class="figures">
          <div class="figure key"><span class="label">Demand S</span><span class="val">${f(r.demand.S)}<small>kVA</small></span><span class="sub">${basis}, incl. k<sub>ext</sub> ${f(r.kext, 2)}</span></div>
          <div class="figure key"><span class="label">Design current Ib</span><span class="val">${f(r.Ib)}<small>A</small></span><span class="sub">3-phase at ${s.voltageLL} V</span></div>
          <div class="figure"><span class="label">Active P</span><span class="val">${f(r.demand.P)}<small>kW</small></span></div>
          <div class="figure"><span class="label">Reactive Q</span><span class="val">${f(r.demand.Q)}<small>kvar</small></span></div>
          <div class="figure"><span class="label">Power factor</span><span class="val">${f(r.pf, 2)}</span></div>
          <div class="figure"><span class="label">Connected</span><span class="val">${f(r.connected.S)}<small>kVA</small></span><span class="sub">effective ks ${f(r.effectiveKs, 2)}</span></div>
        </div>
        <div class="muted" style="font-size:.82rem">Arithmetic ${f(r.demand.Sarith)} kVA · complex ${f(r.demand.Scomplex)} kVA</div>
      </div>
      <div class="phases">
        <span class="label">Phase loading at ${Math.round(s.voltageLL / Math.sqrt(3))} V L–N</span>
        ${bar('L1')}${bar('L2')}${bar('L3')}
        <div class="phase-foot"><span style="color:${over ? 'var(--warn)' : 'var(--ok)'}">Unbalance ${f(r.unbalance * 100, 0)}% (limit ${f(s.unbalanceLimit * 100, 0)}%)</span><span>Highest: ${r.maxPhase}</span></div>
      </div>`;
  }

  function renderWarnings(r) {
    const list = C.allWarnings(r);
    if (r.errorCount) list.unshift({ level: 'error', board: '', text: `${r.errorCount} load${r.errorCount > 1 ? 's have' : ' has'} missing or invalid data and ${r.errorCount > 1 ? 'are' : 'is'} left out of every total. See the Status column.` });
    const order = { error: 0, warning: 1, advisory: 2 };
    list.sort((a, b) => order[a.level] - order[b.level]);
    $('warnings').innerHTML = list.map((w) => `<div class="wn ${w.level}"><span class="pill">${w.level}</span><span>${w.board ? `<b>${esc(w.board)}:</b> ` : ''}${esc(w.text)}</span></div>`).join('');
  }

  /* ---------- library ---------- */
  function renderLibrary() {
    const kinds = [['ks', 'ks (coincidence)'], ['ku', 'ku (utilisation)'], ['assembly', 'Assembly diversity']];
    $('view-library').innerHTML = `<div class="panel">
      <h2>Factor library</h2>
      <p>Every factor carries its source. The built-in rows are the ones the research could source. They are examples from French and international guidance and are not authoritative for Mongolian design. Add your own rows from the governing local standard, and choose them per board under <b>ks from library</b>.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Table</th><th>Name</th><th>Value</th><th>Kind</th><th>Region</th><th>Source</th><th>Note</th><th></th></tr></thead>
        <tbody>${project.library.map((r) => `<tr>
          <td><input type="text" class="w-l" data-lib="${esc(r.id)}" data-f="table" value="${val(r.table)}" aria-label="Table"></td>
          <td><input type="text" class="w-m" data-lib="${esc(r.id)}" data-f="name" value="${val(r.name)}" aria-label="Name"></td>
          <td><input type="number" class="w-xs" step="0.01" min="0" data-lib="${esc(r.id)}" data-f="value" value="${val(r.value)}" aria-label="Value"></td>
          <td><select data-lib="${esc(r.id)}" data-f="kind" aria-label="Kind">${kinds.map(([v, t]) => `<option value="${v}"${r.kind === v ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
          <td><input type="text" class="w-s" data-lib="${esc(r.id)}" data-f="region" value="${val(r.region)}" aria-label="Region"></td>
          <td><input type="text" class="w-l" data-lib="${esc(r.id)}" data-f="source" value="${val(r.source)}" aria-label="Source"></td>
          <td><input type="text" class="w-l" data-lib="${esc(r.id)}" data-f="note" value="${val(r.note)}" aria-label="Note"></td>
          <td><button class="ghost" data-act="del-lib" data-lib="${esc(r.id)}" aria-label="Remove factor">✕</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="row">
        <button class="primary" data-act="add-lib">Add factor</button>
        <button data-act="restore-lib">Restore built-in factors</button>
      </div>
      <p class="muted">Region “Mongolia” or “User” suppresses the non-local advisory. IEC 61439-2 Table 101 rows rate switchboard assemblies and always raise a warning when used as a board ks.</p>
    </div>`;
  }

  /* ---------- project file ---------- */
  function renderFile() {
    $('view-file').innerHTML = `<div class="panel">
      <h2>Project file</h2>
      <p>Your project saves in this browser as you work. To move it to another device or keep a copy, copy the JSON below or open a saved .json file.</p>
      <div class="row">
        <button class="primary" data-act="copy-json">Copy JSON</button>
        <button data-act="load-json">Load JSON from box</button>
        <label class="row" style="gap:6px"><span class="muted">Open file</span><input id="file-open" type="file" accept=".json,application/json"></label>
      </div>
      <div class="status" id="file-status"></div>
      <textarea id="project-json" spellcheck="false" aria-label="Project JSON">${esc(JSON.stringify(project, null, 2))}</textarea>
      <h3>Start over</h3>
      <div class="row">
        <button data-act="new-project">New empty project</button>
        ${Object.entries(SAMPLES).map(([k, s]) => `<button data-act="sample" data-sample="${k}">Load ${esc(s.label)}</button>`).join('')}
      </div>
      <p class="muted">Starting over replaces the current project. Copy the JSON first if you want to keep it.</p>
    </div>`;
  }
  function fileStatus(text, bad) {
    const el = $('file-status');
    if (el) { el.textContent = text; el.className = 'status' + (bad ? ' bad' : ''); }
  }
  function loadFromText(text) {
    let p;
    try { p = JSON.parse(text); } catch (e) { fileStatus('That is not valid JSON: ' + e.message, true); return; }
    if (!isProject(p)) { fileStatus('This JSON has no "root" board with a "loads" list, so it is not a project file.', true); return; }
    project = normalise(p);
    save(); renderAll();
    fileStatus('Project loaded.');
  }

  /* ---------- tabs & rendering ---------- */
  let tab = 'schedule';
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    for (const v of ['schedule', 'library', 'file', 'method']) $('view-' + v).hidden = v !== t;
    if (t === 'schedule') renderTree();
    if (t === 'library') renderLibrary();
    if (t === 'file') renderFile();
  }
  function renderAll() { renderSystem(); setTab(tab); }

  /* ---------- events ---------- */
  function parseField(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value === '' ? null : Number(el.value);
    return el.value;
  }

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    const fld = el.dataset.f;
    if (el.id === 'project-name') { project.name = el.value; save(); return; }
    if (el.dataset.sys) {
      const k = el.dataset.sys;
      if (k === 'voltageLL') project.system.voltageLL = Number(el.value);
      else if (k === 'unbalanceLimit') project.system.unbalanceLimit = el.value === '' ? C.DEFAULT_SYSTEM.unbalanceLimit : Number(el.value) / 100;
      else project.system[k] = el.value;
    } else if (el.dataset.l && fld) {
      const entry = loads.get(el.dataset.l);
      if (!entry) return;
      entry.load[fld] = parseField(el);
      if (fld === 'isMotor' || fld === 'category') { renderTree(); save(); return; } // placeholders depend on these
    } else if (el.dataset.b && fld) {
      const entry = boards.get(el.dataset.b);
      if (!entry) return;
      const b = entry.board;
      if (fld === 'ksRef') {
        b.ksRef = el.value || null;
        const row = project.library.find((r) => r.id === b.ksRef);
        if (row) { b.ks = row.value; $('ks-' + b.id).value = row.value; }
      } else {
        b[fld] = parseField(el);
        if (fld === 'ks' && b.ksRef) {
          const row = project.library.find((r) => r.id === b.ksRef);
          if (!row || row.value !== b.ks) { b.ksRef = null; $('ksref-' + b.id).value = ''; }
        }
      }
    } else if (el.dataset.lib && fld) {
      const row = project.library.find((r) => r.id === el.dataset.lib);
      if (row) row[fld] = parseField(el);
      save(); return;
    } else return;
    save();
    if (tab === 'schedule') updateResults();
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id !== 'file-open' || !ev.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => loadFromText(String(reader.result));
    reader.onerror = () => fileStatus('The file could not be read.', true);
    reader.readAsText(ev.target.files[0]);
  });

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.dataset.tab) { setTab(btn.dataset.tab); return; }
    const act = btn.dataset.act;
    if (!act) return;
    const bEntry = btn.dataset.b ? boards.get(btn.dataset.b) : null;
    switch (act) {
      case 'add-load': bEntry.board.loads.push(newLoad({ name: 'Load ' + (bEntry.board.loads.length + 1) })); break;
      case 'add-board': bEntry.board.children.push(newBoard({ name: 'DB-' + (boards.size) })); break;
      case 'del-board': {
        const p = bEntry.parent;
        p.children = p.children.filter((c) => c !== bEntry.board);
        break;
      }
      case 'del-load': {
        const e = loads.get(btn.dataset.l);
        e.board.loads = e.board.loads.filter((l) => l !== e.load);
        break;
      }
      case 'add-lib':
        project.library.push({ id: uid('f'), table: 'User factors', name: 'New factor', value: 1, kind: 'ks', region: 'User', source: '', note: '' });
        save(); renderLibrary(); return;
      case 'del-lib':
        project.library = project.library.filter((r) => r.id !== btn.dataset.lib);
        save(); renderLibrary(); return;
      case 'restore-lib': {
        const user = project.library.filter((r) => !C.DEFAULT_LIBRARY.some((d) => d.id === r.id));
        project.library = clone(C.DEFAULT_LIBRARY).concat(user);
        save(); renderLibrary(); return;
      }
      case 'copy-json': {
        const ta = $('project-json');
        ta.value = JSON.stringify(project, null, 2);
        const fallback = () => { ta.focus(); ta.select(); fileStatus('Copying is blocked here. The JSON is selected: press Ctrl+C or ⌘C.'); };
        try {
          navigator.clipboard.writeText(ta.value).then(() => fileStatus('JSON copied to the clipboard.'), fallback);
        } catch (e) { fallback(); }
        return;
      }
      case 'load-json': loadFromText($('project-json').value); return;
      case 'new-project': project = makeProject(null); save(); tab = 'schedule'; renderAll(); return;
      case 'sample': project = makeProject(btn.dataset.sample); save(); tab = 'schedule'; renderAll(); return;
      default: return;
    }
    if (project.example && (act === 'add-load' || act === 'add-board')) project.example = false;
    save(); renderTree();
  });

  renderAll();
})();
