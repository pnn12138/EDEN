// ============================================================
// 结局 AI 创作（图片）最小覆盖
// - 纯函数单测：图片数量服务端校验、尺寸解析、Ark b64 → data: URL
// - 接口集成：请求数量受服务端校验；图片失败时不伪造本地素材
// - UI：生成失败保留文字分镜；「打开设置」实际打开设置并切到「AI 创作」
// 不调用任何真实图片/视频接口。
// ============================================================

import { expect, test, type Page } from "@playwright/test";
import {
  clampImageCount,
  resolveImageSize,
  defaultImageSizeFor,
  toDisplayableImageUrl,
} from "../../src/lib/endingImageGen";

async function seedFinished(page: Page): Promise<void> {
  await page.goto("/world");
  await page.evaluate(() => {
    [
      "eden:chapter1:save:slot1",
      "eden:chapter1:save:last-active",
      "eden:chapter1:autosave",
      "eden:chapter1:world-state:v2",
    ].forEach((k) => window.localStorage.removeItem(k));
  });
  const state = await page.evaluate(() => {
    const base = (window as unknown as { __EDEN_WORLD_STATE__?: Record<string, unknown> }).__EDEN_WORLD_STATE__ ?? {};
    return { ...base, chapterId: "chapter1_garden_voices", endingId: "eve_eats_fruit", isEnded: true, phase: "ending", timeSlot: 6 };
  });
  await page.evaluate((seeded) => {
    window.localStorage.setItem(
      "eden:chapter1:save:slot1",
      JSON.stringify({ state: seeded, savedAt: new Date().toISOString(), slotIndex: 1 }),
    );
    window.localStorage.setItem("eden:chapter1:save:last-active", "1");
    window.sessionStorage.setItem(
      "eden:chapter1:ending-media-settings",
      JSON.stringify({ imageCount: 1, imageHope: "突出月光", imageProvider: "", imageKey: "", imageBaseUrl: "https://127.0.0.1", imageModel: "", imageSize: "" }),
    );
  }, state);
  await page.reload();
  const cinematic = page.getByTestId("hidden-ending-cinematic");
  if (await cinematic.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByTestId("hidden-ending-skip").click();
  }
  await expect(page.locator(".eden-ending-review")).toBeVisible();
}

test.describe("结局媒体：纯函数与接口边界", () => {
  test("图片数量服务端校验 1 <= count <= min(6, playedSlots)", () => {
    expect(clampImageCount(0, 5)).toBe(1);
    expect(clampImageCount(-3, 5)).toBe(1);
    expect(clampImageCount(99, 3)).toBe(3);
    expect(clampImageCount(2, 1)).toBe(1);
    expect(clampImageCount(7, 12)).toBe(6);
    expect(clampImageCount(NaN, 4)).toBe(1);
  });

  test("图片尺寸解析：Ark/Seedream → 2K；玩家/服务端优先；其他 → 1024x1024", () => {
    expect(defaultImageSizeFor("ark", "seedream-3.0")).toBe("2K");
    expect(defaultImageSizeFor(null, "doubao-seedream-2.0-mini")).toBe("2K");
    expect(defaultImageSizeFor("volcengine", "ep-xxxx")).toBe("2K");
    expect(defaultImageSizeFor("openai", "dall-e-3")).toBe("1024x1024");
    // 玩家设置优先
    expect(resolveImageSize({ imageSize: "512x512" })).toBe("512x512");
    // 其次服务端 IMAGE_SIZE
    expect(resolveImageSize({}, { IMAGE_SIZE: "768x768" })).toBe("768x768");
    // 否则按 provider/model 推断
    expect(resolveImageSize({ imageProvider: "ark" })).toBe("2K");
    expect(resolveImageSize({ imageProvider: "openai" })).toBe("1024x1024");
  });

  test("Ark b64_json → 浏览器可显示 data: URL；直链原样返回", () => {
    expect(toDisplayableImageUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(toDisplayableImageUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(toDisplayableImageUrl("aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=");
  });

  test("接口：无效自定义图像地址时返回界内 imageCount且保留文字分镜", async ({ request }) => {
    const state = {
      chapterId: "chapter1_garden_voices",
      endingId: "eve_eats_fruit",
      isEnded: true,
      phase: "ending",
      timeSlot: 3,
    };
    const resp = await request.post("/api/world/ending-media", { data: { state, mediaSettings: { imageCount: 1, imageHope: "突出月光", imageProvider: "", imageKey: "", imageBaseUrl: "https://127.0.0.1", imageModel: "", imageSize: "" } } });
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    const max = Math.min(6, state.timeSlot);
    expect(body.storyboard.imageCount).toBe(1);
    expect(body.storyboard.imageCount).toBeLessThanOrEqual(max);
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images.length).toBe(0);
    expect(typeof body.imagesAvailable).toBe("boolean");
    expect(body.imageError).toBeTruthy();
  });
});

test.describe("结局媒体：UI 兜底与打开设置", () => {
  test("无图像配置生成时保留文字分镜", async ({ page }) => {
    await seedFinished(page);
    await page.getByTestId("ending-memory-generate").click();
    // 文字分镜兜底卡片出现；失败态的「打开设置」不应出现（非 error 分支）
    await expect(page.getByText(/图片生成失败|未配置可用的图片生成服务/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("ending-memory-card-text").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("ending-memory-open-settings")).toHaveCount(0);
  });

  test("生成失败（接口 500）时「打开设置」打开设置并切到模型配置页", async ({ page }) => {
    await seedFinished(page);
    await page.route("**/api/world/ending-media", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.getByTestId("ending-memory-generate").click();
    await expect(page.getByTestId("ending-memory-open-settings")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("ending-memory-open-settings").click();
    // 设置浮窗打开并定位到「模型配置」页签
    await expect(page.locator(".eden-settings-tab", { hasText: "模型配置" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("图像 Provider")).toBeVisible();
  });
});
