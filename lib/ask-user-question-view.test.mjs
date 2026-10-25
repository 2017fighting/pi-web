import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const {
  ASK_USER_QUESTION_TOOL_NAME,
  askUserQuestionBlocks,
  askUserQuestionHidesResult,
  askUserQuestionState,
  askUserQuestionSummary,
  parseAskUserQuestion,
} = await jiti.import("./ask-user-question-view.ts");

/** Translate that echoes the key plus params, so assertions read as intent. */
const t = (key, params = {}) => (Object.keys(params).length ? `${key}:${JSON.stringify(params)}` : key);

const QUESTIONS = [
  {
    question: "Which auth method should the API use?",
    header: "Auth method",
    options: [
      { label: "OAuth", description: "Delegate to the provider." },
      { label: "API key", description: "Keep a shared secret." },
    ],
  },
  {
    question: "Where should sessions live?",
    header: "Storage",
    options: [{ label: "Disk" }, { label: "S3" }],
    multiSelect: true,
  },
];

function call(input, extra = {}) {
  return { toolName: ASK_USER_QUESTION_TOOL_NAME, input, ...extra };
}

function answer(overrides) {
  return { questionIndex: 0, question: QUESTIONS[0].question, kind: "option", answer: "OAuth", ...overrides };
}

test("recognizes the extension's call by its exact name and the shape of its questions", () => {
  const questions = parseAskUserQuestion(call({ questions: QUESTIONS }));
  assert.deepEqual(questions, [
    {
      question: "Which auth method should the API use?",
      header: "Auth method",
      options: [
        { label: "OAuth", description: "Delegate to the provider." },
        { label: "API key", description: "Keep a shared secret." },
      ],
      multiSelect: false,
    },
    {
      question: "Where should sessions live?",
      header: "Storage",
      options: [
        { label: "Disk", description: "" },
        { label: "S3", description: "" },
      ],
      multiSelect: true,
    },
  ]);
  // A header the call left out reads as no chip, not as a missing card; an option
  // with no description reads as an empty one.
  assert.deepEqual(parseAskUserQuestion(call({ questions: [{ question: "Which one?", options: [{ label: "A" }] }] })), [
    { question: "Which one?", header: "", options: [{ label: "A", description: "" }], multiSelect: false },
  ]);
});

test("keeps the generic card for another tool, whatever its arguments", () => {
  assert.equal(parseAskUserQuestion({ toolName: "ask_user", input: { questions: QUESTIONS } }), null);
  assert.equal(parseAskUserQuestion({ toolName: "mcp__ui__ask_user_question", input: { questions: QUESTIONS } }), null);
  assert.equal(parseAskUserQuestion({ toolName: "ASK_USER_QUESTION", input: { questions: QUESTIONS } }), null);
});

test("keeps the generic card for a call whose arguments are not a questions list", () => {
  for (const input of [
    undefined,
    null,
    "questions",
    {},
    { questions: "Which one?" },
    { questions: [] },
    { questions: [null] },
    { questions: [{ options: [{ label: "A" }] }] },
    { questions: [{ question: 42, options: [{ label: "A" }] }] },
    { questions: [{ question: "Which one?" }] },
    { questions: [{ question: "Which one?", options: "A" }] },
    { questions: [{ question: "Which one?", options: [{ description: "no label" }] }] },
    { questions: [{ question: "Which one?", options: [{ label: 1 }] }] },
    { questions: [{ question: "Which one?", options: [{ label: "A" }] }, "not a question"] },
  ]) {
    assert.equal(parseAskUserQuestion(call(input)), null, JSON.stringify(input));
  }
});

test("keeps the generic card while the arguments are still streaming", () => {
  const streamed = call({ questions: QUESTIONS }, { rawInput: '{"questions":[{"question":"Which auth' });
  assert.equal(parseAskUserQuestion(streamed), null);
});

