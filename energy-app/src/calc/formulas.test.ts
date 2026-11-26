import { describe, it, expect } from "vitest";
import { fmtYears } from "../i18n";
import {
  loadFactor, peakCutSaving, motorSavings, boilerTuning, ledRetrofit,
  vfdSavings, payback, npv, irr
} from "./formulas";

describe("formulas match the handbook's worked examples", () => {
  it("load factor — Ch. 18 Table 18.7 (172,500 kWh, 31 days, 600 kW → 231.9 kW, 0.39)", () => {
    const r = loadFactor(172500, 31, 600);
    expect(r.avgKW).toBeCloseTo(231.9, 1);
    expect(r.lf).toBeCloseTo(0.39, 2);
  });

  it("premium motor — Ch. 11.15 (100 hp, 4000 h, $0.08, 91.7→95% → ≈$904/yr)", () => {
    const r = motorSavings({ ratedKW: 100 * 0.746, loadFrac: 1, effOld: 91.7, effNew: 95,
      hours: 4000, price: 0.08, cost: 0 });
    expect(r.money).toBeCloseTo(904.29, 1);
  });

  it("boiler tuning — Ch. 5 (76.4% → 81.4% saves 6.14%)", () => {
    const r = boilerTuning({ fuel: 1_100_000, fuelPrice: 1, effOld: 76.4, effNew: 81.4 });
    expect(r.frac * 100).toBeCloseTo(6.14, 2);
  });
});

describe("other calculators", () => {
  it("peak cut saving", () => {
    expect(peakCutSaving(200, 10000, 0.1)).toBeCloseTo(2400000, 6);
  });

  it("LED retrofit", () => {
    const r = ledRetrofit({ count: 100, wattsOld: 72, wattsNew: 36, hoursPerDay: 10,
      daysPerYear: 300, price: 200, costEach: 40000 });
    expect(r.kWh).toBeCloseTo(10800, 6);
    expect(r.money).toBeCloseTo(2_160_000, 6);
    expect(r.payback).toBeCloseTo(4_000_000 / 2_160_000, 6);
  });

  it("VFD follows the cube law and never reports negative savings", () => {
    const r = vfdSavings({ ratedKW: 10, loadFrac: 1, speedFrac: 0.5, hours: 1000, price: 1, cost: 0, driveEff: 1 });
    expect(r.newKW).toBeCloseTo(1.25, 6);
    expect(r.kWh).toBeCloseTo(8750, 6);
    const full = vfdSavings({ ratedKW: 10, loadFrac: 1, speedFrac: 1, hours: 1000, price: 1, cost: 0 });
    expect(full.kWh).toBe(0);
  });

  it("payback is Infinity with no savings", () => {
    expect(payback(1000, 0)).toBe(Infinity);
  });

  it("NPV and IRR (1000 invested, 300/yr, 5 yr)", () => {
    expect(npv(0.1, 1000, 300, 5)).toBeCloseTo(137.24, 2);
    expect(irr(1000, 300, 5)).toBeCloseTo(0.1524, 4);
    expect(irr(1000, 100, 5)).toBeNaN();
  });

  it("payback text: zero cost is immediate, no saving is never", () => {
    expect(fmtYears("en", payback(0, 500))).toBe("Immediate");
    expect(fmtYears("en", payback(1000, 0))).toBe("Never pays back");
  });
});
