import { IsString, IsUUID, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDateAutomationDto {
  @ApiProperty({ example: 'uuid-session-id' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ example: 'uuid-template-id' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ example: 'birthday', description: 'Contact customField key holding a date' })
  @IsString()
  fieldName: string;

  @ApiPropertyOptional({ example: '09:00', description: 'HH:mm in user timezone' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'sendTime must be in HH:mm format' })
  sendTime?: string;
}

export class UpdateDateAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'sendTime must be in HH:mm format' })
  sendTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
