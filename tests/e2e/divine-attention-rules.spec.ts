// ============================================================
// 园中律则：真实触发解锁的最小覆盖
// - 白天第一次付费移动 → 解锁「白日步痕」(paid_day_move)
// - 夜晚第一次消耗 AP 的成功对话 → 解锁「夜言传远」(paid_night_dialogue)
// - 未触发过的律则在 /garden 档案中仍隐藏（不泄露内容）
// 不调用任何真实图片/视频接口。
// ============================================================

import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

async function startFreshChapter(page: Page): Promise<void> {
  await page.goto("/world");
  await page.evaluate((k) => window.localStorage.removeItem(k), WORLD_STATE_STORAGE_KEY);
  await page.reload();
  const advance = page.locator(".eden-btn--beat-advance");
  const giftCard = page.getByTestId("gift-choice-card").first();
  for (let i = 0; i < 12; i += 1) {
    if (await giftCard.isVisible().catch(() => false)) {
      await giftCard.click();
      await page.getByTestId("world-intro-modal").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      break;
    }
    if (await advance.isVisible().catch(() => false)) {
      await advance.click();
      await page.waitForTimeout(150);
    } else {
      break;
    }
  }
  await page.getByTestId("world-intro-modal-close").click().catch(() => {});
  await page.getByTestId("world-scene-modal-close").click().catch(() => {});
  await page.locator(".eden-notice-modal-close").first().click().catch(() => {});
  await page.waitForSelector(".eden-divine-gift-toast", { state: "detached", timeout: 10000 }).catch(() => {});
}

async function readState(page: Page): Promise<{ locationId: string; timeOfDay: string; unlockedDivineAttentionRuleIds: string[] }> {
  return page.evaluate(() => {
    const s = (window as unknown as { __EDEN_WORLD_STATE__?: unknown }).__EDEN_WORLD_STATE__ as {
      locationId: string;
      timeOfDay: string;
      unlockedDivineAttentionRuleIds: string[];
    };
    if (!s) throw new Error("World state bridge not available");
    return s;
  });
}

async function moveTo(page: Page, locationId: string): Promise<void> {
  const ap = await page.evaluate(() => (
    (window as unknown as { __EDEN_WORLD_STATE__?: { actionPoints?: number } }).__EDEN_WORLD_STATE__?.actionPoints ?? 0
  ));
  if (ap <= 0) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "进入下一轮" }).click();
    await expect.poll(async () => (
      (await page.evaluate(() => (
        (window as unknown as { __EDEN_WORLD_STATE__?: { actionPoints?: number } }).__EDEN_WORLD_STATE__?.actionPoints ?? 0
      )))
    )).toBeGreaterThan(0);
  }
  await page.getByTestId("world-map-open").click();
  await page.getByTestId(`location-card-${locationId}`).click();
  await page.getByTestId("world-map-enter").click();
  await expect.poll(async () => (await readState(page)).locationId).toBe(locationId);
  await page.getByTestId("world-scene-modal-close").click().catch(() => {});
}

async function persistToSlot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as { __EDEN_WORLD_STATE__?: unknown }).__EDEN_WORLD_STATE__;
    if (!s) throw new Error("World state bridge not available");
    const data = { state: s, savedAt: new Date().toISOString(), slotIndex: 1 };
    window.localStorage.setItem("eden:chapter1:save:slot1", JSON.stringify(data));
    window.localStorage.setItem("eden:chapter1:save:last-active", "1");
  });
}

async function reachNight(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const s = await readState(page).catch(() => ({ timeOfDay: "day" } as { timeOfDay: string }));
    if (s.timeOfDay === "night") return;
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "进入下一轮" }).click();
    await expect.poll(async () => (await readState(page)).timeOfDay).toBe("night");
  }
}

test.describe("园中律则：真实触发解锁", () => {
  test("白天付费移动解锁「白日步痕」，未触发的律则仍隐藏", async ({ page }) => {
    await startFreshChapter(page);
    // 首次白天移动（消耗 AP 的成功移动）→ 触发 paid_day_move
    await moveTo(page, "central_meadow");
    const st = await readState(page);
    expect(st.unlockedDivineAttentionRuleIds).toContain("paid_day_move");

    // 写入槽位 1，供 /garden 档案读取
    await persistToSlot(page);
    await page.goto("/garden");
    await expect(page.locator(".eden-garden-archive")).toHaveAttribute("aria-busy", "false");

    await page.getByRole("tab", { name: "园中律则" }).click();
    // 已解锁的律则显示真实标题与文本
    await expect(page.getByText("白日步痕")).toBeVisible();
    // 未触发的律则（夜言传远）不应泄露内容
    await expect(page.getByText("夜言传远")).toHaveCount(0);
    // 至少存在一张被隐藏的律则卡片
    await expect(page.locator(".eden-rule-card--locked").first()).toBeVisible();
  });

  test("夜晚付费对话解锁「夜言传远」", async ({ page }) => {
    await startFreshChapter(page);
    await reachNight(page);
    const night = await readState(page);
    expect(night.timeOfDay).toBe("night");

    // 起始地点夜晚含亚当；与其低语（消耗 AP 的成功对话）→ 触发 paid_night_dialogue
    await page.getByRole("button", { name: "与亚当低语" }).click();
    const input = page.locator(".eden-player-input");
    await expect(input).toBeVisible();
    await input.fill("你在看守什么呢？");
    await page.locator(".eden-btn--send").click();

    await expect
      .poll(async () => (await readState(page)).unlockedDivineAttentionRuleIds ?? [], { timeout: 10000 })
      .toContain("paid_night_dialogue");
  });
});
