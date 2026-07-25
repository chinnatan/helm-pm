import type { Locale } from "date-fns";
import { enUS, th } from "date-fns/locale";

const DATE_FNS_LOCALES: Record<string, Locale> = {
  th,
  en: enUS,
};

export function useDateLocale() {
  const { locale, localeProperties } = useI18n();

  const dateFnsLocale = computed(
    () => DATE_FNS_LOCALES[locale.value] ?? th,
  );

  const intlLocale = computed(
    () => localeProperties.value.language || "th-TH",
  );

  function toLocaleString(date: Date | string | number) {
    return new Date(date).toLocaleString(intlLocale.value);
  }

  return {
    dateFnsLocale,
    intlLocale,
    toLocaleString,
  };
}
