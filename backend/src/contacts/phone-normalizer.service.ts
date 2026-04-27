import { Injectable, Logger } from '@nestjs/common';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

@Injectable()
export class PhoneNormalizerService {
  private readonly logger = new Logger(PhoneNormalizerService.name);
  private readonly DEFAULT_COUNTRY: CountryCode = 'BD';

  /**
   * Normalize phone to E.164 format. Returns null if invalid.
   * Strips non-digit chars, handles BD local format (01XXXXXXXXX).
   */
  normalize(rawPhone: string): string | null {
    // Strip all non-digit and non-plus characters
    const cleaned = rawPhone.replace(/[^\d+]/g, '');

    if (!cleaned) return null;

    // Try parsing with explicit BD country code
    const parsed = parsePhoneNumberFromString(cleaned, this.DEFAULT_COUNTRY);

    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }

    // Try with + prefix if not present
    if (!cleaned.startsWith('+')) {
      const withPlus = parsePhoneNumberFromString('+' + cleaned);
      if (withPlus && withPlus.isValid()) {
        return withPlus.format('E.164');
      }
    }

    this.logger.debug(`Invalid phone number: ${rawPhone}`);
    return null;
  }

  /**
   * Convert E.164 phone to WhatsApp JID format
   */
  toWhatsAppJid(e164Phone: string): string {
    const digits = e164Phone.replace('+', '');
    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Format E.164 to local display format
   */
  toLocalFormat(e164Phone: string): string {
    const parsed = parsePhoneNumberFromString(e164Phone);
    if (parsed) {
      return parsed.formatNational();
    }
    return e164Phone;
  }
}
