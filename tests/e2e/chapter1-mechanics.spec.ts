import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

// 推进引言直到进入 explore：末拍会弹出「神明献礼三选一」，选定一份才进入 explore。
// 用正向循环稳健推进，避免快点时漏点导致卡在引言末拍。
async function enterExplore(page: Page): Promise<void> {
  const giftCard = page.getByTestId("gift-choice-card").first();
  const advance = page.locator(".eden-btn--beat-advance");
  const introModal = page.getByTestId("world-intro-modal");
  const sceneModal = page.getByTestId("world-scene-modal");

  for (let step = 0; step < 12; step += 1) {
    // 进入 explore 后会出现开场 / 场景切换弹窗，直接关闭即可
    if (await introModal.isVisible().catch(() => false)) break;
    if (await sceneModal.isVisible().catch(() => false)) break;
    if (await giftCard.isVisible().catch(() => false)) {
      await giftCard.click();
      // 选定首份献礼后等待开场弹窗出现
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

  // 关闭首次进入时的开场弹窗
  await page.getByTestId("world-intro-modal-close").click().catch(() => {});
  // 关闭进入首个场景时的场景切换弹窗
  await page.getByTestId("world-scene-modal-close").click().catch(() => {});
  // 选定献礼后会弹出「神明献礼」通知 modal（需手动「收下」），关掉避免遮挡后续点击
  await page.locator(".eden-notice-modal-close").first().click().catch(() => {});

  // 选定献礼后会弹出「神明献礼」提示 toast（约 6s 自动消失），等待其消失避免遮挡
  await page
    .waitForSelector(".eden-divine-gift-toast", { state: "detached", timeout: 10000 })
    .catch(() => {});
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
  await page.waitForTimeout(600);
  // 关闭可能弹出的场景切换弹窗，避免遮挡后续点击
  await page.getByTestId("world-scene-modal-close").click().catch(() => {});
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

  test("刻名石两步弹窗：输入名字后展示一念之间并获得回响", async ({ page }) => {
    await startFreshChapter(page);

    const stone = page.getByTestId("scene-action-engraved-stone");
    await expect(stone).toBeVisible();
    await stone.click();

    // 第一步：刻名石
    await expect(page.getByTestId("scene-puzzle-modal")).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toHaveText("刻名石");
    const nameInput = page.getByTestId("scene-puzzle-input");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("低语者");
    await page.getByTestId("scene-puzzle-submit").click();

    // 回响通知仍出现（万物名录照常发放，现为「获得回响」modal）
    await expect(page.locator('[aria-label="获得回响"]')).toBeVisible();
    await page.locator('[aria-label="获得回响"] .eden-notice-modal-close').click();

    // 第二步：仅是一个念头
    await expect(page.getByTestId("scene-puzzle-title")).toHaveText("仅是一个念头");
    await expect(page.getByText("石面上浮现出：低语者。")).toBeVisible();
    await page.getByTestId("scene-puzzle-confirm").click();

    // 弹窗关闭，刻名石标记为已记下
    await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);
    await expect(stone).toContainText("已记下");
  });

  test("设置浮窗：默认打开到存档匣，再可切到账号查看账号态", async ({ page }) => {
    await startFreshChapter(page);

    await page.getByTestId("world-settings-open").click();
    // 默认页签为「存档匣」：存档三按钮可见，账号内容默认不渲染
    await expect(page.getByTestId("world-save")).toBeVisible();
    await expect(page.getByTestId("settings-account")).toHaveCount(0);
    // 需要账号内容时再点击「账号」页签
    await page.locator(".eden-settings-tab", { hasText: "账号" }).click();
    await expect(page.getByTestId("settings-account")).toBeVisible();
    // 切回存档匣仍可操作存档入口
    await page.locator(".eden-settings-tab", { hasText: "存档匣" }).click();
    await expect(page.getByTestId("world-load")).toBeVisible();
  });
});
