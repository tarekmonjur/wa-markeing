import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaValidationService } from './media-validation.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaValidationService],
  exports: [MediaService],
})
export class MediaModule {}
