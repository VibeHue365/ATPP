import React, { useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { useToast } from '../../../components/feedback/Toast';
import { Button } from '../../../components/common/Button';
import { Upload, Check } from 'lucide-react';
import type { UserProfile } from '../types/users.types';

interface AvatarUploaderProps {
  user: UserProfile | null;
  onSuccess?: () => void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ user: _user, onSuccess }) => {
  const { updateAvatar } = useAuth();
  const toast = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSetFile = (file: File) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh phải nhỏ hơn 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      await updateAvatar(formData);
      toast.success('Cập nhật ảnh đại diện thành công!');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Tải ảnh lên thất bại. Hãy chắc chắn tệp là ảnh hợp lệ.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="vh-panel-fade vh-avatar-panel">
      <h3 className="vh-panel-title">Tải lên ảnh đại diện</h3>
      <p className="vh-panel-desc text-sm">Chấp nhận định dạng ảnh PNG, JPG hoặc WEBP. Dung lượng tối đa 5MB.</p>

      <div className="vh-avatar-uploader-area">
        <div 
          className={`vh-drop-zone ${isDragging ? 'vh-drop-zone-active' : ''} ${previewUrl ? 'vh-drop-zone-has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <div className="vh-preview-container">
              <img src={previewUrl} alt="Avatar Preview" className="vh-avatar-preview-img" />
              <p className="vh-preview-filename">{selectedFile?.name}</p>
            </div>
          ) : (
            <div className="vh-drop-zone-placeholder">
              <Upload size={48} className="vh-txt-purple opacity-60 animate-bounce" />
              <p>Kéo và thả tệp ảnh vào đây, hoặc</p>
              <label className="vh-file-select-label">
                <span>Chọn ảnh từ máy tính</span>
                <input 
                  type="file" 
                  accept="image/png,image/jpeg,image/webp" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="vh-uploader-actions">
            <Button 
              variant="outline" 
              onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
              disabled={isUploadingAvatar}
            >
              Hủy bỏ
            </Button>
            <Button 
              variant="primary" 
              onClick={handleUploadAvatar}
              isLoading={isUploadingAvatar}
              leftIcon={<Check size={16} />}
            >
              Cập nhật ảnh đại diện
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
