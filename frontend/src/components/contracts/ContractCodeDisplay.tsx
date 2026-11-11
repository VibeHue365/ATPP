import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface ContractCodeDisplayProps {
  /** Raw contract code (e.g., V2-6AF36204733255BA51765303-6A5DD0CF48A10617899BF1D6 or fallback ID) */
  code?: string | null;
  /** Whether to show 'Mã hợp đồng: ' label before code. Default true. */
  showLabel?: boolean;
  /** Custom label prefix. Default 'Mã hợp đồng:'. */
  label?: string;
  /** Whether to truncate long codes with '...'. Default true. */
  truncate?: boolean;
  /** Number of characters to preserve at start when truncating. Default 9. */
  headLength?: number;
  /** Number of characters to preserve at end when truncating. Default 5. */
  tailLength?: number;
  /** Whether to include the interactive copy button. Default true. */
  copyable?: boolean;
  /** Optional inline style override */
  style?: React.CSSProperties;
  /** Custom test ID */
  testId?: string;
}

/**
 * Truncates long contract UUIDs/identifiers into readable format (e.g. V2-6AF362...BF1D6).
 * Short codes (<= headLength + tailLength + 2) are preserved as-is.
 * Null/undefined/empty codes fallback safely to '---'.
 */
export function truncateContractCode(
  code: string | null | undefined,
  headLength = 9,
  tailLength = 5,
): string {
  if (!code) return '---';
  const trimmed = String(code).trim();
  if (!trimmed) return '---';

  const threshold = headLength + tailLength + 2;
  if (trimmed.length <= threshold) {
    return trimmed;
  }

  return `${trimmed.slice(0, headLength)}...${trimmed.slice(-tailLength)}`;
}

export const ContractCodeDisplay: React.FC<ContractCodeDisplayProps> = ({
  code,
  showLabel = true,
  label = 'Mã hợp đồng:',
  truncate = true,
  headLength = 9,
  tailLength = 5,
  copyable = true,
  style,
  testId = 'contract-code-display',
}) => {
  const [copied, setCopied] = useState(false);
  const rawCode = (code || '').trim();
  const hasCode = Boolean(rawCode);
  const displayedText = truncate ? truncateContractCode(rawCode, headLength, tailLength) : rawCode || '---';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCode) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rawCode);
      } else {
        // Fallback for non-secure / mock environments
        const textArea = document.createElement('textarea');
        textArea.value = rawCode;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy contract code to clipboard:', err);
    }
  };

  return (
    <div
      data-testid={testId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        fontSize: '12.5px',
        color: '#475569',
        ...style,
      }}
    >
      {showLabel && (
        <span style={{ color: '#64748b', fontWeight: 500 }}>
          {label}
        </span>
      )}

      <span
        data-testid={`${testId}-code`}
        title={hasCode ? `Mã đầy đủ: ${rawCode}` : 'Chưa có mã'}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: '11.5px',
          fontWeight: 600,
          color: hasCode ? '#1e293b' : '#94a3b8',
          backgroundColor: '#f1f5f9',
          padding: '2px 7px',
          borderRadius: '5px',
          border: '1px solid #e2e8f0',
          letterSpacing: '0.02em',
          userSelect: 'all',
        }}
      >
        {displayedText}
      </span>

      {copyable && hasCode && (
        <button
          type="button"
          data-testid={`${testId}-copy-btn`}
          onClick={handleCopy}
          aria-label="Sao chép mã hợp đồng đầy đủ"
          title={copied ? 'Đã sao chép mã đầy đủ!' : `Sao chép mã đầy đủ: ${rawCode}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '2px 5px',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
            backgroundColor: copied ? '#ecfdf5' : '#ffffff',
            color: copied ? '#059669' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '11px',
            lineHeight: 1,
          }}
        >
          {copied ? (
            <>
              <Check size={12} color="#059669" />
              <span style={{ fontSize: '10.5px', fontWeight: 600 }}>Đã chép</span>
            </>
          ) : (
            <Copy size={12} />
          )}
        </button>
      )}
    </div>
  );
};
