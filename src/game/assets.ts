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
  secondEdenPrologueBackground: "/assets/chapter0/images/second_eden_prologue_background.png",
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
  // v2 为半写实透明 PNG 立绘（850x708，绿幕 chroma-key 抠图）；旧 hedgehog_sprite.svg 为废弃占位素材，保留存档
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

export const CHAPTER1_IMAGES = {
  edenWorldMap: "/assets/chapter1/images/eden_world_map_final.png",
  // 最终地点背景：由 Codex 生成图接入（2026-06-22）
  // 旧 v3 WebP 保留作为回滚路径，不再引用
  centralMeadow: "/assets/chapter1/images/location_central_meadow_final.png",
  fourRiverSource: "/assets/chapter1/images/location_four_river_source_final.png",
  adamGardenWork: "/assets/chapter1/images/location_adam_garden_work_final.png",
  treeCourt: "/assets/chapter1/images/location_tree_court_final.png",
  eastGardenPath: "/assets/chapter1/images/location_east_garden_path_final.png",
  namingStoneBank: "/assets/chapter1/images/location_naming_stone_bank_final.png",
  // 三位天使独立透明立绘（v3.0：加百列 / 米迦勒 / 路西法）
  gabrielSprite: "/assets/chapter1/images/npc_gabriel_sprite.png",
  michaelSprite: "/assets/chapter1/images/npc_michael_sprite.png",
  luciferSprite: "/assets/chapter1/images/npc_lucifer_sprite.png",
  // 圆润版刺猬透明立绘（1254x1254 RGBA），第一章万物受名处专用
  hedgehogRoundedSprite: "/assets/chapter1/images/npc_hedgehog_rounded_final.png",
  // 夜景背景（2026-06-22 Codex 生成）
  centralMeadowNight: "/assets/chapter1/images/location_central_meadow_final_night_1920.webp",
  fourRiverSourceNight: "/assets/chapter1/images/location_eden_river_night_1920.webp",
  adamGardenWorkNight: "/assets/chapter1/images/location_naming_place_night_1920.webp",
  treeCourtNight: "/assets/chapter1/images/location_garden_woods_night_1920.webp",
  eastGardenPathNight: "/assets/chapter1/images/location_east_path_night_1920.webp",
  namingStoneBankNight: "/assets/chapter1/images/location_four_rivers_night_1920.webp",
  // 园子中央终局夜景
  centralMeadowFinalNight: "/assets/chapter1/images/location_central_meadow_final_night_1920.webp",
} as const;

export const CHAPTER1_AUDIO = {
  // 第一章环境底噪
  edenWorldAmbient: "/assets/chapter1/audio/chapter1_eden_world_ambient.mp3",
  // 四河源头水声循环
  fourRiverSourceLoop: "/assets/chapter1/audio/four_river_source_loop.mp3",
  // 地图移动柔和脚步
  mapMoveSoftSteps: "/assets/chapter1/audio/map_move_soft_steps.mp3",
  // 观察地点提示铃音
  observeLocationChime: "/assets/chapter1/audio/observe_location_chime.mp3",
  // NPC 对话低声背景
  npcDialogueMurmur: "/assets/chapter1/audio/npc_dialogue_murmur.mp3",
  // 刺猬草丛沙沙声
  hedgehogRustle: "/assets/chapter1/audio/hedgehog_rustle.mp3",
  // 神的注视上升
  divineAttentionRise: "/assets/chapter1/audio/divine_attention_rise.mp3",
  // 远处天使羽翼声
  angelWingDistant: "/assets/chapter1/audio/angel_wing_distant.mp3",
  // 看向树微光铃音
  treeLookChime: "/assets/chapter1/audio/tree_look_chime.mp3",
  // 靠近树低频上升音
  approachTreeLowRise: "/assets/chapter1/audio/approach_tree_low_rise.mp3",
  // 触果前紧张音
  touchFruitTension: "/assets/chapter1/audio/touch_fruit_tension.mp3",
  // 结局：成功（夏娃吃下果子）
  endingSuccess: "/assets/chapter1/audio/ending_success.mp3",
  // 结局：失败（神降临）
  endingFailure: "/assets/chapter1/audio/ending_failure.mp3",
  // 神明献礼：光落
  divineGiftLight: "/assets/chapter1/audio/divine_gift_light.mp3",
  // 获得回响（天使回响）
  resonanceGain: "/assets/chapter1/audio/resonance_gain.mp3",
  // 解锁园中印记
  markUnlock: "/assets/chapter1/audio/mark_unlock.mp3",
  // 昼夜切换
  dayNightShift: "/assets/chapter1/audio/day_night_shift.mp3",
  // godWalksInGarden 复用 Chapter0 godArrives，无需新增
} as const;
