import { Injectable, BadRequestException } from '@nestjs/common';
import { Contact } from '../contacts/entities/contact.entity';
import { PhoneNormalizerService } from '../contacts/phone-normalizer.service';

@Injectable()
export class VariableEngineService {
  private static readonly MAX_BODY_LENGTH = 4096;
  private static readonly VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
  private static readonly HTML_TAG_PATTERN = /<[^>]*>/g;

  constructor(private readonly phoneNormalizer: PhoneNormalizerService) {}

  /**
   * Resolve all {{variable}} placeholders in a template body
   * using the provided contact's data.
   */
  resolve(templateBody: string, contact: Contact): string {
    const sanitizedBody = this.stripHtml(templateBody);

    if (sanitizedBody.length > VariableEngineService.MAX_BODY_LENGTH) {
      throw new BadRequestException(
        `Template body exceeds ${VariableEngineService.MAX_BODY_LENGTH} characters`,
      );
    }

    return sanitizedBody.replace(
      VariableEngineService.VARIABLE_PATTERN,
      (_match, variableName: string) => {
        const trimmed = variableName.trim();
        return this.resolveVariable(trimmed, contact);
      },
    );
  }

  /**
   * Extract all variable names from a template body
   */
  extractVariables(templateBody: string): string[] {
    const variables: string[] = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(VariableEngineService.VARIABLE_PATTERN);

    while ((match = pattern.exec(templateBody)) !== null) {
      variables.push(match[1].trim());
    }

    return [...new Set(variables)];
  }

  private resolveVariable(variableName: string, contact: Contact): string {
    switch (variableName) {
      case 'name':
        return contact.name ?? '';
      case 'phone':
        return this.phoneNormalizer.toLocalFormat(contact.phone);
      case 'email':
        return contact.email ?? '';
      case 'date':
        return new Date().toLocaleDateString('en-GB');
      case 'time':
        return new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
      default:
        // Handle custom.* fields
        if (variableName.startsWith('custom.')) {
          const fieldName = variableName.substring(7);
          const value = contact.customFields?.[fieldName];
          return value != null ? String(value) : '';
        }
        return '';
    }
  }

  private stripHtml(input: string): string {
    return input.replace(VariableEngineService.HTML_TAG_PATTERN, '');
  }
}
