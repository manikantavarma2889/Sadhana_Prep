import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './services/session.tsx';
import { App } from './App.tsx';
import './index.css';

const cache = new QueryClient({ defaultOptions: { queries: { staleTime: 12_000, retry: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cache}>
      <BrowserRouter>
        <SessionProvider><App /></SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
