/**
 * Display helpers for the `ask_user_question` extension tool, whose calls carry
 * a questionnaire and whose results carry the answers.
 *
 * Recognition is an exact tool name plus a shape check, so a call from another
 * extension that happens to share the name — or one whose arguments are not a
 * questions list — keeps the generic tool card. Streamed arguments are
 * incomplete JSON and are never parsed into a card that would change shape on
 * every chunk.
 */
import type { Translate } from "@/lib/i18n/types";

export const ASK_USER_QUESTION_TOOL_NAME = "ask_user_question";

export interface AskUserQuestionOption {
  /** The choice's display text, and what a result's answer names. */
  label: string;
  /** What the choice means or trades off; empty when the call carried none. */
  description: string;
  /** Markdown the model offers for comparison — a mockup, snippet or config sample; empty when none. */
  preview: string;
}

export interface AskUserQuestionQuestion {
  /** The question as the model wrote it. */
  question: string;
  /** The short chip shown beside the question; empty when the call carried none. */
  header: string;
  options: AskUserQuestionOption[];
  /** Whether more than one option may be chosen. */
  multiSelect: boolean;
}

/**
 * Where an `ask_user_question` call stands: what came back, or — with no result
 * yet — whether the message is still waiting on the user or was interrupted
 * before pi wrote one.
 */
