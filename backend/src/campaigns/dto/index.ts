import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Eid Offer 2025' })
  @IsString()
  name: string;

  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime for scheduling' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'IANA timezone, e.g. Asia/Dhaka' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime for rescheduling' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'IANA timezone' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class ScheduleCampaignDto {
  @ApiProperty({ description: 'ISO 8601 datetime for scheduling' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'IANA timezone, e.g. Asia/Dhaka' })
  @IsString()
  @IsOptional()
  timezone?: string;
}
