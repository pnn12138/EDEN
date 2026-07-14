import { expect, test, type Page } from "@playwright/test";

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

// 关闭进入新场景/首通时可能弹出的遮罩弹窗：
//   - 神明献礼 / 获得回响通知弹窗（.eden-notice-modal-close，「收下」）
//   - 全局开场弹窗（world-intro-modal-close）
//   - 场景描述弹窗（world-scene-modal-close）
// 这些弹窗带全屏遮罩，会拦截舞台上的场景动作点击，必须在交互前关掉。
async function dismissModals(page: Page): Promise<void> {
  const closers = [
    page.locator(".eden-notice-modal-close"),
    page.getByTestId("world-intro-modal-close"),
    page.getByTestId("world-scene-modal-close"),
  ];
  // 通知类弹窗可能连续出现（如献礼通知→开场弹窗→场景描述），多轮扫描直至全部关闭
  for (let round = 0; round < 6; round += 1) {
    let closedSomething = false;
    for (const close of closers) {
      if (await close.first().isVisible().catch(() => false)) {
        await close.first().click({ timeout: 1500, force: true }).catch(() => {});
        closedSomething = true;
        await page.waitForTimeout(150);
      }
    }
    if (!closedSomething) break;
  }
}

// 清空全部本地存档（四手动槽 + 旧单存档 + 自动保存 + 最近活跃槽 + 辅助 key），
// 与 useWorldSave.clearAllWorldSaves 保持一致，确保每次都是真正的全新开局。
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

async function startFreshChapter(page: Page): Promise<void> {
  await page.goto("/world");
  await clearAllSaves(page);
  await page.reload();

  // 推进开场引子：逐拍点击「继续/进入伊甸园」，末拍会弹出「神明献礼三选一」，
  // 选中一份献礼后才会进入 explore 阶段（对话框顶栏出现「地图」入口）。
  const advance = page.locator(".eden-btn--beat-advance");
  const giftCard = page.locator('[data-testid="gift-choice-card"]');
  for (let index = 0; index < 12; index += 1) {
    if (await page.getByTestId("world-map-open").isVisible().catch(() => false)) break;
    if (await giftCard.first().isVisible().catch(() => false)) {
      await giftCard.first().click({ timeout: 2000, force: true }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    if (await advance.isVisible().catch(() => false)) {
      await advance.click({ timeout: 2000, force: true }).catch(() => {});
    }
    await page.waitForTimeout(250);
  }
  // 进入 explore 后会弹出全局开场弹窗 / 场景描述弹窗，关闭遮罩再继续
  await dismissModals(page);
  await expect(page.getByTestId("world-map-open")).toBeVisible();
}

// 实时世界状态改为通过 window.__EDEN_WORLD_STATE__ 读取：
// 存档已改为手动槽位 + 自动保存，实时状态不再持续写入 localStorage，
// 页面挂载了只读测试桥（见 src/app/world/page.tsx）供 e2e 读取。
async function readStoredState(page: Page): Promise<StoredWorldState> {
  return page.evaluate(() => {
    const s = (window as unknown as { __EDEN_WORLD_STATE__?: unknown }).__EDEN_WORLD_STATE__;
    if (!s) throw new Error("World state bridge (__EDEN_WORLD_STATE__) not available");
    return s as StoredWorldState;
  });
}

// 将当前实时状态写入手动槽位 1（模拟玩家存档），供刷新后读档校验。
async function persistToSlot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as { __EDEN_WORLD_STATE__?: unknown }).__EDEN_WORLD_STATE__;
    if (!s) throw new Error("World state bridge (__EDEN_WORLD_STATE__) not available");
    const data = { state: s, savedAt: new Date().toISOString(), slotIndex: 1 };
    window.localStorage.setItem("eden:chapter1:save:slot1", JSON.stringify(data));
    window.localStorage.setItem("eden:chapter1:save:last-active", "1");
  });
}

