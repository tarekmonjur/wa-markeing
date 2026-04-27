import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType } from '../entities/auto-reply-rule.entity';

export class CreateAutoReplyRuleDto {
  @ApiProperty({ example: 'price' })
  @IsString()
  keyword: string;

  @ApiProperty({ enum: MatchType })
  @IsEnum(MatchType)
  matchType: MatchType;

  @ApiProperty({ example: 'Our prices start at 500 BDT' })
  @IsString()
  replyBody: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class UpdateAutoReplyRuleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ enum: MatchType })
  @IsEnum(MatchType)
  @IsOptional()
  matchType?: MatchType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  replyBody?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  priority?: number;
}
