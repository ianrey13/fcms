// src/main.jsx
// ============================================
// ✅ CRITICAL: Import Leaflet FIRST and expose to window
// This MUST be before any other imports that use L
// (leaflet-routing-machine expects global L)
// ============================================
import L from 'leaflet';
if (typeof window !== 'undefined') {
    window.L = L;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './contexts/AuthContext';
import { queryClient } from './services/queryClient';
import App from './App.jsx';
import './index.css';

console.log('🚀 FCMS is loading...');
console.log('✅ Leaflet exposed to window.L:', typeof window.L);

const rootElement = document.getElementById('root');

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <BrowserRouter>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                    <ReactQueryDevtools initialIsOpen={false} />
                </QueryClientProvider>
            </BrowserRouter>
        </React.StrictMode>
    );
}