import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.tsx'

const getSafeSampleRate = () => {
  const envVal = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  if (envVal) {
    const num = parseFloat(envVal);
    if (!Number.isNaN(num) && Number.isFinite(num) && num >= 0 && num <= 1) {
      return num;
    }
  }
  return import.meta.env.PROD ? 0.2 : 1.0;
};

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: getSafeSampleRate(),
  enabled: !!import.meta.env.VITE_SENTRY_DSN
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
