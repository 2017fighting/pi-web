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
const { CodemodeCallList } = await jiti.import("./CodemodeToolView.tsx");
const { MessageView } = await jiti.import("./MessageView.tsx");
const { clearExpandedToolCalls, setToolCallExpanded } = await jiti.import("@/lib/tool-call-expansion");

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

test("the codemode call list draws its status chrome from the theme tokens", () => {
  const calls = [
    { id: "call-1", name: "read", args: "{}", status: "ok", durationMs: 4 },
    { id: "call-2", name: "bash", args: "{}", status: "error", durationMs: 4, error: "exit code 2" },
  ];
  const html = render(React.createElement(CodemodeCallList, { calls, omitted: 0, isError: false }));
  assert.match(html, /var\(--success\)/);
  assert.match(html, /var\(--error\)/);
  for (const literal of [/rgba\(34,197,94/, /rgba\(248,113,113/, /#16a34a/, /#f87171/]) {
    assert.doesNotMatch(html, literal);
  }
});

test("the generic tool card draws its status chrome from the theme tokens", (t) => {
  const call = { type: "toolCall", toolCallId: "call-status", toolName: "read", input: { path: "README.md" } };
  const message = { role: "assistant", provider: "anthropic", model: "claude-test", content: [call] };
  const result = (isError) => ({
    role: "toolResult",
    toolCallId: call.toolCallId,
    isError,
    content: [{ type: "text", text: isError ? "permission denied" : "hello" }],
  });
  setToolCallExpanded(call.toolCallId, true);
  t.after(() => clearExpandedToolCalls());

  const ok = render(React.createElement(MessageView, { message, toolResults: new Map([[call.toolCallId, result(false)]]) }));
  assert.match(ok, /var\(--success\)/);
  for (const literal of [/rgba\(34,197,94/, /#16a34a/, /#22c55e/]) assert.doesNotMatch(ok, literal);

  const error = render(React.createElement(MessageView, { message, toolResults: new Map([[call.toolCallId, result(true)]]) }));
  assert.match(error, /var\(--error\)/);
  for (const literal of [/rgba\(248,113,113/, /#f87171/]) assert.doesNotMatch(error, literal);
});
