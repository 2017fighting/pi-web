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
 * The part of a tool result the card reads: whether pi flagged the call as
 * failed, and the `details` the extension wrote beside it. Every reader below
 * takes one, so the shape is named once instead of spelled in each signature.
 */
export interface AskUserQuestionResult {
  details?: unknown;
  isError?: boolean;
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

/**
 * One answer's choice: the option labels it picked and the text typed alongside
 * them. A label the question does not offer is not one of them: the extension only
 * ever answers with a label it offered, so an entry naming another one names a
 * choice nobody could have made, and every reader below drops it here.
 */
interface AnswerChoice {
  labels: string[];
  custom: string | null;
}

/**
 * The option a label names, or `undefined` when the question offers no such
 * choice. The one lookup both readers below take: the row's answer slot, the
 * body's ticks and the chosen option's preview all read a label through it, so
 * "the question offers this label" cannot be spelled two ways.
 */
function optionFor(question: AskUserQuestionQuestion | undefined, label: string): AskUserQuestionOption | undefined {
  return question?.options.find((option) => option.label === label);
}

/**
 * What one answer reads as, whatever its `kind`, in the shape every reader below
 * takes. `question` is the one the entry answers — the source of the labels it
 * could have named — and an entry read without one names no label at all.
 */
function readAnswer(answer: Record<string, unknown>, question: AskUserQuestionQuestion | undefined): AnswerChoice {
  const offered = (label: string) => optionFor(question, label) !== undefined;
  if (answer.kind === "multi") {
    const labels = Array.isArray(answer.selected)
      ? answer.selected.filter((label): label is string => typeof label === "string" && label.length > 0 && offered(label))
      : [];
    return { labels, custom: typeof answer.answer === "string" && answer.answer ? answer.answer : null };
  }
  if (answer.kind === "custom") {
    return { labels: [], custom: typeof answer.answer === "string" && answer.answer ? answer.answer : null };
  }
  if (answer.kind === "option" && typeof answer.answer === "string" && answer.answer) {
    return { labels: offered(answer.answer) ? [answer.answer] : [], custom: null };
  }
  return { labels: [], custom: null };
}

/**
 * Whether a choice names nothing: no label the question offers and no text typed.
 * This is the one definition of a blank answer, so the collapsed row's answer slot
 * and the expanded body's `unanswered` mark cannot disagree about the same entry.
 */
function isBlankChoice(choice: AnswerChoice): boolean {
  return choice.labels.length === 0 && choice.custom === null;
}

/** A choice as one line: its labels and the text typed with them, comma-separated. */
function answerLabel(choice: AnswerChoice): string | null {
  if (isBlankChoice(choice)) return null;
  const parts = [...choice.labels];
  if (choice.custom) parts.push(choice.custom);
  return parts.join(", ");
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
function isErrorResult(result: AskUserQuestionResult): boolean {
  return result.isError === true || resultError(result.details) !== null;
}

/**
 * Where the call stands. A result that came back is `answered` — its `label` is
 * what the first question got, `null` when it was left blank, named a choice the
 * question does not offer, or when the result is an error — or `declined` when the
 * user dismissed the questionnaire. With no result, `isLive` decides between a call
 * the run is still waiting on (`waiting`) and one on a run that ended without pi
 * writing a result (`unfinished`, i.e. the run was interrupted).
 *
 * `questions` is the questionnaire the call carried, so the answer slot reads what
 * the first question could have been answered with: a label no option offers names
 * nothing, exactly as the expanded body reads it.
 *
 * `isLive` is the run, not just the streaming message: the assistant message
 * that carries a questionnaire call ends (and its tool starts) before the answer
 * arrives, so a streaming-only flag would read `unfinished` throughout the wait.
 */
export function askUserQuestionState(
  questions: readonly AskUserQuestionQuestion[],
  result: AskUserQuestionResult | undefined,
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
  return { kind: "answered", label: first && isRecord(first) ? answerLabel(readAnswer(first, questions[0])) : null };
}

/**
 * Whether the questionnaire's result is a failure, so the card draws its error
 * chrome: pi flagged the call (`isError`), or the extension wrote its own `error`
 * — `no_ui`, `no_custom_ui` and the argument failures, which it raises before the
 * first question is shown. That text is the whole message, so the card keeps it.
 */
export function askUserQuestionFailed(result: AskUserQuestionResult | undefined): boolean {
  return result !== undefined && isErrorResult(result);
}

/**
 * Whether the result's text is the answer the card already carries, so the card
 * drops it: the envelope's `"question"="answer"` pairs are exactly what the
 * summary shows. An error's text is the whole message and a result with no
 * answers list says something the card does not, so both keep theirs.
 *
 * When an answer names an option label the question does not offer, the card
 * cannot show it (it drops the label and marks the question unanswered). The
 * envelope is kept in that case so the text the result carried is not lost
 * entirely.
 */
export function askUserQuestionHidesResult(
  questions: readonly AskUserQuestionQuestion[],
  result: AskUserQuestionResult | undefined,
): boolean {
  if (!result || isErrorResult(result)) return false;
  const details = result.details;
  if (!isRecord(details) || !Array.isArray(details.answers)) return false;

  for (const answer of details.answers) {
    if (!isRecord(answer)) continue;
    const question = typeof answer.questionIndex === "number" ? questions[answer.questionIndex] : undefined;
    if (question === undefined) return false;
    if (answer.kind === "option" && typeof answer.answer === "string" && answer.answer) {
      if (optionFor(question, answer.answer) === undefined) return false;
    } else if (answer.kind === "multi" && Array.isArray(answer.selected)) {
      for (const selected of answer.selected) {
        if (typeof selected === "string" && selected.length > 0 && optionFor(question, selected) === undefined) {
          return false;
        }
      }
    }
  }

  return true;
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

/**
 * What the row puts between the header chip and the detail. Named here so the
 * row's one line is spelled once, whatever draws it.
 */
export const ASK_USER_QUESTION_SUMMARY_SEPARATOR = " · ";

/** The summary as one line of text: the header chip's text, then the detail. */
export function askUserQuestionSummaryText(parts: AskUserQuestionSummaryParts): string {
  return parts.header ? `${parts.header}${ASK_USER_QUESTION_SUMMARY_SEPARATOR}${parts.detail}` : parts.detail;
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
  return { header: questions[0]?.header ?? "", detail: [count, answer].filter((part) => part).join(ASK_USER_QUESTION_SUMMARY_SEPARATOR) };
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
  /**
   * A non-cancelled result came back with nothing for this question: no entry at
   * all, or an entry that names no choice — no label the question offers and no
   * typed text.
   */
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
  return optionFor(question, label)?.preview || null;
}

/**
 * The questionnaire the expanded card draws: one block per question, each with
 * the labels to tick and the text and note to show. Answers are matched to
 * questions by `questionIndex`, and a question with no answer reads `unanswered`
 * unless the result is a dismissal — no entry for it, or an entry that names no
 * choice, which is the blank the collapsed row's answer slot reads `unanswered`
 * for — so a partial submit is legible while a decline is not dressed up as one,
 * and the row and the body cannot disagree about the same result. An error's
 * answers are not what the user chose — the collapsed row reads its slot
 * `unanswered` — so its questions read the same way rather than ticking a label
 * nobody was shown. A block also carries the chosen option's preview, so the card
 * can show the artifact that option offered.
 */
export function askUserQuestionBlocks(
  questions: readonly AskUserQuestionQuestion[],
  result: AskUserQuestionResult | undefined,
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
    const choice = readAnswer(answer, question);
    return {
      question,
      selected: choice.labels,
      custom: choice.custom,
      note: typeof answer.notes === "string" && answer.notes ? answer.notes : null,
      // An entry that names no choice — no label the question offers and nothing
      // typed — is the blank the collapsed row's answer slot reads `unanswered` for,
      // so the body says the same rather than drawing an unticked list that looks
      // answered — one predicate, `isBlankChoice()`, over one `readAnswer()`.
      unanswered: submitted && isBlankChoice(choice),
      preview: chosenPreview(answer.kind === "option" ? choice.labels[0] : undefined, question),
    };
  });
}
