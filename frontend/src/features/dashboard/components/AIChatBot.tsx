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

interface AIChatBotProps {
  onClose?: () => void;
}

export const AIChatBot: React.FC<AIChatBotProps> = ({ onClose }) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fafaf9', overflow: 'hidden' }}>
      {/* Bot Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
        color: '#ffffff', borderBottom: '1px solid #44403c', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '6px', background: '#8B5A2B', color: '#fff', borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.025em', color: '#fef3c7', margin: 0, lineHeight: 1.3 }}>
              Trợ Lý AI Áo Dài Cổ Phong
            </h4>
            <span style={{ fontSize: '10px', color: '#a8a29e', fontWeight: 500, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }}></span>
              <span>TRỰC TUYẾN • TỰ HỌC THÔNG MINH</span>
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ padding: '4px', color: '#a8a29e', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
            title="Đóng cửa sổ"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#44403c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a8a29e'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Message Area */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex', flexDirection: 'column', maxWidth: '85%',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                fontSize: '13px', lineHeight: '1.65',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                ...(msg.sender === 'user'
                  ? { background: '#1c1917', color: '#ffffff' }
                  : { background: '#ffffff', color: '#1c1917', border: '1px solid #e7e5e4' }
                ),
              }}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="User uploaded"
                  style={{ maxWidth: '100%', maxHeight: '192px', borderRadius: '8px', marginBottom: '8px', objectFit: 'cover', display: 'block' }}
                />
              )}
              {msg.text}
            </div>

            {/* Recommended Products UI */}
            {msg.sender === 'ai' && msg.recommended_products && msg.recommended_products.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', width: '100%', maxWidth: '320px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>
                  Mẫu sản phẩm gợi ý:
                </span>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {msg.recommended_products.map((prod: any) => (
                    <div
                      key={prod._id}
                      style={{
                        flexShrink: 0, width: '140px', background: '#fff', border: '1px solid #e7e5e4',
                        borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ height: '80px', background: '#f5f5f4', position: 'relative' }}>
                        <img
                          src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80'}
                          alt={prod.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                        <span style={{ position: 'absolute', bottom: '4px', right: '4px', padding: '2px 4px', background: 'rgba(0,0,0,0.6)', fontSize: '8px', color: '#fff', fontWeight: 700, borderRadius: '4px' }}>
                          {prod.basePrice?.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h5 style={{ fontFamily: 'var(--font-header)', fontSize: '11px', fontWeight: 700, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {prod.name}
                          </h5>
                          <p style={{ fontSize: '9px', color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>
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
                          style={{
                            marginTop: '6px', width: '100%', padding: '4px 0', background: '#1c1917', color: '#fff',
                            fontSize: '9px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                            textAlign: 'center', transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#a11e22'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#1c1917'; }}
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '10px', color: '#78716c', fontWeight: 700, padding: '0 4px' }}>
                {msg.category && msg.category !== 'general' && (
                  <span style={{ padding: '2px 8px', background: 'rgba(214,211,209,0.5)', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '2px', border: '1px solid rgba(214,211,209,0.3)' }}>
                    <Cpu size={10} />
                    <span>CHỦ ĐỀ: {msg.category.toUpperCase()}</span>
                  </span>
                )}
                {msg.source && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '2px',
                    ...(msg.source === 'gemini_learned'
                      ? { background: '#ecfdf5', color: '#15803d', border: '1px solid #d1fae5' }
                      : { background: 'rgba(214,211,209,0.5)', border: '1px solid rgba(214,211,209,0.3)' }
                    ),
                  }}>
                    <Brain size={10} />
                    <span>NGUỒN: {msg.source === 'gemini_learned' ? 'AI TỰ HỌC (GEMINI)' : 'CƠ SỞ TRI THỨC'}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{
            alignSelf: 'flex-start', display: 'flex', gap: '4px', alignItems: 'center',
            padding: '12px 16px', background: '#fff', border: '1px solid #f5f5f4',
            borderRadius: '4px 16px 16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <span className="animate-bounce" style={{ width: '6px', height: '6px', background: '#78716c', borderRadius: '50%', animationDelay: '0ms' }}></span>
            <span className="animate-bounce" style={{ width: '6px', height: '6px', background: '#78716c', borderRadius: '50%', animationDelay: '150ms' }}></span>
            <span className="animate-bounce" style={{ width: '6px', height: '6px', background: '#78716c', borderRadius: '50%', animationDelay: '300ms' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div style={{ padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s.text)}
              style={{
                padding: '6px 14px', background: '#ffffff', border: '1px solid #e7e5e4',
                fontSize: '12px', fontWeight: 700, color: '#44403c', borderRadius: '9999px',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              <MessageSquare size={10} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Row */}
      {selectedImage && (
        <div style={{ padding: '8px 16px', background: '#fafaf9', borderTop: '1px solid #e7e5e4', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e7e5e4', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
            <img src={selectedImage.previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                position: 'absolute', top: '2px', right: '2px', padding: '2px',
                background: 'rgba(12,10,9,0.7)', color: '#fff', border: 'none',
                borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s',
              }}
            >
              <X size={8} />
            </button>
          </div>
          <span style={{ fontSize: '10px', color: '#78716c', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
            Ảnh đã chọn để tìm sản phẩm
          </span>
        </div>
      )}

      {/* Input Box */}
      <div style={{ padding: '12px 16px', background: '#ffffff', borderTop: '1px solid #e7e5e4', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          style={{
            width: '38px', height: '38px', padding: '8px', background: '#fafaf9',
            border: '1px solid #e7e5e4', color: '#78716c', borderRadius: '12px',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Tải ảnh lên để tìm sản phẩm"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fafaf9'; }}
        >
          <Image size={18} />
        </button>
        <input
          type="text"
          placeholder="Yêu cầu áo dài đỏ thêu hoa, tay lỡ..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
          style={{
            flex: 1, height: '38px', padding: '0 16px', background: '#fafaf9',
            border: '1px solid rgba(231,229,228,0.8)', borderRadius: '12px',
            fontSize: '13px', color: '#1c1917', outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1c1917'; e.currentTarget.style.background = '#fff'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(231,229,228,0.8)'; e.currentTarget.style.background = '#fafaf9'; }}
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || (!input.trim() && !selectedImage)}
          style={{
            width: '38px', height: '38px', padding: '8px',
            background: (isLoading || (!input.trim() && !selectedImage)) ? '#d6d3d1' : '#1c1917',
            color: '#ffffff', borderRadius: '12px', border: 'none',
            cursor: (isLoading || (!input.trim() && !selectedImage)) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

