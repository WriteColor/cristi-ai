import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/settings.css';
import SettingsApp from './settings/SettingsApp.jsx';

createRoot(document.getElementById('settings-root')).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
