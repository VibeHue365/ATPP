import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react';
import {
  type AdminPendingPolicyItem,
  type AdminPolicyDetailResponse,
  contractService,
  resolveDamageCompensationRules,
} from '../../../services/contractService';
import { translateError } from '../../../utils/errorTranslator';
import { validateDisputeResolutionClause } from '../../provider-dashboard/service-profile/disputeTermsGuardrail';

function renderDamageReviewSummary(damageCompensation: any) {
  if (!damageCompensation) return <span className="text-stone-400 italic">Chưa thiết lập</span>;
  const resolved = resolveDamageCompensationRules(damageCompensation);

  const formatTierSummary = (tier: typeof resolved.minorDamage) => {
    if (tier.method === 'FIXED_FEE') {
      return `${Number(tier.fixedFeeAmount || 0).toLocaleString()}đ (Cố định)`;
    }
    if (tier.method === 'PERCENTAGE_ON_ASSET') {
      return `${tier.percentageOfAsset}% giá trị`;
    }
    if (tier.method === 'ACTUAL_REPAIR_COST') {
      return 'Chi phí thực tế (Hóa đơn)';
    }
    return 'Thương lượng sự cố';
  };

  return (
    <div className="space-y-1">
      <div className="text-stone-700 space-y-0.5">
        <div>• Nhẹ: <strong>{formatTierSummary(resolved.minorDamage)}</strong></div>
        <div>• Vừa: <strong>{formatTierSummary(resolved.moderateDamage)}</strong></div>
        <div>• Nặng: <strong>{formatTierSummary(resolved.severeDamage)}</strong></div>
        <div>• Mất: <strong>{formatTierSummary(resolved.totalLoss)}</strong></div>
      </div>
      {resolved.incidentNotificationHours && (
        <p className="text-[10px] text-amber-800">
          Thời hạn báo sự cố: {resolved.incidentNotificationHours}h
        </p>
      )}
      {resolved.disputeResolutionTerms ? (
        <div className="mt-1">
          <p className="text-[10px] text-stone-600">
            <strong>Tranh chấp:</strong> {resolved.disputeResolutionTerms}
          </p>
          {(() => {
            const check = validateDisputeResolutionClause(resolved.disputeResolutionTerms);
            if (!check.isValid) {
              return (
                <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-800 font-semibold rounded">
                  ⚠️ Vi phạm quy chế hòa giải: Chứa quyền trọng tài/giữ cọc
                </span>
              );
            }
            return null;
          })()}
        </div>
      ) : (
        <p className="text-[10px] text-stone-400 italic">
          Tranh chấp: Theo Quy chế hòa giải chuẩn của Sàn
        </p>
      )}
    </div>
  );
}

