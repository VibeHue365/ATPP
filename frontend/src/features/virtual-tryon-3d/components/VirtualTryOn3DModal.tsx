import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Upload, RefreshCw, Download, Settings, Camera, Check } from 'lucide-react';
import { virtualTryOn3DService } from '../../../services/virtualTryOn3DService';

// Khai báo kiểu dữ liệu cho Web Component <model-viewer> trong React TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

interface VirtualTryOn3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  productImage?: string;
  productName?: string;
}

export const VirtualTryOn3DModal: React.FC<VirtualTryOn3DModalProps> = ({
  isOpen,
  onClose,
  productImage,
  productName,
}) => {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string | null>(productImage || null);
  const [category, setCategory] = useState<'one-pieces' | 'tops' | 'bottoms'>('one-pieces');
  const [quality, setQuality] = useState<'turbo' | 'hd'>('turbo');
  
  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [renderTime, setRenderTime] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  
  // Settings API Kaggle
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(virtualTryOn3DService.getApiUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const modelViewerRef = useRef<any>(null);

  // Load ảnh sản phẩm mặc định khi mở modal
  useEffect(() => {
    if (productImage) {
      setClothPreview(productImage);
      virtualTryOn3DService.convertUrlToFile(productImage, 'aodai_product.jpg')
        .then(file => setClothFile(file))
        .catch(err => console.warn('Could not convert product image to file', err));
    }
  }, [productImage, isOpen]);

  if (!isOpen) return null;

  const handlePersonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPersonFile(file);
      setPersonPreview(URL.createObjectURL(file));
    }
  };

  const handleClothUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setClothFile(file);
      setClothPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveApiUrl = () => {
    virtualTryOn3DService.setApiUrl(apiUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleStartTryOn = async () => {
    if (!personFile) {
      alert('Vui lòng tải lên ảnh người mẫu / ảnh của bạn!');
      return;
    }
    if (!clothFile && !productImage) {
      alert('Vui lòng chọn hoặc tải lên ảnh trang phục Áo Dài!');
      return;
    }

    setLoading(true);
    setProgressPercent(15);
    setStepMessage('Bước 1/3: AI đang ghép Áo Dài vào người mẫu (Fashn-VTON)...');
    const startTime = performance.now();

    const progressTimer = setInterval(() => {
      setProgressPercent(prev => {
        if (prev < 45) return prev + 6;
        if (prev < 75) {
          setStepMessage('Bước 2/3: Rembg đang tách nền trong suốt RGBA...');
          return prev + 4;
        }
        if (prev < 92) {
          setStepMessage('Bước 3/3: Microsoft TRELLIS đang sinh mô hình 3D Mesh...');
          return prev + 2;
        }
        return prev;
      });
    }, 600);

    try {
      let finalClothFile = clothFile;
      if (!finalClothFile && productImage) {
        finalClothFile = await virtualTryOn3DService.convertUrlToFile(productImage);
      }

      const result = await virtualTryOn3DService.generate3D({
        personFile,
        clothFile: finalClothFile!,
        category,
        quality,
      });

      clearInterval(progressTimer);
      setProgressPercent(100);
      setStepMessage('✅ Hoàn tất! Đang nạp mô hình 3D...');
      setGlbUrl(result.glbBlobUrl);

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      setRenderTime(`${elapsed}s`);
    } catch (err: any) {
      clearInterval(progressTimer);
      alert('Lỗi sinh 3D: ' + (err.message || 'Không thể kết nối tới Server AI Kaggle. Vui lòng kiểm tra lại URL API trong phần Cài Đặt!'));
    } finally {
      setLoading(false);
    }
  };

  const toggleRotate = () => {
    if (modelViewerRef.current) {
      const nextState = !autoRotate;
      modelViewerRef.current.autoRotate = nextState;
      setAutoRotate(nextState);
    }
  };

  const resetCamera = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.cameraOrbit = '0deg 75deg 105%';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#1E293B',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#F8FAFC',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #C49A6C 0%, #F6E05E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              ✨ THỬ ÁO DÀI 3D THỜI GIAN THỰC (AI 3D VIRTUAL TRY-ON)
            </span>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              background: 'rgba(196, 154, 108, 0.2)',
              border: '1px solid rgba(196, 154, 108, 0.4)',
              color: '#F6E05E',
              borderRadius: '20px',
              fontWeight: 600,
            }}>
              GPU Accelerated
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Cài đặt URL API Kaggle"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#CBD5E1',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
              }}
            >
              <Settings size={15} />
              <span>Cấu hình API</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#CBD5E1',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {showSettings && (
          <div style={{
            padding: '14px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '13px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
              🔗 Kaggle API URL (Cloudflare Tunnel):
            </span>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://xxx.trycloudflare.com"
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#FFF',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSaveApiUrl}
              style={{
                background: '#8B5A2B',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {saveSuccess ? <Check size={14} /> : null}
              {saveSuccess ? 'Đã Lưu!' : 'Lưu URL'}
            </button>
          </div>
        )}

        {/* Body Content: 2 Columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '400px 1fr',
          gap: '24px',
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Cột trái: Upload & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#CBD5E1' }}>
              📸 Chọn Ảnh Đầu Vào
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Box Ảnh Người Mẫu */}
              <label style={{
                border: '2px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(15, 23, 42, 0.4)',
                minHeight: '160px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <input type="file" accept="image/*" onChange={handlePersonUpload} style={{ display: 'none' }} />
                {personPreview ? (
                  <img src={personPreview} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                ) : (
                  <>
                    <Camera size={26} color="#94A3B8" />
                    <span style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', color: '#E2E8F0' }}>Ảnh Của Bạn</span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>Toàn thân / nửa người</span>
                  </>
                )}
              </label>

              {/* Box Ảnh Áo Dài */}
              <label style={{
                border: '2px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(15, 23, 42, 0.4)',
                minHeight: '160px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <input type="file" accept="image/*" onChange={handleClothUpload} style={{ display: 'none' }} />
                {clothPreview ? (
                  <img src={clothPreview} alt="Cloth" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                ) : (
                  <>
                    <Upload size={26} color="#94A3B8" />
                    <span style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', color: '#E2E8F0' }}>Áo Dài Sản Phẩm</span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>{productName || 'Chọn ảnh áo'}</span>
                  </>
                )}
              </label>
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>
                Phân Loại Trang Phục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#FFF',
                  fontSize: '13px',
                }}
              >
                <option value="one-pieces">👗 Áo Dài / Đầm Nguyên Bộ (One-pieces)</option>
                <option value="tops">👕 Áo ngắn / Áo cách tân (Tops)</option>
                <option value="bottoms">👖 Quần / Váy ngắn (Bottoms)</option>
              </select>
            </div>

            {/* Quality */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '6px' }}>
                Tốc Độ & Chất Lượng 3D
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#FFF',
                  fontSize: '13px',
                }}
              >
                <option value="turbo">⚡ Turbo (~15-20 giây, Khuyên dùng)</option>
                <option value="hd">💎 High Detail (~30-40 giây)</option>
              </select>
            </div>

            {/* Nút Tạo 3D */}
            <button
              onClick={handleStartTryOn}
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '14px',
                background: loading
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'linear-gradient(135deg, #8B5A2B 0%, #C49A6C 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(139, 90, 43, 0.4)',
                transition: 'all 0.3s ease',
              }}
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
              <span>{loading ? 'AI Đang Xử Lý...' : '🚀 Bắt Đầu Thử Đồ & Sinh 3D'}</span>
            </button>

            {/* Tiến trình Loading */}
            {loading && (
              <div style={{
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: '10px',
                border: '1px solid rgba(196, 154, 108, 0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ color: '#E2E8F0' }}>{stepMessage}</span>
                  <span style={{ color: '#F6E05E' }}>{progressPercent}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginTop: '8px',
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8B5A2B, #F6E05E)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: 3D Model Viewer */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.98))',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative',
            minHeight: '440px',
            overflow: 'hidden',
          }}>
            {renderTime && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#86EFAC',
                fontWeight: 600,
                zIndex: 10,
              }}>
                ⏱️ Thời gian tạo: {renderTime}
              </div>
            )}

            {glbUrl ? (
              <model-viewer
                ref={modelViewerRef}
                src={glbUrl}
                camera-controls
                touch-action="pan-y"
                auto-rotate={autoRotate}
                shadow-intensity="1.5"
                exposure="1"
                loading="eager"
                ar
                style={{ width: '100%', height: '100%', flex: 1, minHeight: '380px' }}
              />
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👗✨</div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>
                  Khung Hiển Thị Mô Hình 3D Xoay 360°
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '360px', lineHeight: 1.5 }}>
                  Tải lên ảnh của bạn và ảnh Áo Dài ở cột bên trái, sau đó bấm nút <b>"Bắt Đầu Thử Đồ & Sinh 3D"</b> để xem mô hình 3D sống động tại đây.
                </p>
              </div>
            )}

            {/* Action buttons dưới 3D viewer */}
            {glbUrl && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '10px',
              }}>
                <button
                  onClick={toggleRotate}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {autoRotate ? '⏸️ Tắt Tự Xoay' : '▶️ Bật Tự Xoay 360°'}
                </button>

                <button
                  onClick={resetCamera}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🎯 Đặt Lại Góc Nhìn
                </button>

                <a
                  href={glbUrl}
                  download="AODAI_3D_RESULT.glb"
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    borderRadius: '8px',
                    color: '#86EFAC',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <Download size={14} />
                  <span>Tải File .GLB</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
