import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import traditionalAoDaiImg from '../../../../assets/images/onboarding_traditional.webp';

export function RentalOperationsSummary() {
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);

  return (
    <section className="p-rental-summary" aria-labelledby="rental-summary-title">
      <header className="p-rental-summary-header">
        <div className="p-rental-summary-heading">
          <span className="p-rental-summary-eyebrow">Vận hành thuê áo dài</span>
          <h3 id="rental-summary-title">Tiến độ giao &amp; nhận áo dài</h3>
          <p>
            Theo dõi nhanh tình trạng hiện vật; xử lý và ảnh minh chứng nằm trong chi tiết từng đơn.
          </p>
        </div>
        <div className="p-rental-summary-brand" aria-hidden="true">
          <span>Giữ trọn nét đẹp Việt</span>
          <img src={traditionalAoDaiImg} alt="" />
        </div>
      </header>

      <div className="p-rental-safety">
        <div className="p-rental-safety-copy">
          <div className="p-rental-safety-icon"><ShieldCheck size={19} /></div>
          <div>
            <h4>Quy tắc vận hành &amp; Ký quỹ an toàn</h4>
            <p>Chụp ảnh riêng cho từng áo ở mỗi bước giao nhận. Tiền cọc được TàGo giữ hộ và tự động hoàn trả sau khi hoàn tất đơn.</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsGuidelineOpen(true)} className="p-rental-safety-btn">
          Xem hướng dẫn
        </button>
      </div>

      {isGuidelineOpen && (
        <div className="p-rental-guide-backdrop" onClick={() => setIsGuidelineOpen(false)}>
          <div className="p-rental-guide-modal" role="dialog" aria-modal="true" aria-labelledby="rental-guide-title" onClick={(event) => event.stopPropagation()}>
            <div className="p-rental-guide-header">
              <div><ShieldCheck size={22} /><h3 id="rental-guide-title">Quy tắc vận hành &amp; Ký quỹ an toàn</h3></div>
              <button type="button" aria-label="Đóng hướng dẫn" onClick={() => setIsGuidelineOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-rental-guide-steps">
              <div><strong>1. Chuẩn bị và bàn giao:</strong> Chụp ảnh riêng, rõ nét cho từng áo và phụ kiện trước khi giao.</div>
              <div><strong>2. Kiểm tra khi nhận lại:</strong> Kiểm tra đường may, vết bẩn và hư hỏng trước khi xác nhận.</div>
              <div><strong>3. Hoàn trả tiền cọc:</strong> Sau khi nhận lại và hoàn tất đơn, hệ thống giải tỏa tiền cọc theo quy trình Escrow.</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
