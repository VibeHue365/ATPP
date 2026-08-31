import React, { useState, useRef } from 'react';
import { Sparkles, Camera, Upload, RefreshCw, Download, Settings, Check } from 'lucide-react';
import { virtualTryOn3DService } from '../../services/virtualTryOn3DService';

export const VirtualTryOn3DPage: React.FC = () => {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<'one-pieces' | 'tops' | 'bottoms'>('one-pieces');
  const [quality, setQuality] = useState<'turbo' | 'hd'>('turbo');
  
  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [renderTime, setRenderTime] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Settings API
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(virtualTryOn3DService.getApiUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const modelViewerRef = useRef<any>(null);

  // Danh sách mẫu Áo Dài có sẵn để test nhanh
  const sampleAoDaiList = [
    { name: 'Áo Dài Truyền Thống Đỏ', url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600' },
    { name: 'Áo Dài Cách Tân Xanh Ngọc', url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600' },
    { name: 'Áo Dài Cưới Gấm Hoàng Gia', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600' },
  ];

  const handleSelectSampleCloth = async (url: string) => {
    setClothPreview(url);
    try {
      const file = await virtualTryOn3DService.convertUrlToFile(url, 'sample_aodai.jpg');
      setClothFile(file);
    } catch (e) {
      console.warn('Cannot convert sample url to file', e);
    }
  };

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
      alert('Vui lòng tải lên ảnh của bạn hoặc ảnh người mẫu!');
      return;
    }
    if (!clothFile) {
      alert('Vui lòng tải lên hoặc chọn một mẫu Áo Dài từ danh sách!');
      return;
    }

    setLoading(true);
    setProgressPercent(10);
    setStepMessage('Bước 1/3: Fashn-VTON đang ghép Áo Dài vào người mẫu...');
    const startTime = performance.now();

    const progressTimer = setInterval(() => {
      setProgressPercent(prev => {
        if (prev < 45) return prev + 6;
        if (prev < 75) {
          setStepMessage('Bước 2/3: Rembg đang tách sạch phông nền RGBA...');
          return prev + 4;
        }
        if (prev < 92) {
          setStepMessage('Bước 3/3: Microsoft TRELLIS đang sinh vật thể 3D Mesh...');
          return prev + 2;
        }
        return prev;
      });
    }, 600);

    try {
      const result = await virtualTryOn3DService.generate3D({
        personFile,
        clothFile,
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
      alert('Lỗi sinh 3D: ' + (err.message || 'Không thể kết nối tới Server AI. Vui lòng kiểm tra lại URL API trong phần Cài Đặt!'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1300px',
      margin: '0 auto',
      padding: '40px 20px 80px',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {/* Page Title & Breadcrumb */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          background: 'rgba(196, 154, 108, 0.15)',
          border: '1px solid rgba(196, 154, 108, 0.4)',
          borderRadius: '30px',
          color: '#8B5A2B',
          fontSize: '13px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>
          <Sparkles size={15} /> CÔNG NGHỆ THỬ ĐỒ ÁO DÀI 3D THỜI GIAN THỰC
        </div>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 800,
          color: '#1E293B',
          marginBottom: '12px',
        }}>
          Phòng Thử Đồ Áo Dài 3D (AI Studio)
        </h1>
        <p style={{ fontSize: '16px', color: '#64748B', maxWidth: '650px', margin: '0 auto' }}>
          Tải ảnh của bạn lên và chọn mẫu Áo Dài yêu thích. Trí tuệ nhân tạo sẽ tự động mặc thử và tạo mô hình 3D xoay 360° chỉ trong 15–20 giây!
        </p>

        {/* API Settings Button */}
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'white',
              border: '1px solid #CBD5E1',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Settings size={14} />
            <span>Cấu hình API Kaggle GPU Server</span>
          </button>
        </div>
      </div>

      {/* Settings Bar */}
      {showSettings && (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto 30px',
          padding: '16px 20px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
            🔗 Kaggle API URL:
          </span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://xxx.trycloudflare.com"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13px',
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

      {/* Main 2-Column Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '460px 1fr',
        gap: '30px',
        alignItems: 'start',
      }}>
        {/* Left Form: Inputs */}
        <div style={{
          background: 'white',
          padding: '28px',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E2E8F0',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', marginBottom: '20px' }}>
            1. Tải Lên Ảnh & Chọn Mẫu
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            {/* Box 1: Người mẫu */}
            <label style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#F8FAFC',
              minHeight: '180px',
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
                  <Camera size={28} color="#8B5A2B" />
                  <span style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px', color: '#1E293B' }}>Ảnh Của Bạn</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Toàn thân / nửa người</span>
                </>
              )}
            </label>

            {/* Box 2: Trang phục */}
            <label style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#F8FAFC',
              minHeight: '180px',
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
                  <Upload size={28} color="#8B5A2B" />
                  <span style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px', color: '#1E293B' }}>Tải Ảnh Áo Dài</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Hoặc chọn mẫu bên dưới</span>
                </>
              )}
            </label>
          </div>

          {/* Mẫu Áo Dài chọn nhanh */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '8px' }}>
              Hoặc chọn mẫu Áo Dài có sẵn:
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              {sampleAoDaiList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSampleCloth(item.url)}
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    borderRadius: '10px',
                    border: clothPreview === item.url ? '2px solid #8B5A2B' : '1px solid #E2E8F0',
                    overflow: 'hidden',
                    background: '#FFF',
                    textAlign: 'center',
                    padding: '4px',
                  }}
                >
                  <img src={item.url} alt={item.name} style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#334155', display: 'block', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Phân loại */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Phân Loại Trang Phục
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
              }}
            >
              <option value="one-pieces">👗 Áo Dài / Đầm Nguyên Bộ (One-pieces)</option>
              <option value="tops">👕 Áo ngắn / Áo cách tân (Tops)</option>
              <option value="bottoms">👖 Quần / Váy ngắn (Bottoms)</option>
            </select>
          </div>

          {/* Chất lượng */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Chế Độ Xử Lý
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as any)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
              }}
            >
              <option value="turbo">⚡ Turbo Mode (~15-20s, Khuyên dùng)</option>
              <option value="hd">💎 High Detail Mode (~30-40s, Chi tiết cao)</option>
            </select>
          </div>

          {/* Nút Bắt Đầu */}
          <button
            onClick={handleStartTryOn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading
                ? '#94A3B8'
                : 'linear-gradient(135deg, #8B5A2B 0%, #C49A6C 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 8px 20px rgba(139, 90, 43, 0.35)',
              transition: 'all 0.3s ease',
            }}
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
            <span>{loading ? 'AI Đang Xử Lý...' : '🚀 Bắt Đầu Thử Đồ & Sinh 3D'}</span>
          </button>

          {/* Progress Bar */}
          {loading && (
            <div style={{
              marginTop: '16px',
              padding: '14px',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span style={{ color: '#334155' }}>{stepMessage}</span>
                <span style={{ color: '#8B5A2B' }}>{progressPercent}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#E2E8F0',
                borderRadius: '4px',
                overflow: 'hidden',
                marginTop: '8px',
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #8B5A2B, #C49A6C)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: 3D Model Viewer */}
        <div style={{
          background: '#0F172A',
          borderRadius: '24px',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {renderTime && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              color: '#86EFAC',
              fontWeight: 700,
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
              style={{ width: '100%', height: '100%', flex: 1, minHeight: '520px' }}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 40px',
              textAlign: 'center',
              color: '#F8FAFC',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>👗✨</div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                Mô Hình 3D Xoay 360° Sẽ Xuất Hiện Tại Đây
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '420px', lineHeight: 1.6 }}>
                Sau khi bấm <b>"Bắt Đầu Thử Đồ & Sinh 3D"</b>, mô hình Áo Dài 3D sẽ xuất hiện trực tiếp tại đây để bạn có thể xoay 360 độ và ngắm nhìn mọi góc cạnh.
              </p>
            </div>
          )}

          {/* Action Bar */}
          {glbUrl && (
            <div style={{
              padding: '16px 20px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: '12px',
            }}>
              <button
                onClick={() => {
                  if (modelViewerRef.current) {
                    modelViewerRef.current.autoRotate = !autoRotate;
                    setAutoRotate(!autoRotate);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {autoRotate ? '⏸️ Tắt Tự Xoay' : '▶️ Bật Tự Xoay'}
              </button>

              <button
                onClick={() => {
                  if (modelViewerRef.current) {
                    modelViewerRef.current.cameraOrbit = '0deg 75deg 105%';
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 600,
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
                  padding: '10px',
                  background: 'rgba(34, 197, 94, 0.25)',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  borderRadius: '10px',
                  color: '#86EFAC',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                }}
              >
                <Download size={15} />
                <span>Tải File .GLB</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn3DPage;
