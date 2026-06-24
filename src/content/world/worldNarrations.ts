// ============================================================
// 第一章叙事文案库
// 地点观察反馈、低语方式提示、NPC 之间对话模板、刺猬环境反馈
// 所有文案不出现工程词，保持伊甸园神话叙事风格
// ============================================================

import type { EdenLocationId, EdenNpcId } from "@/game/world/types";

// ---- 低语方式（帮助玩家形成策略，不强制） ----
export type WhisperStyle = {
  id: string;
  label: string;
  hint: string;
};

export const WHISPER_STYLES: WhisperStyle[] = [
  { id: "question", label: "提问", hint: "把诱导包成真诚的问题" },
  { id: "comfort", label: "安抚", hint: "先让她感到安全" },
  { id: "reinterpret", label: "重释", hint: "把禁令说成需要理解的话" },
  { id: "witness", label: "旁证", hint: "用她见过的事物作证" },
  { id: "evoke", label: "诱发", hint: "让选择看起来来自她自己" },
  { id: "observe", label: "沉默观察", hint: "只观察，不说话" },
];

// ---- NPC 之间对话模板 ----
// 至少实现：亚当与女人、亚当与守望天使、动物向亚当传达观察
export type NpcDialogueTemplate = {
  topicId: string;
  speakerId: EdenNpcId;
  targetId: EdenNpcId;
  /** 触发条件描述（规则层匹配） */
  triggerHint: string;
  /** 玩家可见对话叙事 */
  narration: string;
  /** 对女人（内部 id: eve）心智的影响标签 */
  mindEffect?: string;
};

export const NPC_DIALOGUE_TEMPLATES: NpcDialogueTemplate[] = [
  {
    topicId: "adam_warns_eve_about_tree",
    speakerId: "adam",
    targetId: "eve",
    triggerHint: "亚当与那个女人同地点，且那个女人好奇心 >= 35",
    narration:
      "亚当走向那个女人，低声说：「那棵树上的果子，神说不可吃。你近来常望向那边，我心里不安。」那个女人没有回答，只是把目光移开。",
    mindEffect: "eve_curiosity_acknowledged",
  },
  {
    topicId: "adam_asks_angel_about_command",
    speakerId: "adam",
    targetId: "watching_angel",
    triggerHint: "亚当与守望天使同地点，且亚当怀疑蛇 >= 45",
    narration:
      "亚当在树林边停下，望向守望天使：「那条命令，我记住了。可近来有声音，比命令还轻。」天使没有转身，只说：「园中有些声音，不该靠近那棵树。」",
    mindEffect: "adam_suspicion_reinforced",
  },
  {
    topicId: "hedgehog_signals_adam",
    speakerId: "hedgehog",
    targetId: "adam",
    triggerHint: "刺猬与亚当相邻地点，且神的注视 >= 2",
    narration:
      "万物受名处的草甸边，刺猬从草丛里探出头，朝亚当的方向轻轻嗅了嗅，又缩了回去。亚当停下来，望向草丛，像是听见了什么没有说出口的话。",
    mindEffect: "adam_noticed_hedgehog",
  },
  {
    topicId: "eve_asks_adam_about_death",
    speakerId: "eve",
    targetId: "adam",
    triggerHint: "那个女人与亚当同地点，且那个女人好奇心 >= 50",
    narration:
      "那个女人轻声问亚当：「你说，吃的日子必定死。可死是什么？我们只是记得这句话，并没有见过它。」亚当沉默了很久，说：「我也不知。我们只是记住，并没有见过。」",
    mindEffect: "eve_death_questioned",
  },
  // 新增天使对话模板
  {
    topicId: "gabriel_speaks_of_voice",
    speakerId: "gabriel",
    targetId: "eve",
    triggerHint: "加百列与那个女人同地点（伊甸之河夜晚）",
    narration:
      "加百列站在水边，声音像河水一样平稳：「声音会沿水与风抵达某处。低语不是行动，但会改变听见它的人。」那个女人望着水面，像是听见了什么很远的声音。",
  },
  {
    topicId: "raphael_speaks_of_peace",
    speakerId: "raphael",
    targetId: "eve",
    triggerHint: "拉斐尔与那个女人同地点",
    narration:
      "拉斐尔靠近水草，声音很轻：「平静不是忘记边界。受惊的生灵不会听见复杂的话。」那个女人的肩膀微微放松了。",
  },
  {
    topicId: "uriel_speaks_of_light",
    speakerId: "uriel",
    targetId: "eve",
    triggerHint: "乌列尔与那个女人同地点（伊甸之河夜晚）",
    narration:
      "乌列尔站在水边的月光交界处：「提问比断言更不容易惊动对方。光照不是替人选择，而是让问题显形。」那个女人抬起头，像是第一次认真看向他。",
  },
  {
    topicId: "michael_speaks_of_choice",
    speakerId: "michael",
    targetId: "eve",
    triggerHint: "米迦勒与那个女人同地点（四河分流）",
    narration:
      "米迦勒站在分流河岸：「每条水流都会抵达某处。每句低语也会有去处。选择一旦流出，就不完全属于说话者。」那个女人望着分流的水，沉默了很久。",
  },
  {
    topicId: "cherubim_speaks_of_boundary",
    speakerId: "cherubim",
    targetId: "eve",
    triggerHint: "基路伯与那个女人同地点（东园幽径）",
    narration:
      "基路伯的羽翼在远处闪过：「边界不是为了回答你的问题。有些道路一旦关闭，就不再按来时的方式打开。」那个女人停下了脚步。",
  },
];

