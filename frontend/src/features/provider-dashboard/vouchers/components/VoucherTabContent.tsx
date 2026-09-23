import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Sparkles,
  Ticket,
  TrendingUp,
  X
} from 'lucide-react';
import { VoucherCard } from './VoucherCard';
import { VoucherModal } from './VoucherModal';
import '../vouchersFigma.css';

interface VoucherTabContentProps {
  vouchers: any[];
  activeCampaign: any;
  openCampaignModal?: () => void;
  handleDeactivateCampaign?: () => Promise<void>;
  submittingCampaign?: boolean;
  hasAodaiCapability?: boolean;
  // Voucher action handlers
  handleCreateOrUpdateVoucher: (e: React.FormEvent) => Promise<void>;
  handleEditVoucher: (voucher: any) => void;
  handleDeleteVoucher: (id: string) => Promise<void>;
  clearVoucherForm: () => void;
  // Voucher modal state
  editingVoucherId: string | null;
  isVoucherModalOpen: boolean;
  setIsVoucherModalOpen: (open: boolean) => void;
  vCode: string;
  setVCode: (val: string) => void;
  vName: string;
  setVName: (val: string) => void;
  vDesc: string;
  setVDesc: (val: string) => void;
  vType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  setVType: (val: 'PERCENTAGE' | 'FIXED_AMOUNT') => void;
  vValue: number | '';
  setVValue: (val: number | '') => void;
  vMaxDiscount: number | '';
  setVMaxDiscount: (val: number | '') => void;
  vMinOrder: number | '';
  setVMinOrder: (val: number | '') => void;
  vUsageLimit: number | '';
  setVUsageLimit: (val: number | '') => void;
  vStartDate: string;
  setVStartDate: (val: string) => void;
  vEndDate: string;
  setVEndDate: (val: string) => void;
}

