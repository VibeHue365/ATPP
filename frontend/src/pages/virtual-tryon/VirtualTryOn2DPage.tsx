import React, { useState } from 'react';
import { 
  Sparkles, Camera, Upload, RefreshCw, Download, Settings, 
  Check, Layers, ShieldCheck 
} from 'lucide-react';
import { virtualTryOn2DService } from '../../services/virtualTryOn2DService';
import { useToast } from '../../components/feedback/Toast';

export const VirtualTryOn2DPage: React.FC = () => {
  const toast = useToast();
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string | null>(null);
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

  // Danh sach mau Ao Dai co san de test
  const sampleAoDaiList = [
    { name: 'Áo Dài Truyền Thống Đỏ Hoàng Gia', url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600' },
    { name: 'Áo Dài Cách Tân Xanh Ngọc Bích', url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600' },
    { name: 'Áo Dài Cưới Gấm Thêu Hoa Sen', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600' },
  ];

  // Danh sach mau nguoi mau co san
  const sampleModels = [
    { name: 'Chân dung 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600' },
    { name: 'Chân dung 2', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600' },
    { name: 'Toàn thân 3', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600' },
  ];

  const handleSelectSampleCloth = async (url: string) => {
    setClothPreview(url);
    setResultImageUrl(null);
    try {
      const file = await virtualTryOn2DService.convertUrlToFile(url, 'sample_aodai.jpg');
      setClothFile(file);
    } catch (e) {
      console.warn('Cannot convert sample cloth url to file', e);
    }
  };

  const handleSelectSampleModel = async (url: string) => {
    setPersonPreview(url);
    setResultImageUrl(null);
    try {
      const file = await virtualTryOn2DService.convertUrlToFile(url, 'sample_model.jpg');
      setPersonFile(file);
    } catch (e) {
      console.warn('Cannot convert sample model url to file', e);
    }
  };

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

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const res = await virtualTryOn2DService.testConnection(apiUrl);
    setTestingConnection(false);
    if (res.ok) {
      setConnectionStatus(`Kết nối máy chủ thành công! GPU: ${res.gpu || 'Hoạt động'}`);
    } else {
      setConnectionStatus('Không kết nối được đến máy chủ AI. Vui lòng kiểm tra lại Cloudflare Tunnel!');
    }
  };

  const handleSaveApiUrl = () => {
    virtualTryOn2DService.setApiUrl(apiUrl);
    setShowSettings(false);
    toast.success('Đã lưu địa chỉ máy chủ AI!');
  };

  const handleStartTryOn = async () => {
    if (!personFile && !personPreview) {
      toast.warning('Vui lòng tải lên hoặc chọn ảnh người mẫu / ảnh của bạn!');
      return;
    }
    if (!clothFile && !clothPreview) {
      toast.warning('Vui lòng tải lên hoặc chọn mẫu Áo Dài!');
      return;
    }

    setLoading(true);
    setProgressPercent(15);
    setStepMessage('Đang phân tích phom người và cấu trúc trang phục...');

    const progressTimer = setInterval(() => {
      setProgressPercent(prev => {
        if (prev < 45) return prev + 10;
        if (prev < 80) {
          setStepMessage('AI đang ghép nếp vải và tà áo dài (Fashn-VTON)...');
          return prev + 5;
        }
        if (prev < 95) {
          setStepMessage('Đang hoàn thiện chi tiết ánh sáng và chất liệu vải...');
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
      if (!finalClothFile && clothPreview) {
        finalClothFile = await virtualTryOn2DService.convertUrlToFile(clothPreview, 'cloth.jpg');
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
      toast.success('Ướm thử Áo Dài 2D hoàn tất thành công!');
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
    a.download = `atpp_aodai_2d_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Đã tải ảnh về máy!');
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20 pt-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 border-b border-stone-200 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-600" />
                Công Nghệ AI Virtual Try-On 2D
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-700">
                Fashn-VTON Diffusion
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
              Phòng Thử Đồ Áo Dài AI Trực Tuyến
            </h1>
            <p className="text-stone-600 text-sm mt-1 max-w-2xl">
              Ướm thử các mẫu Áo Dài truyền thống và hiện đại lên ảnh chân dung của bạn chỉ trong 10-15 giây mà không cần thay trang phục thực tế.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="self-start md:self-auto px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
          >
            <Settings size={15} />
            <span>Cấu Hình API Máy Chủ</span>
          </button>
        </div>

        {/* Settings Box */}
        {showSettings && (
          <div className="my-6 p-5 rounded-2xl bg-amber-50/70 border border-amber-200 animate-fadeIn">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
              <Settings size={14} /> Cấu hình Cloudflare Tunnel URL từ Kaggle GPU:
            </h4>
            <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://xxxx.trycloudflare.com"
                className="flex-1 px-3 py-2 rounded-xl border border-amber-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold transition"
              >
                {testingConnection ? 'Kiểm tra...' : 'Kiểm Tra Kết Nối'}
              </button>
              <button
                type="button"
                onClick={handleSaveApiUrl}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition"
              >
                Lưu Cấu Hình
              </button>
            </div>
            {connectionStatus && (
              <p className={`mt-2 text-xs font-medium ${connectionStatus.includes('thành công') ? 'text-emerald-700' : 'text-rose-700'}`}>
                {connectionStatus}
              </p>
            )}
          </div>
        )}

        {/* Main Grid: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          {/* Cột trái: Bộ điều khiển & Tải ảnh (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Box 1: Người mẫu */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <Camera size={16} className="text-amber-600" />
                  1. Ảnh Người Mẫu / Của Bạn
                </h3>
                {personPreview && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check size={14} /> Đã chọn
                  </span>
                )}
              </div>

              <label className="relative w-full h-44 border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl bg-stone-50/70 flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePersonUpload}
                  className="hidden"
                />
                {personPreview ? (
                  <img
                    src={personPreview}
                    alt="Người mẫu"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Upload size={24} className="mx-auto text-stone-400 group-hover:text-amber-500 mb-2 transition" />
                    <span className="text-sm font-bold text-stone-700 group-hover:text-amber-600 block">
                      Tải lên ảnh chân dung của bạn
                    </span>
                    <span className="text-xs text-stone-400 mt-0.5 block">
                      Khuyên dùng ảnh nửa người hoặc toàn thân đứng thẳng
                    </span>
                  </div>
                )}
              </label>

              {/* Mẫu thử nhanh */}
              <div className="mt-4 pt-3 border-t border-stone-100">
                <span className="text-xs font-semibold text-stone-500 block mb-2">
                  Hoặc chọn ảnh mẫu có sẵn:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {sampleModels.map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSampleModel(m.url)}
                      className="group relative rounded-xl overflow-hidden border border-stone-200 hover:border-amber-500 aspect-square transition shadow-xs"
                    >
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <span className="absolute bottom-0 inset-x-0 bg-stone-900/60 backdrop-blur-xs text-[10px] text-white py-0.5 text-center">
                        {m.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Box 2: Áo Dài */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-amber-600" />
                  2. Chọn Mẫu Áo Dài
                </h3>
                {clothPreview && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check size={14} /> Đã chọn
                  </span>
                )}
              </div>

              <label className="relative w-full h-44 border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl bg-stone-50/70 flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleClothUpload}
                  className="hidden"
                />
                {clothPreview ? (
                  <img
                    src={clothPreview}
                    alt="Áo Dài"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Upload size={24} className="mx-auto text-stone-400 group-hover:text-amber-500 mb-2 transition" />
                    <span className="text-sm font-bold text-stone-700 group-hover:text-amber-600 block">
                      Tải lên ảnh trang phục Áo Dài
                    </span>
                    <span className="text-xs text-stone-400 mt-0.5 block">
                      Ảnh sản phẩm Áo Dài phẳng hoặc trên ma-nơ-canh
                    </span>
                  </div>
                )}
              </label>

              {/* Mẫu Áo Dài có sẵn */}
              <div className="mt-4 pt-3 border-t border-stone-100">
                <span className="text-xs font-semibold text-stone-500 block mb-2">
                  Bộ sưu tập Áo Dài tiêu biểu:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {sampleAoDaiList.map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSampleCloth(m.url)}
                      className="group relative rounded-xl overflow-hidden border border-stone-200 hover:border-amber-500 aspect-square transition shadow-xs"
                    >
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <span className="absolute bottom-0 inset-x-0 bg-stone-900/60 backdrop-blur-xs text-[9px] text-white py-0.5 text-center truncate px-1">
                        {m.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Phân loại & Nút Thử đồ */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory('one-pieces')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition ${
                  category === 'one-pieces'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                Áo Dài Toàn Thân
              </button>
              <button
                type="button"
                onClick={() => setCategory('tops')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition ${
                  category === 'tops'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                Áo Dài Cách Tân / Áo
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartTryOn}
              disabled={loading}
              className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white font-extrabold text-base shadow-xl shadow-amber-500/25 transition transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>Đang Ghép Áo Dài AI ({progressPercent}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Bắt Đầu Ướm Thử Áo Dài 2D</span>
                </>
              )}
            </button>

            {loading && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-amber-800 font-semibold text-center animate-pulse">
                  {stepMessage}
                </p>
              </div>
            )}
          </div>

          {/* Cột phải: Xem Kết quả Thử đồ (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden min-h-[580px]">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
                  Kết Quả Thử Áo Dài
                </h3>
                {processTime && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold">
                    Tốc độ: {processTime}s
                  </span>
                )}
              </div>

              {resultImageUrl && (
                <div className="flex items-center gap-2 bg-stone-200/60 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('original')}
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
                      activeTab === 'original' 
                        ? 'bg-white text-stone-900 shadow-xs' 
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Ảnh Gốc
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('result')}
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
                      activeTab === 'result' 
                        ? 'bg-amber-500 text-white shadow-xs' 
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Ảnh Sau Thử
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center p-6 bg-stone-50/30">
              {resultImageUrl ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center max-h-[520px]">
                  <img
                    src={activeTab === 'result' ? resultImageUrl : (personPreview || '')}
                    alt="Kết quả thử Áo Dài"
                    className="max-h-[520px] max-w-full object-contain rounded-2xl shadow-xl border border-stone-200"
                  />
                  {activeTab === 'result' && (
                    <div className="absolute top-3 left-3 px-3 py-1.5 bg-stone-900/80 backdrop-blur text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md">
                      <Sparkles size={13} className="text-amber-400" />
                      Ghép bằng AI 2D Fashn-VTON
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-10 max-w-md">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Sparkles size={28} />
                  </div>
                  <h3 className="text-base font-bold text-stone-800 mb-2">
                    Studio Thử Áo Dài 2D Đã Sẵn Sàng
                  </h3>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Tải ảnh của bạn ở cột bên trái, chọn một mẫu Áo Dài yêu thích và bấm 
                    <strong className="text-amber-700 font-semibold"> "Bắt Đầu Ướm Thử Áo Dài 2D"</strong>. 
                    Mô hình AI sẽ tự động phân tích dáng người, nếp gấp vải và may chiếc Áo Dài ôm sát vóc dáng của bạn!
                  </p>
                </div>
              )}
            </div>

            {resultImageUrl && (
              <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between bg-white">
                <span className="text-xs text-stone-500 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  Độ phân giải tiêu chuẩn cao - Sẵn sàng chia sẻ
                </span>
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Download size={15} /> Tải Ảnh Đầy Đủ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn2DPage;
