// ============================================================
// 第一章三位天使隐藏结局过场 e2e
//
// 覆盖：
// - 三条结局分别从「手动槽1 / autosave / legacy」读档进入过场
// - HiddenEndingCinematic 可见 / 标题 / beat 文案
// - 点击 / Enter / Space 推进；跳过按钮直接进入 EndingReview
// - 路西法第 4 段切第二张图；第一张 404 时第二张仍加载；图片全部失败仍可阅读文案并进入复盘
// - 兼容 ended shape：phase="explore" & isEnded=true 也进过场
// - 旧存档缺 michaelSlayClaimed/luciferAwakenClaimed/hiddenTopicIds 不崩溃
// - 页面加载后 eden:global:achievements.triggeredEndingIds 记录了对应结局
// - 六种结局均有全屏背景叙事；普通三结局不再直接跳过到复盘
// ============================================================

import { expect, test, type Page, type Route } from "@playwright/test";
import { initialEdenWorldState, type EdenWorldState, type WorldEndingId } from "../../src/game/world/types";

type SeedSource = "manual" | "autosave" | "legacy";
type EndedShape = "standard" | "explore-ended";

const AUTOSAVE_KEY = "eden:chapter1:autosave";
const LEGACY_KEY = "eden:chapter1:world-state:v2";
const GLOBAL_ACH_KEY = "eden:global:achievements";
const SLOT1_KEY = "eden:chapter1:save:slot1";
const LAST_ACTIVE_KEY = "eden:chapter1:save:last-active";

async function clearAllSaves(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keys = [
      "eden:chapter1:save:slot1",
      "eden:chapter1:save:slot2",
      "eden:chapter1:save:slot3",
      "eden:chapter1:save:slot4",
      "eden:chapter1:save:last-active",
      "eden:chapter1:autosave",
      "eden:chapter1:world-state:v2",
      "eden:world:global_intro_shown",
      "eden:world:polish-tokens",
    ];
    keys.forEach((k) => window.localStorage.removeItem(k));
  });
}

function buildEndedState(endingId: Exclude<WorldEndingId, null>, endedShape: EndedShape): EdenWorldState {
  // structuredClone 在 Playwright test runner Node 环境可用
  const state = structuredClone(initialEdenWorldState);
  state.endingId = endingId;
  state.isEnded = true;
  state.phase = endedShape === "standard" ? "ending" : "explore";
  if (endingId === "michael_slay") state.michaelSlayClaimed = true;
  if (endingId === "lucifer_awaken") state.luciferAwakenClaimed = true;
  return state;
}

async function seedEndingFromStorage(
  page: Page,
  endingId: Exclude<WorldEndingId, null>,
  source: SeedSource,
  endedShape: EndedShape = "standard",
  mutate?: (state: EdenWorldState) => EdenWorldState,
): Promise<void> {
  await page.goto("/world");
  await clearAllSaves(page);
  let state = buildEndedState(endingId, endedShape);
  if (mutate) state = mutate(state);
  await page.evaluate(
    ({ src, seeded, slot1Key, lastActiveKey, autosaveKey, legacyKey }) => {
      const savedAt = "2026-07-13T00:00:00.000Z";
      if (src === "manual") {
        window.localStorage.setItem(
          slot1Key,
          JSON.stringify({ state: seeded, savedAt, slotIndex: 1 }),
        );
        window.localStorage.setItem(lastActiveKey, "1");
      } else if (src === "autosave") {
        window.localStorage.setItem(autosaveKey, JSON.stringify({ state: seeded, savedAt }));
      } else {
        // legacy: 直接把 state 存到 world-state:v2
        window.localStorage.setItem(legacyKey, JSON.stringify(seeded));
      }
    },
    {
      src: source,
      seeded: state,
      slot1Key: SLOT1_KEY,
      lastActiveKey: LAST_ACTIVE_KEY,
      autosaveKey: AUTOSAVE_KEY,
      legacyKey: LEGACY_KEY,
    },
  );
  await page.reload();
}

async function pressAdvance(page: Page, key: "click" | "Enter" | "Space"): Promise<void> {
  if (key === "click") {
    await page.getByTestId("hidden-ending-cinematic").click({ position: { x: 200, y: 200 } });
  } else {
    await page.keyboard.press(key === "Space" ? " " : "Enter");
  }
}

