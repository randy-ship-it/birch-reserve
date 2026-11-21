import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import { captureAttribution } from '@/lib/attribution';
import { initAnalytics } from '@/lib/analytics';
import { ensurePromo } from '@/lib/promo';

// First-touch UTM / referrer / landing page, then analytics (both no-op safely).
captureAttribution();
initAnalytics();
// Street team link + promo code: keep ?st= / ?code= for 30 days (last touch), count the visit.
ensurePromo();

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
