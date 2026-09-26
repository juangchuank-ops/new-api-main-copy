# 本地仓库 vs 上游 QuantumNous/new-api 对比报告

- **生成时间**：2026-09-25
- **本地 HEAD**：`91a719147` — *fix(web): restore session on full page reload* (2026-09-17)
- **上游 HEAD**：`c2b7a9a9e` — *fix(claude): preserve per-message output_config in Claude messages (#7561)* (2026-09-25)
- **对比方式**：纯内容级对比，未修改任何代码

---

## 一、对比前提（重要）

| 项目 | 情况 |
|---|---|
| 本地 origin | `https://github.com/juangchuank-ops/new-api-main-copy.git`（自己的 fork） |
| upstream 远程 | **配置已被移除**，仅残留 `refs/remotes/upstream/main` 引用 |
| 共同祖先 | **无**（`git merge-base` 为空） |
| 本地历史 | 29 个提交，根提交为 `Initial clean import of the New API gateway` |
| 上游历史 | 6454 个提交，根提交为 2023-04-22 `Initial commit` |

**为什么不能做提交级对比**：本地仓库是「干净导入」重建的历史，与上游没有共同祖先；且提交日期与内容不一致（例如本地根提交日期标注为 2026-07-28，但其 `common/redis.go` 内容实际来自上游 2026-09-08 的 `ebe4c368f`）。

因此本报告采用**双向内容级对比**：直接比对两棵文件树，而不是比对提交历史。

---

## 二、总体差异统计

### 仓库规模

| | 文件数 |
|---|---|
| 本地 HEAD | 2958 |
| 上游 HEAD | 2540 |

### 文件重合度

| 类别 | 数量 | 占本地比 |
|---|---|---|
| **完全一致**（同路径同内容） | **672** | 22.7% |
| 同路径但内容不同 | 393 | 13.3% |
| 本地独有路径 | 1893 | 64.0% |
| 上游独有路径 | 1475 | — |

### 差异条目明细（`git diff --name-status upstream/main HEAD`）

| 状态 | 数量 | 含义 |
|---|---|---|
| A | 1266 | 本地新增（上游无此路径） |
| D | 848 | 上游有、本地无 |
| M | 393 | 同名但内容不同 |
| R | 627 | 重命名 / 目录移动 |

其中排除 `web/` 后的后端差异：**812 个**（M 391 / A 335 / D 86）。

> 结论：本地是一个**深度定制 fork**——近八成文件与上游不同，其中大量差异来自前端结构重构与 fork 自研功能。

---

## 三、结构性差异：前端双套 vs 单套

这是差异量最大的来源。

| | 上游 | 本地 |
|---|---|---|
| 前端目录 | `web/src`（1361 文件） | `web/classic`（553）+ `web/default`（1003） |
| 包管理 | `bun.lock`（单包） | `pnpm-workspace.yaml` + `pnpm-lock.yaml`（workspace） |

**关键节点**：上游在 `31d70fca3`（2026-07-20，*refactor(auth): replace dashboard sessions with stateless tokens*）中执行了 `web/{default => }`，即把 `web/default` 上提为 `web/` 根，并**删除了 `web/classic`**。

本地则**保留双主题结构**（classic + default），并把 classic 从 Vite 迁到了 Rsbuild。

因此仅前端一项就产生约 1500+ 个差异条目，属于**结构路线分歧**，不是内容落后。

---

## 四、上游相对本地新增的内容

### 4.1 上游独有文件（非前端，共 86 个）

**① AI 编码规范与技能（本地完全没有 `.agents/` 目录）**
```
.agents/github/ISSUE.md
.agents/github/PR.md
.agents/rules/billing.md                      ← 计费规则，带 read gate
.agents/skills/i18n-translate/SKILL.md
.agents/skills/shadcn-ui/SKILL.md + vendor/shadcn/*（10 个文件）
.agents/skills/vercel-react-best-practices/SKILL.md + references/full-guide.md
```

**② 插件 API 文档体系**
```
docs/plugin-api/README.md
docs/plugin-api/v1.md
docs/plugin-api/v1.d.ts
docs/plugin-api/v1.schema.json
controller/plugin_protocol_image.go
```

**③ Responses WebSocket 支持**
```
pkg/wsmanager/wsmanager.go (+ test)
relay/responses_websocket.go (+ test)
relay/responses_request.go
controller/responses_websocket.go (+ test)
service/ws_close.go
```

**④ 请求策略（Request Policy）**
```
model/request_policy.go (+ test)
service/request_policy.go
controller/request_policy.go
```

**⑤ 计费与用量**
```
service/responses_usage.go (+ test)
service/image_billing.go
relay/request_billing.go
model/model_pricing_conversion.go
model/legacy_dalle_pricing.go
relaykit/dto/legacy_dalle_image.go
```

**⑥ 渠道与推理**
```
controller/channel_inference.go (+ test)
relay/channel/advancedcustom/rerank.go
common/advanced_custom_presets.go
relay/channel/task/jsplugin/submit_stream.go
```

**⑦ Passkey / 安全**
```
model/passkey_option.go
docs/authentication.md
```

**⑧ 其他**
```
pkg/perf_metrics/outcome.go
service/relay_error.go (+ test)
relay/common/response_model.go (+ test)
e2e/doc_parse_test.go
electron/icon.png、tray-icon*.png（图标资源）
```

### 4.2 上游近一个月的重点新功能（2026-08-20 ~ 09-25）

**表达式计费（billingexpr）大改**
- `feat(billingexpr): support image cache and quantity variables`
- `feat(billing): support fixed per-request expression pricing`
- `feat(billing): add time-based pricing editor and expression previews`
- `feat(pricing): convert legacy prices into expression drafts`
- `feat(billing): configure trust threshold and input pre-consume multiplier`
- `feat: highlight differing values in source price expressions`

**模型 / 厂商管理重构**
- `feat(models): rework model/vendor management and pricing`
- `feat(models): add bulk field selection to metadata sync`

**认证与安全**
- `feat(auth): add safe multi-RP ID passkey support`
- `feat(auth): unify login verification and secure account deletion`
- `feat(security): add access token management and audit logs`
- `feat(audit): complete token and quota operation records`

**渠道插件体系**
- `feat(channel): bind multiple task plugins to New API channels`
- `feat(plugins): serve OpenAI Images API through task plugins`
- `feat(plugins): enhance task streaming and model pricing`
- `feat(web): improve plugin management and marketplace`

**渠道类型**
- `feat: vllm channel && sglang channel`
- `feat(ollama): add per-channel OpenAI-compatible chat switch`
- `feat(channel): per-route pass-through for advanced custom channels`

**Responses WebSocket**
- `feat(responses-ws): extend channel support and share routing with HTTP`

**请求策略与系统任务**
- `feat(policy): add request policies settings and routing decision records`
- `feat(system-tasks): add filtered task history with cleanup`
- `feat(relay): classify the protocol outcome on StreamStatus`

---

## 五、本地相对上游独有的内容（fork 自研）

本地独有非前端文件 **335 个**，主要功能域如下：

| 功能域 | 代表文件 |
|---|---|
| **自动封禁体系** | `controller/auto_ban.go`、`model/user_auto_ban.go`、`service/auto_ban.go`、`setting/auto_ban.go` |
| **IP / 指纹 / UA 封禁** | `controller/ip_ban.go`、`controller/browser_fingerprint_ban.go`、`middleware/ip_ban.go`、`common/relay_user_agent_blacklist.go` |
| **自动同步** | `controller/auto_sync*.go`、`model/auto_sync_event.go`、`service/auto_sync_*.go` |
| **公告横幅** | `controller/banner.go`、`model/banner.go`、`model/banner_migration.go`、`router/banner-router.go` |
| **头像系统** | `controller/user_avatar.go`、`service/avatar_image.go`、`service/avatar_storage.go` |
| **工单中心** | `controller/ticket.go`、`model/ticket.go` |
| **游戏 / 签到 / 股票** | `controller/game.go`、`model/game.go`、`model/game_stock*.go`、`setting/operation_setting/checkin_setting_test.go` |
| **邀请码** | `controller/invitation_code.go`、`model/invitation_code.go` |
| **用户改名 / 转让** | `controller/user_rename.go`、`controller/user_transfer.go`、`model/user_rename.go`、`model/user_transfer.go` |
| **模型健康与可用性** | `controller/model_health.go`、`controller/model_availability.go`、`model/model_health.go` |
| **渠道自定义余额** | `controller/channel_custom_balance.go`、`model/channel_custom_balance.go`、`service/channel_custom_balance.go` |
| **渠道队列预热** | `controller/channel_queue_warmer.go` |
| **上游账户 / 拦截** | `controller/upstream_account.go`、`model/upstream_account.go`、`setting/upstream_interception.go`、`service/upstream_interception_writer.go` |
| **定价选项** | `controller/pricing_options.go`、`model/pricing_options.go`、`service/pricing_options.go`、`dto/pricing.go` |
| **请求调试 / 守卫** | `common/request_debug.go`、`model/request_debug_body.go`、`service/request_guard.go` |
| **协议互转** | `service/openaicompat/{chat_to_responses,responses_to_chat,policy,regex}.go` |
| **渠道适配** | `relay/channel/vercel/*`、`relay/channel/codebuddy*.go`、`relay/channel/task/{ali,doubao,gemini,hailuo,jimeng,kling,sora,suno,vertex,vidu}/*` |
| **网页搜索** | `controller/playground_web_search.go`、`pkg/bingsearch/search.go` |
| **OAuth** | `oauth/google.go`、`oauth/http_client.go` |
| **主题设置** | `setting/theme_setting.go`、`setting/system_setting/theme.go` |
| **命名租约** | `model/named_lease.go`、`service/named_lease.go` |
| **CI / 工程** | `.github/workflows/{docker-image-alpha,docker-image-nightly,pr-check,sync-to-gitee}.yml`、`scripts/version.sh` |
| **前端** | `web/classic/*`（553）、`web/default/*`（1003） |

---

## 六、本地提交历史（29 个）

```
2026-07-28  Initial clean import of the New API gateway
2026-07-29  feat: add model health check with classic frontend i18n updates
2026-08-01  feat: enhance topup flows and model health check
2026-08-01  docs: rewrite README family and channel/installation docs
2026-08-01  feat: add user avatar upload with validation and classic frontend support
2026-08-14  feat: show public banners on classic homepage
2026-08-17  feat: 超级管理员转让功能 + 同级可操作自己 + 价格设定精度修复
2026-08-17  chore: 移除运行时日志文件的版本跟踪
2026-08-17  Merge origin/main: 合并远程初始导入历史（以本地版本为准）
2026-08-23  feat: add settings search and game features (#1)
2026-08-24  chore: checkpoint before switching to main
2026-08-24  feat: show neon pulse exchange ratio
2026-08-24  feat: style classic games in gothic theme
2026-08-24  fix: use exact gothic game motto
2026-08-24  feat: convert all game text to fraktur unicode
2026-08-24  Revert "feat: convert all game text to fraktur unicode"
2026-08-24  Revert "fix: use exact gothic game motto"
2026-08-24  Revert "feat: style classic games in gothic theme"
2026-08-31  sync: update source code and frontend assets
2026-09-05  docs: rewrite project documentation and add per-file map; feat: UA blacklist ban actions and user ban reason
2026-09-06  feat(ui): register custom brand icons (Dots Studio/Aedilic/MiniCPM/Poolside/Other) in default & classic themes
2026-09-12  feat: ticket center with unread tracking and terminal closed state
2026-09-12  sync: force-record real client IP in logs; users auto-ban badges; notification tweaks
2026-09-12  docs: document ticket system and sync READMEs and file map
2026-09-12  docs: replace sample Google API key in mask comments with placeholder
2026-09-12  chore: checkpoint claude count tokens work before official merge
2026-09-13  sync: merge A upstream features and port classic dashboard capabilities
2026-09-17  feat(web): adopt Bearer + refresh-token session flow in default dashboard
2026-09-17  fix(web): restore session on full page reload (wire up bootstrapAuthentication)
```

### 工作区未提交改动：351 个文件

| 状态 | 数量 |
|---|---|
| 未暂存修改 | 172 |
| 已暂存修改 | 85 |
| 删除 | 43 |
| 未跟踪 | 33 |
| 暂存 + 未暂存 | 10 |
| 已暂存新增 | 8 |

> 即：除 29 个提交外，本地还有 351 个文件的改动**尚未提交**，对比时需注意这部分不属于 HEAD 状态。

---

## 七、结论

1. **无法用 git 做提交级 diff**：本地是重建历史的 fork，与上游无共同祖先，且提交日期不可信。只能做内容级对比。

2. **只有 672 个文件（22.7%）与上游完全一致**，本地是深度定制分支。

3. **差异最大的两个来源**：
   - **前端路线分歧**：上游单前端 `web/src`，本地双前端 `web/classic` + `web/default`（约 1500+ 差异条目）
   - **fork 自研功能**：自动封禁、自动同步、工单、游戏、邀请码、模型健康、渠道自定义余额等 335 个后端文件

4. **上游新增而本地缺失的关键能力**：
   - `.agents/` AI 编码规范体系（含计费规则 read gate）
   - `docs/plugin-api/` 插件 API 定义（v1.md / v1.d.ts / v1.schema.json）
   - Responses WebSocket（`pkg/wsmanager`）
   - 请求策略 Request Policy
   - 多 RP Passkey 支持
   - 表达式计费（图像缓存、数量变量、按次定价、时间定价）
   - 模型/厂商管理重构
   - vllm / sglang 渠道

5. **本地独有而上游没有的能力**（上游合并时需保留）：见第五节 335 个文件对应的功能域。

6. 本地工作区还有 **351 个未提交改动**，在任何同步动作前需先处理。

---

*本报告仅做对比，未对任何代码文件进行修改。*
