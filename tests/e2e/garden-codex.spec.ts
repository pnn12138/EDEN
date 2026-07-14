import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

// 推进引言直到进入 explore：末拍会弹出「神明献礼三选一」，选定一份才进入 explore。
// 用 gift-choice-card 识别并选择；关闭开场 / 场景 / 献礼通知，等待献礼 toast 消失。
async function enterExplore(page: Page): Promise<void> {
  const giftCard = page.getByTestId("gift-choice-card").first();
  const advance = page.locator(".eden-btn--beat-advance");
  const introModal = page.getByTestId("world-intro-modal");
  const sceneModal = page.getByTestId("world-scene-modal");

  for (let step = 0; step < 12; step += 1) {
    if (await introModal.isVisible().catch(() => false)) break;
    if (await sceneModal.isVisible().catch(() => false)) break;
    if (await giftCard.isVisible().catch(() => false)) {
      await giftCard.click();
      await introModal.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
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
  await page
    .waitForSelector(".eden-divine-gift-toast", { state: "detached", timeout: 10000 })
    .catch(() => {});
}

test.describe("园中档案桌面 UI", () => {
  test("1920×1080 首屏形成完整档案工作区", async ({ page }) => {
    await page.goto("/garden");

    const archive = page.locator(".eden-garden-archive");
    await expect(archive).toHaveAttribute("aria-busy", "false");
    await expect(archive).toBeVisible();

    const mainBox = await page.locator(".eden-garden-main").boundingBox();
    expect(mainBox?.width).toBeGreaterThanOrEqual(1180);
    expect(mainBox?.width).toBeLessThanOrEqual(1220);

    await expect(page.locator(".eden-codex-stat")).toHaveCount(4);
    await expect(page.getByRole("tab", { name: "印记" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "园中律则" })).toBeVisible();
    await expect(page.locator(".eden-achievement-toolbar")).toBeVisible();
    expect(await page.locator(".eden-achievement-card").count()).toBeGreaterThanOrEqual(4);
  });

  test("分页、筛选和搜索空态保持可用", async ({ page }) => {
    await page.goto("/garden");
    await expect(page.locator(".eden-garden-archive")).toHaveAttribute("aria-busy", "false");

    await page.getByRole("tab", { name: "回响" }).click();
    await expect(page.locator(".eden-codex-gallery--items")).toBeVisible();
    await page.getByRole("tab", { name: "结局" }).click();
    await expect(page.locator(".eden-codex-gallery--endings")).toBeVisible();
    await page.getByRole("tab", { name: "印记" }).click();

    await page.getByRole("button", { name: "已解锁" }).click();
    const search = page.getByRole("searchbox", { name: "搜索印记" });
    await search.fill("不会存在的印记名称");
    await expect(page.getByText("没有匹配的印记。")).toBeVisible();
    await search.fill("");

    await page.getByTestId("garden-back").focus();
    await expect(page.getByTestId("garden-back")).toBeFocused();
  });

  test("世界页 compact 印记浮窗保持原结构", async ({ page }) => {
    await page.goto("/world");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await enterExplore(page);

    await page.getByRole("button", { name: "打开园中档案" }).click();
    const compact = page.locator(".eden-codex");
    await expect(compact).toBeVisible();
    await expect(compact.locator(":scope > .eden-codex-tabs")).toHaveCount(1);
    await expect(compact.locator(":scope > .eden-codex-panel")).toHaveCount(1);
    await expect(compact.locator(".eden-achievement-toolbar")).toHaveCount(1);
    // The lock glyph is rendered as accessible Chinese text in the current UI.
    await expect(compact.locator(".eden-achievement-card-lock").first()).toContainText("锁");

    const gridStyles = await compact.locator(".eden-achievement-grid").evaluate((element) => {
      const styles = getComputedStyle(element);
      return { gap: styles.gap, columns: styles.gridTemplateColumns };
    });
    expect(gridStyles.gap).toBe("9px");
    expect(gridStyles.columns.split(" ").length).toBeGreaterThanOrEqual(2);
  });
});
