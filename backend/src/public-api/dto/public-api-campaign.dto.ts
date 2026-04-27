import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicApiCampaignDto {
  @ApiProperty({ example: 'Spring Sale 2026' })
  @IsString()
  name: string;

  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiProperty()
  @IsUUID()
  groupId: string;

  @ApiPropertyOptional({ description: 'If true, start immediately after creation' })
  @IsOptional()
  autoStart?: boolean;
}
