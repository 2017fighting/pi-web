import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

// The status surfaces draw their success/error/warning chrome from these
// tokens. Each theme has to carry all three, or `color-mix()` over an undefined
// token drops the whole declaration and the surface loses its chrome.
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const demoGlobals = readFileSync(new URL("../demo/app/globals.css", import.meta.url), "utf8");

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

/** Every theme block in a stylesheet, as `selector { body }` pairs. */
function themeBlocks(source) {
  const blocks = [];
  const re = /((?::root|html(?:\[data-theme="[^"]+"\]|\.dark)|\[data-theme="[^"]+"\])(?:\s*,\s*(?::root|html(?:\[data-theme="[^"]+"\]|\.dark)|\[data-theme="[^"]+"\]))*\s*)\{([^}]*)\}/g;
  for (const match of source.matchAll(re)) blocks.push({ selector: match[1].trim(), body: match[2] });
  return blocks;
}

/** The palette blocks of a stylesheet (those that set the surface color). */
function palettes(source) {
  return themeBlocks(source).filter(({ body }) => /--bg\s*:/.test(body));
}

function missingTokens(source) {
  const missing = [];
  for (const { selector, body } of palettes(source)) {
    for (const token of ["--success", "--error", "--warning"]) {
      if (!new RegExp(`${token}\\s*:`).test(body)) missing.push(`${selector} → ${token}`);
    }
  }
  return missing;
}

test("every theme carries the success, error and warning status tokens", () => {
  const appPalettes = palettes(globals);
  assert.ok(appPalettes.length >= 13, `expected every app palette, found ${appPalettes.length}`);
  assert.deepEqual(missingTokens(globals), []);

  // The demo is its own project with its own stylesheet, so its palettes need
  // the tokens copied too, or its tool cards lose their status chrome.
  assert.ok(palettes(demoGlobals).length >= 5, "expected the demo's palettes");
  assert.deepEqual(missingTokens(demoGlobals), []);
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

test("the unanswered chip and the running call draw the warning token", () => {
  const unanswered = render(React.createElement(AskUserQuestionView, { blocks: [{ ...BLOCK, unanswered: true }], isError: false }));
  assert.match(unanswered, /var\(--warning\)/);
  assert.doesNotMatch(unanswered, /#d97706/);

  const running = render(React.createElement(CodemodeCallList, {
    calls: [{ id: "call-1", name: "bash", args: "{}", status: "running" }],
    omitted: 0,
    isError: false,
  }));
  assert.match(running, /var\(--warning\)/);
  assert.doesNotMatch(running, /#d97706/);
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
