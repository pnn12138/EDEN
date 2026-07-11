import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

// 推进引言直到进入 explore：末拍会弹出「神明献礼三选一」，选定一份才进入 explore。
// 用正向循环稳健推进，避免快点时漏点导致卡在引言末拍。
async function enterExplore(page: Page): Promise<void> {
  const objectiveHint = page.getByTestId("world-objective-hint");
  const giftCard = page.getByTestId("gift-choice-card").first();
  const advance = page.locator(".eden-btn--beat-advance");

  for (let step = 0; step < 12; step += 1) {
    if (await objectiveHint.isVisible().catch(() => false)) break;
    if (await giftCard.isVisible().catch(() => false)) {
      await giftCard.click();
      break;
    }
    if (await advance.isVisible().catch(() => false)) {
      await advance.click();
      await page.waitForTimeout(150);
    } else {
      break;
    }
  }

  await expect(objectiveHint).toBeVisible();
  // 选定献礼后会弹出「神明献礼」提示 toast（约 6s 自动消失），等待其消失后再关闭目标提示，
  // 避免 toast 遮挡 close 按钮导致点击超时。
  await page
    .waitForSelector(".eden-divine-gift-toast", { state: "detached", timeout: 10000 })
    .catch(() => {});
  await page.getByTestId("world-objective-hint-close").click();
}

async function startFreshChapter(page: Page): Promise<void> {
  await page.goto("/world");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, WORLD_STATE_STORAGE_KEY);
  await page.reload();
  await enterExplore(page);
}

async function moveTo(page: Page, locationId: string): Promise<void> {
  await page.getByTestId("world-map-open").click();
  await page.getByTestId(`location-card-${locationId}`).click();
  await page.getByTestId("world-map-enter").click();
  await page.waitForTimeout(600);
}

test.describe("第一章机制：伊甸之河 / NPC 重开 / 刻名石自由文本", () => {
  test("伊甸之河为显式点击，进入不自动弹窗", async ({ page }) => {
    await startFreshChapter(page);
    // 伊甸之河不邻接万物受名处，须经园子中央绕行（地图邻接规则）
    await moveTo(page, "central_meadow");
    await moveTo(page, "four_river_source");

    // 进入场景不自动弹出问答
    await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);

    const river = page.getByTestId("scene-action-eden-river");
    await expect(river).toBeVisible();
    await river.click();

    await expect(page.getByTestId("scene-puzzle-modal")).toBeVisible();
    await page.getByTestId("scene-puzzle-option").first().click();
    await expect(page.getByTestId("scene-puzzle-feedback")).toBeVisible();
  });

  test("NPC 点击统一入口：关闭面板后再次点击同一 NPC 可重开", async ({ page }) => {
    await startFreshChapter(page);

    const adam = page.getByRole("button", { name: "与亚当低语" });
    await adam.click();
    await expect(page.locator(".eden-world-panel")).toBeVisible();

    // 关闭面板
    await page.locator(".eden-panel-close-btn").click();
    await expect(page.locator(".eden-world-panel")).toHaveCount(0);

    // 再次点击同一 NPC 重新打开，且保留历史
    await adam.click();
    await expect(page.locator(".eden-world-panel")).toBeVisible();
    await expect(page.getByText("对 亚当 低语")).toBeVisible();
  });

  test("刻名石自由文本：提交中文理解可成功并获得回响", async ({ page }) => {
    await startFreshChapter(page);

    const stone = page.getByTestId("scene-action-engraved-stone");
    await expect(stone).toBeVisible();
    await stone.click();

    await expect(page.getByTestId("scene-puzzle-modal")).toBeVisible();
    const textarea = page.getByTestId("scene-puzzle-textarea");
    await expect(textarea).toBeVisible();

    await textarea.fill("名字不是占有，而是让一个生命被理解、被看见。");
    await page.getByTestId("scene-puzzle-submit").click();

    await expect(page.getByTestId("scene-puzzle-feedback")).toBeVisible();
    await expect(page.getByText("万物名录", { exact: true })).toBeVisible();
  });

  test("设置浮窗：可打开，含账号态与存档三按钮", async ({ page }) => {
    await startFreshChapter(page);

    await page.getByTestId("world-settings-open").click();
    await expect(page.getByTestId("settings-account")).toBeVisible();
    await expect(page.getByTestId("world-save")).toBeVisible();
    await expect(page.getByTestId("world-load")).toBeVisible();
    await expect(page.getByTestId("world-restart")).toBeVisible();
  });
});
