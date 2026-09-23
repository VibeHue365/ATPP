
import {
  CheckCircle
} from 'lucide-react';

export function ProviderFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--color-light-border)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        <CheckCircle size={14} style={{ color: 'var(--color-primary)' }} />
        <span>HỆ THỐNG QUẢN LÝ DỮ LIỆU DI SẢN SILK & STONE</span>
      </div>
      <div style={{ display: 'flex', gap: '24px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Báo cáo hệ thống</a>
        <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Trung tâm hỗ trợ</a>
        <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Chính sách bảo mật</a>
      </div>
    </footer>
  );
}
