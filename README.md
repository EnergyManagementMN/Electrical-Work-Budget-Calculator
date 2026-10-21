# Electrical Work Budget Calculator

Maximum-demand (load) calculator for electrical installations. It implements **SPEC 1 – Load calculation &
demand/diversity factors** from the *Electrical Calc App – Research Log*: connected load is converted to design
demand with a utilisation factor **ku** per load and a coincidence factor **ks** per board (IEC / Schneider EIG method).

## Use it

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
npm test        # unit tests: EIG examples A and B, motor example D, hierarchy, exclusive groups, phases, warnings
npm run build   # regenerate dist/electrical-load-calculator.html
```

- `src/calc.js` – pure calculation engine (no DOM); later modules (cable sizing, voltage drop, short circuit…)
  consume its outputs (`Ib`, `P`, `Q`, `S`).
- `src/app.js`, `src/styles.css`, `index.html` – UI.

## Open items (from the research log)

- Governing Mongolian document (MNS / PUE / SP 256) and its demand tables – not found yet.
- Nominal voltage convention: 400/230 V (default) vs 380/220 V – selectable in the app.
- Default summation (arithmetic vs complex) – complex by default, both shown.
- EIG Fig. A15 workshop example – itemised values unreadable, not yet a test case.

Results are design aids. A licensed engineer must verify factors against the governing local standard.
