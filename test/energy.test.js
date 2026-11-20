// Golden values are the cached results of Energy_Load_Schedule_Calculator_2026-11-19.xlsx (sample data).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/energy-calc.js');

const close = (actual, expected, msg, rel = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * rel), `${msg}: expected ${expected}, got ${actual}`);

const sample = () => ({ settings: {}, loads: E.SAMPLE_LOADS.map((r) => ({ ...r })), measures: E.SAMPLE_MEASURES.map((m) => ({ ...m })) });

test('Load_Schedule rows match the workbook', () => {
  const r = E.compute(sample());
  const expected = {
    1: [0.036, 1.44, 1.296, 14.4, 312, 3744, 861120],
    2: [1.2, 7.2, 4.032, 40.32, 873.6, 2620.8, 602784],
    3: [0.15, 4.5, 2.43, 24.3, 526.5, 6318, 1453140],
    4: [3.5, 3.5, 2.45, 58.8, 1783.6, 21403.2, 4922736],
    5: [11.1855, 11.1855, 7.82985, 78.2985, 2035.761, 24429.132, 5618700.36],
    6: [11, 22, 8.8, 88, 1906.66666666667, 22880, 5262400],
    7: [0.15, 3, 3, 30, 780, 9360, 2152800],
    8: [2.2, 4.4, 3.52, 84.48, 2562.56, 20500.48, 4715110.4],
    9: [2, 4, 1.2, 6, 130, 1560, 358800],
    10: [5.5, 5.5, 4.4, 44, 953.333333333333, 11440, 2631200],
  };
  for (const row of r.rows) {
    const e = expected[row.row.id];
    const got = [row.ratedKw, row.connectedKw, row.demandKw, row.dailyKwh, row.monthlyKwh, row.annualKwh, row.annualCost];
    got.forEach((v, i) => close(v, e[i], `row ${row.row.id} col ${i}`));
    assert.equal(row.status, 'OK');
  }
});

test('Summary key figures match the workbook', () => {
  const s = E.compute(sample()).summary;
  close(s.connectedKw, 66.7255, 'connected');
  close(s.demandKw, 38.95785, 'demand sum');
  close(s.maxDemandKw, 35.43785, 'max demand');
  assert.equal(s.peakMonth, 6);
  close(s.annualKwh, 124255.612, 'annual kWh');
  close(s.annualEnergyCost, 28578790.76, 'energy cost');
  close(s.annualDemandCharges, 4171262, 'demand charges');
  close(s.annualBill, 32750052.76, 'bill');
  close(s.allInRate, 263.570008894246, 'all-in rate');
  close(s.co2t, 124.255612, 'CO2');
  close(s.loadFactor, 0.400262165837016, 'load factor');
  close(s.demandRatio, 0.583852500168601, 'demand ratio');
  close(s.maxDemandKva, 39.3753888888889, 'kVA');
});

test('Monthly_Profile matches the workbook (seasonal items)', () => {
  const m = E.compute(sample()).monthly.months;
  const winter = [10990.421, 2527796.83, 34.92585, 349258.5, 2877055.33, 9];
  const may = [8427.861, 1938408.03, 31.40585, 314058.5, 2252466.53, 8];
  const summer = [9301.461, 2139336.03, 35.43785, 354378.5, 2493714.53, 9];
  const exp = [winter, winter, winter, winter, may, summer, summer, summer, winter, winter, winter, winter];
  m.forEach((mo, i) => {
    const got = [mo.kwh, mo.cost, mo.maxDemandKw, mo.demandCharge, mo.total, mo.inUse];
    got.forEach((v, j) => close(v, exp[i][j], `month ${i + 1} col ${j}`));
  });
});

test('Totals by category and zone match the workbook', () => {
  const r = E.compute(sample());
  const cat = Object.fromEntries(r.byCategory.map((g) => [g.key, g.annualKwh]));
  close(cat['Motors/Pumps'], 44929.612, 'motors');
  close(cat['IT/Office'], 27721.2, 'IT');
  close(cat.HVAC, 14060.8, 'HVAC');
  const zone = Object.fromEntries(r.byZone.map((g) => [g.key, g.annualKwh]));
  close(zone.Workshop, 56669.132, 'workshop');
  close(zone['Boiler room'], 20500.48, 'boiler');
  assert.deepEqual(r.top10.map((x) => x.row.id), ['5', '6', '4', '8', '10', '7', '3', '1', '2', '9']);
});

