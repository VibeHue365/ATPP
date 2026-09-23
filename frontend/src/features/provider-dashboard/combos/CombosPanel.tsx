import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Ticket,
  Eye,
  Play,
  Clock,
  Pause,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { useProviderCampaignState } from '../collections/useProviderCampaignState';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderInventoryState } from '../inventory/useProviderInventoryState';
import type { useProviderPromotionsState } from '../promotions/useProviderPromotionsState';
import { ComboCard } from './components/ComboCard';
import { ComboModal } from './components/ComboModal';
import { getComboDisplayStatus } from './comboStatus';
import { VoucherTabContent } from '../vouchers/components/VoucherTabContent';
import './combosFigma.css';
import '../vouchers/vouchersFigma.css';

type CombosPanelProps = Pick<
  ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<
    ReturnType<typeof useProviderCampaignState>,
    'activeCampaign' | 'submittingCampaign'
  > &
  Pick<
    ReturnType<typeof useProviderPromotionsState>,
    | 'vCode'
    | 'setVCode'
    | 'vName'
    | 'setVName'
    | 'vDesc'
    | 'setVDesc'
    | 'vType'
    | 'setVType'
    | 'vValue'
    | 'setVValue'
    | 'vMaxDiscount'
    | 'setVMaxDiscount'
    | 'vMinOrder'
    | 'setVMinOrder'
    | 'vUsageLimit'
    | 'setVUsageLimit'
    | 'vStartDate'
    | 'setVStartDate'
    | 'vEndDate'
    | 'setVEndDate'
    | 'editingVoucherId'
    | 'setEditingVoucherId'
    | 'isVoucherModalOpen'
    | 'setIsVoucherModalOpen'
    | 'vouchers'
    | 'editingComboId'
    | 'cName'
    | 'setCName'
    | 'cDesc'
    | 'setCDesc'
    | 'cProductId'
    | 'setIsAoDaiModalOpen'
    | 'cPackageId'
    | 'photoPackages'
    | 'setIsPackageModalOpen'
    | 'cDiscount'
    | 'setCDiscount'
    | 'cPrice'
    | 'setCPrice'
    | 'cValidFrom'
    | 'setCValidFrom'
    | 'cValidTo'
    | 'setCValidTo'
    | 'cMaxUsage'
    | 'setCMaxUsage'
    | 'cShootPeopleCount'
    | 'setCShootPeopleCount'
    | 'cAoDaiQuantity'
    | 'setCAoDaiQuantity'
    | 'isAoDaiModalOpen'
    | 'aoDaiSearch'
    | 'setAoDaiSearch'
    | 'setCProductId'
    | 'isPackageModalOpen'
    | 'packageSearch'
    | 'setPackageSearch'
    | 'setCPackageId'
    | 'combos'
  > &
  Pick<
    ReturnType<typeof useProviderInventoryState>,
    'myProductsList' | 'inventorySummary'
  > & {
    hasAodaiCapability: boolean | undefined;
    hasPhotographyCapability: boolean | undefined;
    openCampaignModal: () => void;
    handleDeactivateCampaign: () => Promise<void>;
    handleAddVoucher: (e: FormEvent<Element>) => Promise<void>;
    handleDeleteVoucher: (id: string) => Promise<void>;
    handleCreateOrUpdateVoucher?: (e: FormEvent<Element>) => Promise<void>;
    handleEditVoucher?: (voucher: any) => void;
    clearVoucherForm?: () => void;
    handleCreateOrUpdateCombo: (e: FormEvent<Element>) => Promise<void>;
    clearComboForm: () => void;
    handleEditCombo: (combo: any) => void;
    handleDeleteCombo: (id: string) => Promise<void>;
  };

