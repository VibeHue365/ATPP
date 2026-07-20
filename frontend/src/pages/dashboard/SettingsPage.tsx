import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../../config/routes';
import { useToast } from '../../components/feedback/Toast';
import { ChangePasswordForm } from '../../features/users/components/ChangePasswordForm';
import {
  User,
  Lock,
  Bell,
  History,
  Calendar,
  Check,
  Key,
  Fingerprint
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { httpClient } from '../../services/httpClient';

type SettingsTab = 'personal' | 'preferences' | 'security' | 'notifications' | 'transactions';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');

  // Personal Info Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  
  // Custom address persistent in localStorage
  const [address, setAddress] = useState('');

  // Avatar states
  const [isUploading, setIsUploading] = useState(false);

  // Notifications Mock States
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [promoNotif, setPromoNotif] = useState(true);

  // Sở thích cá nhân (đồng bộ cùng data với onboarding qua /users/me/preferences)
  const [prefStyle, setPrefStyle] = useState<string | null>(null);
  const [prefColor, setPrefColor] = useState<string | null>(null);
  const [prefSize, setPrefSize] = useState<string | null>(null);
  const [prefHeight, setPrefHeight] = useState('');
  const [prefWeight, setPrefWeight] = useState('');
  const [prefOccasion, setPrefOccasion] = useState<string | null>(null);
  const [prefSizeInfoRaw, setPrefSizeInfoRaw] = useState<any>({});
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    httpClient.get<any>('/users/me').then((me) => {
      const p = me?.preferences || {};
      setPrefStyle(p.preferredAoDaiStyles?.[0] ? String(p.preferredAoDaiStyles[0]).toLowerCase() : null);
      setPrefColor(p.favoriteColors?.[0] ? String(p.favoriteColors[0]).toLowerCase() : null);
      setPrefSize(p.sizeInfo?.preferredSize ?? null);
      setPrefHeight(p.sizeInfo?.height != null ? String(p.sizeInfo.height) : '');
      setPrefWeight(p.sizeInfo?.weight != null ? String(p.sizeInfo.weight) : '');
      setPrefOccasion(p.preferredOccasions?.[0] ? String(p.preferredOccasions[0]).toLowerCase() : null);
      setPrefSizeInfoRaw(p.sizeInfo || {});
    }).catch(() => { /* để trống */ });
  }, []);

  const styleOptions = [{ key: 'traditional', label: 'Truyền thống' }, { key: 'modern', label: 'Cách tân' }, { key: 'edgy', label: 'Phá cách' }];
  const colorOptions = [{ key: 'pastel', label: 'Pastel nhẹ nhàng' }, { key: 'red_gold', label: 'Đỏ · Vàng' }, { key: 'dark', label: 'Tông trầm' }, { key: 'colorful', label: 'Rực rỡ' }];
  const sizeOptions = ['S', 'M', 'L', 'XL', 'XXL'];
  const occasionOptions = [{ key: 'graduation', label: 'Chụp kỷ yếu' }, { key: 'wedding', label: 'Dự đám cưới' }, { key: 'festival', label: 'Lễ hội' }, { key: 'event', label: 'Sự kiện' }];
  const groupLabelStyle: React.CSSProperties = { display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#8C7E6D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' };
  const chipRowStyle: React.CSSProperties = { display: 'flex', gap: '10px', flexWrap: 'wrap' };
  const prefInputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #E0D9CC', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FCFAF6' };
  const chipStyle = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, border: active ? '1.5px solid var(--color-primary)' : '1px solid #E0D9CC', backgroundColor: active ? 'var(--color-primary-trans)' : 'white', color: active ? 'var(--color-primary)' : '#5A5248', cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? '0 0 0 3px rgba(139,20,20,0.06)' : 'none' });
  const colorSwatch: Record<string, string> = { pastel: 'linear-gradient(135deg,#F7D6E0,#D6C8F0)', red_gold: 'linear-gradient(135deg,#C0392B,#D4AC0D)', dark: '#2C2C2C', colorful: 'linear-gradient(135deg,#E24B4A,#EF9F27,#27AE60,#378ADD)' };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await httpClient.patch('/users/me/preferences', {
        hasCompletedOnboarding: true,
        preferences: {
          preferredAoDaiStyles: prefStyle ? [prefStyle.toUpperCase()] : [],
          favoriteColors: prefColor ? [prefColor.toUpperCase()] : [],
          preferredOccasions: prefOccasion ? [prefOccasion.toUpperCase()] : [],
          sizeInfo: {
            ...prefSizeInfoRaw,
            preferredSize: prefSize || null,
            height: prefHeight ? Number(prefHeight) : null,
            weight: prefWeight ? Number(prefWeight) : null,
          },
        },
      });
      toast.success('Đã lưu sở thích cá nhân!');
    } catch (err: any) {
      toast.error(err.message || 'Lưu sở thích thất bại. Vui lòng thử lại.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Initialize form with current user details
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setGender(user.gender || '');
      if (user.dateOfBirth) {
        setDateOfBirth(new Date(user.dateOfBirth).toISOString().split('T')[0]);
      }
      setAddress(localStorage.getItem(`vh_user_address_${user.id}`) || '123 Phố Huế, Quận Hai Bà Trưng, Hà Nội, Việt Nam');
    }
  }, [user]);

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      const filename = user.avatar.includes('/') || user.avatar.includes('\\') 
        ? user.avatar.split(/[/\\]/).pop() 
        : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    return '/avatar_hanna.png';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size and format
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước ảnh đại diện tối đa là 2MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await updateAvatar(formData);
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      toast.error('Họ tên không được để trống');
      return;
    }

    try {
      const payload: any = { fullName };
      if (phone) payload.phone = phone;
      if (gender) payload.gender = gender;
      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

      await updateProfile(payload);

      // Save custom address
      if (user?.id) {
        localStorage.setItem(`vh_user_address_${user.id}`, address);
        // Also ensure location matches address city/province
        const parts = address.split(',');
        const lastPart = parts[parts.length - 1]?.trim() || 'Hà Nội, VN';
        localStorage.setItem(`vh_user_location_${user.id}`, lastPart);
        
        // Dispatch global sync event
        window.dispatchEvent(new Event('vh-profile-updated'));
      }

      toast.success('Lưu thay đổi thông tin cá nhân thành công!');
      navigate(ROUTES.PROFILE);
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thông tin thất bại');
    }
  };

  // Mock data for transactions history table
  const paymentHistory = [
    {
      id: 'TXN89127021',
      date: '28/04/2026',
      service: 'Thuê trang phục "Hồng Liên Hoa"',
      amount: '1,200,000đ',
      method: 'Chuyển khoản QR',
      status: 'Thành công'
    },
    {
      id: 'TXN89125601',
      date: '10/04/2026',
      service: 'Thuê trang phục "Cúc Họa Mi"',
      amount: '550,000đ',
      method: 'Ví điện tử',
      status: 'Thành công'
    },
    {
      id: 'TXN89110481',
      date: '02/09/2024',
      service: 'Tư vấn Bộ sưu tập "Sắc Son"',
      amount: '300,000đ',
      method: 'Thẻ tín dụng',
      status: 'Thành công'
    }
  ];

  return (
    <div className="vh-settings-page-container">
      <div className="vh-settings-inner-layout">
        
        {/* Left Vertical Menu */}
        <aside className="vh-settings-aside-sidebar">
          <h2 className="vh-settings-aside-title font-header">Cài đặt</h2>
          
          <nav className="vh-settings-aside-nav">
            <button 
              className={`vh-settings-aside-nav-item ${activeTab === 'personal' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <User size={16} />
              <span>Thông tin cá nhân</span>
            </button>

            <button
              className={`vh-settings-aside-nav-item ${activeTab === 'preferences' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <Fingerprint size={16} />
              <span>Sở thích cá nhân</span>
            </button>

            <button
              className={`vh-settings-aside-nav-item ${activeTab === 'security' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={16} />
              <span>Mật khẩu & Bảo mật</span>
            </button>

            <button 
              className={`vh-settings-aside-nav-item ${activeTab === 'notifications' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={16} />
              <span>Thông báo</span>
            </button>

            <button 
              className={`vh-settings-aside-nav-item ${activeTab === 'transactions' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <History size={16} />
              <span>Lịch sử giao dịch</span>
            </button>
          </nav>
        </aside>

        {/* Right Settings Content Area */}
        <main className="vh-settings-main-content-pane">
          
          {/* Tab 1: Personal Info Edit Form */}
          {activeTab === 'personal' && (
            <div className="vh-settings-tab-view animate-fade-in">
              <h3 className="vh-settings-section-title font-header">Chỉnh sửa thông tin cá nhân</h3>
              
              <form onSubmit={handleSaveProfile} className="vh-settings-personal-form">
                
                {/* Avatar block */}
                <div className="vh-settings-avatar-edit-block">
                  <div className="vh-settings-avatar-preview-wrapper" onClick={handleAvatarClick} style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                    <img src={getAvatarUrl()} alt={user?.fullName} className="vh-settings-avatar-img-square" />
                    {isUploading && (
                      <div className="vh-settings-avatar-uploading-spinner">
                        <span className="spinner"></span>
                      </div>
                    )}
                  </div>
                  <div className="vh-settings-avatar-edit-text-block">
                    <button 
                      type="button" 
                      className="vh-settings-avatar-change-btn font-header" 
                      onClick={handleAvatarClick}
                      disabled={isUploading}
                    >
                      Thay đổi ảnh đại diện
                    </button>
                    <p className="vh-settings-avatar-helper-txt">JPG, GIF hoặc PNG. Tối đa 2MB.</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {/* Form fields: 2-column Grid */}
                <div className="vh-settings-form-fields-grid">
                  
                  {/* Full Name */}
                  <div className="vh-settings-input-block">
                    <label className="vh-settings-input-label">HỌ VÀ TÊN</label>
                    <input 
                      type="text" 
                      className="vh-settings-input-field" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên"
                      required
                    />
                  </div>

                  {/* Email (Readonly + Verified Badge) */}
                  <div className="vh-settings-input-block">
                    <label className="vh-settings-input-label">EMAIL</label>
                    <div className="vh-settings-email-input-wrapper">
                      <input 
                        type="email" 
                        className="vh-settings-input-field readonly" 
                        value={user?.email || ''}
                        disabled
                        readOnly
                      />
                      <span className="vh-settings-email-verified-badge">
                        <span className="badge-dot">●</span>
                        <span>Đã xác thực</span>
                      </span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="vh-settings-input-block">
                    <label className="vh-settings-input-label">SỐ ĐIỆN THOẠI</label>
                    <div className="vh-settings-icon-input-wrapper">
                      <input 
                        type="text" 
                        className="vh-settings-input-field" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+84 901 234 567"
                      />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="vh-settings-input-block">
                    <label className="vh-settings-input-label">NGÀY SINH</label>
                    <div className="vh-settings-icon-input-wrapper">
                      <input 
                        type="date" 
                        className="vh-settings-input-field" 
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                      />
                      <Calendar size={18} className="vh-settings-input-right-icon" />
                    </div>
                  </div>

                  {/* Gender: Radio buttons horizontal */}
                  <div className="vh-settings-input-block col-span-2" style={{ gridColumn: 'span 2' }}>
                    <label className="vh-settings-input-label">GIỚI TÍNH</label>
                    <div className="vh-settings-gender-radios-row">
                      <label className="vh-settings-gender-radio-label">
                        <input 
                          type="radio" 
                          name="gender" 
                          value="FEMALE" 
                          checked={gender === 'FEMALE'}
                          onChange={() => setGender('FEMALE')}
                          className="vh-settings-gender-radio-input"
                        />
                        <span className="custom-radio-circle"></span>
                        <span className="radio-text">Nữ</span>
                      </label>

                      <label className="vh-settings-gender-radio-label">
                        <input 
                          type="radio" 
                          name="gender" 
                          value="MALE" 
                          checked={gender === 'MALE'}
                          onChange={() => setGender('MALE')}
                          className="vh-settings-gender-radio-input"
                        />
                        <span className="custom-radio-circle"></span>
                        <span className="radio-text">Nam</span>
                      </label>

                      <label className="vh-settings-gender-radio-label">
                        <input 
                          type="radio" 
                          name="gender" 
                          value="OTHER" 
                          checked={gender === 'OTHER'}
                          onChange={() => setGender('OTHER')}
                          className="vh-settings-gender-radio-input"
                        />
                        <span className="custom-radio-circle"></span>
                        <span className="radio-text">Khác</span>
                      </label>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="vh-settings-input-block col-span-2" style={{ gridColumn: 'span 2' }}>
                    <label className="vh-settings-input-label">ĐỊA CHỈ</label>
                    <input 
                      type="text" 
                      className="vh-settings-input-field" 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Phố Huế, Quận Hai Bà Trưng, Hà Nội, Việt Nam"
                    />
                  </div>
                </div>

                {/* Redirect button to change password tab */}
                <div className="vh-settings-redirect-password-btn-row">
                  <button 
                    type="button" 
                    className="vh-settings-redirect-password-btn" 
                    onClick={() => setActiveTab('security')}
                  >
                    <Key size={14} style={{ marginRight: '6px' }} />
                    <span>Đổi mật khẩu</span>
                  </button>
                </div>

                {/* Footer Buttons aligned right */}
                <div className="vh-settings-footer-actions-row">
                  <button 
                    type="button" 
                    className="vh-settings-action-btn-cancel" 
                    onClick={() => navigate(ROUTES.PROFILE)}
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="vh-settings-action-btn-save font-header"
                  >
                    Lưu thay đổi
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* Tab 2: Security */}
          {activeTab === 'preferences' && (
            <div className="vh-settings-tab-view animate-fade-in" style={{ maxWidth: '680px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                <span style={{ width: '44px', height: '44px', borderRadius: '13px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #4A0E17 100%)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 14px -5px rgba(74,14,23,0.5)' }}>
                  <Fingerprint size={21} />
                </span>
                <div>
                  <h3 className="vh-settings-content-heading font-header" style={{ margin: 0 }}>Sở thích cá nhân</h3>
                  <p style={{ color: '#9A8F80', fontSize: '13px', margin: '3px 0 0', maxWidth: '520px' }}>
                    Giúp hệ thống gợi ý áo dài đúng gu &amp; số đo của bạn — sửa &amp; lưu ngay, không cần làm lại onboarding.
                  </p>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#EDE6D8', margin: '22px 0 26px' }} />

              <div style={{ marginBottom: '26px' }}>
                <label style={groupLabelStyle}>Phong cách yêu thích</label>
                <div style={chipRowStyle}>
                  {styleOptions.map((o) => {
                    const on = prefStyle === o.key;
                    return (
                      <button key={o.key} type="button" onClick={() => setPrefStyle(on ? null : o.key)} style={chipStyle(on)}>
                        {on && <Check size={14} />}{o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '26px' }}>
                <label style={groupLabelStyle}>Tông màu ưa chuộng</label>
                <div style={chipRowStyle}>
                  {colorOptions.map((o) => {
                    const on = prefColor === o.key;
                    return (
                      <button key={o.key} type="button" onClick={() => setPrefColor(on ? null : o.key)} style={chipStyle(on)}>
                        <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: colorSwatch[o.key], border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '26px' }}>
                <label style={groupLabelStyle}>Dịp mặc phù hợp</label>
                <div style={chipRowStyle}>
                  {occasionOptions.map((o) => {
                    const on = prefOccasion === o.key;
                    return (
                      <button key={o.key} type="button" onClick={() => setPrefOccasion(on ? null : o.key)} style={chipStyle(on)}>
                        {on && <Check size={14} />}{o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '26px' }}>
                <label style={groupLabelStyle}>Kích cỡ</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {sizeOptions.map((s) => {
                    const on = prefSize === s;
                    return (
                      <button key={s} type="button" onClick={() => setPrefSize(on ? null : s)} style={{ width: '52px', height: '52px', borderRadius: '13px', fontSize: '15px', fontWeight: 800, border: on ? '1.5px solid var(--color-primary)' : '1px solid #E0D9CC', backgroundColor: on ? 'var(--color-primary)' : 'white', color: on ? 'white' : '#5A5248', cursor: 'pointer', transition: 'all 0.15s', boxShadow: on ? '0 6px 14px -5px rgba(139,20,20,0.5)' : 'none' }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '440px' }}>
                <div>
                  <label style={groupLabelStyle}>Chiều cao (cm)</label>
                  <input type="number" value={prefHeight} onChange={(e) => setPrefHeight(e.target.value)} placeholder="VD: 160" style={prefInputStyle} />
                </div>
                <div>
                  <label style={groupLabelStyle}>Cân nặng (kg)</label>
                  <input type="number" value={prefWeight} onChange={(e) => setPrefWeight(e.target.value)} placeholder="VD: 52" style={prefInputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '22px', borderTop: '1px solid #EDE6D8' }}>
                <button type="button" onClick={handleSavePreferences} disabled={savingPrefs} style={{ padding: '12px 34px', background: savingPrefs ? '#8C827A' : 'linear-gradient(135deg, var(--color-primary) 0%, #4A0E17 100%)', color: 'white', border: 'none', borderRadius: '11px', fontSize: '14px', fontWeight: 700, cursor: savingPrefs ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: savingPrefs ? 'none' : '0 10px 20px -7px rgba(74,14,23,0.45)' }}>
                  <Check size={16} /> {savingPrefs ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="vh-settings-tab-view animate-fade-in" style={{ maxWidth: '480px' }}>
              <h3 className="vh-settings-section-title font-header">Mật khẩu & Bảo mật</h3>
              <p className="text-sm text-stone-500 mb-6">Để bảo mật tài khoản, vui lòng thay đổi mật khẩu định kỳ.</p>
              <ChangePasswordForm onSuccess={() => { toast.success('Đổi mật khẩu thành công!'); setActiveTab('personal'); }} />
            </div>
          )}

          {/* Tab 3: Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="vh-settings-tab-view animate-fade-in" style={{ maxWidth: '600px' }}>
              <h3 className="vh-settings-section-title font-header">Cài đặt thông báo</h3>
              <p className="text-sm text-stone-500 mb-6">Chọn cách thức bạn muốn nhận thông báo từ Di sản Áo Dài.</p>
              
              <div className="vh-settings-notifications-list">
                
                <div className="vh-settings-notification-item">
                  <div className="notif-text">
                    <h4>Thông báo email về dịch vụ</h4>
                    <p>Nhận các cập nhật email về đơn thuê, đặt lịch thử đồ và trạng thái giao hàng.</p>
                  </div>
                  <label className="vh-toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={emailNotif}
                      onChange={(e) => setEmailNotif(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="vh-settings-notification-item">
                  <div className="notif-text">
                    <h4>Tin nhắn SMS nhắc hẹn</h4>
                    <p>Gửi tin nhắn SMS tự động nhắc nhở lịch hẹn thử đồ trước 2 tiếng.</p>
                  </div>
                  <label className="vh-toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={smsNotif}
                      onChange={(e) => setSmsNotif(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="vh-settings-notification-item">
                  <div className="notif-text">
                    <h4>Bản tin di sản & Khuyến mãi</h4>
                    <p>Nhận tin tức về các bộ sưu tập áo dài cổ phong mới và các chương trình ưu đãi.</p>
                  </div>
                  <label className="vh-toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={promoNotif}
                      onChange={(e) => setPromoNotif(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

              </div>

              <div className="vh-settings-footer-actions-row" style={{ marginTop: '40px' }}>
                <button 
                  type="button" 
                  className="vh-settings-action-btn-save font-header"
                  onClick={() => { toast.success('Đã lưu cấu hình thông báo thành công!'); navigate(ROUTES.PROFILE); }}
                >
                  Lưu cấu hình
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: Transaction History */}
          {activeTab === 'transactions' && (
            <div className="vh-settings-tab-view animate-fade-in">
              <h3 className="vh-settings-section-title font-header">Lịch sử giao dịch</h3>
              <p className="text-sm text-stone-500 mb-6">Danh sách các hóa đơn thanh toán giao dịch của bạn.</p>
              
              <div className="vh-profile-payments-table-wrapper" style={{ boxShadow: 'none' }}>
                <table className="vh-profile-payments-table">
                  <thead>
                    <tr>
                      <th>Mã giao dịch</th>
                      <th>Ngày thanh toán</th>
                      <th>Dịch vụ / Trang phục</th>
                      <th>Số tiền</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id}>
                        <td className="font-header font-bold text-stone-900">{payment.id}</td>
                        <td>{payment.date}</td>
                        <td>{payment.service}</td>
                        <td className="font-bold text-stone-950">{payment.amount}</td>
                        <td className="text-stone-500 text-xs">{payment.method}</td>
                        <td>
                          <span className="vh-profile-payment-status-success-badge">
                            <Check size={10} style={{ marginRight: '3px' }} />
                            <span>{payment.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>

      </div>
    </div>
  );
};

export default SettingsPage;
