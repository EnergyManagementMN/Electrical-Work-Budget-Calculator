import { useMemo, useState } from "react";
import type { Calculator } from "../calc/calculators";
import { UI, type Lang } from "../i18n";

const defaultsOf = (c: Calculator) => Object.fromEntries(c.fields.map(f => [f.key, String(f.def)]));

export function CalculatorCard({ calc, index, lang }: { calc: Calculator; index: number; lang: Lang }) {
  const [raw, setRaw] = useState<Record<string, string>>(() => defaultsOf(calc));
  const [copyMsg, setCopyMsg] = useState("");

  const values = useMemo(
    () => Object.fromEntries(Object.entries(raw).map(([k, s]) => {
      const n = parseFloat(s);
      return [k, Number.isFinite(n) ? n : 0];
    })),
    [raw]
  );
  const result = calc.compute(values, lang);

  const copy = async () => {
    const lines = [
      `${calc.title[lang]}`,
      ...calc.fields.map(f => `${f.label[lang]}: ${raw[f.key]}`),
      `→ ${result.headline.value} ${result.headline.unit[lang]}`,
      ...result.rows.map(r => `${r.label[lang]}: ${r.value}`)
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyMsg(UI.copied[lang]);
    } catch {
      setCopyMsg(UI.copyFail[lang]);
    }
    window.setTimeout(() => setCopyMsg(""), 4000);
  };

  return (
    <section className="card" id={calc.id} aria-labelledby={`${calc.id}-title`}>
      <div className="tag">{String(index + 1).padStart(2, "0")} · {calc.tag[lang]}</div>
      <h2 id={`${calc.id}-title`}>{calc.title[lang]}</h2>
      <p className="what">{calc.what[lang]}</p>

      <div className="fields">
        {calc.fields.map(f => {
          const id = `${calc.id}-${f.key}`;
          return (
            <div className="field" key={f.key}>
              <label htmlFor={id}>{f.label[lang]}</label>
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step ?? "any"}
                value={raw[f.key]}
                onChange={e => setRaw(r => ({ ...r, [f.key]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>

      <div className="out" aria-live="polite">
        <div className="big">
          <span className="v">{result.headline.value}</span>
          <span className="u">{result.headline.unit[lang]}</span>
          {result.status && (
            <span className={`pill ${result.status.ok ? "good" : "warn"}`}>{result.status.label[lang]}</span>
          )}
        </div>
        <dl className="rows">
          {result.rows.map(r => (
            <div key={r.label.en}><dt>{r.label[lang]}</dt><dd>{r.value}</dd></div>
          ))}
        </dl>
        {calc.note && <p className="note">{calc.note[lang]}</p>}
      </div>

      <div className="actions">
        <button type="button" className="ghost" onClick={copy}>{UI.copy[lang]}</button>
        <button type="button" className="ghost" onClick={() => setRaw(defaultsOf(calc))}>{UI.reset[lang]}</button>
        <a className="cta" href="#offer">{UI.ctaCard[lang]}</a>
      </div>
      {copyMsg && <p className="toast" role="status">{copyMsg}</p>}
    </section>
  );
}
