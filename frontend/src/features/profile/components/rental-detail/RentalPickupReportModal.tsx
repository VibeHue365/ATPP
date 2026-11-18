import React, { useState } from 'react';
import { X, Upload, AlertTriangle, ShieldCheck, XCircle, Trash2, Loader2 } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';

export type PickupModalMode = 'CONFIRM' | 'DAMAGE' | 'REJECT';

interface RentalPickupReportModalProps {
  isOpen: boolean;
  mode: PickupModalMode;
  bookingCode: string;
  onClose: () => void;
  onSubmit: (data: { description?: string; reason?: string; evidencePhotos: string[] }) => Promise<void>;
}

export const RentalPickupReportModal: React.FC<RentalPickupReportModalProps> = ({
  isOpen,
  mode,
  bookingCode,
  onClose,
  onSubmit
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setErrorMessage(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    const validNewFiles: File[] = [];
    for (const f of selected) {
      if (!allowedTypes.includes(f.type)) {
        setErrorMessage(`Tệp "${f.name}" không hợp lệ. Chỉ chấp nhận định dạng JPG, PNG, WEBP.`);
        return;
      }
      if (f.size > maxFileSize) {
        setErrorMessage(`Tệp "${f.name}" vượt quá dung lượng tối đa 5MB.`);
        return;
      }
      validNewFiles.push(f);
    }

    if (files.length + validNewFiles.length > 5) {
      setErrorMessage('Bạn chỉ có thể tải lên tối đa 5 hình ảnh.');
      return;
    }

    const updatedFiles = [...files, ...validNewFiles];
    setFiles(updatedFiles);

    // Generate previews
    const newPreviews = validNewFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const removedUrl = prev[index];
      if (removedUrl) URL.revokeObjectURL(removedUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviews([]);
    setText('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    const trimmedText = text.trim();

    // 1. Validation for each mode
    if (mode === 'DAMAGE') {
      if (!trimmedText) {
        setErrorMessage('Vui lòng nhập mô tả chi tiết lỗi hoặc tình trạng có sẵn của trang phục.');
        return;
      }
      if (files.length === 0) {
        setErrorMessage('Báo cáo lỗi bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng.');
        return;
      }
    } else if (mode === 'REJECT') {
      if (!trimmedText) {
        setErrorMessage('Vui lòng nhập lý do từ chối nhận áo.');
        return;
      }
      if (files.length === 0) {
        setErrorMessage('Từ chối nhận đồ bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const uploadedUrls: string[] = [];

      // 2. Upload evidence files
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgressText(`Đang tải ảnh bằng chứng ${i + 1}/${files.length}...`);
          const formData = new FormData();
          formData.append('file', file);

          try {
            const res = await httpClient.post<{ url: string }>('/bookings/upload-reference', formData);
            if (!res?.url) {
              throw new Error(`Máy chủ không trả về liên kết ảnh cho ${file.name}`);
            }
            uploadedUrls.push(res.url);
          } catch (uploadErr: any) {
            console.error('Lỗi upload ảnh:', uploadErr);
            throw new Error(`Không thể tải lên ảnh "${file.name}". Vui lòng thử lại.`);
          }
        }
      }

      setUploadProgressText('Đang xử lý yêu cầu...');

      // 3. Call submit callback
      if (mode === 'DAMAGE') {
        await onSubmit({ description: trimmedText, evidencePhotos: uploadedUrls });
      } else if (mode === 'REJECT') {
        await onSubmit({ reason: trimmedText, evidencePhotos: uploadedUrls });
      } else {
        await onSubmit({ evidencePhotos: uploadedUrls });
      }

      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi xử lý yêu cầu.');
    } finally {
      setIsSubmitting(false);
      setUploadProgressText(null);
    }
  };

  const isDamage = mode === 'DAMAGE';
  const isReject = mode === 'REJECT';
  const isConfirm = mode === 'CONFIRM';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: isDamage ? '#FEF3C7' : isReject ? '#FEE2E2' : '#ECFDF5',
                color: isDamage ? '#D97706' : isReject ? '#DC2626' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isDamage && <AlertTriangle size={20} />}
              {isReject && <XCircle size={20} />}
              {isConfirm && <ShieldCheck size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
                {isDamage && 'Báo cáo tình trạng có sẵn khi nhận áo'}
                {isReject && 'Từ chối nhận áo & Chuyển tranh chấp'}
                {isConfirm && 'Xác nhận đã nhận áo'}
              </h3>
              <span style={{ fontSize: '12px', color: '#7D736B' }}>
                Đơn hàng #{bookingCode}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#8C827A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Notice */}
          {isDamage && (
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#92400E',
                lineHeight: 1.5
              }}
            >
              <strong>Lưu ý:</strong> Báo cáo được ghi nhận là tình trạng có sẵn trước khi thuê và dùng để bảo vệ tiền cọc của bạn. Bạn vẫn có thể tiếp tục nhận đồ và sử dụng dịch vụ.
            </div>
          )}

          {isReject && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#991B1B',
                lineHeight: 1.5
              }}
            >
              <strong>Cảnh báo:</strong> Đơn sẽ được chuyển sang quy trình tranh chấp để Admin đối soát. Bạn sẽ không bắt đầu thời gian thuê và khoản thanh toán sẽ được đóng băng an toàn.
            </div>
          )}

          {isConfirm && (
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#065F46',
                lineHeight: 1.5
              }}
            >
              Bạn xác nhận đã kiểm tra áo và phụ kiện thực tế tại cửa hàng, trang phục đúng mẫu và không có hư hại bất thường? Sau khi xác nhận, thời gian thuê của bạn sẽ chính thức bắt đầu.
            </div>
          )}

          {/* Description/Reason Input (Required for Damage & Reject) */}
          {(isDamage || isReject) && (
            <div>
              <label
                htmlFor="pickup-report-desc"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 750,
                  color: '#231F20',
                  marginBottom: '6px'
                }}
              >
                {isDamage ? 'Mô tả chi tiết tình trạng / lỗi phát hiện *:' : 'Lý do từ chối nhận áo *:'}
              </label>
              <textarea
                id="pickup-report-desc"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isSubmitting}
                placeholder={
                  isDamage
                    ? 'Ví dụ: Vạt áo trước có vết ố nhỏ 2cm, đường chỉ cổ tay bị sờn, thiếu mấn đội đầu...'
                    : 'Ví dụ: Áo bị rách tà lớn không mặc được, giao sai hoàn toàn mẫu mã, kích thước quá chật...'
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #DED7CB',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
          )}

          {/* Normal confirmation is intentionally evidence-free.  Photos are
              mandatory only when the customer reports a problem or rejects
              the handover. */}
          {!isConfirm && <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '13px',
                  fontWeight: 750,
                  color: '#231F20'
                }}
              >
                {isConfirm
                  ? '📸 Tải ảnh hiện trạng áo lúc nhận (Tùy chọn):'
                  : '📸 Ảnh bằng chứng chụp rõ vị trí lỗi (Bắt buộc ít nhất 1 ảnh) *:'}
              </label>
              <span style={{ fontSize: '11px', color: '#7D736B' }}>
                Tối đa 5 ảnh (dưới 5MB)
              </span>
            </div>

            {/* Upload Drop/Button Area */}
            {files.length < 5 && (
              <label
                style={{
                  border: '1.5px dashed #DED7CB',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  backgroundColor: '#FCFAF8',
                  transition: 'border-color 0.15s'
                }}
              >
                <input
                  id="pickup-modal-file-upload"
                  data-testid="pickup-modal-file-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  style={{ display: 'none' }}
                />
                <Upload size={20} color="#8E1B2E" />
                <span style={{ fontSize: '12.5px', fontWeight: 650, color: '#8E1B2E' }}>
                  Bấm để chọn ảnh từ máy hoặc kéo thả vào đây
                </span>
                <span style={{ fontSize: '11px', color: '#8C827A' }}>
                  Chấp nhận JPG, PNG, WEBP (tối đa 5MB/ảnh)
                </span>
              </label>
            )}

            {/* Selected File Previews */}
            {previews.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      width: '74px',
                      height: '74px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #DED7CB'
                    }}
                  >
                    <img src={src} alt={`Xem trước ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isSubmitting}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        border: 'none',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        padding: 0
                      }}
                      title="Xóa ảnh"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12.5px',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #F0ECE4'
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DED7CB',
                color: '#574D4F',
                fontSize: '13px',
                fontWeight: 650,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDamage ? '#D97706' : isReject ? '#DC2626' : '#059669',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 750,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: isDamage
                  ? '0 2px 6px rgba(217, 119, 6, 0.25)'
                  : isReject
                  ? '0 2px 6px rgba(220, 38, 38, 0.25)'
                  : '0 2px 6px rgba(5, 150, 105, 0.25)'
              }}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              <span>
                {uploadProgressText
                  ? uploadProgressText
                  : isDamage
                  ? 'Gửi báo cáo & Nhận đồ'
                  : isReject
                  ? 'Từ chối nhận & Mở tranh chấp'
                  : 'Xác nhận nhận áo'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
