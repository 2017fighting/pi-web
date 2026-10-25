import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

// The tool cards draw their success/error chrome from these two tokens. Each
// theme has to carry both, or `color-mix()` over an undefined token drops the
// whole declaration and the card loses its border and background.
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: { runtime: "automatic" } });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { AskUserQuestionView } = await jiti.import("./AskUserQuestionView.tsx");

function render(element) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null, element));
}

const BLOCK = {
  question: {
    question: "Which part next?",
    header: "Focus",
    multiSelect: false,
    options: [
      { label: "Extension tools", description: "Tools a package adds.", preview: "" },
      { label: "Prompt templates", description: "Reusable prompts.", preview: "" },
    ],
  },
  selected: ["Extension tools"],
  custom: null,
  note: null,
  unanswered: false,
  preview: null,
};

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

test("the questionnaire card draws its status chrome from the theme tokens", () => {
  const ok = render(React.createElement(AskUserQuestionView, { blocks: [BLOCK], isError: false }));
  assert.match(ok, /var\(--success\)/);
  assert.doesNotMatch(ok, /rgba\(34,197,94/);
  assert.doesNotMatch(ok, /#16a34a/);

  const error = render(React.createElement(AskUserQuestionView, { blocks: [BLOCK], isError: true }));
  assert.match(error, /var\(--error\)/);
  assert.doesNotMatch(error, /rgba\(248,113,113/);
});
