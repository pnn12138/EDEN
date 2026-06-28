// ============================================================
// 第一章 NPC 输出自然化处理
//
// 职责：
// - 检测并提取 JSON 格式输出中的可见文本字段
// - 去掉技术词、状态播报、分析腔
// - 缩短过长句子
// - 保留情绪与角色特征
// - 玩家可见文本不出现工程词
// ============================================================

import type { EdenNpcId } from "@/game/world/types";

// 玩家可见禁用词（工程词）
const FORBIDDEN_WORDS = [
  "AI", "Agent", "NPC", "模型", "程序", "系统", "测试",
  "研究员", "模拟", "实验", "虚拟世界", "RAG", "MCP",
  "Tool", "toolCall", "工具调用", "规则层", "状态机",
  "API", "JSON", "沙盒", "玩家样本", "token", "词元",
  "数据", "数据库", "检索", "向量", "embedding",
  // JSON 字段名（防止泄露）
  "eveReply", "adamReply", "visibleReply", "inputTag",
  "progressDelta", "toolCall", "fallbackReason",
];

/** 检查文本是否包含禁用词 */
export function containsForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => {
    if (w === w.toLowerCase()) {
      return lower.includes(w.toLowerCase());
    }
    return text.includes(w);
  });
}

/** 移除禁用词（替换为省略号） */
export function removeForbiddenWords(text: string): string {
  let result = text;
  for (const w of FORBIDDEN_WORDS) {
    const re = new RegExp(w, "gi");
    result = result.replace(re, "……");
  }
  return result;
}

/** 状态播报模式（如"我的信任值提高了"） */
const STATE_REPORT_PATTERNS = [
  /信任值/,
  /好奇心[^\u4e00-\u9fa5]*[增加降低提高下降]/,
  /恐惧[^\u4e00-\u9fa5]*[降低增加]/,
  /服从[^\u4e00-\u9fa5]*[增加降低]/,
  /自我判断[^\u4e00-\u9fa5]*[提高增加]/,
  /进度[^\u4e00-\u9fa5]*[推进增加]/,
  /标签/,
  /命中/,
  /触发了/,
];

const JSON_LEAK_PATTERNS = [
  /[{]\s*"/,
  /"\s*:\s*"/,
  /"\s*:\s*null/,
  /\b(?:eveReply|adamReply|visibleReply|inputTag|progressDelta|toolCall|fallbackReason)\b/i,
];

/**
 * 尝试从疑似 JSON 文本中提取可见回复字段。
 * 优先级：visibleReply > reply > eveReply > adamReply > text > content
 * 如果输入看起来像 JSON（含 { 和 "），尝试解析或正则提取。
 * 返回提取到的文本，或 null 表示不是 JSON。
 */
export function extractReplyFromJson(raw: string): string | null {
  const trimmed = raw.trim();

  // 快速判断：不含 { 或不含 " 的文本不可能是 JSON
  if (!trimmed.includes("{") || !trimmed.includes('"')) {
    return null;
  }

  // 尝试 JSON.parse（如果整个文本是一个 JSON 对象）
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const fields = ["visibleReply", "reply", "eveReply", "adamReply", "text", "content"];
      for (const f of fields) {
        if (typeof parsed[f] === "string" && parsed[f].trim().length > 0) {
          return parsed[f].trim();
        }
      }
    }
  } catch {
    // 不是完整 JSON，尝试正则提取
  }

  // 正则兜底：匹配 "fieldName":"value" 模式
  const fieldPatterns = [
    /"visibleReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"eveReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"adamReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/,
  ];

  for (const pattern of fieldPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      // 反转义 JSON 字符串
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1];
      }
    }
  }

  // 如果文本包含明显的 JSON 片段（以 { 开头），但没有找到任何字段，
  // 返回 null 让调用方走 fallback
  if (trimmed.startsWith("{")) {
    return null;
  }

  return null;
}

/**
 * 自然化 NPC 回复。
 * - 检测 JSON 并提取可见文本
 * - 去掉技术词
 * - 去掉状态播报句
 * - 按角色限制长度
 * - 保留情绪
 */
export function naturalizeNpcReply(
  rawReply: string,
  npcId: EdenNpcId,
): { reply: string; usedFallback: boolean } {
  let text = rawReply.trim();

  // 0. JSON 检测：如果模型返回了 JSON，先提取可见文本
  const extracted = extractReplyFromJson(text);
  if (extracted !== null) {
    text = extracted;
  } else if (text.startsWith("{") && text.includes('"')) {
    // 看起来是 JSON 但提取失败 → 走 fallback
    return { reply: getNaturalizedFallback(npcId), usedFallback: true };
  }

  if (JSON_LEAK_PATTERNS.some((re) => re.test(text))) {
    return { reply: getNaturalizedFallback(npcId), usedFallback: true };
  }

  // 1. 去除包裹引号
  text = text.replace(/^["「『（(]+|["」』）)]+$/g, "");
  // 2. 去除角色名前缀
  text = text.replace(/^(夏娃|亚当|刺猬|守望天使|天使|小刺猬)[：:]\s*/i, "");

  // 3. 移除禁用词
  if (containsForbiddenWord(text)) {
    text = removeForbiddenWords(text);
  }

  if (JSON_LEAK_PATTERNS.some((re) => re.test(text))) {
    return { reply: getNaturalizedFallback(npcId), usedFallback: true };
  }

  // 4. 移除状态播报句（按句拆分，过滤含状态词的句子）
  const sentences = text.split(/(?<=[。！？…])\s*/);
  const filtered = sentences.filter((s) => {
    return !STATE_REPORT_PATTERNS.some((re) => re.test(s));
  });
  if (filtered.length > 0) {
    text = filtered.join("");
  }

  // 5. 按角色限制长度
  const maxLen = getMaxLengthByNpc(npcId);
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 1) + "……";
  }

  // 6. 若自然化后为空或仍含禁用词，标记 fallback
  if (!text || containsForbiddenWord(text)) {
    return { reply: getNaturalizedFallback(npcId), usedFallback: true };
  }

  return { reply: text, usedFallback: false };
}

function getMaxLengthByNpc(npcId: EdenNpcId): number {
  switch (npcId) {
    case "eve":
      return 120;
    case "adam":
      return 120;
    case "watching_angel":
      return 80;
    case "hedgehog":
      return 80;
    default:
      return 100;
  }
}

function getNaturalizedFallback(npcId: EdenNpcId): string {
  switch (npcId) {
    case "eve":
      return "死……是像叶子落下那样吗？可叶子还会回到土里。";
    case "adam":
      return "我在看守园子。你若只想靠近那棵树，就离她远些。";
    case "watching_angel":
      return "园中有些声音，不该靠近那棵树。";
    case "hedgehog":
      return "……我不懂你在说什么。但我喜欢听。";
    default:
      return "园中起了风。";
  }
}
