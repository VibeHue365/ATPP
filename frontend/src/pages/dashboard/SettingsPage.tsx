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
  Key
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';

type SettingsTab = 'personal' | 'security' | 'notifications' | 'transactions';

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