test("says where a call stands from its result and whether its run is still live", () => {
  // A result that came back reads as answered or declined.
  assert.deepEqual(askUserQuestionState({ details: { answers: [answer({})], cancelled: false } }, false), { kind: "answered", label: "OAuth" });
  assert.deepEqual(askUserQuestionState({ details: { answers: [], cancelled: true } }, false), { kind: "declined" });
  // A dismissal reads as one whatever else the result carries, answers array included or not.
  assert.deepEqual(askUserQuestionState({ details: { cancelled: true } }, false), { kind: "declined" });
  // With no result yet, the run decides: waiting while it is live, unfinished once it has ended
  // without one — a finished message is not enough, since the tool starts after the message ends.
  assert.deepEqual(askUserQuestionState(undefined, true), { kind: "waiting" });
  assert.deepEqual(askUserQuestionState(undefined, false), { kind: "unfinished" });
  // A result with no cancellation and nothing for the first question is still an answer:
  // the card says so, and only the answer slot reads `unanswered`.
  assert.deepEqual(askUserQuestionState({ details: { answers: [], cancelled: false, unanswered: [0, 1] } }, false), { kind: "answered", label: null });
  assert.deepEqual(askUserQuestionState({ details: {} }, false), { kind: "answered", label: null });
  // An error is not a dismissal: the user never saw the questions, so the card
  // reads `unanswered` while the error's own text stays below it.
  assert.deepEqual(askUserQuestionState({ details: { answers: [], cancelled: true, error: "no_ui" } }, false), { kind: "answered", label: null });
});

test("reads the first question's answer as its kind says", () => {
  const label = (details) => askUserQuestionState({ details }, false).label;

  // A typed answer is the answer; a multi-select answer reads as the labels it picked,
  // with the text typed alongside them.
  assert.equal(label({ answers: [answer({ kind: "custom", answer: "Something else" })], cancelled: false }), "Something else");
  assert.equal(label({ answers: [answer({ kind: "multi", answer: null, selected: ["Tabs", "Spaces"] })], cancelled: false }), "Tabs, Spaces");
  assert.equal(label({ answers: [answer({ kind: "multi", answer: "and dots", selected: ["Tabs"] })], cancelled: false }), "Tabs, and dots");
  // The kind decides what counts: only a multi-select answer's `selected` is a label.
  assert.equal(label({ answers: [answer({ kind: "custom", answer: "and dots", selected: ["Tabs"] })], cancelled: false }), "and dots");
  // Only the first question's answer names the exchange; a later one does not stand in for it.
  assert.equal(label({ answers: [answer({ questionIndex: 1, answer: "S3" })], cancelled: false }), null);
});

test("hides the result envelope exactly when the card already carries the answers", () => {
  // The envelope's `"question"="answer"` pairs are the answer the card shows.
  assert.equal(askUserQuestionHidesResult({ details: { answers: [answer({})], cancelled: false } }), true);
  assert.equal(askUserQuestionHidesResult({ details: { answers: [], cancelled: true } }), true);
  // An error's text is the whole message, even though it carries an (empty) answers list.
  assert.equal(askUserQuestionHidesResult({ details: { answers: [], cancelled: true, error: "no_ui" } }), false);
  assert.equal(askUserQuestionHidesResult({ details: { answers: [answer({})], cancelled: false }, isError: true }), false);
  // A result with no answers list says something the card does not.
  assert.equal(askUserQuestionHidesResult({ details: { message: "UI not available" } }), false);
  assert.equal(askUserQuestionHidesResult(undefined), false);
});

test("summarizes an answered call with its first question's header, count and chosen label", () => {
  assert.equal(
    askUserQuestionSummary(QUESTIONS.slice(0, 1), { kind: "answered", label: "OAuth" }, t),
    "Auth method · askUserQuestion.questionCountOne · OAuth",
  );
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { kind: "answered", label: "OAuth" }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · OAuth',
  );
  // The first question's header and answer, not the last one's.
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { kind: "answered", label: null }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.unanswered',
  );
});

