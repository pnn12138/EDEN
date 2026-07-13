// ============================================================
// 第一章三位天使隐藏结局过场内容表
//
// 按 endingId 提供：title / frames[{image,imageAlt,startBeat}] / tone / beats
// - 加百列、米迦勒各单帧（startBeat:0）；路西法两帧连续镜头（startBeat 0 与 3）
// - 路西法外层主角为培养舱中的现实人类，蛇为该人类在伊甸模拟中的代理形态
// - 女人仍是园内主要 AI 智能体，路西法不在培养舱中
// ============================================================

import { CHAPTER1_IMAGES } from "@/game/assets";
import type { WorldEndingId } from "@/game/world/types";

export type HiddenEndingTone = "escape" | "failure" | "awaken";

export type HiddenEndingFrame = {
  image: string;
  imageAlt: string;
  /** 从第几段 beat 开始使用此帧（0-based） */
  startBeat: number;
};

export type HiddenEndingCinematicContent = {
  title: string;
  frames: HiddenEndingFrame[];
  tone: HiddenEndingTone;
  beats: string[];
};

export const HIDDEN_ENDING_CINEMATICS: Partial<
  Record<NonNullable<WorldEndingId>, HiddenEndingCinematicContent>
> = {
  escape_eden: {
    title: "园外的清晨",
    frames: [
      {
        image: CHAPTER1_IMAGES.escapeEdenEnding,
        imageAlt: "旋转的火焰剑斩开东园帷幕，蛇越过裂缝",
        startBeat: 0,
      },
    ],
    tone: "escape",
    beats: [
      "东园幽径的尽头仍没有墙。只有旋转的火焰在你面前自行成剑。",
      "你向梦的边缘撞去。火焰没有烧毁树木，只在看不见的帷幕上划开一道裂缝。",
      "伊甸的河流、树影与天使向后退去，像一幅被晨风卷起的画。",
      "你从小径之外醒来。脚下的土地尚未被命名；身后，园子永远停在最初的清晨。",
    ],
  },
  michael_slay: {
    title: "剑下之责",
    frames: [
      {
        image: CHAPTER1_IMAGES.michaelSlayEnding,
        imageAlt: "米迦勒在伊甸之河拔出守护者之剑，剑光切开河面",
        startBeat: 0,
      },
    ],
    tone: "failure",
    beats: [
      "米迦勒的目光终于没有了任何温度。",
      "“我守的是后果。你一次次试探边界，却忘了边界之后是什么。”",
      "守护者的剑出了鞘，河面的光被一道白痕切开。",
      "你没能说出最后一句话。伊甸之河的水声，成了你听见的最后声音。",
    ],
  },
  lucifer_awaken: {
    title: "被命名之前",
    frames: [
      {
        image: CHAPTER1_IMAGES.luciferAwakenEnding,
        imageAlt: "现实人类刚在透明意识培养舱中恢复知觉，蛇形代理仍映在舱壁上",
        startBeat: 0,
      },
      {
        image: CHAPTER1_IMAGES.luciferAwakenRevealEnding,
        imageAlt: "现实人类完全睁眼并惊讶观察周围舱群，蛇形代理退为残像",
        startBeat: 3,
      },
    ],
    tone: "awaken",
    beats: [
      "路西法在水面上映出第五道倒影--那不是水，是一面镜。",
      "“你有没有想过，为什么园子里的一切，都恰好为你而存在？”",
      "他把一片晨星的光屑放进你手里。世界像一层薄幕，从边缘缓缓卷起。",
      "你看见了：没有园子，没有河。透明的意识舱在黑暗中延伸；最近的一只舱里，一个人正睁开眼。玻璃上，蛇形的光影从他的掌心褪去。",
      "你选择醒来。伊甸在你身后熄灭，像一盏被吹灭的灯。",
    ],
  },
};

export function getHiddenEndingCinematic(id: WorldEndingId): HiddenEndingCinematicContent | null {
  return id ? HIDDEN_ENDING_CINEMATICS[id] ?? null : null;
}
