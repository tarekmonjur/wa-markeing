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
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecurrenceDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  @IsIn(['daily', 'weekly', 'monthly'])
  type: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({ description: '0=Sun, 6=Sat (for weekly)', example: [1, 3, 5] })
  @IsArray()
  @IsOptional()
  daysOfWeek?: number[];

  @ApiPropertyOptional({ description: '1–28 (for monthly)', example: 15 })
  @IsNumber()
  @Min(1)
  @Max(28)
  @IsOptional()
  dayOfMonth?: number;

  @ApiPropertyOptional({ description: 'ISO date, optional end date' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

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

  @ApiPropertyOptional({ description: 'Recurring schedule pattern' })
  @ValidateNested()
  @Type(() => RecurrenceDto)
  @IsOptional()
  recurrence?: RecurrenceDto;
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
