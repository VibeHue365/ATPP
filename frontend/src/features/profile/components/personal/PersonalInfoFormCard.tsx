import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../auth/hooks/useAuth';
import { useToast } from '../../../../components/feedback/Toast';
import { httpClient } from '../../../../services/httpClient';

export const PersonalInfoFormCard: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('MALE');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setGender((user.gender as any) || 'MALE');
      if (user.dateOfBirth) {
        setDateOfBirth(new Date(user.dateOfBirth).toISOString().split('T')[0]);
      } else {
        setDateOfBirth('');
      }
    }
  }, [user]);

  // Load address & note if available from preferences
  useEffect(() => {
    httpClient
      .get<any>('/users/me')
      .then((me) => {
        if (me?.address) setAddress(me.address);
        if (me?.preferences?.note) setNote(me.preferences.note);
      })
      .catch(() => {
        setAddress((user as any)?.address || user?.addresses?.[0]?.addressLine || '');
      });
  }, [user]);

  const handleReset = () => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setGender((user.gender as any) || 'MALE');
      if (user.dateOfBirth) {
        setDateOfBirth(new Date(user.dateOfBirth).toISOString().split('T')[0]);
      } else {
        setDateOfBirth('');
      }
    }
    toast.info('Đã hoàn tác thay đổi');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Họ tên không được để trống');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined
      });

      // Save custom address & note to preferences
      await httpClient.patch('/users/me/preferences', {
        preferences: {
          note: note.trim()
        },
        address: address.trim()
      });

      window.dispatchEvent(new Event('vh-profile-updated'));
      toast.success('Lưu thông tin cá nhân thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thông tin thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="lume-form-card">
      <div className="lume-form-card-header">
        <h3 className="lume-form-card-title">Thông tin cá nhân</h3>
        <p className="lume-form-card-subtitle">Cập nhật thông tin cá nhân của bạn</p>
      </div>

      {/* Row 1: Full name & Date of birth */}
      <div className="lume-form-grid-2">
        <div className="lume-form-group">
          <label className="lume-form-label">Họ và tên</label>
          <input
            type="text"
            className="lume-form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nhập họ và tên..."
            required
          />
        </div>

        <div className="lume-form-group">
          <label className="lume-form-label">Ngày sinh</label>
          <input
            type="date"
            className="lume-form-input"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Gender & Email */}
      <div className="lume-form-grid-2">
        <div className="lume-form-group">
          <label className="lume-form-label">Giới tính</label>
          <select
            className="lume-form-input"
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>

        <div className="lume-form-group">
          <label className="lume-form-label">Email</label>
          <div className="lume-form-input-wrapper">
            <input
              type="email"
              className="lume-form-input lume-form-input-with-badge"
              value={email}
              disabled
            />
            <span className="lume-verified-badge">
              <CheckCircle2 size={12} /> Đã xác thực
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Phone & Address */}
      <div className="lume-form-grid-2">
        <div className="lume-form-group">
          <label className="lume-form-label">Số điện thoại</label>
          <div className="lume-form-input-wrapper">
            <input
              type="tel"
              className="lume-form-input lume-form-input-with-badge"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901 xxx xxx"
            />
            <span className="lume-verified-badge">
              <CheckCircle2 size={12} /> Đã xác thực
            </span>
          </div>
        </div>

        <div className="lume-form-group">
          <label className="lume-form-label">Địa chỉ</label>
          <input
            type="text"
            className="lume-form-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Địa chỉ liên hệ..."
          />
        </div>
      </div>

      {/* Row 4: Note with 0/200 counter */}
      <div className="lume-form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="lume-form-label">Ghi chú</label>
          <span style={{ fontSize: '11px', color: '#8C827A' }}>{note.length}/200</span>
        </div>
        <textarea
          className="lume-form-textarea"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Thêm ghi chú cá nhân (nếu có)..."
        />
      </div>

      {/* Action buttons */}
      <div className="lume-form-actions">
        <button type="button" className="lume-btn-cancel" onClick={handleReset}>
          Hủy
        </button>
        <button type="submit" disabled={isSaving} className="lume-btn-save">
          <Check size={16} />
          <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
        </button>
      </div>
    </form>
  );
};
