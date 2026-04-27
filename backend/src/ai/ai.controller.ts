import {
  Controller,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GeneratePromptDto } from './prompt-builder.service';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { IsString, MaxLength } from 'class-validator';

export class GenerateCopyDto {
  @IsString()
  @MaxLength(500)
  businessName: string;

  @IsString()
  @MaxLength(500)
  product: string;

  @IsString()
  @MaxLength(500)
  goal: string;

  @IsString()
  @MaxLength(100)
  tone: string;
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate marketing copy using AI' })
  async generate(
    @CurrentUser() user: User,
    @Body() dto: GenerateCopyDto,
    @Query('provider') provider?: string,
  ) {
    return this.aiService.generateCopy(user.id, user.plan, dto as GeneratePromptDto, provider);
  }
}
