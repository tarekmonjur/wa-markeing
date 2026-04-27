import { BadRequestException } from '@nestjs/common';
import { VariableEngineService } from '../variable-engine.service';
import { PhoneNormalizerService } from '../../contacts/phone-normalizer.service';
import { Contact } from '../../contacts/entities/contact.entity';

describe('VariableEngineService', () => {
  let service: VariableEngineService;
  let mockContact: Contact;

  beforeEach(() => {
    const phoneNormalizer = new PhoneNormalizerService();
    service = new VariableEngineService(phoneNormalizer);

    mockContact = {
      id: 'c1',
      name: 'Farhan Ahmed',
      phone: '+8801712345001',
      email: 'farhan@test.com',
      customFields: { city: 'Dhaka', amount: '5000' },
    } as unknown as Contact;
  });

  it('should resolve {{name}}', () => {
    expect(service.resolve('Hello {{name}}!', mockContact)).toBe(
      'Hello Farhan Ahmed!',
    );
  });

  it('should resolve {{phone}} to local format', () => {
    const result = service.resolve('Call {{phone}}', mockContact);
    expect(result).not.toContain('{{phone}}');
    expect(result).toContain('Call ');
  });

  it('should resolve {{email}}', () => {
    expect(service.resolve('Email: {{email}}', mockContact)).toBe(
      'Email: farhan@test.com',
    );
  });

  it('should resolve {{custom.city}}', () => {
    expect(service.resolve('City: {{custom.city}}', mockContact)).toBe(
      'City: Dhaka',
    );
  });

  it('should resolve {{custom.amount}}', () => {
    expect(service.resolve('Tk.{{custom.amount}}', mockContact)).toBe(
      'Tk.5000',
    );
  });

  it('should resolve {{date}} and {{time}}', () => {
    const result = service.resolve('{{date}} at {{time}}', mockContact);
    expect(result).not.toContain('{{date}}');
    expect(result).not.toContain('{{time}}');
  });

  it('should return empty string for unknown variables', () => {
    expect(service.resolve('{{unknown}}', mockContact)).toBe('');
  });

  it('should return empty for missing custom field', () => {
    expect(service.resolve('{{custom.missing}}', mockContact)).toBe('');
  });

  it('should strip HTML tags', () => {
    expect(service.resolve('<b>Hello</b> {{name}}', mockContact)).toBe(
      'Hello Farhan Ahmed',
    );
  });

  it('should throw if body exceeds 4096 chars', () => {
    const longBody = 'a'.repeat(4097);
    expect(() => service.resolve(longBody, mockContact)).toThrow(
      BadRequestException,
    );
  });

  it('should extract unique variable names', () => {
    const vars = service.extractVariables(
      '{{name}} {{custom.city}} {{name}}',
    );
    expect(vars).toEqual(['name', 'custom.city']);
  });
});
