import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Inject, forwardRef } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CloudinaryService } from './cloudinary.service';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('rooms')
  async getRooms(@CurrentUser() user: AuthUser) {
    return this.chatService.getRooms(user.sub);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const limitVal = limit ? parseInt(limit, 10) : 50;
    const skipVal = skip ? parseInt(skip, 10) : 0;
    return this.chatService.getMessages(roomId, limitVal, skipVal);
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
    const msg = await this.chatService.createMessage(roomId, user.sub, messageText, attachments || []);
    if (this.chatGateway && this.chatGateway.server) {
      this.chatGateway.server.to(`room:${roomId}`).emit('new_message', msg);
    }
    return msg;
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(file);
    return { url: result.secure_url };
  }
}
