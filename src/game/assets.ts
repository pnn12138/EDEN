// ============================================================
// Chapter 0 素材路径常量
// Phase 5：最小 UI 与素材包装
// ============================================================

export const CHAPTER0_IMAGES = {
  edenBackground: "/assets/chapter0/images/eden_background.png",
  evePortrait: "/assets/chapter0/images/eve_portrait.png",
  serpentIcon: "/assets/chapter0/images/serpent_icon.png",
  forbiddenFruit: "/assets/chapter0/images/forbidden_fruit.png",
  endingEveEatsFruit: "/assets/chapter0/images/ending_eve_eats_fruit.png",
  endingGodArrives: "/assets/chapter0/images/ending_god_arrives.png",

  // 成功结局剧情过场图（初次堕落事件链）
  endingAdamTakesFruit: "/assets/chapter0/images/ending_adam_takes_fruit_v2.png",
  endingExileFromEden: "/assets/chapter0/images/ending_exile_from_eden_v2.png",

  // 第二伊甸园候选素材（非破坏性新增）
  secondEdenBackground: "/assets/chapter0/images/second_eden_background_candidate.png",
  secondEdenForbiddenFruit: "/assets/chapter0/images/second_eden_forbidden_fruit_candidate.png",
  secondEdenEvePortrait: "/assets/chapter0/images/second_eden_eve_portrait_candidate.png",

  // 创世 CG（Beat 1 使用）
  genesisCreationLight: "/assets/chapter0/images/genesis_creation_light_candidate.png",

  // 夏娃全身立绘（对话阶段场景人物层）
  eveFullbodySprite: "/assets/chapter0/images/eve_fullbody_sprite_candidate.png",

  // 对话背景 v2（自然干地空地，可放置双角色立绘）
  edenDialogueBackgroundV2: "/assets/chapter0/images/eden_dialogue_background_v2.png",

  // 亚当全身立绘 v2（对话阶段场景人物层，可被选中对话）
  adamFullbodySprite: "/assets/chapter0/images/adam_fullbody_sprite_v2.png",

  // 伊甸园小动物：刺猬（场景氛围角色，不参与通关逻辑）
  // v2 为半写实透明 PNG 立绘；旧 hedgehog_sprite.svg 为废弃占位素材，保留存档
  hedgehogSprite: "/assets/chapter0/images/hedgehog_sprite_v2.png",
} as const;

export const CHAPTER0_AUDIO = {
  edenAmbient: "/assets/chapter0/audio/eden_ambient_loop.mp3",
  whisperSubmit: "/assets/chapter0/audio/whisper_submit.mp3",
  temptationProgress: "/assets/chapter0/audio/temptation_progress.mp3",
  fruitTaken: "/assets/chapter0/audio/fruit_taken.mp3",
  godArrives: "/assets/chapter0/audio/god_arrives.mp3",
  genesisCreationBgm: "/assets/chapter0/audio/genesis_creation_bgm.mp3",
} as const;
