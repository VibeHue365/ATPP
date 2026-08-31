import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageOpen, RotateCcw, Scissors, Camera } from 'lucide-react';
import { ROUTES } from '../../../config/routes';

interface ComboEmptyStateProps {
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export const ComboEmptyState: React.FC<ComboEmptyStateProps> = ({
  onResetFilters,
  isFiltered = false
}) => {
  const navigate = useNavigate();

  return (
    <div className="lume-combo-empty-container">
      <div className="lume-combo-empty-icon-box">
        <PackageOpen size={40} />
      </div>

      <h3 className="lume-combo-empty-title">
        {isFiltered ? 'Không tìm thấy combo phù hợp' : 'Chưa có combo trọn gói nào'}
      </h3>

      <p className="lume-combo-empty-desc">
        {isFiltered
          ? 'Không có gói combo nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại của bạn. Hãy thử điều chỉnh hoặc xóa bộ lọc để xem toàn bộ danh sách.'
          : 'Các combo ưu đãi trọn gói mới đang được chuẩn bị và sẽ sớm ra mắt. Trong lúc chờ đợi, bạn có thể tham khảo các bộ sưu tập áo dài và thợ ảnh riêng lẻ.'}
      </p>

      <div className="lume-combo-empty-actions">
        {isFiltered && onResetFilters && (
          <button
            type="button"
            className="lume-combo-empty-btn-primary"
            onClick={onResetFilters}
          >
            <RotateCcw size={15} />
            <span>Xóa tất cả bộ lọc</span>
          </button>
        )}

        <button
          type="button"
          className="lume-combo-empty-btn-outline"
          onClick={() => navigate(ROUTES.RENTALS)}
        >
          <Scissors size={15} />
          <span>Khám phá Áo Dài</span>
        </button>

        <button
          type="button"
          className="lume-combo-empty-btn-outline"
          onClick={() => navigate(ROUTES.PHOTOGRAPHERS)}
        >
          <Camera size={15} />
          <span>Khám phá Thợ Ảnh</span>
        </button>
      </div>
    </div>
  );
};
