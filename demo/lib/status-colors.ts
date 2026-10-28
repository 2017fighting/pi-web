/**
 * The status colors a tool card, dot, chip or label draws from the theme's
 * tokens. `color-mix()` over an undefined token drops the whole declaration, so
 * the washes below only ever reference `--success` / `--error` / `--warning`;
 * every palette defines them.
 *
 * This is the one home of those three token names and of the translucent
 * `color-mix()` shape drawn from them, so a surface imports a color or a wash
 * here rather than spelling `var(--error)` or `color-mix(...)` again.
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

/** A translucent wash of a status color: a banner's border or fill, a chip. */
export function statusWash(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** One status line of the given weight: `1px solid` plus a wash of the color. */
export function statusBorder(color: string, percent: number): string {
  return `1px solid ${statusWash(color, percent)}`;
}

/** The card's outer edge: the strongest status line. */
export function statusCardBorder(isError: boolean): string {
  return statusBorder(statusTextColor(isError), isError ? 45 : 25);
}

/** The card's fill, a faint wash of the same color its border carries. */
export function statusCardBackground(isError: boolean): string {
  return statusWash(statusTextColor(isError), isError ? 5 : 4);
}

/** An inner separator between the card's header, body and result. */
export function statusSeparatorBorder(isError: boolean): string {
  return statusBorder(statusTextColor(isError), isError ? 25 : 20);
}

/** The line above a tool card's paired result. */
export function statusResultBorder(isError: boolean): string {
  return statusBorder(statusTextColor(isError), isError ? 30 : 15);
}
