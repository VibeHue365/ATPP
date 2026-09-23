import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Order } from '../types';
import { OrderTableRow } from './OrderTableRow';

interface OrdersTableProps {
  orders: Order[];
  loadingOrders: boolean;
  selectedOrder: Order | null;
  onSelectOrder: (order: Order) => void;
  onOpenActionMenu: (e: React.MouseEvent, order: Order) => void;
  activePage: number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  pageSize?: number;
}

export function OrdersTable({
  orders,
  loadingOrders,
  selectedOrder,
  onSelectOrder,
  onOpenActionMenu,
  activePage,
  setActivePage,
  pageSize = 10,
}: OrdersTableProps) {
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const displayedOrders = orders.slice((activePage - 1) * pageSize, activePage * pageSize);

  return (
    <div className="p-orders-table-card">
      <div style={{ overflowX: 'auto' }}>
        <table className="p-orders-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm / Dịch vụ</th>
              <th>Ngày đặt</th>
              <th style={{ textAlign: 'right' }}>Tổng tiền</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
              <th style={{ textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loadingOrders ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #CBD5E1', borderTopColor: '#460D1D', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Đang tải danh sách đơn hàng...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Không tìm thấy đơn hàng nào</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Thử chọn tab trạng thái hoặc bộ lọc dịch vụ khác.</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayedOrders.map((order, idx) => (
                <OrderTableRow
                  key={order._id}
                  order={order}
                  index={(activePage - 1) * pageSize + idx}
                  isSelected={selectedOrder?._id === order._id}
                  onSelectOrder={onSelectOrder}
                  onOpenActionMenu={onOpenActionMenu}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loadingOrders && orders.length > 0 && (
        <div className="p-orders-pagination">
          <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>
            Hiển thị <b>{Math.min(pageSize, displayedOrders.length)}</b> trên <b>{orders.length}</b> đơn hàng
          </div>

          <div className="p-pagination-pages">
            <button
              type="button"
              className="p-page-btn"
              disabled={activePage <= 1}
              onClick={() => setActivePage((p) => Math.max(1, p - 1))}
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= activePage - 1 && pageNum <= activePage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`p-page-btn ${activePage === pageNum ? 'active' : ''}`}
                    onClick={() => setActivePage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (pageNum === activePage - 2 || pageNum === activePage + 2) {
                return (
                  <span key={pageNum} style={{ padding: '0 4px', color: '#94A3B8' }}>
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              type="button"
              className="p-page-btn"
              disabled={activePage >= totalPages}
              onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
              title="Trang kế tiếp"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersTable;
