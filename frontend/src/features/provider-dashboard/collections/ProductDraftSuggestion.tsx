import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { productsApi } from '../api/providerDashboardApi';
import {
  buildListingDescription,
  buildListingName,
  MAX_OCCASIONS,
  OCCASION_OPTIONS,
  selectionFrom,
  STYLE_OPTIONS,
  withSelection,
  type DraftAttribute,
  type ListingSelection,
} from './listingText';
import './productDraftSuggestion.css';

/** UC-C10: what the AI service suggests for the uploaded photos. */
export interface ProductDraft {
  status: 'SUCCESS' | 'NOT_AO_DAI' | 'UNAVAILABLE';
  /** GEMINI: style/fabric/motif/occasion were read too; CLIP_ONLY: colours and pattern only. */
  source?: 'GEMINI' | 'CLIP_ONLY';
  attributes: DraftAttribute[];
  name: string;
  description: string;
  colors: string[];
}

interface ProductDraftSuggestionProps {
  /** Uploaded photo URLs; the first one is the cover. Only the first three are read. */
  imageUrls: string[];
  disabled?: boolean;
  colorOptions: Array<{ key: string; label: string; swatch: string }>;
  selectedColors: string[];
  onApplyName: (name: string) => void;
  onApplyDescription: (description: string) => void;
  /** Adds all the given colour keys in one update (step 2 variant colours). */
  onSelectColors: (colorKeys: string[]) => void;
}

const GROUP_LABELS: Record<string, string> = {
  color: 'Màu',
  pattern: 'Họa tiết',
  gender: 'Dành cho',
  style: 'Phong cách',
  material: 'Chất liệu',
  motif: 'Hoa văn',
  occasion: 'Dịp mặc',
};
// Style and occasion are shown as chips the provider can change, not as read-only facts.
const CHOICE_GROUPS = new Set(['style', 'occasion']);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const sameSelection = (a: ListingSelection, b: ListingSelection) =>
  a.style === b.style && a.occasions.length === b.occasions.length && a.occasions.every((key) => b.occasions.includes(key));

type DraftState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; draft: ProductDraft }
  | { status: 'error'; message: string };

// The wizard unmounts step 1 when the provider moves to step 2; keep the last suggestion
// (for the same photos) so going back does not lose it.
let lastDraft: { photosKey: string; draft: ProductDraft; selection: ListingSelection } | null = null;

/**
 * Suggestion panel in wizard step 1. Nothing is filled in automatically: the provider
 * picks what to use, so text they already typed is never overwritten by surprise.
 */