test('Savings_Scenarios match the workbook incl. NPV and IRR', () => {
  const r = E.compute(sample());
  const exp = [
    [3744, 2995.2, 172224, 11.6127833519138, -844362.941148707, -0.0263011706306855],
    [24429.132, 19194.318, 1204007.22, 1.24583970518051, 3307251.71200848, 0.754373684211272],
    [20500.48, 10250.24, 2357555.2, 1.69667289232507, 16179443.49001, 0.588820892310367],
    [11440, 7865, 822249.999999999, 7.29705077531165, 1038031.35114746, 0.107356356904525],
  ];
  r.measures.forEach((m, i) => {
    assert.equal(m.status, 'OK');
    [m.currentKwh, m.newKwh, m.costSaved, m.payback, m.npv].forEach((v, j) => close(v, exp[i][j], `measure ${i} col ${j}`));
    close(m.irr, exp[i][5], `measure ${i} IRR`, 1e-7);
  });
  close(r.portfolio.investment, 13500000, 'investment');
  close(r.portfolio.kwhSaved, 19808.854, 'kWh saved');
  close(r.portfolio.costSaved, 4556036.42, 'cost saved');
  close(r.portfolio.payback, 2.96310186212252, 'payback');
  close(r.portfolio.npv, 19680363.6120172, 'portfolio NPV');
});

test('month-in-use fraction: 7.5 months from October runs Oct–Apr fully and May at 50%', () => {
  const f = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => E.monthFraction(m, 7.5, 10));
  assert.deepEqual(f, [1, 1, 1, 1, 0.5, 0, 0, 0, 0, 1, 1, 1]);
});

test('TOU: peak hours wrap past midnight and set a blended rate', () => {
  assert.equal(E.peakHours(18, 4, 8, 20), 2);
  assert.equal(E.peakHours(22, 12, 8, 20), 2); // 22:00 → 10:00 next day: 08–10 is peak
  assert.equal(E.peakHours(0, 24, 8, 20), 12);
  const p = sample();
  p.settings = { touOn: true };
  const row = E.compute(p).rows.find((r) => r.row.id === '4'); // 24 h server
  close(row.rate, (12 * 290 + 12 * 150) / 24, 'blended rate');
});

test('kVA demand basis, fixed charge, tax and reactive penalty build up the bill', () => {
  const p = sample();
  p.settings = { demandBasis: 'kVA', powerFactor: 0.8, fixedCharge: 50000, taxRate: 0.1, reactiveRate: 20, pfLimit: 0.9 };
  const r = E.compute(p);
  const jan = r.monthly.months[0];
  close(jan.billedDemand, 34.92585 / 0.8, 'billed kVA');
  const excess = Math.tan(Math.acos(0.8)) - Math.tan(Math.acos(0.9));
  close(jan.excessKvarh, jan.kwh * excess, 'excess kVArh');
  close(jan.total, (jan.cost + jan.demandCharge + 50000 + jan.reactivePenalty) * 1.1, 'bill');
  close(r.summary.annualBill, r.monthly.months.reduce((a, m) => a + m.total, 0), 'annual bill');
});

test('calibration flags months outside the tolerance', () => {
  const p = sample();
  p.metered = [10990.421 * 1.2, 10990.421, '', '', '', '', '', '', '', '', '', ''];
  const r = E.compute(p);
  assert.equal(r.monthly.months[0].flagged, true);
  assert.equal(r.monthly.months[1].flagged, false);
  assert.match(r.monthly.calibration, /1 of 2 months/);
});

test('incomplete, duplicate and invalid rows are excluded and flagged', () => {
  const p = sample();
  p.loads.push({ id: '1', category: 'Lighting', qty: 1, power: 1, unit: 'kW', hours: 1 });
  p.loads.push({ id: '20', category: 'Lighting', qty: 2 });
  p.loads.push({ id: '21', category: 'Lighting', qty: 1, power: 1, unit: 'kW', lf: 1.5, hours: 1 });
  const r = E.compute(p);
  assert.equal(r.rows[10].status, 'Duplicate ID');
  assert.equal(r.rows[11].status, 'Incomplete: Qty and power needed');
  assert.match(r.rows[12].status, /Load factor/);
  assert.equal(r.rows[12].active, false);
  assert.equal(r.allOk, false);
});

test('reconciliation identities hold', () => {
  const r = E.compute(sample());
  const sum = (a, k) => a.reduce((x, g) => x + g[k], 0);
  close(sum(r.byCategory, 'annualKwh'), r.summary.annualKwh, 'category kWh');
  close(sum(r.byZone, 'annualKwh'), r.summary.annualKwh, 'zone kWh');
  close(r.monthly.total.kwh, r.summary.annualKwh, 'monthly kWh');
  close(r.monthly.total.cost, r.rows.reduce((a, x) => a + x.annualCost, 0), 'monthly cost');
  close(r.rows.reduce((a, x) => a + x.share, 0), 1, 'shares');
  assert.equal(r.allOk, true);
});
