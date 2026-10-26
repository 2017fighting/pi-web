/**
 * The top borders a tool card draws from the theme's status tokens. `color-mix()`
 * over an undefined token drops the whole declaration, so these only ever
 * reference `--success` / `--error`; every palette defines both.
 */

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
