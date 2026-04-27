import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { PhoneNormalizerService } from './phone-normalizer.service';
import { Contact } from './entities/contact.entity';
import { ContactGroup } from './entities/contact-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, ContactGroup])],
  controllers: [ContactsController],
  providers: [ContactsService, PhoneNormalizerService],
  exports: [ContactsService, PhoneNormalizerService],
})
export class ContactsModule {}
