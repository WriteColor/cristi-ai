import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import CameraApp from './camera/CameraApp.jsx';

createRoot(document.getElementById('camera-root')).render(
  <React.StrictMode>
    <CameraApp />
  </React.StrictMode>
);
