import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Farhan Ahmed' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'farhan@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: { city: 'Dhaka', business: 'Retailer' } })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Farhan Ahmed' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'farhan@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  optedOut?: boolean;
}

export class CreateGroupDto {
  @ApiProperty({ example: 'VIP Buyers' })
  @IsString()
  name: string;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Premium Buyers' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class AddContactsToGroupDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  contactIds: string[];
}

export class RemoveContactsFromGroupDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  contactIds: string[];
}
