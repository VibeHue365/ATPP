import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, Sparkles } from 'lucide-react';


interface PosePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  tips: string;
  targetKeypoints: { x: number; y: number; name: string }[];
}

const POSE_PRESETS: PosePreset[] = [
  {
    id: 'non-la-standing',
    name: 'Đứng Tay Cầm Nón Lá',
    category: 'Áo Dài Truyền Thống',
    description: 'Tay phải nâng nón lá ngang ngực, tay trái giữ nhẹ tà áo, nghiêng vai 15 độ.',
    tips: 'Mắt nhìn theo hướng 45 độ, lưng thẳng, mỉm cười nhẹ.',
    targetKeypoints: [
      { x: 0.5, y: 0.2, name: 'Đầu' },
      { x: 0.42, y: 0.35, name: 'Vai Phải' },
      { x: 0.58, y: 0.35, name: 'Vai Trái' },
      { x: 0.35, y: 0.48, name: 'Tay Cầm Nón' },
      { x: 0.62, y: 0.55, name: 'Tay Giữ Tà' },
      { x: 0.45, y: 0.85, name: 'Chân Thẳng' },
    ]
  },
  {
    id: 'sitting-window',
    name: 'Ngồi Bên Cửa Sổ Cổ Kính',
    category: 'Cổ Phục / Thơ Mộng',
    description: 'Thân ngồi nghiêng góc 45 độ, hai tay khép nhẹ lên đùi, mắt nhìn ra cửa sổ.',
    tips: 'Giữ lưng tự nhiên, buông lỏng hai vai để tà áo rủ mềm mại.',
    targetKeypoints: [
      { x: 0.48, y: 0.25, name: 'Đầu' },
      { x: 0.4, y: 0.4, name: 'Vai Nghiêng' },
      { x: 0.45, y: 0.6, name: 'Tay Đặt Đùi' },
      { x: 0.52, y: 0.75, name: 'Dáng Ngồi' },
    ]
  },
  {
    id: 'walking-street',
    name: 'Bước Đi Nhẹ Nhàng Tà Áo Bay',
    category: 'Dạo Phố / Ngoại Cảnh',
    description: 'Một chân bước nhẹ về phía trước, một tay nâng vạt áo dài chạm gió.',
    tips: 'Bước đi tự nhiên, cằm nâng cao nhẹ nhàng.',
    targetKeypoints: [
      { x: 0.5, y: 0.18, name: 'Đầu' },
      { x: 0.45, y: 0.32, name: 'Thân Nghiêng' },
      { x: 0.6, y: 0.45, name: 'Tay Nâng Vạt' },
      { x: 0.42, y: 0.88, name: 'Bước Chân' },
    ]
  }
];

