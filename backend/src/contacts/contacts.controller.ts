import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import {
  CreateContactDto,
  UpdateContactDto,
  CreateGroupDto,
  UpdateGroupDto,
  AddContactsToGroupDto,
  RemoveContactsFromGroupDto,
} from './dto';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  async create(@CurrentUser() user: User, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contacts (paginated)' })
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contactsService.findAll(user.id, page, limit);
  }

  // ---- Groups (must be before :id routes) ----

  @Get('groups')
  @ApiOperation({ summary: 'List all contact groups' })
  async findAllGroups(@CurrentUser() user: User) {
    return this.contactsService.findAllGroups(user.id);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Get group with contacts' })
  async findGroup(
    @CurrentUser() user: User,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.contactsService.findGroupById(user.id, groupId);
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create a contact group' })
  async createGroup(@CurrentUser() user: User, @Body() dto: CreateGroupDto) {
    return this.contactsService.createGroup(user.id, dto);
  }

  @Patch('groups/:groupId')
  @ApiOperation({ summary: 'Update a contact group' })
  async updateGroup(
    @CurrentUser() user: User,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.contactsService.updateGroup(user.id, groupId, dto);
  }

  @Delete('groups/:groupId')
  @ApiOperation({ summary: 'Delete a contact group' })
  async deleteGroup(
    @CurrentUser() user: User,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    await this.contactsService.deleteGroup(user.id, groupId);
    return { message: 'Group deleted' };
  }

  @Post('groups/:groupId/contacts')
  @ApiOperation({ summary: 'Add contacts to a group' })
  async addContactsToGroup(
    @CurrentUser() user: User,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AddContactsToGroupDto,
  ) {
    return this.contactsService.addContactsToGroup(user.id, groupId, dto);
  }

  @Post('groups/:groupId/remove-contacts')
  @ApiOperation({ summary: 'Remove contacts from a group' })
  async removeContactsFromGroup(
    @CurrentUser() user: User,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: RemoveContactsFromGroupDto,
  ) {
    return this.contactsService.removeContactsFromGroup(user.id, groupId, dto);
  }

  // ---- Individual contact routes ----

  @Post('import')
  @ApiOperation({ summary: 'Import contacts from CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  )
  async importCsv(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contactsService.importFromCsv(user.id, file.buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a contact' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.contactsService.remove(user.id, id);
    return { message: 'Contact deleted' };
  }
}
