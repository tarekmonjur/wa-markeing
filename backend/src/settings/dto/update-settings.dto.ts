import { IsString, IsNumber, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 9 })
  @IsNumber()
  @Min(0)
  @Max(23)
  sendWindowStart?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsNumber()
  @Min(0)
  @Max(23)
  sendWindowEnd?: number;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] })
  @IsArray()
  @IsNumber({}, { each: true })
  sendDaysOfWeek?: number[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  smartSendEnabled?: boolean;
}
