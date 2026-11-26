import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/unbounded/500.css";
import "@fontsource/unbounded/700.css";
import "./styles.css";
import { isNativeApp } from "./platform";

// The Android app ships its files inside the APK, so it needs no service worker.
if (!isNativeApp) registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
