import React from 'react';
import type { InfoTab, ProductDetail } from '../types';

interface ProductInfoTabsProps {
  product: ProductDetail;
  activeInfoTab: InfoTab;
  onChangeTab: (tab: InfoTab) => void;
}

export const ProductInfoTabs: React.FC<ProductInfoTabsProps> = ({
  product,
  activeInfoTab,
  onChangeTab,
}) => {
  return (
    <section
      style={{
        marginTop: '80px',
        borderTop: '1px solid var(--color-light-border)',
        paddingTop: '40px',
      }}
    >
      {/* Tab buttons */}
      <div className="vh-pd-info-tabs-bar">
        <button
          type="button"
          onClick={() => onChangeTab('details')}
          className={`vh-pd-info-tab-btn ${activeInfoTab === 'details' ? 'active' : ''}`}
        >
          CHI TIẾT SẢN PHẨM
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('policies')}
          className={`vh-pd-info-tab-btn ${activeInfoTab === 'policies' ? 'active' : ''}`}
        >
          QUY ĐỊNH THUÊ
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('guide')}
          className={`vh-pd-info-tab-btn ${activeInfoTab === 'guide' ? 'active' : ''}`}
        >
          HƯỚNG DẪN SỬ DỤNG
        </button>
      </div>

      {/* Tab content */}
      <div
        style={{
          minHeight: '120px',
          fontSize: '14px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.8,
        }}
      >
        {activeInfoTab === 'details' && (
          <div className="animate-fade-in">
            <p>
              {product.description ||
                'Chưa có mô tả chi tiết cho sản phẩm này.'}
            </p>
            <ul
              style={{
                listStyleType: 'disc',
                marginLeft: '20px',
                marginTop: '12px',
              }}
            >
              <li>
                Chất liệu chính:{' '}
                {product.materials?.join(', ') || 'Lụa Hà Đông'}
              </li>
              <li>
                Kích thước hỗ trợ: {product.sizes?.join(', ') || 'S, M, L'}
              </li>
              <li>
                Thích hợp chụp ngoại cảnh Đại Nội Huế, Chùa Thiên Mụ, và lăng
                tẩm hoàng cung.
              </li>
            </ul>
          </div>
        )}

        {activeInfoTab === 'policies' && (
          <div className="animate-fade-in">
            <p>
              1. Tiền đặt cọc sẽ được hoàn lại 100% sau khi cửa hàng nhận lại
              sản phẩm và xác nhận không có hư hại nghiêm trọng (rách, cháy, phai
              màu loang lổ).
            </p>
            <p>
              2. Khách thuê có trách nhiệm bảo quản trang phục sạch sẽ. Vết bẩn
              nhẹ có thể giặt sạch không bị tính phí. Hư hại nặng đền bù theo
              thỏa thuận.
            </p>
            <p>
              3. Trả đồ quá hạn ngày phạt 100.000đ / ngày đối với hình thức thuê
              ngày.
            </p>
          </div>
        )}

        {activeInfoTab === 'guide' && (
          <div className="animate-fade-in">
            <p>
              1. Không được tự ý là/ủi trang phục ở nhiệt độ cao. Chỉ sử dụng
              bàn là hơi nước ở nhiệt độ thích hợp cho lụa và gấm.
            </p>
            <p>
              2. Tránh để trang phục tiếp xúc với các vật nhọn, trang sức gai
              góc có thể làm xước tơ lụa.
            </p>
            <p>
              3. Khi di chuyển chụp ảnh ngoài trời, hãy nâng nhẹ tà áo để tránh
              kéo lê trên bùn đất hoặc đá nhọn.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