export const AdminContractPolicyReviewPanel: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<AdminPendingPolicyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected for review detail modal / comparison
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailData, setDetailData] = useState<AdminPolicyDetailResponse | null>(null);

  // Review action modal state
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractService.getAdminPendingPolicies();
      setPolicies(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách chính sách chờ duyệt';
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const openDetail = async (policyId: string) => {
    setSelectedPolicyId(policyId);
    setDetailLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const detail = await contractService.getAdminPolicyDetail(policyId);
      setDetailData(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải thông tin chi tiết chính sách';
      setActionError(translateError(msg));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedPolicyId(null);
    setDetailData(null);
    setReviewAction(null);
    setReviewNote('');
    setActionError(null);
  };

  const handleDirectApprove = async () => {
    if (!selectedPolicyId) return;

    setActionSubmitting(true);
    setActionError(null);
    try {
      await contractService.reviewAdminPolicy(selectedPolicyId, {
        action: 'APPROVE',
      });

      setActionSuccess(
        'Đã phê duyệt chính sách thuê thành công! Phiên bản mới đã có hiệu lực và hệ thống đã gửi thông báo đến Shop đối tác.',
      );
      setReviewAction(null);
      setReviewNote('');
      await fetchPending();
      setTimeout(() => {
        closeDetail();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thao tác phê duyệt thất bại';
      setActionError(translateError(msg));
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRejectPolicy = async () => {
    if (!selectedPolicyId) return;

    if (!reviewNote.trim()) {
      setActionError('Bắt buộc cung cấp lý do từ chối để Shop đối tác nắm thông tin điều chỉnh.');
      return;
    }

    setActionSubmitting(true);
    setActionError(null);
    try {
      await contractService.reviewAdminPolicy(selectedPolicyId, {
        action: 'REJECT',
        reviewNote: reviewNote.trim(),
      });

      setActionSuccess(
        'Đã từ chối chính sách thuê thành công! Hệ thống đã gửi lý do phản hồi đến Shop đối tác.',
      );
      setReviewAction(null);
      setReviewNote('');
      await fetchPending();
      setTimeout(() => {
        closeDetail();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thao tác từ chối thất bại';
      setActionError(translateError(msg));
    } finally {
      setActionSubmitting(false);
    }
  };

  const filtered = policies.filter((p) => {
    const q = searchTerm.toLowerCase();
    const shop = p.providerInfo?.shopName?.toLowerCase() || '';
    const email = p.providerInfo?.email?.toLowerCase() || '';
    const v = `v${p.versionNumber}`.toLowerCase();
    return shop.includes(q) || email.includes(q) || v.includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-contract-policy-panel">
      {/* Top Header Card */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="text-amber-700" size={24} />
              <h2 className="text-lg font-bold text-stone-900">
                Phê Duyệt Chính Sách Hợp Đồng Thuê Áo Dài (Contracts V2)
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Thẩm định và phê duyệt 4 nhóm chính sách (Bảo quản, Trả trễ, Bồi thường, Hủy & Hoàn cọc)
              do các Shop đăng ký trước khi áp dụng vào hợp đồng điện tử của khách hàng.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchPending()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
              disabled={loading}
              data-testid="refresh-pending-btn"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
              data-testid="pending-count-badge"
            >
              {policies.length} Đang chờ duyệt
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search size={15} className="absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm theo tên Shop, email, hoặc phiên bản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-stone-50/50"
            data-testid="policy-search-input"
          />
        </div>
      </div>

      {/* Global Alert Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* List or Table */}
      {loading ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-500 text-xs flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-amber-700" />
          Đang tải danh sách chính sách chờ phê duyệt...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800 text-xs">
          <AlertTriangle size={18} className="mx-auto mb-2 text-rose-600" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400 text-xs">
          <FileCheck2 size={32} className="mx-auto mb-2 text-stone-300" />
          <p className="font-medium text-stone-600">Hiện tại không có chính sách nào đang chờ phê duyệt.</p>
          <p className="mt-1 text-stone-400">Các yêu cầu cập nhật điều khoản từ Shop sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="pending-policies-table">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Nhà cung cấp / Shop</th>
                  <th className="py-3 px-4">Phiên bản</th>
                  <th className="py-3 px-4">Thời gian gửi</th>
                  <th className="py-3 px-4">Phí trễ hạn</th>
                  <th className="py-3 px-4">Bồi thường hư hỏng</th>
                  <th className="py-3 px-4">Hủy & Hoàn cọc</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((item) => (
                  <tr key={item._id || item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <Store size={15} className="text-stone-400 shrink-0" />
                        <div>
                          <p className="font-semibold">{item.providerInfo?.shopName || 'Shop đối tác'}</p>
                          <p className="text-[11px] text-stone-400 font-normal">
                            {item.providerInfo?.email || item.supportContact?.hotline}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono px-2 py-0.5 rounded-sm bg-stone-100 text-stone-800 font-semibold text-[11px] border border-stone-200">
                        v{item.versionNumber}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-stone-500 text-[11px]">
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleString('vi-VN')
                        : 'Vừa gửi'}
                    </td>

                    <td className="py-3 px-4 text-stone-700">
                      <div>
                        {Number(item.lateReturn?.hourlyLateFee || 0).toLocaleString()}đ/h •{' '}
                        {Number(item.lateReturn?.dailyLateFee || 0).toLocaleString()}đ/ngày
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Ân hạn: {item.lateReturn?.gracePeriodHours ?? 0}h
                      </div>
                    </td>

                    <td className="py-3 px-4 text-stone-700">
                      <div>Lỗi nhỏ: {Number(item.damageCompensation?.minorDamageFee || 0).toLocaleString()}đ</div>
                      <div className="text-[11px] text-stone-400">
                        Vừa: {item.damageCompensation?.moderateDamagePercent}% • Mất:{' '}
                        {item.damageCompensation?.severeDamageOrLossPercent}%
                      </div>
                    </td>

                    <td className="py-3 px-4 text-stone-700">
                      <div>{item.cancellationPolicy?.refundRules?.length || 0} mốc hoàn tiền</div>
                      <div className="text-[11px] text-emerald-700 font-medium">Bảo vệ 100% cọc</div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(item._id || item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors text-xs shadow-xs"
                        data-testid={`review-policy-btn-${item.versionNumber}`}
                      >
                        <Eye size={13} />
                        Thẩm định & Duyệt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL & SIDE-BY-SIDE COMPARISON MODAL */}
      {selectedPolicyId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          data-testid="admin-policy-review-modal"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                  <FileText className="text-amber-700" size={18} />
                  Thẩm định chính sách: {detailData?.providerInfo?.shopName || 'Shop đối tác'} (v
                  {detailData?.current?.versionNumber})
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Đối chiếu nội dung đang chờ duyệt với phiên bản đang có hiệu lực (Active Approved)
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetail}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
                data-testid="close-modal-btn"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-6 text-xs text-stone-800">
              {detailLoading ? (
                <div className="py-16 text-center text-stone-400 flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-amber-700" />
                  Đang tải đối chiếu phiên bản...
                </div>
              ) : actionError ? (
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              ) : detailData ? (
                <>
                  {/* Shop & Contact Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                    <div>
                      <span className="text-stone-400 block text-[11px]">Shop đối tác</span>
                      <strong className="text-stone-900 font-semibold">
                        {detailData.providerInfo.shopName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[11px]">Hotline liên hệ</span>
                      <strong className="text-stone-900 font-semibold">
                        {detailData.current.supportContact?.hotline} ({detailData.current.supportContact?.supportWorkingHours})
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[11px]">Thời gian gửi duyệt</span>
                      <strong className="text-stone-900 font-mono">
                        {detailData.current.submittedAt
                          ? new Date(detailData.current.submittedAt).toLocaleString('vi-VN')
                          : 'Vừa gửi'}
                      </strong>
                    </div>
                  </div>

                  {/* SIDE-BY-SIDE COMPARISON OF 4 GROUPS */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-stone-200">
                      <Info size={14} className="text-amber-700" />
                      Chi tiết 4 nhóm chính sách (So sánh với bản Active)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Active Version (If any) */}
                      <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/70 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                          <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                            <History size={13} />
                            Bản Đang Áp Dụng (Active Approved)
                          </span>
                          {detailData.activeApproved ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              v{detailData.activeApproved.versionNumber}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-[11px] italic">Chưa có bản duyệt</span>
                          )}
                        </div>

                        {detailData.activeApproved ? (
                          <div className="space-y-2.5 text-[11px]">
                            <div>
                              <strong className="text-stone-800 block">1. Bảo quản:</strong>
                              <p className="text-stone-600">
                                Ủi: {detailData.activeApproved.garmentCare.allowIroning ? 'Cho phép' : 'Cấm'} • Giặt:{' '}
                                {detailData.activeApproved.garmentCare.allowWashing ? 'Cho phép' : 'Cấm'}
                              </p>
                            </div>
                            <div>
                              <strong className="text-stone-800 block">2. Trả trễ:</strong>
                              <p className="text-stone-600">
                                {Number(detailData.activeApproved.lateReturn.hourlyLateFee).toLocaleString()}đ/h •{' '}
                                {Number(detailData.activeApproved.lateReturn.dailyLateFee).toLocaleString()}đ/ngày (Ân hạn:{' '}
                                {detailData.activeApproved.lateReturn.gracePeriodHours}h)
                              </p>
                            </div>
                            <div>
                              <strong className="text-stone-800 block mb-1">3. Hư hỏng/Mất (4 cấp độ):</strong>
                              {renderDamageReviewSummary(detailData.activeApproved.damageCompensation)}
                            </div>
                            <div>
                              <strong className="text-stone-800 block">4. Hủy thuê:</strong>
                              <p className="text-stone-600">
                                {detailData.activeApproved.cancellationPolicy.refundRules.length} mốc hoàn tiền • Hoàn 100% cọc
                              </p>
                            </div>
                            <div className="pt-2 border-t border-stone-200">
                              <strong className="text-stone-800 block mb-1">5. Tranh chấp:</strong>
                              {(() => {
                                const resolvedActive = resolveDamageCompensationRules(detailData.activeApproved.damageCompensation);
                                const clause = resolvedActive.disputeResolutionTerms;
                                return (
                                  <p className="text-stone-600 italic">
                                    {clause ? `"${clause}"` : 'Quy chế hòa giải chuẩn của Sàn'}
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <p className="text-stone-400 text-center py-8 italic text-xs">
                            Shop này chưa từng có bản chính sách nào được phê duyệt trước đây.
                          </p>
                        )}
                      </div>

                      {/* Right: Pending Version Under Review */}
                      <div className="border border-amber-300 rounded-xl p-4 bg-amber-50/30 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                          <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                            <Clock size={13} className="text-amber-700" />
                            Bản Chờ Duyệt (Pending Review)
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900">
                            v{detailData.current.versionNumber}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-[11px]">
                          <div>
                            <strong className="text-stone-800 block">1. Bảo quản:</strong>
                            <p className="text-stone-700">
                              Ủi: {detailData.current.garmentCare?.allowIroning ? 'Cho phép' : 'Cấm'} • Giặt:{' '}
                              {detailData.current.garmentCare?.allowWashing ? 'Cho phép' : 'Cấm'}
                            </p>
                            {detailData.current.garmentCare?.prohibitedActions?.length ? (
                              <p className="text-rose-700 text-[10px] mt-0.5">
                                Cấm: {detailData.current.garmentCare.prohibitedActions.join(', ')}
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <strong className="text-stone-800 block">2. Trả trễ:</strong>
                            <p className="text-stone-700">
                              Phí giờ: <strong>{Number(detailData.current.lateReturn?.hourlyLateFee || 0).toLocaleString()}đ/h</strong> •{' '}
                              Phí ngày: <strong>{Number(detailData.current.lateReturn?.dailyLateFee || 0).toLocaleString()}đ/ngày</strong>
                            </p>
                            <p className="text-stone-500 text-[10px]">
                              Ân hạn: {detailData.current.lateReturn?.gracePeriodHours}h • Tối đa trễ: {detailData.current.lateReturn?.maxLateDaysAllowed} ngày
                            </p>
                          </div>

                          <div>
                            <strong className="text-stone-800 block mb-1">3. Hư hỏng/Mất (4 cấp độ):</strong>
                            {renderDamageReviewSummary(detailData.current.damageCompensation)}
                          </div>

                          <div>
                            <strong className="text-stone-800 block">4. Hủy thuê & Hoàn tiền:</strong>
                            <div className="mt-1 space-y-1">
                              {detailData.current.cancellationPolicy?.refundRules?.map((rule, idx) => (
                                <div key={idx} className="flex justify-between text-stone-600 bg-white/70 px-2 py-0.5 rounded-sm border border-stone-200">
                                  <span>Hủy trước ≥ {rule.daysBeforeRental} ngày:</span>
                                  <strong className="text-stone-800">{rule.refundPercentage}% tiền thuê</strong>
                                </div>
                              ))}
                            </div>
                            <p className="text-emerald-700 text-[10px] mt-1 font-medium">
                              ✓ Tiền cọc luôn hoàn 100% khi chưa nhận đồ
                            </p>
                          </div>

                          <div className="pt-2 border-t border-amber-200">
                            <strong className="text-stone-800 block mb-1">
                              5. Cơ chế giải quyết tranh chấp (Nguyên văn từ Shop):
                            </strong>
                            {(() => {
                              const resolvedCurrent = resolveDamageCompensationRules(detailData.current.damageCompensation);
                              const clause = resolvedCurrent.disputeResolutionTerms;
                              if (!clause) {
                                return (
                                  <div className="p-2 bg-stone-100 rounded text-stone-600 text-[11px] italic">
                                    Shop không nhập điều khoản riêng. Sẽ áp dụng Quy chế hòa giải trung gian chuẩn của Sàn VibeHue (không phán quyết bắt buộc, không tự động giữ cọc).
                                  </div>
                                );
                              }
                              const check = validateDisputeResolutionClause(clause);
                              return (
                                <div className="space-y-1.5">
                                  <div className="p-2 bg-white rounded border border-stone-200 text-stone-800 text-[11px] whitespace-pre-wrap font-mono">
                                    {clause}
                                  </div>
                                  {!check.isValid ? (
                                    <div className="p-2 rounded bg-rose-50 border border-rose-300 text-rose-800 text-[11px] flex items-start gap-1.5">
                                      <AlertTriangle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                                      <div>
                                        <strong>CẢNH BÁO VI PHẠM THẨM QUYỀN SÀN:</strong>
                                        <p className="mt-0.5">{check.errorMessage}</p>
                                        <p className="mt-1 font-semibold text-rose-900">
                                          → Đề nghị Admin BẤM 'TỪ CHỐI CHÍNH SÁCH' và yêu cầu Shop chỉnh sửa điều khoản phù hợp trước khi phê duyệt.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] flex items-center gap-1.5">
                                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                                      <span>Điều khoản tuân thủ giới hạn hòa giải trung gian thiện chí của Nền tảng.</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {detailData.current.customTermsText && (
                            <div className="pt-1 border-t border-amber-200">
                              <strong className="text-stone-800 block">Điều khoản bổ sung:</strong>
                              <p className="text-stone-600 italic mt-0.5 bg-white p-2 rounded-sm border border-stone-200">
                                {detailData.current.customTermsText}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Version History */}
                  {detailData.history?.length > 1 && (
                    <div className="space-y-2 pt-2">
                      <span className="font-semibold text-stone-700 block">Lịch sử các phiên bản trước đó:</span>
                      <div className="flex flex-wrap gap-2">
                        {detailData.history.map((h) => (
                          <span
                            key={h.id || h.versionNumber}
                            className={`px-2.5 py-1 rounded-md text-[11px] border font-mono ${
                              h.status === 'APPROVED'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : h.status === 'REJECTED'
                                ? 'bg-rose-50 border-rose-300 text-rose-800'
                                : h.status === 'SUPERSEDED'
                                ? 'bg-stone-100 border-stone-200 text-stone-500 line-through'
                                : 'bg-amber-50 border-amber-300 text-amber-800'
                            }`}
                          >
                            v{h.versionNumber} ({h.status})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Review Form / Decision Trigger */}
                  <div className="pt-4 border-t border-stone-200">
                    {reviewAction !== 'REJECT' ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAction('REJECT');
                            setActionError(null);
                          }}
                          disabled={actionSubmitting}
                          className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors disabled:opacity-50"
                          data-testid="trigger-reject-btn"
                        >
                          Từ chối chính sách
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDirectApprove()}
                          disabled={actionSubmitting}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          data-testid="trigger-approve-btn"
                        >
                          {actionSubmitting ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              Đang phê duyệt...
                            </>
                          ) : (
                            'Phê duyệt (APPROVE)'
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <strong className="text-xs uppercase font-bold flex items-center gap-1.5 text-rose-700">
                            <ShieldAlert size={16} />
                            Xác nhận Từ chối yêu cầu
                          </strong>

                          <button
                            type="button"
                            onClick={() => {
                              setReviewAction(null);
                              setReviewNote('');
                              setActionError(null);
                            }}
                            className="text-stone-400 hover:text-stone-600 text-xs"
                          >
                            Hủy bỏ
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Lý do từ chối (Bắt buộc cung cấp cho Shop): *
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Nêu rõ điều khoản hoặc mức phí vi phạm để Shop điều chỉnh lại..."
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500 bg-white"
                            data-testid="review-note-input"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewAction(null);
                              setReviewNote('');
                              setActionError(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200"
                            disabled={actionSubmitting}
                          >
                            Quay lại
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRejectPolicy()}
                            disabled={actionSubmitting}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                            data-testid="confirm-review-decision-btn"
                          >
                            {actionSubmitting && <Loader2 size={13} className="animate-spin" />}
                            Gửi Từ chối
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
