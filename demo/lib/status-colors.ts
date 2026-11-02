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
 *
 * Two surfaces repeat their whole status chrome, so each has its builder here.
 * A diff row draws the same fill and marker colour in the chat's split and
 * one-column patches and in the file viewer's diff, so `diffRowChrome()` names
 * that pair once instead of each view mixing the wash at its own weight; its
 * unchanged row's marker colour is `var(--text-dim)`, a single token, but it is
 * the same single token in all three views and stays here with its wash.
 *
 * The file viewer's five headers draw the same live indicator, so
 * `liveDotChrome()` holds its caption colour, dot fill and glow. The rest of the
 * indicator stays with each header, because the markup differs: the four
 * labelled headers wrap a `7px` circle and print `live` / `static` beside it,
 * while the diff header's dot takes its size from `.file-viewer-live-indicator`
 * and carries those words as an `aria-label` only.
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

/** The rows a diff view draws one at a time: a line a side added, removed, or neither. */
export type DiffRowKind = "added" | "removed" | "context";

/** An added, removed or unchanged diff row's chrome. */
export interface DiffRowChrome {
  /** The wash behind the line. */
  fill: string;
  /** The colour the line's `+` / `-` marker takes, and a changed line's own text
   * where a view colours the line whole. */
  prefixColor: string;
}

/**
 * A diff row's chrome: the same fill and marker colour in the chat's two patch
 * views and in the file viewer.
 */
export function diffRowChrome(kind: DiffRowKind): DiffRowChrome {
  switch (kind) {
    case "added":
      return { fill: statusWash(STATUS_SUCCESS_COLOR, 12), prefixColor: STATUS_SUCCESS_COLOR };
    case "removed":
      return { fill: statusWash(STATUS_ERROR_COLOR, 13), prefixColor: STATUS_ERROR_COLOR };
    case "context":
      return { fill: "transparent", prefixColor: "var(--text-dim)" };
  }
}

/** A live indicator's colours: its caption's, its dot's fill and its dot's glow. */
export interface LiveDotChrome {
  /** The colour of the caption beside the dot. */
  color: string;
  /** The dot's fill. */
  background: string;
  /** The glow a watching dot carries, and nothing while it does not watch. */
  boxShadow: string;
}

/**
 * The live indicator a file view's header draws: green while the view watches
 * the file, and a border-coloured dot with a dim caption once it does not. The
 * dot's size and shape, and the caption's text and layout, stay where each
 * header draws them.
 */
export function liveDotChrome(watching: boolean): LiveDotChrome {
  return watching
    ? { color: STATUS_SUCCESS_COLOR, background: STATUS_SUCCESS_COLOR, boxShadow: `0 0 4px ${STATUS_SUCCESS_COLOR}` }
    : { color: "var(--text-dim)", background: "var(--border)", boxShadow: "none" };
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
