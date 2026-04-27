import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService, CreateWebhookDto, UpdateWebhookDto } from './webhooks.service';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  async create(@CurrentUser() user: User, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  async findAll(@CurrentUser() user: User) {
    return this.webhooksService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook endpoint details' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.webhooksService.remove(user.id, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get recent deliveries for an endpoint' })
  async getDeliveries(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.getDeliveries(user.id, id);
  }
}
