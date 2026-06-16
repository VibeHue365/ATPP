import React, { useState } from 'react';
import { authService } from '../../auth/services/authService';
import { useToast } from '../../../components/feedback/Toast';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Lock, Check } from 'lucide-react';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess }) => {
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin mật khẩu');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không trùng khớp');
      return;
    }

    setIsChangingPass(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      toast.success('Thay đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Thay đổi mật khẩu thất bại. Mật khẩu hiện tại không đúng.');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="vh-panel-fade vh-password-form">
      <h3 className="vh-panel-title">Thay đổi mật khẩu tài khoản</h3>
      
      <div className="vh-password-inputs">
        <Input
          label="Mật khẩu hiện tại"
          type="password"
          placeholder="••••••••"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          leftIcon={<Lock size={18} />}
          required
        />

        <Input
          label="Mật khẩu mới (Tối thiểu 8 ký tự)"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          leftIcon={<Lock size={18} />}
          required
        />

        <Input
          label="Xác nhận mật khẩu mới"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock size={18} />}
          required
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        isLoading={isChangingPass}
        leftIcon={<Check size={18} />}
        className="mt-6"
      >
        Cập nhật mật khẩu
      </Button>
    </form>
  );
};
