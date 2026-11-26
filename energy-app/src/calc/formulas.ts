/**
 * Pure calculation functions. Units are SI / MNT.
 * References are to Turner & Doty, Energy Management Handbook, 6th ed. (2007).
 */

/** Load factor = average kW / peak kW. Handbook Ch. 18, Table 18.7. */
export function loadFactor(monthlyKWh: number, days: number, peakKW: number) {
  const avgKW = days > 0 ? monthlyKWh / (24 * days) : NaN;
  const lf = peakKW > 0 ? avgKW / peakKW : NaN;
  return { avgKW, lf };
}

/** Annual saving if peak demand is cut by `cut` (fraction), with a demand charge in MNT/kW·month. */
export function peakCutSaving(peakKW: number, demandRate: number, cut = 0.1) {
  return peakKW * cut * demandRate * 12;
}

/**
 * Premium-efficiency motor. Handbook Ch. 11.15:
 * kWsaved = kW × L × (100/Estd − 100/Eee)
 */
export function motorSavings(p: {
  ratedKW: number; loadFrac: number; effOld: number; effNew: number;
  hours: number; price: number; cost: number;
}) {
  const kWSaved = p.effOld > 0 && p.effNew > 0
    ? p.ratedKW * p.loadFrac * (100 / p.effOld - 100 / p.effNew) : NaN;
  const kWh = kWSaved * p.hours;
  const money = kWh * p.price;
  return { kWSaved, kWh, money, payback: payback(p.cost, money) };
}

/** Boiler tuning. Handbook Ch. 5: % fuel saved = (Enew − Eold) / Enew. */
export function boilerTuning(p: { fuel: number; fuelPrice: number; effOld: number; effNew: number }) {
  const frac = p.effNew > 0 ? (p.effNew - p.effOld) / p.effNew : NaN;
  const fuelSaved = p.fuel * frac;
  return { frac, fuelSaved, money: fuelSaved * p.fuelPrice };
}

/** Lighting retrofit. Handbook Ch. 13: kWh saved = n × ΔW × hours. */
export function ledRetrofit(p: {
  count: number; wattsOld: number; wattsNew: number; hoursPerDay: number;
  daysPerYear: number; price: number; costEach: number;
}) {
  const kWh = (p.count * (p.wattsOld - p.wattsNew) / 1000) * p.hoursPerDay * p.daysPerYear;
  const money = kWh * p.price;
  const investment = p.count * p.costEach;
  return { kWh, money, investment, payback: payback(investment, money) };
}

/**
 * Variable-speed drive on a centrifugal fan/pump. Affinity law (Handbook Eq. 10.5):
 * P2 = P1 × (N2/N1)³, divided by drive efficiency.
 */
export function vfdSavings(p: {
  ratedKW: number; loadFrac: number; speedFrac: number; hours: number;
  price: number; cost: number; driveEff?: number;
}) {
  const driveEff = p.driveEff ?? 0.97;
  const nowKW = p.ratedKW * p.loadFrac;
  const newKW = (nowKW * Math.pow(p.speedFrac, 3)) / driveEff;
  const kWh = Math.max(0, nowKW - newKW) * p.hours;
  const money = kWh * p.price;
  return { nowKW, newKW, kWh, money, payback: payback(p.cost, money) };
}

/** Simple payback in years; Infinity when there is no saving. Handbook Ch. 4. */
export function payback(investment: number, annualSaving: number) {
  return annualSaving > 0 ? investment / annualSaving : Infinity;
}

/** Net present value of a uniform annual saving. Handbook Ch. 4 (P|A,i,n). */
export function npv(rate: number, investment: number, annualSaving: number, years: number) {
  let total = -investment;
  for (let t = 1; t <= years; t++) total += annualSaving / Math.pow(1 + rate, t);
  return total;
}

/** Internal rate of return by bisection; NaN when savings never repay the investment. */
export function irr(investment: number, annualSaving: number, years: number) {
  if (investment <= 0 || annualSaving * years <= investment) return NaN;
  let lo = 0, hi = 10;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid, investment, annualSaving, years) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
