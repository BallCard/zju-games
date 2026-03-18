# 数据库 Schema（核心）

## `users`
- `id` UUID PK
- `anonymous_uid` VARCHAR(32) UNIQUE
- `device_fingerprint` VARCHAR(128)
- `nickname` VARCHAR(24)
- `avatar_frame` VARCHAR(32)
- `signature` VARCHAR(64)
- `school` VARCHAR(32) DEFAULT 'ZJU'
- `department` VARCHAR(64) NULL
- `grade` VARCHAR(16) NULL
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

## `game_sessions`
- `id` UUID PK
- `user_id` UUID FK -> users.id
- `mode` VARCHAR(16)
- `score` INT
- `duration_sec` INT
- `result` VARCHAR(16)（win/lose）
- `combo_max` INT
- `board_seed` VARCHAR(64)
- `created_at` TIMESTAMP

## `collection_items`
- `id` UUID PK
- `code` VARCHAR(32) UNIQUE
- `name` VARCHAR(64)
- `category` VARCHAR(16)（landmark/discipline）
- `rarity` VARCHAR(16)
- `meta_json` JSONB

## `user_collections`
- `id` UUID PK
- `user_id` UUID FK -> users.id
- `item_id` UUID FK -> collection_items.id
- `level` INT DEFAULT 1
- `unlocked_at` TIMESTAMP

## `leaderboard_entries`
- `id` UUID PK
- `user_id` UUID FK -> users.id
- `season_id` UUID FK -> seasons.id
- `scope` VARCHAR(16)（global/department/friend）
- `best_score` INT
- `rank` INT
- `updated_at` TIMESTAMP

## `seasons`
- `id` UUID PK
- `name` VARCHAR(64)
- `start_at` TIMESTAMP
- `end_at` TIMESTAMP
- `status` VARCHAR(16)

## `missions`
- `id` UUID PK
- `season_id` UUID FK -> seasons.id
- `type` VARCHAR(32)
- `target` INT
- `reward_json` JSONB

## `user_missions`
- `id` UUID PK
- `user_id` UUID FK -> users.id
- `mission_id` UUID FK -> missions.id
- `progress` INT
- `claimed` BOOLEAN DEFAULT FALSE

# API 端点合同

## Auth
- `POST /api/v1/auth/anonymous-login`
- `POST /api/v1/auth/refresh`

## Game
- `POST /api/v1/game/session/start`
- `POST /api/v1/game/session/finish`
- `GET /api/v1/game/config`

## Collection
- `GET /api/v1/collections`
- `GET /api/v1/collections/progress`

## Leaderboard
- `GET /api/v1/leaderboard?scope=global|department|friend`
- `GET /api/v1/leaderboard/me`

## Profile
- `GET /api/v1/profile`
- `PATCH /api/v1/profile`

## Missions & Events
- `GET /api/v1/seasons/active`
- `GET /api/v1/missions`
- `POST /api/v1/missions/:id/claim`

# 认证逻辑
- 首次启动：客户端生成设备指纹 -> 调用匿名登录 -> 返回 JWT
- 请求鉴权：`Authorization: Bearer <access_token>`
- Access Token 15 分钟过期，Refresh Token 30 天
- 异常控制：单设备高频请求限流，排行榜提交做签名校验
