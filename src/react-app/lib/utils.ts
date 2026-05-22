// Utility functions for the frontend

/**
 * Formats a number as currency based on the language
 * pt-BR: R$ 10,00 | en-US: $ 10.00
 */
export function formatCurrency(value: number | null | undefined, language: string = 'pt-BR'): string {
  if (value === null || value === undefined) {
    return language === 'en-US' ? '$ 0.00' : 'R$ 0,00';
  }
  
  if (language === 'en-US') {
    return `$ ${value.toFixed(2)}`;
  }
  
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Returns just the currency symbol based on language
 * pt-BR: R$ | en-US: $
 */
export function getCurrencySymbol(language: string = 'pt-BR'): string {
  return language === 'en-US' ? '$' : 'R$';
}

/**
 * Converts a string to Proper Case (first letter of each word capitalized)
 * Handles names like "JOÃO SILVA" or "joão silva" -> "João Silva"
 */
export function toProperCase(str: string | null | undefined): string {
  if (!str) return "";
  
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
