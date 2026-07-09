import { expect, test, type Page } from "@playwright/test";

const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

type StoredWorldState = {
  actionPoints: number;
  divineAttention: number;
  locationId: string;
  completedScenePuzzleIds: string[];
  discoveredClues: string[];
  inventory: string[];
  itemCounts: Record<string, number>;
  sceneActionIds: string[];
  actionsThisSlot: {
    sceneActionIds: string[];
  };
};

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
}

async function readStoredState(page: Page): Promise<StoredWorldState> {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) throw new Error("World state was not persisted");
    return JSON.parse(raw) as StoredWorldState;
  }, WORLD_STATE_STORAGE_KEY);
}

async function waitForStoredPuzzle(page: Page, puzzleId: string): Promise<void> {
  await expect.poll(async () => {
    const state = await readStoredState(page);
    return state.completedScenePuzzleIds;
  }).toContain(puzzleId);
}

async function moveTo(page: Page, locationId: string): Promise<void> {
  await page.getByTestId("world-map-open").click();
  await page.getByTestId(`location-card-${locationId}`).click();
  await page.getByTestId("world-map-enter").click();
  await expect.poll(async () => (await readStoredState(page)).locationId).toBe(locationId);
}

async function answerPuzzle(
  page: Page,
  optionText: string,
  expectedPuzzleId: string,
): Promise<void> {
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith("/api/world/puzzle") &&
    response.request().method() === "POST"
  ));
  await page.getByTestId("scene-puzzle-option").filter({ hasText: optionText }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await waitForStoredPuzzle(page, expectedPuzzleId);
}

test.describe("第一章场景问答完整流程", () => {
  test("新存档完成三道问答，刷新后不重复领奖", async ({ page }) => {
    await startFreshChapter(page);

    const objective = page.getByTestId("world-objective-hint");
    await expect(objective).toContainText("当前目标");
    await expect(objective).toContainText("只有刺猬与刻名石需要直接点击");
    await expect(objective).toContainText("场景中的重要问题会在到达时出现");
    await page.getByTestId("world-objective-hint-close").click();
    await expect(objective).toHaveCount(0);

    await expect(page.getByTestId("scene-action-engraved-stone")).toBeVisible();
    await expect(page.getByTestId("scene-action-hedgehog")).toBeVisible();
    await page.getByTestId("scene-action-engraved-stone").click();

    const modal = page.getByTestId("scene-puzzle-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("刻名石");
    await expect(page.getByTestId("scene-puzzle-prompt")).toContainText("名字");
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(3);

    await answerPuzzle(
      page,
      "名字先让一个生命被理解",
      "puzzle_naming_stone_identity",
    );
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("借来的名字");
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("命名石痕");
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("借来的名字");

    let state = await readStoredState(page);
    expect(state.discoveredClues).toContain("clue_naming_stones");
    expect(state.inventory).toContain("resonance_borrowed_name");
    expect(state.itemCounts.resonance_borrowed_name).toBe(1);

    const duplicateResponse = await page.request.post("/api/world/puzzle", {
      data: {
        state,
        puzzleId: "puzzle_naming_stone_identity",
        optionId: "understand_before_own",
      },
    });
    expect(duplicateResponse.ok()).toBe(true);
    const duplicateBody = await duplicateResponse.json() as {
      result: {
        alreadyCompleted: boolean;
        rewards: unknown[];
        state: StoredWorldState;
      };
    };
    expect(duplicateBody.result.alreadyCompleted).toBe(true);
    expect(duplicateBody.result.rewards).toEqual([]);
    expect(duplicateBody.result.state.itemCounts.resonance_borrowed_name).toBe(1);

    await page.getByRole("button", { name: "继续" }).click();
    await page.getByTestId("world-inventory-toggle").click();
    await expect(page.getByTestId("inventory-panel")).toContainText("借来的名字");
    await page.getByRole("button", { name: "关闭回响面板" }).click();
    await page.getByRole("button", { name: "线索与记录" }).click();
    await expect(page.getByTestId("clue-panel")).toContainText("命名石痕");

    await page.getByTestId("scene-action-engraved-stone").click();
    await expect(modal).toHaveCount(0);
    state = await readStoredState(page);
    expect(state.itemCounts.resonance_borrowed_name).toBe(1);

    await moveTo(page, "central_meadow");
    await moveTo(page, "tree_court");
    await moveTo(page, "east_garden_path");

    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("东园幽径");
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(3);
    const beforeWrong = await readStoredState(page);
    await page.getByTestId("scene-puzzle-option").filter({ hasText: "直接催她" }).click();
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("越急的催促");
    const afterWrong = await readStoredState(page);
    expect(afterWrong.actionPoints).toBe(beforeWrong.actionPoints);
    expect(afterWrong.divineAttention).toBe(beforeWrong.divineAttention + 1);
    expect(afterWrong.completedScenePuzzleIds).not.toContain("puzzle_east_path_cautious_presence");

    await answerPuzzle(
      page,
      "先沉默观察",
      "puzzle_east_path_cautious_presence",
    );
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("无声草");
    await page.getByRole("button", { name: "继续" }).click();

    await moveTo(page, "naming_stone_bank");
    await moveTo(page, "east_garden_path");
    await expect(modal).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "进入下一轮" }).click();
    await expect.poll(async () => (await readStoredState(page)).actionPoints).toBe(5);

    await moveTo(page, "naming_stone_bank");
    await moveTo(page, "four_river_source");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("伊甸之河");
    await answerPuzzle(
      page,
      "会在听见的人心里改变方向",
      "puzzle_river_words_belonging",
    );
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("低语一旦流出");
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("四河回声");
    await page.getByRole("button", { name: "继续" }).click();

    state = await readStoredState(page);
    expect(state.itemCounts.resonance_four_river_echo).toBe(1);
    expect(state.completedScenePuzzleIds).toEqual(expect.arrayContaining([
      "puzzle_naming_stone_identity",
      "puzzle_east_path_cautious_presence",
      "puzzle_river_words_belonging",
    ]));

    const oldActionsBefore = [...state.sceneActionIds];
    const oldSlotActionsBefore = [...state.actionsThisSlot.sceneActionIds];
    const apBeforeOldAreaClick = state.actionPoints;
    const stage = page.getByTestId("world-scene-stage");
    const stageBox = await stage.boundingBox();
    if (!stageBox) throw new Error("World stage has no bounding box");
    await page.mouse.click(
      stageBox.x + stageBox.width * 0.34,
      stageBox.y + stageBox.height * 0.54,
    );
    await page.waitForTimeout(250);
    state = await readStoredState(page);
    expect(state.actionPoints).toBe(apBeforeOldAreaClick);
    expect(state.sceneActionIds).toEqual(oldActionsBefore);
    expect(state.actionsThisSlot.sceneActionIds).toEqual(oldSlotActionsBefore);
    await expect(page.locator(".eden-scene-focus-hotspot")).toHaveCount(0);
    await expect(page.getByText(/水声源头|静水旁的叶|狐尾痕|白羽落点|两树之间/)).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);
    await expect(page.getByTestId("world-objective-hint")).toHaveCount(0);
    state = await readStoredState(page);
    expect(state.itemCounts.resonance_borrowed_name).toBe(1);
    expect(state.itemCounts.resonance_silent_grass).toBe(1);
    expect(state.itemCounts.resonance_four_river_echo).toBe(1);
  });
});
