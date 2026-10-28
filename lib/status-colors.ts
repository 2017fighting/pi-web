/**
 * The status colors a tool card, dot, chip or label draws from the theme's
 * tokens. `color-mix()` over an undefined token drops the whole declaration, so
 * the borders below only ever reference `--success` / `--error`; every palette
 * defines them.
 *
 * This is the one home of those three token names, so a surface that needs a
 * bare status color imports it here rather than spelling `var(--error)` again.
 */

/** A passed state's color: a tool's name, a status dot or label. */
export const STATUS_SUCCESS_COLOR = "var(--success)";

/** A failed state's color, for a status dot or label. */
export const STATUS_ERROR_COLOR = "var(--error)";

/** A not-settled state's color: aborted runs, warnings, the unanswered chip. */
export const STATUS_WARNING_COLOR = "var(--warning)";

/** A status word's color, from whether the thing it labels failed. */
export function statusTextColor(isError: boolean): string {
  return isError ? STATUS_ERROR_COLOR : STATUS_SUCCESS_COLOR;
}

/** One status line: the token, and how much of it the border carries. */
function statusBorderLine(token: "--success" | "--error", percent: number): string {
  return `1px solid color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

/** The card's outer edge: the strongest status line. */
export function statusCardBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 45 : 25);
}

/** The card's fill, a faint wash of the same token its border carries. */
export function statusCardBackground(isError: boolean): string {
  return isError
    ? "color-mix(in srgb, var(--error) 5%, transparent)"
    : "color-mix(in srgb, var(--success) 4%, transparent)";
}

/** An inner separator between the card's header, body and result. */
export function statusSeparatorBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 25 : 20);
}

/** The line above a tool card's paired result. */
export function statusResultBorder(isError: boolean): string {
  return statusBorderLine(isError ? "--error" : "--success", isError ? 30 : 15);
}
