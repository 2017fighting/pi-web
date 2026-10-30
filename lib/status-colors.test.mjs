import assert from "node:assert/strict";
import test from "node:test";

// Seam: `diffRowChrome(kind)` — the fill behind an added, removed or unchanged
// diff row and the colour its `+` / `-` marker draws, as the chat's patch views
// and the file viewer show them. It leaves out the row's border, its marker
// glyph, the hunk row (the accent's, not a status colour) and the split view's
// empty cell, which fills with the panel.
test("a diff row's fill and marker colour come from one place", async () => {
  const { diffRowChrome, statusWash, STATUS_SUCCESS_COLOR, STATUS_ERROR_COLOR } = await import("./status-colors.ts");

  assert.deepEqual(diffRowChrome("added"), {
    fill: statusWash(STATUS_SUCCESS_COLOR, 12),
    prefixColor: STATUS_SUCCESS_COLOR,
  });
  assert.deepEqual(diffRowChrome("removed"), {
    fill: statusWash(STATUS_ERROR_COLOR, 13),
    prefixColor: STATUS_ERROR_COLOR,
  });
  assert.deepEqual(diffRowChrome("context"), {
    fill: "transparent",
    prefixColor: "var(--text-dim)",
  });
});

// Seam: `liveDotChrome(watching)` — the caption's colour, the dot's fill and its
// glow in a file view's header while it watches the file and once it stops. It
// leaves out the dot's size and shape (inline in the four labelled headers, the
// `.file-viewer-live-indicator` class in the diff header), the caption's text
// and the header's layout.
test("a live indicator's colours come from one place", async () => {
  const { liveDotChrome, STATUS_SUCCESS_COLOR } = await import("./status-colors.ts");

  assert.deepEqual(liveDotChrome(true), {
    color: STATUS_SUCCESS_COLOR,
    background: STATUS_SUCCESS_COLOR,
    boxShadow: `0 0 4px ${STATUS_SUCCESS_COLOR}`,
  });
  assert.deepEqual(liveDotChrome(false), {
    color: "var(--text-dim)",
    background: "var(--border)",
    boxShadow: "none",
  });
});
