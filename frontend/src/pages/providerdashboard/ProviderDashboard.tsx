import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingBag, Layers, Camera, Settings, Plus, Download, Bell,
  HelpCircle, MoreVertical, ChevronLeft, ChevronRight, CheckCircle, FileText, Trash2, Play, Pencil,
  Upload, X
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { Modal } from '../../components/common/Modal';
import { API_BASE_URL } from '../../config/env';

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

interface Product {
  _id: string;
  name: string;
  categoryId: {
    _id: string;
    name: string;
  } | string;
  description?: string;
  images: string[];
  basePrice: number;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  style?: string;
  occasions?: string[];
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
}

export const ProviderDashboard: React.FC = () => {
  const toast = useToast();
  
  // Views navigation state: 'orders' | 'collections'
  const [currentView, setCurrentView] = useState<'orders' | 'collections'>('orders');

  // Orders Mock Data & State
  const allOrders: Order[] = [
    { id: '#ORD-7721', customerName: 'Nguyễn Thanh', customerEmail: 'thanh.ng@gmail.com', customerInitials: 'NT', productName: 'Áo dài Tố Nữ (Size M)', orderDate: '14/05/2024', total: '2.450.000đ', status: 'HOÀN THÀNH' },
    { id: '#ORD-7725', customerName: 'Lê Kim', customerEmail: 'kim.le@outlook.com', customerInitials: 'LK', productName: 'Váy Lụa Hà Đông', orderDate: '15/05/2024', total: '1.800.000đ', status: 'CHỜ XỬ LÝ' },
    { id: '#ORD-7728', customerName: 'Phan Hoàng', customerEmail: 'hoangp@company.vn', customerInitials: 'PH', productName: 'Khăn quàng Di sản', orderDate: '15/05/2024', total: '850.000đ', status: 'ĐANG XỬ LÝ' },
    { id: '#ORD-7730', customerName: 'Trần Thảo', customerEmail: 'thaotran.vn@gmail.com', customerInitials: 'TT', productName: 'Mấn đội đầu Phượng', orderDate: '16/05/2024', total: '3.200.000đ', status: 'HOÀN THÀNH' },
    { id: '#ORD-7734', customerName: 'Minh Huy', customerEmail: 'huy.minh@web.com', customerInitials: 'MH', productName: 'Áo Nhật Bình', orderDate: '16/05/2024', total: '5.600.000đ', status: 'CHỜ XỬ LÝ' },
  ];
  const [orders, setOrders] = useState<Order[]>(allOrders);
  const [orderTab, setOrderTab] = useState('Tất cả');
  const [activePage, setActivePage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add/Edit Product Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Product Form Fields
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodBasePrice, setProdBasePrice] = useState('');
  const [prodDepositAmount, setProdDepositAmount] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>([]);
  const [prodColors, setProdColors] = useState<string[]>([]);
  const [prodMaterials, setProdMaterials] = useState<string[]>([]);
  const [prodStatus, setProdStatus] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ACTIVE');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [prodStyle, setProdStyle] = useState('traditional');
  const [prodOccasions, setProdOccasions] = useState<string[]>([]);

  const sizesOptions = ['S', 'M', 'L', 'XL', 'XXL'];
  const colorsOptions = ['RED', 'WHITE', 'GOLD', 'BLACK', 'PINK', 'BLUE', 'GREEN', 'BROWN'];
  const materialsOptions = ['SILK', 'VELVET', 'BROCADE', 'ORGANZA', 'LINEN'];

  // Fetch products and categories
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await httpClient.get<Product[]>('/products/my-listings');
      setProducts(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi tải danh sách sản phẩm');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await httpClient.get<any[]>('/products/categories');
      setCategories(data);
      if (data.length > 0 && !prodCategoryId) {
        setProdCategoryId(data[0]._id);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  useEffect(() => {
    if (currentView === 'collections') {
      fetchProducts();
      fetchCategories();
    }
  }, [currentView]);

  const getImageUrl = (url: string) => {
    if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdDescription('');
    setProdBasePrice('');
    setProdDepositAmount('');
    setProdSizes(['M']);
    setProdColors(['RED']);
    setProdMaterials(['SILK']);
    setProdStatus('ACTIVE');
    setProdImages([]);
    setProdStyle('traditional');
    setProdOccasions(['wedding']);
    if (categories.length > 0) {
      setProdCategoryId(categories[0]._id);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdCategoryId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId);
    setProdDescription(p.description || '');
    setProdBasePrice(p.basePrice.toString());
    setProdDepositAmount(p.depositAmount.toString());
    setProdSizes(p.sizes || []);
    setProdColors(p.colors || []);
    setProdMaterials(p.materials || []);
    setProdStatus(p.status);
    setProdImages(p.images || []);
    setProdStyle(p.style || 'traditional');
    setProdOccasions(p.occasions || []);
    setIsModalOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('images', e.target.files[i]);
      }
      const res = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setProdImages(prev => [...prev, ...res.urls]);
      toast.success('Đã tải lên hình ảnh thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setProdImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleOccasionToggle = (key: string) => {
    setProdOccasions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodCategoryId || !prodBasePrice || !prodDepositAmount) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    if (Number(prodDepositAmount) > Number(prodBasePrice)) {
      toast.error('Giá cọc không được lớn hơn giá thuê');
      return;
    }


    const payload = {
      name: prodName,
      categoryId: prodCategoryId,
      description: prodDescription,
      basePrice: Number(prodBasePrice),
      depositAmount: Number(prodDepositAmount),
      sizes: prodSizes,
      colors: prodColors,
      materials: prodMaterials,
      status: prodStatus,
      images: prodImages.length > 0 ? prodImages : ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'],
      style: prodStyle,
      occasions: prodOccasions,
    };

    try {
      if (editingProduct) {
        await httpClient.patch(`/products/${editingProduct._id}`, payload);
        toast.success(`Cập nhật áo dài "${prodName}" thành công!`);
      } else {
        await httpClient.post('/products', payload);
        toast.success(`Thêm mới áo dài "${prodName}" thành công!`);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác lưu sản phẩm thất bại.');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa áo dài "${name}" không?`)) {
      return;
    }
    try {
      await httpClient.delete(`/products/${id}`);
      toast.success(`Đã xóa thành công sản phẩm "${name}".`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Xóa sản phẩm thất bại.');
    }
  };

  const handleSizeToggle = (size: string) => {
    setProdSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
  };

  const handleColorToggle = (color: string) => {
    setProdColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  };

  const handleMaterialToggle = (material: string) => {
    setProdMaterials(prev => prev.includes(material) ? prev.filter(m => m !== material) : [...prev, material]);
  };

  // Orders Tab filter & helpers
  const tabs = [
    { label: 'Tất cả', count: 128 }, { label: 'Chờ xử lý', count: 12 },
    { label: 'Đang thực hiện', count: 45 }, { label: 'Hoàn thành', count: 64 }, { label: 'Đã hủy', count: 7 },
  ];

  const statusMap: Record<string, string> = {
    'Chờ xử lý': 'CHỜ XỬ LÝ', 'Đang thực hiện': 'ĐANG XỬ LÝ', 'Hoàn thành': 'HOÀN THÀNH', 'Đã hủy': 'ĐÃ HỦY',
  };

  const filteredOrders = orderTab === 'Tất cả' ? orders : orders.filter(o => o.status === statusMap[orderTab]);

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

  const changeOrderStatus = (id: string, s: Order['status']) => { 
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o)); 
    setActionMenuId(null); 
  };

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
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(false)}><LayoutDashboard size={18} /> Dashboard</button>
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(currentView === 'orders')}><ShoppingBag size={18} /> Orders</button>
            <button onClick={() => setCurrentView('collections')} style={navItemStyle(currentView === 'collections')}><Layers size={18} /> Collections</button>
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(false)}><Camera size={18} /> Photographers</button>
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(false)}><Settings size={18} /> Settings</button>
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
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
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>Lê Studio</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PROVIDER</div>
              </div>
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d" alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-light-border)' }} />
            </div>
          </div>
        </header>

        {/* CONTENT SWITCH PANEL */}
        {currentView === 'orders' ? (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Trạng thái:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tabs.map(t => (
                    <button key={t.label} onClick={() => setOrderTab(t.label)} style={{
                      padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                      backgroundColor: orderTab === t.label ? 'var(--color-dark-bg)' : 'var(--color-light-bg)',
                      color: orderTab === t.label ? 'white' : 'var(--color-text-secondary)',
                      transition: 'var(--transition-smooth)',
                    }}>{t.label} ({t.count})</button>
                  ))}
                </div>
              </div>
              <div style={{
                backgroundColor: '#FDF4F4', border: '1px solid rgba(161,30,34,0.12)', borderRadius: 'var(--radius-md)',
                padding: '24px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Doanh thu tháng này</div>
                <div style={{ fontFamily: 'var(--font-header)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>145.200.000đ</div>
                <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.06, pointerEvents: 'none', color: 'var(--color-primary)' }}><ShoppingBag size={80} /></div>
              </div>
            </div>

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
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Không có đơn hàng nào.</td></tr>
                  ) : filteredOrders.map(o => (
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
                              <button key={a.label} onClick={() => changeOrderStatus(o.id, a.status)} style={{
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
              <div style={{ borderTop: '1px solid var(--color-light-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiển thị 1 - {filteredOrders.length} trong số {filteredOrders.length} đơn hàng</span>
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
        ) : (
          /* COLLECTIONS (PRODUCTS CRUD) VIEW */
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Bộ sưu tập</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>
                  Thêm mới, cập nhật giá, hình ảnh và quản lý kho áo dài của bạn.
                </p>
              </div>
              <button onClick={openAddModal} style={{
                display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-primary)',
                padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                color: 'white', border: 'none', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
              }}><Plus size={14} /> Thêm Áo Dài mới</button>
            </div>

            {loadingProducts ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Đang tải dữ liệu sản phẩm...
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: '100px 40px', textAlign: 'center', backgroundColor: 'white', border: '1px dashed var(--color-light-border)', borderRadius: 'var(--radius-md)' }}>
                <Layers size={48} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: '16px', margin: '0 auto' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Bộ sưu tập của bạn đang trống</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px', marginBottom: '20px' }}>Bắt đầu bằng việc thêm sản phẩm đầu tiên để tiếp cận hàng ngàn khách hàng.</p>
                <button onClick={openAddModal} className="vh-btn vh-btn-primary" style={{ padding: '10px 20px', borderRadius: '6px' }}>Thêm Áo Dài đầu tiên</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {products.map((p) => (
                  <div key={p._id} style={{
                    backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)',
                    boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease',
                  }}>
                    {/* Image */}
                    <div style={{ height: '220px', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--color-light-bg)' }}>
                      <img 
                        src={getImageUrl(p.images?.[0])} 
                        alt={p.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                        backgroundColor: p.status === 'ACTIVE' ? 'var(--color-dark-bg)' : p.status === 'DRAFT' ? 'var(--color-gold)' : '#999',
                        color: 'white',
                      }}>
                        {p.status === 'ACTIVE' ? 'ĐANG BÁN' : p.status === 'DRAFT' ? 'DỰ THẢO' : 'ẨN'}
                      </span>
                    </div>

                    {/* Meta */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {typeof p.categoryId === 'object' ? p.categoryId.name : 'Áo dài'}
                      </span>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.4 }}>
                        {p.name}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '36px' }}>
                        {p.description || 'Không có mô tả sản phẩm.'}
                      </p>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {p.sizes?.map(s => (
                          <span key={s} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', backgroundColor: 'var(--color-light-bg)' }}>{s}</span>
                        ))}
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-light-border)', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GIÁ THUÊ / NGÀY</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{p.basePrice.toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>TIỀN ĐẶT CỌC</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>{p.depositAmount.toLocaleString('vi-VN')}đ</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--color-light-border)', paddingTop: '12px' }}>
                        <button 
                          onClick={() => openEditModal(p)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '8px',
                            borderRadius: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          <Pencil size={12} /> Chỉnh sửa
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p._id, p.name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px',
                            backgroundColor: 'white', border: '1px solid #FCA5A5', borderRadius: '4px',
                            color: '#EF4444', cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          title="Xóa sản phẩm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

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

      {/* -------------------- MODALS: CREATE & EDIT PRODUCT -------------------- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? 'Chỉnh sửa thông tin Áo Dài' : 'Đăng ký Áo Dài mới'} 
        maxWidth="650px"
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TÊN ÁO DÀI *</label>
            <input 
              type="text" 
              value={prodName} 
              onChange={e => setProdName(e.target.value)} 
              placeholder="Ví dụ: Áo Dài Gấm Hoa Đỏ Hỷ Sự" 
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              required 
            />
          </div>

          {/* Category & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>DANH MỤC *</label>
              <select 
                value={prodCategoryId} 
                onChange={e => setProdCategoryId(e.target.value)} 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
                required
              >
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TRẠNG THÁI HIỂN THỊ</label>
              <select 
                value={prodStatus} 
                onChange={e => setProdStatus(e.target.value as any)} 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
              >
                <option value="ACTIVE">Đang hoạt động (Bán)</option>
                <option value="DRAFT">Bản nháp (Ẩn)</option>
                <option value="INACTIVE">Ngừng kinh doanh</option>
              </select>
            </div>
          </div>

          {/* Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>GIÁ THUÊ (VNĐ / NGÀY) *</label>
              <input 
                type="number" 
                value={prodBasePrice} 
                onChange={e => setProdBasePrice(e.target.value)} 
                placeholder="Ví dụ: 350000" 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                required 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TIỀN ĐẶT CỌC ĐỒ (VNĐ) *</label>
              <input 
                type="number" 
                value={prodDepositAmount} 
                onChange={e => setProdDepositAmount(e.target.value)} 
                placeholder="Ví dụ: 500000" 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                required 
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>MÔ TẢ SẢN PHẨM</label>
            <textarea 
              value={prodDescription} 
              onChange={e => setProdDescription(e.target.value)} 
              placeholder="Chất liệu lụa, độ co giãn, lưu ý giặt là..." 
              rows={3}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Image Upload Component */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>HÌNH ẢNH SẢN PHẨM *</label>
            
            {/* Drag & Drop Area */}
            <div 
              style={{
                border: '2px dashed var(--color-light-border)',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-light-bg)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                position: 'relative'
              }}
              onClick={() => document.getElementById('product-image-upload')?.click()}
            >
              <input 
                id="product-image-upload"
                type="file" 
                multiple 
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={28} style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {uploadingImages ? 'Đang tải ảnh lên máy chủ...' : 'Click hoặc Kéo thả nhiều ảnh từ máy của bạn'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</span>
              </div>
            </div>

            {/* Uploaded Images Preview */}
            {prodImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px', marginTop: '8px' }}>
                {prodImages.map((imgUrl, index) => (
                  <div key={index} style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-light-border)' }}>
                    <img 
                      src={getImageUrl(imgUrl)} 
                      alt={`preview-${index}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '10px'
                      }}
                      title="Xóa hình này"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attributes Grid (Sizes, Colors, Materials, Styles, Occasions) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '20px',
            border: '1px solid var(--color-light-border)',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#FAFAFA'
          }}>
            {/* Cột 1: Thuộc tính Vật lý */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Sizes */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kích thước có sẵn (Size)</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {sizesOptions.map(sz => {
                    const isSelected = prodSizes.includes(sz);
                    return (
                      <button 
                        key={sz} 
                        type="button"
                        onClick={() => handleSizeToggle(sz)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colors */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Màu sắc chủ đạo</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {colorsOptions.map(c => {
                    const isSelected = prodColors.includes(c);
                    const colorLabel = {
                      RED: 'Đỏ', WHITE: 'Trắng', GOLD: 'Vàng', BLACK: 'Đen',
                      PINK: 'Hồng', BLUE: 'Xanh dương', GREEN: 'Xanh lá', BROWN: 'Nâu'
                    }[c] || c;
                    return (
                      <button 
                        key={c} 
                        type="button"
                        onClick={() => handleColorToggle(c)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {colorLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materials */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chất liệu</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {materialsOptions.map(m => {
                    const isSelected = prodMaterials.includes(m);
                    const materialLabel = {
                      SILK: 'Lụa', VELVET: 'Nhung', BROCADE: 'Gấm', ORGANZA: 'Organza', LINEN: 'Linen'
                    }[m] || m;
                    return (
                      <button 
                        key={m} 
                        type="button"
                        onClick={() => handleMaterialToggle(m)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {materialLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cột 2: Phân loại Onboarding (Trường phái & Dịp lễ) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--color-light-border)', paddingLeft: '20px' }}>
              {/* Design Style */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trường phái thiết kế *</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    { key: 'traditional', label: 'Truyền thống' },
                    { key: 'modern', label: 'Cách tân' },
                    { key: 'edgy', label: 'Phá cách' }
                  ].map(st => {
                    const isSelected = prodStyle === st.key;
                    return (
                      <button 
                        key={st.key} 
                        type="button"
                        onClick={() => setProdStyle(st.key)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Occasions */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dịp lễ / Sự kiện phù hợp</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {[
                    { key: 'graduation', label: 'Chụp ảnh kỷ yếu' },
                    { key: 'wedding', label: 'Dự đám cưới' },
                    { key: 'festival', label: 'Lễ hội truyền thống' },
                    { key: 'event', label: 'Biểu diễn/Sự kiện' }
                  ].map(oc => {
                    const isSelected = prodOccasions.includes(oc.key);
                    return (
                      <button 
                        key={oc.key} 
                        type="button"
                        onClick={() => handleOccasionToggle(oc.key)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ marginRight: '6px' }}>{isSelected ? '✓' : '+'}</span>
                        {oc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px' }}>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '10px 20px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button 
              type="submit"
              style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
            >
              {editingProduct ? 'Lưu thay đổi' : 'Đăng áo dài'}
            </button>
          </div>

        </form>
      </Modal>

    </div>
  );
};

export default ProviderDashboard;
