import React from 'react';
import ReactDOM from 'react-dom/client';  // Updated import for React 18
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root')); // Using createRoot
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
