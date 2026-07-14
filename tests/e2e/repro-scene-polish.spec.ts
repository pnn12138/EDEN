import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

// 推进引言直到进入 explore：末拍弹出「神明献礼三选一」，选定一份才进入 explore。
// 不允许再用「固定点击五次引言」的旧写法。
async function startFreshChapter(page: Page): Promise<void> {
  await page.goto("/world");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, WORLD_STATE_STORAGE_KEY);
  await page.reload();

  const advance = page.locator(".eden-btn--beat-advance");
  const giftCard = page.getByTestId("gift-choice-card").first();
  for (let index = 0; index < 12; index += 1) {
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
  await expect(page.getByTestId("world-objective-hint")).toBeVisible();
  await page.getByTestId("world-objective-hint-close").click();
}

async function moveTo(page: Page, locationId: string): Promise<void> {
  await page.getByTestId("world-map-open").click();
  await page.getByTestId(`location-card-${locationId}`).click();
  await page.getByTestId("world-map-enter").click();
  await page.waitForTimeout(600);
}

test.describe("场景打磨复现", () => {
  test("截图并测试对话打开", async ({ page }) => {
    await startFreshChapter(page);
    // 初始地点万物受名处
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/repro-adam-garden.png", fullPage: false });

    // 测试点击刺猬打开对话框
    const hedgehog = page.getByTestId("scene-action-hedgehog");
    await hedgehog.click();
    await page.waitForTimeout(300);
    const panelAfterHedge = await page.locator(".eden-world-panel").count();
    console.log("PANEL_AFTER_HEDGEHOG", panelAfterHedge);
    const dialogueTitle = await page.locator(".eden-section-title").first().textContent();
    console.log("DIALOGUE_TITLE_HEDGEHOG", JSON.stringify(dialogueTitle));
    await page.screenshot({ path: "test-results/repro-after-hedgehog.png", fullPage: false });

    // 测试点击亚当打开对话框
    const adam = page.locator(".eden-stage-character--adam");
    await adam.click();
    await page.waitForTimeout(300);
    const dialogueTitleAdam = await page.locator(".eden-section-title").first().textContent();
    console.log("DIALOGUE_TITLE_ADAM", JSON.stringify(dialogueTitleAdam));
    await page.screenshot({ path: "test-results/repro-after-adam.png", fullPage: false });

    // 前往东园幽径测试狐狸
    await moveTo(page, "central_meadow");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/repro-central-meadow.png", fullPage: false });
    await moveTo(page, "tree_court");
    await moveTo(page, "east_garden_path");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/repro-east-path.png", fullPage: false });

    // 检查狐狸按钮是否可点击
    const foxBtn = page.locator(".eden-stage-animal-btn").first();
    const foxCount = await foxBtn.count();
    console.log("FOX_BTN_COUNT", foxCount);
    if (foxCount > 0) {
      const box = await foxBtn.boundingBox();
      console.log("FOX_BOX", JSON.stringify(box));
      // 点击坐标
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
        const dialogueTitleFox = await page.locator(".eden-section-title").first().textContent();
        console.log("DIALOGUE_TITLE_FOX", JSON.stringify(dialogueTitleFox));
      }
    }

    // 前往伊甸之河测试
    await moveTo(page, "naming_stone_bank");
    await moveTo(page, "four_river_source");
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/repro-river.png", fullPage: false });
    const riverModal = await page.getByTestId("scene-puzzle-modal").count();
    console.log("RIVER_PUZZLE_AUTO_OPENED", riverModal);
  });
});
