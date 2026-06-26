import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/hooks/useAuth';
import { ToastProvider } from './components/feedback/Toast';
import { CartProvider } from './context/CartContext';
import ScrollToTop from './components/common/ScrollToTop';
import AppRouter from './routes/AppRouter';
import './App.css';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppRouter />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
