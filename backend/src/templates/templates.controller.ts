import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, PreviewTemplateDto } from './dto';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a message template' })
  async create(@CurrentUser() user: User, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all templates' })
  async findAll(@CurrentUser() user: User) {
    return this.templatesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a template' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.templatesService.remove(user.id, id);
    return { message: 'Template deleted' };
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview template with a contact\'s data' })
  async preview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templatesService.preview(user.id, id, dto.contactId);
  }
}
