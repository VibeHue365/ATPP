import React, { useState } from 'react';
import { X, Upload, MapPin, Trash2, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';

interface RentalReturnModalProps {
  isOpen: boolean;
  bookingCode: string;
  storeName: string;
  storeAddress: string;
  depositAmount: number;
  lateFee?: number;
  onClose: () => void;
  onOpenMap?: () => void;
  onSubmit: (data: { evidencePhotos: string[]; note?: string }) => Promise<void>;
}

export const RentalReturnModal: React.FC<RentalReturnModalProps> = ({
  isOpen,
  bookingCode,
  storeName,
  storeAddress,
  depositAmount,
  lateFee = 0,
  onClose,
  onOpenMap,
  onSubmit,
}) => {
  const [note, setNote] = useState('');
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
      setErrorMessage('Bạn chỉ có thể tải lên tối đa 5 hình ảnh bằng chứng.');
      return;
    }

    const updatedFiles = [...files, ...validNewFiles];
    setFiles(updatedFiles);

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
    setNote('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (files.length === 0) {
      setErrorMessage('Bắt buộc tải lên ít nhất 1 hình ảnh hiện trạng áo khi trả.');
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedUrls: string[] = [];

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
          throw new Error(`Tải ảnh "${file.name}" thất bại: ${uploadErr?.message || 'Lỗi mạng'}`);
        }
      }

      setUploadProgressText('Đang ghi nhận yêu cầu trả áo...');
      await onSubmit({
        evidencePhotos: uploadedUrls,
        note: note.trim() || undefined,
      });

      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi gửi yêu cầu trả áo.');
    } finally {
      setIsSubmitting(false);
      setUploadProgressText(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(35, 31, 32, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #ECE5DB',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #F3EDE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            backgroundColor: '#FFFFFF',
            zIndex: 10,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#8E1B2E' }}>
              Xác nhận trả áo dài
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#7D736B' }}>
              Đơn thuê: <span style={{ fontWeight: 700, color: '#231F20' }}>{bookingCode}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#8C827A',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Store info & map guidance */}
          <div
            style={{
              backgroundColor: '#FBF9F6',
              borderRadius: '12px',
              border: '1px solid #EFE9E1',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#7D736B', fontWeight: 600 }}>Điểm trả áo:</span>
                <div style={{ fontSize: '13.5px', fontWeight: 750, color: '#231F20', marginTop: '2px' }}>
                  {storeName}
                </div>
                <div style={{ fontSize: '12.5px', color: '#5C544E', marginTop: '2px', lineHeight: 1.4 }}>
                  {storeAddress}
                </div>
              </div>
              {onOpenMap && (
                <button
                  type="button"
                  onClick={onOpenMap}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DED7CB',
                    color: '#8E1B2E',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={13} />
                  <span>Chỉ đường</span>
                </button>
              )}
            </div>

            <div style={{ paddingTop: '8px', borderTop: '1px dashed #E5DED5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#7D736B' }}>Tiền cọc sẽ đối soát hoàn lại:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  {Math.max(0, depositAmount - (lateFee || 0)).toLocaleString('vi-VN')}đ
                </span>
              </div>
              {lateFee > 0 && (
                <div style={{ fontSize: '11.5px', color: '#B45309', marginTop: '4px', textAlign: 'right' }}>
                  (Cọc {depositAmount.toLocaleString('vi-VN')}đ − Phí quá hạn {lateFee.toLocaleString('vi-VN')}đ)
                </div>
              )}
            </div>
          </div>

          {/* Photo upload section (MANDATORY) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 750, color: '#231F20' }}>
              Ảnh tình trạng áo khi trả <span style={{ color: '#DC2626' }}>* (bắt buộc ít nhất 1 ảnh)</span>
            </label>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#7D736B', lineHeight: 1.4 }}>
              Chụp ảnh tổng thể áo dài và phụ kiện khi bạn bàn giao lại cho nhân viên shop để làm cơ sở đối soát hoàn cọc minh bạch.
            </p>

            <div
              style={{
                border: '1.5px dashed #DED7CB',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: '#FCFAF8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => document.getElementById('return-evidence-file-input')?.click()}
            >
              <input
                id="return-evidence-file-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isSubmitting || files.length >= 5}
              />
              <Upload size={24} color="#8E1B2E" style={{ margin: '0 auto 6px auto' }} />
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#231F20' }}>
                Bấm vào đây để chọn ảnh chụp
              </div>
              <div style={{ fontSize: '11px', color: '#8C827A', marginTop: '2px' }}>
                Hỗ trợ JPG, PNG, WEBP tối đa 5MB / ảnh (tối đa 5 ảnh)
              </div>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {previews.map((previewUrl, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      width: '72px',
                      height: '72px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #E0D7CB',
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt={`Ảnh trả áo #${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isSubmitting}
                      style={{
                        position: 'absolute',
                        top: '3px',
                        right: '3px',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#FFFFFF',
                      }}
                      title="Xóa ảnh"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note input (Optional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 750, color: '#231F20' }}>
              Ghi chú khi trả đồ (không bắt buộc)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Đã trả đủ áo dài và mấn đội đầu cho bạn nhân viên tại quầy..."
              rows={2}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #DED7CB',
                fontSize: '12.5px',
                color: '#231F20',
                outline: 'none',
                resize: 'none',
                backgroundColor: '#FFFFFF',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Safety note */}
          <div
            style={{
              backgroundColor: '#EFF6FF',
              borderRadius: '10px',
              border: '1px solid #BFDBFE',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldCheck size={18} color="#2563EB" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11.5px', color: '#1E40AF', lineHeight: 1.4 }}>
              Sau khi bạn xác nhận trả áo, shop sẽ tiến hành nhận đồ, kiểm tra hiện trạng và hệ thống sẽ tất toán cọc an toàn cho bạn.
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #DED7CB',
                backgroundColor: '#FFFFFF',
                color: '#5C544E',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#8E1B2E',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 750,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(139, 30, 45, 0.3)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>{uploadProgressText || 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <span>Xác nhận đã trả áo</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
