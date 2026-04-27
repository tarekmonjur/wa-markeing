import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InboxService } from './inbox.service';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsString()
  body: string;
}

@ApiTags('Inbox')
@ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations (last message per contact)' })
  async listConversations(
    @CurrentUser() user: User,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.inboxService.listConversations(
      user.id,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get(':contactId')
  @ApiOperation({ summary: 'Get conversation thread with a contact' })
  async getThread(
    @CurrentUser() user: User,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.inboxService.getThread(
      user.id,
      contactId,
      cursor,
      limit ? Number(limit) : undefined,
    );
  }

  @Post(':contactId/send')
  @ApiOperation({ summary: 'Send a manual message to a contact' })
  async sendMessage(
    @CurrentUser() user: User,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.inboxService.sendMessage(
      user.id,
      contactId,
      dto.sessionId,
      dto.body,
    );
  }
}
