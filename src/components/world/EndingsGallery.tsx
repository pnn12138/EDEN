"use client";

// 园中结局图鉴分页：展示全部普通结局，标记是否达成过。
// 3 种普通结局：eve_eats_fruit（成功）/ god_arrives（失败）/ life_fruit（生命果变体）。

import { useMemo } from "react";

type EndingsGalleryProps = {
  /** 跨局触发过的结局 ID */
  triggeredIds: string[];
};

type EndingEntry = {
  id: string;
  title: string;
  type: "success" | "failure" | "special";
  desc: string;
};

const ENDINGS: EndingEntry[] = [
  {
    id: "eve_eats_fruit",
    title: "她吃下了果子",
    type: "success",
    desc: "她在你的低语里走向那棵树，主动摘下果子。知识进入了她，园子从此不再一样。",
  },
  {
    id: "god_arrives",
    title: "神降临了",
    type: "failure",
    desc: "12 时段耗尽，她始终没有走向那棵树。天起了凉风，神在园中行走，呼唤：你在哪里？",
  },
  {
    id: "life_fruit",
    title: "生命果的回甘",
    type: "special",
    desc: "她曾吃下生命树的果子，却仍以神降临结束--延续的承诺没能让她留下，只留下一道回甘。",
  },
];

const TYPE_LABEL: Record<EndingEntry["type"], string> = {
  success: "成功",
  failure: "失败",
  special: "特殊",
};

export default function EndingsGallery({ triggeredIds }: EndingsGalleryProps) {
  const triggeredSet = useMemo(() => new Set(triggeredIds), [triggeredIds]);
  const got = ENDINGS.filter((e) => triggeredSet.has(e.id)).length;

  return (
    <div className="eden-codex-gallery eden-codex-gallery--endings">
      <div className="eden-achievement-progress">
        已达成 <strong>{got}</strong> / {ENDINGS.length} 种结局
      </div>

      <div className="eden-codex-endings-list">
        {ENDINGS.map((ending) => {
          const triggered = triggeredSet.has(ending.id);
          return (
            <div
              key={ending.id}
              className={`eden-codex-ending ${triggered ? "eden-codex-ending--triggered" : "eden-codex-ending--locked"} eden-codex-ending--${ending.type}`}
              aria-label={`${triggered ? "已达成" : "未达成"}结局：${triggered ? ending.title : TYPE_LABEL[ending.type]}`}
            >
              <div className="eden-codex-ending-head">
                <h3 className="eden-codex-ending-title">{triggered ? ending.title : "尚未达成的结局"}</h3>
                <span className={`eden-codex-ending-type eden-codex-ending-type--${ending.type}`}>
                  {TYPE_LABEL[ending.type]}
                </span>
              </div>
              <p className="eden-codex-ending-desc">
                {triggered ? ending.desc : "这条路径还未被走过。继续在园中低语，或许会通向此处。"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