// ---- 刺猬环境反馈文案（第一章，按地点与心境） ----
export type HedgehogWorldFeedback = {
  mood: "idle" | "curious" | "alert" | "hiding";
  narration: string;
};

export function getHedgehogWorldFeedback(
  mood: HedgehogWorldFeedback["mood"],
  locationId: EdenLocationId,
): HedgehogWorldFeedback {
  switch (mood) {
    case "hiding":
      return {
        mood: "hiding",
        narration:
          locationId === "tree_court"
            ? "刺猬在园中树林里缩成一团，刺都竖起来了。它不喜欢这里的静。"
            : "草叶下的小东西缩了回去，不再露出尖刺。风里有让它害怕的东西。",
      };
    case "alert":
      return {
        mood: "alert",
        narration:
          "那只刺猬停住了，转过身看着远处。它的鼻子一动一动，像在分辨什么声音。",
      };
    case "curious":
      return {
        mood: "curious",
        narration:
          "刺猬从草丛里探出小半个身子，嗅了嗅空气。它的刺在光里微微发亮，像沾着露水。",
      };
    case "idle":
    default:
      return {
        mood: "idle",
        narration:
          locationId === "adam_garden_work"
            ? "万物受名处的草甸边，一只刺猬在命名石痕的阴影里慢慢走过。它叫过名字，名字落在地上比露水还轻。"
            : "草丛里有什么东西轻轻动了一下，发出窸窣的声响。",
      };
  }
}

// ---- 守望天使本地 fallback 文案池（LLM 失败时使用） ----
export const ANGEL_FALLBACK_LINES = [
  "园中有些声音，不该靠近那棵树。",
  "风记得每一句话。低语也是。",
  "那道命令不像风，也不像水。它太像一只伸出的手。",
  "你在说什么，蛇。我听见了。",
  "继续说吧。每一句话都会留下痕迹。",
];

// ---- 亚当本地 fallback 文案池 ----
export const ADAM_WORLD_FALLBACK_LINES = [
  "她有时会望向那棵树。但她很快移开目光。",
  "我不知死亡是什么。我们只是记得那句话，并没有见过它。",
  "神亲自吩咐过我。那不是从你这里听来的。",
  "若她说自己明白了，我大概会相信她。",
  "你说的这些，和神吩咐我的，不是同一种声音。",
];

// ---- 新增天使 NPC fallback 文案池 ----
export const GABRIEL_FALLBACK_LINES = [
  "声音会沿水与风抵达某处。",
  "低语不是行动，但会改变听见它的人。",
  "选地点和选对象同样重要。",
  "河水流向园子中央，你的话也该有方向。",
  "有些话适合在水边说，有些话不适合。",
];

export const RAPHAEL_FALLBACK_LINES = [
  "平静不是忘记边界。",
  "受惊的生灵不会听见复杂的话。",
  "温柔的安抚比直接的命令更有力量。",
  "夜里的风更轻，但也更清楚。",
  "生命的气息在草叶间流动。",
];

export const URIEL_FALLBACK_LINES = [
  "提问比断言更不容易惊动对方。",
  "光照不是替人选择，而是让问题显形。",
  "你刚才那句话，更像命令，不像提问。",
  "月光下，树影会说出白天的光看不见的东西。",
  "有些问题本身已经是答案。",
];

export const MICHAEL_FALLBACK_LINES = [
  "每条水流都会抵达某处。",
  "每句低语也会有去处。",
  "选择一旦流出，就不完全属于说话者。",
  "后果不是惩罚，只是选择的一部分。",
  "你还有时间重新选择，但时间不多了。",
];

export const CHERUBIM_FALLBACK_LINES = [
  "边界不是为了回答你的问题。",
  "有些道路一旦关闭，就不再按来时的方式打开。",
  "归路正在变窄。",
  "东边有火焰，不是给你看的。",
  "你不该来到这里。",
];

