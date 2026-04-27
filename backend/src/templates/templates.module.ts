import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { VariableEngineService } from './variable-engine.service';
import { Template } from './entities/template.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Template, Contact]),
    ContactsModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, VariableEngineService],
  exports: [TemplatesService, VariableEngineService],
})
export class TemplatesModule {}
