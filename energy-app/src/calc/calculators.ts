import { DEFAULTS } from "../config";
import { fmtMNT, fmtNum, fmtYears, type Lang, type T } from "../i18n";
import {
  boilerTuning, irr, ledRetrofit, loadFactor, motorSavings, npv, payback, peakCutSaving, vfdSavings
} from "./formulas";

export type Field = { key: string; label: T; def: number; min?: number; max?: number; step?: number };
export type Result = {
  headline: { value: string; unit: T };
  status?: { ok: boolean; label: T };
  rows: { label: T; value: string }[];
};
export type Calculator = {
  id: string;
  tag: T;
  title: T;
  what: T;
  note?: T;
  fields: Field[];
  compute: (v: Record<string, number>, lang: Lang) => Result;
};

const KW = (l: Lang) => (l === "mn" ? "кВт" : "kW");
const KWH = (l: Lang) => (l === "mn" ? "кВт·ц" : "kWh");

const price: Field = { key: "price", label: { mn: "Цахилгааны үнэ (₮/кВт·ц)", en: "Electricity price (₮/kWh)" }, def: DEFAULTS.electricityPrice, min: 0 };

export const CALCULATORS: Calculator[] = [
  {
    id: "load-factor",
    tag: { mn: "Цахилгааны төлбөр", en: "Electricity bill" },
    title: { mn: "Таны ачааллын коэффициент хэд вэ?", en: "What is your load factor?" },
    what: {
      mn: "Сарын хэрэглээ болон хамгийн их ачааллыг харьцуулж, оргил ачааллыг бууруулах боломж байгаа эсэхийг харуулна.",
      en: "Compares monthly use with peak demand to show whether cutting your peak could save money."
    },
    note: {
      mn: "0.7-оос доош бол тоног төхөөрөмж нэг дор асаах, ажлын бус цагийн ачааллыг шалгах хэрэгтэй.",
      en: "Below 0.7, check equipment starting at the same time and load outside working hours."
    },
    fields: [
      { key: "kwh", label: { mn: "Сарын хэрэглээ (кВт·ц)", en: "Monthly use (kWh)" }, def: 45000, min: 0 },
      { key: "days", label: { mn: "Тооцооны хоног", en: "Days in billing period" }, def: 30, min: 1 },
      { key: "peak", label: { mn: "Хамгийн их ачаалал (кВт)", en: "Peak demand (kW)" }, def: 160, min: 0 },
      { key: "rate", label: { mn: "Чадлын төлбөр (₮/кВт·сар)", en: "Demand charge (₮/kW·month)" }, def: DEFAULTS.demandCharge, min: 0 }
    ],
    compute: (v, lang) => {
      const { avgKW, lf } = loadFactor(v.kwh, v.days, v.peak);
      return {
        headline: { value: fmtNum(lang, lf, 2), unit: { mn: "ачааллын коэффициент", en: "load factor" } },
        status: Number.isFinite(lf) ? { ok: lf >= 0.7, label: lf >= 0.7 ? { mn: "Сайн", en: "Good" } : { mn: "Боломж бий", en: "Opportunity" } } : undefined,
        rows: [
          { label: { mn: "Дундаж ачаалал", en: "Average demand" }, value: `${fmtNum(lang, avgKW, 1)} ${KW(lang)}` },
          {
            label: { mn: "Оргилыг 10% бууруулбал жилд", en: "Cut peak 10% — saving per year" },
            value: v.rate > 0 ? fmtMNT(lang, peakCutSaving(v.peak, v.rate)) : (lang === "mn" ? "Тариф оруулна уу" : "Enter a demand charge")
          }
        ]
      };
    }
  },
  {
    id: "motor",
    tag: { mn: "Цахилгаан хөдөлгүүр", en: "Electric motors" },
    title: { mn: "Өндөр үр ашигтай мотор хэр хэмнэх вэ?", en: "How much does a premium motor save?" },
    what: {
      mn: "Хуучин моторыг IE3/IE4 ангиллын мотороор солиход жилд хэмнэх цахилгаан ба мөнгө.",
      en: "Annual energy and money saved by replacing an old motor with an IE3/IE4 motor."
    },
    note: {
      mn: "Мотор 50%-аас бага ачаалалтай ажиллаж байвал чадлыг нь багасгах нь илүү үр дүнтэй.",
      en: "If the motor runs below 50% load, downsizing it usually saves more."
    },
    fields: [
      { key: "kw", label: { mn: "Моторын чадал (кВт)", en: "Motor rating (kW)" }, def: 30, min: 0 },
      { key: "load", label: { mn: "Дундаж ачаалал (%)", en: "Average load (%)" }, def: 75, min: 1, max: 120 },
      { key: "e1", label: { mn: "Одоогийн АҮК (%)", en: "Current efficiency (%)" }, def: 89, min: 50, max: 99, step: 0.1 },
      { key: "e2", label: { mn: "Шинэ моторын АҮК (%)", en: "New motor efficiency (%)" }, def: 93.6, min: 50, max: 99.5, step: 0.1 },
      { key: "hours", label: { mn: "Жилд ажиллах цаг", en: "Operating hours per year" }, def: 5000, min: 0 },
      price,
      { key: "cost", label: { mn: "Шинэ моторын үнэ (₮)", en: "New motor cost (₮)" }, def: 30 * DEFAULTS.motorCostPerKW, min: 0 }
    ],
    compute: (v, lang) => {
      const r = motorSavings({ ratedKW: v.kw, loadFrac: v.load / 100, effOld: v.e1, effNew: v.e2, hours: v.hours, price: v.price, cost: v.cost });
      return {
        headline: { value: fmtMNT(lang, r.money), unit: { mn: "жилд хэмнэнэ", en: "saved per year" } },
        rows: [
          { label: { mn: "Хэмнэх цахилгаан", en: "Electricity saved" }, value: `${fmtNum(lang, r.kWh)} ${KWH(lang)}` },
          { label: { mn: "Өгөөжийн хугацаа", en: "Payback" }, value: fmtYears(lang, r.payback) }
        ]
      };
    }
  },
  {
    id: "boiler",
    tag: { mn: "Зуух, халаалт", en: "Boilers & heating" },
    title: { mn: "Зуухны шаталтыг тохируулбал хэдэн тонн нүүрс хэмнэх вэ?", en: "How much coal does boiler tuning save?" },
    what: {
      mn: "Агаарын илүүдлийг тохируулж, утааны температурыг бууруулснаар зуухны АҮК-ыг нэмэгдүүлнэ.",
      en: "Tuning excess air and lowering flue-gas temperature raises boiler efficiency."
    },
    note: {
      mn: "Тохируулаагүй удсан зууханд утааны хий шинжлэх нь хамгийн хурдан, хямд арга.",
      en: "For a boiler not tuned in years, a flue-gas test is the fastest, cheapest first step."
    },
    fields: [
      { key: "fuel", label: { mn: "Жилийн түлш (тонн нүүрс)", en: "Annual fuel (tonnes of coal)" }, def: 400, min: 0 },
      { key: "fprice", label: { mn: "Түлшний үнэ (₮/тонн)", en: "Fuel price (₮/tonne)" }, def: DEFAULTS.coalPrice, min: 0 },
      { key: "e1", label: { mn: "Одоогийн АҮК (%)", en: "Current efficiency (%)" }, def: 65, min: 20, max: 98 },
      { key: "e2", label: { mn: "Тохируулсны дараах АҮК (%)", en: "Efficiency after tuning (%)" }, def: 72, min: 20, max: 98 }
    ],
    compute: (v, lang) => {
      const r = boilerTuning({ fuel: v.fuel, fuelPrice: v.fprice, effOld: v.e1, effNew: v.e2 });
      return {
        headline: { value: fmtNum(lang, r.fuelSaved, 1), unit: { mn: "тонн / жил хэмнэнэ", en: "tonnes saved per year" } },
        rows: [
          { label: { mn: "Түлшний хэмнэлт", en: "Fuel saving" }, value: `${fmtNum(lang, r.frac * 100, 1)} %` },
          { label: { mn: "Мөнгөн хэмнэлт", en: "Money saved" }, value: fmtMNT(lang, r.money) }
        ]
      };
    }
  },
  {
    id: "led",
    tag: { mn: "Гэрэлтүүлэг", en: "Lighting" },
    title: { mn: "LED гэрэлд шилжвэл хэдэн жилд нөхөх вэ?", en: "How fast does LED lighting pay back?" },
    what: {
      mn: "Хуучин гэрэлтүүлгийг LED-ээр солиход жилд хэмнэх зардал ба өгөөжийн хугацаа.",
      en: "Annual saving and payback from replacing old lighting with LED."
    },
    fields: [
      { key: "n", label: { mn: "Гэрлийн тоо (ш)", en: "Number of fittings" }, def: 120, min: 0 },
      { key: "w1", label: { mn: "Одоогийн чадал (Вт/ш)", en: "Current watts each" }, def: 72, min: 0 },
      { key: "w2", label: { mn: "LED чадал (Вт/ш)", en: "LED watts each" }, def: 36, min: 0 },
      { key: "h", label: { mn: "Өдөрт асах цаг", en: "Hours on per day" }, def: 12, min: 0, max: 24 },
      { key: "d", label: { mn: "Жилд ажиллах өдөр", en: "Days per year" }, def: 300, min: 0, max: 366 },
      price,
      { key: "c", label: { mn: "Нэг LED + суурилуулалт (₮)", en: "Cost per LED, installed (₮)" }, def: DEFAULTS.ledCostEach, min: 0 }
    ],
    compute: (v, lang) => {
      const r = ledRetrofit({ count: v.n, wattsOld: v.w1, wattsNew: v.w2, hoursPerDay: v.h, daysPerYear: v.d, price: v.price, costEach: v.c });
      return {
        headline: { value: fmtMNT(lang, r.money), unit: { mn: "жилд хэмнэнэ", en: "saved per year" } },
        rows: [
          { label: { mn: "Хэмнэх цахилгаан", en: "Electricity saved" }, value: `${fmtNum(lang, r.kWh)} ${KWH(lang)}` },
          { label: { mn: "Нийт хөрөнгө оруулалт", en: "Total investment" }, value: fmtMNT(lang, r.investment) },
          { label: { mn: "Өгөөжийн хугацаа", en: "Payback" }, value: fmtYears(lang, r.payback) }
        ]
      };
    }
  },
  {
    id: "vfd",
    tag: { mn: "Сэнс, насос", en: "Fans & pumps" },
    title: { mn: "Давтамж хувиргагч тавибал хэр хэмнэх вэ?", en: "What does a variable-speed drive save?" },
    what: {
      mn: "Сэнс, насосны хурдыг бууруулахад чадал хурдны кубтэй пропорциональ буурна.",
      en: "Slowing a fan or pump cuts power roughly with the cube of speed."
    },
    note: {
      mn: "Хувиргагчийн 3% алдагдлыг тооцсон. Статик даралт өндөр системд бодит хэмнэлт бага байна.",
      en: "Includes 3% drive losses. Systems with high static pressure save less in practice."
    },
    fields: [
      { key: "kw", label: { mn: "Хөдөлгүүрийн чадал (кВт)", en: "Motor rating (kW)" }, def: 22, min: 0 },
      { key: "load", label: { mn: "Одоогийн ачаалал (%)", en: "Current load (%)" }, def: 80, min: 1, max: 120 },
      { key: "spd", label: { mn: "Шаардлагатай дундаж хурд (%)", en: "Average speed needed (%)" }, def: 80, min: 10, max: 100 },
      { key: "hours", label: { mn: "Жилд ажиллах цаг", en: "Operating hours per year" }, def: 6000, min: 0 },
      price,
      { key: "cost", label: { mn: "Хувиргагч + суурилуулалт (₮)", en: "Drive cost, installed (₮)" }, def: 22 * DEFAULTS.vfdCostPerKW, min: 0 }
    ],
    compute: (v, lang) => {
      const r = vfdSavings({ ratedKW: v.kw, loadFrac: v.load / 100, speedFrac: v.spd / 100, hours: v.hours, price: v.price, cost: v.cost });
      return {
        headline: { value: fmtMNT(lang, r.money), unit: { mn: "жилд хэмнэнэ", en: "saved per year" } },
        rows: [
          { label: { mn: "Чадал: одоо → шинэ", en: "Power: now → new" }, value: `${fmtNum(lang, r.nowKW, 1)} → ${fmtNum(lang, r.newKW, 1)} ${KW(lang)}` },
          { label: { mn: "Хэмнэх цахилгаан", en: "Electricity saved" }, value: `${fmtNum(lang, r.kWh)} ${KWH(lang)}` },
          { label: { mn: "Өгөөжийн хугацаа", en: "Payback" }, value: fmtYears(lang, r.payback) }
        ]
      };
    }
  },
  {
    id: "investment",
    tag: { mn: "Хөрөнгө оруулалт", en: "Investment" },
    title: { mn: "Энэ төсөл ашигтай юу?", en: "Is this project worth it?" },
    what: {
      mn: "Өгөөжийн хугацаа, цэвэр өнөөгийн үнэ цэнэ (NPV), дотоод өгөөжийн хувь (IRR).",
      en: "Payback, net present value (NPV) and internal rate of return (IRR)."
    },
    note: {
      mn: "NPV эерэг, IRR нь таны зээлийн хүүгээс өндөр бол төсөл ашигтай.",
      en: "Worth doing if NPV is positive and IRR beats your borrowing rate."
    },
    fields: [
      { key: "cost", label: { mn: "Хөрөнгө оруулалт (₮)", en: "Investment (₮)" }, def: 20_000_000, min: 0 },
      { key: "sav", label: { mn: "Жилийн цэвэр хэмнэлт (₮)", en: "Net annual saving (₮)" }, def: 5_000_000, min: 0 },
      { key: "life", label: { mn: "Ашиглах хугацаа (жил)", en: "Life (years)" }, def: 10, min: 1, max: 50 },
      { key: "rate", label: { mn: "Хөнгөлөлтийн хүү (%/жил)", en: "Discount rate (%/yr)" }, def: DEFAULTS.discountRate, min: 0, max: 60 }
    ],
    compute: (v, lang) => {
      const years = Math.round(v.life);
      const value = npv(v.rate / 100, v.cost, v.sav, years);
      const r = irr(v.cost, v.sav, years);
      return {
        headline: { value: fmtMNT(lang, value), unit: { mn: "NPV", en: "NPV" } },
        status: { ok: value >= 0, label: value >= 0 ? { mn: "Ашигтай", en: "Worth it" } : { mn: "Ашиггүй", en: "Not worth it" } },
        rows: [
          { label: { mn: "Энгийн өгөөжийн хугацаа", en: "Simple payback" }, value: fmtYears(lang, payback(v.cost, v.sav)) },
          { label: { mn: "Дотоод өгөөжийн хувь (IRR)", en: "IRR" }, value: Number.isFinite(r) ? `${fmtNum(lang, r * 100, 1)} %` : "–" }
        ]
      };
    }
  }
];
