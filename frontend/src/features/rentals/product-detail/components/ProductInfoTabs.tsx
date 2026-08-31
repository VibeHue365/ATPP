import React from "react";
import type { ProductDetail } from "../types/product-detail.types";

export type ProductInfoTab = "details" | "policies" | "guide";

interface ProductInfoTabsProps {
  product: ProductDetail;
  activeTab: ProductInfoTab;
  onChangeTab: (tab: ProductInfoTab) => void;
}

export const ProductInfoTabs: React.FC<ProductInfoTabsProps> = ({ product, activeTab, onChangeTab }) => (
  <section className="product-info-tabs">
    <div className="product-info-tabs__nav" role="tablist" aria-label="Thông tin sản phẩm">
      {([
        ["details", "Chi tiết sản phẩm"],
        ["policies", "Quy định thuê"],
        ["guide", "Hướng dẫn sử dụng"],
      ] as const).map(([tab, label]) => (
        <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "is-active" : ""} onClick={() => onChangeTab(tab)}>
          {label}
        </button>
      ))}
    </div>

    <div className="product-info-tabs__content">
      {activeTab === "details" && (
        <div>
          <p>{product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}</p>
          <ul>
            <li>Chất liệu chính: {product.materials?.join(", ") || "Chưa cập nhật"}</li>
            <li>Kích thước hỗ trợ: {product.sizes?.join(", ") || "Chưa cập nhật"}</li>
          </ul>
        </div>
      )}

      {activeTab === "policies" && (
        <div>
          <p>Tiền đặt cọc được hoàn lại sau khi cửa hàng nhận lại sản phẩm và xác nhận tình trạng trang phục.</p>
          <p>Khách thuê có trách nhiệm bảo quản trang phục sạch sẽ; chi phí phát sinh do hư hại sẽ được thông báo theo tình trạng thực tế.</p>
          <p>Trả đồ quá hạn có thể phát sinh phụ phí theo quy định của cửa hàng.</p>
        </div>
      )}

      {activeTab === "guide" && (
        <div>
          <p>Không tự ý là/ủi ở nhiệt độ cao. Với lụa và gấm, chỉ sử dụng bàn là hơi nước ở nhiệt độ phù hợp.</p>
          <p>Tránh tiếp xúc với vật nhọn, trang sức gai góc hoặc bề mặt dễ làm xước chất liệu.</p>
          <p>Khi chụp ảnh ngoài trời, hãy nâng nhẹ tà áo để tránh kéo lê trên bùn đất hoặc đá nhọn.</p>
        </div>
      )}
    </div>
  </section>
);
