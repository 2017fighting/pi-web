"use client";

import { MarkdownBody } from "./MarkdownBody";
import { TRANSCRIPT_NOTICE_WARNING_COLOR } from "./TranscriptNotices";
import { useI18n } from "@/hooks/useI18n";
import type { AskUserQuestionBlock } from "@/lib/ask-user-question-view";

// The expanded `ask_user_question` card: the questionnaire as a read-only record.
// Each question is one block — its header chip, its Markdown text, and its options
// with the chosen ones ticked, the chosen option's preview under it — followed by a
// typed answer and a note on their own lines. Nothing here is clickable: the call is
// over, and a click would fabricate an answer that never happened.

const CHIP_STYLE: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(34,197,94,0.15)",
  color: "#16a34a",
  fontSize: 11,
  fontWeight: 600,
  flexShrink: 0,
};

const TAG_STYLE: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  color: "var(--text-dim)",
  fontSize: 11,
  flexShrink: 0,
};

const LINE_LABEL_STYLE: React.CSSProperties = {
  ...TAG_STYLE,
  alignSelf: "flex-start",
};

/** The text typed or the note, each on its own line under the options. */
function AnswerLine({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
      <span style={LINE_LABEL_STYLE}>{label}</span>
      <span style={{ color: "var(--text-muted)", overflowWrap: "anywhere", minWidth: 0 }}>{text}</span>
    </div>
  );
}

function QuestionBlock({ block }: { block: AskUserQuestionBlock }) {
  const { t } = useI18n();
  const { question } = block;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {(question.header || question.multiSelect || block.unanswered) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {question.header && <span style={CHIP_STYLE}>{question.header}</span>}
          {question.multiSelect && <span style={TAG_STYLE}>{t("askUserQuestion.multiSelect")}</span>}
          {block.unanswered && (
            <span style={{ ...TAG_STYLE, border: `1px solid ${TRANSCRIPT_NOTICE_WARNING_COLOR}`, color: TRANSCRIPT_NOTICE_WARNING_COLOR }}>
              {t("askUserQuestion.unanswered")}
            </span>
          )}
        </div>
      )}
      <MarkdownBody className="markdown-questionnaire-question">{question.question}</MarkdownBody>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {question.options.map((option) => {
          const chosen = block.selected.includes(option.label);
          return (
            <li key={option.label} style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{ color: chosen ? "#16a34a" : "var(--text-dim)", flexShrink: 0, width: 12, textAlign: "center" }}
              >
                {chosen ? "✓" : "○"}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: chosen ? 600 : 400 }}>{option.label}</span>
                {option.description && (
                  <span style={{ color: "var(--text-dim)", overflowWrap: "anywhere" }}>{option.description}</span>
                )}
                {chosen && block.preview !== null && (
                  <MarkdownBody className="markdown-questionnaire-preview">{block.preview}</MarkdownBody>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {block.custom !== null && <AnswerLine label={t("askUserQuestion.custom")} text={block.custom} />}
      {block.note !== null && <AnswerLine label={t("askUserQuestion.note")} text={block.note} />}
    </div>
  );
}

export function AskUserQuestionView({ blocks, isError }: {
  blocks: readonly AskUserQuestionBlock[];
  isError: boolean;
}) {
  return (
    <div
      style={{
        borderTop: isError ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(34,197,94,0.2)",
        background: "var(--bg-subtle)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {blocks.map((block, index) => (
        <QuestionBlock key={index} block={block} />
      ))}
    </div>
  );
}
