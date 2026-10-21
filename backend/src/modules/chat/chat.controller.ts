import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { RateLimitService } from '../auth/services/rate-limit.service';
import { ChatService } from './chat.service';
import { CloudinaryService } from './cloudinary.service';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly rateLimitService: RateLimitService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('rooms')
  async getRooms(@CurrentUser() user: AuthUser) {
    return this.chatService.getRooms(user.sub);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const limitVal = limit ? parseInt(limit, 10) : 50;
    const skipVal = skip ? parseInt(skip, 10) : 0;
    return this.chatService.getMessages(
      roomId,
      user.sub,
      user.roles,
      limitVal,
      skipVal,
    );
  }

  @Post('rooms')
  async getOrCreateRoom(
    @CurrentUser() user: AuthUser,
    @Body('otherUserId') otherUserId: string,
  ) {
    return this.chatService.getOrCreateRoom(user.sub, otherUserId);
  }

  @Post('rooms/:roomId/messages')
  async createMessage(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body('messageText') messageText: string,
    @Body('attachments') attachments?: string[],
  ) {
    await this.rateLimitService.assertRateLimit(`chat_msg_${user.sub}`, 30, 60);
    const msg = await this.chatService.createMessage(
      roomId,
      user.sub,
      messageText,
      attachments || [],
    );
    if (this.chatGateway && this.chatGateway.server) {
      this.chatGateway.server.to(`room:${roomId}`).emit('new_message', msg);
    }
    return msg;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Chỉ cho phép ảnh JPG, PNG hoặc WEBP'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp tin cần tải lên');
    const result = await this.cloudinaryService.uploadImage(file);
    return { url: result.secure_url };
  }
}
