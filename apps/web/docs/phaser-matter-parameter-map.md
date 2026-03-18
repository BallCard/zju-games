# Phaser / Matter 参数映射与调参手册

> 用途：把“手感目标”快速映射到 Phaser 3 + Matter 可调参数，支持你做 bouncy / balanced / heavy 三套 A/B。

## 1. 参数映射表

| 手感目标 | Matter 参数 | Phaser 常见写法 | 调大后的效果 | 推荐区间 |
|---|---|---|---|---|
| 更Q弹 | `restitution` | `setBounce()`（Arcade语义） | 碰撞回弹更明显 | `0.02 ~ 0.9` |
| 更容易滑动 | `friction` | `setFriction()` | 与接触面摩擦增大（更不滑） | `0.001 ~ 0.8` |
| 起步更“黏” | `frictionStatic` | body options | 静止时更不易被推走 | `0.01 ~ 1.2` |
| 空中更“重” | `frictionAir` | body options | 空气阻力更强、速度衰减更快 | `0.001 ~ 0.12` |
| 更重更稳 | `density` / `mass` | body options / `setMass()` | 更难被小球撞飞 | `0.0008 ~ 0.008` |
| 更快静止 | `sleepThreshold` | world/body options | 微抖动体更快休眠 | `20 ~ 60` |
| 更软碰撞容差 | `slop` | body options | 轻微穿插容忍更高 | `0.01 ~ 0.08` |
| 固定朝向 | `inertia: Infinity` | body options | 禁止旋转 | `Infinity` |
| 过滤碰撞 | `collisionFilter` | body options | 控制谁和谁碰 | 分类位掩码 |
| 全局“重力感” | `world.gravity.y` | `physics.matter.gravity.y` | 下落更快 | `0.8 ~ 1.25` |
| 世界时间缩放 | `engine.timing.timeScale` | world config | 整体慢动作/快动作 | `0.8 ~ 1.1` |

## 2. Phaser 配置对应点

1. 全局重力：`physics.matter.gravity.y`
2. 单体参数：`this.matter.add.image(..., { restitution, friction, frictionAir, density })`
3. 世界边界：`this.matter.world.setBounds(...)`
4. 防止大球被顶飞：提高大球 `density`，降低小球 `restitution`，并给大球更高 `frictionStatic`

## 3. 调参顺序（建议）

1. 先定 `gravity.y`（整体节奏）
2. 再定 `restitution`（Q弹度）
3. 再定 `friction + frictionAir`（控不控得住）
4. 最后定 `density`（重量层级关系）

## 4. 三套首轮手感基线

| 预设 | gravityY | restitution | friction | frictionAir | densityScale | 关键词 |
|---|---:|---:|---:|---:|---:|---|
| bouncy | 0.92 | 0.22 | 0.010 | 0.006 | 0.90 | Q弹、连锁多、魔性 |
| balanced | 1.02 | 0.10 | 0.018 | 0.012 | 1.00 | 默认、稳定、可控 |
| heavy | 1.12 | 0.04 | 0.030 | 0.020 | 1.20 | 厚重、压迫、策略 |
