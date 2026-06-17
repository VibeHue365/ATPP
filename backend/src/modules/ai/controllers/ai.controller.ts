import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AiService } from '../services/ai.service';
import type { ChatResponse } from '../services/ai.service';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message cannot be empty' })
  message: string;
}

export class ChatWithImageRequestDto {
  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsNotEmpty()
  image_base64: string;

  @IsString()
  @IsNotEmpty()
  mime_type: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponse> {
    return this.aiService.chat(dto.message);
  }

  @Post('chat/with-image')
  async chatWithImage(@Body() dto: ChatWithImageRequestDto): Promise<ChatResponse> {
    return this.aiService.chatWithImage(
      dto.message || '',
      dto.image_base64,
      dto.mime_type,
    );
  }
}
