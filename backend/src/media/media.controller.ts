import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import 'multer';
import { MediaService } from './media.service';
import { MediaValidationService } from './media-validation.service';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { Readable } from 'stream';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly validationService: MediaValidationService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a media file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  async upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate MIME from magic bytes
    const { mediaType, mimeType } = this.validationService.validateFile(
      file.buffer,
      file.mimetype,
      file.size,
    );

    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);
    const result = await this.mediaService.upload(
      stream,
      file.originalname,
      mimeType,
      file.size,
    );

    return {
      mediaId: result.key,
      url: result.url,
      type: mediaType,
      mimeType,
      size: file.size,
    };
  }
}
