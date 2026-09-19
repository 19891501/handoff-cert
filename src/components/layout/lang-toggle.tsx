import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { pageHref, type I18nPage, type Locale } from "@/lib/i18n/locale";

export function LangToggle({ page, locale }: { page: I18nPage; locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = "fr";
    };
  }, [locale]);

  return (
    <nav
      aria-label={locale === "en" ? "Language" : "Langue"}
      className="flex items-center"
    >
      <Link
        to={pageHref(page, "fr")}
        aria-current={locale === "fr" ? "page" : undefined}
        className={cn(
          "inline-flex h-11 items-center px-3 text-xs font-medium uppercase tracking-[0.18em] transition-colors duration-150",
          locale === "fr"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        FR
      </Link>
      <Link
        to={pageHref(page, "en")}
        aria-current={locale === "en" ? "page" : undefined}
        className={cn(
          "inline-flex h-11 items-center px-3 text-xs font-medium uppercase tracking-[0.18em] transition-colors duration-150",
          locale === "en"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        EN
      </Link>
    </nav>
  );
}
