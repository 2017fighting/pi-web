import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

// Ticket #10 swept the status-color literals out of the surfaces below,
// drawing `var(--error)` / `var(--success)` / `var(--warning)` (or a
// `color-mix()` over them) instead; ticket #11 finished the sweep, and ticket
// #14 the surfaces those two did not list. Ticket #14 also pins the two
// non-status surfaces it swept: the terminal dot's `--terminal-warning` and the
// thinking glyph's `--thinking-*` pair. The grep pins every one of them; the
// renders below pin what a reader sees on the surfaces a test can mount.
//
// `demo/components/TerminalPanel.tsx` is not listed: its xterm `ITheme` needs
// concrete colors and belongs to the terminal's own light/dark choice, apart
// from the app theme (the app keeps the same palette in `lib/terminal-theme.ts`).
const SWEPT_SOURCES = [
  "components/ChatWindow.tsx",
  "components/AppShell.tsx",
  "components/ModelsConfig.tsx",
  "components/PluginsConfig.tsx",
  "components/SkillsConfig.tsx",
  "components/AgentsConfig.tsx",
  "components/FileExplorer.tsx",
  "components/ChatInput.tsx",
  "components/ProviderUsageSummary.tsx",
  "components/mcp-config-helpers.ts",
  "components/FileViewer.tsx",
  "components/AgentSessionPanel.tsx",
  "components/DirectoryPicker.tsx",
  "components/SubagentViewer.tsx",
  "demo/components/ChatWindow.tsx",
  "demo/components/AppShell.tsx",
  "demo/components/ModelsConfig.tsx",
  "demo/components/PluginsConfig.tsx",
  "demo/components/SkillsConfig.tsx",
  "demo/components/AgentsConfig.tsx",
  "demo/components/FileExplorer.tsx",
  "demo/components/ChatInput.tsx",
  "demo/components/ProviderUsageSummary.tsx",
  "demo/components/FileViewer.tsx",
  "demo/components/AgentSessionPanel.tsx",
  "demo/components/DirectoryPicker.tsx",
  "components/ProjectTrustDialog.tsx",
  "demo/components/ProjectTrustDialog.tsx",
  "demo/components/SessionSidebar.tsx",
];

// The status hexes the sweep bans, and the `rgba(...)` triplets they were
// written as. A surface draws a theme token instead of any of these. The last
// two triplets are the file viewer's diff fills, the greens and reds it drew by
// hand before they became the same washes the chat's diff rows use.
const BANNED_LITERAL = /#(?:ef4444|f87171|dc2626|16a34a|d97706|10b981|4ade80|22c55e|f59e0b|facc15|d4a017|fee2e2|dcfce7|fecaca|bbf7d0)\b|rgba\(\s*(?:239\s*,\s*68\s*,\s*68|34\s*,\s*197\s*,\s*94|74\s*,\s*222\s*,\s*128|250\s*,\s*204\s*,\s*21|0\s*,\s*200\s*,\s*80|240\s*,\s*60\s*,\s*60)/i;
// A swept surface draws a theme status token, directly or through the shared
// helpers in `lib/status-colors.ts` (`STATUS_*_COLOR`, the border builders). The trust dialog is the one exception: it keeps its layout
// in CSS, so its shield takes the token from the icon class' `color` (asserted
// in the render below) and the file itself draws none.
const STATUS_TOKEN = /var\(--(?:error|success|warning)\)|STATUS_(?:ERROR|SUCCESS|WARNING)_COLOR|status(?:Card|Separator|Result)Border|statusTextColor|statusCardBackground|statusWash|statusBorder/;
const CSS_COLORED_SOURCES = new Set(["components/ProjectTrustDialog.tsx"]);

test("no swept surface keeps a status-color literal", () => {
  for (const file of SWEPT_SOURCES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const literal = source.match(BANNED_LITERAL);
    assert.equal(literal, null, `${file} still holds ${literal?.[0]}`);
    if (!CSS_COLORED_SOURCES.has(file)) assert.match(source, STATUS_TOKEN, `${file} draws no status token`);
  }
});

// Ticket #11 brought the stylesheets into the sweep: the settings panel, the
// sidebar, the login page and the terminal status dot drew the same literals in
// CSS. A palette block defines the tokens themselves (`--success: #4ade80`), and
// the terminal's own `--terminal-*` tokens are concrete colors by design; only a
// *use* of a status literal is banned, so the definitions are dropped first.
const SWEPT_STYLESHEETS = [
  "app/settings.css",
  "app/sidebar.css",
  "app/sidebar-menu.css",
  "app/globals.css",
  "demo/app/settings.css",
  "demo/app/globals.css",
];

test("no swept stylesheet keeps a status-color literal", () => {
  for (const file of SWEPT_STYLESHEETS) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
      .replace(/--[\w-]+\s*:[^;]+;/g, "");
    const literal = source.match(BANNED_LITERAL);
    assert.equal(literal, null, `${file} still holds ${literal?.[0]}`);
  }
});

