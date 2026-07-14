// ============================================================
// 存档匣：四槽保存 / 覆盖确认 / 删除确认 / 脏状态读取保护 的最小覆盖
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

async function readState(page: Page): Promise<{ locationId: string }> {
  return page.evaluate(() => {
    const s = (window as unknown as { __EDEN_WORLD_STATE__?: { locationId: string } }).__EDEN_WORLD_STATE__;
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

const openSettings = async (page: Page) => {
  await page.getByTestId("world-settings-open").click();
};
const closeSettings = async (page: Page) => {
  await page.locator('button[aria-label="关闭"]').click();
};

test.describe("存档匣：四槽保存与确认", () => {
  test("保存 / 覆盖确认 / 删除确认 / 脏状态读取保护", async ({ page }) => {
    await startFreshChapter(page);

    // 先制造一次脏状态（移动），确保后续读取会被脏状态保护拦截
    await moveTo(page, "central_meadow");

    // 1) 打开设置（默认存档匣），保存到空槽 1：直接保存，无覆盖确认
    await openSettings(page);
    await expect(page.getByTestId("world-save")).toBeVisible();
    await page.getByTestId("world-save").click();
    await page.getByTestId("world-slot-save-1").click();
    await expect(page.getByTestId("settings-confirm-ok")).toHaveCount(0);
    await expect(page.getByTestId("world-save-dot")).toContainText("已保存");

    // 2) 再次制造脏状态后保存同槽 → 出现覆盖确认
    await closeSettings(page);
    await moveTo(page, "tree_court");
    await openSettings(page);
    await page.getByTestId("world-save").click();
    await page.getByTestId("world-slot-save-1").click();
    await expect(page.getByTestId("settings-confirm-ok")).toBeVisible();
    await page.getByTestId("settings-confirm-ok").click();
    await expect(page.getByTestId("world-save-dot")).toContainText("已保存");

    // 3) 删除槽 1 → 出现删除确认；确认后回到「暂无存档」
    await page.getByTestId("world-slot-delete-1").click();
    await expect(page.getByTestId("settings-confirm-ok")).toBeVisible();
    await page.getByTestId("settings-confirm-ok").click();
    await expect(page.locator(".eden-save-slot-empty-hint").first()).toContainText("暂无存档");

    // 4) 重新保存槽 1（空槽直接保存），再制造脏状态后读取 → 脏状态读取保护（出现确认）
    await page.getByTestId("world-save").click();
    await page.getByTestId("world-slot-save-1").click();
    await expect(page.getByTestId("settings-confirm-ok")).toHaveCount(0);
    await expect(page.getByTestId("world-save-dot")).toContainText("已保存");
    await closeSettings(page);
    await moveTo(page, "naming_stone_bank");
    await openSettings(page);
    await page.getByTestId("world-load").click();
    await page.getByTestId("world-slot-load-1").click();
    await expect(page.getByTestId("settings-confirm-ok")).toBeVisible();
    await page.getByTestId("settings-confirm-ok").click();
  });
});
