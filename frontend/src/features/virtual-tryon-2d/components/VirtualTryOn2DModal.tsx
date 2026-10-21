import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Upload, RefreshCw, Download, Settings, Camera, Check, 
  Layers, ShieldCheck 
} from 'lucide-react';
import { virtualTryOn2DService } from '../../../services/virtualTryOn2DService';
import { useToast } from '../../../components/feedback/Toast';

export interface VirtualTryOn2DModalProps {
  isOpen: boolean;
  onClose: () => void;
  productImage?: string;
  productName?: string;
}

export const VirtualTryOn2DModal: React.FC<VirtualTryOn2DModalProps> = ({
  isOpen,
  onClose,
  productImage,
  productName,
}) => {
  const toast = useToast();
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string | null>(productImage || null);
  const [category, setCategory] = useState<'one-pieces' | 'tops' | 'bottoms'>('one-pieces');
  
  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  
  const [processTime, setProcessTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'result' | 'original'>('result');
  
  // Settings API
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(virtualTryOn2DService.getApiUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Danh sach mau anh chan dung mau de test nhanh
  const sampleModels = [
    { name: 'Mẫu Nữ 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' },
    { name: 'Mẫu Nữ 2', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500' },
    { name: 'Mẫu Nữ 3', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500' },
  ];

  useEffect(() => {
    if (productImage) {
      setClothPreview(productImage);
      virtualTryOn2DService.convertUrlToFile(productImage, 'aodai_product.jpg')
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
      setResultImageUrl(null);
    }
  };

  const handleClothUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setClothFile(file);
      setClothPreview(URL.createObjectURL(file));
      setResultImageUrl(null);
    }
  };

  const handleSelectSampleModel = async (url: string) => {
    setPersonPreview(url);
    setResultImageUrl(null);
    try {
      const file = await virtualTryOn2DService.convertUrlToFile(url, 'sample_model.jpg');
      setPersonFile(file);
    } catch (e) {
      console.warn('Could not convert sample model url to file', e);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const res = await virtualTryOn2DService.testConnection(apiUrl);
    setTestingConnection(false);
    if (res.ok) {
      setConnectionStatus(`Kết nối thành công! GPU: ${res.gpu || 'Có sẵn'}`);
    } else {
      setConnectionStatus('Không thể kết nối đến API URL này. Hãy kiểm tra lại Cloudflare Tunnel!');
    }
  };

  const handleSaveApiUrl = () => {
    virtualTryOn2DService.setApiUrl(apiUrl);
    setShowSettings(false);
    toast.success('Đã lưu cấu hình API thành công!');
  };

  const handleStartTryOn = async () => {
    if (!personFile && !personPreview) {
      toast.warning('Vui lòng tải lên ảnh của bạn hoặc chọn ảnh mẫu!');
      return;
    }
    if (!clothFile && !productImage) {
      toast.warning('Vui lòng tải lên hoặc chọn ảnh trang phục Áo Dài!');
      return;
    }

    setLoading(true);
    setProgressPercent(20);
    setStepMessage('Đang phân tích phom người và cấu trúc trang phục Áo Dài...');

    const progressTimer = setInterval(() => {
      setProgressPercent(prev => {
        if (prev < 50) return prev + 10;
        if (prev < 80) {
          setStepMessage('AI đang ghép nếp vải và phom dáng Áo Dài (Fashn-VTON)...');
          return prev + 6;
        }
        if (prev < 95) {
          setStepMessage('Đang tinh chỉnh độ chi tiết và sắc nét của ảnh...');
          return prev + 2;
        }
        return prev;
      });
    }, 450);

    try {
      let finalPersonFile = personFile;
      if (!finalPersonFile && personPreview) {
        finalPersonFile = await virtualTryOn2DService.convertUrlToFile(personPreview, 'person.jpg');
      }

      let finalClothFile = clothFile;
      if (!finalClothFile && productImage) {
        finalClothFile = await virtualTryOn2DService.convertUrlToFile(productImage, 'cloth.jpg');
      }

      const res = await virtualTryOn2DService.generate2D({
        personFile: finalPersonFile!,
        clothFile: finalClothFile!,
        category,
        timesteps: 10,
      });

      clearInterval(progressTimer);
      setProgressPercent(100);
      setStepMessage('Hoàn tất!');
      setResultImageUrl(res.imageUrl);
      
      setProcessTime(res.timeSeconds || 12);
      setActiveTab('result');
      toast.success('Thử đồ 2D thành công!');
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi gọi AI Server. Vui lòng kiểm tra lại URL API!');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResult = () => {
    if (!resultImageUrl) return;
    const a = document.createElement('a');
    a.href = resultImageUrl;
    a.download = `atpp_aodai_tryon_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Đã tải ảnh kết quả về máy!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-stone-900">
                  Ướm Thử Áo Dài AI 2D
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  Fashn-VTON 2D
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {productName ? `Đang thử mẫu: ${productName}` : 'Ghép ảnh Áo Dài trực tiếp vào người mẫu bằng trí tuệ nhân tạo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition"
              title="Cài đặt kết nối AI Server"
            >
              <Settings size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Settings Box (Toggle) */}
        {showSettings && (
          <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between text-xs">
            <div className="flex-1 w-full">
              <label className="font-semibold text-stone-700 block mb-1">
                Kaggle Cloudflare Tunnel URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://xxxx.trycloudflare.com"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition"
                >
                  {testingConnection ? 'Kiểm tra...' : 'Kiểm tra'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiUrl}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition shadow-sm"
                >
                  Lưu
                </button>
              </div>
              {connectionStatus && (
                <p className={`mt-1.5 font-medium ${connectionStatus.includes('thành công') ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {connectionStatus}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Đầu vào (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Box 1: Người Mẫu */}
            <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-600" /> 1. Ảnh Người Mẫu / Của Bạn
                </label>
                {personPreview && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                    <Check size={12} /> Đã chọn
                  </span>
                )}
              </div>

              <div className="flex gap-3 items-center">
                <label className="relative flex-1 h-32 border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-xl bg-white flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePersonUpload}
                    className="hidden"
                  />
                  {personPreview ? (
                    <img
                      src={personPreview}
                      alt="Person Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-3">
                      <Upload size={20} className="mx-auto text-stone-400 group-hover:text-amber-500 mb-1 transition" />
                      <span className="text-xs font-semibold text-stone-600 group-hover:text-amber-600 block">
                        Tải ảnh chân dung
                      </span>
                      <span className="text-[10px] text-stone-400">Nửa người hoặc toàn thân</span>
                    </div>
                  )}
                </label>

                {/* Chọn ảnh mẫu nhanh */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-stone-400 font-semibold uppercase">Mẫu thử:</span>
                  {sampleModels.map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSampleModel(m.url)}
                      className="w-9 h-9 rounded-lg overflow-hidden border border-stone-200 hover:border-amber-500 hover:scale-105 transition"
                      title={m.name}
                    >
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Box 2: Trang Phục Áo Dài */}
            <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-600" /> 2. Trang Phục Áo Dài
                </label>
                {clothPreview && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                    <Check size={12} /> Đã sẵn sàng
                  </span>
                )}
              </div>

              <label className="relative w-full h-32 border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-xl bg-white flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleClothUpload}
                  className="hidden"
                />
                {clothPreview ? (
                  <img
                    src={clothPreview}
                    alt="Cloth Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-3">
                    <Upload size={20} className="mx-auto text-stone-400 group-hover:text-amber-500 mb-1 transition" />
                    <span className="text-xs font-semibold text-stone-600 group-hover:text-amber-600 block">
                      Tải ảnh Áo Dài khác
                    </span>
                    <span className="text-[10px] text-stone-400">Đơn sắc trên nền phẳng hoặc ma-nơ-canh</span>
                  </div>
                )}
              </label>
            </div>

            {/* Box 3: Phân Loại Trang Phục */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory('one-pieces')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                  category === 'one-pieces'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                Áo Dài Toàn Thân
              </button>
              <button
                type="button"
                onClick={() => setCategory('tops')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                  category === 'tops'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                Áo Cách Tân
              </button>
            </div>

            {/* Nút Thực Hiện */}
            <button
              type="button"
              onClick={handleStartTryOn}
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Đang Ghép Áo Dài 2D ({progressPercent}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Bắt Đầu Ướm Thử Áo Dài</span>
                </>
              )}
            </button>

            {loading && (
              <div className="mt-1">
                <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-amber-700 font-medium text-center mt-1 animate-pulse">
                  {stepMessage}
                </p>
              </div>
            )}
          </div>

          {/* Cột phải: Xem Kết Quả & So Sánh (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden min-h-[380px]">
            {/* Header kết quả */}
            <div className="px-4 py-2.5 bg-white border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Kết Quả Ướm Thử
                </span>
                {processTime && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    {processTime}s
                  </span>
                )}
              </div>

              {resultImageUrl && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('original')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                      activeTab === 'original' 
                        ? 'bg-amber-100 text-amber-900 font-semibold' 
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Ảnh Gốc
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('result')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                      activeTab === 'result' 
                        ? 'bg-amber-500 text-white font-semibold shadow-sm' 
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Sau Khi Thử
                  </button>
                </div>
              )}
            </div>

            {/* Vùng hiển thị ảnh */}
            <div className="flex-1 flex items-center justify-center p-4 relative min-h-[360px]">
              {resultImageUrl ? (
                <div className="relative w-full h-full flex items-center justify-center max-h-[460px]">
                  <img
                    src={activeTab === 'result' ? resultImageUrl : (personPreview || '')}
                    alt="TryOn Preview"
                    className="max-h-[460px] max-w-full object-contain rounded-xl shadow-lg border border-stone-200"
                  />
                  
                  {activeTab === 'result' && (
                    <div className="absolute top-2 left-2 px-2.5 py-1 bg-stone-900/70 backdrop-blur text-white text-[10px] font-semibold rounded-lg flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-400" /> Kết quả AI Fashn-VTON
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-stone-800 mb-1">
                    Chưa có kết quả ướm thử
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Hãy chọn ảnh của bạn (hoặc ảnh mẫu có sẵn) và bấm nút 
                    <strong className="text-amber-600 font-semibold"> "Bắt Đầu Ướm Thử Áo Dài"</strong> để xem bạn mặc chiếc Áo Dài này đẹp thế nào nhé!
                  </p>
                </div>
              )}
            </div>

            {/* Footer kết quả */}
            {resultImageUrl && (
              <div className="px-4 py-3 bg-white border-t border-stone-200 flex items-center justify-between">
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-500" /> 
                  Ảnh đạt độ phân giải tiêu chuẩn HD
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadResult}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Download size={14} /> Tải Ảnh Về Máy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn2DModal;
