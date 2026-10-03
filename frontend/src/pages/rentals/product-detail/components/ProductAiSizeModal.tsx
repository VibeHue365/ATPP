import React from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../../../../components/common/Modal';
import type { FitPreference } from '../types';

interface ProductAiSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  aiHeight: number | '';
  setAiHeight: (val: number | '') => void;
  aiWeight: number | '';
  setAiWeight: (val: number | '') => void;
  aiChest: number | '';
  setAiChest: (val: number | '') => void;
  aiWaist: number | '';
  setAiWaist: (val: number | '') => void;
  aiFitPref: FitPreference;
  setAiFitPref: (pref: FitPreference) => void;
  aiResultSize: string;
  aiReason: string;
  isAiLoading: boolean;
  onCalculate: () => void;
  onApplySize: (size: string) => void;
  onContactCustom: () => void;
}

export const ProductAiSizeModal: React.FC<ProductAiSizeModalProps> = ({
  isOpen,
  onClose,
  productName,
  aiHeight,
  setAiHeight,
  aiWeight,
  setAiWeight,
  aiChest,
  setAiChest,
  aiWaist,
  setAiWaist,
  aiFitPref,
  setAiFitPref,
  aiResultSize,
  aiReason,
  isAiLoading,
  onCalculate,
  onApplySize,
  onContactCustom,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gợi ý Size Thông Minh bởi AI"
      maxWidth="500px"
    >
      <div
        style={{
          padding: '10px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Nhập số đo cơ thể của bạn bên dưới để Trợ lý AI phân tích và đưa ra
          đề xuất kích cỡ tối ưu nhất cho thiết kế <strong>{productName}</strong>.
        </p>

        {/* Form Fields Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            backgroundColor: '#FAF8F5',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #EAE1D4',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>
              Chiều cao (cm)
            </label>
            <input
              type="number"
              value={aiHeight}
              onChange={(e) => {
                const val = e.target.value;
                setAiHeight(val === '' ? '' : parseInt(val) || 0);
              }}
              onBlur={() => {
                if (aiHeight !== '') {
                  setAiHeight(Math.max(100, Math.min(250, Number(aiHeight))));
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #D5C2AD',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>
              Cân nặng (kg)
            </label>
            <input
              type="number"
              value={aiWeight}
              onChange={(e) => {
                const val = e.target.value;
                setAiWeight(val === '' ? '' : parseInt(val) || 0);
              }}
              onBlur={() => {
                if (aiWeight !== '') {
                  setAiWeight(Math.max(20, Math.min(200, Number(aiWeight))));
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #D5C2AD',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>
              Vòng ngực (cm)
            </label>
            <input
              type="number"
              value={aiChest}
              onChange={(e) => {
                const val = e.target.value;
                setAiChest(val === '' ? '' : parseInt(val) || 0);
              }}
              onBlur={() => {
                if (aiChest !== '') {
                  setAiChest(Math.max(40, Math.min(150, Number(aiChest))));
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #D5C2AD',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>
              Vòng eo (cm)
            </label>
            <input
              type="number"
              value={aiWaist}
              onChange={(e) => {
                const val = e.target.value;
                setAiWaist(val === '' ? '' : parseInt(val) || 0);
              }}
              onBlur={() => {
                if (aiWaist !== '') {
                  setAiWaist(Math.max(30, Math.min(150, Number(aiWaist))));
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #D5C2AD',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            />
          </div>
          <div
            style={{
              gridColumn: 'span 2',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>
              Sở thích mặc áo dài
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAiFitPref('SLIM')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border:
                    aiFitPref === 'SLIM'
                      ? '1.5px solid var(--color-primary-dark)'
                      : '1px solid #D5C2AD',
                  backgroundColor:
                    aiFitPref === 'SLIM'
                      ? 'var(--color-primary-trans)'
                      : 'white',
                  color:
                    aiFitPref === 'SLIM'
                      ? 'var(--color-primary-dark)'
                      : '#7E6D5B',
                  cursor: 'pointer',
                }}
              >
                Mặc ôm dáng
              </button>
              <button
                type="button"
                onClick={() => setAiFitPref('COMFORT')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border:
                    aiFitPref === 'COMFORT'
                      ? '1.5px solid var(--color-primary-dark)'
                      : '1px solid #D5C2AD',
                  backgroundColor:
                    aiFitPref === 'COMFORT'
                      ? 'var(--color-primary-trans)'
                      : 'white',
                  color:
                    aiFitPref === 'COMFORT'
                      ? 'var(--color-primary-dark)'
                      : '#7E6D5B',
                  cursor: 'pointer',
                }}
              >
                Mặc thoải mái
              </button>
            </div>
          </div>
        </div>

        {/* Action Trigger Button */}
        <button
          type="button"
          disabled={isAiLoading}
          onClick={onCalculate}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            backgroundColor: isAiLoading
              ? '#8C827A'
              : 'var(--color-primary-dark)',
            color: 'white',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: isAiLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {isAiLoading ? (
            <>ĐANG PHÂN TÍCH BỞI AI...</>
          ) : (
            <>
              <Sparkles size={16} />
              <span>PHÂN TÍCH SỐ ĐO BẰNG AI</span>
            </>
          )}
        </button>

        {/* Result Block */}
        {(aiResultSize || aiReason) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: 'white',
              border: '1.5px solid rgba(182, 145, 91, 0.4)',
              padding: '20px',
              borderRadius: '12px',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#8C827A',
                }}
              >
                SIZE ĐỀ XUẤT TỐI ƯU:
              </span>
              <span
                style={{
                  fontSize: aiResultSize === 'CUSTOM' ? '15px' : '24px',
                  fontWeight: 800,
                  color:
                    aiResultSize === 'CUSTOM'
                      ? '#B85C00'
                      : 'var(--color-primary-dark)',
                  fontFamily: 'var(--font-header)',
                }}
              >
                {aiResultSize === 'CUSTOM'
                  ? 'ĐẶT MAY / LIÊN HỆ SHOP'
                  : `SIZE ${aiResultSize}`}
              </span>
            </div>
            <div
              style={{
                height: '1px',
                backgroundColor: 'rgba(182, 145, 91, 0.15)',
              }}
            />
            <p
              style={{
                fontSize: '13px',
                color: '#4A4440',
                lineHeight: 1.6,
                margin: 0,
                textAlign: 'justify',
              }}
            >
              {aiReason}
            </p>
          </div>
        )}

        {/* Apply size selection */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            borderTop: '1px solid #EAEAE8',
            paddingTop: '16px',
            marginTop: '4px',
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
          {aiResultSize && aiResultSize !== 'CUSTOM' && (
            <button
              type="button"
              className="vh-btn vh-btn-primary"
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              onClick={() => onApplySize(aiResultSize)}
            >
              ÁP DỤNG SIZE {aiResultSize}
            </button>
          )}
          {aiResultSize === 'CUSTOM' && (
            <button
              type="button"
              className="vh-btn vh-btn-primary"
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                backgroundColor: '#B85C00',
                borderColor: '#B85C00',
              }}
              onClick={onContactCustom}
            >
              LIÊN HỆ TƯ VẤN MAY
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
