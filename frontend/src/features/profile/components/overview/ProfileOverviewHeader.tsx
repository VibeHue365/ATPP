import React from 'react';
import { Pencil } from 'lucide-react';

interface ProfileOverviewHeaderProps {
  fullName?: string;
  onEditProfile: () => void;
}

export const ProfileOverviewHeader: React.FC<ProfileOverviewHeaderProps> = ({
  fullName = 'Quý khách',
  onEditProfile
}) => {
  return (
    <div className="lume-overview-header">
      <div className="lume-overview-greeting">
        <h1>Xin chào, {fullName} 👋</h1>
        <p>Chúc bạn một ngày tuyệt vời cùng LUMÉ Di Sản!</p>
      </div>
      <button
        type="button"
        className="lume-overview-edit-btn"
        onClick={onEditProfile}
      >
        <Pencil size={15} />
        <span>Chỉnh sửa hồ sơ</span>
      </button>
    </div>
  );
};
