/**
 * ============================================================================
 * SOCDOF - European / German Number & Currency Formatters (DIN 1333 / ISO)
 * ============================================================================
 *
 * Provides standardized number and currency formatting across the ERP system:
 * - Thousands separator: Period (.) -> e.g. 1.000.000
 * - Decimal / Cents separator: Comma (,) -> e.g. 10.010,00 €
 */

/**
 * Formats a number with European / German punctuation:
 * Thousands separator: Period (.)
 * Decimal separator: Comma (,)
 *
 * @param val The numeric value to format
 * @param minimumFractionDigits Minimum decimal places (default: 2)
 * @param maximumFractionDigits Maximum decimal places (default: 2)
 * @returns Formatted string, e.g. "1.000.000,00" or "10.010,50"
 */
export function formatNumberDE(
  val: number | null | undefined,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2
): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toLocaleString('de-DE', {
    minimumFractionDigits,
    maximumFractionDigits
  });
}

/**
 * Formats a currency amount with European / German punctuation and currency symbol.
 *
 * @param val The amount to format
 * @param currency Currency symbol, defaults to '€'
 * @param decimals Number of decimal places, defaults to 2
 * @returns Formatted currency string, e.g. "1.000.000,00 €" or "10.010,00 €"
 */
export function formatCurrencyDE(
  val: number | null | undefined,
  currency: string = '€',
  decimals: number = 2
): string {
  return `${formatNumberDE(val, decimals, decimals)} ${currency}`;
}

/**
 * Formats an integer or whole count with thousands separators (periods) without decimals.
 *
 * @param val The integer to format
 * @returns Formatted string, e.g. "1.000.000" or "10.010"
 */
export function formatIntegerDE(val: number | null | undefined): string {
  return formatNumberDE(val, 0, 0);
}
