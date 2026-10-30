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
