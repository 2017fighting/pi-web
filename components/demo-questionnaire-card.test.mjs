import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: { runtime: "automatic" } });
// The demo is its own Next.js project, so its components render with the copy of
// React in `demo/node_modules`; rendering them with the root's copy would leave
// two React instances and `useState` undefined.
const demoRequire = createRequire(new URL("../demo/package.json", import.meta.url));

/** The questionnaire card's keys, which the demo's locale tables carry by hand. */
function cardKeys(messages) {
  return Object.keys(messages).filter((key) => key.startsWith("askUserQuestion.")).sort();
}

test("a tutorial session carries a questionnaire round whose answers the card shows", async () => {
  const { SESSION_SCRIPTS } = await jiti.import("../demo/mock/sessions/scripts.ts");
  const { parseAskUserQuestion, askUserQuestionBlocks } = await jiti.import("../lib/ask-user-question-view.ts");

  const calls = SESSION_SCRIPTS.flatMap((script) => script.steps
    .filter((step) => step.kind === "assistant")
    .flatMap((step) => step.rounds.flatMap((round) => round.tools ?? [])));
  const questionnaires = calls
    .map((tool) => ({ tool, questions: parseAskUserQuestion({ toolName: tool.name, input: tool.args }) }))
    .filter((call) => call.questions !== null);
  assert.equal(questionnaires.length, 1, "one tutorial round must ask a questionnaire");

  const [{ tool, questions }] = questionnaires;
  assert.ok(questions.length >= 2, "the round asks a couple of questions");
  const blocks = askUserQuestionBlocks(questions, { details: tool.details });
  assert.equal(blocks.length, questions.length, "the card pairs every question with its answer");
  assert.ok(blocks.every((block) => !block.unanswered), "the recorded result answers every question");
  assert.ok(blocks.some((block) => block.selected.length > 0), "the card ticks the recorded answers");
});

test("the demo's chat view draws the questionnaire card for an ask_user_question call", async () => {
  const React = demoRequire("react");
  const { renderToStaticMarkup } = demoRequire("react-dom/server");
  const { MessageView } = await jiti.import("../demo/components/MessageView.tsx");
  const { I18nProvider } = await jiti.import("../demo/hooks/useI18n.tsx");
  const { setToolCallExpanded, clearExpandedToolCalls } = await jiti.import("../demo/lib/tool-call-expansion.ts");

  const questions = [
    {
      question: "Which part should I go deeper on next?",
      header: "Focus",
      options: [
        { label: "Extension tools", description: "Tools a package adds, shown as a card like this one." },
        { label: "Prompt templates", description: "Reusable prompts you run with /name." },
      ],
    },
    {
      question: "What should I bring next time?",
      header: "Follow-up",
      options: [{ label: "A worked example" }, { label: "A checklist" }, { label: "Links to the docs" }],
      multiSelect: true,
    },
  ];
  const call = { type: "toolCall", toolCallId: "call-demo-questionnaire", toolName: "ask_user_question", input: { questions } };
  const result = {
    role: "toolResult",
    toolCallId: call.toolCallId,
    content: [{ type: "text", text: 'User has answered your questions: "Which part should I go deeper on next?"="Extension tools". You can now continue with the user\'s answers in mind.' }],
    details: {
      cancelled: false,
      answers: [
        { questionIndex: 0, question: "Which part should I go deeper on next?", kind: "option", answer: "Extension tools" },
        { questionIndex: 1, question: "What should I bring next time?", kind: "multi", selected: ["A worked example", "Links to the docs"], answer: "" },
      ],
    },
  };
  const render = (block, toolResults) => textOf(renderToStaticMarkup(
    React.createElement(I18nProvider, null, React.createElement(MessageView, {
      message: { role: "assistant", provider: "openai-codex", model: "gpt-5.5", content: [block] },
      toolResults,
    })),
  ));

  clearExpandedToolCalls();
  try {
    const results = new Map([[call.toolCallId, result]]);
    // Collapsed, the row reads as the exchange it was, not as its arguments.
    const collapsed = render(call, results);
    assert.match(collapsed, /ask_user_question/);
    assert.match(collapsed, /Focus · 2 questions · Extension tools/);
    assert.doesNotMatch(collapsed, /\[object Object\]/);
    assert.doesNotMatch(collapsed, /"questions"/);

    // Expanded, the card draws the questions with the recorded answers ticked.
    setToolCallExpanded(call.toolCallId, true);
    const expanded = render(call, results);
    assert.match(expanded, /Which part should I go deeper on next\?/);
    assert.match(expanded, /Extension tools/);
    assert.match(expanded, /A worked example/);
    assert.match(expanded, /multi-select/);
    // The envelope underneath says the same answer twice, so the card drops it.
    assert.doesNotMatch(expanded, /User has answered your questions/);

    // Another tool keeps the generic card.
    const read = { type: "toolCall", toolCallId: "call-demo-read", toolName: "read", input: { path: "README.md" } };
    const generic = render(read, new Map());
    assert.match(generic, /README\.md/);
    assert.doesNotMatch(generic, /multi-select/);
  } finally {
    clearExpandedToolCalls();
  }
});

/** The visible text of a rendered card, with the tags taken out. */
function textOf(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
}

test("the demo's locale tables carry the questionnaire card's keys, like the app's", async () => {
  const { enLocale } = await jiti.import("../demo/lib/i18n/messages/en.ts");
  const { zhCNLocale } = await jiti.import("../demo/lib/i18n/messages/zh-CN.ts");
  const { zhTWLocale } = await jiti.import("../demo/lib/i18n/messages/zh-TW.ts");
  const appEn = (await jiti.import("../lib/i18n/messages/en.ts")).enLocale;

  const expected = cardKeys(appEn.messages);
  assert.ok(expected.length > 0, "the app's English table must carry the card's keys");
  for (const [id, locale] of [["en", enLocale], ["zh-CN", zhCNLocale], ["zh-TW", zhTWLocale]]) {
    assert.deepEqual(cardKeys(locale.messages), expected, `${id} must carry the card's keys`);
  }
});
