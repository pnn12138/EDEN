import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

async function startFreshChapter(page: Page): Promise<void> {
  await page.goto("/world");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, WORLD_STATE_STORAGE_KEY);
  await page.reload();
  const advance = page.locator(".eden-btn--beat-advance");
  for (let index = 0; index < 5; index += 1) {
    await advance.click();
  }
  await expect(page.getByTestId("world-objective-hint")).toBeVisible();
  await page.getByTestId("world-objective-hint-close").click();
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
    await expect(page.getByText("亚当")).toBeVisible();
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
});
