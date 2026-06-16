import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { Compass, Home, HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="vh-404-container">
      <div className="vh-404-card">
        <Compass size={64} className="vh-404-icon animate-spin" />
        <h1>404</h1>
        <h2>Lạc bước giữa Cố đô...</h2>
        <p>
          Lối đi bạn đang tìm kiếm không tồn tại hoặc đã được di dời trong dòng thời gian lịch sử của VibeHue. Hãy để la bàn dẫn đường bạn trở lại nhé!
        </p>
        <div className="vh-404-actions">
          <Link to={ROUTES.LANDING} className="vh-btn vh-btn-primary">
            <Home size={18} />
            <span>Trở về Trang chủ</span>
          </Link>
          <a href="mailto:support@vibehue.com" className="vh-btn vh-btn-outline">
            <HelpCircle size={18} />
            <span>Trợ giúp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
export default NotFoundPage;
