import React, { useState, useRef, useEffect } from 'react';
import { httpClient } from '../../../services/httpClient';
import { Send, Sparkles, Brain, Cpu, MessageSquare, Image, X } from 'lucide-react';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  image?: string; // base64 preview or object URL
  recommended_products?: any[];
  category?: string;
  source?: string;
  confidence?: number;
}

export const AIChatBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Xin chào! Mình là Trợ lý AI cổ phong của Di sản Áo Dài. Mình có thể hỗ trợ bạn tìm hiểu các kiểu dáng thiết kế cổ áo, tay áo, tà áo và tư vấn lựa chọn chất liệu vải phù hợp hoàn hảo với vóc dáng của bạn. Bạn muốn bắt đầu tìm hiểu về phần nào ạ? 😊',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      setSelectedImage({
        base64: base64Data,
        mimeType: file.type,
        previewUrl: base64String,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text && !selectedImage) return;

    if (!textToSend) {
      setInput('');
    }

    const imgToSend = selectedImage;
    if (imgToSend) {
      setSelectedImage(null);
    }

    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text,
        image: imgToSend ? imgToSend.previewUrl : undefined,
      },
    ]);
    setIsLoading(true);

    try {
      let res: any;
      if (imgToSend) {
        res = await httpClient.post('/ai/chat/with-image', {
          message: text,
          image_base64: imgToSend.base64,
          mime_type: imgToSend.mimeType,
        });
      } else {
        res = await httpClient.post('/ai/chat', { message: text });
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          category: res.category,
          source: res.source,
          confidence: res.confidence,
          recommended_products: res.recommended_products,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Rất tiếc, kết nối đến Trợ lý AI đang gặp sự cố. Bạn hãy thử nhắn lại sau ít phút hoặc hỏi về cổ áo, tay áo, chất liệu vải nha! 😊',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    { label: 'Tư vấn cổ áo dài', text: 'Nên chọn dáng cổ áo dài nào để che khuyết điểm cổ ngắn?' },
    { label: 'Kiểu tay áo thịnh hành', text: 'Tư vấn các dáng tay áo dài cách tân trẻ trung?' },
    { label: 'Chất liệu vải lụa tơ tằm', text: 'Vải lụa tơ tằm có ưu điểm gì khi may áo dài?' },
    { label: 'Giá thuê & Dịch vụ', text: 'Bảng giá thuê và thời gian thuê tối đa của shop?' },
  ];

  return (
    <div className="flex flex-col h-full bg-stone-50 border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm">
      {/* Bot Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#a11e22] text-white rounded-lg">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="font-header text-sm font-bold tracking-wide">Trợ Lý Thiết Kế Cổ Phong AI</h4>
            <span className="text-[10px] text-stone-400 font-medium tracking-wide flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>TRỰC TUYẾN • TỰ HỌC THÔNG MINH</span>
            </span>
          </div>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] ${
              msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-stone-900 text-white rounded-tr-none'
                  : 'bg-white text-stone-900 border border-stone-100 rounded-tl-none'
              }`}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="User uploaded"
                  className="max-w-full max-h-48 rounded-lg mb-2 object-cover block"
                />
              )}
              {msg.text}
            </div>

            {/* Recommended Products UI */}
            {msg.sender === 'ai' && msg.recommended_products && msg.recommended_products.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2 w-full max-w-[280px] xs:max-w-[320px]">
                <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block px-1">
                  Mẫu sản phẩm gợi ý:
                </span>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200">
                  {msg.recommended_products.map((prod: any) => (
                    <div
                      key={prod._id}
                      className="flex-shrink-0 w-[140px] bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:border-stone-800 transition flex flex-col"
                    >
                      <div className="h-20 bg-stone-100 relative">
                        <img
                          src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80'}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 text-[8px] text-white font-bold rounded">
                          {prod.basePrice?.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h5 className="font-header text-[11px] font-bold text-stone-900 truncate">
                            {prod.name}
                          </h5>
                          <p className="text-[9px] text-stone-500 truncate">
                            {prod.materials?.join(', ') || 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const el = document.getElementById('rentals');
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth' });
                            } else {
                              alert(`Sản phẩm: ${prod.name}\nGiá thuê: ${prod.basePrice?.toLocaleString('vi-VN')}đ\nChất liệu: ${prod.materials?.join(', ')}`);
                            }
                          }}
                          className="mt-1.5 w-full py-1 bg-stone-900 hover:bg-[#a11e22] text-white text-[9px] font-bold rounded transition text-center"
                        >
                          Thuê ngay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart tags for AI replies */}
            {msg.sender === 'ai' && (msg.category || msg.source) && (
              <div className="flex gap-2 mt-1.5 text-[10px] text-stone-500 font-bold px-1">
                {msg.category && msg.category !== 'general' && (
                  <span className="px-2 py-0.5 bg-stone-200/50 rounded-full flex items-center gap-0.5 border border-stone-200/30">
                    <Cpu size={10} />
                    <span>CHỦ ĐỀ: {msg.category.toUpperCase()}</span>
                  </span>
                )}
                {msg.source && (
                  <span className={`px-2 py-0.5 rounded-full flex items-center gap-0.5 border ${
                    msg.source === 'gemini_learned' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-stone-200/50 border-stone-200/30'
                  }`}>
                    <Brain size={10} />
                    <span>NGUỒN: {msg.source === 'gemini_learned' ? 'AI TỰ HỌC (GEMINI)' : 'CƠ SỞ TRI THỨC'}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="self-start flex gap-1 items-center px-4 py-3 bg-white border border-stone-100 rounded-2xl rounded-tl-none shadow-sm">
            <span className="w-1.5 h-1.5 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div className="px-6 py-2 flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s.text)}
              className="px-3.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-xs font-bold text-stone-700 rounded-full transition flex items-center gap-1"
            >
              <MessageSquare size={10} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Row */}
      {selectedImage && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-stone-200 shadow-sm flex-shrink-0">
            <img src={selectedImage.previewUrl} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-0.5 right-0.5 p-0.5 bg-stone-950/70 hover:bg-stone-950 text-white rounded-full transition"
            >
              <X size={8} />
            </button>
          </div>
          <span className="text-[10px] text-stone-500 font-medium truncate max-w-[220px]">
            Ảnh đã chọn để tìm sản phẩm
          </span>
        </div>
      )}

      {/* Input Box */}
      <div className="p-4 bg-white border-t border-stone-200 flex gap-2.5 items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="p-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-500 rounded-xl transition flex items-center justify-center shadow-xs"
          title="Tải ảnh lên để tìm sản phẩm"
          style={{ width: '38px', height: '38px' }}
        >
          <Image size={18} />
        </button>
        <input
          type="text"
          className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200/80 rounded-xl text-sm focus:outline-none focus:border-stone-900 focus:bg-white placeholder:text-stone-400"
          placeholder="Yêu cầu áo dài đỏ thêu hoa, tay lỡ..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
          style={{ height: '38px' }}
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || (!input.trim() && !selectedImage)}
          className="p-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl transition flex items-center justify-center shadow-sm"
          style={{ width: '38px', height: '38px' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
