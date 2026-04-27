import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WhatsApp Sessions')
@ApiBearerAuth()
@Controller('whatsapp/sessions')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new WhatsApp session' })
  create(@CurrentUser('id') userId: string) {
    return this.whatsappService.createSession(userId);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.whatsappService.deleteSession(userId, id);
  }
}
