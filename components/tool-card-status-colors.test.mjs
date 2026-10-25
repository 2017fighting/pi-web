import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The tool cards draw their success/error chrome from these two tokens. Each
// theme has to carry both, or `color-mix()` over an undefined token drops the
// whole declaration and the card loses its border and background.
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Every theme block in the stylesheet, as `selector { body }` pairs. */
function themeBlocks() {
  const blocks = [];
  const re = /((?::root|html(?:\[data-theme="[^"]+"\]|\.dark)|\[data-theme="[^"]+"\])(?:\s*,\s*(?::root|html(?:\[data-theme="[^"]+"\]|\.dark)|\[data-theme="[^"]+"\]))*\s*)\{([^}]*)\}/g;
  for (const match of globals.matchAll(re)) blocks.push({ selector: match[1].trim(), body: match[2] });
  return blocks;
}

test("every theme carries the success and error status tokens", () => {
  // A palette block is one that sets the surface color; the `:root` and
  // `html.dark` blocks elsewhere in the sheet set one-off properties.
  const palettes = themeBlocks().filter(({ body }) => /--bg\s*:/.test(body));
  assert.ok(palettes.length >= 13, `expected every palette, found ${palettes.length}`);

  const missing = [];
  for (const { selector, body } of palettes) {
    for (const token of ["--success", "--error"]) {
      if (!new RegExp(`${token}\\s*:`).test(body)) missing.push(`${selector} → ${token}`);
    }
  }
  assert.deepEqual(missing, []);
});
