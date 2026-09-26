# 功能差异对比报告（本地 vs 上游 QuantumNous/new-api）

- **生成时间**：2026-09-25
- **本地 HEAD**：`91a719147`（2026-09-17）
- **上游 HEAD**：`c2b7a9a9e`（2026-09-25）
- **对比维度**：渠道能力 / 任务渠道架构 / API 端点 / 前端页面 / 后端模块 / 独有功能
- **性质**：纯对比，未修改任何代码

> 前置说明：本地与上游**无共同祖先**，只能做内容级对比（详见 `upstream-diff-report-20260925.md`）。

---

## 一、功能对照总览

| 功能域 | 上游 | 本地 | 差异性质 |
|---|---|---|---|
| 渠道类型 | 61 种 | 63 种 | 各有独有渠道 |
| API 类型 | 基础集 | +APITypeVercel | 本地多 1 |
| 任务渠道（视频/音乐） | **全部插件化**（7 文件） | **原生适配器**（27 文件） | ⚠️ 架构分歧 |
| API 端点 | 234 个 | 279 个 | 本地多 45 |
| 前端页面 | 64 个路由 | 63 个（default） | 各有独有页面 |
| 前端架构 | 单前端 `web/src` | 双前端 classic + default | ⚠️ 路线分歧 |
| 插件系统 | 插件 API v1 + 插件市场 | 有 plugins/，无 v1 文档 | 上游更完整 |
| 计费 | 表达式计费增强 | 表达式计费 + 定价选项 | 各有增强 |
| 认证 | 多 RP Passkey、审计日志 | 基础 Passkey | 上游领先 |
| 封禁治理 | 无 | 自动封禁/IP/指纹/UA | 本地独有 |
| 内容运营 | 无 | 横幅/头像/工单/游戏/邀请码 | 本地独有 |

---

## 二、渠道支持能力

### 渠道常量总数：上游 61 / 本地 63

**上游有、本地没有（2 个）**

| 渠道 | 上游支持来源 |
|---|---|
| `ChannelTypeVLLM` | `feat: vllm channel && sglang channel (#7332)` |
| `ChannelTypeSGLang` | 同上 |

**本地有、上游没有（4 个）**

| 渠道 | 说明 |
|---|---|
| `ChannelTypeClaudeCode` | Claude Code 客户端专用 |
| `ChannelTypeCodeBuddy` | CodeBuddy 渠道（含 profile / system_prompt / cleanup 实现） |
| `ChannelTypeCodexCompatibility` | Codex 兼容模式 |
| `ChannelTypeVercel` | Vercel AI Gateway（`relay/channel/vercel/*` 全套实现） |

### API 类型（`constant/api_type.go`）

- 本地独有：`APITypeVercel`
- 上游独有：无

> 结论：本地在**渠道实现广度**上略胜（Vercel、CodeBuddy 系），上游在**自托管推理**上补齐了 vLLM / SGLang。

---

## 三、任务渠道架构分歧（最重要的功能差异）

| | 上游 | 本地 |
|---|---|---|
| `relay/channel/task/` 目录 | 仅 `jsplugin/` + `taskcommon/` | 10 个原生渠道 + `jsplugin/` + `taskcommon/` |
| 文件数 | 7 | 27 |

**上游做法**：把视频/音乐类任务渠道**全部改为 JS 插件驱动**，删除原生 Go 适配器。
相关提交：`feat(plugins): serve OpenAI Images API through task plugins`、`feat(channel): bind multiple task plugins to New API channels`、`feat(plugins): enhance task streaming and model pricing`。

**本地做法**：保留 10 套原生 Go 适配器——
`ali`、`doubao`、`gemini`、`hailuo`、`jimeng`、`kling`、`sora`、`suno`、`vertex`、`vidu`。

> ⚠️ 这是**架构路线级分歧**。上游后续所有任务渠道增强都走插件；本地若想跟进，需要决定是迁移到插件体系还是继续维护原生适配器。两边在任务渠道上已无法直接合并。

---

## 四、API 端点差异

### 总数：上游 234 / 本地 279

### 上游有、本地没有（6 个）

| 端点 | 对应功能 |
|---|---|
| `/request_policy` | 请求策略（Request Policy） |
| `/passkey/domains` | 多 RP Passkey 域名管理 |
| `/model_pricing/convert` | 旧价格转表达式草稿 |
| `/model_pricing/preview` | 价格表达式预览 |
| `/responses` | OpenAI Responses API 端点 |
| `/history` | 系统任务历史（带过滤/清理） |

### 本地有、上游没有（51 个，注册路径）

