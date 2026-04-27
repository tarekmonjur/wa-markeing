import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepCondition } from '../entities/drip-step.entity';

export class CreateDripStepDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  stepNumber: number;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiProperty({ description: 'Delay in hours after previous step' })
  @IsNumber()
  @Min(0)
  delayHours: number;

  @ApiPropertyOptional({ enum: StepCondition })
  @IsEnum(StepCondition)
  @IsOptional()
  condition?: StepCondition;
}

export class CreateDripSequenceDto {
  @ApiProperty({ example: 'New Customer Onboarding' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDripStepDto)
  @IsOptional()
  steps?: CreateDripStepDto[];
}

export class UpdateDripSequenceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class EnrollContactsDto {
  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];

  @ApiProperty()
  @IsUUID()
  sessionId: string;
}
