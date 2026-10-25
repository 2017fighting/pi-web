/**
 * The top borders a tool card draws from the theme's status tokens. `color-mix()`
 * over an undefined token drops the whole declaration, so these only ever
 * reference `--success` / `--error`; every palette defines both.
 */

/** The card's outer edge: the strongest status line. */
export function statusCardBorder(isError: boolean): string {
  return isError
    ? "1px solid color-mix(in srgb, var(--error) 45%, transparent)"
    : "1px solid color-mix(in srgb, var(--success) 25%, transparent)";
}

/** An inner separator between the card's header, body and result. */
export function statusSeparatorBorder(isError: boolean): string {
  return isError
    ? "1px solid color-mix(in srgb, var(--error) 25%, transparent)"
    : "1px solid color-mix(in srgb, var(--success) 20%, transparent)";
}

/** The line above a tool card's paired result. */
export function statusResultBorder(isError: boolean): string {
  return isError
    ? "1px solid color-mix(in srgb, var(--error) 30%, transparent)"
    : "1px solid color-mix(in srgb, var(--success) 15%, transparent)";
}
