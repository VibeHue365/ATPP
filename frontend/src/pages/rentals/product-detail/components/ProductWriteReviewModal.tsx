import React from 'react';
import { Star } from 'lucide-react';
import { Modal } from '../../../../components/common/Modal';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';
import { getImageUrl } from '../utils/colorUtils';

interface ProductWriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  writeRating: number;
  setWriteRating: (val: number) => void;
  writeComment: string;
  setWriteComment: (val: string) => void;
  writeImages: string[];
  setWriteImages: React.Dispatch<React.SetStateAction<string[]>>;
  submittingReview: boolean;
  onSubmitReview: (e: React.FormEvent) => void;
}

export const ProductWriteReviewModal: React.FC<ProductWriteReviewModalProps> = ({
  isOpen,
  onClose,
  writeRating,
  setWriteRating,
  writeComment,
  setWriteComment,
  writeImages,
  setWriteImages,
  submittingReview,
  onSubmitReview,
}) => {
  const toast = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (writeImages.length + files.length > 10) {
      toast.error('Bạn chỉ có thể đính kèm tối đa 10 hình ảnh!');
      return;
    }

    const uploadPromises = Array.from(files).map(async (file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} vượt quá giới hạn 5MB!`);
        return null;
      }
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await httpClient.post<{ url: string }>(
          '/reviews/upload',
          formData,
        );
        return res.url;
      } catch (err: any) {
        toast.error(
          `Lỗi tải ảnh ${file.name}: ${err.message || 'Không xác định'}`,
        );
        return null;
      }
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter(
      (url): url is string => url !== null,
    );
    if (validUrls.length > 0) {
      setWriteImages((prev) => [...prev, ...validUrls]);
      toast.success(`Đã thêm ${validUrls.length} ảnh thành công!`);
    }
    e.target.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Viết Nhận Xét & Đánh Giá"
      maxWidth="550px"
    >
      <form
        onSubmit={onSubmitReview}
        style={{
          padding: '10px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Độ hài lòng của bạn:
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              color: 'var(--color-gold)',
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setWriteRating(star)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Star
                  size={28}
                  fill={star <= writeRating ? 'currentColor' : 'none'}
                  color="currentColor"
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Nội dung đánh giá:
          </label>
          <textarea
            required
            rows={4}
            value={writeComment}
            onChange={(e) => setWriteComment(e.target.value)}
            placeholder="Chia sẻ trải nghiệm của bạn về phom dáng, chất lượng vải, dịch vụ nhận/trả đồ..."
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #D5C2AD',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '14px',
              lineHeight: 1.6,
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Hình ảnh thực tế đính kèm:
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '8px',
              alignItems: 'center',
            }}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              id="write-image-file-input"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => {
                document.getElementById('write-image-file-input')?.click();
              }}
              className="vh-btn vh-btn-secondary"
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Chọn ảnh từ thiết bị...</span>
            </button>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
              }}
            >
              (Tối đa 10 ảnh JPG, PNG, WEBP, tối đa 5MB/ảnh)
            </span>
          </div>
          {writeImages.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                marginTop: '12px',
              }}
            >
              {writeImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: '60px',
                    height: '60px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                >
                  <img
                    src={getImageUrl(img)}
                    alt="attached"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setWriteImages(writeImages.filter((_, i) => i !== idx))
                    }
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            borderTop: '1px solid #EAEAE8',
            paddingTop: '16px',
            marginTop: '10px',
          }}
        >
          <button
            type="button"
            className="vh-btn vh-btn-outline"
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            onClick={onClose}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submittingReview}
            className="vh-btn vh-btn-primary"
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
