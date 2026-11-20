# Electrical Work Budget Calculator

Maximum-demand (load) calculator for electrical installations. It implements **SPEC 1 – Load calculation &
demand/diversity factors** from the *Electrical Calc App – Research Log*: connected load is converted to design
demand with a utilisation factor **ku** per load and a coincidence factor **ks** per board (IEC / Schneider EIG method).

Two apps live here:

| App | Open | What it answers |
|---|---|---|
| Electrical load calculator | `index.html` / `dist/electrical-load-calculator.html` | Maximum demand (kVA, Ib) with ku/ks factors |
| Energy consumption calculator | `energy.html` / `dist/energy-consumption-calculator.html` | kWh, monthly bill, CO₂ and savings payback/NPV/IRR |

## Energy consumption calculator

A browser port of the workbook *Energy_Load_Schedule_Calculator_2026-11-19.xlsx* (Settings, Load_Schedule, Summary,
Monthly_Profile, Savings_Scenarios). Same formulas; the sample project reproduces every workbook output, and
`test/energy.test.js` checks this against the workbook's own computed values.

- **Load schedule** – one row per item: qty, power (kW/HP/W), load factor, diversity, hours/day, days/week,
  months in use, start month and start hour. Rows are validated; bad rows are excluded and flagged.
- **Summary** – connected and demand kW, estimated max demand and peak month, annual kWh, energy cost, demand
  charges, total bill, all-in cost per kWh, CO₂, load factor, totals by category and zone, top 10 consumers, checks.
- **Monthly profile** – seasonal spread, demand charge (kW or kVA basis), fixed charge, reactive penalty, tax,
  total bill, and calibration against metered kWh from bills (flagged outside ±15%).
- **Savings scenarios** – new kW, hours or load factor per load; kWh and cost saved, payback, NPV and IRR, plus a
  portfolio total.
- **Settings** – flat or time-of-use tariff, demand charge, PF, fixed charge, tax, reactive penalty, calendar, CO₂
  factor, defaults, discount rate, zones. Placeholder values are marked until you change them.
- **Project file** – paste rows copied from the workbook (columns A–N), save/open `.json`, export results `.csv`.
  English / Mongolian labels (Mongolian machine-assisted, from the workbook).

Tariff 230 MNT/kWh, demand charge 10,000 MNT/kW-month, PF 0.90, CO₂ 1.0 kg/kWh and 8 % discount rate are the
workbook's placeholders, not published values.

## Electrical load calculator

### Use it

Open `index.html` in a browser, or open the self-contained `dist/electrical-load-calculator.html`. No install, no server.

- **Load schedule** – a main board with nested sub-boards. Each load takes Pn, η, cosφ, quantity, phase, ku,
  standby flag and an optional exclusive group (e.g. `season` = `winter` / `summer`; only the larger option counts).
- **Results** – connected kVA, demand kW / kvar / kVA, power factor, design current Ib, per-phase currents and
  unbalance, at every board and for the whole installation.
- **Warnings** – motor without η, missing cosφ, ks > 1, low ks on lighting/heating boards, demand below the largest
  single load, phase unbalance, no spare capacity, non-local (French) or assembly-only (IEC 61439-2) factors,
  arithmetic vs complex sum differing by > 5 %.
- **Factor library** – editable, every row has a source. Built-in rows are only what the research could source
  (IEC 61439-2 Table 101, UTE C 15-105, NF C 14-100 via the EIG). None is authoritative for Mongolia.
- **Project file** – autosaves in the browser; copy / paste JSON or open a `.json` file to move projects.

## Method

| Step | Formula |
|---|---|
| Installed apparent power | `Pa = Pn / (η · cosφ)`; `P = Pn/η`; `Q = P · tanφ` |
| Max utilisation | `Pa,max = Pa · ku · n` |
| Board demand | `S = ks · k_ext · Σ` (complex P/Q sum by default; arithmetic kVA selectable) |
| Hierarchy | each board applies its own ks to its loads and child-board demand |
| Design current | `Ib = S·10³ / (√3·U)`; per phase `I = S_ph·10³ / (U/√3)` |
| Unbalance | `(Imax − Iavg) / Iavg` |

## Develop

```sh
npm test        # load calc: EIG examples, hierarchy, phases, warnings; energy calc: workbook golden values
npm run build   # regenerate both files in dist/
```

- `src/calc.js` – pure calculation engine (no DOM); later modules (cable sizing, voltage drop, short circuit…)
  consume its outputs (`Ib`, `P`, `Q`, `S`).
- `src/app.js`, `src/styles.css`, `index.html` – load calculator UI.
- `src/energy-calc.js` – energy engine (pure); `src/energy-app.js`, `src/energy.css`, `energy.html` – its UI.

## Open items (from the research log)

- Governing Mongolian document (MNS / PUE / SP 256) and its demand tables – not found yet.
- Nominal voltage convention: 400/230 V (default) vs 380/220 V – selectable in the app.
- Default summation (arithmetic vs complex) – complex by default, both shown.
- EIG Fig. A15 workshop example – itemised values unreadable, not yet a test case.

Results are design aids. A licensed engineer must verify factors against the governing local standard.
