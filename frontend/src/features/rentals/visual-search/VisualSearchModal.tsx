import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import {
  formatCampaignPercent,
  isSurchargeCampaign,
} from '../../../shared/pricing/campaignPricing';
import { prepareSearchImage, validateSearchImage } from './prepareSearchImage';
import {
  describeResults,
  searchAoDaiByImage,
  VERY_SIMILAR_SCORE,
  type VisualSearchProduct,
  type VisualSearchResult,
} from './visualSearchApi';
import './VisualSearchModal.css';

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'done'; result: VisualSearchResult }
  | { status: 'error'; message: string };

const NO_MATCH_MESSAGE = 'Không tìm thấy áo dài phù hợp trong ảnh.';

export const VisualSearchModal: React.FC<VisualSearchModalProps> = ({ isOpen, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  const search = async (file: File) => {
    const invalid = validateSearchImage(file);
    if (invalid) {
      setState({ status: 'error', message: invalid });
      return;
    }
    setState({ status: 'searching' });
    try {
      const image = await prepareSearchImage(file);
      setPreviewUrl(image.previewUrl);
      const result = await searchAoDaiByImage(image.base64, image.mimeType);
      setState({ status: 'done', result });
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : '';
      setState({ status: 'error', message: message || 'Không thể tìm kiếm lúc này, vui lòng thử lại.' });
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void search(file);
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setState({ status: 'idle' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tìm áo dài bằng hình ảnh" maxWidth="880px">
      <div className="visual-search">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          data-testid="visual-search-input"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <div className="visual-search__layout">
          <button
            type="button"
            className={`visual-search__dropzone${isDragging ? ' is-dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
            disabled={state.status === 'searching'}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Ảnh bạn đã chọn" className="visual-search__preview" />
                <span className="visual-search__change">
                  <RefreshCw size={14} /> Chọn ảnh khác
                </span>
              </>
            ) : (
              <span className="visual-search__placeholder">
                <ImagePlus size={32} />
                <strong>Chọn hoặc kéo thả ảnh áo dài</strong>
                <small>JPG, PNG, WebP · tối đa 10MB</small>
              </span>
            )}
          </button>

          <div className="visual-search__results" aria-live="polite">
            {state.status === 'idle' && (
              <p className="visual-search__hint">
                Tải lên ảnh một mẫu áo dài bạn thích, hệ thống sẽ tìm các mẫu tương tự đang cho thuê.
                Ảnh chỉ có một chiếc áo, chụp rõ dáng và màu sẽ cho kết quả chính xác hơn.
              </p>
            )}
            {state.status === 'searching' && (
              <p className="visual-search__status">
                <Loader2 size={18} className="visual-search__spin" /> Đang tìm mẫu tương tự...
              </p>
            )}
            {state.status === 'error' && <p className="visual-search__error">{state.message}</p>}
            {state.status === 'done' && state.result.items.length === 0 && (
              <div className="visual-search__empty">
                <SearchX size={28} />
                <p>{state.result.message || NO_MATCH_MESSAGE}</p>
                <small>Hãy thử ảnh khác hoặc dùng bộ lọc màu sắc, kiểu dáng.</small>
              </div>
            )}
            {state.status === 'done' && state.result.items.length > 0 && (
              <>
                <ResultsHeadline scores={state.result.items.map((item) => item.visualScore)} />
                <div className="visual-search__grid">
                  {state.result.items.map((product) => (
                    <VisualSearchResultCard key={product._id} product={product} onOpen={handleClose} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const ResultsHeadline: React.FC<{ scores: number[] }> = ({ scores }) => {
  const { exactMatch, title, subtitle } = describeResults(scores);
  return (
    <div className={`visual-search__headline${exactMatch ? ' is-exact' : ''}`}>
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
    </div>
  );
};

const VisualSearchResultCard: React.FC<{ product: VisualSearchProduct; onOpen: () => void }> = ({
  product,
  onOpen,
}) => {
  const verySimilar = product.visualScore >= VERY_SIMILAR_SCORE;
  const shop = typeof product.providerId === 'object' ? product.providerId?.businessName : undefined;
  const campaign = product.activeCampaign;
  return (
    <Link to={`/rentals/${product._id}`} className="visual-search-card" onClick={onOpen}>
      <div className="visual-search-card__media">
        <img src={getMediaUrl(product.images?.[0])} alt={product.name} />
        <span className={`visual-search-card__score${verySimilar ? ' is-very-similar' : ''}`}>
          {verySimilar ? 'Rất giống' : 'Tương tự'} {Math.round(product.visualScore * 100)}%
        </span>
      </div>
      <div className="visual-search-card__body">
        <strong className="visual-search-card__name">{product.name}</strong>
        {shop && <span className="visual-search-card__shop">{shop}</span>}
        <span className="visual-search-card__price">
          {product.basePrice.toLocaleString('vi-VN')}đ<small>/ngày</small>
          {campaign && (
            <em className={isSurchargeCampaign(campaign) ? 'is-surcharge' : 'is-discount'}>
              {formatCampaignPercent(campaign)}
            </em>
          )}
        </span>
      </div>
    </Link>
  );
};
