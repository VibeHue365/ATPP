import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../config/routes';

export const CartEmptyState: React.FC = () => {
  return (
    <div className="vh-cart-empty-box">
      <p className="vh-cart-empty-text">Giỏ hàng hiện tại đang trống.</p>
      <Link to={ROUTES.RENTALS} className="vh-cart-empty-btn">
        THUÊ ÁO DÀI NGAY
      </Link>
    </div>
  );
};

export default CartEmptyState;
