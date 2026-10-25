import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });

/** The questionnaire card's keys, which the demo's locale tables carry by hand. */
function cardKeys(messages) {
  return Object.keys(messages).filter((key) => key.startsWith("askUserQuestion.")).sort();
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
