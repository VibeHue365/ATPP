import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/hooks/useAuth';
import { ToastProvider } from './components/feedback/Toast';
import { CartProvider } from './context/CartContext';
import { SocketProvider } from './context/SocketContext';
import ScrollToTop from './components/common/ScrollToTop';
import AppRouter from './routes/AppRouter';
import './App.css';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <BrowserRouter>
              <ScrollToTop />
              <AppRouter />
            </BrowserRouter>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
