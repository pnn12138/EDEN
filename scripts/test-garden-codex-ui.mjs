import { readFileSync } from "node:fs";

const gardenPage = readFileSync("src/app/garden/page.tsx", "utf8");
const achievementGarden = readFileSync("src/components/world/AchievementGarden.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n[园中档案 UI smoke]");

const scopedBlock = css.split("GARDEN CODEX DESKTOP START")[1]?.split("GARDEN CODEX DESKTOP END")[0] ?? "";
const selectorLines = scopedBlock
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.includes(".eden-") && (line.endsWith("{") || line.endsWith(",")));

check("/garden 使用档案面板壳层", gardenPage.includes('className="eden-garden-archive"'));
check("新规则块存在", scopedBlock.length > 0);
check(
  "档案主体以 1200px 为基准",
  /\.eden-garden-page \.eden-garden-main\s*\{[^}]*max-width:\s*1200px/s.test(scopedBlock),
);
check(
  "新规则内每个普通选择器均有页面作用域",
  selectorLines.length > 0 && selectorLines.every((line) => line.startsWith(".eden-garden-page")),
);
check(
  "印记工具栏只用于非 compact 分支",
  achievementGarden.includes("compact ?") && achievementGarden.includes('className="eden-achievement-toolbar"'),
);
check(
  "compact 分支保留 emoji 锁标",
  achievementGarden.includes('compact ? "🔒" : "锁"'),
);
check(
  "页面包含稳定加载态",
  gardenPage.includes("eden-garden-loading") && gardenPage.includes('aria-busy={!isLoaded}'),
);
check("独立页隐藏印记使用尚未发现", achievementGarden.includes('compact ? "尚未解锁" : "尚未发现"'));

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
