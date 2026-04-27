import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ example: 'Rahim - Dhaka Fashion' })
  @IsString()
  displayName: string;

  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'Phone must be in E.164 format (e.g. +8801712345678)' })
  phoneNumber: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'Phone must be in E.164 format' })
  @IsOptional()
  phoneNumber?: string;
}
