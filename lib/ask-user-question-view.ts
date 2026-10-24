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

export type AskUserQuestionOutcome =
  | { kind: "answered"; label: string }
  | { kind: "declined" }
  | { kind: "unanswered" };

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

/** What one answer reads as: the picked labels and the text typed alongside them. */
function answerLabel(answer: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (Array.isArray(answer.selected)) {
    for (const selected of answer.selected) {
      if (typeof selected === "string" && selected) parts.push(selected);
    }
  }
  if (typeof answer.answer === "string" && answer.answer) parts.push(answer.answer);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * What came back for the first question: the chosen option's label (or the
 * typed text, or the labels a multi-select picked), `declined` for a cancelled
 * call, and `unanswered` for a question left blank — and for a call with no
 * result at all.
 */
export function askUserQuestionOutcome(details: unknown): AskUserQuestionOutcome {
  if (!isRecord(details) || !Array.isArray(details.answers)) return { kind: "unanswered" };
  if (details.cancelled === true) return { kind: "declined" };

  const first = details.answers.find((answer) => isRecord(answer) && answer.questionIndex === 0);
  const label = first && isRecord(first) ? answerLabel(first) : null;
  return label === null ? { kind: "unanswered" } : { kind: "answered", label };
}

/**
 * The collapsed card's one line: the first question's header chip, how many
 * questions the call carried, and what came back. The run time is the card's
 * own slot, not this text's.
 */
export function askUserQuestionSummary(
  questions: readonly AskUserQuestionQuestion[],
  details: unknown,
  t: Translate,
): string {
  const count = questions.length === 1
    ? t("askUserQuestion.questionCountOne")
    : t("askUserQuestion.questionCount", { count: questions.length });
  const outcome = askUserQuestionOutcome(details);
  const answer = outcome.kind === "answered"
    ? outcome.label
    : t(outcome.kind === "declined" ? "askUserQuestion.declined" : "askUserQuestion.unanswered");
  return [questions[0]?.header, count, answer].filter((part) => part).join(" · ");
}