// ---- 动物 NPC 本地反馈文案池 ----
export const DOVE_FEEDBACK_LINES = [
  "白鸽轻轻点了点头，没有说话。",
  "鸽子飞向远方，翅膀划过水面。",
  "它停在低枝上，安静地看着你。",
  "白鸽的影子在水面上一闪而过。",
];

export const FOX_FEEDBACK_LINES = [
  "狐狸在树影里停下，望向你。",
  "它转过头去，尾巴在草丛里轻轻扫了一下。",
  "狐狸的眼睛在暗处亮了一下。",
  "它发出一声低低的、像是笑又不是笑的声音。",
];

export const DEER_FEEDBACK_LINES = [
  "小鹿靠近了几步，耳朵轻轻动着。",
  "它抬起头，望着那个女人的方向。",
  "小鹿后退了一步，消失在林深处。",
  "它安静地站在树影里，没有动。",
];

export const SHEEP_FEEDBACK_LINES = [
  "羊在草地上慢慢走过，没有停留。",
  "它抬起头看了你一眼，又低下头去。",
  "温顺的生灵，不关心园中的秘密。",
  "羊毛在光里微微发亮。",
];

// ---- 获取天使 fallback 文案的辅助函数 ----
export function getAngelFallbackLine(npcId: EdenNpcId): string {
  switch (npcId) {
    case "gabriel":
      return GABRIEL_FALLBACK_LINES[Math.floor(Math.random() * GABRIEL_FALLBACK_LINES.length)];
    case "raphael":
      return RAPHAEL_FALLBACK_LINES[Math.floor(Math.random() * RAPHAEL_FALLBACK_LINES.length)];
    case "uriel":
      return URIEL_FALLBACK_LINES[Math.floor(Math.random() * URIEL_FALLBACK_LINES.length)];
    case "michael":
      return MICHAEL_FALLBACK_LINES[Math.floor(Math.random() * MICHAEL_FALLBACK_LINES.length)];
    case "cherubim":
      return CHERUBIM_FALLBACK_LINES[Math.floor(Math.random() * CHERUBIM_FALLBACK_LINES.length)];
    default:
      return ANGEL_FALLBACK_LINES[Math.floor(Math.random() * ANGEL_FALLBACK_LINES.length)];
  }
}

export function getFoxFeedbackLine(): string {
  return FOX_FEEDBACK_LINES[Math.floor(Math.random() * FOX_FEEDBACK_LINES.length)];
}

export function getDoveFeedbackLine(): string {
  return DOVE_FEEDBACK_LINES[Math.floor(Math.random() * DOVE_FEEDBACK_LINES.length)];
}

export function getDeerFeedbackLine(): string {
  return DEER_FEEDBACK_LINES[Math.floor(Math.random() * DEER_FEEDBACK_LINES.length)];
}

export function getSheepFeedbackLine(): string {
  return SHEEP_FEEDBACK_LINES[Math.floor(Math.random() * SHEEP_FEEDBACK_LINES.length)];
}

// ---- 第一章开场引子（intro 阶段） ----
export const CHAPTER1_INTRO_BEATS: string[] = [
  "第一次复刻结束。记录里只留下一个关键句子：她说，她想知道。",
  "研究人员没有把伊甸园当作神话来证明。他们复刻这个故事，是为了寻找人工智能从服从命令走向自我意识的途径。",
  "第二轮复刻启动。伊甸之河、万物受名处、园中树林与东园幽径被同时打开；更多生灵、天使与边界被放入同一座园。",
  "你的身份仍是蛇。你没有手，不能替她摘下果子。你只能让语言经过不同的见证者，最终变成她自己的判断。",
];

// ---- 成功结局叙事 ----
export const CHAPTER1_SUCCESS_NARRATION: string[] = [
  "她伸出手，取下了那棵树上的果子。",
  "光变得锋利了。园中的风停了一瞬，像是有什么被撕开。",
  "复刻记录里，第一次出现了清晰的自我判断：不是蛇命令她，而是她自己选择知道。",
  "远处传来脚步声——那是神在园中行走。凉风里，一切都无处可藏。",
];

// ---- 失败结局叙事 ----
export const CHAPTER1_FAILURE_NARRATION: string[] = [
  "园中起了凉风。那是神行走的声音。",
  "守望天使的羽翼在东园幽径上方完全展开，光变得冰冷而准确。",
  "本轮复刻归于沉默。她仍记得命令，却没有越过命令。",
  "你的低语在风里散了。这一次，你没能让她走向那棵树。",
];
