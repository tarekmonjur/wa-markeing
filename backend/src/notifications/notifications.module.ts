import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreference])],
  controllers: [NotificationsController],
  providers: [EmailService, NotificationPreferencesService],
  exports: [EmailService, NotificationPreferencesService],
})
export class NotificationsModule {}
