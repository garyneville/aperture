import {
  HERO_CARD_HTML_TEMPLATE,
  MAIN_EMAIL_HTML_TEMPLATE,
  SECTION_TITLE_HTML_TEMPLATE,
  STANDARD_CARD_HTML_TEMPLATE,
} from './compiled-layout.generated.js';

function fillSlot(template: string, placeholder: string, value: string): string {
  return template.replace(placeholder, value);
}

export function renderMainEmailDocument(content: string): string {
  return fillSlot(MAIN_EMAIL_HTML_TEMPLATE, '__CONTENT__', content);
}

export function renderEmailCard(inner: string): string {
  return fillSlot(STANDARD_CARD_HTML_TEMPLATE, '__INNER__', inner);
}

export function renderEmailHeroCard(inner: string): string {
  return fillSlot(HERO_CARD_HTML_TEMPLATE, '__INNER__', inner);
}

export function renderEmailSectionTitle(titleHtml: string): string {
  return fillSlot(SECTION_TITLE_HTML_TEMPLATE, '__TITLE__', titleHtml);
}
