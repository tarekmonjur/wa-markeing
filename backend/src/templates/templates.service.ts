import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { VariableEngineService } from './variable-engine.service';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly variableEngine: VariableEngineService,
  ) {}

  async create(userId: string, dto: CreateTemplateDto): Promise<Template> {
    const template = this.templateRepository.create({
      userId,
      ...dto,
    });
    const saved = await this.templateRepository.save(template);
    this.logger.log(`Template created: ${saved.id} by user ${userId}`);
    return saved;
  }

  async findAll(userId: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(userId: string, id: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.findById(userId, id);
    Object.assign(template, dto);
    return this.templateRepository.save(template);
  }

  async remove(userId: string, id: string): Promise<void> {
    const template = await this.findById(userId, id);
    await this.templateRepository.softRemove(template);
  }

  async preview(
    userId: string,
    templateId: string,
    contactId: string,
  ): Promise<{ body: string; variables: string[] }> {
    const template = await this.findById(userId, templateId);
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, userId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const resolvedBody = this.variableEngine.resolve(template.body, contact);
    const variables = this.variableEngine.extractVariables(template.body);

    return { body: resolvedBody, variables };
  }
}