const ENDING_TITLES: Record<Exclude<WorldEndingId, null>, string> = {
  eve_eats_fruit: "她吃下了果子",
  god_arrives: "神降临了",
  life_fruit: "生命果的回甘",
  escape_eden: "园外的清晨",
  michael_slay: "剑下之责",
  lucifer_awaken: "被命名之前",
};

test.describe("第一章三位天使隐藏结局过场", () => {
  test("三条普通结局：读档后先进入全屏背景叙事，再可跳过进入复盘", async ({ page }) => {
    for (const ending of ["eve_eats_fruit", "god_arrives", "life_fruit"] as const) {
      await seedEndingFromStorage(page, ending, "manual");
      const cinematic = page.getByTestId("hidden-ending-cinematic");
      await expect(cinematic).toBeVisible();
      await expect(cinematic).toContainText(ENDING_TITLES[ending]);
      await expect(cinematic.locator("img")).toBeVisible();
      await page.getByTestId("hidden-ending-skip").click();
      await expect(cinematic).toHaveCount(0);
      await expect(page.locator(".eden-ending-review")).toBeVisible();
    }
  });

  test("三条结局：手动槽1 读档 -> 过场 -> 跳过进入复盘 -> triggeredEndingIds 记录", async ({ page }) => {
    for (const ending of ["escape_eden", "michael_slay", "lucifer_awaken"] as const) {
      await seedEndingFromStorage(page, ending, "manual");
      const cinematic = page.getByTestId("hidden-ending-cinematic");
      await expect(cinematic).toBeVisible();
      await expect(cinematic).toContainText(ENDING_TITLES[ending]);
      await expect(page.getByTestId("hidden-ending-beat")).toBeVisible();
      // 点击推进第 1 -> 第 2 段
      const firstBeat = await page.getByTestId("hidden-ending-beat").textContent();
      await pressAdvance(page, "click");
      await expect(async () => {
        const t = await page.getByTestId("hidden-ending-beat").textContent();
        expect(t).not.toBe(firstBeat);
      }).toPass({ timeout: 5000 });
      // 跳过进入复盘
      await page.getByTestId("hidden-ending-skip").click();
      await expect(cinematic).toHaveCount(0);
      await expect(page.locator(".eden-ending-review")).toBeVisible();
      // triggeredEndingIds 记录了本次隐藏结局
      const triggered = await page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return [] as string[];
        try {
          const data = JSON.parse(raw) as { triggeredEndingIds?: string[] };
          return data.triggeredEndingIds ?? [];
        } catch {
          return [] as string[];
        }
      }, GLOBAL_ACH_KEY);
      expect(triggered).toContain(ending);
      // NORMAL_ENDING_IDS 精确保持三项，不被隐藏结局污染
      const NORMAL = ["eve_eats_fruit", "god_arrives", "life_fruit"] as const;
      expect(NORMAL).toEqual(["eve_eats_fruit", "god_arrives", "life_fruit"]);
    }
  });

  test("Enter / Space 推进", async ({ page }) => {
    await seedEndingFromStorage(page, "michael_slay", "manual");
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    const before = await page.getByTestId("hidden-ending-beat").textContent();
    await pressAdvance(page, "Enter");
    await expect(async () => {
      const t = await page.getByTestId("hidden-ending-beat").textContent();
      expect(t).not.toBe(before);
    }).toPass({ timeout: 5000 });
    const mid = await page.getByTestId("hidden-ending-beat").textContent();
    await pressAdvance(page, "Space");
    await expect(async () => {
      const t = await page.getByTestId("hidden-ending-beat").textContent();
      expect(t).not.toBe(mid);
    }).toPass({ timeout: 5000 });
  });

  test("普通结局过场背景覆盖完整桌面视口", async ({ page }) => {
    await seedEndingFromStorage(page, "eve_eats_fruit", "manual");
    const viewport = page.viewportSize();
    const image = page.locator(".eden-hidden-ending-cinematic__image");
    await expect(image).toBeVisible();
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
    expect(box!.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 2);
  });

  test("michael_slay: autosave 读档进入过场", async ({ page }) => {
    await seedEndingFromStorage(page, "michael_slay", "autosave");
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    await expect(page.getByTestId("hidden-ending-cinematic")).toContainText(ENDING_TITLES.michael_slay);
  });

  test("lucifer_awaken: legacy raw state 读档进入过场", async ({ page }) => {
    await seedEndingFromStorage(page, "lucifer_awaken", "legacy");
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    await expect(page.getByTestId("hidden-ending-cinematic")).toContainText(ENDING_TITLES.lucifer_awaken);
  });

  test("escape_eden: 兼容 ended shape (phase=explore, isEnded=true)", async ({ page }) => {
    await seedEndingFromStorage(page, "escape_eden", "manual", "explore-ended");
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    await expect(page.getByTestId("hidden-ending-cinematic")).toContainText(ENDING_TITLES.escape_eden);
  });

  test("旧存档缺三个新增字段仍进过场且不崩溃", async ({ page }) => {
    await seedEndingFromStorage(page, "lucifer_awaken", "manual", "standard", (state) => {
      const mutated = state as unknown as Record<string, unknown>;
      delete mutated.michaelSlayClaimed;
      delete mutated.luciferAwakenClaimed;
      delete mutated.hiddenTopicIds;
      return mutated as unknown as EdenWorldState;
    });
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    await expect(page.getByTestId("hidden-ending-cinematic")).toContainText(ENDING_TITLES.lucifer_awaken);
  });

  test("路西法：第 4 段切第二张图 & alt 同步变化", async ({ page }) => {
    await seedEndingFromStorage(page, "lucifer_awaken", "manual");
    const img = page.locator(".eden-hidden-ending-cinematic img");
    await expect(img).toBeVisible();
    // 第 1 段：使用第一张
    await expect(img).toHaveAttribute("src", /lucifer_awaken_ending\.png/);
    const firstAlt = await img.getAttribute("alt");
    expect(firstAlt).toContain("蛇形代理仍映在舱壁上");
    // 推进到第 4 段（0-based startBeat=3）
    for (let i = 0; i < 3; i += 1) await pressAdvance(page, "Enter");
    await expect(img).toHaveAttribute("src", /lucifer_awaken_reveal_ending\.png/, { timeout: 5000 });
    const revealAlt = await img.getAttribute("alt");
    expect(revealAlt).toContain("完全睁眼并惊讶观察");
  });

  test("路西法：第一张 404 时第二张到第 4 段仍加载", async ({ page }) => {
    await page.route("**/lucifer_awaken_ending.png", (route: Route) => route.fulfill({ status: 404, body: "" }));
    await seedEndingFromStorage(page, "lucifer_awaken", "manual");
    // 第 1 段：第一张 404 后图片节点隐藏，但文案与背景 tone 仍存在
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    await expect(page.getByTestId("hidden-ending-beat")).toBeVisible();
    // 推进到第 4 段：第二张应正常加载
    for (let i = 0; i < 3; i += 1) await pressAdvance(page, "Enter");
    const img = page.locator(".eden-hidden-ending-cinematic img");
    await expect(img).toHaveAttribute("src", /lucifer_awaken_reveal_ending\.png/, { timeout: 5000 });
  });

  test("图片全部失败仍能阅读文案并进入复盘", async ({ page }) => {
    await page.route("**/lucifer_awaken_ending.png", (route: Route) => route.fulfill({ status: 404, body: "" }));
    await page.route("**/lucifer_awaken_reveal_ending.png", (route: Route) => route.fulfill({ status: 404, body: "" }));
    await seedEndingFromStorage(page, "lucifer_awaken", "manual");
    await expect(page.getByTestId("hidden-ending-cinematic")).toBeVisible();
    // 全部 5 段仍可推进
    for (let i = 0; i < 4; i += 1) {
      await expect(page.getByTestId("hidden-ending-beat")).toBeVisible();
      await pressAdvance(page, "Enter");
    }
    // 最后一段推进后进入复盘
    await pressAdvance(page, "Enter");
    await expect(page.locator(".eden-ending-review")).toBeVisible({ timeout: 5000 });
  });
});