| 功能域 | 端点 |
|---|---|
| **头像** | `/:id/avatar`、`/self/avatar` |
| **签到** | `/:id/checkin` |
| **模型健康/可用性** | `/:id/health`、`/availability`、`/available`、`/model-availability` |
| **横幅** | `/banners` |
| **邀请码** | `/invitation-code/check` |
| **用户管理** | `/rename`、`/transfer`、`/users/:id`、`/users/:id/release`、`/send-email` |
| **注册/安全** | `/register/complete`、`/security`、`/passkeys`、`/passkeys/:id` |
| **工单** | `/:id/reply`、`/:id/status`、`/:id/toggle` |
| **游戏/股票** | `/stock/klines/:id`、`/stock/news`、`/stock/orderbook/:id`、`/stock/overview`、`/stock/positions`、`/stock/trade`、`/futures/close`、`/futures/open`、`/futures/positions`、`/redeem`、`/scores` |
| **视频生成** | `/videos/text2video`、`/videos/image2video`（含 `:task_id` 查询） |
| **图片** | `/images/generations`、`/images/edits` |
| **渠道运维** | `/:id/balance`、`/auto-sync/model-metadata`、`/fetch/:id`、`/batch-delete`、`/export`、`/price`、`/pricing/patch`、`/migrate_console_setting` |
| **调试** | `/:request_id/request-body` |
| **其他** | `/records`、`/used`、`/model`、`/submit/:action` |

---

## 五、前端页面差异

### 上游有、本地 default 没有（5 个页面）

| 页面 | 功能 |
|---|---|
| `_authenticated/security/index.tsx` | 安全设置中心 |
| `_authenticated/system-settings/request-policies/index.tsx` | 请求策略设置 |
| `_authenticated/system-settings/request-policies/$section.tsx` | 请求策略分节 |
| `_authenticated/task-plugins/index.tsx` | 任务插件管理 |
| `_authenticated/usage-logs/audit.tsx` | 审计日志 |

### 本地 default 有、上游没有（4 个页面）

| 页面 | 功能 |
|---|---|
| `_authenticated/invitation-codes/index.tsx` | 邀请码管理 |
| `console/log.tsx` | Console 日志 |
| `console/topup.tsx` | Console 充值 |
| `model-availability.tsx` | 模型可用性 |

### 前端架构差异

| | 上游 | 本地 |
|---|---|---|
| 前端套数 | 1 套（`web/src`，1361 文件） | 2 套（`web/classic` 553 + `web/default` 1003） |
| classic 主题 | **已删除**（`31d70fca3`） | 保留，且从 Vite 迁到 Rsbuild |
| 包管理 | `bun.lock` 单包 | `pnpm-workspace.yaml` 工作区 |

> `web/default` 与上游 `web/src` **同源同构**（顶层目录完全一致），只是路径不同且版本较旧。

---

## 六、后端模块规模对比

| 模块 | 本地 | 上游 | 共有 | 本地独有 | 上游独有 |
|---|---|---|---|---|---|
| router | 25 | 18 | 18 | 7 | 0 |
| controller | 181 | 127 | 117 | 64 | 10 |
| service | 150 | 112 | 105 | 45 | 7 |
| model | 171 | 111 | 106 | 65 | 5 |
| setting | 81 | 66 | 66 | 15 | **0** |
| middleware | 49 | 38 | 38 | 11 | **0** |
| relay/channel | 218 | 178 | 174 | 44 | 4 |
| common | 70 | 66 | 62 | 8 | 4 |

> `setting` 与 `middleware` 的**共有数等于上游总数**——说明上游这两个模块的文件本地全都有（内容可能有差异），上游没有新增文件。

---

## 七、上游独有功能详解

| 功能 | 关键文件 | 说明 |
|---|---|---|
| **AI 编码规范体系** | `.agents/rules/billing.md`、`.agents/skills/{i18n-translate,shadcn-ui,vercel-react-best-practices}/` | 本地完全没有 `.agents/` 目录 |
| **插件 API v1** | `docs/plugin-api/{v1.md,v1.d.ts,v1.schema.json}`、`controller/plugin_protocol_image.go` | 完整的插件协议定义 |
| **Responses WebSocket** | `pkg/wsmanager/`、`relay/responses_websocket.go`、`controller/responses_websocket.go`、`service/ws_close.go` | 长连接支持 |
| **请求策略** | `model/request_policy.go`、`service/request_policy.go`、`controller/request_policy.go` | 路由决策记录 |
| **多 RP Passkey** | `model/passkey_option.go`、`docs/authentication.md` | 多域名 Passkey |
| **计费增强** | `service/responses_usage.go`、`service/image_billing.go`、`relay/request_billing.go`、`model/model_pricing_conversion.go`、`model/legacy_dalle_pricing.go` | 表达式计费 / 图像计费 / 旧价迁移 |
| **渠道推理增强** | `controller/channel_inference.go`、`relay/channel/advancedcustom/rerank.go`、`common/advanced_custom_presets.go` | 重排序 / 预设 |
| **插件任务流** | `relay/channel/task/jsplugin/submit_stream.go` | 流式提交 |
| **性能指标** | `pkg/perf_metrics/outcome.go` | 结果分类 |
| **错误模型** | `service/relay_error.go`、`relay/common/response_model.go` | 统一错误/响应模型 |
| **E2E 测试** | `e2e/doc_parse_test.go` | 端到端测试目录 |

---

## 八、本地独有功能详解

