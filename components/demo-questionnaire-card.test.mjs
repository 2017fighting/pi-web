import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });

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
