import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { Compass, Send } from 'lucide-react';
import { useToast } from '../feedback/Toast';

export const Footer: React.FC = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    toast.success('Đăng ký nhận bản tin di sản thành công!');
    setEmail('');
  };

  return (
    <footer className="vh-footer">
      <div className="vh-footer-container">
        {/* Brand Column */}
        <div className="vh-footer-brand">
          <Link to={ROUTES.LANDING} className="vh-footer-logo">
            <Compass size={24} className="vh-txt-gold" />
            <span>Silk & Stone</span>
          </Link>
          <p>Tôn vinh vẻ đẹp di sản Việt thông qua công nghệ và tâm hồn nghệ thuật.</p>
        </div>
        
        {/* Explore Links */}
        <div className="vh-footer-links">
          <h4>EXPLORE</h4>
          <ul>
            <li><a href="#history">The History of Ao Dai</a></li>
            <li><a href="#craftsmanship">Craftsmanship</a></li>
            <li><a href="#artisans">Our Artisans</a></li>
          </ul>
        </div>

        {/* Support Links */}
        <div className="vh-footer-links">
          <h4>SUPPORT</h4>
          <ul>
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
            <li><a href="#contact">Contact Us</a></li>
          </ul>
        </div>

        {/* Newsletter Column */}
        <div className="vh-footer-links">
          <h4>NEWSLETTER</h4>
          <form onSubmit={handleSubscribe} className="flex gap-2 mt-4 max-w-sm">
            <div className="vh-input-wrapper flex-1">
              <input
                type="email"
                placeholder="Email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="vh-input-field text-sm py-2 px-3 bg-slate-900 border-slate-700 text-white"
                required
              />
            </div>
            <button
              type="submit"
              className="vh-btn vh-btn-secondary p-2.5 rounded-lg"
              title="Đăng ký"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
      
      <div className="vh-footer-bottom">
        <p>© {new Date().getFullYear()} Silk & Stone Heritage. All rights reserved.</p>
      </div>
    </footer>
  );
};