export const ProductDraftSuggestion: React.FC<ProductDraftSuggestionProps> = ({
  imageUrls,
  disabled,
  colorOptions,
  selectedColors,
  onApplyName,
  onApplyDescription,
  onSelectColors,
}) => {
  const photos = imageUrls.slice(0, 3);
  const photosKey = photos.join('|');
  const [state, setState] = useState<DraftState>(() =>
    lastDraft?.photosKey === photosKey ? { status: 'done', draft: lastDraft.draft } : { status: 'idle' },
  );
  const [applied, setApplied] = useState<{ name?: boolean; description?: boolean }>({});
  const [selection, setSelection] = useState<ListingSelection>(() =>
    lastDraft?.photosKey === photosKey ? lastDraft.selection : selectionFrom([]),
  );
  const shownFor = useRef(photosKey);

  // A suggestion only describes the photos it was made from.
  useEffect(() => {
    if (shownFor.current === photosKey) return;
    shownFor.current = photosKey;
    setState({ status: 'idle' });
    setApplied({});
    setSelection(selectionFrom([]));
  }, [photosKey]);

  const suggest = async () => {
    setState({ status: 'loading' });
    setApplied({});
    try {
      const draft = await productsApi.draftFromPhotos<ProductDraft>({ imageUrls: photos });
      const initial = selectionFrom(draft.attributes);
      lastDraft = { photosKey, draft, selection: initial };
      setSelection(initial);
      setState({ status: 'done', draft });
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : '';
      setState({ status: 'error', message: message || 'Không thể gợi ý lúc này, vui lòng thử lại.' });
    }
  };

  const draft = state.status === 'done' ? state.draft : null;
  const suggestedColors = draft ? colorOptions.filter((option) => draft.colors.includes(option.key)) : [];
  const missingColors = suggestedColors.filter((option) => !selectedColors.includes(option.key));

  // The AI's own text until the provider changes a chip; then it is rebuilt the same way.
  const changed = draft ? !sameSelection(selection, selectionFrom(draft.attributes)) : false;
  const chosen = draft && changed ? withSelection(draft.attributes, selection) : null;
  const name = chosen ? buildListingName(chosen) : draft?.name ?? '';
  const description = chosen ? buildListingDescription(chosen) : draft?.description ?? '';

  const choose = (next: ListingSelection) => {
    setSelection(next);
    if (lastDraft?.photosKey === photosKey) lastDraft = { ...lastDraft, selection: next };
    setApplied({}); // the text changed, so it has not been used yet
  };
  const toggleStyle = (key: string) => choose({ ...selection, style: selection.style === key ? null : key });
  const toggleOccasion = (key: string) =>
    choose({
      ...selection,
      occasions: selection.occasions.includes(key)
        ? selection.occasions.filter((k) => k !== key)
        : [...selection.occasions, key].slice(0, MAX_OCCASIONS),
    });

  return (
    <div className="pdraft">
      <div className="pdraft-head">
        <button
          type="button"
          className="pdraft-trigger"
          onClick={suggest}
          disabled={disabled || photos.length === 0 || state.status === 'loading'}
        >
          {state.status === 'loading' ? <Loader2 size={15} className="pdraft-spin" /> : <Sparkles size={15} />}
          {state.status === 'loading' ? 'Đang đọc ảnh...' : 'Gợi ý tên & mô tả từ ảnh'}
        </button>
        <span className="pdraft-hint">
          {photos.length === 0
            ? 'Tải ảnh lên trước, AI sẽ đọc ảnh bìa và tối đa 2 ảnh tiếp theo.'
            : 'AI chỉ gợi ý những gì nhận ra chắc chắn, bạn quyết định dùng hay không.'}
        </span>
      </div>

      {state.status === 'error' && <p className="pdraft-message is-error">{state.message}</p>}
      {draft?.status === 'NOT_AO_DAI' && (
        <p className="pdraft-message">Ảnh bìa có vẻ không phải áo dài — hãy chọn ảnh rõ chiếc áo làm ảnh bìa.</p>
      )}
      {draft?.status === 'UNAVAILABLE' && (
        <p className="pdraft-message">Tính năng gợi ý đang tạm không khả dụng, bạn có thể tự nhập thông tin.</p>
      )}

      {draft?.status === 'SUCCESS' && (
        <div className="pdraft-card">
          {draft.attributes.some((attribute) => !CHOICE_GROUPS.has(attribute.group)) && (
            <div className="pdraft-chips">
              {draft.attributes
                .filter((attribute) => !CHOICE_GROUPS.has(attribute.group))
                .map((attribute) => (
                  <span key={`${attribute.group}-${attribute.key}`} className="pdraft-chip">
                    {GROUP_LABELS[attribute.group] ?? attribute.group}: <strong>{attribute.label}</strong>
                    <small>{Math.round(attribute.confidence * 100)}%</small>
                  </span>
                ))}
            </div>
          )}

          <div className="pdraft-choices">
            <p className="pdraft-choice-note">
              {draft.source === 'GEMINI'
                ? 'Phong cách và dịp mặc do AI đọc từ ảnh, bạn có thể đổi lại.'
                : 'AI chưa nhận ra phong cách và dịp mặc. Bạn có thể chọn thêm (không bắt buộc) để tên và mô tả đầy đủ hơn.'}
            </p>
            <div className="pdraft-choice-row" role="group" aria-label="Phong cách">
              <span className="pdraft-label">Phong cách</span>
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`pdraft-choice${selection.style === option.key ? ' is-on' : ''}`}
                  aria-pressed={selection.style === option.key}
                  onClick={() => toggleStyle(option.key)}
                >
                  {capitalize(option.label)}
                </button>
              ))}
            </div>
            <div className="pdraft-choice-row" role="group" aria-label="Dịp mặc">
              <span className="pdraft-label">Dịp mặc (tối đa {MAX_OCCASIONS})</span>
              {OCCASION_OPTIONS.map((option) => {
                const on = selection.occasions.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`pdraft-choice${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    disabled={!on && selection.occasions.length >= MAX_OCCASIONS}
                    onClick={() => toggleOccasion(option.key)}
                  >
                    {capitalize(option.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pdraft-row">
            <div className="pdraft-row-body">
              <span className="pdraft-label">Tên gợi ý</span>
              <p className="pdraft-value">{name || 'Chưa đủ thông tin từ ảnh bìa để gợi ý tên.'}</p>
            </div>
            {name && (
              <button
                type="button"
                className="pdraft-apply"
                onClick={() => {
                  onApplyName(name);
                  setApplied((value) => ({ ...value, name: true }));
                }}
              >
                {applied.name ? <><Check size={13} /> Đã dùng</> : 'Dùng tên này'}
              </button>
            )}
          </div>

          {description && (
            <div className="pdraft-row">
              <div className="pdraft-row-body">
                <span className="pdraft-label">Mô tả gợi ý</span>
                <p className="pdraft-value">{description}</p>
              </div>
              <button
                type="button"
                className="pdraft-apply"
                onClick={() => {
                  onApplyDescription(description);
                  setApplied((value) => ({ ...value, description: true }));
                }}
              >
                {applied.description ? <><Check size={13} /> Đã dùng</> : 'Dùng mô tả này'}
              </button>
            </div>
          )}

          {suggestedColors.length > 0 && (
            <div className="pdraft-row">
              <div className="pdraft-row-body">
                <span className="pdraft-label">Màu gợi ý cho bước Biến thể</span>
                <div className="pdraft-colors">
                  {suggestedColors.map((option) => (
                    <span key={option.key} className="pdraft-color">
                      <i style={{ backgroundColor: option.swatch }} />
                      {option.label}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="pdraft-apply"
                disabled={missingColors.length === 0}
                onClick={() => onSelectColors(missingColors.map((option) => option.key))}
              >
                {missingColors.length === 0 ? <><Check size={13} /> Đã chọn</> : 'Chọn các màu này'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
