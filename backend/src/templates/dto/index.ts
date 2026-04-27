import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaType } from '../../database/enums';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Eid Special Offer' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'আস্সালামু আলাইকুম {{name}} ভাই! ঈদ উপলক্ষে ২০% ছাড়!',
  })
  @IsString()
  @MaxLength(4096)
  body: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: MediaType })
  @IsEnum(MediaType)
  @IsOptional()
  mediaType?: MediaType;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4096)
  @IsOptional()
  body?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: MediaType })
  @IsEnum(MediaType)
  @IsOptional()
  mediaType?: MediaType;
}

export class PreviewTemplateDto {
  @ApiProperty()
  @IsString()
  contactId: string;
}
