# 园中回响道具分析（v3.0）

> 版本：v3.0  
> 日期：2026-07-10  
> 基于现有代码 `src/content/world/items.ts` 和 `src/game/world/resonanceRules.ts` 的道具清单，分析保留/删除/重新分配。  
> NPC精简后：米迦勒（伊甸之河）、加百列（东园幽径）、路西法（四河分流）、亚当（万物受名处）、女人（园中树林）、刺猬（东园幽径）。

---

## 1. 因角色删除而移除的道具

| 道具ID | 道具名 | 来源 | 处理 |
|---|---|---|---|
| `resonance_river_dew` | 河水清露 | 拉斐尔 | ❌ 删除 |
| `resonance_morning_flame` | 晨焰碎片 | 乌列尔 | ❌ 删除 |
| `resonance_east_gate_glow` | 东门辉光 | 基路伯 | ❌ 删除 |
| `resonance_deer_glance` | 鹿之回眸 | 小鹿 | ❌ 删除 |
| `resonance_fox_tail_note` | 狐尾之语 | 狐狸 | ❌ 删除 |
| `resonance_white_feather_echo` | 白羽回声 | 鸽子 | ❌ 删除 |

---

## 2. 保留但重新分配来源的道具

| 道具ID | 道具名 | 原来源 | 新来源 | 说明 |
|---|---|---|---|---|
| `resonance_boundary_mark` | 边界之痕 | 米迦勒（原四河分流） | **米迦勒（伊甸之河）**——守护河源边界，脚下水痕即是边界 | 保持"边界"主题，移到新位置 |
| `resonance_herald_feather` | 传令白羽 | 加百列（原伊甸之河） | **加百列（东园幽径）**——信使的羽毛，留在东边界 | 移到新位置 |
| `resonance_hedgehog_bristle` | 刺猬之针 | 刺猬 | **刺猬（东园幽径）**——不变 | 保留 |

---

## 3. 新增道具（为精简后的天使扩展）

| 道具ID | 道具名 | 来源 | 类型 | 效果 |
|---|---|---|---|---|
| `resonance_lucifer_star` | 晨星碎片 | 路西法（四河分流） | consumable | 使用后下一次对女人低语：challenge_prohibition + self_judgement 信号自动+1，但神注视+1 |
| `resonance_michael_dew` | 河源露 | 米迦勒（伊甸之河） | instant | 即时使用，恢复 1 AP |
| `resonance_gabriel_wind` | 东之风 | 加百列（东园幽径） | consumable | 使用后下一次低语可隔地点进行，不增神注视 |

---

## 4. 保留不变的道具（场景互动/满好感/神明献礼）

| 道具ID | 道具名 | 来源 | 获取方式 |
|---|---|---|---|
| `resonance_still_leaf` | 静息之叶 | 伊甸之河·场景互动 | 浅滩饮水/触碰河水中漂浮的叶子 |
| `resonance_borrowed_name` | 借来的名字 | 万物受名处·场景互动 | 触摸刻名石 |
| `resonance_silent_grass` | 无声草 | 园中树林·场景互动 | 在落叶下找到 |
| `resonance_four_river_echo` | 四河回声 | 四河分流·场景互动 | 在分岔处听水 |
| `resonance_living_names` | 万物名录 | 万物受名处·刻名石 | 解谜后获得（永久被动） |
| `resonance_adam_quiet_bond` | 静契之石 | 亚当 | serpentTrust 满100 |
| `resonance_eve_own_voice` | 她自己的声音 | 女人 | serpentTrust 满100且女人未吃过果子 |
| `consumable_first_whisper_free` | 首语印记 | 场景 | 保留 |
| `consumable_trust_dew` | 信任之露 | 场景 | 保留 |
| `passive_light_step` | 轻步印记 | 场景 | 保留 |
| `passive_soft_whisper` | 细语印记 | 场景 | 保留 |
| `moonlight_path_marker` | 月光道标 | 园子中央·夜晚 | 点击月亮 |
| `gift_sabbath_dew` | 息日露滴 | 神（献礼） | divineAttention=4 |
| `gift_revealing_light` | 照见之光 | 神（献礼） | divineAttention=4 |
| `gift_wide_path_seal` | 宽行之印 | 神（献礼） | divineAttention=4 |

---

## 5. NPC 满好感（serpentTrust=100）奖励汇总

| NPC | 奖励道具 | 效果 |
|---|---|---|
| 女人 | 她自己的声音 | 永久被动：低语时更容易降低她的 obedience |
| 亚当 | 静契之石 | 一次性消耗：下一次低语更温和 |
| 米迦勒 | 河源露 | 即时：恢复 1 AP（可重复获得） |
| 加百列 | 传令白羽 | 一次性消耗：下一次低语更温和 |
| 路西法 | 晨星碎片 | 一次性消耗：强诱导+高风险 |
| 刺猬 | 刺猬之针 | 一次性消耗：下次移动不消耗AP |

---

## 6. NPC 主动给予道具的触发条件（好感度之外）

| NPC | 道具 | 触发条件 |
|---|---|---|
| 米迦勒 | 河源露 | 在伊甸之河与他对话时，提到"水""源头"等话题，且 obedient 足够低（< 60）时主动给 |
| 加百列 | 东之风 | 夜晚在东园幽径与他对话，提到"风""东边""消息"时主动给 |
| 路西法 | 晨星碎片 | 夜晚在四河分流，与他讨论"外面""为什么""水流去哪里"时主动给 |
| 亚当 | 女人的行迹情报 | 在万物受名处问他"她在哪里"时告知 |
| 刺猬 | 刺猬之针 | 多次对话后，如果刺猬不害怕（serpentTrust > 50），主动抖落 |

设计原则：场景互动获得基础回响稳定可靠；NPC 满好感获得强力回响需要投入时间；特定对话触发获得额外奖励需要玩家真的"聊对话题"。