export const AIPoseAssistant: React.FC = () => {
  const [selectedPose, setSelectedPose] = useState<PosePreset>(POSE_PRESETS[0]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [matchScore, setMatchScore] = useState<number>(65);
  const [isAutoSnapped, setIsAutoSnapped] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Start simulated pose detection loop when camera is active
  useEffect(() => {
    let interval: any;
    if (isCameraActive) {
      interval = setInterval(() => {
        // Simulate dynamic pose matching score calculation (60% to 98%)
        const randomFluctuation = Math.floor(Math.random() * 12) - 4;
        setMatchScore((prev) => {
          const next = Math.min(98, Math.max(55, prev + randomFluctuation));
          if (next >= 92 && !isAutoSnapped) {
            triggerAutoSnap();
          }
          return next;
        });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, isAutoSnapped]);

  const startCamera = async () => {
    setIsCameraActive(true);
    setIsAutoSnapped(false);
    setCapturedImage(null);
    setMatchScore(72);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn("Camera stream simulation fallback active:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const triggerAutoSnap = () => {
    setIsAutoSnapped(true);
    // Capture snapshot
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-slate-800 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-xl text-white shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              AI Pose Assistant <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">AR Realtime</span>
            </h2>
            <p className="text-xs text-slate-400">Khung dây AI gợi ý dáng pose chuẩn nét cho Áo Dài</p>
          </div>
        </div>
        
        {isCameraActive ? (
          <button 
            onClick={stopCamera} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
          >
            Tắt Camera
          </button>
        ) : (
          <button 
            onClick={startCamera} 
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-sm font-semibold rounded-xl shadow-lg transition"
          >
            <Camera className="w-4 h-4" /> Mở Camera AI Pose
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Top: Preset Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Thư viện Dáng Pose Áo Dài</h3>
          {POSE_PRESETS.map((pose) => (
            <div
              key={pose.id}
              onClick={() => setSelectedPose(pose)}
              className={`p-3.5 rounded-xl cursor-pointer transition border ${
                selectedPose.id === pose.id
                  ? 'bg-amber-500/10 border-amber-500/50 text-white'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold">{pose.name}</span>
                <span className="text-[10px] bg-slate-700 text-amber-300 px-2 py-0.5 rounded">{pose.category}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{pose.description}</p>
            </div>
          ))}
        </div>

        {/* Center/Right: Interactive Camera Viewfinder */}
        <div className="lg:col-span-2 relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 min-h-[380px] flex flex-col justify-center items-center">
          {isCameraActive ? (
            <div className="relative w-full h-full min-h-[380px] flex items-center justify-center">
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-2xl"
              />
              <canvas ref={canvasRef} width="640" height="480" className="hidden" />

              {/* AI Skeleton Overlay Graphic */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                {/* SVG Skeleton Wireframe */}
                <svg className="w-full h-full max-w-[320px] max-h-[320px] opacity-85" viewBox="0 0 100 100">
                  {/* Head */}
                  <circle cx="50" cy="20" r="8" fill="none" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" strokeDasharray="3 2" />
                  {/* Spine & Body */}
                  <line x1="50" y1="28" x2="50" y2="60" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" strokeDasharray="3 2" />
                  {/* Shoulders */}
                  <line x1="38" y1="35" x2="62" y2="35" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" />
                  {/* Right Arm (Holding hat) */}
                  <line x1="38" y1="35" x2="30" y2="48" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" />
                  <line x1="30" y1="48" x2="42" y2="52" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" />
                  {/* Left Arm */}
                  <line x1="62" y1="35" x2="68" y2="48" stroke={matchScore >= 90 ? "#10B981" : "#F59E0B"} strokeWidth="2" />
                  {/* Keypoint indicator nodes */}
                  {selectedPose.targetKeypoints.map((kp, i) => (
                    <circle key={i} cx={kp.x * 100} cy={kp.y * 100} r="3" fill={matchScore >= 90 ? "#10B981" : "#3B82F6"} className="animate-pulse" />
                  ))}
                </svg>

                {/* Score Progress Bar */}
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Độ Khớp Dáng AI Realtime</p>
                    <p className={`text-base font-bold ${matchScore >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {matchScore}% {matchScore >= 90 ? '🎯 KHỚP DÁNG CHUẨN!' : '↔ Di chuyển tay theo nét đứt'}
                    </p>
                  </div>
                  <button
                    onClick={triggerAutoSnap}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow"
                  >
                    Bấm Chụp
                  </button>
                </div>
              </div>

              {/* Auto Snap Trigger Flash Indicator */}
              {isAutoSnapped && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                  <CheckCircle className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
                  <p className="text-lg font-bold text-white">Đã Tự Động Bấm Chụp!</p>
                  <p className="text-xs text-slate-200 mb-3">Ảnh khớp 95% độ chuẩn dáng Áo Dài.</p>
                  {capturedImage && (
                    <img src={capturedImage} alt="Captured Pose" className="w-32 h-32 object-cover rounded-xl border-2 border-emerald-500 shadow-xl mb-3" />
                  )}
                  <button
                    onClick={() => setIsAutoSnapped(false)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700"
                  >
                    Chụp Lại
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center p-8">
              <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold text-slate-300">Sẵn sàng trải nghiệm AI Pose Assistant</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Bấm "Mở Camera AI Pose" để kích hoạt camera và xem khung dây gợi ý dáng pose chuẩn nhất cho bộ Áo Dài của bạn.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Pose Tips Footer */}
      <div className="mt-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">Mẹo Nhỏ Từ AI Style Coach:</h4>
          <p className="text-xs text-slate-300 mt-0.5">{selectedPose.tips}</p>
        </div>
      </div>
    </div>
  );
};
