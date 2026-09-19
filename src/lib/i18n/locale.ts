export type Locale = "fr" | "en";
export type I18nPage = "cap" | "offre";

export function localeFromPath(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "fr";
}

export function pageHref(
  page: I18nPage,
  locale: Locale,
): "/cap" | "/offre" | "/en/cap" | "/en/offre" {
  if (page === "cap") return locale === "en" ? "/en/cap" : "/cap";
  return locale === "en" ? "/en/offre" : "/offre";
}
