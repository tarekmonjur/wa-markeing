import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  campaignCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sessionDisconnected?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tosBlockAlert?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  webhookAbandoned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dailySummary?: boolean;
}
