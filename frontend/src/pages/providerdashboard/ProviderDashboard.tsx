import React, { useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Layers, Camera, Settings, Plus, Download, Bell,
  HelpCircle, MoreVertical, ChevronLeft, ChevronRight, CheckCircle, FileText, Trash2, Play
} from 'lucide-react';

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerInitials: string;
  productName: string;
  orderDate: string;
  total: string;
  status: 'HOÀN THÀNH' | 'CHỜ XỬ LÝ' | 'ĐANG XỬ LÝ' | 'ĐÃ HỦY';
}

export const ProviderDashboard: React.FC = () => {
  const allOrders: Order[] = [
    { id: '#ORD-7721', customerName: 'Nguyễn Thanh', customerEmail: 'thanh.ng@gmail.com', customerInitials: 'NT', productName: 'Áo dài Tố Nữ (Size M)', orderDate: '14/05/2024', total: '2.450.000đ', status: 'HOÀN THÀNH' },
    { id: '#ORD-7725', customerName: 'Lê Kim', customerEmail: 'kim.le@outlook.com', customerInitials: 'LK', productName: 'Váy Lụa Hà Đông', orderDate: '15/05/2024', total: '1.800.000đ', status: 'CHỜ XỬ LÝ' },
    { id: '#ORD-7728', customerName: 'Phan Hoàng', customerEmail: 'hoangp@company.vn', customerInitials: 'PH', productName: 'Khăn quàng Di sản', orderDate: '15/05/2024', total: '850.000đ', status: 'ĐANG XỬ LÝ' },
    { id: '#ORD-7730', customerName: 'Trần Thảo', customerEmail: 'thaotran.vn@gmail.com', customerInitials: 'TT', productName: 'Mấn đội đầu Phượng', orderDate: '16/05/2024', total: '3.200.000đ', status: 'HOÀN THÀNH' },
    { id: '#ORD-7734', customerName: 'Minh Huy', customerEmail: 'huy.minh@web.com', customerInitials: 'MH', productName: 'Áo Nhật Bình', orderDate: '16/05/2024', total: '5.600.000đ', status: 'CHỜ XỬ LÝ' },
  ];

  const [orders, setOrders] = useState<Order[]>(allOrders);
  const [tab, setTab] = useState('Tất cả');
  const [activePage, setActivePage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const tabs = [
    { label: 'Tất cả', count: 128 }, { label: 'Chờ xử lý', count: 12 },
    { label: 'Đang thực hiện', count: 45 }, { label: 'Hoàn thành', count: 64 }, { label: 'Đã hủy', count: 7 },
  ];

  const statusMap: Record<string, string> = {
    'Chờ xử lý': 'CHỜ XỬ LÝ', 'Đang thực hiện': 'ĐANG XỬ LÝ', 'Hoàn thành': 'HOÀN THÀNH', 'Đã hủy': 'ĐÃ HỦY',
  };

  const filtered = tab === 'Tất cả' ? orders : orders.filter(o => o.status === statusMap[tab]);

  const statusBadgeStyle = (status: string): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'white' };
    if (status === 'HOÀN THÀNH') return { ...base, backgroundColor: 'var(--color-dark-bg)' };
    if (status === 'CHỜ XỬ LÝ') return { ...base, backgroundColor: 'var(--color-primary)' };
    if (status === 'ĐANG XỬ LÝ') return { ...base, backgroundColor: 'var(--color-gold)' };
    return { ...base, backgroundColor: '#ccc', color: '#555' };
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
    color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)', textDecoration: 'none', borderRadius: '8px',
    backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'var(--transition-smooth)', cursor: 'pointer',
    borderRight: active ? '2px solid var(--color-primary)' : 'none',
  });

  const changeStatus = (id: string, s: Order['status']) => { setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o)); setActionMenuId(null); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      {/* SIDEBAR */}
      <aside style={{ width: '260px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px 24px', flexShrink: 0 }}>
        <div>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '22px', fontWeight: 800, color: 'white', margin: 0 }}>Silk & Stone</h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Rental Marketplace</p>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <a href="#" onClick={e => e.preventDefault()} style={navItemStyle(false)}><LayoutDashboard size={18} /> Dashboard</a>
            <a href="#" onClick={e => e.preventDefault()} style={navItemStyle(true)}><ShoppingBag size={18} /> Orders</a>
            <a href="#" onClick={e => e.preventDefault()} style={navItemStyle(false)}><Layers size={18} /> Collections</a>
            <a href="#" onClick={e => e.preventDefault()} style={navItemStyle(false)}><Camera size={18} /> Photographers</a>
            <a href="#" onClick={e => e.preventDefault()} style={navItemStyle(false)}><Settings size={18} /> Settings</a>
          </nav>
        </div>
        <button onClick={() => alert('New Listing!')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', padding: '12px 16px',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-header)', fontWeight: 700, fontSize: '13px',
          cursor: 'pointer', letterSpacing: '0.05em', transition: 'var(--transition-smooth)',
        }}><Plus size={16} /> New Listing</button>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP BAR */}
        <header style={{
          height: '60px', borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hệ thống Quản lý nhà cung cấp</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', position: 'relative' }}><Bell size={18} /><span style={{ position: 'absolute', top: '0', right: '0', width: '7px', height: '7px', backgroundColor: 'var(--color-primary)', borderRadius: '50%', border: '1px solid white' }} /></button>
            <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}><HelpCircle size={18} /></button>
            <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--color-light-border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>Minh Triết</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ADMIN</div>
              </div>
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100&h=100" alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-light-border)' }} />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
          {/* Title Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Đơn hàng</h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Theo dõi và cập nhật trạng thái đơn hàng từ các bộ sưu tập di sản Silk & Stone.</p>
            </div>
            <button onClick={() => alert('Export CSV')} style={{
              display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', border: '1px solid var(--color-light-border)',
              padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              color: 'var(--color-text-primary)', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
            }}><Download size={14} /> Export CSV</button>
          </div>

          {/* Filters + Revenue */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* Filter Tabs */}
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Trạng thái:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tabs.map(t => (
                  <button key={t.label} onClick={() => setTab(t.label)} style={{
                    padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                    backgroundColor: tab === t.label ? 'var(--color-dark-bg)' : 'var(--color-light-bg)',
                    color: tab === t.label ? 'white' : 'var(--color-text-secondary)',
                    transition: 'var(--transition-smooth)',
                  }}>{t.label} ({t.count})</button>
                ))}
              </div>
            </div>
            {/* Revenue Card */}
            <div style={{
              backgroundColor: '#FDF4F4', border: '1px solid rgba(161,30,34,0.12)', borderRadius: 'var(--radius-md)',
              padding: '24px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Doanh thu tháng này</div>
              <div style={{ fontFamily: 'var(--font-header)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>145.200.000đ</div>
              <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.06, pointerEvents: 'none', color: 'var(--color-primary)' }}><ShoppingBag size={80} /></div>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'var(--color-light-bg)' }}>
                  {['MÃ ĐƠN HÀNG', 'KHÁCH HÀNG', 'SẢN PHẨM', 'NGÀY ĐẶT', 'TỔNG CỘNG', 'TRẠNG THÁI', 'THAO TÁC'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', fontWeight: 700, fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: h === 'TỔNG CỘNG' ? 'right' : h === 'TRẠNG THÁI' || h === 'THAO TÁC' ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Không có đơn hàng nào.</td></tr>
                ) : filtered.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--color-light-border)', transition: 'var(--transition-smooth)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>{o.id}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-secondary)', border: '1px solid var(--color-light-border)' }}>{o.customerInitials}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{o.customerName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{o.customerEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{o.productName}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--color-text-secondary)' }}>{o.orderDate}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right' }}>{o.total}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}><span style={statusBadgeStyle(o.status)}>{o.status}</span></td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', position: 'relative' }}>
                      <button onClick={() => setActionMenuId(actionMenuId === o.id ? null : o.id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}><MoreVertical size={16} /></button>
                      {actionMenuId === o.id && (
                        <div style={{ position: 'absolute', right: '20px', top: '40px', width: '160px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', padding: '4px 0', zIndex: 40 }}>
                          {[
                            { label: 'Hoàn thành', status: 'HOÀN THÀNH' as const, icon: <CheckCircle size={14} />, color: 'var(--color-dark-bg)' },
                            { label: 'Đang thực hiện', status: 'ĐANG XỬ LÝ' as const, icon: <Play size={14} />, color: 'var(--color-gold)' },
                            { label: 'Chờ xử lý', status: 'CHỜ XỬ LÝ' as const, icon: <FileText size={14} />, color: 'var(--color-primary)' },
                            { label: 'Hủy đơn', status: 'ĐÃ HỦY' as const, icon: <Trash2 size={14} />, color: 'var(--color-error)' },
                          ].map(a => (
                            <button key={a.label} onClick={() => changeStatus(o.id, a.status)} style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                              fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: a.color,
                              fontWeight: a.label === 'Hủy đơn' ? 700 : 500, textAlign: 'left',
                            }}>{a.icon} {a.label}</button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            <div style={{ borderTop: '1px solid var(--color-light-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiển thị 1 - {filtered.length} trong số {filtered.length} đơn hàng</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button disabled={activePage === 1} onClick={() => setActivePage(p => Math.max(1, p - 1))} style={{ padding: '6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><ChevronLeft size={14} /></button>
                {[1, 2, 3, '...', 13].map((pg, i) => {
                  const isNum = typeof pg === 'number';
                  const isActive = activePage === pg;
                  return (
                    <button key={i} disabled={!isNum} onClick={() => isNum && setActivePage(pg)} style={{
                      width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: isActive ? 'none' : isNum ? '1px solid var(--color-light-border)' : 'none',
                      backgroundColor: isActive ? 'var(--color-primary)' : isNum ? 'white' : 'transparent',
                      color: isActive ? 'white' : isNum ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      cursor: isNum ? 'pointer' : 'default',
                    }}>{pg}</button>
                  );
                })}
                <button disabled={activePage === 13} onClick={() => setActivePage(p => Math.min(13, p + 1))} style={{ padding: '6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
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
      </div>
    </div>
  );
};

export default ProviderDashboard;
