# New API — 逐文件清单（File Map）

> 本文档按目录列出每个源文件的用途说明。后端 Go 代码按文件逐一描述；前端按功能模块/页面描述（前端文件数量庞大，以目录为粒度）。

## 目录

- [后端核心](#后端核心)
  - [`router/`](#router)
  - [`middleware/`](#middleware)
  - [`controller/`](#controller)
  - [`service/`](#service)
  - [`model/`](#model)
  - [`common/`](#common)
  - [`relay/`](#relay)
  - [`relaykit/`](#relaykit)
  - [`relay/channel/` 供应商适配器](#relaychannel-供应商适配器)
  - [`oauth/`](#oauth)
  - [`setting/`](#setting)
  - [`constant/`](#constant)
  - [`dto/`](#dto)
  - [`types/`](#types)
  - [`i18n/`](#i18n)
  - [`logger/`](#logger)
  - [`pkg/`](#pkg)
- [前端](#前端)
  - [`web/default/`](#webdefault-默认控制台)
  - [`web/classic/`](#webclassic-经典控制台)
- [根目录文件](#根目录文件)

---

# 后端核心

## `router/`

| 文件 | 说明 |
| --- | --- |
| `main.go` | 组装全部路由：API、Dashboard、Relay、Video、Web 路由；设置前端重定向时跳转 `FRONTEND_BASE_URL` |
| `api-router.go` | 注册所有 `/api` 后台管理 REST 路由（鉴权、限流中间件），并挂载 banner 与 authz 子路由 |
| `relay-router.go` | 挂载全部 `/v1` 转发端点：models、chat、responses、claude、gemini、embedding、image、audio、rerank、midjourney、suno、websocket |
| `video-router.go` | 挂载 `/v1` 视频生成/任务获取路由，以及 Kling、OpenAI-compatible 视频代理路由 |
| `dashboard.go` | OpenAI 风格 `/dashboard/billing` 端点（subscription / usage） |
| `web-router.go` | 服务嵌入的 default / classic 前端静态资源（缓存头 + SPA fallback） |
| `banner-router.go` | 公共 `/banners` 与后台 `/banner` CRUD 路由 |
| `authz-router.go` | 挂载 `/authz` 权限目录（permission catalog）与按用户权限管理路由 |

## `middleware/`

| 文件 | 说明 |
| --- | --- |
| `auth.go` | 鉴权中间件套件：`TryUserAuth`、`UserAuth`、`AdminAuth`、`RootAuth`、`ModuleAuth`、`TokenAuth`、`WssAuth`、`NewApiUserAuth` 等 |
| `audit.go` | 后台写操作审计日志中间件（包装 ResponseWriter，请求后记录） |
| `body_cleanup.go` | 请求结束后清理请求体磁盘/内存存储与文件源 |
| `cache.go` | 为静态 Web 资源设置 `Cache-Control` 头 |
| `cors.go` | CORS 与 `X-Powered-By` 头 |
| `disable-cache.go` | 输出 no-cache 头 |
| `distributor.go` | 渠道分发：提取模型、渠道亲和性、`SetupContextForSelectedChannel` 选中渠道 |
| `email-verification-rate-limit.go` | 验证邮件按 IP 的 Redis/内存限流 |
| `gzip.go` | 解压 gzip 请求体 |
| `header_nav.go` | 头部导航模块的可见性与访问控制 |
| `i18n.go` | 语言检测与按请求存储区域设置 |
| `ip_ban.go` | 拦截被封禁 IP 的请求，返回样式化 403 页面 |
| `jimeng_adapter.go` | 适配 Jimeng（即梦）视频渠道的请求格式 |
| `kling_adapter.go` | 适配 Kling 视频渠道的请求格式 |
| `logger.go` | 路由标签与 gin 请求日志（含 request-id） |
| `model-rate-limit.go` | 按模型的请求限流（Redis / 内存） |
| `performance.go` | 系统性能下降时中止转发请求 |
| `rate-limit.go` | 全局 Web / API / 关键 / 搜索等端点限流 |
| `recover.go` | 恢复转发处理器 panic，返回 500 JSON 错误 |
| `relay_auto_ban.go` | 客户端指标自动封禁中间件与 UA 黑名单 |
| `request-id.go` | 分配并传播 request-id 头/上下文 |
| `request_body_limit.go` | 匿名请求的请求体大小上限 |
| `secure_verification.go` | 敏感操作前的 5 分钟安全验证闸门（必选/可选） |
| `stats.go` | 统计活跃 HTTP 连接数 |
| `trusted_proxies.go` | 从 `TRUSTED_PROXIES` 环境变量配置 gin 信任代理 |
| `turnstile-check.go` | Cloudflare Turnstile 人机验证（登录流程） |
| `utils.go` | 共享 JSON 中止响应辅助函数 |

## `controller/`

HTTP 控制器层，每个文件对应一组 REST 端点。

| 文件 | 说明 |
| --- | --- |
| `relay.go` | 核心转发入口：`Relay`（OpenAI/Anthropic 等格式）、`RelayMidjourney`、`RelayTask`/`RelayTaskFetch`、`RelayNotImplemented`/`NotFound` |
| `user.go` | 用户控制器：登录/注册/登出、用户信息与额度管理、管理员用户 CRUD、`TopUp`、`TransferAffQuota`、模型列表、邮箱绑定、令牌生成 |
| `channel.go` | 渠道控制器：渠道 CRUD、模型拉取、批量状态/标签、复制、Ollama 拉取/删除/版本、多密钥管理 |
| `token.go` | API 令牌 CRUD：查询/新建/更新/删除、密钥/状态/用量、批量删除与批量查询 |
| `redemption.go` | 兑换码 CRUD（含导出、清理无效码） |
| `log.go` | 请求日志查询：全部/用户日志、搜索、统计、请求体调试、历史日志清理 |
| `topup.go` | 充值中心：`GetTopUpInfo`、ePay、金额/订单查询、管理员补单 |
| `topup_stripe.go` | Stripe 充值：`RequestStripePay`/`RequestStripeAmount`/`StripeWebhook`（Checkout 会话） |
| `topup_creem.go` | Creem 充值：`RequestCreemPay`/`CreemWebhook`（签名校验） |
| `topup_waffo.go` | Waffo 充值：金额/支付/Webhook |
| `topup_waffo_pancake.go` | Waffo Pancake 充值：金额/支付/Webhook、商户配对与目录管理 |
| `subscription.go` | 订阅计划端点、用户自助订阅、余额支付、订阅绑定/重置/删除 |
| `subscription_payment_stripe.go` | Stripe 订阅结账 |
| `subscription_payment_creem.go` | Creem 订阅结账 |
| `subscription_payment_epay.go` | ePay 订阅结账与回调 |
| `subscription_payment_waffo_pancake.go` | Waffo Pancake 订阅结账 |
| `payment_compliance.go` | 充值合规确认与强制检查 |
| `payment_webhook_availability.go` | 各支付网关可用性检查辅助 |
| `option.go` | 系统选项读取/更新（含支付合规守卫） |
| `setup.go` | 首次初始化设置（root 用户、选项） |
| `banner.go` | 横幅 CRUD 与公共横幅 |
| `oauth.go` | GitHub/Discord/OIDC OAuth 登录、授权码、账号绑定流程 |
| `custom_oauth.go` | 自定义 OAuth 提供商 CRUD 与用户绑定/解绑 |
| `passkey.go` | WebAuthn Passkey：注册/登录/验证/删除/状态、管理员重置 |
| `twofa.go` | TOTP 两步验证：设置/启用/禁用/备份码/登录验证/管理员统计与禁用 |
| `telegram.go` | Telegram 绑定与登录 |
| `wechat.go` | 微信 OAuth 登录/绑定（code 换 token） |
| `secure_verification.go` | 通用安全验证（邮箱/passkey），敏感操作前调用 |
| `checkin.go` | 每日签到状态与签到（额度奖励） |
| `invitation_code.go` | 邀请码 CRUD 与用户侧校验、查询、删除 |
| `group.go` | 用户分组与可用分组 |
| `pricing.go` | 用户侧模型定价列表与模型倍率重置 |
| `pricing_options.go` | 分层/动态计费选项 PATCH |
| `ratio_config.go` | 终端显示的渠道比率/配置 |
| `ratio_sync.go` | 从上游（OpenRouter、models.dev）同步模型倍率 |
| `ranking.go` | 用户用量排行榜、可用性与安全排行 |
| `usedata.go` | 配额日期数据端点（全部/用户、流量） |
| `misc.go` | 状态、公告、关于、用户协议、隐私政策、首页内容、邮件验证、密码重置 |
| `user_email.go` | 向当前用户邮箱发送测试邮件 |
| `user_rename.go` | 用户自助改名 |
| `user_transfer.go` | 用户间额度转账 |
| `audit.go` | 审计记录辅助（后台/用户安全操作） |
| `authz.go` | 权限目录（admin console 权限树） |
| `auto_ban.go` | 渠道自动封禁记录查询/释放 |
| `auto_sync.go` | 价格/模型自动同步状态读取与更新 |
| `auto_sync_hook.go` | 渠道创建/更新/删除时入队自动同步事件 |
| `billing.go` | OpenAI 风格 `/v1/dashboard/billing` 订阅/用量端点 |
| `browser_fingerprint_ban.go` | 浏览器指纹黑名单 CRUD |
| `channel_authz.go` | 渠道 PATCH 请求的授权过滤辅助 |
| `channel_affinity_cache.go` | 渠道亲和性缓存统计与清理 |
| `channel-billing.go` | 通过上游计费 API 刷新渠道余额 |
| `channel-test.go` | 渠道连通性测试（单个/全部、流式选择、批量测试任务） |
| `channel_upstream_update.go` | 上游模型偏差检测与批量应用 |
| `client_identity_versions.go` | OpenAI 客户端身份（SDK 版本）按渠道追踪 |
| `codex_usage.go` | Codex 渠道用量 / 限流重置额度端点 |
| `console_migrate.go` | 控制台设置一次性迁移 |
| `deployment.go` | ionet 模型部署管理（容器/日志/硬件/价格） |
| `game.go` | 股票/期货游戏端点：列表、分数兑换、行情/新闻/订单簿/K 线/交易/持仓/开平仓 |
| `image.go` | 提供用户上传的图片 |
| `ip_ban.go` | IP 黑名单 CRUD 与被封用户列表 |
| `midjourney.go` | Midjourney 任务列表与状态轮询 |
| `missing_models.go` | 已在启用渠道中引用但缺失的模型 |
| `model.go` | 模型列表/详情（渠道/仪表盘/启用维度） |
| `model_availability.go` | 按渠道-模型映射的模型可用性 |
| `model_health.go` | 模型健康度与性能详情 |
| `model_meta.go` | 模型元数据 CRUD |
| `model_sync.go` | 从上游（modelmap.dev）同步模型/供应商 |
| `perf_metrics.go` | 按分组/渠道的请求性能指标 |
| `permission_admin.go` | 管理控制台权限管理 |
| `playground.go` | 模型 Playground 代理端点 |
| `prefill_group.go` | 按分组的前置填充令牌配额覆盖 |
| `return_path.go` | 支付回调返回路径构造 |
| `subscription_payment_stripe.go` | Stripe 订阅链接生成 |
| `swag_video.go` | 视频生成端点与 Kling 文生视频/图生视频 |
| `system_info.go` | 集群系统实例注册表管理与过期清理 |
| `system_task.go` | 系统任务管理（日志清理等）、查询、获取 |
| `system_task_handlers.go` | 注册定时任务执行器 |
| `task.go` | 异步任务列表（Midjourney 等） |
| `task_video.go` | 每个渠道的视频任务状态轮询与更新 |
| `upstream_account.go` | 上游账号 CRUD、签到/余额刷新/健康检查、操作日志 |
| `uptime_kuma.go` | 按配置分组聚合 Uptime Kuma 状态 |
| `vendor_meta.go` | 供应商元数据 CRUD |
| `video_proxy.go` | 视频内容代理（data-URL 重定向/健康检查） |
| `video_proxy_gemini.go` | 提取 Gemini/Vertex 生成视频 URL 并构建代理 data-URL |

测试文件（`controller/*_test.go`）：`channel_authz_test.go`、`channel_batch_status_test.go`、`channel_test_internal_test.go`、`channel_upstream_update_test.go`、`model_list_test.go`、`model_owned_by_test.go`、`payment_webhook_availability_test.go`、`pricing_options_test.go`、`rankings_test.go`、`token_test.go`、`topup_waffo_pancake_test.go`、`usedata_flow_test.go`、`user_avatar_test.go`、`user_permission_admin_test.go`、`user_rename_test.go`、`user_transfer_test.go`、`auth_audit_test.go`、`login_frequency_test.go` 等，覆盖对应控制器的关键业务契约。

## `service/`

业务逻辑层 — 计费、配额、任务、渠道、HTTP、安全等。

| 文件 | 说明 |
| --- | --- |
| `billing.go` | 计费入口：`PreConsumeBilling` / `SettleBilling` 包装配额预扣与结算 |
| `billing_session.go` | `BillingSession` 生命周期：管理预扣配额直至结算 |
| `billing_usage.go` | OpenAI/Claude/Gemini 用量 DTO 互转 |
| `billing_usage_bridge.go` | 旧 `dto.Usage` 与 relaykit 用量 DTO 桥接 |
| `pre_consume_quota.go` | 转发请求前预扣配额 |
| `quota.go` | 核心配额数学与消费（文本/音频/WSS，预扣/后扣、订阅额度） |
| `text_quota.go` | 文本令牌配额计算（分层计费、工具调用附加费）与扣费 |
| `tiered_settle.go` | 分层计费令牌参数构建与表达式计费结算尝试 |
| `tool_billing.go` | 工具调用计费附加额度 |
| `violation_fee.go` | 供应商错误（如 Grok CSAM 标记）违规费 |
| `token_counter.go` | 文本/图像/音频/实时输入的令牌计数（预扣用） |
| `tokenizer.go` | 初始化 tokenizer 编码器并按模型计数 |
| `token_estimator.go` | 按供应商/模型的启发式令牌估算（CJK/拉丁词大小） |
| `audio.go` | 解析/解码 base64 音频并计算时长用于计费 |
| `channel.go` | 根据转发错误与状态启用/禁用渠道 |
| `channel_select.go` | 随机满足条件渠道选择器（带重试参数） |
| `channel_affinity.go` | 渠道亲和性规则缓存（每个亲和性键首选渠道） |
| `channel_auto_sync_snapshot.go` | 计算渠道配置快照，构建自动价格同步守卫与事件 |
| `upstream_account.go` | 上游账号余额刷新、签到、健康检查 |
| `upstream_pricing.go` | 从标准/OpenRouter/models.dev 拉取并规范化上游定价 |
| `auto_ban.go` | 评估自动封禁触发条件，重复违规后封禁 |
| `auto_sync_status.go` | 读取自动价格/模型同步配置与状态 |
| `auto_sync_tasks.go` | 执行入队系统任务的自动价格/模型元数据同步批次 |
| `request_guard.go` | 通过渠道请求守卫拒绝非授权请求 |
| `convert.go` | Claude/Gemini 与 OpenAI 请求/响应互转（流 + 非流） |
| `download.go` | worker/下载 HTTP 请求辅助 |
| `error.go` | 将上游错误包装为供应商专用 DTO 并映射状态码 |
| `file_decoder.go` | 从 URL 下载文件为 base64/mime 本地文件数据 |
| `file_service.go` | 加载文件源（URL/base64）带内存/磁盘缓存与图像配置探测 |
| `funding_source.go` | `FundingSource` 接口（钱包/订阅）与可重试退款辅助 |
| `group.go` | 用户分组工具（可用分组、自动分组、分组倍率） |
| `http.go` | 优雅关闭响应体与上游头复制辅助 |
| `http_client.go` | 构建支持代理与传输策略的 HTTP 客户端 |
| `http_transport_policy.go` | 规范化 HTTP 传输策略（强制 HTTP/1.1、保持连接） |
| `http_transport_sharded.go` | 分片 round tripper，按来源分配传输实例 |
| `protected_fetch_client.go` | 构建 SSRF 防护 HTTP 客户端（校验 URL、IP、重定向） |
| `log_info_generate.go` | 构建每个请求的 `other` 信息映射（文本/音频/MJ 计费日志） |
| `midjourney.go` | Midjourney 动作 → 模型转换与 MJ HTTP 请求执行 |
| `named_lease.go` | 分布式命名互斥锁/租约包装回调 |
| `notify-limit.go` | 按用户的 Redis/内存通知限流 |
| `openai_chat_responses_compat.go` | 旧版 chat↔responses 互转门面（委托 openaicompat） |
| `openai_chat_responses_mode.go` | 旧版决定 chat 何时使用 responses API 模式的门面 |
| `openaicompat/` | chat↔responses 转换：`chat_to_responses.go`、`responses_to_chat.go`、`policy.go`（模式决策）、`regex.go`（模型/渠道模式匹配） |
| `passkey/` | WebAuthn：`service.go`（RPID/origin 解析）、`session.go`（gin 会话）、`user.go`（WebAuthnUser 适配器） |
| `pricing_options.go` | 对模型定价选项应用 JSON-patch（重置、校验） |
| `rankings.go` | 构建模型/供应商排行榜快照、历史、涨跌与安全视图 |
| `return_path.go` | 从请求 host 构建支付返回 URL |
| `sensitive.go` | 敏感词检查与替换 |
| `str.go` | 字符串工具（Sunday 搜索、去重、AC 自动机敏感词匹配） |
| `subscription_reset_task.go` | 定期重置订阅额度的定时任务 |
| `system_instance.go` | 上报节点系统信息/指标到数据库 |
| `system_task.go` | 后台系统任务框架（入队/认领/心跳）与日志清理任务 |
| `task.go` | 任务平台动作到模型名映射 |
| `task_billing.go` | 异步任务计费/退款/日志 |
| `task_polling.go` | 轮询任务平台（Suno/视频）完成状态并结算 |
| `usage_helpr.go` | 将响应文本转为用量对象并校验 |
| `user_notify.go` | 邮件/Bark/Gotify 通知用户与管理员 |
| `waffo_pancake.go` | Waffo/Pancake 支付网关集成（结账会话、Webhook、目录） |
| `webhook.go` | Webhook 通知（HMAC 签名） |
| `epay.go` | ePay 支付回调地址 |
| `authz/` | casbin 授权：`enforcer.go`（同步执行器）、`adapter.go`（GORM 适配）、`permission.go`、`registry.go`、`resolver.go`、`role.go`、`seed.go`、`assignment.go`、`override.go`、`resources_channel.go` |

## `model/`

GORM 数据模型、迁移与数据访问。

| 文件 | 说明 |
| --- | --- |
| `main.go` | 数据库引导：各方言连接、AutoMigrate、迁移、root 账号/初始化、ping |
| `user.go` | `User` 模型：账号、额度、分组、角色、OAuth ID、自动封禁字段与 CRUD |
| `user_cache.go` | `UserBase` 缓存结构与 Redis 缓存读写/失效 |
| `user_rename.go` | `RenameUser`：事务内改名并扣费 |
| `user_transfer.go` | `TransferQuota`：用户间额度转账（3% 手续费） |
| `user_auto_ban.go` | 用户安全事件与自动封禁记录模型 |
| `user_auth_compat.go` | AutoBan 认证流的兼容桩 |
| `user_oauth_binding.go` | 用户与自定义 OAuth 提供商账号绑定模型 |
| `channel.go` | `Channel` 模型：供应商渠道配置、密钥、模型/分组映射、密钥轮换 |
| `channel_cache.go` | 内存 + Redis 渠道缓存、周期同步、随机满足渠道选择 |
| `channel_satisfy.go` | 检查渠道对分组/模型是否启用与满足 |
| `ability.go` | channel→(group, model) 能力映射与渠道选择逻辑 |
| `token.go` | `Token` 模型：API 密钥、额度、模型限制、IP 白名单、过期 |
| `token_cache.go` | Redis 令牌缓存辅助 |
| `option.go` | `Option` 键值存储与选项加载/更新 |
| `log.go` | `Log` 模型（可选 ClickHouse 日志库）、用量记录、统计、鉴权日志 |
| `banner.go` | 公告横幅模型与 CRUD |
| `banner_migration.go` | 将旧控制台公告配置迁移为横幅记录 |
| `checkin.go` | 每日签到模型与奖励逻辑 |
| `invitation_code.go` | 邀请码/兑换码模型、CRUD 与事务消耗 |
| `redemption.go` | 兑换码模型与事务兑换 |
| `topup.go` | `TopUp` 充值订单模型、支付守卫与状态机 |
| `subscription.go` | 订阅计划/订单/用户订阅模型与购买/消耗/重置/预扣 |
| `midjourney.go` | Midjourney 绘制任务模型 |
| `task.go` | 异步任务（视频/图片生成）模型，含 JSON 属性、CAS 更新、计费上下文 |
| `system_task.go` | `SystemTask`/`SystemTaskLock` 模型与分布式任务生命周期 |
| `system_instance.go` | 在线节点心跳模型与过期节点清理 |
| `model_meta.go` | `Model`/`BoundChannel` 模型元数据（描述、图标、供应商、端点） |
| `model_extra.go` | 模型的启用分组与配额类型缓存查询 |
| `model_health.go` | 从日志表计算模型健康度聚合 |
| `vendor_meta.go` | 供应商元数据模型 |
| `usedata.go` | `QuotaData` 仪表盘柱状图数据，缓存聚合与周期刷盘 |
| `usedata_flow.go` | 基于 quota_data 的角色化流量聚合查询 |
| `usedata_rankings.go` | 令牌用量排行榜聚合查询 |
| `pricing.go` | `Pricing`/`PricingVendor` 内存定价缓存（由选项与模型元数据重建） |
| `pricing_default.go` | 供应商名称/图标默认规则 |
| `pricing_options.go` | 定价选项键管理（播种、发布、校验、完整性检查） |
| `pricing_refresh.go` | 强制重建定价缓存 |
| `browser_fingerprint_ban.go` | 浏览器指纹黑名单模型与匹配逻辑 |
| `ip_ban.go` | `IPBan` 模型：精确 IP 或 CIDR 规则、规范化、快照匹配、按登录 IP 封用户 |
| `game.go` | 游戏配置与积分兑换模型（额度奖励、兑换限流） |
| `game_stock.go` | 股票/期货模拟交易引擎模型 |
| `game_stock_events.go` | 事件驱动股市引擎（新闻/宏观事件模板与市场状态） |
| `custom_oauth_provider.go` | 自定义 OAuth 提供商配置模型 |
| `external_identity_claim.go` | 外部身份（如 Telegram）事务认领/释放 |
| `frontend_option_migration.go` | 退休的仪表盘/控制台选项迁移 |
| `gorm_logger.go` | 增强 GORM 日志（慢查询阈值、参数化过滤、驱动错误清洗） |
| `casbin_rule.go` | casbin 策略表模型（ptype + V0..V5） |
| `authz_role.go` | 角色授权元数据模型 |
| `auto_price_guard.go` | 自动价格同步守卫与状态机 |
| `auto_sync_event.go` | 自动同步事件队列模型与事务函数 |
| `db_time.go` | 数据库兼容时间戳获取 |
| `errors.go` | 包级哨兵错误变量 |
| `locking.go` | `SELECT ... FOR UPDATE` 辅助（SQLite 下跳过） |
| `named_lease.go` | 分布式租约获取/续期/释放 |
| `passkey.go` | WebAuthn 凭证存储与注册辅助 |
| `perf_metric.go` | 时间分桶性能聚合模型（延迟、TPS、令牌） |
| `prefill_group.go` | JSON 值模型与可复用模型/标签/端点分组 |
| `ranking_security.go` | 从日志库查询每个用户不同 IP/请求量的安全排行 |
| `request_debug_body.go` | 请求体调试记录模型（gzip 分块存储） |
| `setup.go` | 系统初始化版本与时间戳 |
| `twofa.go` | TOTP 启用/验证/禁用/备份码逻辑 |
| `upstream_account.go` | 上游站点账号模型（加密凭据、自动签到/余额） |
| `utils.go` | 用户/令牌/渠道额度批量缓冲刷新与通用辅助 |

## `common/`

共享工具包。

| 文件 | 说明 |
| --- | --- |
| `json.go` | 全项目强制的 JSON 封装（禁止业务代码直接 `encoding/json`） |
| `crypto.go` | HMAC 生成与密码哈希/校验 |
| `redis.go` | Redis 客户端初始化与带 TTL 的键/哈希操作 |
| `database.go` | 主/日志数据库类型跟踪与方言判断 |
| `env.go` | 带默认值的类型化环境变量读取 |
| `str.go` | 随机字符串、掩码、JSON 转换、空值默认 |
| `utils.go` | 随机键/UUID、浏览器打开、大小、时间、请求工具 |
| `quota.go` | 返回可信额度值 |
| `quota_math.go` | float/Decimal 配额值转 int（钳制/严格错误模式） |
| `rate-limit.go` | 无 Redis 部署的内存限流器 |
| `limiter/limiter.go` | Redis 令牌桶限流器 |
| `ip.go` | IP 解析、私网检测、CIDR 列表匹配 |
| `hash.go` | SHA1/SHA256/HMAC-SHA256 |
| `gin.go` | gin 辅助（可复用请求体、上下文键、API 成功/错误响应、表单解析） |
| `email.go` | SMTP 邮件发送（TLS 与认证协商） |
| `email-outlook-auth.go` | Outlook SMTP 登录认证 |
| `email_ntlm_auth.go` | 自动 SMTP 认证协商辅助 |
| `totp.go` | TOTP 密钥生成、备份码、二维码数据 |
| `verification.go` | 过期验证码生成与校验 |
| `model.go` | 模型名称分类（图像生成、OpenAI 文本、纯 Responses） |
| `api_type.go` | 渠道类型 → API 类型映射 |
| `endpoint_type.go` | 按渠道类型与模型名判定端点类型 |
| `endpoint_defaults.go` | 每种端点类型的默认端点信息 |
| `body_storage.go` | 内存/磁盘请求体存储抽象 |
| `custom-event.go` | SSE 自定义事件编码 |
| `disk_cache.go` | 磁盘缓存工具 |
| `disk_cache_config.go` | 磁盘缓存配置与运行统计 |
| `embed-file-system.go` | 静态资源嵌入 FS（主题感知切换） |
| `go-channel.go` | 非阻塞安全通道发送 |
| `gopool.go` | 转发 goroutine 池（panic 恢复、上下文传播） |
| `init.go` | 环境初始化与启动帮助打印 |
| `node_identity.go` | 多节点部署的节点身份 |
| `page_info.go` | gin 上下文分页参数解析 |
| `performance_config.go` | 性能监控配置（PProf、Pyro） |
| `pprof.go` | pprof/HTTP 监控服务启动 |
| `proxy_url.go` | 严格/运行时代理 URL 解析 |
| `pyro.go` | PyroScope 性能分析初始化 |
| `relay_user_agent_blacklist.go` | 转发 UA 黑名单匹配与配置动作 |
| `request_body_limit.go` | 匿名请求体大小限制 |
| `request_debug.go` | 可读请求体调试表示 |
| `ssrf_protection.go` | SSRF 防护 URL 校验 |
| `sys_log.go` | 启动日志辅助与横幅 |
| `system_monitor.go` | 周期系统状态采样（CPU/内存/磁盘/uptime） |
| `system_monitor_unix.go` / `system_monitor_windows.go` | 跨平台 `GetDiskSpaceInfo` 实现 |
| `topup-ratio.go` | 充值分组倍率 JSON 配置 |
| `url_validator.go` | 重定向 URL 校验（相对当前 host） |
| `validate.go` | 校验器初始化与注册 |
| `audio.go` | MP3/WAV/FLAC/M4A/OGG/Opus/AIFF/WebM/AAC 音频时长提取 |
| `constants.go` | 全局常量与状态 |
| `copy.go` | 通用 DeepCopy（JSON 往返） |

## `relay/`

协议转发层 — 每种协议的处理器。

| 文件 | 说明 |
| --- | --- |
| `compatible_handler.go` | `TextHelper`：OpenAI-compatible 聊天补全转发（模型映射、配额、重试） |
| `responses_handler.go` | `ResponsesHelper`：OpenAI Responses API 转发（chat.completions 与 /compact） |
| `chat_completions_via_responses.go` | 通过支持 Responses 的上游渠道路由 chat-completions 请求 |
| `claude_handler.go` | `ClaudeHelper`：Anthropic Claude Messages 协议转发（thinking、流式、用量） |
| `gemini_handler.go` | `GeminiHelper` + `GeminiEmbeddingHandler`：Gemini 聊天/嵌入转发 |
| `audio_handler.go` | `AudioHelper`：OpenAI 音频端点（转写/语音）转发 |
| `embedding_handler.go` | `EmbeddingHelper`：嵌入端点转发 |
| `image_handler.go` | `ImageHelper`：图像生成端点转发 |
| `rerank_handler.go` | `RerankHelper`：rerank 端点转发 |
| `alpha_search_handler.go` | `AlphaSearchHelper`：Codex 网页搜索端点（`/v1/alpha/search`） |
| `midjourney_proxy_handler.go` | `RelayMidjourney*`：Midjourney 代理转发 |
| `relay_adaptor.go` | 工厂函数：按 API 类型或任务平台选择渠道适配器 |
| `relay_task.go` | 异步任务（Suno/视频/实时）转发与配额重算 |
| `websocket.go` | `WssHelper`：WebSocket（实时）会话转发 |
| `param_override_error.go` | 参数覆盖失败转中继 API 错误 |
| `relay/mjproxy_handler.go` | Midjourney 代理：提交、任务、通知、图片、seed、换脸 |
| `relay/common/billing.go` | `BillingSettler` 接口：转发后用量结算抽象 |
| `relay/common/outbound_body.go` | 出站 JSON 请求体构造 |
| `relay/common/override.go` | 渠道参数/头覆盖应用（含审计日志） |
| `relay/common/relay_info.go` | `RelayInfo` 结构与各协议构造器、渠道元数据、令牌计数 |
| `relay/common/relay_utils.go` | 完整请求 URL、API 版本、任务请求校验辅助 |
| `relay/common/request_conversion.go` | 从 DTO 类型识别并记录转发格式 |
| `relay/common/stream_status.go` | 线程安全流状态追踪（结束原因、累积错误） |
| `relay/constant/relay_mode.go` | 请求路径 → 转发模式枚举映射 |
| `relay/helper/billing_expr_request.go` | 从转发请求构造计费表达式求值输入 |
| `relay/helper/common.go` | SSE/WebSocket 流式写入辅助 |
| `relay/helper/model_mapped.go` | 应用渠道模型名映射 |
| `relay/helper/price.go` | 模型价格与配额计算（含分层计费表达式） |
| `relay/helper/stream_result.go` | 流式错误/停止/完成控制信号 |
| `relay/helper/stream_scanner.go` | 读取上游 SSE 流并转发、处理 ping 与流状态 |
| `relay/helper/valid_request.go` | 各协议请求体解析与校验 |
| `relay/reasonmap/reasonmap.go` | Claude↔OpenAI 结束原因映射 |
| `relay/common_handler/rerank.go` | rerank 响应共用后处理 |

## `relaykit/`

独立 Go 模块（`relaykit/go.mod`）：协议 DTO 与格式互转，供 `relay/` 与外部使用。

| 文件/目录 | 说明 |
| --- | --- |
| `dto/` | 协议 DTO：`openai_request.go`、`openai_response.go`、`claude.go`、`gemini.go`、`audio.go`、`embedding.go`、`rerank.go`、`realtime.go`、`openai_image.go`、`openai_video.go`、`openai_compaction.go`、`openai_responses_compaction_request.go`、`alpha_search_request.go`、`playground.go`、`pricing.go`、`ratio_sync.go`、`sensitive.go`、`user_settings.go`、`notify.go`、`request_common.go`、`channel_settings.go`、`billing_usage.go`、`values.go`、`error.go` |
| `types/` | `channel_error.go`、`endpoint_type.go`、`error.go`、`file_data.go`、`file_source.go`、`relay_format.go`、`request_meta.go` |
| `relayconvert/` | 格式转换注册表与入口：`request_registry.go`、`response_registry.go`、`text_converter_registry.go`、`media.go`、兼容门面 `request_compat.go`/`response_compat.go`、`convmeta/`（元数据与选项）、`kitutil/`（JSON/日志/掩码/值工具）、`reasoning/suffix.go` |
| `relayconvert/internal/` | 具体转换器：`claude_messages/`（Claude→OpenAI）、`gemini_chat/`（Gemini→OpenAI）、`oai_chat/`（OpenAI→Claude/Gemini/Responses）、`oai_responses/`（Responses→聊天/Claude/Gemini，含状态流式转换器）、`shared/`（Claude/Gemini 共享辅助）、`jsonutil/`、`media/` |
| `reasonmap/` | Claude↔OpenAI 结束原因映射（独立版） |

## `relay/channel/` 供应商适配器

| 目录 | 说明 |
| --- | --- |
| `openai/` | 核心 OpenAI 格式适配器（同时处理 Azure、360、OpenRouter、LingYiWanWu、Xinference 渠道类型）：聊天、图像、音频、实时、Responses、compaction 转发 |
| `claude/` | Anthropic Claude 适配器（Messages API + 流式） |
| `gemini/` | Google Gemini 适配器（原生 + OpenAI-compatible 转发） |
| `ali/` | 阿里 DashScope（阿里云百炼）适配器：文本、图像、Wan 图像、rerank |
| `aws/` | AWS Bedrock 适配器（复用 Claude 转发格式） |
| `baidu/` | 百度千帆/AIP 适配器 |
| `baidu_v2/` | 百度 ERNIE v2（千帆，OpenAI-compatible）适配器 |
| `advancedcustom/` | “高级自定义”适配器：按渠道设置选择 Claude/Gemini/OpenAI 转发 |
| `ai360/` | 360 模型列表常量 |
| `cloudflare/` | Cloudflare Workers AI 适配器 |
| `codex/` | ChatGPT 订阅（Codex）适配器（含 OAuth 密钥处理） |
| `cohere/` | Cohere 适配器（chat/generate） |
| `coze/` | Coze 扣子平台适配器 |
| `deepseek/` | DeepSeek 适配器（OpenAI 格式 + deepseek 特有头） |
| `dify/` | Dify 平台适配器 |
| `jimeng/` | 即梦图像生成适配器 |
| `jina/` | Jina 适配器（聊天 + rerank） |
| `lingyiwanwu/` | 零一万物模型列表常量 |
| `minimax/` | MiniMax 适配器（含图像生成、TTS） |
| `mistral/` | Mistral 适配器（OpenAI-compatible） |
| `mokaai/` | MokaAI 适配器 |
| `moonshot/` | Moonshot/Kimi 适配器 |
| `newapi/` | New API 自适配器（分发到 openai/claude/gemini 转发） |
| `ollama/` | Ollama 本地模型适配器 |
| `openrouter/` | OpenRouter 模型列表常量 |
| `palm/` | Google PaLM（旧）适配器 |
| `perplexity/` | Perplexity 适配器 |
| `replicate/` | Replicate 适配器（图像/模型运行、大 multipart） |
| `siliconflow/` | SiliconFlow 适配器 |
| `sub2api/` | Sub2API 适配器（复用 newapi，覆盖名称/模型列表） |
| `submodel/` | Submodel 适配器（LLM 转发） |
| `tencent/` | 腾讯混元适配器 |
| `vertex/` | Google Vertex AI 适配器（GCP 服务账号认证） |
| `volcengine/` | 火山方舟适配器（含 TTS） |
| `xai/` | xAI（Grok）适配器 |
| `xinference/` | Xinference rerank DTO/常量 |
| `xunfei/` | 讯飞星火适配器 |
| `zhipu/` | 智谱 AI / BigModel 适配器 |
| `zhipu_4v/` | 智谱 4V 视觉适配器（含图像转发） |
| `task/ali/` | 阿里视频生成任务适配器（轮询 + 取结果） |
| `task/doubao/` | 豆包视频任务适配器 |
| `task/gemini/` | Gemini 视频/图像任务适配器 |
| `task/hailuo/` | 海螺视频任务适配器 |
| `task/jimeng/` | 即梦视频任务适配器（HMAC 签名请求） |
| `task/kling/` | 可灵视频任务适配器 |
| `task/sora/` | Sora 视频任务适配器（multipart 上传） |
| `task/suno/` | Suno 音乐生成任务适配器 |
| `task/taskcommon/` | 任务适配器共享辅助（下载、轮询） |
| `task/vertex/` | Vertex（Imagen/Veo）任务适配器 |
| `task/vidu/` | Vidu 视频任务适配器 |
| 顶层文件 | `adapter.go`（`Adaptor` 接口）、`api_request.go`（HTTP 请求构建/发送/流复制/重试）、`codebuddy.go`/`codebuddy_profile.go`（CodeBuddy 客户端身份头与请求体重写）、`compatibility.go`（旧渠道类型客户端身份兼容） |

## `oauth/`

| 文件 | 说明 |
| --- | --- |
| `provider.go` | `Provider` 接口（OAuth 提供商契约） |
| `registry.go` | `Register`/`GetProvider`/`GetAllProviders` 注册表与自定义提供商加载/卸载 |
| `github.go` | GitHub OAuth2 令牌/用户交换 |
| `discord.go` | Discord OAuth2 令牌/用户交换（含头像 URL） |
| `google.go` | Google OAuth2 令牌/用户交换 |
| `linuxdo.go` | LinuxDO OAuth 提供商（信任级别检查、头像模板） |
| `oidc.go` | 通用 OpenID Connect 令牌/用户交换 |
| `generic.go` | 可配置自定义 OAuth 提供商 |
| `types.go` | `OAuthToken`、`OAuthUser`、`OAuthError`、`AccessDeniedError` 共享类型 |

## `setting/`

系统配置管理（设置项 + 值校验/归一化）。

| 文件 | 说明 |
| --- | --- |
| `auto_ban.go` | 自动封禁配置（阈值、封禁时长、豁免） |
| `auto_group.go` | 自动分组列表 |
| `chat.go` | 聊天预设列表 |
| `login_proxy.go` | 登录代理 URL 归一化 |
| `midjourney.go` | Midjourney 运行时开关（通知、账号过滤、模式清理） |
| `payment_creem.go` | Creem 支付设置 |
| `payment_stripe.go` | Stripe 支付设置 |
| `payment_waffo.go` | Waffo 支付设置 |
| `payment_waffo_pancake.go` | Waffo Pancake 托管结账设置 |
| `rate_limit.go` | 按分组模型请求限流设置 |
| `sensitive.go` | 敏感词检查设置 |
| `theme_setting.go` | 默认主题设置 |
| `user_usable_group.go` | 用户可用分组映射 |
| `billing_setting/tiered_billing.go` | 分层/表达式计费模式与计费表达式设置 |
| `config/config.go` | 通用配置管理器（注册结构体设置，以 JSON 存 DB） |
| `console_setting/` | 控制台设置（API 信息、公告、FAQ、Uptime Kuma 分组） |
| `model_setting/` | 模型设置：`global.go`、`claude.go`（额外头/最大令牌）、`gemini.go`（安全设置）、`grok.go`（违规扣费）、`qwen.go` |
| `operation_setting/` | 运营设置：演示站/自用模式、通用设置、签到奖励、渠道亲和性、监控、支付折扣、配额行为、状态码区间、令牌上限、工具定价 |
| `performance_setting/config.go` | 性能设置（磁盘缓存、监控阈值） |
| `perf_metrics_setting/config.go` | 性能指标上报设置 |
| `ratio_setting/` | 模型倍率与计费表达式、分组倍率、暴露倍率、compact 后缀、缓存命中倍率 |
| `reasoning/suffix.go` | 模型名推理后缀处理 |
| `system_setting/` | 系统设置：主题、旧变量、Passkey、OIDC、法律文件、Google OAuth、URL 拉取（SSRF）、Discord |

## `constant/`

| 文件 | 说明 |
| --- | --- |
| `api_type.go` | API 类型枚举 |
| `channel.go` | 渠道类型枚举、默认 BaseURL、显示名、特殊编码计划 |
| `endpoint_type.go` | 转发端点类型枚举 |
| `env.go` | 运行时环境全局量（超时、缓冲、功能开关） |
| `context_key.go` | gin 上下文键 |
| `cache_key.go` | 用户/令牌缓存键格式 |
| `finish_reason.go` | 结束原因字符串常量 |
| `midjourney.go` | Midjourney 动作/错误常量 |
| `multi_key_mode.go` | 多密钥模式枚举 |
| `task.go` | 任务平台与 Suno/Midjourney 动作常量 |
| `waffo_pay_method.go` | Waffo 支付方式定义 |
| `azure.go` | Azure 特定常量 |
| `setup.go` | 初始化中标志 |
| `README.md` | 包说明 |

## `dto/`

请求/响应数据结构。

| 文件 | 说明 |
| --- | --- |
| `openai_request.go` | 核心 OpenAI 聊天补全请求 DTO（令牌计数、流检测） |
| `openai_response.go` | OpenAI 聊天补全响应 DTO |
| `openai_image.go` | OpenAI 图像生成/编辑 DTO |
| `openai_video.go` | 视频状态常量/DTO |
| `openai_compaction.go` | OpenAI Responses compaction 响应 DTO |
| `openai_responses_compaction_request.go` | Responses compaction 请求 DTO |
| `claude.go` | Claude 请求/响应 DTO 与转换辅助 |
| `gemini.go` | Gemini 请求/响应 DTO 与转换 |
| `audio.go` | 音频转写/语音请求 DTO |
| `embedding.go` | 嵌入请求 DTO（含令牌计数） |
| `rerank.go` | Rerank 请求 DTO |
| `realtime.go` | 实时 API 事件类型常量与 DTO |
| `alpha_search_request.go` | Codex 网页搜索请求 DTO |
| `midjourney.go` | Midjourney 请求 DTO |
| `suno.go` | Suno 提交/查询 DTO |
| `task.go` | 任务错误 DTO |
| `video.go` | 视频生成请求 DTO |
| `banner.go` | 横幅 DTO |
| `notify.go` | 通知 DTO |
| `sensitive.go` | 敏感词响应 DTO |
| `user_settings.go` | 用户通知设置 DTO |
| `playground.go` | Playground 请求 DTO |
| `pricing.go` | OpenAI 模型列表/定价 DTO |
| `ratio_sync.go` | 上游倍率同步请求 DTO |
| `request_common.go` | 通用 `Request` 接口 |
| `values.go` | 灵活 JSON 值类型 |
| `error.go` | OpenAI 风格错误响应 DTO |
| `channel_settings.go` | 渠道 OtherSettings 结构 |

## `types/`

| 文件 | 说明 |
| --- | --- |
| `error.go` | 转发错误类型与 HTTP 状态映射 |
| `channel_error.go` | `ChannelError`（带渠道信息的中继错误） |
| `relay_format.go` | 转发格式枚举 |
| `request_meta.go` | 文件类型与请求元数据枚举 |
| `file_data.go` | `LocalFileData` 结构 |
| `file_source.go` | 文件源解析 |
| `price_data.go` | 分组倍率/价格数据 |
| `rw_map.go` | 泛型 RWMutex 保护 map |
| `set.go` | 泛型 Set |

## `i18n/`

| 文件 | 说明 |
| --- | --- |
| `i18n.go` | go-i18n 加载、翻译辅助与中间件 |
| `keys.go` | 类型化翻译消息键常量 |
| `locales/` | 后端语言包目录（en / zh） |

## `logger/`

| 文件 | 说明 |
| --- | --- |
| `logger.go` | 分级日志包（控制台 + 文件输出、轮转、上下文日志） |

## `pkg/`

| 目录 | 说明 |
| --- | --- |
| `billingexpr/` | 计费表达式引擎（分层/动态定价），见 `billingexpr/expr.md` |
| `cachex/` | 缓存抽象层 |
| `ionet/` | ionet 部署网络工具 |
| `perf_metrics/` | 性能指标收集与上报 |

---

# 前端

## `web/default/`（默认控制台）

React 19 + TypeScript + Rsbuild + Base UI + Tailwind CSS v4 + TanStack Router/Query + Zustand + i18next + VisActor VChart。

| 目录 | 说明 |
| --- | --- |
| `src/main.tsx` | 应用启动：QueryClient、路由、主题/字体/方向 Provider、国际化、系统品牌化 |
| `src/routes/` | 基于文件的路由：`(auth)/`（登录/注册/重置/OAuth）、`(errors)/`、`_authenticated/`（受保护：渠道、聊天、仪表盘、密钥、模型、Playground、订阅、系统设置、日志、用户、钱包等）、顶层公共页（首页、关于、定价、排行榜、初始化等） |
| `src/features/` | 25 个功能模块：`auth`（登录/注册/Passkey/安全验证）、`channels`（渠道 CRUD）、`chat`（聊天引擎）、`dashboard`（仪表盘）、`home`（营销首页）、`keys`（API 密钥）、`models`（模型广场/定价）、`playground`、`pricing`、`profile`、`rankings`、`redemption-codes`、`setup`（初始化向导）、`subscriptions`、`system-info`、`system-settings`（分 auth/billing/content/general/integrations/maintenance/models/operations/request-limits/security/site 子模块）、`usage-logs`、`users`、`wallet`、`invitation-codes`、`model-availability`、`performance-metrics`、`legal`、`errors`、`about` |
| `src/components/` | 通用组件：`ui/`（约 66 个 Tailwind 原语）、`layout/`（应用外壳：侧栏/头部/导航）、`data-table/`（TanStack Table 工具包）、`ai-elements/`（聊天渲染元素）及单文件组件（对话框、复制按钮、主题/语言切换、命令菜单、JSON 编辑器等） |
| `src/hooks/` | 跨领域自定义钩子（管理员守卫、剪贴板、防抖、媒体查询、通知、侧栏配置、系统状态、表格状态等） |
| `src/lib/` | 共享工具（axios 实例、常量、颜色、货币/时间格式化、服务器错误、角色、oauth、passkey、安全验证、图表辅助、DOM、缓存） |
| `src/stores/` | Zustand 状态：`auth-store`、`notification-store`、`system-config-store` |
| `src/i18n/` | i18next 初始化、语言列表、静态键、`locales/`（en/zh/fr/ru/ja/vi） |
| `src/context/` | Theme、ThemeCustomization、Font、Direction、Layout、Search Provider |
| `src/config/` | 字体定义 |
| `src/assets/` | 品牌图标、Logo、SVG |
| `src/styles/` | 全局样式（Tailwind v4 + CSS 变量主题） |

## `web/classic/`（经典控制台）

React + Semi Design（`@douyinfe/semi-ui`）+ React Router v6 + i18next，经 Rsbuild 构建，纯 JSX。

| 目录 | 说明 |
| --- | --- |
| `src/index.jsx` | 启动引导：Semi CSS、状态/用户/路由/主题 Provider、多语言 |
| `src/App.jsx` | 中央路由表 + 权限守卫（AuthRedirect/PrivateRoute/AdminRoute）+ 懒加载 |
| `src/pages/` | 35 个页面：`Channel`（渠道）、`Model`（模型定价）、`Token`（API 密钥）、`User`（用户）、`Log`（日志）、`TopUp`（充值）、`Subscription`（订阅）、`Redemption`（兑换码）、`Setting`（系统设置）、`Game`（游戏中心：德州扑克/轮盘/贪吃蛇/1024/黄金矿工/Token 挖矿/股票期货等）、`IpBan`、`BrowserFingerprintBan`、`UpstreamAccount`（上游账号）、`Playground`、`Chat`、`Chat2Link`、`Transfer`（转账）、`Rankings`/`RankingsV2`、`Pricing`、`Banner`、`ModelDeployment`、`ModelHealth`、`Dashboard`、`Home`、`About`、`Setup`、`SystemInfo`、`Task`、`Midjourney`、`InvitationCode`、`NotFound`/`Forbidden`、法律页面等 |
| `src/components/` | 对应用户/渠道/令牌/订阅/计费等的表格渲染器（`table/`），设置面板（`settings/`），登录注册表单（`auth/`），仪表盘面板（`dashboard/`），布局壳（`layout/`），Playground 组件，顶部充值（`topup/`）等 |
| `src/hooks/` | 领域数据钩子（按 `channels/`、`users/`、`channels/`、`playground/`、`subscriptions/` 等组织） |
| `src/helpers/` | 纯工具模块：`api.js`（axios）、`auth.jsx`、`utils.jsx`、`render.jsx`、`flow.js`、`quota.js`、`log.js`、`dashboard.jsx` 等 |
| `src/i18n/` | i18next 初始化与 `locales/`（en/zh/zh-CN/zh-TW/fr/ru/ja/vi） |
| `src/constants/` | 计费/渠道/客户端身份/仪表盘等常量库 |

---

# 根目录文件

| 文件 | 说明 |
| --- | --- |
| `main.go` | 后端入口：加载配置、初始化数据库与缓存、装配路由、启动服务 |
| `go.mod` / `go.sum` | Go 模块定义与依赖锁定（module `github.com/QuantumNous/new-api`） |
| `docker-compose.yml` / `.dev.yml` | 生产/开发编排（PostgreSQL + Redis + 服务） |
| `Dockerfile` / `Dockerfile.dev` | 生产镜像（构建双前端 + 内嵌静态资源）与开发镜像 |
| `.env.example` | 环境变量模板（数据库、Redis、缓存、限流、第三方支付等） |
| `Makefile` | 常用命令（`dev-api`、`dev-web`、`build-all-frontends`、测试等） |
| `AGENTS.md` | 项目开发规范（架构、数据库兼容、代码质量、i18n、贡献流程） |
| `package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` | 前端工作区根（协调 web/ 子包） |
| `electron/` | 桌面端封装目录 |
| `docs/` | 中文/英文/日文/俄文翻译词汇表、渠道配置、安装、OpenAPI、更新说明 |
| `bin/` | 构建产物输出目录（本地产物，不入库） |

## 相关文档

- [项目总览与快速部署](../README.md)
- [后端业务规范（AGENTS.md）](../AGENTS.md)
- [计费表达式系统（pkg/billingexpr/expr.md）](../pkg/billingexpr/expr.md)
- [翻译词汇表（docs/translation-glossary.md）](./translation-glossary.md)
- [OpenAPI 定义](./openapi/)
- [渠道配置补充](./channel/other_setting.md)
- [宝塔面板安装](./installation/BT.md)