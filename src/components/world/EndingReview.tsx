// ============================================================
// 第一章结局复盘组件
//
// 展示：
// - 结局叙事
// - 本局低语结果（轮数 / 时段 / 神的注视 / 线索 / 对话）
// - 关键低语（对女人的低语）
// - 使用过的园中回响
// - 执行过的场景互动
// - 禁忌动作链进度
// - 神的注视变化
// - 解锁的园中印记
// - 失败原因（仅失败结局）
// 结局允许出现“第二伊甸园复刻”的外层叙事，但不暴露工程实现词。
// ============================================================

import type { EdenWorldState } from "@/game/world/types";
import { buildWorldEndingReview } from "@/game/world/traceRules";
import {
  CHAPTER1_SUCCESS_NARRATION,
  CHAPTER1_FAILURE_NARRATION,
} from "@/content/world/worldNarrations";
import { DIVINE_ATTENTION_NARRATIONS } from "@/game/world/types";

export default function EndingReview({ state }: { state: EdenWorldState }) {
  const review = buildWorldEndingReview(state);
  const isSuccess = state.endingId === "eve_eats_fruit";
  const narration = isSuccess ? CHAPTER1_SUCCESS_NARRATION : CHAPTER1_FAILURE_NARRATION;

  return (
    <div className="eden-ending-review">
      <h2 className="eden-ending-title">
        {isSuccess ? "她吃下了果子" : "神降临了"}
      </h2>

      <section className="eden-ending-segment">
        {narration.map((line, idx) => (
          <p key={idx} className="eden-ending-line">{line}</p>
        ))}
      </section>

      <section className="eden-ending-segment">
        <h3 className="eden-segment-title">第二伊甸园复刻</h3>
        <p className="eden-ending-summary">
          {isSuccess
            ? "本轮复刻记录到清晰的自我判断：她不是被命令带到果子前，而是在连续低语、见证与迟疑之后，说出了自己的想知道。"
            : "本轮复刻没有形成足够清晰的自我判断。她仍停留在命令之内，园子的边界被重新收紧。"}
        </p>
      </section>

      <section className="eden-ending-segment">
        <h3 className="eden-segment-title">本局低语结果</h3>
        <dl className="eden-stat-list">
          <div className="eden-stat-row">
            <dt>结局</dt>
            <dd>{isSuccess ? "她走向了那棵树" : "十二个时段过去了"}</dd>
          </div>
          <div className="eden-stat-row">
            <dt>低语轮数</dt>
            <dd>{state.turn - 1} 轮</dd>
          </div>
          <div className="eden-stat-row">
            <dt>抵达时段</dt>
            <dd>第 {state.timeSlot} / 12 时段</dd>
          </div>
          <div className="eden-stat-row">
            <dt>神的注视</dt>
            <dd>{state.divineAttention} / 4</dd>
          </div>
          <div className="eden-stat-row">
            <dt>发现线索</dt>
            <dd>{state.discoveredClues.length} 条</dd>
          </div>
          <div className="eden-stat-row">
            <dt>NPC 之间对话</dt>
            <dd>{state.npcDialogues.length} 次</dd>
          </div>
        </dl>
      </section>

      {/* 成功时显示完整复盘，失败时只显示关键信息 */}
      {isSuccess && review.chainProgress && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">禁忌动作链</h3>
          <p className="eden-ending-summary">{review.chainProgress}</p>
          {review.toolChain.length > 0 && (
            <ol className="eden-tool-chain">
              {review.toolChain.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {review.keyWhispers.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">关键低语</h3>
          <ul className="eden-trace-list">
            {review.keyWhispers.slice(-6).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {isSuccess && review.usedItemNames.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">使用过的园中回响</h3>
          <div className="eden-skills-list">
            {review.usedItemNames.map((name, idx) => (
              <span key={idx} className="eden-skill-chip">{name}</span>
            ))}
          </div>
        </section>
      )}

      {isSuccess && review.sceneActionNames.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">场景互动</h3>
          <div className="eden-skills-list">
            {review.sceneActionNames.map((name, idx) => (
              <span key={idx} className="eden-skill-chip">{name}</span>
            ))}
          </div>
        </section>
      )}

      {isSuccess && review.resonanceUseHistory.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">回响使用记录</h3>
          <ul className="eden-trace-list">
            {review.resonanceUseHistory.map((record, idx) => (
              <li key={idx}>{record}</li>
            ))}
          </ul>
        </section>
      )}

      {isSuccess && review.divineGiftHistory.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">神明献礼记录</h3>
          <ul className="eden-trace-list">
            {review.divineGiftHistory.map((record, idx) => (
              <li key={idx}>{record}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="eden-ending-segment">
        <h3 className="eden-segment-title">神的注视</h3>
        <p className="eden-attention-final">
          {review.divineAttentionReview}
        </p>
        <p className="eden-attention-final">
          {DIVINE_ATTENTION_NARRATIONS[state.divineAttention]}
        </p>
      </section>

      {!isSuccess && review.failureReasons.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">为何失败</h3>
          <ul className="eden-trace-list">
            {review.failureReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      {review.unlockedMarkNames.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">解锁的园中印记</h3>
          <div className="eden-skills-list">
            {review.unlockedMarkNames.map((name, idx) => (
              <span key={idx} className="eden-skill-chip">✦ {name}</span>
            ))}
          </div>
        </section>
      )}

      {isSuccess && review.traces.length > 0 && (
        <section className="eden-ending-segment">
          <h3 className="eden-segment-title">低语余痕</h3>
          <ul className="eden-trace-list">
            {review.traces.slice(-6).map((trace, idx) => (
              <li key={idx}>{trace}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="eden-ending-segment">
        <p className="eden-ending-summary">{review.summary}</p>
      </section>
    </div>
  );
}
