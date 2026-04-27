import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications/preferences')
export class NotificationsController {
  constructor(
    private readonly prefsService: NotificationPreferencesService,
  ) {}

  @Get()
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.prefsService.getOrCreate(userId);
  }

  @Patch()
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.prefsService.update(userId, dto);
  }
}
