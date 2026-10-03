import React from 'react';
import { Sparkles, User } from 'lucide-react';

interface ProductAiWidgetProps {
  onOpenVirtualTryOn: () => void;
  onOpenAiSize: () => void;
}

export const ProductAiWidget: React.FC<ProductAiWidgetProps> = ({
  onOpenVirtualTryOn,
  onOpenAiSize,
}) => {
  return (
    <div className="vh-pd-ai-widget">
      <span
        style={{
          fontSize: '11px',
          color: 'var(--color-gold-dark)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Sparkles size={12} /> CÔNG NGHỆ AI HỖ TRỢ
      </span>
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
        <button
          type="button"
          onClick={onOpenVirtualTryOn}
          className="vh-pd-ai-btn hover:scale-[1.02]"
        >
          <Sparkles size={18} className="text-amber-500 animate-pulse" />
          <span
            className="font-header font-bold text-stone-800"
            style={{ fontSize: '13px' }}
          >
            Thử Đồ Ảo (AI)
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenAiSize}
          className="vh-pd-ai-btn hover:scale-[1.02]"
        >
          <User size={18} className="text-purple-600" />
          <span
            className="font-header font-bold text-stone-800"
            style={{ fontSize: '13px' }}
          >
            Gợi Ý Size (AI)
          </span>
        </button>
      </div>
    </div>
  );
};
