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
import { AutoReplyService } from './auto-reply.service';
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from './dto';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Auto-Reply')
@ApiBearerAuth()
@Controller('auto-reply-rules')
export class AutoReplyController {
  constructor(private readonly autoReplyService: AutoReplyService) {}

  @Post()
  @ApiOperation({ summary: 'Create an auto-reply rule' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateAutoReplyRuleDto,
  ) {
    return this.autoReplyService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all auto-reply rules' })
  async findAll(@CurrentUser() user: User) {
    return this.autoReplyService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single auto-reply rule' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.autoReplyService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an auto-reply rule' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutoReplyRuleDto,
  ) {
    return this.autoReplyService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an auto-reply rule' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.autoReplyService.remove(user.id, id);
  }
}
