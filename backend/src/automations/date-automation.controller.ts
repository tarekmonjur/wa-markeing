import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { DateAutomationService } from './date-automation.service';
import {
  CreateDateAutomationDto,
  UpdateDateAutomationDto,
} from './dto/date-automation.dto';

@ApiTags('Date Automations')
@ApiBearerAuth()
@Controller({ path: 'automations/date', version: '1' })
export class DateAutomationController {
  constructor(private readonly service: DateAutomationService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateDateAutomationDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDateAutomationDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.id, id);
  }
}
