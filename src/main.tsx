import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Ionic core CSS
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

// Register every Ionicon we use so the SVGs are bundled inline
// (Vite doesn't ship the lazy /svg/<name>.svg files by default).
import './icons';

// Initialize i18next before the first render so components that read
// from `useTranslation()` get the right strings on mount.
import './i18n';

// Theme last so its overrides win
import './theme/variables.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