test("summarizes a declined call and one with no result yet", () => {
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { kind: "declined" }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.declined',
  );
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { kind: "waiting" }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.waiting',
  );
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { kind: "unfinished" }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.unfinished',
  );
});

test("summarizes a call that carried no header without a leading gap", () => {
  const questions = [{ question: "Which one?", header: "", options: [{ label: "A" }] }];
  assert.equal(askUserQuestionSummary(questions, { kind: "unfinished" }, t), "askUserQuestion.questionCountOne · askUserQuestion.unfinished");
});

test("pairs an option answer with exactly the label it names", () => {
  const [block] = askUserQuestionBlocks(QUESTIONS.slice(0, 1), {
    details: { answers: [answer({ kind: "option", answer: "OAuth" })], cancelled: false },
  });
  assert.deepEqual(block.selected, ["OAuth"]);
  assert.equal(block.custom, null);
  assert.equal(block.note, null);
  assert.equal(block.unanswered, false);
});

test("pairs a custom answer as text, with no option ticked", () => {
  const [block] = askUserQuestionBlocks(QUESTIONS.slice(0, 1), {
    details: { answers: [answer({ kind: "custom", answer: "Something else" })], cancelled: false },
  });
  assert.deepEqual(block.selected, []);
  assert.equal(block.custom, "Something else");
});

test("pairs a multi-select answer with every selected label and its typed text", () => {
  const selected = askUserQuestionBlocks(QUESTIONS, {
    details: { answers: [answer({ questionIndex: 1, kind: "multi", answer: null, selected: ["Disk", "S3"] })], cancelled: false },
  })[1];
  assert.deepEqual(selected.selected, ["Disk", "S3"]);
  assert.equal(selected.custom, null);

  // The text typed alongside the ticks is its own line, not another label.
  const withText = askUserQuestionBlocks(QUESTIONS, {
    details: { answers: [answer({ questionIndex: 1, kind: "multi", answer: "and dots", selected: ["Disk"] })], cancelled: false },
  })[1];
  assert.deepEqual(withText.selected, ["Disk"]);
  assert.equal(withText.custom, "and dots");
});

test("pairs a note attached to a question as its own line", () => {
  const [block] = askUserQuestionBlocks(QUESTIONS.slice(0, 1), {
    details: { answers: [answer({ kind: "option", answer: "OAuth", notes: "keep it simple" })], cancelled: false },
  });
  assert.equal(block.note, "keep it simple");
});

test("marks a question with no answer on a non-cancelled result as unanswered", () => {
  const blocks = askUserQuestionBlocks(QUESTIONS, {
    details: { answers: [answer({ kind: "option", answer: "OAuth" })], cancelled: false },
  });
  assert.equal(blocks[0].unanswered, false);
  assert.equal(blocks[1].unanswered, true);
  assert.deepEqual(blocks[1].selected, []);
  assert.equal(blocks[1].custom, null);
  assert.equal(blocks[1].note, null);
});

test("does not mark questions unanswered on a decline or with no result", () => {
  const declined = askUserQuestionBlocks(QUESTIONS, { details: { answers: [], cancelled: true } });
  assert.deepEqual(declined.map((block) => block.unanswered), [false, false]);
  const waiting = askUserQuestionBlocks(QUESTIONS, undefined);
  assert.deepEqual(waiting.map((block) => block.unanswered), [false, false]);
});

test("keeps each question beside the answer paired with it", () => {
  const parsed = parseAskUserQuestion(call({ questions: QUESTIONS }));
  const blocks = askUserQuestionBlocks(parsed, undefined);
  assert.deepEqual(blocks.map((block) => block.question.header), ["Auth method", "Storage"]);
  assert.equal(blocks[0].question.multiSelect, false);
  assert.equal(blocks[1].question.multiSelect, true);
});
