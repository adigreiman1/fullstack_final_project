import { cookies } from 'next/headers';
import { Language, isLanguage, DEFAULT_LANGUAGE, LANGUAGE_COOKIE } from './i18n';

export async function getLanguage(): Promise<Language> {
  const cookieStore = await cookies(); // כאן הוספנו await
  const lang = cookieStore.get(LANGUAGE_COOKIE)?.value;
  return isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}