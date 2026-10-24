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

export const ASK_USER_QUESTION_TOOL_NAME = "ask_user_question";

export interface AskUserQuestionOption {
  /** The choice's display text, and what a result's answer names. */
  label: string;
}

export interface AskUserQuestionQuestion {
  /** The question as the model wrote it. */
  question: string;
  /** The short chip shown beside the question; empty when the call carried none. */
  header: string;
  options: AskUserQuestionOption[];
}

/** The i18n translate function shape this module needs. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

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
    options.push({ label: option.label });
  }
  return { question: value.question, header: typeof value.header === "string" ? value.header : "", options };
}

/**
 * The questions this tool call carried, or `null` when it is not a questionnaire
 * call: another name, arguments that are not a well-formed questions list, or
 * arguments still streaming in.
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
  return questions.length > 0 ? questions : null;
}

/** What one answer reads as: the labels a multi-select picked, and the text typed alongside them. */
function answerLabel(answer: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (answer.kind === "multi" && Array.isArray(answer.selected)) {
    for (const selected of answer.selected) {
      if (typeof selected === "string" && selected) parts.push(selected);
    }
  }
  if (typeof answer.answer === "string" && answer.answer) parts.push(answer.answer);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Where the call stands. A result that came back is `answered` — its `label` is
 * what the first question got, `null` when it was left blank — or `declined`
 * when it was cancelled. With no result, `isStreaming` decides between a message
 * still waiting on the user (`waiting`) and a finished one pi never paired a
 * result with (`unfinished`, i.e. the run was interrupted).
 */
export function askUserQuestionState(
  result: { details?: unknown } | undefined,
  isStreaming: boolean,
): AskUserQuestionState {
  if (!result) return isStreaming ? { kind: "waiting" } : { kind: "unfinished" };

  const details = result.details;
  // A dismissal is a dismissal whatever else the result carries.
  if (isRecord(details) && details.cancelled === true) return { kind: "declined" };

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
  if (!result || result.isError === true) return false;
  const details = result.details;
  // The extension answers a host that cannot render the questionnaire with
  // `answers: []` and an `error` ("UI not available", "this client cannot
  // render the questionnaire"): that text is the message, not a duplicate.
  if (!isRecord(details) || details.error !== undefined) return false;
  return Array.isArray(details.answers);
}

/** The key each settled-or-not state reads by, apart from `answered`'s own label. */
const STATE_KEY = {
  declined: "askUserQuestion.declined",
  waiting: "askUserQuestion.waiting",
  unfinished: "askUserQuestion.unfinished",
} as const;

/**
 * The collapsed card's one line: the first question's header chip, how many
 * questions the call carried, and where the call stands. The run time is the
 * card's own slot, not this text's.
 */
export function askUserQuestionSummary(
  questions: readonly AskUserQuestionQuestion[],
  state: AskUserQuestionState,
  t: Translate,
): string {
  const count = questions.length === 1
    ? t("askUserQuestion.questionCountOne")
    : t("askUserQuestion.questionCount", { count: questions.length });
  const answer = state.kind === "answered"
    ? state.label ?? t("askUserQuestion.unanswered")
    : t(STATE_KEY[state.kind]);
  return [questions[0]?.header, count, answer].filter((part) => part).join(" · ");
}
