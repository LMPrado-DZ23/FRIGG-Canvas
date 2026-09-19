import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import { App } from './App.js';

const el = document.getElementById('root');
if (el) createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
