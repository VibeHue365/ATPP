import React, { useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { useToast } from '../../../components/feedback/Toast';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { User, Phone, Cake, Check, MapPin, Quote } from 'lucide-react';
import type { UserProfile } from '../types/users.types';

interface ProfileEditFormProps {
  user: UserProfile | null;
  onSuccess?: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ user, onSuccess }) => {
  const { updateProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>(user?.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''
  );
  
  // Custom Bio & Location stored in localStorage for premium high-fidelity mockup persistence
  const [bio, setBio] = useState(() => {
    return localStorage.getItem(`vh_user_bio_${user?.id}`) || 'Người yêu tơ lụa & di sản văn hóa Việt';
  });
  const [locationText, setLocationText] = useState(() => {
    return localStorage.getItem(`vh_user_location_${user?.id}`) || 'Hà Nội, VN';
  });
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      toast.error('Họ tên không được để trống');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload: any = { fullName };
      if (phone) payload.phone = phone;
      if (gender) payload.gender = gender;
      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

      await updateProfile(payload);
      
      // Save bio and location
      if (user?.id) {
        localStorage.setItem(`vh_user_bio_${user.id}`, bio);
        localStorage.setItem(`vh_user_location_${user.id}`, locationText);
        // Dispatch global event to update ProfilePage hero details
        window.dispatchEvent(new Event('vh-profile-updated'));
      }

      toast.success('Cập nhật thông tin cá nhân thành công!');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thông tin thất bại');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <form onSubmit={handleSaveProfile} className="vh-panel-fade vh-profile-form">
      <h3 className="vh-panel-title">Cập nhật hồ sơ cá nhân</h3>
      
      <div className="vh-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Input
          label="Họ và tên"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leftIcon={<User size={18} />}
          required
        />

        <Input
          label="Số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          leftIcon={<Phone size={18} />}
          placeholder="Ví dụ: 0987654321"
        />

        <div className="vh-input-group">
          <label className="vh-input-label">Giới tính</label>
          <select 
            className="vh-select-field" 
            value={gender} 
            onChange={(e) => setGender(e.target.value as any)}
            style={{ width: '100%', height: '42px', padding: '8px 12px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'white' }}
          >
            <option value="">Chọn giới tính</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>

        <Input
          label="Ngày sinh"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          leftIcon={<Cake size={18} />}
        />

        <Input
          label="Giới thiệu bản thân (Bio)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          leftIcon={<Quote size={18} />}
          placeholder="Ví dụ: Người yêu di sản Việt..."
          className="col-span-2"
          style={{ gridColumn: 'span 2' }}
        />

        <Input
          label="Địa điểm hiện tại"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          leftIcon={<MapPin size={18} />}
          placeholder="Ví dụ: Hà Nội, VN"
          className="col-span-2"
          style={{ gridColumn: 'span 2' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSavingProfile}
          leftIcon={<Check size={18} />}
          style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
        >
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
};