export const VoucherTabContent: React.FC<VoucherTabContentProps> = ({
  vouchers,
  activeCampaign,
  openCampaignModal,
  handleDeactivateCampaign,
  submittingCampaign,
  hasAodaiCapability,
  handleCreateOrUpdateVoucher,
  handleEditVoucher,
  handleDeleteVoucher,
  clearVoucherForm,
  editingVoucherId,
  isVoucherModalOpen,
  setIsVoucherModalOpen,
  vCode,
  setVCode,
  vName,
  setVName,
  vDesc,
  setVDesc,
  vType,
  setVType,
  vValue,
  setVValue,
  vMaxDiscount,
  setVMaxDiscount,
  vMinOrder,
  setVMinOrder,
  vUsageLimit,
  setVUsageLimit,
  vStartDate,
  setVStartDate,
  vEndDate,
  setVEndDate,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'discount-desc' | 'used-desc'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const now = Date.now();

  // Metrics calculation
  const metrics = useMemo(() => {
    let total = vouchers.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let totalUsed = 0;

    vouchers.forEach((v) => {
      const used = Number(v.usedCount) || 0;
      totalUsed += used;

      const endDate = v.endDate ? new Date(v.endDate).getTime() : null;
      const isPast = endDate ? endDate < now : false;
      const isDepleted = v.usageLimit !== null && v.usageLimit !== undefined && used >= Number(v.usageLimit);
      const isExpSoon = endDate && !isPast && endDate - now <= 7 * 86400000;

      if (isPast || isDepleted) {
        expired++;
      } else if (isExpSoon) {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return { total, active, expiring, expired, totalUsed };
  }, [vouchers, now]);

  // Filtered & Sorted vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter((v) => {
        const endDate = v.endDate ? new Date(v.endDate).getTime() : null;
        const isPast = endDate ? endDate < now : false;
        const used = Number(v.usedCount) || 0;
        const isDepleted = v.usageLimit !== null && v.usageLimit !== undefined && used >= Number(v.usageLimit);
        const isExpSoon = endDate && !isPast && endDate - now <= 7 * 86400000;

        if (statusFilter === 'active') {
          if (isPast || isDepleted) return false;
        } else if (statusFilter === 'expiring') {
          if (!isExpSoon || isPast || isDepleted) return false;
        } else if (statusFilter === 'expired') {
          if (!isPast && !isDepleted) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const codeMatch = (v.code || '').toLowerCase().includes(q);
          const nameMatch = (v.name || '').toLowerCase().includes(q);
          const descMatch = (v.description || '').toLowerCase().includes(q);
          if (!codeMatch && !nameMatch && !descMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'newest') {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortOption === 'oldest') {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }
        if (sortOption === 'discount-desc') {
          return (Number(b.discountValue) || 0) - (Number(a.discountValue) || 0);
        }
        if (sortOption === 'used-desc') {
          return (Number(b.usedCount) || 0) - (Number(a.usedCount) || 0);
        }
        return 0;
      });
  }, [vouchers, statusFilter, searchQuery, sortOption, now]);

  // Paginated items
  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, currentPage, pageSize]);

  const onOpenNewModal = () => {
    clearVoucherForm();
    setIsVoucherModalOpen(true);
  };

  const onCloseModal = () => {
    clearVoucherForm();
    setIsVoucherModalOpen(false);
  };

  return (
    <div style={{ marginTop: 20 }}>
      {/* ==================== 1. STOREWIDE CAMPAIGN BANNER ==================== */}
      {hasAodaiCapability && (
        <div className="vc-campaign-banner">
          <div className="vc-campaign-left">
            <div className="vc-campaign-icon-badge">
              <Sparkles size={24} />
            </div>
            <div className="vc-campaign-title-wrap">
              <div className="vc-campaign-pill">
                <span className="vc-campaign-pulse-dot" />
                {activeCampaign ? 'Chiến dịch toàn shop đang chạy' : 'Chiến dịch giảm giá sản phẩm'}
              </div>
              <h3 className="vc-campaign-title">
                {activeCampaign
                  ? `🎉 ${activeCampaign.occasion || 'Khuyến mãi đặc biệt'} (-${activeCampaign.discountPercent}%)`
                  : 'Tạo Chiến Dịch Giảm Giá Toàn Cửa Hàng Theo %'}
              </h3>
              <p className="vc-campaign-meta">
                {activeCampaign
                  ? `Áp dụng tự động cho toàn bộ áo dài từ ${new Date(
                      activeCampaign.startDate
                    ).toLocaleDateString('vi-VN')} đến ${new Date(
                      activeCampaign.endDate
                    ).toLocaleDateString('vi-VN')}`
                  : 'Kích cầu mùa cưới, dịp lễ Tết bằng cách giảm giá trực tiếp theo % cho tất cả trang phục áo dài.'}
              </p>
            </div>
          </div>

          <div className="vc-campaign-actions">
            {activeCampaign ? (
              <button
                type="button"
                className="vc-btn-campaign-deactivate"
                onClick={handleDeactivateCampaign}
                disabled={submittingCampaign}
              >
                Dừng chiến dịch (Về giá gốc)
              </button>
            ) : (
              openCampaignModal && (
                <button
                  type="button"
                  className="vc-btn-campaign-create"
                  onClick={openCampaignModal}
                >
                  <Plus size={16} />
                  <span>Tạo chiến dịch</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ==================== 2. 4 METRIC KPI CARDS ==================== */}
      <div className="vc-metrics-grid">
        {/* Card 1: Tổng số voucher */}
        <div className="vc-metric-card">
          <div className="vc-metric-icon-box total">
            <Ticket size={24} />
          </div>
          <div className="vc-metric-info">
            <span className="vc-metric-label">Tổng số voucher</span>
            <span className="vc-metric-val">{metrics.total}</span>
            <span className="vc-metric-subtext">Đã tạo trong hệ thống</span>
          </div>
        </div>

        {/* Card 2: Đang hiệu lực */}
        <div className="vc-metric-card">
          <div className="vc-metric-icon-box active">
            <CheckCircle2 size={24} />
          </div>
          <div className="vc-metric-info">
            <span className="vc-metric-label">Đang hiệu lực</span>
            <span className="vc-metric-val">{metrics.active}</span>
            <span className="vc-metric-subtext">Khách hàng sẵn sàng dùng</span>
          </div>
        </div>

        {/* Card 3: Sắp hết hạn */}
        <div className="vc-metric-card">
          <div className="vc-metric-icon-box expiring">
            <Clock size={24} />
          </div>
          <div className="vc-metric-info">
            <span className="vc-metric-label">Sắp hết hạn</span>
            <span className="vc-metric-val">{metrics.expiring}</span>
            <span className="vc-metric-subtext">Hết hạn trong 7 ngày tới</span>
          </div>
        </div>

        {/* Card 4: Lượt đã sử dụng */}
        <div className="vc-metric-card">
          <div className="vc-metric-icon-box used">
            <TrendingUp size={24} />
          </div>
          <div className="vc-metric-info">
            <span className="vc-metric-label">Lượt đã sử dụng</span>
            <span className="vc-metric-val">{metrics.totalUsed}</span>
            <span className="vc-metric-subtext">Khách đã áp dụng mã</span>
          </div>
        </div>
      </div>

      {/* ==================== 3. TOOLBAR CONTROLS ==================== */}
      <div className="vc-toolbar">
        <div className="vc-toolbar-left">
          {/* Search Box */}
          <div className="vc-search-box">
            <Search size={16} className="vc-search-icon" />
            <input
              type="text"
              className="vc-search-input"
              placeholder="Tìm theo mã voucher, tên chương trình..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="vc-filter-pills">
            <button
              type="button"
              className={`vc-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
            >
              <span>Tất cả</span>
              <span className="vc-pill-count">{metrics.total}</span>
            </button>
            <button
              type="button"
              className={`vc-filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('active');
                setCurrentPage(1);
              }}
            >
              <span>Đang hiệu lực</span>
              <span className="vc-pill-count">{metrics.active}</span>
            </button>
            <button
              type="button"
              className={`vc-filter-pill ${statusFilter === 'expiring' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('expiring');
                setCurrentPage(1);
              }}
            >
              <span>Sắp hết hạn</span>
              <span className="vc-pill-count">{metrics.expiring}</span>
            </button>
            <button
              type="button"
              className={`vc-filter-pill ${statusFilter === 'expired' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('expired');
                setCurrentPage(1);
              }}
            >
              <span>Hết lượt / Hết hạn</span>
              <span className="vc-pill-count">{metrics.expired}</span>
            </button>
          </div>
        </div>

        {/* Toolbar Right: Sort & Create Button */}
        <div className="vc-toolbar-right">
          <select
            className="vc-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="discount-desc">Mức giảm cao nhất</option>
            <option value="used-desc">Lượt dùng nhiều nhất</option>
          </select>

          <button
            type="button"
            className="vc-btn-create-voucher"
            onClick={onOpenNewModal}
          >
            <Plus size={16} />
            <span>Tạo Voucher Mới</span>
          </button>
        </div>
      </div>

      {/* ==================== 4. VOUCHER CARDS GRID ==================== */}
      {filteredVouchers.length === 0 ? (
        <div className="vc-empty-state">
          <div className="vc-empty-icon-wrap">
            <Ticket size={32} />
          </div>
          <h3 className="vc-empty-title">
            {searchQuery || statusFilter !== 'all'
              ? 'Không tìm thấy voucher phù hợp'
              : 'Chưa có mã voucher nào'}
          </h3>
          <p className="vc-empty-desc">
            {searchQuery || statusFilter !== 'all'
              ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc đang chọn.'
              : 'Tạo mã voucher đầu tiên để tri ân khách hàng, thu hút thêm lượt đặt lịch thuê áo dài và chụp ảnh.'}
          </p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              type="button"
              className="vc-btn-action edit"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              Xóa bộ lọc
            </button>
          ) : (
            <button
              type="button"
              className="vc-btn-create-voucher"
              onClick={onOpenNewModal}
            >
              <Plus size={16} />
              <span>Tạo Voucher Ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="vc-cards-grid">
          {paginatedVouchers.map((v) => (
            <VoucherCard
              key={v._id || v.id}
              voucher={v}
              onEdit={handleEditVoucher}
              onDelete={handleDeleteVoucher}
            />
          ))}
        </div>
      )}

      {/* ==================== 5. PAGINATION BAR ==================== */}
      {filteredVouchers.length > pageSize && (
        <div className="vc-pagination-bar">
          <div className="vc-pagination-info">
            Hiển thị{' '}
            <strong>
              {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredVouchers.length)}
            </strong>{' '}
            trong <strong>{filteredVouchers.length}</strong> voucher
          </div>

          <div className="vc-pagination-controls">
            <button
              type="button"
              className="vc-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`vc-page-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              className="vc-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ==================== 6. VOUCHER MODAL ==================== */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={onCloseModal}
        onSubmit={handleCreateOrUpdateVoucher}
        editingVoucherId={editingVoucherId}
        vCode={vCode}
        setVCode={setVCode}
        vName={vName}
        setVName={setVName}
        vDesc={vDesc}
        setVDesc={setVDesc}
        vType={vType}
        setVType={setVType}
        vValue={vValue}
        setVValue={setVValue}
        vMaxDiscount={vMaxDiscount}
        setVMaxDiscount={setVMaxDiscount}
        vMinOrder={vMinOrder}
        setVMinOrder={setVMinOrder}
        vUsageLimit={vUsageLimit}
        setVUsageLimit={setVUsageLimit}
        vStartDate={vStartDate}
        setVStartDate={setVStartDate}
        vEndDate={vEndDate}
        setVEndDate={setVEndDate}
      />
    </div>
  );
};
