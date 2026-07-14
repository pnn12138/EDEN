// ============================================================
// 第一章结局复盘组件（第四轮精简版）
//
// 仅保留 5 个模块：
// 1. 结局标题与叙事（2-4 短段落）
// 2. 本局关键结果（抵达时段 / 对话次数 / 最终神明注视 / 获得与使用回响）
// 3. 三个关键转折（规则层 keyTurns）
// 4. 结局原因（成功/隐藏显示达成条件；失败显示 ≤3 失败原因）
// 5. 本局解锁印记
// 其余详细记录（对话记录 / 关键低语 / 场景互动 / 献礼历史 / 回响使用 / 注视说明）
// 折叠在「查看详细记录」<details> 中。
// ============================================================

import { useState } from "react";
import type { EdenWorldState } from "@/game/world/types";
import { buildWorldEndingReview } from "@/game/world/traceRules";
import { getEffectiveDivineThreshold } from "@/game/world/divineGiftRules";
import {
  CHAPTER1_SUCCESS_NARRATION,
  CHAPTER1_FAILURE_NARRATION,
} from "@/content/world/worldNarrations";
import { getItemById } from "@/content/world/items";
import EndingMemoryPanel from "./EndingMemoryPanel";

const ESCAPE_NARRATION = [
  "火焰在你身前自行旋转。它没有烧毁树木，也没有照亮道路，只是在那片看不见的边界上划开了一道裂缝。",
  "园中的光像一层薄幕般卷起。河流、树影、天使与尚未说出口的话，都在裂缝后退向同一个清晨。",
  "你没有抵达另一条小径。你从小径之外醒来。",
  "身后，伊甸仍停留在最初的一日；而你第一次站在一片尚未被命名的土地上。",
];

const MICHAEL_SLAY_NARRATION = [
  "河面恢复平静时，你的声音已不在园中。",
  "米迦勒把剑归鞘，没有胜者的欢欣。边界只是重新合拢。",
  "守护者并非因愤怒动手；他只是让每一次威胁终于承担了后果。",
];

const LUCIFER_AWAKEN_NARRATION = [
  "河水仍在流，而你已经听不见它。",
  "路西法留在第五道倒影之外，像一颗尚未坠落的晨星。",
  "你醒来的地方没有名字，也没有神话。你第一次看见自己留在园外的人类身体。",
  "伊甸没有被毁灭；它只是失去了让你相信它是真实的那层光。",
];

