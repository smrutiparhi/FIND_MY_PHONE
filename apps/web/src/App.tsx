import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { DigitalRainBackground } from './components/effects/DigitalRainBackground';

export function App(): ReactElement {
  return (
    <>
      <DigitalRainBackground />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}
