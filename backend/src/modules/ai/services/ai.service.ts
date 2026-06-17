import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatResponse {
  question: string;
  answer: string;
  found: boolean;
  matched_question?: string;
  category?: string;
  confidence: number;
  source: string;
  age_range_used?: string;
  gender_used?: string;
  recommended_products?: any[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://127.0.0.1:8000',
    );
  }

  async chat(message: string): Promise<ChatResponse> {
    try {
      const url = `${this.aiServiceUrl}/chat?message=${encodeURIComponent(message)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const data = (await response.json()) as {
        answer?: string;
        found?: boolean;
        matched_question?: string;
        category?: string;
        confidence?: number;
        source?: string;
        age_range_used?: string;
        gender_used?: string;
        recommended_products?: any[];
      };
      return {
        question: message,
        answer: data.answer || '',
        found: data.found ?? true,
        matched_question: data.matched_question || 'AI Assistant Match',
        category: data.category || 'general',
        confidence: data.confidence ?? 0.9,
        source: data.source || 'ai-service',
        age_range_used: data.age_range_used || 'age_unspecified',
        gender_used: data.gender_used || 'unknown',
        recommended_products: data.recommended_products || [],
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to connect to FastAPI AI service: ${(error as Error).message}. Using offline fallback.`,
      );
      return this.offlineFallback(message);
    }
  }

  async chatWithImage(
    message: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<ChatResponse> {
    try {
      const url = `${this.aiServiceUrl}/chat/with-image`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          image_base64: imageBase64,
          mime_type: mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const data = (await response.json()) as {
        answer?: string;
        source?: string;
        confidence?: number;
        recommended_products?: any[];
      };
      return {
        question: message,
        answer: data.answer || '',
        found: true,
        matched_question: 'Multimodal Image Query',
        category: 'image_analysis',
        confidence: data.confidence ?? 0.95,
        source: data.source || 'gemini_vision',
        age_range_used: 'age_unspecified',
        gender_used: 'unknown',
        recommended_products: data.recommended_products || [],
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to connect to FastAPI AI service for image chat: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private offlineFallback(message: string): ChatResponse {
    const normalized = message.toLowerCase();
    let answer =
      'Chào bạn! Mình có thể tư vấn cho bạn các thông tin chi tiết về kiểu dáng cổ áo, tay áo, tà áo và các chất liệu vải phù hợp cho tà Áo Dài truyền thống nhé. Bạn cần tư vấn chi tiết về phần nào ạ? 😊';
    let category = 'general';
    let matchedQuestion = 'Tư vấn chung';

    if (normalized.includes('cổ') || normalized.includes('co')) {
      answer =
        'Áo dài truyền thống thường có cổ cao từ 2-4 cm ôm sát cổ, tạo vẻ trang nghiêm. Ngoài ra, bạn có thể chọn cổ tròn trẻ trung, cổ chữ V quyến rũ hoặc cổ thuyền tôn lên bờ vai thanh mảnh nha!';
      category = 'collar';
      matchedQuestion = 'Tư vấn các dáng cổ áo dài';
    } else if (normalized.includes('tay') || normalized.includes('tay ao')) {
      answer =
        'Về phần tay áo, tay raglan truyền thống may chéo từ nách lên cổ giúp tà áo ôm khít đường cong. Ngoài ra tay lỡ hiện đại hoặc tay phồng duyên dáng cũng là những lựa chọn rất được ưa chuộng.';
      category = 'sleeve';
      matchedQuestion = 'Tư vấn kiểu tay áo dài';
    } else if (
      normalized.includes('vải') ||
      normalized.includes('vai') ||
      normalized.includes('chất liệu') ||
      normalized.includes('chat lieu')
    ) {
      answer =
        'Vải may áo dài vô cùng đa dạng: Lụa tơ tằm mềm mại bay bổng, Gấm dày dặn sang trọng họa tiết chìm tôn dáng, hoặc Linen mộc mạc thoáng mát rất hợp cho tiết trời mùa hè.';
      category = 'fabric';
      matchedQuestion = 'Tư vấn chất liệu vải áo dài';
    } else if (
      normalized.includes('giá') ||
      normalized.includes('gia') ||
      normalized.includes('tiền') ||
      normalized.includes('tien')
    ) {
      answer =
        'Mức giá thuê áo dài dao động từ 350.000đ đến 2.500.000đ tùy chất liệu và độ cầu kỳ của họa tiết thêu tay. Bạn có thể tham khảo trực tiếp trên trang chủ nha!';
      category = 'pricing';
      matchedQuestion = 'Tư vấn giá thuê áo dài';
    }

    return {
      question: message,
      answer,
      found: true,
      matched_question: matchedQuestion,
      category,
      confidence: 0.8,
      source: 'offline_fallback',
      age_range_used: 'age_unspecified',
      gender_used: 'unknown',
    };
  }
}
