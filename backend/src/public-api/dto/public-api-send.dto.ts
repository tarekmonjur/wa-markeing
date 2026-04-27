import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicApiSendDto {
  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Hello {{name}}!' })
  @IsString()
  body: string;

  @ApiProperty({ example: 'uuid-session-id' })
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaType?: string;
}