export const CombosPanel: React.FC<CombosPanelProps> = ({
  isLoadingProvider,
  hasAodaiCapability,
  hasPhotographyCapability: _hasPhotographyCapability,
  openCampaignModal,
  activeCampaign,
  handleDeactivateCampaign,
  submittingCampaign,
  handleAddVoucher,
  handleCreateOrUpdateVoucher,
  handleEditVoucher,
  clearVoucherForm,
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
  editingVoucherId,
  setEditingVoucherId,
  isVoucherModalOpen,
  setIsVoucherModalOpen,
  vouchers,
  handleDeleteVoucher,
  handleCreateOrUpdateCombo,
  editingComboId,
  cName,
  setCName,
  cDesc,
  setCDesc,
  cProductId,
  myProductsList,
  setIsAoDaiModalOpen,
  cPackageId,
  photoPackages,
  setIsPackageModalOpen,
  cDiscount,
  setCDiscount,
  cPrice,
  setCPrice,
  cValidFrom,
  setCValidFrom,
  cValidTo,
  setCValidTo,
  cMaxUsage,
  setCMaxUsage,
  cShootPeopleCount,
  setCShootPeopleCount,
  inventorySummary,
  cAoDaiQuantity,
  setCAoDaiQuantity,
  clearComboForm,
  isAoDaiModalOpen,
  aoDaiSearch,
  setAoDaiSearch,
  setCProductId,
  isPackageModalOpen,
  packageSearch,
  setPackageSearch,
  setCPackageId,
  combos,
  handleEditCombo,
  handleDeleteCombo,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'combos' | 'vouchers'>('combos');

  // Modal state (Wide Modal - Phương án 1)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Local voucher fallback state
  const [internalEditingVoucherId, setInternalEditingVoucherId] = useState<string | null>(null);
  const [internalVoucherModalOpen, setInternalVoucherModalOpen] = useState(false);
  const [internalVDesc, setInternalVDesc] = useState('');
  const [internalVMaxDiscount, setInternalVMaxDiscount] = useState<number | ''>('');
  const [internalVMinOrder, setInternalVMinOrder] = useState<number | ''>(0);
  const [internalVUsageLimit, setInternalVUsageLimit] = useState<number | ''>(50);
  const [internalVStartDate, setInternalVStartDate] = useState('');
  const [internalVEndDate, setInternalVEndDate] = useState('');

  const onInternalEditVoucher = (voucher: any) => {
    const id = voucher._id || voucher.id;
    if (setEditingVoucherId) setEditingVoucherId(id);
    else setInternalEditingVoucherId(id);

    setVCode(voucher.code || '');
    setVName(voucher.name || '');
    if (setVDesc) setVDesc(voucher.description || '');
    else setInternalVDesc(voucher.description || '');

    setVType(voucher.discountType === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE');
    setVValue(voucher.discountValue ?? 10);

    if (setVMaxDiscount) setVMaxDiscount(voucher.maxDiscountAmount ?? '');
    else setInternalVMaxDiscount(voucher.maxDiscountAmount ?? '');

    if (setVMinOrder) setVMinOrder(voucher.minOrderValue ?? 0);
    else setInternalVMinOrder(voucher.minOrderValue ?? 0);

    if (setVUsageLimit) setVUsageLimit(voucher.usageLimit ?? '');
    else setInternalVUsageLimit(voucher.usageLimit ?? '');

    const start = voucher.startDate ? new Date(voucher.startDate).toISOString().split('T')[0] : '';
    const end = voucher.endDate ? new Date(voucher.endDate).toISOString().split('T')[0] : '';

    if (setVStartDate) setVStartDate(start);
    else setInternalVStartDate(start);

    if (setVEndDate) setVEndDate(end);
    else setInternalVEndDate(end);

    if (setIsVoucherModalOpen) setIsVoucherModalOpen(true);
    else setInternalVoucherModalOpen(true);
  };

  const onInternalClearVoucher = () => {
    if (setEditingVoucherId) setEditingVoucherId(null);
    else setInternalEditingVoucherId(null);

    setVCode('');
    setVName('');
    if (setVDesc) setVDesc('');
    else setInternalVDesc('');

    setVType('PERCENTAGE');
    setVValue(10);

    if (setVMaxDiscount) setVMaxDiscount('');
    else setInternalVMaxDiscount('');

    if (setVMinOrder) setVMinOrder(0);
    else setInternalVMinOrder(0);

    if (setVUsageLimit) setVUsageLimit(50);
    else setInternalVUsageLimit(50);

    if (setVStartDate) setVStartDate('');
    else setInternalVStartDate('');

    if (setVEndDate) setVEndDate('');
    else setInternalVEndDate('');
  };

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'discount'>('newest');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const onStartEditCombo = (combo: any) => {
    handleEditCombo(combo);
    setIsModalOpen(true);
  };

  const onOpenNewCombo = () => {
    clearComboForm();
    setIsModalOpen(true);
  };

  const onCloseModal = () => {
    clearComboForm();
    setIsModalOpen(false);
  };

  const handleComboSubmit = async (e: React.FormEvent) => {
    await handleCreateOrUpdateCombo(e);
    setIsModalOpen(false);
  };

  // Metrics calculation
  const now = Date.now();
  const metrics = useMemo(() => {
    let total = combos.length;
    let active = 0;
    let expiring = 0;
    let paused = 0;

    combos.forEach((c) => {
      const displayStatus = getComboDisplayStatus(c, now);
      if (displayStatus.kind === 'active') active++;
      if (displayStatus.kind === 'expiring') {
        expiring++;
        active++;
      }
      if (displayStatus.kind === 'inactive' || displayStatus.kind === 'expired') paused++;
    });

    return { total, active, expiring, paused };
  }, [combos, now]);

  // Filtered & Sorted combos
  const processedCombos = useMemo(() => {
    return combos
      .filter((c) => {
        // Status filter
        const displayStatus = getComboDisplayStatus(c, now);

        if (statusFilter === 'active') {
          if (displayStatus.kind !== 'active' && displayStatus.kind !== 'expiring') return false;
        } else if (statusFilter === 'expiring') {
          if (displayStatus.kind !== 'expiring') return false;
        } else if (statusFilter === 'paused') {
          if (displayStatus.kind !== 'inactive' && displayStatus.kind !== 'expired') return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = (c.name || '').toLowerCase().includes(q);
          const descMatch = (c.description || '').toLowerCase().includes(q);
          const prodMatch = (c.productId?.name || '').toLowerCase().includes(q);
          const pkgMatch = (c.photographyPackageId?.name || '').toLowerCase().includes(q);
          if (!nameMatch && !descMatch && !prodMatch && !pkgMatch) return false;
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
        if (sortOption === 'discount') {
          return (b.discountPercent || 0) - (a.discountPercent || 0);
        }
        const priceA = a.comboPrice || 0;
        const priceB = b.comboPrice || 0;
        if (sortOption === 'price-asc') return priceA - priceB;
        if (sortOption === 'price-desc') return priceB - priceA;
        return 0;
      });
  }, [combos, statusFilter, searchQuery, sortOption, now]);

  // Paginated items
  const totalCombos = processedCombos.length;
  const totalPages = Math.max(1, Math.ceil(totalCombos / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const currentCombos = processedCombos.slice(startIndex, startIndex + pageSize);

  const startDisplay = totalCombos === 0 ? 0 : startIndex + 1;
  const endDisplay = Math.min(startIndex + pageSize, totalCombos);

  const handleOpenStore = () => {
    window.open('/combos', '_blank');
  };

  return (
    <div className="cb-root">
      {/* ==================== 1. TOP HEADER ==================== */}
      <div className="cb-page-header">
        <div className="cb-header-left">
          <div className="cb-header-icon-box">
            {activeTab === 'combos' ? <Layers size={22} /> : <Ticket size={22} />}
          </div>
          <div className="cb-header-title-wrap">
            <h1 className="cb-header-title">
              {activeTab === 'combos' ? 'Combo của tôi' : 'Voucher & Mã giảm giá'}
            </h1>
            <p className="cb-header-subtitle">
              {activeTab === 'combos'
                ? 'Tạo và quản lý các gói combo kết hợp Áo Dài và Chụp Ảnh, mang đến trải nghiệm trọn vẹn cho khách hàng.'
                : 'Thiết kế các chương trình ưu đãi, mã giảm giá và chiến dịch kích cầu mua sắm cho cửa hàng của bạn.'}
            </p>
          </div>
        </div>

        <div className="cb-header-actions">
          <button type="button" className="cb-btn-view-store" onClick={handleOpenStore}>
            <Eye size={15} />
            <span>Xem trang của bạn</span>
          </button>
          {activeTab === 'combos' ? (
            <button type="button" className="cb-btn-create-combo" onClick={onOpenNewCombo}>
              <Plus size={16} />
              <span>Tạo combo mới</span>
            </button>
          ) : (
            <button
              type="button"
              className="cb-btn-create-combo"
              onClick={() => {
                if (clearVoucherForm) clearVoucherForm();
                else onInternalClearVoucher();
                if (setIsVoucherModalOpen) setIsVoucherModalOpen(true);
                else setInternalVoucherModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Tạo voucher mới</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== 2. SUB-TABS BAR ==================== */}
      <div className="cb-tabs-bar">
        <button
          type="button"
          className={`cb-tab-item ${activeTab === 'combos' ? 'active' : ''}`}
          onClick={() => setActiveTab('combos')}
        >
          <Layers size={16} />
          <span>Combo trọn gói</span>
          <span className="cb-tab-badge">{combos.length}</span>
        </button>

        <button
          type="button"
          className={`cb-tab-item ${activeTab === 'vouchers' ? 'active' : ''}`}
          onClick={() => setActiveTab('vouchers')}
        >
          <Ticket size={16} />
          <span>Voucher & Mã giảm giá</span>
          <span className="cb-tab-badge">{vouchers.length}</span>
        </button>
      </div>

      {/* ==================== 3. TAB 1: COMBO TRỌN GÓI ==================== */}
      {activeTab === 'combos' && (
        <>
          {/* 3.1 4 Metric Cards (Figma 376:2) */}
          <div className="cb-metrics-grid">
            {/* Card 1: Tổng số combo */}
            <div className="cb-metric-card">
              <div className="cb-metric-icon-box total">
                <Layers size={22} />
              </div>
              <div className="cb-metric-info">
                <span className="cb-metric-label">Tổng số combo</span>
                <span className="cb-metric-val">{metrics.total}</span>
              </div>
            </div>

            {/* Card 2: Đang chạy */}
            <div className="cb-metric-card">
              <div className="cb-metric-icon-box active">
                <Play size={20} style={{ fill: '#16A34A', marginLeft: 2 }} />
              </div>
              <div className="cb-metric-info">
                <span className="cb-metric-label">Đang chạy</span>
                <span className="cb-metric-val">{metrics.active}</span>
              </div>
            </div>

            {/* Card 3: Sắp hết hạn */}
            <div className="cb-metric-card">
              <div className="cb-metric-icon-box expiring">
                <Clock size={22} />
              </div>
              <div className="cb-metric-info">
                <span className="cb-metric-label">Sắp hết hạn</span>
                <span className="cb-metric-val">{metrics.expiring}</span>
              </div>
            </div>

            {/* Card 4: Đã tạm dừng */}
            <div className="cb-metric-card">
              <div className="cb-metric-icon-box paused">
                <Pause size={20} style={{ fill: '#9333EA' }} />
              </div>
              <div className="cb-metric-info">
                <span className="cb-metric-label">Đã tạm dừng</span>
                <span className="cb-metric-val">{metrics.paused}</span>
              </div>
            </div>
          </div>

          {/* 3.2 Filter & Search Toolbar */}
          <div className="cb-toolbar">
            <div className="cb-filter-pills">
              <button
                type="button"
                className={`cb-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
              >
                Tất cả ({metrics.total})
              </button>

              <button
                type="button"
                className={`cb-pill-btn ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter('active');
                  setCurrentPage(1);
                }}
              >
                Đang chạy ({metrics.active})
              </button>

              <button
                type="button"
                className={`cb-pill-btn ${statusFilter === 'expiring' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter('expiring');
                  setCurrentPage(1);
                }}
              >
                Sắp hết hạn ({metrics.expiring})
              </button>

              <button
                type="button"
                className={`cb-pill-btn ${statusFilter === 'paused' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter('paused');
                  setCurrentPage(1);
                }}
              >
                Đã tạm dừng ({metrics.paused})
              </button>
            </div>

            <div className="cb-toolbar-right">
              <div className="cb-search-wrap">
                <Search className="cb-search-icon" size={15} />
                <input
                  type="text"
                  className="cb-search-input"
                  placeholder="Tìm kiếm combo..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="cb-sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="discount">Chiết khấu cao nhất</option>
                <option value="price-asc">Giá: Thấp đến cao</option>
                <option value="price-desc">Giá: Cao đến thấp</option>
              </select>
            </div>
          </div>

          {/* 3.3 Main Area: List of horizontal cards */}
          <div className="cb-main-area">
            {/* List Column */}
            <div className="cb-list-container">
              {isLoadingProvider ? (
                <div className="cb-empty-state">
                  <p>Đang tải danh sách combo...</p>
                </div>
              ) : currentCombos.length === 0 ? (
                <div className="cb-empty-state">
                  <div className="cb-empty-icon">
                    <Layers size={24} />
                  </div>
                  <h3 className="cb-empty-title">Chưa có combo nào</h3>
                  <p className="cb-empty-desc">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Không tìm thấy combo nào phù hợp với bộ lọc hiện tại.'
                      : 'Hãy bắt đầu tạo combo kết hợp áo dài và gói chụp ảnh để thu hút thêm nhiều khách hàng!'}
                  </p>
                  <button
                    type="button"
                    className="cb-btn-create-combo"
                    onClick={onOpenNewCombo}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={16} />
                    <span>Tạo combo mới</span>
                  </button>
                </div>
              ) : (
                currentCombos.map((combo: any) => (
                  <ComboCard
                    key={combo._id || combo.id}
                    combo={combo}
                    onEdit={onStartEditCombo}
                    onDelete={handleDeleteCombo}
                  />
                ))
              )}

              {/* 3.4 Pagination Bar (Figma 376:2) */}
              {totalCombos > 0 && (
                <div className="cb-pagination-bar">
                  <span className="cb-pagination-text">
                    Hiển thị {startDisplay}-{endDisplay} của {totalCombos} combo
                  </span>

                  <div className="cb-pagination-pages">
                    <button
                      type="button"
                      className="cb-page-btn"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`cb-page-btn ${pageNum === validCurrentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="cb-page-btn"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <select
                    className="cb-page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>Hiển thị 5 / trang</option>
                    <option value={10}>Hiển thị 10 / trang</option>
                    <option value={20}>Hiển thị 20 / trang</option>
                  </select>
                </div>
              )}
            </div>

            {/* Wide Centered Modal (Tạo / Sửa combo - Phương án 1) */}
            {isModalOpen && (
              <ComboModal
                isOpen={isModalOpen}
                onClose={onCloseModal}
                editingComboId={editingComboId}
                cName={cName}
                setCName={setCName}
                cDesc={cDesc}
                setCDesc={setCDesc}
                cProductId={cProductId}
                setCProductId={setCProductId}
                cPackageId={cPackageId}
                setCPackageId={setCPackageId}
                cDiscount={cDiscount}
                setCDiscount={setCDiscount}
                cPrice={cPrice}
                setCPrice={setCPrice}
                cValidFrom={cValidFrom}
                setCValidFrom={setCValidFrom}
                cValidTo={cValidTo}
                setCValidTo={setCValidTo}
                cMaxUsage={cMaxUsage}
                setCMaxUsage={setCMaxUsage}
                cShootPeopleCount={cShootPeopleCount}
                setCShootPeopleCount={setCShootPeopleCount}
                cAoDaiQuantity={cAoDaiQuantity}
                setCAoDaiQuantity={setCAoDaiQuantity}
                myProductsList={myProductsList}
                photoPackages={photoPackages}
                combos={combos}
                inventorySummary={inventorySummary}
                onSubmit={handleComboSubmit}
                isAoDaiModalOpen={isAoDaiModalOpen}
                setIsAoDaiModalOpen={setIsAoDaiModalOpen}
                aoDaiSearch={aoDaiSearch}
                setAoDaiSearch={setAoDaiSearch}
                isPackageModalOpen={isPackageModalOpen}
                setIsPackageModalOpen={setIsPackageModalOpen}
                packageSearch={packageSearch}
                setPackageSearch={setPackageSearch}
              />
            )}
          </div>
        </>
      )}

      {/* ==================== 4. TAB 2: VOUCHER & MÃ GIẢM GIÁ (Figma 379:699) ==================== */}
      {activeTab === 'vouchers' && (
        <VoucherTabContent
          vouchers={vouchers}
          activeCampaign={activeCampaign}
          openCampaignModal={openCampaignModal}
          handleDeactivateCampaign={handleDeactivateCampaign}
          submittingCampaign={submittingCampaign}
          hasAodaiCapability={hasAodaiCapability}
          handleCreateOrUpdateVoucher={handleCreateOrUpdateVoucher || handleAddVoucher}
          handleEditVoucher={handleEditVoucher || onInternalEditVoucher}
          handleDeleteVoucher={handleDeleteVoucher}
          clearVoucherForm={clearVoucherForm || onInternalClearVoucher}
          editingVoucherId={editingVoucherId ?? internalEditingVoucherId}
          isVoucherModalOpen={isVoucherModalOpen !== undefined ? isVoucherModalOpen : internalVoucherModalOpen}
          setIsVoucherModalOpen={setIsVoucherModalOpen || setInternalVoucherModalOpen}
          vCode={vCode}
          setVCode={setVCode}
          vName={vName}
          setVName={setVName}
          vDesc={vDesc ?? internalVDesc}
          setVDesc={setVDesc || setInternalVDesc}
          vType={vType || 'PERCENTAGE'}
          setVType={setVType}
          vValue={vValue}
          setVValue={setVValue}
          vMaxDiscount={vMaxDiscount ?? internalVMaxDiscount}
          setVMaxDiscount={setVMaxDiscount || setInternalVMaxDiscount}
          vMinOrder={vMinOrder ?? internalVMinOrder}
          setVMinOrder={setVMinOrder || setInternalVMinOrder}
          vUsageLimit={vUsageLimit ?? internalVUsageLimit}
          setVUsageLimit={setVUsageLimit || setInternalVUsageLimit}
          vStartDate={vStartDate ?? internalVStartDate}
          setVStartDate={setVStartDate || setInternalVStartDate}
          vEndDate={vEndDate ?? internalVEndDate}
          setVEndDate={setVEndDate || setInternalVEndDate}
        />
      )}
    </div>
  );
};