| 功能 | 关键文件 | 说明 |
|---|---|---|
| **自动封禁** | `controller/auto_ban.go`、`model/user_auto_ban.go`、`service/auto_ban.go`、`setting/auto_ban.go` | 规则 + 限时/永久封禁 |
| **IP 封禁** | `controller/ip_ban.go`、`middleware/ip_ban.go`、`model/ip_ban.go` | |
| **浏览器指纹封禁** | `controller/browser_fingerprint_ban.go`、`model/browser_fingerprint_ban.go` | |
| **UA 黑名单** | `common/relay_user_agent_blacklist.go`、`middleware/relay_user_agent_blacklist.go` | |
| **自动同步** | `controller/auto_sync*.go`、`service/auto_sync_*.go`、`model/auto_sync_event.go` | 渠道/模型元数据定时同步 |
| **公告横幅** | `controller/banner.go`、`model/banner*.go`、`router/banner-router.go` | |
| **头像系统** | `controller/user_avatar.go`、`service/avatar_image.go`、`service/avatar_storage.go` | |
| **工单中心** | `controller/ticket.go`、`model/ticket.go` | 含未读跟踪 |
| **游戏 / 签到 / 股票 / 期货** | `controller/game.go`、`model/game*.go`、`service/rankings_security_test.go` | |
| **邀请码** | `controller/invitation_code.go`、`model/invitation_code.go` | |
| **用户改名 / 转让** | `controller/user_rename.go`、`controller/user_transfer.go` | 含超级管理员转让 |
| **模型健康检查** | `controller/model_health.go`、`controller/model_availability.go`、`model/model_health.go` | |
| **渠道自定义余额** | `controller/channel_custom_balance.go`、`service/channel_custom_balance.go` | |
| **渠道队列预热** | `controller/channel_queue_warmer.go` | |
| **上游账户 / 拦截** | `controller/upstream_account.go`、`setting/upstream_interception.go`、`service/upstream_interception_writer.go` | |
| **定价选项** | `controller/pricing_options.go`、`service/pricing_options.go`、`dto/pricing.go` | |
| **请求调试** | `common/request_debug.go`、`model/request_debug_body.go` | 记录请求体 |
| **请求守卫** | `service/request_guard.go` | |
| **协议互转** | `service/openaicompat/{chat_to_responses,responses_to_chat,policy,regex}.go` | |
| **网页搜索** | `controller/playground_web_search.go`、`pkg/bingsearch/search.go` | |
| **OAuth** | `oauth/google.go`、`oauth/http_client.go` | Google 登录 |
| **主题设置** | `setting/theme_setting.go`、`setting/system_setting/theme.go` | |
| **命名租约** | `model/named_lease.go`、`service/named_lease.go` | |
| **任务渠道原生实现** | `relay/channel/task/{ali,doubao,gemini,hailuo,jimeng,kling,sora,suno,vertex,vidu}/` | 上游已改插件化 |
| **渠道实现** | `relay/channel/vercel/`、`relay/channel/codebuddy*.go` | |
| **CI / 工程** | `.github/workflows/{docker-image-alpha,docker-image-nightly,pr-check,sync-to-gitee}.yml`、`scripts/version.sh` | |

---

## 九、代码组织架构差异（附带发现）

| 项目 | 上游 | 本地 |
|---|---|---|
| `dto/` 文件数 | **8**（channel_constraints / midjourney / plugin_protocol / suno / task / task_plugin / video） | **36**（保留旧组织） |
| `relaykit/dto/` 文件数 | 35 | 34 |
| 差异 | 上游把 relay 相关 DTO 全迁到 `relaykit/dto/` | 本地两处并存，`dto/` 里仍保留 openai_request.go、claude.go、gemini.go 等 28 个文件 |

> 上游做过一次 **DTO 目录重构**（`dto/` → `relaykit/dto/`），本地未跟进，导致本地存在两套并存的 DTO 定义。

---

## 十、结论

1. **两边已经走上不同路线**，不是简单的「本地落后于上游」：
   - 前端：上游单前端，本地双前端
   - 任务渠道：上游插件化，本地原生适配器
   - DTO 组织：上游已重构，本地保留旧结构

2. **上游领先的能力**（建议评估跟进）：
   - 请求策略 Request Policy、多 RP Passkey、Responses WebSocket
   - 插件 API v1 文档体系、审计日志、安全设置中心
   - 表达式计费的图像缓存/数量变量/按次定价
   - vLLM / SGLang 渠道

3. **本地独有的能力**（上游合并时必须保留）：
   - 完整的封禁治理体系（自动/IP/指纹/UA）
   - 运营功能（横幅、头像、工单、游戏、邀请码）
   - 用户管理（改名、转让、模型健康、渠道自定义余额）
   - 51 个独有 API 端点 + 4 个独有前端页面

4. **不可直接 merge 的冲突点**：
   - `web/` 整棵目录（结构完全不同）
   - `relay/channel/task/`（插件 vs 原生）
   - `dto/` 与 `relaykit/dto/`（重复定义）
   - `constant/channel.go` 与 `constant/api_type.go`（常量号段可能有冲突）

---

*本报告仅做功能对比，未对任何代码文件进行修改。*
