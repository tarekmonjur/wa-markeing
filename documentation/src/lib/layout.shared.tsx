import { i18n } from '@/lib/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const { provider: i18nProvider } = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  bn: {
    displayName: 'বাংলা',
    search: 'অনুসন্ধান করুন',
    searchNoResult: 'কোন রেজাল্ট পাওয়া যায়নি',
    toc: 'এই পৃষ্ঠায়',
    lastUpdate: 'সর্বশেষ আপডেট',
    previousPage: 'আগের পৃষ্ঠা',
    nextPage: 'পরের পৃষ্ঠা',
    chooseTheme: 'থিম নির্বাচন',
  },
});

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    nav: {
      title: locale === 'bn' ? 'WA মার্কেটিং ডকুমেন্টেশন' : 'WA Marketing Docs',
    },
    links: [
      {
        text: locale === 'bn' ? 'গাইড' : 'Guides',
        url: `/${locale}/docs`,
      },
    ],
  };
}
