import { useTranslation } from "@/react-app/i18n";
import { translateError } from "@/react-app/lib/translateError";

/**
 * Hook to translate backend error messages
 * Usage:
 *   const { translateApiError } = useApiError();
 *   const displayError = translateApiError(error);
 */
export function useApiError() {
  const { t } = useTranslation();
  
  const translateApiError = (errorMessage: string | null): string | null => {
    if (!errorMessage) return null;
    return translateError(t, errorMessage);
  };
  
  return { translateApiError };
}
