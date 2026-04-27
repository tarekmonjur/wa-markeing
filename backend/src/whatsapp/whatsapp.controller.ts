import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSessionDto, UpdateSessionDto } from './dto';

@ApiTags('WhatsApp Sessions')
@ApiBearerAuth()
@Controller('whatsapp/sessions')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new WhatsApp session with name and phone' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.whatsappService.createSession(userId, dto.displayName, dto.phoneNumber);
  }

  @Get()
  @ApiOperation({ summary: 'List all sessions' })
  findAll(@CurrentUser('id') userId: string) {
    return this.whatsappService.findAllSessions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session by ID' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.whatsappService.findSession(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session name/phone' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.whatsappService.updateSession(userId, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update session status (called after QR scan)' })
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string; phoneNumber?: string; displayName?: string },
  ) {
    return this.whatsappService.updateSessionStatusForUser(
      userId,
      id,
      body.status,
      body.phoneNumber,
      body.displayName,
    );
  }

  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Disconnect a session (keep record)' })
  disconnect(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.whatsappService.disconnectSession(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.whatsappService.deleteSession(userId, id);
  }
}
