import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const {
  ASK_USER_QUESTION_TOOL_NAME,
  askUserQuestionOutcome,
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
      options: [{ label: "OAuth" }, { label: "API key" }],
    },
    {
      question: "Where should sessions live?",
      header: "Storage",
      options: [{ label: "Disk" }, { label: "S3" }],
    },
  ]);
  // A header the call left out reads as no chip, not as a missing card.
  assert.deepEqual(parseAskUserQuestion(call({ questions: [{ question: "Which one?", options: [{ label: "A" }] }] })), [
    { question: "Which one?", header: "", options: [{ label: "A" }] },
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

test("reads the outcome of the first question from the result's details", () => {
  assert.deepEqual(askUserQuestionOutcome({ answers: [answer({})], cancelled: false }), { kind: "answered", label: "OAuth" });
  assert.deepEqual(askUserQuestionOutcome({ answers: [], cancelled: true }), { kind: "declined" });
  assert.deepEqual(askUserQuestionOutcome(undefined), { kind: "unanswered" });
  assert.deepEqual(askUserQuestionOutcome({}), { kind: "unanswered" });
  assert.deepEqual(askUserQuestionOutcome({ answers: [], cancelled: false, unanswered: [0, 1] }), { kind: "unanswered" });

  // A typed answer is the answer; a multi-select answer reads as the labels it picked,
  // with the text typed alongside them.
  assert.deepEqual(askUserQuestionOutcome({ answers: [answer({ kind: "custom", answer: "Something else" })], cancelled: false }), {
    kind: "answered",
    label: "Something else",
  });
  assert.deepEqual(askUserQuestionOutcome({ answers: [answer({ kind: "multi", answer: null, selected: ["Tabs", "Spaces"] })], cancelled: false }), {
    kind: "answered",
    label: "Tabs, Spaces",
  });
  assert.deepEqual(askUserQuestionOutcome({ answers: [answer({ kind: "multi", answer: "and dots", selected: ["Tabs"] })], cancelled: false }), {
    kind: "answered",
    label: "Tabs, and dots",
  });

  // Only the first question's answer names the exchange; a later one does not stand in for it.
  assert.deepEqual(askUserQuestionOutcome({ answers: [answer({ questionIndex: 1, answer: "S3" })], cancelled: false }), { kind: "unanswered" });
});

test("summarizes an answered call with its first question's header, count and chosen label", () => {
  assert.equal(
    askUserQuestionSummary(QUESTIONS.slice(0, 1), { answers: [answer({})], cancelled: false }, t),
    "Auth method · askUserQuestion.questionCountOne · OAuth",
  );
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { answers: [answer({})], cancelled: false }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · OAuth',
  );
  // The first question's header and answer, not the last one's.
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { answers: [answer({ questionIndex: 1, answer: "S3" })], cancelled: false }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.unanswered',
  );
});

test("summarizes a declined call and one left unanswered", () => {
  assert.equal(
    askUserQuestionSummary(QUESTIONS, { answers: [], cancelled: true }, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.declined',
  );
  assert.equal(
    askUserQuestionSummary(QUESTIONS, undefined, t),
    'Auth method · askUserQuestion.questionCount:{"count":2} · askUserQuestion.unanswered',
  );
});

test("summarizes a call that carried no header without a leading gap", () => {
  const questions = [{ question: "Which one?", header: "", options: [{ label: "A" }] }];
  assert.equal(askUserQuestionSummary(questions, undefined, t), "askUserQuestion.questionCountOne · askUserQuestion.unanswered");
});
