import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, PlanFeature } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@PlanFeature('canUseApi')
@Controller({ path: 'api-keys', version: '1' })
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.apiKeyService.findAllByUser(user.id);
  }

  @Patch(':id/revoke')
  revoke(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeyService.revoke(user.id, id);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeyService.delete(user.id, id);
  }
}
