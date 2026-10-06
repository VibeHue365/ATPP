import React, { useState, useRef, useEffect } from 'react';
import { httpClient } from '../../../services/httpClient';
import { ArrowUp, Sparkles, Brain, Cpu, Image, X } from 'lucide-react';

interface RecommendedProduct {
  _id?: string;
  id?: string;
  name: string;
  basePrice?: number;
  materials?: string[];
  images?: string[];
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  image?: string;
  recommended_products?: RecommendedProduct[];
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
      text: 'Xin chào quý khách. Tôi là Stylist AI của TàGo, đồng hành tư vấn kiểu dáng, chất liệu lụa tơ tằm và phối áo dài tôn vóc dáng riêng biệt của bạn. Bạn đang chuẩn bị trang phục cho dịp nào ạ?',
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
          text: 'Rất tiếc, kết nối đến Stylist AI đang gián đoạn trong giây lát. Bạn vui lòng thử lại sau ít phút nhé! ✨',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    { label: 'Dáng cổ che khuyết điểm', text: 'Nên chọn dáng cổ áo dài nào để che khuyết điểm cổ ngắn hoặc đầy đặn?' },
    { label: 'Áo dài cách tân chụp ảnh', text: 'Tư vấn những mẫu áo dài cách tân trẻ trung, lên hình nổi bật nhất?' },
    { label: 'Chọn lụa tơ tằm', text: 'Chất liệu lụa tơ tằm cổ truyền có đặc điểm gì nổi bật khi may áo dài?' },
    { label: 'Chính sách thuê áo', text: 'Bảng giá và thời gian thuê áo dài tại TàGo như thế nào?' },
  ];

  const hasContentToSend = Boolean(input.trim() || selectedImage);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%)',
        fontFamily: 'var(--font-body, system-ui, -apple-system, sans-serif)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Minimalist Glassmorphism Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1C1917 0%, #3D3535 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} style={{ color: '#F6D285' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-header, "Playfair Display", serif)',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: '#1C1917',
                  letterSpacing: '-0.01em',
                }}
              >
                TàGo Stylist
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  background: 'rgba(181, 43, 71, 0.08)',
                  color: '#B52B47',
                  borderRadius: '999px',
                }}
              >
                AI
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                }}
              />
              <span style={{ fontSize: '11px', color: '#78716C', fontWeight: 500 }}>
                Cố vấn phong cách Di sản
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Đóng cửa sổ tư vấn"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              color: '#57534E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.color = '#1C1917';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = '#57534E';
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Conversation Thread */}
      <div
        style={{
          flex: 1,
          padding: '18px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: msg.sender === 'user' ? '82%' : '88%',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Sender Subtitle for AI */}
            {msg.sender === 'ai' && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#8B5A2B',
                  letterSpacing: '0.02em',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>TàGo Stylist</span>
              </span>
            )}

            {/* Bubble */}
            <div
              style={{
                padding: '13px 17px',
                borderRadius:
                  msg.sender === 'user'
                    ? '18px 18px 4px 18px'
                    : '4px 18px 18px 18px',
                fontSize: '13.5px',
                lineHeight: '1.65',
                wordBreak: 'break-word',
                ...(msg.sender === 'user'
                  ? {
                      background: 'linear-gradient(135deg, #2D1A1E 0%, #1C1917 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                    }
                  : {
                      background: '#FFFFFF',
                      color: '#262322',
                      border: '1px solid rgba(0, 0, 0, 0.06)',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                    }),
              }}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="Ảnh người dùng"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '170px',
                    borderRadius: '10px',
                    marginBottom: '8px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              )}
              {msg.text}
            </div>

            {/* Recommended Products Carousel Cards */}
            {msg.sender === 'ai' && msg.recommended_products && msg.recommended_products.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', width: '100%' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#B52B47',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Gợi ý trang phục phù hợp:
                </span>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {msg.recommended_products.map((prod, pIdx) => (
                    <div
                      key={prod._id || prod.id || pIdx}
                      style={{
                        flexShrink: 0,
                        width: '148px',
                        background: '#FFFFFF',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.04)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      <div style={{ height: '94px', background: '#F5F2EF', position: 'relative' }}>
                        <img
                          src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80'}
                          alt={prod.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '5px',
                            right: '5px',
                            padding: '2px 6px',
                            background: 'rgba(28, 25, 23, 0.85)',
                            backdropFilter: 'blur(4px)',
                            fontSize: '9.5px',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            borderRadius: '6px',
                          }}
                        >
                          {prod.basePrice ? `${prod.basePrice.toLocaleString('vi-VN')}đ` : 'Liên hệ'}
                        </span>
                      </div>
                      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h5
                            style={{
                              fontFamily: 'var(--font-header, serif)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1C1917',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              margin: 0,
                            }}
                          >
                            {prod.name}
                          </h5>
                          <p
                            style={{
                              fontSize: '10px',
                              color: '#78716C',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              margin: '2px 0 0',
                            }}
                          >
                            {prod.materials?.join(', ') || 'Lụa tơ tằm'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const el = document.getElementById('rentals');
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth' });
                            } else {
                              window.location.href = '/rentals';
                            }
                          }}
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            padding: '5px 0',
                            background: '#1C1917',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '7px',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#B52B47';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#1C1917';
                          }}
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart badges for AI answers */}
            {msg.sender === 'ai' && (msg.category || msg.source) && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', fontSize: '10px', color: '#78716C' }}>
                {msg.category && msg.category !== 'general' && (
                  <span
                    style={{
                      padding: '2px 7px',
                      background: 'rgba(0, 0, 0, 0.04)',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Cpu size={10} />
                    <span>{msg.category.toUpperCase()}</span>
                  </span>
                )}
                {msg.source && (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      background: msg.source === 'gemini_learned' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      color: msg.source === 'gemini_learned' ? '#065F46' : '#78716C',
                    }}
                  >
                    <Brain size={10} />
                    <span>{msg.source === 'gemini_learned' ? 'GEMINI' : 'TRI THỨC TAGO'}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              gap: '5px',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#FFFFFF',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              borderRadius: '4px 18px 18px 18px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                background: '#B52B47',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'bounce 1.4s infinite ease-in-out',
                animationDelay: '0ms',
              }}
            />
            <span
              style={{
                width: '6px',
                height: '6px',
                background: '#B52B47',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'bounce 1.4s infinite ease-in-out',
                animationDelay: '180ms',
              }}
            />
            <span
              style={{
                width: '6px',
                height: '6px',
                background: '#B52B47',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'bounce 1.4s infinite ease-in-out',
                animationDelay: '360ms',
              }}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts - Minimalist Floating Pills */}
      {messages.length === 1 && (
        <div
          style={{
            padding: '4px 18px 10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '7px',
          }}
        >
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s.text)}
              style={{
                padding: '6px 12px',
                background: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                fontSize: '11.5px',
                fontWeight: 500,
                color: '#44403C',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#B52B47';
                e.currentTarget.style.color = '#B52B47';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(181, 43, 71, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.color = '#44403C';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
              }}
            >
              <Sparkles size={11} style={{ color: '#B52B47', opacity: 0.7 }} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Tag */}
      {selectedImage && (
        <div
          style={{
            padding: '6px 18px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
            }}
          >
            <img src={selectedImage.previewUrl} alt="Đã chọn" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                padding: '2px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <X size={9} />
            </button>
          </div>
          <span style={{ fontSize: '11px', color: '#78716C', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Đã đính kèm ảnh để AI nhận diện
          </span>
        </div>
      )}

      {/* Modern Capsule Input Bar (Apple / Claude style) */}
      <div
        style={{
          padding: '10px 18px 16px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#F5F3EF',
            borderRadius: '24px',
            padding: '5px 6px 5px 14px',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <input
            type="text"
            placeholder="Hỏi về kiểu dáng hoặc gửi ảnh mẫu..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '34px',
              background: 'transparent',
              border: 'none',
              fontSize: '13px',
              color: '#1C1917',
              outline: 'none',
            }}
          />

          {/* Photo attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Đính kèm ảnh mẫu áo dài"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              color: selectedImage ? '#B52B47' : '#78716C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1C1917';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = selectedImage ? '#B52B47' : '#78716C';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Image size={17} />
          </button>

          {/* Modern Circular Send Button with Up Arrow */}
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !hasContentToSend}
            aria-label="Gửi tin nhắn"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: 'none',
              cursor: isLoading || !hasContentToSend ? 'not-allowed' : 'pointer',
              background: hasContentToSend
                ? 'linear-gradient(135deg, #1C1917 0%, #3D3535 100%)'
                : 'rgba(0, 0, 0, 0.08)',
              color: hasContentToSend ? '#FFFFFF' : '#A8A29E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: hasContentToSend ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (hasContentToSend) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #B52B47 0%, #941B35 100%)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasContentToSend) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1C1917 0%, #3D3535 100%)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatBot;
