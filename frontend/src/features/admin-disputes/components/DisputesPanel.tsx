import { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { PrivateEvidenceImage } from '../../../components/common/PrivateEvidenceImage';
import { API_BASE_URL } from '../../../config/env';
import { adminDisputesApi } from '../api/adminDisputesApi';
import { useDisputes } from '../hooks/useDisputes';
import type { Dispute, DisputeDecision, ResolvePayload } from '../types';
import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';
import { Search, Camera, Shirt, User, Store, AlertCircle, ExternalLink, ShieldAlert, CheckCircle2, ArrowUpDown, Clock, CheckCircle } from 'lucide-react';
import './disputesPanel.css';

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

const decisionLabels: Record<DisputeDecision, string> = {
  SHOP_RIGHT: 'Đối tác / Thợ ảnh đúng',
  CUSTOMER_RIGHT: 'Khách hàng đúng',
  SPLIT: 'Chia trách nhiệm (Hoàn khách & Bồi thường)',
};

const getDepositTotal = (dispute: Dispute) =>
  dispute.requestedAmount ||
  dispute.bookingId?.pricingSummary?.grandTotal ||
  dispute.bookingId?.pricingSummary?.depositTotal ||
  0;

const evidenceUrl = (reference: string) =>
  reference.startsWith('http://') || reference.startsWith('https://')
    ? reference
    : `${API_BASE_URL}${reference}`;

export function DisputesPanel() {
  const { error, items, loading, refresh, setError } = useDisputes();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<DisputeDecision>('SHOP_RIGHT');
  const [refundAmount, setRefundAmount] = useState(0);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);

  // Search, Filter & Sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'RESOLVED' | 'ALL'>('PENDING');
  const [filterType, setFilterType] = useState<'ALL' | 'PHOTOGRAPHY' | 'RENTAL'>('ALL');
  const [sortBy, setSortBy] = useState<'OLDEST_FIRST' | 'NEWEST_FIRST' | 'AMOUNT_DESC'>('OLDEST_FIRST');

  const getBookingCode = (d: Dispute) => d.bookingId?.bookingCode || 'N/A';

  const getItemName = (d: Dispute) =>
    d.productId?.name || d.bookingItemId?.name || 'Dịch vụ / Sản phẩm';

  const getCustomerName = (d: Dispute) =>
    d.openedBy?.profile?.fullName ||
    d.openedBy?.fullName ||
    d.bookingId?.customerId?.profile?.fullName ||
    (d.bookingId?.customerId as any)?.fullName ||
    'Khách hàng';

  const getProviderName = (d: Dispute) =>
    d.reportedBy?.businessName ||
    d.reportedBy?.profile?.fullName ||
    d.reportedBy?.fullName ||
    'Nhà cung cấp';

  const isPhotoDispute = (d: Dispute) =>
    d.actionType === 'PHOTOGRAPHY_DISPUTE' ||
    d.bookingId?.bookingType === 'PHOTOGRAPHY' ||
    d.bookingId?.bookingType === 'COMBO';

  const isItemResolved = (d: Dispute) =>
    d.status === 'RESOLVED' || d.status === 'CLOSED' || (d as any).resolvedAt;

  const getDateStr = (d: Dispute) => {
    const raw = d.createdAt || (d.bookingId as any)?.createdAt;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(raw);
    }
  };

  // Count active / resolved items
  const pendingCount = useMemo(() => items.filter((i) => !isItemResolved(i)).length, [items]);
  const resolvedCount = useMemo(() => items.filter((i) => isItemResolved(i)).length, [items]);

  // Filter & sort disputes
  const filteredDisputes = useMemo(() => {
    return items
      .filter((item) => {
        const resolved = isItemResolved(item);

        // Status filter
        if (statusFilter === 'PENDING' && resolved) return false;
        if (statusFilter === 'RESOLVED' && !resolved) return false;

        // Type filter
        if (filterType === 'PHOTOGRAPHY' && !isPhotoDispute(item)) return false;
        if (filterType === 'RENTAL' && isPhotoDispute(item)) return false;

        // Search term filter
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase().trim();
          const code = getBookingCode(item).toLowerCase();
          const cust = getCustomerName(item).toLowerCase();
          const prov = getProviderName(item).toLowerCase();
          const name = getItemName(item).toLowerCase();
          const desc = (item.description || '').toLowerCase();

          return (
            code.includes(query) ||
            cust.includes(query) ||
            prov.includes(query) ||
            name.includes(query) ||
            desc.includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const resolvedA = isItemResolved(a);
        const resolvedB = isItemResolved(b);

        // Quy tắc 1: Đơn đã giải quyết/hoàn thành đẩy XUỐNG DƯỚI CÙNG
        if (resolvedA !== resolvedB) {
          return resolvedA ? 1 : -1;
        }

        // Quy tắc 2: Sắp xếp theo lựa chọn sortBy
        if (sortBy === 'OLDEST_FIRST') {
          // Đơn gửi trước hiện trước (Oldest / Earliest creation date first)
          const timeA = new Date(a.createdAt || (a.bookingId as any)?.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || (b.bookingId as any)?.createdAt || 0).getTime();
          return timeA - timeB;
        }

        if (sortBy === 'NEWEST_FIRST') {
          // Đơn mới gửi gần đây hiện trước (Newest creation date first)
          const timeA = new Date(a.createdAt || (a.bookingId as any)?.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || (b.bookingId as any)?.createdAt || 0).getTime();
          return timeB - timeA;
        }

        if (sortBy === 'AMOUNT_DESC') {
          return (b.requestedAmount || 0) - (a.requestedAmount || 0);
        }

        return 0;
      });
  }, [items, searchTerm, filterType, statusFilter, sortBy]);

  const selectDispute = (dispute: Dispute) => {
    setSelected(dispute);
    setError(null);
    setNotes('');
    setDecision('SHOP_RIGHT');
    setRefundAmount(0);
    setCompensationAmount(0);
  };

  const resolve = async () => {
    if (!selected?.bookingId?._id) {
      setError('Không xác định được booking để xử lý.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError('Vui lòng nhập ghi chú quyết định xử lý.');
      return;
    }

    const depositTotal = getDepositTotal(selected);
    const splitTotal = refundAmount + compensationAmount;
    const hasValidSplit =
      Number.isInteger(refundAmount) &&
      Number.isInteger(compensationAmount) &&
      refundAmount >= 0 &&
      compensationAmount >= 0 &&
      splitTotal <= depositTotal;

    if (decision === 'SPLIT' && !hasValidSplit) {
      setError('Khoản hoàn và bồi thường phải là số nguyên không âm; tổng không được vượt tiền cọc.');
      return;
    }

    const payload: ResolvePayload = {
      decision,
      notes: trimmedNotes,
      ...(decision === 'SPLIT' ? { refundAmount, compensationAmount } : {}),
    };

    const result = await Swal.fire({
      title: 'Xác nhận phán quyết?',
      text:
        decision === 'SPLIT'
          ? `${decisionLabels[decision]}. Hoàn khách ${formatCurrency(refundAmount)}, bồi thường đối tác ${formatCurrency(compensationAmount)}.`
          : `${decisionLabels[decision]}. Hệ thống sẽ tính khoản hoàn/bồi thường theo chính sách.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận xử lý',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    setIsResolving(true);
    setError(null);
    try {
      await adminDisputesApi.resolve(selected.bookingId._id, payload);
      setSelected(null);
      await refresh();
      await Swal.fire({
        title: 'Thành công!',
        text: 'Đã giải quyết tranh chấp và cập nhật trạng thái đơn hàng.',
        icon: 'success',
        confirmButtonColor: '#27AE60',
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xử lý tranh chấp.');
    } finally {
      setIsResolving(false);
    }
  };

  const depositTotal = selected ? getDepositTotal(selected) : 0;

  return (
    <section className="admin-disputes">
      {/* Header & Controls Bar */}
      <div className="admin-disputes__header-bar">
        {/* Search box */}
        <div className="admin-disputes__search-box">
          <Search size={16} className="admin-disputes__search-icon" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn (BK...), tên khách, thợ ảnh/shop, sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="admin-disputes__clear-btn" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="admin-disputes__status-tabs">
          <button
            className={`admin-disputes__status-tab ${statusFilter === 'PENDING' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            <Clock size={13} /> Chờ xử lý ({pendingCount})
          </button>
          <button
            className={`admin-disputes__status-tab ${statusFilter === 'RESOLVED' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('RESOLVED')}
          >
            <CheckCircle size={13} /> Đã giải quyết ({resolvedCount})
          </button>
          <button
            className={`admin-disputes__status-tab ${statusFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tất cả ({items.length})
          </button>
        </div>

        {/* Sort Select */}
        <div className="admin-disputes__sort-box">
          <ArrowUpDown size={14} className="admin-disputes__sort-icon" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="OLDEST_FIRST">⏳ Đơn gửi trước hiện trước</option>
            <option value="NEWEST_FIRST">⚡ Đơn mới gửi gần nhất</option>
            <option value="AMOUNT_DESC">💰 Số tiền đền bù cao nhất</option>
          </select>
        </div>

        {/* Category Filters */}
        <div className="admin-disputes__filters">
          <button
            className={`admin-disputes__filter-pill ${filterType === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            Tất cả danh mục
          </button>
          <button
            className={`admin-disputes__filter-pill ${filterType === 'PHOTOGRAPHY' ? 'is-active' : ''}`}
            onClick={() => setFilterType('PHOTOGRAPHY')}
          >
            <Camera size={13} /> Thợ chụp ảnh ({items.filter(isPhotoDispute).length})
          </button>
          <button
            className={`admin-disputes__filter-pill ${filterType === 'RENTAL' ? 'is-active' : ''}`}
            onClick={() => setFilterType('RENTAL')}
          >
            <Shirt size={13} /> Thuê Áo dài ({items.filter((i) => !isPhotoDispute(i)).length})
          </button>
        </div>

        <div className="admin-disputes__toolbar">
          <AdminReloadButton onClick={() => void refresh()} isLoading={loading} />
        </div>
      </div>

      {error && (
        <p className="admin-disputes__error" role="alert">
          <ShieldAlert size={16} /> {error}
        </p>
      )}

      <div className="admin-disputes__grid">
        {/* Left Column: List of Disputes */}
        <div className="admin-disputes__list" aria-busy={loading}>
          <header className="admin-disputes__list-header">
            <h3>
              DANH SÁCH TRANH CHẤP ({filteredDisputes.length})
              {sortBy === 'OLDEST_FIRST' && <small> · (Đơn gửi trước hiện trước)</small>}
            </h3>
          </header>

          <div className="admin-disputes__list-items">
            {filteredDisputes.length === 0 ? (
              <div className="admin-disputes__empty-state">
                <AlertCircle size={32} style={{ color: '#9CA3AF', margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600, color: '#4B5563' }}>Không tìm thấy cuộc tranh chấp nào.</p>
                {searchTerm && <small style={{ color: '#9CA3AF' }}>Thử tìm kiếm với từ khóa khác</small>}
              </div>
            ) : (
              filteredDisputes.map((item) => {
                const isSelected = selected?._id === item._id;
                const photoDispute = isPhotoDispute(item);
                const resolved = isItemResolved(item);
                const code = getBookingCode(item);
                const itemName = getItemName(item);
                const custName = getCustomerName(item);
                const provName = getProviderName(item);
                const dateStr = getDateStr(item);

                return (
                  <button
                    key={item._id}
                    type="button"
                    className={`admin-disputes__item-card ${isSelected ? 'is-active' : ''} ${
                      resolved ? 'is-resolved' : ''
                    }`}
                    onClick={() => selectDispute(item)}
                  >
                    <div className="admin-disputes__item-header">
                      <span className={`admin-disputes__type-badge ${photoDispute ? 'badge-photo' : 'badge-rental'}`}>
                        {photoDispute ? <Camera size={11} /> : <Shirt size={11} />}
                        {photoDispute ? 'THỢ CHỤP ÁNH' : 'THUÊ ÁO DÀI'}
                      </span>

                      {resolved ? (
                        <span className="admin-disputes__status-badge badge-resolved">✓ ĐÃ GIẢI QUYẾT</span>
                      ) : (
                        <span className="admin-disputes__status-badge badge-pending">⏳ CHỜ XỬ LÝ</span>
                      )}

                      <strong className="admin-disputes__booking-code">{code}</strong>
                      {dateStr && <span className="admin-disputes__item-date">{dateStr}</span>}
                    </div>

                    <h4 className="admin-disputes__item-title">{itemName}</h4>

                    <div className="admin-disputes__item-parties">
                      <span>
                        <User size={12} /> Khách: <strong>{custName}</strong>
                      </span>
                      <span>
                        <Store size={12} /> Shop/Thợ: <strong>{provName}</strong>
                      </span>
                    </div>

                    {item.description && (
                      <p className="admin-disputes__item-desc-snippet" title={item.description}>
                        💬 {item.description}
                      </p>
                    )}

                    <div className="admin-disputes__item-footer">
                      <span className="admin-disputes__item-price">
                        Yêu cầu đền bù: <strong>{formatCurrency(item.requestedAmount)}</strong>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Dispute Detail & Decision */}
        {selected ? (
          <aside className="admin-disputes__detail">
            <div className="admin-disputes__detail-header">
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`admin-disputes__type-badge ${isPhotoDispute(selected) ? 'badge-photo' : 'badge-rental'}`}>
                    {isPhotoDispute(selected) ? <Camera size={11} /> : <Shirt size={11} />}
                    {isPhotoDispute(selected) ? 'TRANH CHẤP CHỤP ÁNH' : 'TRANH CHẤP THUÊ ÁO DÀI'}
                  </span>

                  {isItemResolved(selected) ? (
                    <span className="admin-disputes__status-badge badge-resolved">✓ ĐÃ GIẢI QUYẾT</span>
                  ) : (
                    <span className="admin-disputes__status-badge badge-pending">⏳ CHỜ XỬ LÝ</span>
                  )}
                </div>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '18px', color: '#4A0E17' }}>
                  Mã đơn: {getBookingCode(selected)}
                </h3>
              </div>
            </div>

            <div className="admin-disputes__summary">
              <div>
                <dt>
                  <User size={12} /> Khách hàng
                </dt>
                <dd>{getCustomerName(selected)}</dd>
              </div>
              <div>
                <dt>
                  <Store size={12} /> Đối tác / Thợ ảnh
                </dt>
                <dd>{getProviderName(selected)}</dd>
              </div>
              <div>
                <dt>Sản phẩm / Dịch vụ</dt>
                <dd>{getItemName(selected)}</dd>
              </div>
              <div>
                <dt>Tiền cọc giữ đồ/dịch vụ</dt>
                <dd style={{ color: '#2563EB', fontWeight: 750 }}>{formatCurrency(depositTotal)}</dd>
              </div>
            </div>

            <div className="admin-disputes__reason-box">
              <strong>💬 Lý do & Mô tả tranh chấp:</strong>
              <p>{selected.description || 'Không có mô tả bổ sung.'}</p>
            </div>

            {selected.bookingId?.deliveryDriveUrl && (
              <section className="admin-disputes__evidence" aria-label="Link Google Drive">
                <h4>🔗 Kho ảnh gốc Google Drive (Thợ ảnh bàn giao):</h4>
                <a
                  href={selected.bookingId.deliveryDriveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-disputes__drive-link-btn"
                >
                  <ExternalLink size={14} /> Mở kho ảnh Drive trong tab mới
                </a>
              </section>
            )}

            {selected.bookingId?.deliveredPhotos?.length ? (
              <section className="admin-disputes__evidence" aria-label="Ảnh kết quả bàn giao">
                <h4>📸 Ảnh kết quả thợ chụp đã bàn giao ({selected.bookingId.deliveredPhotos.length}):</h4>
                <div>
                  {selected.bookingId.deliveredPhotos.map((reference: string, index: number) => (
                    <PrivateEvidenceImage
                      key={index}
                      reference={reference}
                      legacyUrl={evidenceUrl(reference)}
                      alt={`Ảnh bàn giao ${index + 1}`}
                      linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #BFDBFE' }}
                      imageStyle={{ width: '72px', height: '72px', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {(() => {
              const custEvidences = selected.evidencePhotos?.length
                ? selected.evidencePhotos
                : ((selected.bookingId as any)?.evidencePhotos?.length
                ? (selected.bookingId as any).evidencePhotos
                : ((selected.bookingId as any)?.disputeEvidencePhotos?.length
                ? (selected.bookingId as any).disputeEvidencePhotos
                : []));

              if (!custEvidences || custEvidences.length === 0) return null;

              return (
                <section className="admin-disputes__evidence" aria-label="Bằng chứng sự cố">
                  <h4>⚠️ Bằng chứng sự cố từ khách hàng ({custEvidences.length} ảnh):</h4>
                  <div>
                    {custEvidences.map((reference: string, index: number) => (
                      <PrivateEvidenceImage
                        key={reference + index}
                        reference={reference}
                        legacyUrl={evidenceUrl(reference)}
                        alt={`Bằng chứng ${index + 1}`}
                        linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #FECACA' }}
                        imageStyle={{ width: '72px', height: '72px', objectFit: 'cover' }}
                      />
                    ))}
                  </div>
                </section>
              );
            })()}

            {isItemResolved(selected) ? (
              <div className="admin-disputes__resolved-notice">
                <CheckCircle size={20} style={{ color: '#059669' }} />
                <div>
                  <strong style={{ color: '#065F46', display: 'block' }}>Cuộc tranh chấp này đã được phán xử hoàn tất.</strong>
                  <span style={{ fontSize: '12px', color: '#047857' }}>Dữ liệu lưu trữ phục vụ đối soát & báo cáo.</span>
                </div>
              </div>
            ) : (
              <div className="admin-disputes__decision-form">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <strong style={{ fontSize: '13px', color: '#1E293B' }}>Quyết định phán xử:</strong>
                  <select value={decision} onChange={(event) => setDecision(event.target.value as DisputeDecision)}>
                    {Object.entries(decisionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                {decision === 'SPLIT' && (
                  <div className="admin-disputes__split">
                    <label>
                      Hoàn cho khách (VNĐ)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={refundAmount}
                        onChange={(event) => setRefundAmount(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Bồi thường đối tác (VNĐ)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={compensationAmount}
                        onChange={(event) => setCompensationAmount(Number(event.target.value))}
                      />
                    </label>
                    <small style={{ gridColumn: 'span 2', fontSize: '12px', color: '#475569' }}>
                      Tổng phân bổ: <strong>{formatCurrency(refundAmount + compensationAmount)}</strong> / {formatCurrency(depositTotal)}
                    </small>
                  </div>
                )}

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  <strong style={{ fontSize: '13px', color: '#1E293B' }}>Ghi chú phán quyết (bắt buộc):</strong>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={1000}
                    placeholder="Nhập căn cứ xử lý và quyết định chi tiết..."
                  />
                </label>

                <button
                  type="button"
                  className="admin-disputes__submit-btn"
                  disabled={isResolving}
                  onClick={() => void resolve()}
                >
                  {isResolving ? (
                    'Đang xử lý…'
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Xác nhận xử lý tranh chấp
                    </>
                  )}
                </button>
              </div>
            )}
          </aside>
        ) : (
          <div className="admin-disputes__no-selection">
            <AlertCircle size={40} style={{ color: '#9CA3AF', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: '#4B5563', fontSize: '15px' }}>
              Chọn một đơn tranh chấp ở danh sách bên trái để xem chi tiết & phán xử.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
