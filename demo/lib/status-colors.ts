/**
 * The status colors a tool card, dot, chip, banner or label draws from the
 * theme's tokens. `color-mix()` over an undefined token drops the whole
 * declaration, so the washes below only ever reference `--success` /
 * `--error` / `--warning`; every palette defines them.
 *
 * This module names those three tokens and is the one home of their translucent
 * `color-mix()` shape: a border, a fill or a chip imports `statusWash()` /
 * `statusBorder()` (or the `STATUS_*_COLOR` names) rather than writing
 * `color-mix(in srgb, var(--error) …, transparent)` again. A single token in a
 * style — a text color, a `1px solid var(--error)` — is not that shape and is
 * spelled where the surface draws it, as is a mix of a token into a surface
 * (`var(--bg-panel)`, `var(--border)`).
 */

/** A passed state's color: a tool's name, a status dot or label. */
export const STATUS_SUCCESS_COLOR = "var(--success)";

/** A failed state's color, for a status dot or label. */
export const STATUS_ERROR_COLOR = "var(--error)";

/** A not-settled state's color: aborted runs, warnings, the unanswered chip. */
export const STATUS_WARNING_COLOR = "var(--warning)";

/** One of the three status colors above, and nothing else: what a wash takes. */
export type StatusColor = typeof STATUS_SUCCESS_COLOR | typeof STATUS_ERROR_COLOR | typeof STATUS_WARNING_COLOR;

/** A status word's color, from whether the thing it labels failed. */
export function statusTextColor(isError: boolean): StatusColor {
  return isError ? STATUS_ERROR_COLOR : STATUS_SUCCESS_COLOR;
}

/** A translucent wash of a status color: a banner's border or fill, a chip. */
export function statusWash(color: StatusColor, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** One status line of the given weight: `1px solid` plus a wash of the color. */
export function statusBorder(color: StatusColor, percent: number): string {
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
