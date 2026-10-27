import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

// Ticket #10 swept the status-color literals out of the surfaces below,
// drawing `var(--error)` / `var(--success)` / `var(--warning)` (or a
// `color-mix()` over them) instead. The grep pins every one of them; the
// renders below pin what a reader sees on the surfaces a test can mount.
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
];

// The hexes ticket #10 bans, and the `rgba(...)` triplets they were written as.
const BANNED_LITERAL = /#(?:ef4444|f87171|dc2626|16a34a|d97706|fecaca|bbf7d0)\b|rgba\(\s*(?:239\s*,\s*68\s*,\s*68|34\s*,\s*197\s*,\s*94)/i;
// A swept surface draws a theme status token, directly or through the shared
// error-color helper.
const STATUS_TOKEN = /var\(--(?:error|success|warning)\)|STATUS_ERROR_COLOR/;

test("no swept surface keeps a status-color literal", () => {
  for (const file of SWEPT_SOURCES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const literal = source.match(BANNED_LITERAL);
    assert.equal(literal, null, `${file} still holds ${literal?.[0]}`);
    assert.match(source, STATUS_TOKEN, `${file} draws no status token`);
  }
});

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: { runtime: "automatic" } });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { ChatInput, ModelErrorBanner } = await jiti.import("./ChatInput.tsx");
const { TreeNode } = await jiti.import("./FileExplorer.tsx");
const { statusColor } = await jiti.import("./AgentSessionPanel.tsx");
const { mcpStatusDot } = await jiti.import("./mcp-config-helpers.ts");
const { translateMessage } = await jiti.import("@/lib/i18n/format.ts");
const { enLocale } = await jiti.import("@/lib/i18n/messages/en.ts");

function render(element) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null, element));
}

test("the composer's error chrome draws the error token", () => {
  const banner = render(React.createElement(ModelErrorBanner, { error: "models.json is unreadable" }));
  assert.match(banner, /var\(--error\)/);
  assert.doesNotMatch(banner, /rgba\(239,68,68|#ef4444/);

  const streaming = render(React.createElement(ChatInput, { onSend() {}, onAbort() {}, isStreaming: true }));
  assert.match(streaming, /var\(--error\)/);
  assert.doesNotMatch(streaming, /rgba\(239,68,68|#ef4444/);
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

test("the status helpers draw the theme's error and success tokens", () => {
  assert.equal(statusColor("failed"), "var(--error)");
  assert.equal(statusColor("completed"), "var(--success)");
  assert.equal(mcpStatusDot("error").color, "var(--error)");
  assert.equal(mcpStatusDot("warning").color, "var(--warning)");
});