// Ticket #16: a translucent wash of a status token is spelled once, in
// `lib/status-colors.ts` (`statusWash()` / `statusBorder()`). A component that
// needs one calls it instead of writing the `color-mix()` out again, so no
// surface can drift to its own copy of the shape. The shape is spelled here
// because the banned string is what the pin is about.
const HAND_WRITTEN_WASH = /color-mix\(in srgb, (?:var\(--(?:success|error|warning)\)|\$\{STATUS_(?:SUCCESS|ERROR|WARNING)_COLOR\}) \d+%, transparent\)/;

// Both trees: the demo draws the same chrome from its own copy of the module.
test("no component spells the status wash by hand", () => {
  for (const root of ["components/", "demo/components/"]) {
    const dir = new URL(`../${root}`, import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(?:ts|tsx)$/.test(file));
    assert.ok(files.length >= 40, `expected the components, found ${files.length}`);
    for (const file of files) {
      const handWritten = readFileSync(new URL(file, dir), "utf8").match(HAND_WRITTEN_WASH);
      assert.equal(handWritten, null, `${root}${file} still spells ${handWritten?.[0]}`);
    }
  }
});

// Ticket #14 gave the thinking glyph its own token pair: its amber is not a
// status colour, and it is the same in either theme, so it is defined once on
// `:root` rather than per palette. Both copies draw it.
const THINKING_SOURCES = ["components/ThinkingIcon.tsx", "demo/components/ThinkingIcon.tsx"];

// The terminal's status dot reads its own `--terminal-*` family, which its
// light theme overrides apart from the app theme; `--terminal-warning` joins
// the success and error pair there. The demo's panel is always dark, so it
// defines the dark value only.
const TERMINAL_TOKEN_SOURCES = ["app/globals.css", "demo/app/globals.css"];

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: { runtime: "automatic" } });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { ChatInput, ModelErrorBanner, ModelScopeWarningBanner } = await jiti.import("./ChatInput.tsx");
const { ThinkingIcon } = await jiti.import("./ThinkingIcon.tsx");
const { TreeNode } = await jiti.import("./FileExplorer.tsx");
const { statusColor } = await jiti.import("./AgentSessionPanel.tsx");
const { ProjectTrustDialogView } = await jiti.import("./ProjectTrustDialog.tsx");
const { mcpStatusDot } = await jiti.import("./mcp-config-helpers.ts");
const { translateMessage } = await jiti.import("@/lib/i18n/format.ts");
const { enLocale } = await jiti.import("@/lib/i18n/messages/en.ts");
const settingsCss = readFileSync(new URL("../app/settings.css", import.meta.url), "utf8");

function render(element) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null, element));
}

