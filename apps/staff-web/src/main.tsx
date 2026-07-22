import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import App from "./App.tsx";
import "@phinduloans/shared/index.css";
import {
  ensureCorrectHost,
  getExpectedModeForStaffWebBuild,
  redirectBorrowerPathsOffMarketing,
} from "@phinduloans/shared/config/siteMode";

// Marketing host must never keep borrowers on /dashboard or auth-hash completions.
redirectBorrowerPathsOffMarketing();
ensureCorrectHost(getExpectedModeForStaffWebBuild());

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.15 : 1.0,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
