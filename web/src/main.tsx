import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate } from './AuthGate';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
