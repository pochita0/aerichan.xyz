import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { PrivyProvider } from '@privy-io/react-auth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['email', 'wallet', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          logo: 'https://aeri.xyz/favicon.ico', // Optional: match brand
        },

      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
