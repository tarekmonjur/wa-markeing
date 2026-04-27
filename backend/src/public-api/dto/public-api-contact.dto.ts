import { IsString, IsOptional, IsObject, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicApiContactDto {
  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Rahim Ahmed' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'rahim@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: { birthday: '1990-05-15', company: 'ABC Corp' } })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
