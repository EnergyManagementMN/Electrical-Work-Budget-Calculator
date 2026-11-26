# Эрчим хүч хэмнэх тооцоолуур — Energy Saving Calculator

An installable web app (PWA) with 6 energy-saving calculators for businesses, in Mongolian and English. It works offline after the first visit and can be added to a phone's home screen.

Calculators: load factor · premium motor · boiler tuning · LED lighting · variable-speed drive · investment (payback, NPV, IRR). Formulas follow Turner & Doty, *Energy Management Handbook*, 6th ed. and are covered by unit tests against the book's worked examples.

## 1. Before you publish — edit `src/config.ts`

- `CONTACT`: your business name, Facebook/Messenger link, phone, email.
- `DEFAULTS`: electricity price, coal price, equipment costs. **All current values are examples** — replace them with real local figures.

## 2. Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev      # opens a local preview at http://localhost:5173
npm test         # runs the formula tests
npm run build    # creates the finished app in the dist/ folder
```

## 3. Put it online (free)

The `dist/` folder is a complete static website. Any static host works, for example:

- **Netlify**: drag the `dist` folder onto app.netlify.com/drop.
- **GitHub Pages / Cloudflare Pages / Vercel**: connect the repository, build command `npm run build`, output folder `dist`.

Use an `https://` address — phones only offer "Install" / "Add to Home Screen" over HTTPS.

## 4. Android app (APK)

The `android/` folder is a Capacitor project that packages the same app as an offline Android app
(package `mn.energysaving.calculator`, Android 7.0+). Needs JDK 21 and the Android SDK (`ANDROID_HOME`).

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

**Signing.** Release builds are signed with `signing/energy-app-release.jks`, configured in
`signing/keystore.properties`. That folder is **not in git**. Keep a backup of both files: every update
must be signed with the same key, or phones will refuse to install it over the old version. Without them,
`assembleRelease` produces an unsigned APK.

To release an update, raise `versionCode` (and `versionName`) in `android/app/build.gradle`.

## Project layout

```
src/
  config.ts                 ← your contact details and default prices
  i18n.ts                   ← all interface text (Mongolian / English)
  calc/formulas.ts          ← pure calculation functions
  calc/formulas.test.ts     ← tests against the handbook's examples
  calc/calculators.ts       ← each calculator: fields, labels, results
  components/CalculatorCard.tsx
  App.tsx, styles.css
public/                     ← app icons
```

To add a calculator: add a formula to `formulas.ts` (with a test), then add one entry to the `CALCULATORS` list in `calculators.ts`. The page builds the card automatically.

## Limits

- Results are estimates, not an official energy audit under Mongolia's Law on Energy Conservation (the footer says so).
- The app does not collect contact details; leads come through the Facebook button and the "Copy result" button.
- Have a native speaker proofread the Mongolian text before launch.
