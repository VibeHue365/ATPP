import * as Crypto from 'expo-crypto';
import type {
  ContractReadinessStatus,
  IncidentCompensationMethod,
  ResolvedDamageTier,
} from '@/types/contract';

export function formatContractMoney(value?: number | null): string {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(num).toLocaleString('vi-VN')} đ`;
}

export function createConsentIdempotencyKey(): string {
  try {
    if (typeof Crypto?.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Fallback below if randomUUID is unavailable in test/web runtime
  }
  return `consent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getContractStateBadge(contract: {
  state?: string | null;
  versionState?: string | null;
  isSigned?: boolean;
  legacyStatus?: string | null;
}): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
} {
  const state = (
    contract.state ||
    contract.versionState ||
    contract.legacyStatus ||
    ''
  ).toUpperCase();

  if (state === 'EFFECTIVE' || state === 'ACTIVE') {
    return { label: 'Đã có hiệu lực', tone: 'success' };
  }
  if (state === 'ACCEPTED' || state === 'SIGNED') {
    return { label: 'Đã đồng ý · Chờ thanh toán', tone: 'info' };
  }
  if (state === 'OFFERED' || state === 'AWAITING_CUSTOMER') {
    return { label: 'Chờ khách xác nhận', tone: 'warning' };
  }
  if (state === 'DRAFT' || state === 'PENDING_PROVIDER') {
    return { label: 'Đang khởi tạo', tone: 'neutral' };
  }
  if (state === 'DECLINED') {
    return { label: 'Đã từ chối', tone: 'error' };
  }
  if (state === 'EXPIRED') {
    return { label: 'Đã hết hạn', tone: 'error' };
  }
  if (state === 'TERMINATED') {
    return { label: 'Đã chấm dứt', tone: 'neutral' };
  }
  if (state === 'SUPERSEDED') {
    return { label: 'Phiên bản cũ', tone: 'neutral' };
  }
  if (contract.isSigned) {
    return { label: 'Đã xác nhận', tone: 'success' };
  }
  return { label: 'Chờ xử lý', tone: 'warning' };
}

export function getContractReadinessMeta(status?: ContractReadinessStatus): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
} {
  switch (status) {
    case 'ACCEPTED':
      return { label: 'Đã ký hợp đồng', tone: 'success' };
    case 'AWAITING_CUSTOMER':
      return { label: 'Chờ bạn xác nhận', tone: 'warning' };
    case 'DECLINED':
      return { label: 'Đã từ chối hợp đồng', tone: 'error' };
    case 'EXPIRED':
      return { label: 'Hợp đồng hết hạn', tone: 'error' };
    case 'STALE_SNAPSHOT':
      return { label: 'Cần làm mới điều khoản', tone: 'warning' };
    case 'PROVIDER_ACCEPTANCE_MISSING':
      return { label: 'Shop chưa xác nhận quy chế', tone: 'error' };
    case 'MISSING_CONTRACT':
    case 'MISSING_VERSION':
    case 'SOURCE_NOT_READY':
      return { label: 'Đang chuẩn bị hợp đồng', tone: 'info' };
    default:
      return { label: 'Chưa xác nhận', tone: 'neutral' };
  }
}

export function formatDamageMethodLabel(method: IncidentCompensationMethod): string {
  switch (method) {
    case 'FIXED_FEE':
      return 'Mức phí cố định';
    case 'PERCENTAGE_ON_ASSET':
      return 'Theo % giá trị trang phục';
    case 'ACTUAL_REPAIR_COST':
      return 'Chi phí sửa chữa thực tế';
    case 'INCIDENT_NEGOTIATION':
    default:
      return 'Thỏa thuận giải quyết sự cố';
  }
}

export function formatDamageTierValue(
  tier: ResolvedDamageTier,
  replacementValue?: number | null,
): string {
  if (tier.method === 'FIXED_FEE') {
    return typeof tier.fixedFeeAmount === 'number'
      ? formatContractMoney(tier.fixedFeeAmount)
      : 'Phí cố định theo thỏa thuận';
  }
  if (tier.method === 'PERCENTAGE_ON_ASSET') {
    const pct = tier.percentageOfAsset ?? 0;
    if (replacementValue && replacementValue > 0 && pct > 0) {
      const est = Math.round((replacementValue * pct) / 100);
      return `${pct}% giá trị (${formatContractMoney(est)})`;
    }
    return `${pct}% giá trị bồi hoàn trang phục`;
  }
  if (tier.method === 'ACTUAL_REPAIR_COST') {
    return 'Theo hóa đơn sửa chữa thực tế (tối đa giá trị bồi hoàn)';
  }
  return 'Thương lượng & đối soát sự cố trực tiếp trên TàGo';
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAndroidPdfViewerHtml(
  base64: string,
  fallbackText?: string | null,
  title = 'Hợp đồng điện tử',
): string {
  const safeBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const safeFallback = escapeHtml(
    fallbackText || 'Không thể hiển thị bộ đọc PDF trực tiếp. Vui lòng xem chi tiết điều khoản trong ứng dụng.',
  );

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: #F5F3F3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1B1C1C; }
    #status { font-size: 13px; color: #5F5E5E; text-align: center; padding: 12px; }
    #pages canvas { display: block; width: 100%; height: auto; margin: 0 auto 12px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    #fallback { display: none; background: #fff; padding: 16px; border-radius: 10px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; border: 1px solid #EFECEB; }
  </style>
</head>
<body>
  <div id="status">Đang tải bản PDF có chứng thực...</div>
  <div id="pages"></div>
  <pre id="fallback">${safeFallback}</pre>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    (function () {
      var statusEl = document.getElementById('status');
      var pagesEl = document.getElementById('pages');
      var fallbackEl = document.getElementById('fallback');

      function showFallback(reason) {
        statusEl.textContent = reason || 'Đang hiển thị bản văn hợp đồng chuẩn';
        fallbackEl.style.display = 'block';
      }

      try {
        if (typeof pdfjsLib === 'undefined') {
          showFallback('Trình đọc PDF ngoại tuyến — hiển thị nội dung hợp đồng:');
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        var raw = atob('${safeBase64}');
        var len = raw.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) { bytes[i] = raw.charCodeAt(i); }

        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          statusEl.textContent = 'Tổng cộng ' + pdf.numPages + ' trang PDF';
          var chain = Promise.resolve();
          for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            (function (num) {
              chain = chain.then(function () {
                return pdf.getPage(num).then(function (page) {
                  var viewport = page.getViewport({ scale: 1.6 });
                  var canvas = document.createElement('canvas');
                  var ctx = canvas.getContext('2d');
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  pagesEl.appendChild(canvas);
                  return page.render({ canvasContext: ctx, viewport: viewport }).promise;
                });
              });
            })(pageNum);
          }
          return chain;
        }).catch(function () {
          showFallback('Không thể giải mã PDF trên thiết bị này. Bản văn chi tiết:');
        });
      } catch (e) {
        showFallback('Bản văn hợp đồng:');
      }
    })();
  </script>
</body>
</html>`;
}
