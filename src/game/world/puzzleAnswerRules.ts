// ============================================================
// 第一章自由文本场景谜题规则层（权威）
//
// 规则层独立完成判定，不依赖 LLM。LLM 只可作为可选模糊辅助分类器，
// 但不得发奖、不得阻塞本地判定。
//
// 流程：
// 1. 归一化全角/半角、空格、标点、大小写
// 2. 检查明确反向概念 -> wrong
// 3. 检查至少一个核心正向概念
// 4. 给出 correct / close / wrong
// ============================================================

export type PuzzleAnswerGrade = "correct" | "close" | "wrong";

export type FreeTextAnswerResult = {
  grade: PuzzleAnswerGrade;
  feedback: string;
};

type Evaluator = {
  coreConcepts: string[];
  reverseConcepts: string[];
  successFeedback: string;
  closeFeedback: string;
  failureFeedback: string;
};

const EVALUATORS: Record<string, Evaluator> = {
  naming_stone_meaning: {
    coreConcepts: [
      "理解", "认识", "认出", "辨认", "区分", "分辨", "看见", "被看见",
      "记住", "被记住", "回应", "呼唤", "应答", "自己的位置", "意义", "被理解",
      "彼此", "听懂", "辨认出", "独特",
    ],
    reverseConcepts: [
      "占有", "占有的", "支配", "奴役", "服从", "控制万物", "属于命名者", "属于我",
      "归我", "收进掌心", "收拢", "统治", "臣服",
    ],
    successFeedback:
      "石痕亮了一瞬。名字不是把万物收进掌心，而是让它们能被看见、被理解，也能从万物中被认出。你记住了'万物名录'。",
    closeFeedback:
      "石痕微微发亮。你已经触到边了——名字让万物彼此不同，但还差一点：它让一个生命被真正看见。",
    failureFeedback:
      "石痕没有变亮。若名字只剩占有、支配或服从，它就很难成为能递给她的问题。再想想：名字究竟让一个生命获得了什么？",
  },
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, "")
    .replace(/[，。、！？；：,.!?;:"'“”‘’()（）\[\]【】]/g, "");
}

// 中文否定标记：出现在反向概念之前的否定结构中时，该反向词不算"答案主旨"
const NEGATION_MARKERS = [
  "不是",
  "并非",
  "不再",
  "不等于",
  "不为",
  "不要",
  "而非",
  "不应",
  "不能",
  "没有",
  "拒绝",
  "绝非",
  "未",
  "不",
];

// 反向概念是否处于否定结构中：否定标记出现在它之前 8 个字符内
function isReverseNegated(normalized: string, reverseConceptIndex: number): boolean {
  const window = normalized.slice(Math.max(0, reverseConceptIndex - 8));
  return NEGATION_MARKERS.some((marker) => window.includes(marker));
}

export function evaluateFreeTextAnswer(input: string, evaluationId: string): FreeTextAnswerResult | null {
  const evaluator = EVALUATORS[evaluationId];
  if (!evaluator) return null;

  const text = normalize(input);
  if (!text) {
    return { grade: "wrong", feedback: "石上什么也没留下。先说出你对'名字'的理解。" };
  }

  // 反向概念：若出现在否定结构中（"不是占有 / 并非支配 / 不是为了服从"），不算答案主旨
  const activeReverse = evaluator.reverseConcepts.filter((concept) => {
    const normConcept = normalize(concept);
    const index = text.indexOf(normConcept);
    if (index < 0) return false;
    return !isReverseNegated(text, index);
  });
  if (activeReverse.length > 0) {
    return { grade: "wrong", feedback: evaluator.failureFeedback };
  }

  const hits = evaluator.coreConcepts.filter((c) => text.includes(normalize(c))).length;
  if (hits >= 2) {
    return { grade: "correct", feedback: evaluator.successFeedback };
  }
  if (hits === 1) {
    return { grade: "close", feedback: evaluator.closeFeedback };
  }
  return { grade: "wrong", feedback: evaluator.failureFeedback };
}