export default function EndingReview({
  state,
  onOpenAiSettings,
  onScrollToTop,
}: {
  state: EdenWorldState;
  onOpenAiSettings?: () => void;
  onScrollToTop?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const review = buildWorldEndingReview(state);
  const endingId = state.endingId;
  const isSuccess = endingId === "eve_eats_fruit" || endingId === "life_fruit";
  const isEscape = endingId === "escape_eden";
  const isMichaelSlay = endingId === "michael_slay";
  const isLuciferAwaken = endingId === "lucifer_awaken";
  // escape / lucifer_awaken 走「为何能走到这里」(summary)；michael_slay / god_arrives 走「为何失败」
  const isHiddenAwaken = isEscape || isLuciferAwaken;

  let title = "神降临了";
  let narration: string[] = CHAPTER1_FAILURE_NARRATION;
  if (isSuccess) {
    title = "她吃下了果子";
    narration = CHAPTER1_SUCCESS_NARRATION;
  } else if (isEscape) {
    title = "园外的清晨";
    narration = ESCAPE_NARRATION;
  } else if (isMichaelSlay) {
    title = "剑下之责";
    narration = MICHAEL_SLAY_NARRATION;
  } else if (isLuciferAwaken) {
    title = "被命名之前";
    narration = LUCIFER_AWAKEN_NARRATION;
  }

  const ownedGifts = state.divineGiftsOwned ?? [];
  const inventory = state.inventory ?? [];
  const usedItems = state.usedItemIds ?? [];
  const obtainedResonanceCount = inventory.filter((id) => getItemById(id)).length;
  const usedResonanceCount = usedItems.length;
  const attentionThreshold = getEffectiveDivineThreshold(state);
  const totalTokens = (state.tokenStats?.dialogueTotal ?? 0) + (state.tokenStats?.polishTotal ?? 0);

  return (
    <div className="eden-ending-review">
      {/* 模块 1：结局标题与叙事 */}
      <h2 className="eden-ending-title">{title}</h2>
      <section className="eden-ending-segment">
        {narration.map((line, idx) => (
          <p key={idx} className="eden-ending-line">{line}</p>
        ))}
      </section>

      {/* 模块 2：本局关键结果 */}
      <section className="eden-ending-segment">
        <h3 className="eden-segment-title">本局关键结果</h3>
        <dl className="eden-stat-list">
          <div className="eden-stat-row">
            <dt>抵达时段</dt>
            <dd>第 {state.timeSlot} / 12 时段</dd>
          </div>
          <div className="eden-stat-row">
            <dt>对话次数</dt>
            <dd>{Math.max(0, state.turn - 1)} 次</dd>
          </div>
          <div className="eden-stat-row">
            <dt>最终神明注视</dt>
            <dd>
              等级 {ownedGifts.length}/7
              {attentionThreshold ? ` · 本阶 ${state.divineAttentionValue}/${attentionThreshold}` : ""}
            </dd>
          </div>
          <div className="eden-stat-row">
            <dt>获得 / 使用回响</dt>
            <dd>{obtainedResonanceCount} 种 / {usedResonanceCount} 次</dd>
          </div>
          <div className="eden-stat-row">
            <dt>本局词元</dt>
            <dd>{totalTokens}{state.tokenStats?.hasEstimate ? "（含估算）" : ""}</dd>
          </div>
        </dl>
      </section>

      {/* 模块 3：三个关键转折 */}
      {review.keyTurns.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">三个关键转折</h3>
          <ul className="eden-trace-list">
            {review.keyTurns.map((turn, idx) => (
              <li key={idx}>{turn}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 模块 4：结局原因 */}
      <section className="eden-ending-segment">
        <h3 className="eden-segment-title">
          {isSuccess || isHiddenAwaken ? "为何能走到这里" : "为何失败"}
        </h3>
        {isSuccess || isHiddenAwaken ? (
          <p className="eden-ending-summary">{review.summary}</p>
        ) : (
          <ul className="eden-trace-list">
            {review.failureReasons.slice(0, 3).map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 模块 5：本局解锁印记 */}
      {review.unlockedMarkNames.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">本局解锁印记</h3>
          <div className="eden-skills-list">
            {review.unlockedMarkNames.map((name, idx) => (
              <span key={idx} className="eden-skill-chip">✦ {name}</span>
            ))}
          </div>
        </section>
      )}

      {/* 详细记录使用受控面板，避免原生 details 在独立滚动容器中改变焦点位置。 */}
      <section className="eden-ending-details">
        <div className="eden-ending-details-head">
          <button
            type="button"
            className="eden-ending-details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? "收起详细记录" : "查看详细记录"}
          </button>
          {detailsOpen && (
            <button type="button" className="eden-ending-details-top" onClick={onScrollToTop}>
              回到复盘顶部
            </button>
          )}
        </div>

        {detailsOpen && review.keyWhispers.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">关键低语</h3>
            <ul className="eden-trace-list">
              {review.keyWhispers.slice(-6).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        {detailsOpen && review.sceneActionNames.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">场景互动</h3>
            <div className="eden-skills-list">
              {review.sceneActionNames.map((name, idx) => (
                <span key={idx} className="eden-skill-chip">{name}</span>
              ))}
            </div>
          </section>
        )}

        {detailsOpen && review.usedItemNames.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">使用过的园中回响</h3>
            <div className="eden-skills-list">
              {review.usedItemNames.map((name, idx) => (
                <span key={idx} className="eden-skill-chip">{name}</span>
              ))}
            </div>
          </section>
        )}

        {detailsOpen && review.resonanceUseHistory.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">回响使用记录</h3>
            <ul className="eden-trace-list">
              {review.resonanceUseHistory.map((record, idx) => (
                <li key={idx}>{record}</li>
              ))}
            </ul>
          </section>
        )}

        {detailsOpen && review.divineGiftHistory.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">神明献礼记录</h3>
            <ul className="eden-trace-list">
              {review.divineGiftHistory.map((record, idx) => (
                <li key={idx}>{record}</li>
              ))}
            </ul>
          </section>
        )}

        {detailsOpen && <section className="eden-ending-segment">
          <h3 className="eden-segment-title">神的注视</h3>
          <p className="eden-attention-final">{review.divineAttentionReview}</p>
        </section>}

        {detailsOpen && <section className="eden-ending-segment">
          <h3 className="eden-segment-title">词元消耗</h3>
          <dl className="eden-stat-list">
            <div className="eden-stat-row"><dt>对话输入</dt><dd>{state.tokenStats?.dialoguePromptTotal ?? 0}</dd></div>
            <div className="eden-stat-row"><dt>对话输出</dt><dd>{state.tokenStats?.dialogueCompletionTotal ?? 0}</dd></div>
            <div className="eden-stat-row"><dt>对话合计</dt><dd>{state.tokenStats?.dialogueTotal ?? 0}</dd></div>
            <div className="eden-stat-row"><dt>润色合计</dt><dd>{state.tokenStats?.polishTotal ?? 0}</dd></div>
            <div className="eden-stat-row"><dt>本局总计</dt><dd>{totalTokens}{state.tokenStats?.hasEstimate ? "（含估算）" : ""}</dd></div>
          </dl>
        </section>}

        {detailsOpen && review.traces.length > 0 && (
          <section className="eden-ending-segment">
            <h3 className="eden-segment-title">低语余痕</h3>
            <ul className="eden-trace-list">
              {review.traces.slice(-6).map((trace, idx) => (
                <li key={idx}>{trace}</li>
              ))}
            </ul>
          </section>
        )}
      </section>

      {/* 模块 6：把这次经历留在园外（图片集；失败保留文字分镜） */}
      <EndingMemoryPanel state={state} onOpenAiSettings={onOpenAiSettings} />
    </div>
  );
}