test("the composer's error chrome draws the error token", () => {
  const banner = render(React.createElement(ModelErrorBanner, { error: "models.json is unreadable" }));
  assert.match(banner, /var\(--error\)/);
  assert.doesNotMatch(banner, /rgba\(239,68,68|#ef4444/);
  // One wash, two weights: the line carries 30% of the token, the fill 7%.
  assert.match(banner, /border:1px solid color-mix\(in srgb, var\(--error\) 30%, transparent\)/);
  assert.match(banner, /background:color-mix\(in srgb, var\(--error\) 7%, transparent\)/);

  const warning = render(React.createElement(ModelScopeWarningBanner, { warnings: ['No models match pattern "ghost-gateway/*"'] }));
  assert.match(warning, /border:1px solid color-mix\(in srgb, var\(--warning\) 30%, transparent\)/);
  assert.match(warning, /background:color-mix\(in srgb, var\(--warning\) 7%, transparent\)/);

  const streaming = render(React.createElement(ChatInput, { onSend() {}, onAbort() {}, isStreaming: true }));
  assert.match(streaming, /var\(--error\)/);
  assert.doesNotMatch(streaming, /rgba\(239,68,68|#ef4444/);
  // Stop's chrome stays a fainter error wash than the notices'.
  assert.match(streaming, /background:color-mix\(in srgb, var\(--error\) 8%, transparent\)/);
  assert.match(streaming, /border:1px solid color-mix\(in srgb, var\(--error\) 30%, transparent\)/);

  const compactFailed = render(React.createElement(ChatInput, {
    onSend() {},
    onAbort() {},
    onCompact() {},
    compactError: "Summarization failed: generation hit the token cap",
  }));
  assert.match(compactFailed, /background:color-mix\(in srgb, var\(--error\) 7%, transparent\)/);
  assert.match(compactFailed, /border:1px solid color-mix\(in srgb, var\(--error\) 30%, transparent\)/);
});

test("the file explorer draws a deleted file's badge from the error token", () => {
  const t = (key, params) => translateMessage("en", key, { en: enLocale.messages }, params);
  const node = { name: "gone.ts", fullPath: "/hub/gone.ts", isDir: false, size: 0 };
  const html = render(React.createElement(TreeNode, {
    node,
    depth: 0,
    cwd: "/hub",
    onOpenFile() {},
    expandedPaths: new Set(),
    onToggleExpanded() {},
    highlightedPaths: new Set(),
    gitStatusByPath: new Map([["/hub/gone.ts", { filePath: "/hub/gone.ts", status: "deleted", code: " D" }]]),
    changedDirectoryPaths: new Set(),
    t,
  }));
  assert.match(html, /var\(--error\)/);
  assert.doesNotMatch(html, /#f87171/);
});

test("the file explorer draws an added file's badge from the success token", () => {
  const t = (key, params) => translateMessage("en", key, { en: enLocale.messages }, params);
  const node = { name: "new.ts", fullPath: "/hub/new.ts", isDir: false, size: 0 };
  const html = render(React.createElement(TreeNode, {
    node,
    depth: 0,
    cwd: "/hub",
    onOpenFile() {},
    expandedPaths: new Set(),
    onToggleExpanded() {},
    highlightedPaths: new Set(),
    gitStatusByPath: new Map([["/hub/new.ts", { filePath: "/hub/new.ts", status: "added", code: "A " }]]),
    changedDirectoryPaths: new Set(),
    t,
  }));
  assert.match(html, /var\(--success\)/);
  assert.doesNotMatch(html, /#4ade80/);
});

test("the status helpers draw the theme's error and success tokens", () => {
  assert.equal(statusColor("failed"), "var(--error)");
  assert.equal(statusColor("completed"), "var(--success)");
  assert.equal(mcpStatusDot("error").color, "var(--error)");
  assert.equal(mcpStatusDot("warning").color, "var(--warning)");
});

test("the trust dialog's shield draws the warning token", () => {
  const listing = {
    state: "loaded",
    listing: {
      mcpFile: { scope: "project", path: "/hub/.pi/mcp.json", exists: true, problems: [] },
      mcpServers: [],
    },
    status: { requiresTrust: true, trusted: false, decision: null, inherited: false },
  };
  const html = render(React.createElement(ProjectTrustDialogView, {
    cwd: "/hub",
    busy: false,
    error: null,
    listing,
    onCancel() {},
    onConfirm() {},
  }));
  assert.doesNotMatch(html, /#f59e0b/);
  // The dialog keeps its layout in CSS (no inline styles), so the shield
  // inherits the icon class' color.
  assert.match(html, /stroke="currentColor"[^>]*class="project-trust-icon"/);
  const rule = settingsCss.slice(settingsCss.indexOf(".project-trust-icon {"));
  assert.match(rule.slice(0, rule.indexOf("}")), /color: var\(--warning\);/);
});

/** The body of the first rule whose selector starts with `selector`. */
function ruleBody(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} exists`);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

test("the thinking glyph draws its own amber tokens", () => {
  for (const file of THINKING_SOURCES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const literal = source.match(BANNED_LITERAL);
    assert.equal(literal, null, `${file} still holds ${literal?.[0]}`);
    assert.match(source, /var\(--thinking-(?:stroke|accent)\)/, `${file} draws no thinking token`);
  }
  const active = renderToStaticMarkup(React.createElement(ThinkingIcon, { active: true }));
  assert.match(active, /var\(--thinking-stroke\)/);
  assert.match(active, /var\(--thinking-accent\)/);
  assert.doesNotMatch(active, /#d4a017|rgba\(250,\s*204,\s*21/);
  const idle = renderToStaticMarkup(React.createElement(ThinkingIcon, { active: false }));
  assert.doesNotMatch(idle, /var\(--thinking-stroke\)/);
});

// The thinking glyph's amber is drawn from the palette's warning token, so it
// follows the theme without adding a colour; the pair sits on the root block
// every theme shares.
test("the thinking tokens draw from the palette's warning token, for every theme", () => {
  for (const file of ["app/globals.css", "demo/app/globals.css"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const root = ruleBody(source, ":root,\n[data-theme=\"light\"] {");
    assert.match(root, /--thinking-stroke: color-mix\(in srgb, var\(--warning\) [^;]+;/, `${file} defines the thinking stroke`);
    assert.match(root, /--thinking-accent: var\(--warning\);/, `${file} defines the thinking accent`);
  }
});

test("the terminal status dot draws the terminal's own warning token", () => {
  for (const file of TERMINAL_TOKEN_SOURCES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(ruleBody(source, ".terminal-status-dot {"), /background: var\(--terminal-warning\)/, `${file} reads the terminal warning`);
    // The panel defines the family its dot joins (the demo's panel is always dark).
    assert.match(ruleBody(source, ".terminal-panel {"), /--terminal-warning: #facc15;/, `${file} defines the dark warning`);
  }
  // The app's terminal has its own light choice, which overrides the family.
  const app = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(ruleBody(app, '.terminal-panel[data-terminal-theme="light"] {'), /--terminal-warning: #d97706;/);
});