async function moveTo(page: Page, locationId: string): Promise<void> {
  const ap = await page.evaluate(() => (
    (window as unknown as { __EDEN_WORLD_STATE__?: { actionPoints?: number } }).__EDEN_WORLD_STATE__?.actionPoints ?? 0
  ));
  if (ap <= 0) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "进入下一轮" }).click();
    await expect.poll(async () => (await readStoredState(page)).actionPoints).toBeGreaterThan(0);
  }
  await page.getByTestId("world-map-open").click();
  await page.getByTestId(`location-card-${locationId}`).click();
  await page.getByTestId("world-map-enter").click();
  await expect.poll(async () => (await readStoredState(page)).locationId).toBe(locationId);
  // 本局首次进入探索时会弹出场景描述；其余地点不会重复打断，仍兼容关闭残留遮罩。
  await dismissModals(page);
}

test.describe("第一章场景问答完整流程", () => {
  test("新存档完成三道问答，刷新后不重复领奖", async ({ page }) => {
    await startFreshChapter(page);

    await expect(page.getByTestId("scene-action-engraved-stone")).toBeVisible();
    await expect(page.getByTestId("scene-action-hedgehog")).toBeVisible();
    await page.getByTestId("scene-action-engraved-stone").click();

    const modal = page.getByTestId("scene-puzzle-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("刻名石");
    await expect(page.getByTestId("scene-puzzle-prompt")).toContainText("名字");
    // 刻名石为自由文本问答，不渲染选项
    await expect(page.getByTestId("scene-puzzle-input")).toBeVisible();

    // 自由文本：任意非空输入即判定成功（规则层本地判定，不依赖 LLM）
    await page.getByTestId("scene-puzzle-input").fill("蛇");
    await page.getByTestId("scene-puzzle-submit").click();

    // 成功后进入第二步（显式点击引导），标题切换为「仅是一个念头」，反馈/奖励隐藏
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("仅是一个念头");
    // 发奖会弹出「获得回响」通知遮罩，拦截确认按钮，先关掉
    await dismissModals(page);
    await page.getByTestId("scene-puzzle-confirm").click();

    let state = await readStoredState(page);
    expect(state.discoveredClues).toContain("clue_naming_stones");
    expect(state.inventory).toContain("resonance_living_names");
    expect(state.itemCounts.resonance_living_names).toBe(1);

    // 重复提交同一自由文本：已通关不重复发奖
    const duplicateResponse = await page.request.post("/api/world/puzzle", {
      data: {
        state,
        puzzleId: "puzzle_naming_stone_identity",
        answerText: "蛇",
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
    expect(duplicateBody.result.state.itemCounts.resonance_living_names).toBe(1);

    await page.getByTestId("world-inventory-toggle").click();
    await expect(page.getByTestId("inventory-panel")).toContainText("万物名录");
    await page.getByRole("button", { name: "关闭回响面板" }).click();
    await page.getByRole("button", { name: "线索与记录" }).click();
    await expect(page.getByTestId("clue-panel")).toContainText("命名石痕");

    // 已完成谜题再次点击入口：仅提示，不再弹窗
    await page.getByTestId("scene-action-engraved-stone").click();
    await expect(modal).toHaveCount(0);
    state = await readStoredState(page);
    expect(state.itemCounts.resonance_living_names).toBe(1);

    await moveTo(page, "central_meadow");
    await moveTo(page, "tree_court");
    await moveTo(page, "east_garden_path");

    // 东园幽径（白天）：显式入口，到达不再自动弹窗；题目为「东风所传」
    await page.getByTestId("scene-action-east-path-end").click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("东风所传");
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(4);

    const eastPathIds = [
      "puzzle_east_path_cautious_presence_day",
      "puzzle_east_path_cautious_presence_night",
    ];

    // per_option 模式：每个选项独立结算，无「错误答案」概念。
    // 选「伏地辨认园中每一道声音落向何处。」（echo_of_beings）：不改动行动点上限。
    await page.getByTestId("scene-puzzle-option").filter({ hasText: "伏地辨认" }).click();
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("远处的声音");
    await dismissModals(page);
    await page.getByRole("button", { name: "继续" }).click();

    await moveTo(page, "naming_stone_bank");
    await moveTo(page, "east_garden_path");
    await expect(modal).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "进入下一轮" }).click();
    // 基础行动点为 4；本局尚未获得任何 AP 上限加成，进入下一轮恢复为 4
    await expect.poll(async () => (await readStoredState(page)).actionPoints).toBe(4);

    await moveTo(page, "naming_stone_bank");
    await moveTo(page, "four_river_source");

    // 伊甸之河：显式入口，per_option 每个选项独立结算
    await page.getByTestId("scene-action-eden-river").click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("伊甸之河");
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(4);
    const riverResp = page.waitForResponse(
      (r) => r.url().includes("/api/world/puzzle") && r.request().method() === "POST",
      { timeout: 5000 },
    ).catch(() => null);
    await page.getByTestId("scene-puzzle-option").filter({ hasText: "让疲惫随着水流离开" }).click();
    const rr = await riverResp;
    console.log(`[RIVER] status=${rr ? rr.status() : "NO-RESPONSE"} body=${rr ? await rr.text() : "n/a"}`);
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("水声洗去了你的疲惫");
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("四河回声");
    await dismissModals(page);
    await page.getByRole("button", { name: "继续" }).click();

    state = await readStoredState(page);
    expect(state.itemCounts.resonance_four_river_echo).toBe(1);
    expect(state.completedScenePuzzleIds).toEqual(expect.arrayContaining([
      "puzzle_naming_stone_identity",
      "puzzle_river_words_belonging",
    ]));
    expect(eastPathIds.some((id) => state.completedScenePuzzleIds.includes(id))).toBe(true);

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

    // 存档改为手动槽位：刷新前先写入槽位 1，模拟玩家保存后重进
    await persistToSlot(page);
    await page.reload();
    // 读档恢复后可能弹出场景描述遮罩，关掉不影响断言
    await dismissModals(page);
    await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);
    state = await readStoredState(page);
    expect(state.itemCounts.resonance_living_names).toBe(1);
    expect(state.itemCounts.resonance_echo_of_beings).toBe(1);
    expect(state.itemCounts.resonance_four_river_echo).toBe(1);
  });

  test("园心双树四选一：首次拾月光不锁死谜题，可再入", async ({ page }) => {
    await startFreshChapter(page);
    await moveTo(page, "central_meadow");

    const modal = page.getByTestId("scene-puzzle-modal");
    await page.getByTestId("scene-action-central-trees").click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toContainText("园心双树");
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(4);
    // prompt 提醒左右：左侧生命树、右侧分别善恶树
    await expect(page.getByTestId("scene-puzzle-prompt")).toContainText("生命树");
    await expect(page.getByTestId("scene-puzzle-prompt")).toContainText("分别善恶树");

    // 第一次拾月光：得 1 枚，谜题未锁死（maxStacks=2 机制）
    await page.getByTestId("scene-puzzle-option").filter({ hasText: "月光" }).click();
    await expect(page.getByTestId("scene-puzzle-feedback")).toContainText("月光");
    await expect(page.getByTestId("scene-puzzle-reward")).toContainText("月光道标");
    // 首次获得回响会弹出「获得回响」通知 + 首闻回响气泡，遮罩会拦截「继续」：
    // 先等首闻气泡自动消失（6s），再关掉通知遮罩，然后点「继续」。
    await page.getByTestId("world-first-resonance-hint").waitFor({ state: "detached", timeout: 9000 });
    await dismissModals(page);
    await page.getByRole("button", { name: "继续" }).click();
    await expect(modal).toHaveCount(0);

    let state = await readStoredState(page);
    expect(state.itemCounts.moonlight_path_marker).toBe(1);
    expect(state.completedScenePuzzleIds).not.toContain("puzzle_central_twin_trees");

    // 谜题未锁死：再次点击入口仍可弹窗（可拾第二枚月光）
    await dismissModals(page);
    await page.getByTestId("scene-action-central-trees").click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-option")).toHaveCount(4);
  });
});