export type AskUserQuestionState =
  | { kind: "answered"; label: string | null }
  | { kind: "declined" }
  | { kind: "waiting" }
  | { kind: "unfinished" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionOf(value: unknown): AskUserQuestionQuestion | null {
  if (!isRecord(value) || typeof value.question !== "string" || !Array.isArray(value.options)) return null;
  const options: AskUserQuestionOption[] = [];
  for (const option of value.options) {
    if (!isRecord(option) || typeof option.label !== "string") return null;
    options.push({
      label: option.label,
      description: typeof option.description === "string" ? option.description : "",
      preview: typeof option.preview === "string" ? option.preview : "",
    });
  }
  return {
    question: value.question,
    header: typeof value.header === "string" ? value.header : "",
    options,
    multiSelect: value.multiSelect === true,
  };
}

/**
 * The questions this tool call carried, or `null` when it is not a questionnaire
 * call: another name, arguments that are not a well-formed questions list, or
 * arguments still streaming in. An empty list is well-formed — the extension's
 * `no_questions` failure — and reads as a card with no questions and its error
 * text below it, rather than as the generic view.
 */
export function parseAskUserQuestion(call: { toolName: string; input: unknown; rawInput?: string }): AskUserQuestionQuestion[] | null {
  if (call.toolName !== ASK_USER_QUESTION_TOOL_NAME) return null;
  if (call.rawInput !== undefined) return null;
  if (!isRecord(call.input) || !Array.isArray(call.input.questions)) return null;

  const questions: AskUserQuestionQuestion[] = [];
  for (const question of call.input.questions) {
    const parsed = questionOf(question);
    if (!parsed) return null;
    questions.push(parsed);
  }
  return questions;
}

/** What one answer reads as: the labels it picked, and the text typed alongside them. */
function readAnswer(answer: Record<string, unknown>): { labels: string[]; custom: string | null } {
  if (answer.kind === "multi") {
    const labels = Array.isArray(answer.selected)
      ? answer.selected.filter((label): label is string => typeof label === "string" && label.length > 0)
      : [];
    return { labels, custom: typeof answer.answer === "string" && answer.answer ? answer.answer : null };
  }
  if (answer.kind === "custom") {
    return { labels: [], custom: typeof answer.answer === "string" && answer.answer ? answer.answer : null };
  }
  if (answer.kind === "option" && typeof answer.answer === "string" && answer.answer) {
    return { labels: [answer.answer], custom: null };
  }
  return { labels: [], custom: null };
}

/** The picked labels and the text typed alongside them, as one line. */
function answerLabel(answer: Record<string, unknown>): string | null {
  const { labels, custom } = readAnswer(answer);
  const parts = [...labels];
  if (custom) parts.push(custom);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The extension's own `error` field, or null when the result carries none. A
 * nullish value is no error: only a value the extension wrote is one, and it
 * writes `cancelled: true` with no `error` for a user dismissal.
 */
function resultError(details: unknown): unknown {
  if (!isRecord(details)) return null;
  const error = details.error;
  return error === undefined || error === null ? null : error;
}

/**
 * Whether the result is a dismissal — the user closed the questionnaire without
 * answering. A cancelled result that carries an `error` is not one: a host that
 * cannot render the questionnaire answers with `cancelled` and an `error`, and
 * the user never saw the questions.
 */
function isDeclinedResult(details: unknown): boolean {
  return isRecord(details) && details.cancelled === true && resultError(details) === null;
}

/**
 * Whether the result is a failure rather than an answer: a tool call pi threw
 * (`isError`), or the extension's own `error` field, which it writes when it
 * never showed the questionnaire. Either way the answer slot reads `unanswered`
 * and the result's text is the whole message, so the card keeps it.
 */
function isErrorResult(result: { details?: unknown; isError?: boolean }): boolean {
  return result.isError === true || resultError(result.details) !== null;
}

/**
 * Where the call stands. A result that came back is `answered` — its `label` is
 * what the first question got, `null` when it was left blank or when the result
 * is an error — or `declined` when the user dismissed the questionnaire. With no
 * result, `isLive` decides between a call the run is still waiting on (`waiting`)
 * and one on a run that ended without pi writing a result (`unfinished`, i.e. the
 * run was interrupted).
 *
 * `isLive` is the run, not just the streaming message: the assistant message
 * that carries a questionnaire call ends (and its tool starts) before the answer
 * arrives, so a streaming-only flag would read `unfinished` throughout the wait.
 */
export function askUserQuestionState(
  result: { details?: unknown; isError?: boolean } | undefined,
  isLive: boolean,
): AskUserQuestionState {
  if (!result) return isLive ? { kind: "waiting" } : { kind: "unfinished" };

  const details = result.details;
  // A dismissal is a dismissal whatever else the result carries — but an error is
  // not one, and falls through to `answered` with no label, which reads
  // `unanswered` (`isDeclinedResult`).
  if (isDeclinedResult(details)) return { kind: "declined" };

  // An error's answer slot reads `unanswered`, whatever answers it carries: the
  // result is a failure, not what the user chose, and its text stays below the card.
  if (isErrorResult(result)) return { kind: "answered", label: null };

  const first = isRecord(details) && Array.isArray(details.answers)
    ? details.answers.find((answer) => isRecord(answer) && answer.questionIndex === 0)
    : undefined;
  return { kind: "answered", label: first && isRecord(first) ? answerLabel(first) : null };
}

/**
 * Whether the result's text is the answer the card already carries, so the card
 * drops it: the envelope's `"question"="answer"` pairs are exactly what the
 * summary shows. An error's text is the whole message and a result with no
 * answers list says something the card does not, so both keep theirs.
 */
export function askUserQuestionHidesResult(result: { details?: unknown; isError?: boolean } | undefined): boolean {
  if (!result || isErrorResult(result)) return false;
  // The extension answers a host that cannot render the questionnaire with
  // `answers: []` and an `error` ("UI not available", "this client cannot
  // render the questionnaire"): that text is the message, not a duplicate.
  return isRecord(result.details) && Array.isArray(result.details.answers);
}

/** The key each settled-or-not state reads by, apart from `answered`'s own label. */
const STATE_KEY = {
  declined: "askUserQuestion.declined",
  waiting: "askUserQuestion.waiting",
  unfinished: "askUserQuestion.unfinished",
} as const;

/**
 * The collapsed row's summary, split so the header can carry its own chip: the
 * view draws the header as a chip beside the card's name and the detail beside
 * it, the way the expanded body chips each question's header.
 */
export interface AskUserQuestionSummaryParts {
  /** The first question's header chip; empty when the call carried none. */
  header: string;
  /** How many questions the call carried, and where it stands. */
  detail: string;
}

/** The summary's two parts, for a view that draws the chip apart from the text. */
export function askUserQuestionSummaryParts(
  questions: readonly AskUserQuestionQuestion[],
  state: AskUserQuestionState,
  t: Translate,
): AskUserQuestionSummaryParts {
  const count = questions.length === 1
    ? t("askUserQuestion.questionCountOne")
    : t("askUserQuestion.questionCount", { count: questions.length });
  const answer = state.kind === "answered"
    ? state.label ?? t("askUserQuestion.unanswered")
    : t(STATE_KEY[state.kind]);
  return { header: questions[0]?.header ?? "", detail: [count, answer].filter((part) => part).join(" · ") };
}

/**
 * One question paired with what the result recorded for it, as the expanded
 * card draws it: the option labels to tick, the text typed in place of or
 * alongside them, the note, and whether the question was left blank.
 */
export interface AskUserQuestionBlock {
  question: AskUserQuestionQuestion;
  /** Labels to tick, in the question's own option order. */
  selected: string[];
  /** Text the user typed, shown on its own line; null when none. */
  custom: string | null;
  /** The note the user attached to this question; null when none. */
  note: string | null;
  /** A non-cancelled result came back with nothing for this question. */
  unanswered: boolean;
  /** The chosen single-select option's preview Markdown; null when the answer has none. */
  preview: string | null;
}

/**
 * The preview to show for one answer, when `label` names the single option the
 * answer picked. A preview belongs to a single-select choice, so a typed answer
 * and a multi-select pick show none, however their options read.
 */
function chosenPreview(label: string | undefined, question: AskUserQuestionQuestion): string | null {
  if (label === undefined) return null;
  const chosen = question.options.find((option) => option.label === label);
  return chosen?.preview || null;
}

/**
 * The questionnaire the expanded card draws: one block per question, each with
 * the labels to tick and the text and note to show. Answers are matched to
 * questions by `questionIndex`, and a question with no answer reads `unanswered`
 * unless the result is a dismissal, so a partial submit is legible while a
 * decline is not dressed up as one. An error's answers are not what the user
 * chose — the collapsed row reads its slot `unanswered` — so its questions read
 * the same way rather than ticking a label nobody was shown. A block also
 * carries the chosen option's preview, so the card can show the artifact that
 * option offered.
 */
export function askUserQuestionBlocks(
  questions: readonly AskUserQuestionQuestion[],
  result: { details?: unknown; isError?: boolean } | undefined,
): AskUserQuestionBlock[] {
  const details = result?.details;
  const answers = isRecord(details) && Array.isArray(details.answers) ? details.answers : [];
  // Any result that is not a dismissal is a submit, so its blank questions read
  // `unanswered` just as the collapsed row does; a dismissal leaves every question
  // unticked without calling it unanswered. The check is on the result, not on its
  // `details`: a thrown tool error carries no `details` record at all, and it is not
  // a dismissal either.
  const submitted = result !== undefined && !isDeclinedResult(details);
  const failed = result !== undefined && isErrorResult(result);
  return questions.map((question, index) => {
    const answer = failed ? undefined : answers.find((entry) => isRecord(entry) && entry.questionIndex === index);
    if (!isRecord(answer)) {
      return { question, selected: [], custom: null, note: null, unanswered: submitted, preview: null };
    }
    const { labels, custom } = readAnswer(answer);
    return {
      question,
      selected: labels,
      custom,
      note: typeof answer.notes === "string" && answer.notes ? answer.notes : null,
      unanswered: false,
      preview: chosenPreview(answer.kind === "option" ? labels[0] : undefined, question),
    };
  });
}

/**
 * The collapsed card's one line: the first question's header chip, how many
 * questions the call carried, and where the call stands. The run time is the
 * card's own slot, not this text's. The view draws the header apart through
 * `askUserQuestionSummaryParts()`; this is the same summary as one string.
 */
export function askUserQuestionSummary(
  questions: readonly AskUserQuestionQuestion[],
  state: AskUserQuestionState,
  t: Translate,
): string {
  const { header, detail } = askUserQuestionSummaryParts(questions, state, t);
  return [header, detail].filter((part) => part).join(" · ");
}
