import { expect, test } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

test("移动端问答可读、可滚动关闭且地图可操作", async ({ page }) => {
  await page.goto("/world");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, WORLD_STATE_STORAGE_KEY);
  await page.reload();

  const advance = page.locator(".eden-btn--beat-advance");
  for (let index = 0; index < 5; index += 1) {
    await advance.click();
  }

  for (const testId of ["world-inventory-toggle", "world-map-open"]) {
    const control = page.getByTestId(testId);
    await expect(control).toBeVisible();
    const controlBox = await control.boundingBox();
    if (!controlBox) throw new Error(`${testId} has no bounding box`);
    expect(controlBox.x).toBeGreaterThanOrEqual(0);
    expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(390);
  }

  await page.getByTestId("world-objective-hint-close").click();
  await page.getByTestId("scene-action-engraved-stone").click();

  const modal = page.getByTestId("scene-puzzle-modal");
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  if (!box) throw new Error("Puzzle modal has no bounding box");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);

  await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(3);
  for (const option of await page.getByTestId("scene-puzzle-option").all()) {
    await option.scrollIntoViewIfNeeded();
    await expect(option).toBeVisible();
  }

  await page.getByTestId("scene-puzzle-close").click();
  await expect(modal).toHaveCount(0);

  await page.getByTestId("world-map-open").click();
  await page.getByTestId("location-card-central_meadow").click();
  await page.getByTestId("world-map-enter").click();
  await expect(page.getByTestId("world-current-location")).toContainText("园子中央");
});
