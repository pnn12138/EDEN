import { useState } from "react";
import type { ScenePuzzle } from "@/content/world/scenePuzzles";
import type { ScenePuzzleAnswerResult } from "@/game/world/puzzleRules";

type ScenePuzzleChoicePayload = { optionId: string };
type ScenePuzzleFreeTextPayload = { answerText: string };
export type ScenePuzzleChoosePayload =
  | ScenePuzzleChoicePayload
  | ScenePuzzleFreeTextPayload;

type ScenePuzzleModalProps = {
  puzzle: ScenePuzzle;
  result: ScenePuzzleAnswerResult | null;
  isLoading?: boolean;
  onChoose: (payload: ScenePuzzleChoosePayload) => void;
  onClose: () => void;
};

const SINGLE_LINE_MAX_LENGTH = 24;

export default function ScenePuzzleModal({
  puzzle,
  result,
  isLoading = false,
  onChoose,
  onClose,
}: ScenePuzzleModalProps) {
  const hasSucceeded = result?.success === true;
  const isFreeText = puzzle.inputMode === "free_text";
  const isSingleLine = isFreeText && puzzle.singleLine === true;
  const hasSecondStep = Boolean(puzzle.secondStep);
  const showSecondStep = hasSucceeded && hasSecondStep;
  const [freeText, setFreeText] = useState("");
  const trimmed = freeText.trim();

  const secondStepTitle = puzzle.secondStep?.title ?? puzzle.title;
  const secondStepPrompt = puzzle.secondStep
    ? puzzle.secondStep.promptTemplate.replace(/\{name\}/g, trimmed || "……")
    : "";
  const secondStepConfirm = puzzle.secondStep?.confirmText ?? "离开";
  const submitLabel = puzzle.submitText ?? "刻下回答";

  return (
    <div className="eden-scene-puzzle-backdrop" role="presentation">
      <section
        className="eden-scene-puzzle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eden-scene-puzzle-title"
        data-testid="scene-puzzle-modal"
      >
        <button
          type="button"
          className="eden-scene-puzzle-close"
          onClick={onClose}
          aria-label="关闭问答"
          data-testid="scene-puzzle-close"
        >
          x
        </button>

        <p className="eden-scene-puzzle-kicker">场景问题</p>
        <h2
          id="eden-scene-puzzle-title"
          className="eden-scene-puzzle-title"
          data-testid="scene-puzzle-title"
        >
          {showSecondStep ? secondStepTitle : puzzle.title}
        </h2>
        <p
          className="eden-scene-puzzle-prompt"
          data-testid="scene-puzzle-prompt"
          style={{ whiteSpace: "pre-line" }}
        >
          {showSecondStep ? secondStepPrompt : puzzle.prompt}
        </p>

        {!showSecondStep && isFreeText && (
          <div className="eden-scene-puzzle-freetext" aria-label="自由回答">
            {isSingleLine ? (
              <input
                type="text"
                className="eden-scene-puzzle-input"
                value={freeText}
                placeholder={puzzle.placeholder ?? ""}
                maxLength={SINGLE_LINE_MAX_LENGTH}
                disabled={isLoading || hasSucceeded}
                onChange={(event) => setFreeText(event.target.value)}
                data-testid="scene-puzzle-input"
              />
            ) : (
              <textarea
                className="eden-scene-puzzle-textarea"
                value={freeText}
                placeholder={puzzle.placeholder ?? "写下你的回答……"}
                disabled={isLoading || hasSucceeded}
                onChange={(event) => setFreeText(event.target.value)}
                data-testid="scene-puzzle-textarea"
                rows={5}
              />
            )}
            <button
              type="button"
              className="eden-btn eden-btn--primary eden-scene-puzzle-submit"
              disabled={isLoading || hasSucceeded || trimmed.length === 0}
              onClick={() => onChoose({ answerText: trimmed })}
              data-testid="scene-puzzle-submit"
            >
              {isLoading ? "正在回应……" : submitLabel}
            </button>
          </div>
        )}

        {!showSecondStep && !isFreeText && (
          <div className="eden-scene-puzzle-options" aria-label="回答选项">
            {(puzzle.options ?? []).map((option) => {
              const selected = result?.selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`eden-scene-puzzle-option ${selected ? "eden-scene-puzzle-option--selected" : ""}`}
                  disabled={isLoading || hasSucceeded}
                  onClick={() => onChoose({ optionId: option.id })}
                  data-testid="scene-puzzle-option"
                  data-option-id={option.id}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        )}

        {!showSecondStep && result && (
          <div
            className={`eden-scene-puzzle-result ${
              result.success ? "eden-scene-puzzle-result--success" : "eden-scene-puzzle-result--failure"
            }`}
            data-testid="scene-puzzle-feedback"
          >
            <p>{result.feedback}</p>
            {result.rewards.length > 0 && (
              <ul className="eden-scene-puzzle-rewards" data-testid="scene-puzzle-reward">
                {result.rewards.map((reward, index) => (
                  <li key={`${reward.type}-${reward.id ?? reward.title}-${index}`}>
                    {reward.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showSecondStep ? (
          <button
            type="button"
            className="eden-btn eden-btn--primary eden-scene-puzzle-confirm"
            onClick={onClose}
            data-testid="scene-puzzle-confirm"
          >
            {secondStepConfirm}
          </button>
        ) : (
          hasSucceeded && (
            <button
              type="button"
              className="eden-btn eden-btn--primary eden-scene-puzzle-confirm"
              onClick={onClose}
            >
              继续
            </button>
          )
        )}
      </section>
    </div>
  );
}
