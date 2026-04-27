import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as Papa from 'papaparse';
import { Contact } from './entities/contact.entity';
import { ContactGroup } from './entities/contact-group.entity';
import { PhoneNormalizerService } from './phone-normalizer.service';
import {
  CreateContactDto,
  UpdateContactDto,
  CreateGroupDto,
  AddContactsToGroupDto,
} from './dto';

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(ContactGroup)
    private readonly groupRepository: Repository<ContactGroup>,
    private readonly phoneNormalizer: PhoneNormalizerService,
  ) {}

  async create(userId: string, dto: CreateContactDto): Promise<Contact> {
    const normalizedPhone = this.phoneNormalizer.normalize(dto.phone);
    if (!normalizedPhone) {
      throw new ConflictException(`Invalid phone number: ${dto.phone}`);
    }

    const existing = await this.contactRepository.findOne({
      where: { userId, phone: normalizedPhone },
    });

    if (existing) {
      // Upsert: update the existing contact
      Object.assign(existing, {
        name: dto.name ?? existing.name,
        email: dto.email ?? existing.email,
        customFields: { ...existing.customFields, ...dto.customFields },
      });
      return this.contactRepository.save(existing);
    }

    const contact = this.contactRepository.create({
      userId,
      phone: normalizedPhone,
      name: dto.name,
      email: dto.email,
      customFields: dto.customFields ?? {},
    });

    return this.contactRepository.save(contact);
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: Contact[]; total: number }> {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 50));
    const [data, total] = await this.contactRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });

    return { data, total };
  }

  async findById(userId: string, id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id, userId },
      relations: ['groups'],
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<Contact> {
    const contact = await this.findById(userId, id);

    if (dto.optedOut === true && !contact.optedOut) {
      contact.optedOut = true;
      contact.optedOutAt = new Date();
    } else if (dto.optedOut === false) {
      contact.optedOut = false;
      contact.optedOutAt = undefined;
    }

    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.customFields) {
      contact.customFields = { ...contact.customFields, ...dto.customFields };
    }

    return this.contactRepository.save(contact);
  }

  async remove(userId: string, id: string): Promise<void> {
    const contact = await this.findById(userId, id);
    await this.contactRepository.softRemove(contact);
  }

  async importFromCsv(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<ImportResult> {
    const csvString = fileBuffer.toString('utf-8');
    const { data: rows, errors: parseErrors } = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
    });

    if (parseErrors.length > 0) {
      this.logger.warn(`CSV parse errors: ${parseErrors.length}`);
    }

    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < rows.length; i += this.BATCH_SIZE) {
      const batch = (rows as Record<string, string>[]).slice(
        i,
        i + this.BATCH_SIZE,
      );
      await this.processCsvBatch(userId, batch, result, i);
    }

    this.logger.log(
      `CSV import for user ${userId}: imported=${result.imported}, updated=${result.updated}, skipped=${result.skipped}`,
    );

    return result;
  }

  private async processCsvBatch(
    userId: string,
    batch: Record<string, string>[],
    result: ImportResult,
    startIndex: number,
  ): Promise<void> {
    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowNum = startIndex + j + 2; // +2 for header + 1-based

      const rawPhone = row['phone'] || row['mobile'] || row['number'] || '';
      const normalizedPhone = this.phoneNormalizer.normalize(rawPhone);

      if (!normalizedPhone) {
        result.errors.push(`Row ${rowNum}: Invalid phone "${rawPhone}"`);
        result.skipped++;
        continue;
      }

      try {
        const existing = await this.contactRepository.findOne({
          where: { userId, phone: normalizedPhone },
        });

        // Build custom fields from extra columns
        const customFields: Record<string, unknown> = {};
        const knownColumns = new Set([
          'phone',
          'mobile',
          'number',
          'name',
          'email',
        ]);
        for (const [key, value] of Object.entries(row)) {
          if (!knownColumns.has(key) && value) {
            customFields[key] = value;
          }
        }

        if (existing) {
          existing.name = row['name'] || existing.name;
          existing.email = row['email'] || existing.email;
          existing.customFields = {
            ...existing.customFields,
            ...customFields,
          };
          await this.contactRepository.save(existing);
          result.updated++;
        } else {
          const contact = this.contactRepository.create({
            userId,
            phone: normalizedPhone,
            name: row['name'] || undefined,
            email: row['email'] || undefined,
            customFields,
          });
          await this.contactRepository.save(contact);
          result.imported++;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Row ${rowNum}: ${message}`);
        result.skipped++;
      }
    }
  }

  // ---- Groups ----

  async createGroup(userId: string, dto: CreateGroupDto): Promise<ContactGroup> {
    const group = this.groupRepository.create({
      userId,
      name: dto.name,
    });
    return this.groupRepository.save(group);
  }

  async findAllGroups(userId: string): Promise<ContactGroup[]> {
    return this.groupRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findGroupById(
    userId: string,
    groupId: string,
  ): Promise<ContactGroup> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, userId },
      relations: ['contacts'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async addContactsToGroup(
    userId: string,
    groupId: string,
    dto: AddContactsToGroupDto,
  ): Promise<ContactGroup> {
    const group = await this.findGroupById(userId, groupId);

    const contacts = await this.contactRepository.find({
      where: {
        id: In(dto.contactIds),
        userId,
      },
    });

    if (contacts.length === 0) {
      throw new NotFoundException('No valid contacts found');
    }

    // Merge new contacts with existing ones (avoid duplicates)
    const existingIds = new Set(group.contacts.map((c) => c.id));
    const newContacts = contacts.filter((c) => !existingIds.has(c.id));
    group.contacts = [...group.contacts, ...newContacts];

    return this.groupRepository.save(group);
  }

  async updateGroup(
    userId: string,
    groupId: string,
    dto: { name?: string },
  ): Promise<ContactGroup> {
    const group = await this.findGroupById(userId, groupId);
    if (dto.name !== undefined) group.name = dto.name;
    return this.groupRepository.save(group);
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.findGroupById(userId, groupId);
    group.contacts = [];
    await this.groupRepository.save(group);
    await this.groupRepository.remove(group);
  }

  async removeContactsFromGroup(
    userId: string,
    groupId: string,
    dto: { contactIds: string[] },
  ): Promise<ContactGroup> {
    const group = await this.findGroupById(userId, groupId);
    const removeSet = new Set(dto.contactIds);
    group.contacts = group.contacts.filter((c) => !removeSet.has(c.id));
    return this.groupRepository.save(group);
  }

  async getGroupContactsNotOptedOut(
    userId: string,
    groupId: string,
  ): Promise<Contact[]> {
    const group = await this.findGroupById(userId, groupId);
    return group.contacts.filter((c) => !c.optedOut);
  }
}
