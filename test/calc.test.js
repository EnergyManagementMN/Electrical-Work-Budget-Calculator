const test = require('node:test');
const assert = require('node:assert/strict');
const { computeLoad, computeNode } = require('../src/calc.js');

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected} ±${tol}, got ${actual}`);

const resistive = (over) => ({ pn: 1, pf: 1, qty: 1, ku: 1, phase: '3ph', category: 'other', ...over });

test('Example A (EIG): 25 dwellings × 6 kVA, ks 0.46 → 69 kVA, ≈100 A', () => {
  const r = computeNode({ name: 'Rising main', ks: 0.46, loads: [resistive({ pn: 6, qty: 25 })] });
  close(r.connected.S, 150, 1e-9, 'installed kVA');
  close(r.demand.S, 69, 1e-9, 'demand kVA');
  close(r.Ib, 99.6, 0.05, 'design current');
});

test('Example B (EIG): third floor (36 + 24) kVA × 0.63 → 37.8 kVA, ≈55 A', () => {
  const r = computeNode({ name: 'Floor 3', ks: 0.63, loads: [resistive({ pn: 36 }), resistive({ pn: 24 })] });
  close(r.demand.S, 37.8, 1e-9, 'demand kVA');
  close(r.Ib, 54.6, 0.05, 'design current');
});

test('Example D: 22 kW motor, η 0.92, cosφ 0.86 → 27.8 kVA / 40.1 A; ku 0.75 → 20.9 kVA / 30.1 A', () => {
  const motor = { pn: 22, isMotor: true, eff: 0.92, pf: 0.86, qty: 1, ku: 1, phase: '3ph', category: 'motor' };
  const full = computeNode({ name: 'M', ks: 1, loads: [motor] });
  close(full.demand.S, 27.8, 0.05, 'Pa');
  close(full.Ib, 40.1, 0.05, 'Ib');
  const used = computeNode({ name: 'M', ks: 1, loads: [{ ...motor, ku: 0.75 }] });
  close(used.demand.S, 20.9, 0.05, 'Pa·ku');
  close(used.Ib, 30.1, 0.05, 'Ib at ku');
});

test('motor without efficiency is rejected', () => {
  const r = computeLoad({ pn: 5, isMotor: true, pf: 0.8, qty: 1 });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /efficiency/i);
});

test('power factor required except for resistive heating', () => {
  assert.equal(computeLoad({ pn: 2, category: 'lighting', qty: 1 }).ok, false);
  const h = computeLoad({ pn: 2, category: 'heating', qty: 1 });
  assert.equal(h.ok, true);
  assert.equal(h.pf, 1);
});

test('complex sum is below arithmetic sum for mixed power factors', () => {
  const r = computeNode({ name: 'Mix', ks: 1, loads: [resistive({ pn: 10 }), resistive({ pn: 10, pf: 0.5 })] });
  close(r.demand.Sarith, 30, 1e-9, 'arithmetic kVA');
  close(r.demand.Scomplex, Math.hypot(20, 10 * Math.tan(Math.acos(0.5))), 1e-9, 'complex kVA');
  assert.ok(r.warnings.some((w) => /differ by more than 5%/.test(w.text)));
  const a = computeNode({ name: 'Mix', ks: 1, loads: r.rows.map((x) => x.load) }, { summation: 'arithmetic' });
  close(a.demand.S, 30, 1e-9, 'arithmetic mode uses kVA sum');
});

test('ks applies once per level of the hierarchy', () => {
  const tree = {
    name: 'MDB', ks: 0.8,
    children: [{ name: 'DB1', ks: 0.5, loads: [resistive({ pn: 10 })] }, { name: 'DB2', ks: 1, loads: [resistive({ pn: 10 })] }],
  };
  const r = computeNode(tree);
  close(r.children[0].demand.S, 5, 1e-9, 'DB1');
  close(r.demand.S, (5 + 10) * 0.8, 1e-9, 'MDB');
  close(r.connected.S, 20, 1e-9, 'connected rolls up');
});

test('non-simultaneous loads: only the larger option counts; standby loads are excluded', () => {
  const r = computeNode({
    name: 'Plant', ks: 1,
    loads: [
      resistive({ name: 'Heater', pn: 30, exGroup: 'season', exOption: 'winter' }),
      resistive({ name: 'Chiller', pn: 20, exGroup: 'season', exOption: 'summer' }),
      resistive({ name: 'Duty pump', pn: 5 }),
      resistive({ name: 'Standby pump', pn: 5, standby: true }),
    ],
  });
  assert.equal(r.exclusive.season.option, 'winter');
  close(r.demand.S, 35, 1e-9, 'winter + duty pump');
  close(r.connected.S, 60, 1e-9, 'connected includes everything');
});

test('phase currents and unbalance for single-phase loads', () => {
  const r = computeNode({
    name: 'DB', ks: 1,
    loads: [resistive({ pn: 4.6, phase: 'L1' }), resistive({ pn: 2.3, phase: 'L2' })],
  });
  close(r.phaseCurrent.L1, 4600 / (400 / Math.sqrt(3)), 1e-6, 'L1 current');
  close(r.phaseCurrent.L3, 0, 1e-9, 'L3 current');
  assert.equal(r.maxPhase, 'L1');
  close(r.unbalance, 1, 1e-9, 'unbalance (Imax−Iavg)/Iavg');
  assert.ok(r.warnings.some((w) => /unbalance/i.test(w.text)));
});

test('warns when demand falls below the largest single load', () => {
  const r = computeNode({ name: 'DB', ks: 0.3, loads: [resistive({ pn: 50 }), resistive({ pn: 10 })] });
  assert.ok(r.warnings.some((w) => w.level === 'error' && /largest single load/.test(w.text)));
});

test('warns on low ks for a lighting/heating board and on assembly-diversity ks', () => {
  const r = computeNode({ name: 'Lights', ks: 0.4, ksRef: 'iec61439-3', loads: [resistive({ pn: 1, qty: 20, category: 'lighting' })] });
  assert.ok(r.warnings.some((w) => /mostly lighting and heating/.test(w.text)));
  assert.ok(r.warnings.some((w) => /assemblies/.test(w.text)));
});

test('380 V system raises design current', () => {
  const r = computeNode({ name: 'A', ks: 1, loads: [resistive({ pn: 100 })] }, { voltageLL: 380 });
  close(r.Ib, 100000 / (Math.sqrt(3) * 380), 1e-9, 'Ib at 380 V');
});
