import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CloudinaryService } from './cloudinary.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService,
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(file);
    return { url: result.secure_url };
  }
}
