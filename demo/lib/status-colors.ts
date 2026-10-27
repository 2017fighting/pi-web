/**
 * The status colors a tool card, dot or label draws from the theme's tokens.
 * `color-mix()` over an undefined token drops the whole declaration, so the
 * borders below only ever reference `--success` / `--error`; every palette
 * defines them.
 */

/** A failed state's color, for a status dot or label. */
export const STATUS_ERROR_COLOR = "var(--error)";

/** One status line: the token, and how much of it the border carries. */
function statusBorderLine(token: "--success" | "--error", percent: number): string {
  return `1px solid color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

/** The card's outer edge: the strongest status line. */
export function statusCardBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 45 : 25);
}

/** An inner separator between the card's header, body and result. */
export function statusSeparatorBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 25 : 20);
}

/** The line above a tool card's paired result. */
export function statusResultBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 30 : 15);
}
