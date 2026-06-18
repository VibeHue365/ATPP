import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/hooks/useAuth';
import { ToastProvider } from './components/feedback/Toast';
import AppRouter from './routes/AppRouter';
import './App.css';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
