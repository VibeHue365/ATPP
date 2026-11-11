import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  XCircle,
  X,
  Clock,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { CONTRACTS_V2_ENABLED } from '../../../config/features';
import { translateError } from '../../../utils/errorTranslator';
import {
  contractService,
  type ProviderAcceptanceStatusResponse,
  type ProviderMechanismResponse,
} from '../../../services/contractService';

export const ProviderContractStatusCard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(CONTRACTS_V2_ENABLED);
  const [status, setStatus] = useState<ProviderAcceptanceStatusResponse | null>(null);
  const [mechanism, setMechanism] = useState<ProviderMechanismResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState<boolean>(false);
  const [agreementChecked, setAgreementChecked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!CONTRACTS_V2_ENABLED) return;
    try {
      setLoadError(null);
      const [statusData, mechData] = await Promise.all([
        contractService.getProviderAcceptanceStatus().catch(() => null),
        contractService.getProviderMechanism().catch(() => null),
      ]);
      setStatus(statusData);
      setMechanism(mechData);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể tải trạng thái quy chế hợp đồng.';
      setLoadError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!CONTRACTS_V2_ENABLED) {
    return null;
  }

  // Derive composite status: ACTIVE, STALE, REVOKED, or NOT_ACCEPTED
  const isDraftMechanism = mechanism?.status === 'DRAFT';
  const isAutoAcceptance = status?.scope === 'AUTO_ACCEPTANCE';

  let currentStatusTag: 'ACTIVE' | 'STALE' | 'REVOKED' | 'NOT_ACCEPTED' = 'NOT_ACCEPTED';
  if (status?.status) {
    currentStatusTag = status.status;
  } else if (status?.active) {
    currentStatusTag = status.isStale ? 'STALE' : 'ACTIVE';
  } else if (status?.revoked) {
    currentStatusTag = 'REVOKED';
  }

  // Handle Accept Mechanism
  const handleAcceptMechanism = async () => {
    if (!mechanism?.hash || isDraftMechanism || !agreementChecked || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await contractService.acceptProviderMechanism(mechanism.hash);
      setActionSuccess('Chấp thuận Quy chế sàn giao dịch VibeHue thành công!');
      setIsModalOpen(false);
      setAgreementChecked(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Chấp thuận quy chế thất bại. Vui lòng thử lại.';
      setActionError(translateError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Revoke Acceptance
  const handleRevokeAcceptance = async () => {
    if (submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await contractService.revokeProviderAcceptance();
      setActionSuccess('Đã rút lại chấp thuận quy chế.');
      setIsRevokeModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Rút lại chấp thuận thất bại. Vui lòng thử lại.';
      setActionError(translateError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const openAcceptModal = () => {
    setAgreementChecked(false);
    setActionError(null);
    setActionSuccess(null);
    setIsModalOpen(true);
  };

  return (
    <div
      className="provider-service-panel mt-6 border border-stone-200 rounded-xl p-6 bg-stone-50"
      data-testid="provider-contract-status-card"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Cơ chế Hợp đồng Điện tử & Cam kết Nền tảng
            </h3>
            <p className="text-xs text-stone-500">
              Ràng buộc pháp lý theo Quy chế hoạt động sàn giao dịch thương mại điện tử VibeHue.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {isDraftMechanism && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300"
              data-testid="mechanism-draft-badge"
            >
              <AlertTriangle size={13} />
              Quy chế DRAFT (Chưa duyệt)
            </span>
          )}

          {currentStatusTag === 'ACTIVE' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"
              data-testid="status-active-badge"
            >
              <ShieldCheck size={14} />
              ĐÃ CHẤP THUẬN (ACTIVE)
            </span>
          )}

          {currentStatusTag === 'STALE' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-900 border border-orange-300"
              data-testid="status-stale-badge"
            >
              <AlertTriangle size={14} />
              CHÍNH SÁCH ĐÃ ĐỔI (STALE)
            </span>
          )}

          {currentStatusTag === 'REVOKED' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"
              data-testid="status-revoked-badge"
            >
              <XCircle size={14} />
              ĐÃ RÚT LẠI (REVOKED)
            </span>
          )}

          {currentStatusTag === 'NOT_ACCEPTED' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-700 border border-stone-300"
              data-testid="status-not-accepted-badge"
            >
              <Clock size={14} />
              CHƯA KÍCH HOẠT
            </span>
          )}
        </div>
      </div>

      {/* Global Success / Error Messages */}
      {actionSuccess && (
        <div className="mb-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-stone-400 text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-amber-600" />
          Đang xác thực thông tin cam kết quy chế hợp đồng…
        </div>
      ) : loadError ? (
        <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
          {loadError}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Phạm vi chấp thuận</span>
              <strong className="text-stone-800 font-mono">
                {status?.scope || 'AO_DAI_RENTAL'}
              </strong>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Mã quy chế áp dụng</span>
              <strong className="text-stone-800 font-mono">
                {mechanism?.regulationCode || 'QC-VIBEHUE-2026-V1'}
              </strong>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Phiên bản cơ chế</span>
              <strong className="text-stone-800 font-mono">
                {status?.active?.mechanismVersion || mechanism?.version || 'v1.0'}
              </strong>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Phiên bản mẫu</span>
              <strong className="text-stone-800 font-mono">
                {status?.active?.templateVersion || 'ao-dai-rental-v2'}
              </strong>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Trạng thái phê duyệt</span>
              <strong
                className={`font-mono font-semibold ${
                  isDraftMechanism ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {mechanism?.status || 'DRAFT'}
              </strong>
            </div>
          </div>

          {/* Conditional Guidance Cards */}
          {isDraftMechanism && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed" data-testid="draft-mechanism-notice">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-700" />
              <div>
                <p className="font-semibold mb-0.5">Quy chế đang ở trạng thái DRAFT (Chưa phê duyệt pháp lý):</p>
                <p>
                  Quy chế sàn hiện đang trong quá trình thẩm định pháp lý và chưa có phê duyệt chính thức từ Ban Quản trị Sàn VibeHue.
                  Theo nguyên tắc an toàn Fail-Closed, Nhà cung cấp chỉ có thể xem trước nội dung và <strong>chưa thể kích hoạt chấp thuận</strong> cho tới khi quy chế được phê duyệt chính thức.
                </p>
              </div>
            </div>
          )}

          {currentStatusTag === 'ACTIVE' && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed" data-testid="active-acceptance-notice">
              <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-700" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Đã ghi nhận cơ chế giao kết hợp đồng điện tử tự động:</p>
                <p>
                  Shop đã ký chấp thuận trước cơ chế giao kết hợp đồng điện tử tự động khi khách hàng đặt thuê áo dài.
                  Hợp đồng điện tử của khách hàng sẽ được tạo và xác thực tự động theo chính sách hiện hành của shop.
                </p>
                {status?.active?.acceptedAt && (
                  <p className="mt-1 text-stone-500 text-[11px]">
                    Thời điểm ghi nhận:{' '}
                    <strong>{new Date(status.active.acceptedAt).toLocaleString('vi-VN')}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStatusTag === 'STALE' && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-950 leading-relaxed" data-testid="stale-acceptance-notice">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-orange-700" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Chính sách của Shop đã bị thay đổi:</p>
                <p>
                  Các điều khoản hoặc bảng giá của Shop đã được cập nhật sau lần ký chấp thuận quy chế trước đó.
                  Để đảm bảo tính nhất quán pháp lý cho khách hàng, hệ thống yêu cầu Shop xem lại và <strong>ký chấp thuận cập nhật</strong> trước khi mở lại việc thanh toán đơn thuê mới.
                </p>
              </div>
            </div>
          )}

          {currentStatusTag === 'REVOKED' && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed" data-testid="revoked-acceptance-notice">
              <XCircle size={16} className="shrink-0 mt-0.5 text-rose-700" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Chấp thuận quy chế đã bị rút lại:</p>
                <p>
                  Hiện tại shop đang ở trạng thái ngừng áp dụng cơ chế hợp đồng tự động. Toàn bộ các đơn hàng thuê áo dài mới tại shop sẽ bị chặn thanh toán cho tới khi shop thực hiện chấp thuận lại.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          {!isAutoAcceptance && (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openAcceptModal}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                  currentStatusTag === 'ACTIVE'
                    ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                    : isDraftMechanism
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }`}
                data-testid="open-mechanism-modal-btn"
              >
                <FileText size={15} />
                {currentStatusTag === 'ACTIVE'
                  ? 'Xem lại toàn văn quy chế'
                  : currentStatusTag === 'STALE'
                  ? 'Xem & Ký chấp thuận cập nhật'
                  : 'Xem toàn văn quy chế & Chấp thuận'}
              </button>

              {currentStatusTag === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsRevokeModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
                  data-testid="open-revoke-modal-btn"
                >
                  <RotateCcw size={14} />
                  Rút lại chấp thuận
                </button>
              )}

              <span className="text-[11px] text-stone-500 italic">
                * Hành vi chấp thuận là giao kết điện tử trên nền tảng, không phải chữ ký số CA.
              </span>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: VIEW FULL MECHANISM & ACCEPT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          data-testid="mechanism-view-modal"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 flex items-start justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-stone-900">
                    QUY CHẾ HOẠT ĐỘNG SÀN GIAO DỊCH THƯƠNG MẠI ĐIỆN TỬ VIBEHUE
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Mã quy chế: <strong className="font-mono text-stone-700">{mechanism?.regulationCode || 'QC-VIBEHUE-2026-V1'}</strong> | Phiên bản:{' '}
                    <strong className="font-mono text-stone-700">{mechanism?.version || 'auto-acceptance-v1'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/60"
                aria-label="Đóng"
                data-testid="close-mechanism-modal-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Metadata Status Bar */}
            <div className="px-5 py-2.5 bg-stone-100/80 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-500">Trạng thái pháp lý:</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                    isDraftMechanism
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                  data-testid="modal-mechanism-status"
                >
                  {mechanism?.status || 'DRAFT'}
                </span>
              </div>
              {mechanism?.hash && (
                <div className="text-stone-500 text-[11px] font-mono">
                  SHA-256 Hash:{' '}
                  <span className="text-stone-800" title={mechanism.hash}>
                    {mechanism.hash.substring(0, 12)}…{mechanism.hash.substring(56)}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-stone-700 text-xs leading-relaxed max-h-[50vh]">
              {isDraftMechanism && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Lưu ý Fail-Closed (Chưa thể chấp thuận):</strong>
                    Quy chế này đang ở trạng thái <strong>DRAFT</strong> và chưa được Ban Điều hành/Pháp chế ký duyệt chính thức.
                    Nút chấp thuận bị vô hiệu hóa cho đến khi quy chế đạt trạng thái APPROVED.
                  </div>
                </div>
              )}

              <section className="space-y-2">
                <h5 className="font-bold text-stone-900 text-sm">
                  ĐIỀU 1: MỤC ĐÍCH VÀ PHẠM VI ÁP DỤNG
                </h5>
                <p>
                  1.1. Quy chế này quy định quyền, trách nhiệm và nghĩa vụ pháp lý của Nhà cung cấp (sau đây gọi là "Shop") và Khách hàng khi tham gia giao kết Hợp đồng điện tử thuê trang phục áo dài trên sàn thương mại điện tử VibeHue.
                </p>
                <p>
                  1.2. Mọi giao dịch thuê trang phục áo dài và dịch vụ đi kèm trên VibeHue bắt buộc phải tuân thủ quy chuẩn Hợp đồng điện tử Contracts V2 nhằm bảo vệ quyền lợi hợp pháp của cả hai bên theo pháp luật Việt Nam.
                </p>
              </section>

              <section className="space-y-2">
                <h5 className="font-bold text-stone-900 text-sm">
                  ĐIỀU 2: CƠ CHẾ GIAO KẾT TỰ ĐỘNG (AUTO-ACCEPTANCE MECHANISM)
                </h5>
                <p>
                  2.1. Bằng việc thực hiện hành vi chấp thuận Quy chế này, Shop đồng ý và ủy quyền trước cho hệ thống VibeHue tự động đối chiếu các thông tin đặt thuê thực tế (danh mục sản phẩm, kích thước, đơn giá thuê, số tiền đặt cọc, thời gian thuê) để lập và phát hành văn bản Hợp đồng điện tử theo mẫu chuẩn đã được duyệt.
                </p>
                <p>
                  2.2. Khi khách hàng bấm "Chấp thuận hợp đồng" trên ứng dụng/website và hoàn tất xác nhận thanh toán, Hợp đồng điện tử giữa Shop và Khách hàng chính thức có hiệu lực ràng buộc pháp lý mà không yêu cầu Shop phải ký duyệt thủ công trên từng đơn hàng lẻ.
                </p>
              </section>

              <section className="space-y-2">
                <h5 className="font-bold text-stone-900 text-sm">
                  ĐIỀU 3: NGHĨA VỤ CỦA NHÀ CUNG CẤP
                </h5>
                <p>
                  3.1. Cung cấp trang phục áo dài đúng kích thước, kiểu dáng, chất lượng và thời gian như đã cam kết trong hợp đồng.
                </p>
                <p>
                  3.2. Chấp hành các chính sách hủy đơn, hoàn cọc và biểu phí bồi thường hư hại theo đúng chính sách đã niêm yết công khai trên hệ thống.
                </p>
                <p>
                  3.3. Khi Shop thay đổi biểu phí hoặc chính sách thuê, Shop có nghĩa vụ thực hiện chấp thuận lại Quy chế cập nhật để tái kích hoạt hiệu lực giao kết.
                </p>
              </section>

              <section className="space-y-2">
                <h5 className="font-bold text-stone-900 text-sm">
                  ĐIỀU 4: BẢO TOÀN DỮ LIỆU & CHỨNG CỨ PHÁP LÝ
                </h5>
                <p>
                  4.1. Mọi bản Hợp đồng điện tử được lưu trữ bất biến dưới dạng mã băm SHA-256 (Content Hash và Booking Fingerprint).
                </p>
                <p>
                  4.2. Việc xác thực chấp thuận của Shop được ghi nhận kèm mã tài khoản, thời điểm chấp thuận, phiên bản quy chế và phiên bản mẫu hợp đồng tại cơ sở dữ liệu VibeHue, phục vụ đối soát và xuất chứng cứ khi có tranh chấp.
                </p>
              </section>

              <section className="space-y-2">
                <h5 className="font-bold text-stone-900 text-sm">
                  ĐIỀU 5: ĐIỀU KHOẢN THI HÀNH & TỰ NGUYỆN CAM KẾT
                </h5>
                <p className="italic text-stone-600 bg-stone-100 p-3 rounded-lg border border-stone-200">
                  "Shop xác nhận rằng việc bấm chấp thuận quy chế này là hành vi giao kết điện tử tự nguyện của người có thẩm quyền đại diện cho Shop theo quy định của Luật Giao dịch điện tử 2023 và Nghị định 52/2013/NĐ-CP (được sửa đổi bởi Nghị định 85/2021/NĐ-CP), không phải là chữ ký số công cộng CA."
                </p>
              </section>
            </div>

            {/* Modal Footer / Consent Actions */}
            <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3">
              {actionError && (
                <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-2">
                  <XCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Checkbox (Unchecked by default) */}
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="provider-accept-agreement-checkbox"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  disabled={isDraftMechanism || submitting}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                  data-testid="provider-accept-checkbox"
                />
                <label
                  htmlFor="provider-accept-agreement-checkbox"
                  className={`text-xs cursor-pointer select-none leading-relaxed ${
                    isDraftMechanism ? 'text-stone-400' : 'text-stone-800'
                  }`}
                >
                  Tôi là người đại diện hợp pháp của Nhà cung cấp, cam kết đã đọc, hiểu rõ toàn bộ nội dung Quy chế và tự nguyện chấp thuận cơ chế giao kết hợp đồng điện tử tự động trên sàn VibeHue.
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200/80 transition-colors"
                  data-testid="modal-cancel-btn"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={handleAcceptMechanism}
                  disabled={isDraftMechanism || !agreementChecked || submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
                  data-testid="modal-submit-accept-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang xử lý chấp thuận…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      Chấp thuận quy chế & Kích hoạt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM REVOKE ACCEPTANCE MODAL */}
      {isRevokeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          data-testid="revoke-confirm-modal"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h4 className="text-base font-bold text-stone-900">
                Xác nhận rút lại chấp thuận quy chế?
              </h4>
            </div>

            <div className="text-xs text-stone-600 space-y-2 mb-5 leading-relaxed bg-rose-50/60 border border-rose-200 p-3.5 rounded-xl">
              <p className="font-semibold text-rose-900">CẢNH BÁO TÁC ĐỘNG NGHIỆP VỤ:</p>
              <p>
                Khi bạn rút lại chấp thuận quy chế:
              </p>
              <ul className="list-disc list-inside space-y-1 text-stone-700">
                <li>Toàn bộ đơn đặt thuê áo dài mới của khách hàng tại shop sẽ bị hệ thống <strong>chặn thanh toán (Fail-Closed)</strong>.</li>
                <li>Khách hàng sẽ không thể phát hành hợp đồng điện tử mới cho tới khi bạn chấp thuận lại quy chế.</li>
              </ul>
            </div>

            {actionError && (
              <div className="mb-4 text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
                data-testid="cancel-revoke-btn"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleRevokeAcceptance}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 flex items-center gap-1.5 transition-colors"
                data-testid="confirm-revoke-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang xử lý…
                  </>
                ) : (
                  'Xác nhận rút lại'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
