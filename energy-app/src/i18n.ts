export type Lang = "mn" | "en";
export type T = Record<Lang, string>;

export const UI = {
  appTitle: { mn: "Эрчим хүч хэмнэх тооцоолуур", en: "Energy Saving Calculator" },
  lead: {
    mn: "Байгууллагынхаа цахилгаан, дулаан, нүүрсний зардлыг хэр бууруулж болохыг 2 минутад ойролцоогоор тооцоолоорой.",
    en: "Estimate in 2 minutes how much your business could cut its electricity, heating and coal costs."
  },
  examples: { mn: "Жишээ утгууд урьдчилан бөглөгдсөн — өөрийн тоогоо оруулна уу.", en: "Example values are pre-filled — enter your own." },
  reset: { mn: "Жишээ утга руу буцаах", en: "Reset to examples" },
  copy: { mn: "Үр дүнг хуулах", en: "Copy result" },
  copied: { mn: "Хуулагдлаа — Messenger-т буулгаад илгээнэ үү", en: "Copied — paste it into Messenger" },
  copyFail: { mn: "Хуулж чадсангүй. Дэлгэцийн зургаа илгээнэ үү.", en: "Couldn't copy. Send a screenshot instead." },
  never: { mn: "Нөхөгдөхгүй", en: "Never pays back" },
  immediate: { mn: "Шууд", en: "Immediate" },
  months: { mn: "сар", en: "months" },
  years: { mn: "жил", en: "years" },
  ctaCard: { mn: "Нарийвчилсан шинжилгээ захиалах →", en: "Book a detailed check →" },
  offerTitle: {
    mn: "Ойролцоо тооцоо хангалтгүй юу? Төлбөрийн баримтаа илгээгээд нарийвчилсан тайлан аваарай.",
    en: "Need more than an estimate? Send your bills and get a detailed report."
  },
  offerSteps: {
    mn: [
      "Сүүлийн 12 сарын цахилгаан, дулааны төлбөрийн баримт, тоног төхөөрөмжийн зургаа илгээнэ.",
      "5 ажлын өдөрт хэмнэлтийн 5–10 арга, зардал, өгөөжийн хугацаатай тайлан хүлээн авна.",
      "30 минутын онлайн уулзалтаар тайлбарлаж өгнө. Газар дээр очих шаардлагагүй."
    ],
    en: [
      "Send 12 months of electricity and heat bills and photos of your equipment.",
      "Within 5 working days, get a report with 5–10 savings measures, costs and payback.",
      "We walk you through it in a 30-minute online call. No site visit needed."
    ]
  },
  offerButton: { mn: "Facebook-ээр захиалах", en: "Book on Facebook" },
  phone: { mn: "Утас", en: "Phone" },
  disclaimer: {
    mn: "Эдгээр нь ерөнхий инженерийн томьёонд үндэслэсэн ойролцоо тооцоо бөгөөд Эрчим хүч хэмнэх тухай хуулийн дагуух албан ёсны эрчим хүчний аудит биш.",
    en: "These are estimates from standard engineering formulas, not an official energy audit under Mongolia's Law on Energy Conservation."
  },
  install: { mn: "Утсандаа суулгах", en: "Install on your phone" },
  offline: { mn: "Интернэтгүй ажиллана", en: "Works offline" }
} satisfies Record<string, T | Record<Lang, string[]>>;

export const fmtNum = (lang: Lang, n: number, digits = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString(lang === "mn" ? "mn-MN" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : "–";

export const fmtMNT = (lang: Lang, n: number) => (Number.isFinite(n) ? `${fmtNum(lang, Math.round(n))} ₮` : "–");

export const fmtYears = (lang: Lang, years: number) => {
  if (!Number.isFinite(years)) return UI.never[lang];
  if (years <= 0) return UI.immediate[lang];
  return years < 1
    ? `${fmtNum(lang, years * 12, 1)} ${UI.months[lang]}`
    : `${fmtNum(lang, years, 1)} ${UI.years[lang]}`;
};
