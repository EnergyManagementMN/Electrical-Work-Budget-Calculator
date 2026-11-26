import { useEffect, useState } from "react";
import { CALCULATORS } from "./calc/calculators";
import { CalculatorCard } from "./components/CalculatorCard";
import { CONTACT } from "./config";
import { UI, type Lang } from "./i18n";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "mn" || saved === "en") return saved;
  } catch { /* storage unavailable */ }
  return "mn";
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = UI.appTitle[lang];
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      <header>
        <div className="wrap head">
          <div className="titleblock">
            <h1 className="brand">{UI.appTitle[lang]}</h1>
            <p className="lead">{UI.lead[lang]}</p>
            <p className="hint">{UI.examples[lang]}</p>
          </div>
          <div className="lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === "mn"} onClick={() => setLang("mn")}>МН</button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
        <nav className="wrap jump" aria-label="Calculators">
          {CALCULATORS.map(c => <a key={c.id} href={`#${c.id}`}>{c.tag[lang]}</a>)}
        </nav>
      </header>

      <main className="wrap">
        <div className="grid">
          {CALCULATORS.map((c, i) => <CalculatorCard key={c.id} calc={c} index={i} lang={lang} />)}
        </div>

        <section className="offer" id="offer">
          <h2>{UI.offerTitle[lang]}</h2>
          <ol>{UI.offerSteps[lang].map(s => <li key={s}>{s}</li>)}</ol>
          <div className="contact">
            <a className="btn" href={CONTACT.facebookUrl} target="_blank" rel="noopener noreferrer">{UI.offerButton[lang]}</a>
            <span>{UI.phone[lang]}: {CONTACT.phone} · {CONTACT.email}</span>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <p>{UI.disclaimer[lang]}</p>
        <p>{CONTACT.businessName} · {UI.offline[lang]}</p>
      </footer>
    </>
  );
}
