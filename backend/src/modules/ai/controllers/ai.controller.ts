import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { RateLimitService } from '../../auth/services/rate-limit.service';
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
  constructor(
    private readonly aiService: AiService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('chat')
  async chat(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResponse> {
    await this.rateLimitService.assertRateLimit(`ai_chat_${user.sub}`, 20, 60);
    return this.aiService.chat(dto.message);
  }

  @Post('chat/with-image')
  async chatWithImage(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatWithImageRequestDto,
  ): Promise<ChatResponse> {
    await this.rateLimitService.assertRateLimit(`ai_chat_img_${user.sub}`, 10, 60);
    return this.aiService.chatWithImage(
      dto.message || '',
      dto.image_base64,
      dto.mime_type,
    );
  }

  @Post('inspection/analyze-damage')
  async analyzeDamage(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ): Promise<any> {
    await this.rateLimitService.assertRateLimit(`ai_inspect_${user.sub}`, 10, 60);
    return this.aiService.analyzeDamage(body);
  }

  @Post('visual-search/context-recommend')
  async contextRecommend(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ): Promise<any> {
    await this.rateLimitService.assertRateLimit(`ai_visual_${user.sub}`, 20, 60);
    return this.aiService.contextRecommend(body);
  }

  @Post('visual-search/match')
  async visualMatch(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ): Promise<any> {
    await this.rateLimitService.assertRateLimit(`ai_match_${user.sub}`, 20, 60);
    return this.aiService.visualMatch(body);
  }

  @Post('culling/analyze-photos')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PROVIDER')
  async cullingAnalyze(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ): Promise<any> {
    await this.rateLimitService.assertRateLimit(`ai_culling_${user.sub}`, 10, 60);
    return this.aiService.cullingAnalyze(body);
  }

  @Post('anti-fraud/inspect-portfolio')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PROVIDER')
  async antiFraudInspect(
    @CurrentUser() user: AuthUser,
    @Body() body: { provider_id: string; photos: any[] },
  ): Promise<any> {
    await this.rateLimitService.assertRateLimit(`ai_antifraud_${user.sub}`, 10, 60);
    return this.aiService.antiFraudInspect(body.provider_id, body.photos || []);
  }
}

