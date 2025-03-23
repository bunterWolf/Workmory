import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../components/App';
import './styles.css';

// Create root for React
const container = document.getElementById('app');
const root = createRoot(container);

// Render the application
root.render(<App />); 