# Player Manual - ZJU Merge MVP

## Game Goal
- Merge same-level ZJU elements to reach higher levels and score as much as possible.
- Keep the stack below the red danger line.

## Core Loop
1. Click or tap above the red line to drop an element.
2. Two identical levels collide and merge into level +1.
3. Chain merges trigger combo bonuses.
4. Survive as long as possible and push score/max level.

## Rules
- Spawn: each drop consumes the queued "next" element.
- Queue: after each drop, a new level-1/2 element is queued.
- Merge cap: level 12 is the highest level.

## Failure Rule
- Default mode: `grace` (forgiving).
- Red line position: `DANGER_LINE_RATIO = 0.14` (line is near top).
- Detection margin: only counts as overline when element top exceeds `8px` above line.
- Grace timeout: `FAILURE_GRACE_MS = 4200`ms.
- Clear timeout: if stack is safe for `FAILURE_CLEAR_MS = 900`ms, danger timer resets.

## Combo Bonus
- If two merges happen within `COMBO_WINDOW_MS`, combo increases.
- Score formula per merge:
- `finalAddScore = floor(baseScore * (1 + 0.1 * (comboCount - 1)))`
- Higher combo gives higher bonus and floating combo text feedback in scene.

## Why It Feels Good
- Quick session: easy one-hand input.
- Immediate feedback: merge pop + score jump + combo floating text.
- Strategy layer: queued next-element preview helps planning.
- Stability layer: high-level density decays by level to reduce late-game physics chaos.

## HUD Guide
- `Next`: current queued element level/key.
- `Combo`: latest combo and bonus score.
- `Status`: running or game over.
- `Debug Panel` (toggle): danger ratio, density, queued element, fail mode, merge stats.

## Controls
- `bouncy / balanced / heavy`: switch feel presets.
- `restart`: reset current run.
- `show-debug`: open runtime diagnostics.

## Current MVP Scope
- Included: drop, collide, merge, score, combo, fail, restart, debug.
- Not yet included: polished VFX/SFX pipeline, progression economy UI, ranking backend integration.