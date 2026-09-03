# API 转发实现机制与渠道适配开发指南

本文描述 new-api 的 API 转发（Relay）实现机制，并给出适配新接口 / 新上游渠道的开发路径。

---

## 一、整体架构

### 1.1 分层

```
客户端请求
   ↓
router/          路由注册、中间件装配（决定 RelayFormat）
   ↓
middleware/      TokenAuth（鉴权）→ Distribute（选渠道）→ 限流
   ↓
controller/      编排：GenRelayInfo → 计价 → 预扣费 → 重试循环 → 结算/退款
   ↓
relay/           按 RelayMode 分派到具体 Helper（TextHelper / ImageHelper / TaskSubmit ...）
   ↓
relay/channel/   各上游渠道 Adaptor：转换请求、发请求、解析响应
   ↓
上游供应商
```

代码位置：

| 层 | 路径 | 职责 |
|---|---|---|
| 路由 | `router/relay-router.go`、`router/video-router.go` | 绑定 URL 与 `RelayFormat` |
| 中间件 | `middleware/distributor.go` | 鉴权后选择渠道并写入上下文 |
| 编排 | `controller/relay.go` | 计价、预扣费、重试、结算 |
| 分派 | `relay/compatible_handler.go`、`relay/image_handler.go`、`relay/relay_task.go` 等 | 按 `RelayMode` 调用对应 Helper |
| 适配 | `relay/channel/<vendor>/adaptor.go` | 协议转换、请求发出、响应解析 |
| 计费 | `relay/helper/price.go`、`service/billing.go`、`service/text_quota.go` | 价格计算与配额扣减 |
| 轮询 | `service/task_polling.go` | 异步任务状态推进与结算 |

### 1.2 四个关键枚举（必须分清）

适配新接口时第一步是判断改动落在哪一层，取决于这四个枚举：

**① `RelayFormat`——入口协议格式**（`types/relay_format.go:6-18`）

客户端用什么格式打进来。由**路由**直接指定：

```go
RelayFormatOpenAI                    = "openai"
RelayFormatClaude                    = "claude"
RelayFormatGemini                    = "gemini"
RelayFormatOpenAIResponses           = "openai_responses"
RelayFormatOpenAIResponsesCompaction = "openai_responses_compaction"
RelayFormatOpenAIAudio               = "openai_audio"
RelayFormatOpenAIImage               = "openai_image"
RelayFormatOpenAIRealtime            = "openai_realtime"
RelayFormatRerank                    = "rerank"
RelayFormatEmbedding                 = "embedding"
RelayFormatTask                      = "task"
RelayFormatMjProxy                   = "mj_proxy"
```

**② `RelayMode`——具体功能**（`relay/constant/relay_mode.go:8-55`）

比 `RelayFormat` 更细，决定走哪个 Helper。对 OpenAI 格式，由路径推断（`Path2RelayMode`，`relay/constant/relay_mode.go:57-95`）：`/v1/chat/completions` → `RelayModeChatCompletions`，`/v1/images/generations` → `RelayModeImagesGenerations` 等。

**③ `ChannelType`——渠道类型（对外配置维度）**（`constant/channel.go:21+`）

用户在管理界面「渠道类型」下拉框里选的东西，如 `ChannelTypeOpenAI=1`、`ChannelTypeAnthropic=14`、`ChannelTypeAli=17`。每个类型在 `constant/channel.go:64` 的 `ChannelBaseURLs` 里有默认上游地址，在 `constant/channel.go:146` 的 `ChannelTypeName` 里有显示名。

**④ `APIType`——协议类型（内部适配维度）**（`constant/api_type.go:3-41`）

决定用 `relay/channel/` 下哪个 Adaptor 包。`ChannelType` → `APIType` 的映射在 `common/api_type.go:5` 的 `ChannelType2APIType()`。

> **关键设计**：`ChannelType` 与 `APIType` 是多对一关系。多个渠道类型可复用同一套协议适配，例如 `ChannelTypeOpenRouter`、`ChannelTypeXinference` 都映射到 `APITypeOpenAI`，最终都返回 `&openai.Adaptor{}`（`relay/relay_adaptor.go:105-108`）。

**关系图**

```
ChannelType (配置)  ──ChannelType2APIType──>  APIType (协议)  ──GetAdaptor──>  Adaptor 实现
      17 Ali                                    APITypeAli                    ali.Adaptor
      58 OpenRouter                             APITypeOpenRouter              openai.Adaptor
```

### 1.3 目录结构

```
relay/
  relay_adaptor.go          Adaptor 工厂：GetAdaptor(apiType) / GetTaskAdaptor(platform)
  compatible_handler.go     文本（chat/completions）主流程 TextHelper
  claude_handler.go         Claude 原生格式入口
  gemini_handler.go         Gemini 原生格式入口
  responses_handler.go      OpenAI Responses 格式
  image_handler.go / audio_handler.go / embedding_handler.go / rerank_handler.go
  relay_task.go             异步任务提交 RelayTaskSubmit
  websocket.go              Realtime (WS)
  channel/
    adapter.go              Adaptor / TaskAdaptor 接口定义
    api_request.go          通用请求发送封装（DoApiRequest 等）
    <vendor>/adaptor.go     各渠道适配实现
    task/<vendor>/          异步任务渠道适配实现
    task/taskcommon/        任务公共工具（BaseBilling、UnmarshalMetadata 等）
  common/
    relay_info.go           RelayInfo 结构与构造、streamSupportedChannels
    billing.go              BillingSettler 接口
    stream_status.go        流式状态机
  helper/
    price.go                价格计算 ModelPriceHelper
    valid_request.go        请求解析与校验 GetAndValidateRequest
    stream_scanner.go       SSE 扫描
```

---

## 二、同步转发链路（文本 / 图像 / 音频 / 嵌入 / 重排）

### 2.1 完整时序

以 `POST /v1/chat/completions` 为例。

**第 1 步：路由**（`router/relay-router.go:69-166`）

```go
relayV1Router := router.Group("/v1")
relayV1Router.Use(middleware.RouteTag("relay"))
relayV1Router.Use(middleware.SystemPerformanceCheck())
relayV1Router.Use(middleware.TokenAuth())
relayV1Router.Use(middleware.ModelRequestRateLimit())
{
    httpRouter := relayV1Router.Group("")
    httpRouter.Use(middleware.Distribute())
    httpRouter.POST("/chat/completions", func(c *gin.Context) {
        controller.Relay(c, types.RelayFormatOpenAI)
    })
}
```

**第 2 步：中间件选渠道**（`middleware/distributor.go:32-170`）

`Distribute()` 按顺序：

1. 若令牌绑定了指定渠道（`ContextKeyTokenSpecificChannelId`）→ 直接取该渠道；
2. 否则校验令牌的模型白名单；
3. 优先走渠道亲和性缓存（`GetPreferredChannelByAffinity`）；
4. 否则 `service.CacheGetRandomSatisfiedChannel()` 按分组 + 模型 + 优先级随机选；
5. `SetupContextForSelectedChannel()`（`middleware/distributor.go:459`）把渠道 id / type / base_url / key / 设置写入 `gin.Context`；
6. `c.Next()` 之后若响应码 < 400，记录亲和性。

> **要点**：渠道信息**不通过参数传递**，而是写入 `gin.Context`。后续 `RelayInfo.InitChannelMeta()` 再从上下文读回。

**第 3 步：控制器编排**（`controller/relay.go:68-249`）

`Relay(c, relayFormat)` 主干：

```go
request, err := helper.GetAndValidateRequest(c, relayFormat)      // ① 解析+校验请求体
relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, request, ws) // ② 构造 RelayInfo
// ③ 敏感词检查
// ④ EstimateRequestToken → 预估 prompt tokens
priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)   // ⑤ 计价
service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)    // ⑥ 预扣费
// ⑦ defer: 出错则 Billing.Refund()
for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {  // ⑧ 重试循环
    channel, channelErr := getChannel(c, relayInfo, retryParam)
    addUsedChannel(c, channel.Id)
    c.Request.Body = io.NopCloser(bodyStorage)   // 每次重试都要重置 body
    switch relayFormat {                          // ⑨ 分派
    case types.RelayFormatClaude:  newAPIError = relay.ClaudeHelper(c, relayInfo)
    case types.RelayFormatGemini:  newAPIError = geminiRelayHandler(c, relayInfo)
    default:                       newAPIError = relayHandler(c, relayInfo)
    }
    if newAPIError == nil { return }
    processChannelError(c, ...)                   // ⑩ 记录渠道错误（可能自动禁用）
    if !shouldRetry(...) { break }
}
```

其中 `relayHandler`（`controller/relay.go:35-56`）按 `RelayMode` 分派：

```go
case RelayModeImagesGenerations, RelayModeImagesEdits: err = relay.ImageHelper(c, info)
case RelayModeAudioSpeech/Translation/Transcription:  err = relay.AudioHelper(c, info)
case RelayModeRerank:      err = relay.RerankHelper(c, info)
case RelayModeEmbeddings:  err = relay.EmbeddingHelper(c, info)
case RelayModeResponses, RelayModeResponsesCompact: err = relay.ResponsesHelper(c, info)
default:                   err = relay.TextHelper(c, info)
```

**第 4 步：`TextHelper` 主流程**（`relay/compatible_handler.go:25-223`）

```go
info.InitChannelMeta(c)                              // ① 从 Context 拉渠道元数据
request, _ := common.DeepCopy(textReq)               // ② 深拷贝，避免污染重试
helper.ModelMappedHelper(c, info, request)           // ③ 应用渠道模型映射
// ④ StreamOptions 处理：仅当 info.SupportStreamOptions 时下发
adaptor := GetAdaptor(info.ApiType)                  // ⑤ 取 Adaptor
adaptor.Init(info)
// ⑥ 分支 A：全局/渠道开启了「透传请求体」→ 直接用原始 body
//    分支 B：adaptor.ConvertOpenAIRequest() 转换
//       → RemoveDisabledFields() 剔除禁用字段
//       → ApplyParamOverrideWithRelayInfo() 应用参数覆写
resp, err := adaptor.DoRequest(c, info, requestBody) // ⑦ 发请求
if httpResp.StatusCode != http.StatusOK {            // ⑧ 非 200 → RelayErrorHandler
    return service.RelayErrorHandler(...)
}
usage, newApiErr := adaptor.DoResponse(c, httpResp, info)  // ⑨ 解析并写回客户端
service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil) // ⑩ 结算
```

> **计费是「预扣 + 结算」两段式**：预扣费按预估 tokens，真实用量在 `DoResponse` 返回 `usage` 后由 `PostTextConsumeQuota` 多退少补。

### 2.2 同步 Adaptor 接口

定义于 `relay/channel/adapter.go:15-32`：

```go
type Adaptor interface {
    Init(info *relaycommon.RelayInfo)
    GetRequestURL(info *relaycommon.RelayInfo) (string, error)
    SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error
    ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error)
    ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error)
    ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error)
    ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error)
    ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error)
    ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error)
    ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error)
    ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error)
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError)
    GetModelList() []string
    GetChannelName() string
}
```

各方法职责：

| 方法 | 作用 | 约定 |
|---|---|---|
| `Init` | 保存 `info`，初始化实例状态 | 每次重试都会新建一个 Adaptor 实例 |
| `GetRequestURL` | 拼上游完整 URL | 通常 `info.ChannelBaseUrl + 路径`；Realtime 需把 `https://` 换成 `wss://` |
| `SetupRequestHeader` | 设鉴权头 | 只设头，**不要**发请求 |
| `ConvertXxxRequest` | 把内部 DTO 转成上游格式 | 未支持的格式返回 `errors.New("not implemented")` 即可 |
| `DoRequest` | 实际发请求 | 复用 `channel.DoApiRequest` / `DoFormRequest` / `DoWssRequest` |
| `DoResponse` | 解析响应、写回客户端、返回 usage | **必须返回 `*dto.Usage`**，调用方会直接类型断言 |
| `GetModelList` | 渠道默认模型列表 | 仅用于管理界面「获取模型列表」按钮，不做强制校验 |
| `GetChannelName` | 渠道显示名 | 用于模型归属 `owned_by` |

`DoRequest` 的三个通用封装（`relay/channel/api_request.go`）：

```go
DoApiRequest(a, c, info, requestBody)   // :309 普通 JSON 请求
DoFormRequest(a, c, info, requestBody)  // :339 multipart 表单（image edits、音频转写）
DoWssRequest(a, c, info, requestBody)   // :371 WebSocket（Realtime）
```

三者内部统一流程：`GetRequestURL` → `http.NewRequest` → `SetupRequestHeader` → **应用 Header Override**（用户覆写优先级最高）→ `doRequest`（带代理、超时）。

参考实现：`relay/channel/openai/adaptor.go:616-626`（`DoRequest` 按 RelayMode 选择封装）、`628-662`（`DoResponse` 按 RelayMode 分派到各 handler）。

### 2.3 流式处理

流式响应统一由 `relay/helper/stream_scanner.go:77` 的 `StreamScannerHandler` 驱动：

```go
helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
    // 逐行处理 SSE data:
})
```

它负责：SSE 扫描、流式超时（`constant.StreamingTimeout`）、可选的心跳 Ping（`PingIntervalEnabled`）、结束原因记录（`info.StreamStatus.SetEndReason`）、并发安全的写入。

Adaptor 只需在回调里解析单个 `data:` 载荷、累积 usage，并在结束时调用 `helper.Done(c)`。参考 `relay/channel/openai/relay-openai.go:104` 的 `OaiStreamHandler`。

---

## 三、异步任务链路（视频 / 音乐生成）

异步任务与同步转发的最大区别：客户端提交后立刻拿到任务 ID，真实状态由后台轮询推进，计费分三段。

### 3.1 提交时序

**路由**（`router/video-router.go:19-34`）→ `controller.RelayTask`

**控制器**（`controller/relay.go:486-600`）：

```go
relayInfo, _ := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
relay.ResolveOriginTask(c, relayInfo)          // 处理 remix：锁定原渠道、提取参数
defer func() { if taskErr != nil { relayInfo.Billing.Refund(c) } }()
for ...重试... {
    channel, _ = getChannel(c, relayInfo, retryParam)
    result, taskErr = relay.RelayTaskSubmit(c, relayInfo)
    if taskErr == nil { break }
}
if taskErr == nil {
    service.SettleBilling(c, relayInfo, result.Quota)  // 提交阶段结算
    service.LogTaskConsumption(c, relayInfo)
}
```

**`RelayTaskSubmit`**（`relay/relay_task.go:145-260`）是全链路核心，11 个步骤：

```go
info.InitChannelMeta(c)                                  // 1. 渠道元数据
platform := GetTaskPlatform(c)                           // 2. 确定 platform
adaptor := GetTaskAdaptor(platform)
adaptor.ValidateRequestAndSetAction(c, info)
helper.ModelMappedHelper(c, info, nil)                   // 3. 模型映射
info.PublicTaskID = model.GenerateTaskID()               // 4. 预生成对外任务 ID
priceData, _ := helper.ModelPriceHelperPerCall(c, info)  // 5. 按次计价
if r := adaptor.EstimateBilling(c, info); len(r) > 0 {   // 6. 适配层提供倍率
    for k, v := range r { info.PriceData.AddOtherRatio(k, v) }
}
info.PriceData.Quota = common.QuotaFromFloatChecked(...) // 7. 应用倍率（饱和防溢出）
if info.Billing == nil {                                 // 8. 预扣费（仅首次）
    info.ForcePreConsume = true                          //   异步任务必须全额锁定
    service.PreConsumeBilling(c, info.PriceData.Quota, info)
}
requestBody, _ := adaptor.BuildRequestBody(c, info)      // 9. 构建请求
resp, _ := adaptor.DoRequest(c, info, requestBody)
c.Header("X-New-Api-Other-Ratios", ...)                  // 10. 回传倍率给调试
upstreamTaskID, taskData, _ := adaptor.DoResponse(c, resp, info)
if r := adaptor.AdjustBillingOnSubmit(info, taskData); len(r) > 0 {  // 11. 按上游实返调整
    finalQuota = recalcQuotaFromRatios(info, r)
}
```

### 3.2 TaskAdaptor 接口

定义于 `relay/channel/adapter.go:34-79`，分四组：

```go
type TaskAdaptor interface {
    Init(info *relaycommon.RelayInfo)
    ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError

    // ── 计费三段 ──
    EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64
    AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64
    AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int

    // ── 请求 / 响应 ──
    BuildRequestURL(info *relaycommon.RelayInfo) (string, error)
    BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error
    BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error)
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, err *dto.TaskError)
    GetModelList() []string
    GetChannelName() string

    // ── 轮询 ──
    FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error)
    ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error)
}

type OpenAIVideoConverter interface {   // 可选实现
    ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error)
}
```

不需要自定义计费的渠道，直接内嵌 `taskcommon.BaseBilling`（`relay/channel/task/taskcommon/helpers.go:82-97`），它提供三个计费方法的空实现：

```go
type TaskAdaptor struct {
    taskcommon.BaseBilling   // 内嵌拿到三个默认实现
    ChannelType int
    apiKey      string
    baseURL     string
}
```

### 3.3 计费三段式

| 阶段 | 方法 | 时机 | 用途 |
|---|---|---|---|
| 估算 | `EstimateBilling` | 提交前 | 从用户请求提取时长/分辨率等倍率 |
| 提交调整 | `AdjustBillingOnSubmit` | 上游返回后 | 上游实际参数与估算不同时修正 |
| 完成调整 | `AdjustBillingOnComplete` | 轮询到终态 | 按实际用量补扣/退款；返回 0 表示不变 |

倍率通过 `info.PriceData.AddOtherRatio(k, v)` 注册，**不要**直接写 `OtherRatios` map——`AddOtherRatio` 会拒绝非正数、NaN、+Inf。

参考 `relay/channel/task/ali/adaptor.go:448-472`：`EstimateBilling` 返回 `{"seconds": 5}` 与 `{"resolution-1080P": 1.667}` 两个倍率。

### 3.4 轮询

`service/task_polling.go:105` 的 `RunTaskPollingOnce` 定时扫描未完成的任务，按渠道分组后调用 `adaptors.FetchTask` + `ParseTaskResult`：

```go
// service/task_polling.go:452
resp, err := adaptor.FetchTask(baseURL, key, map[string]any{
    "task_id": task.GetUpstreamTaskID(),
    "action":  task.Action,
}, proxy)
taskResult, err := adaptor.ParseTaskResult(responseBody)
```

`ParseTaskResult` 要把上游状态映射到内部状态（`model.TaskStatusQueued/InProgress/Success/Failure`），并填入 `Url`、`Reason`、`Progress`。轮询还会处理：超时任务清扫（`sweepTimedOutTasks`）、429 视为暂时失败保持原状态（`service/task_polling.go:497-500`）、完成后调用 `AdjustBillingOnComplete` 结算差额。

---

## 四、计费机制

### 4.1 价格计算

入口 `relay/helper/price.go`：

- `ModelPriceHelper`（`:81`）——按 token 计费（文本）。产出 `types.PriceData`，含 `ModelRatio`、`CompletionRatio`、`GroupRatio`、`CacheRatio`、`ImageRatio`、`AudioRatio`、`QuotaToPreConsume` 等。模型没配倍率且用户不接受未配倍率模型时直接报错。
- `ModelPriceHelperPerCall`（`:195`）——按次/按量计费（MJ、异步任务）。
- `modelPriceHelperTiered`（`:277`）——阶梯表达式计费（见 `pkg/billingexpr/expr.md`）。

### 4.2 预扣费 / 结算 / 退款

`relay/common/billing.go:7-24` 定义生命周期：

```go
type BillingSettler interface {
    Settle(actualQuota int) error
    Refund(c *gin.Context)
    NeedsRefund() bool
    GetPreConsumedQuota() int
    Reserve(targetQuota int) error
}
```

- 同步链路：`service.PreConsumeBilling`（`service/billing.go:20`）预扣 → `service.PostTextConsumeQuota`（`service/text_quota.go:347`）结算；失败时 `defer` 里 `Billing.Refund`。
- 异步链路：`info.ForcePreConsume = true` 强制全额预扣（`relay/relay_task.go:207`）→ 提交成功 `service.SettleBilling`（`service/billing.go:51`）→ 轮询终态按 `AdjustBillingOnComplete` 补扣/退款。

免费模型（`priceData.FreeModel`）时 `info.Billing == nil`，全部跳过。

### 4.3 计费安全约束

项目对计费有强制 invariants（详见 `AGENTS.md`「Billing safety invariants」），适配新渠道时必须遵守：

1. **禁止裸 `int(float)` 转换**。一律用 `common.QuotaFromFloat`（截断）、`common.QuotaRound`（四舍五入）、`common.QuotaFromDecimal`。
2. **用户可控的倍率必须先限流**。如图像 `n` 用 `dto.MaxImageN`，视频时长用 `relaycommon.MaxTaskDurationSeconds`，`max_tokens` 系列用 `maxTokensLimit`。
3. **校验要覆盖旁路**。`metadata`、`Extra["parameters"]`、multipart 字段都能绕过标准 DTO 校验，从这些路径读到的倍率必须就地限制（例：`relay/channel/task/ali/adaptor.go:459-463` 对 metadata 覆写的 `Duration` 做了 `min(..., MaxTaskDurationSeconds)`）。
4. **用 `*Checked` 变体并把 clamp 挂到 `info.QuotaClamp`**，让饱和事件可审计（`relay/relay_task.go:281`）。
5. **`metadata` 不能改 model**。`taskcommon.UnmarshalMetadata` 会主动 `delete(metadata, "model")`（`relay/channel/task/taskcommon/helpers.go:21`）防止计费绕过。

---

## 五、错误处理与重试

### 5.1 错误类型

统一用 `*types.NewAPIError`，可转成 OpenAI / Claude 错误格式（`controller/relay.go:93-105`）。上游非 200 时由 `service.RelayErrorHandler`（`service/error.go:86-131`）统一解析：先尝试按 `dto.GeneralErrorResponse` 解析，能解析出结构化错误就用上游错误信息，否则回退为 `bad response status code N`。

`service.ResetStatusCode`（`service/error.go:133`）会按渠道配置的 `status_code_mapping` 覆写状态码（例如把上游 400 映射成 500 以触发重试）。

### 5.2 重试判定

- 同步：`shouldRetry`（`controller/relay.go:325`）
- 异步：`shouldRetryTaskRelay`

重试循环要点：

1. 每次重试前必须 `c.Request.Body = io.NopCloser(bodyStorage)` 重置请求体（`controller/relay.go:211`）；
2. `RetryParam` 携带已用过的渠道集合，避免重复选中同一渠道；
3. `processChannelError` 记录渠道失败，达到阈值会自动禁用渠道；
4. 免费模型不重试（`info.Billing == nil` 时无可退配额）。

### 5.3 `dto.TaskError`

异步链路用 `*dto.TaskError`，其中 `LocalError: true` 表示本地错误（请求解析失败等），**不计入渠道健康度**，也不会触发渠道禁用（`controller/relay.go:556`）。

---

## 六、如何适配新接口 / 新渠道

### 6.1 决策树

先判断改动类型：

| 场景 | 需要改动 |
|---|---|
| **A. 已有渠道支持一个新的上游参数** | 只改该渠道的 `BuildRequestBody` / `ConvertOpenAIRequest` + DTO |
| **B. 新增一个 OpenAI 兼容渠道** | `constant/channel.go` + `common/api_type.go` + 前端常量（复用 `openai.Adaptor`） |
| **C. 新增一个非 OpenAI 协议的同步渠道** | 上述 + 新建 `relay/channel/<vendor>/` 实现 `Adaptor` + `relay/relay_adaptor.go` 注册 |
| **D. 新增一个异步任务渠道** | 上述 + 新建 `relay/channel/task/<vendor>/` 实现 `TaskAdaptor` + `GetTaskAdaptor` 注册 |
| **E. 新增一种全新的入口协议** | 上述 + `types/relay_format.go` + `RelayMode` + 路由 + `GenRelayInfo` 分支 + Helper |

### 6.2 场景 A：已有渠道加参数（最常见）

以「阿里云视频渠道要透传 `ratio` 字段」为例：

1. 在请求结构体加字段：`relay/channel/task/ali/adaptor.go:55-63` 的 `AliVideoParameters`；
2. 若要允许用户通过 `metadata` 传入，同步加到 `AliMetadata`（`:95-113`）；
3. 在 `convertToAliRequest` 里做默认值/校验逻辑（`:350-444`）；
4. 若该字段影响计费，同步更新 `ProcessAliOtherRatios`（`:201`）。

**无需**改路由、`RelayInfo`、计费框架。

### 6.3 场景 B：新增 OpenAI 兼容渠道

上游如果完全兼容 OpenAI 协议，不必写新 Adaptor，复用 `openai.Adaptor` 即可：

1. `constant/channel.go` 加渠道类型常量（追加到末尾，不要插中间——`ChannelBaseURLs` 是按索引对齐的数组）：
   ```go
   ChannelTypeMyVendor = 60
   ```
2. 同一文件 `ChannelBaseURLs`（`:64`）按索引加默认地址，`ChannelTypeName`（`:146`）加显示名。
3. `common/api_type.go` 的 `ChannelType2APIType` 加映射：
   ```go
   case constant.ChannelTypeMyVendor:
       apiType = constant.APITypeOpenAI
   ```
4. 若上游支持 `StreamOptions`，把渠道加入 `relay/common/relay_info.go:325` 的 `streamSupportedChannels`。
5. 前端 `web/default/src/features/channels/constants.ts:24` 的 `CHANNEL_TYPES` 加一项；需要图标/默认地址/提示时，在 `web/default/src/features/channels/lib/channel-type-config.ts:48` 的 `CHANNEL_TYPE_CONFIGS` 加配置。
6. 若渠道有独立模型列表，新建 `relay/channel/<vendor>/constants.go` 定义 `ModelList` / `ChannelName`，然后在 `openai.GetModelList()`（`relay/channel/openai/adaptor.go:664-679`）的 switch 里加分支。

### 6.4 场景 C：新增非 OpenAI 协议的同步渠道

需要实现完整的 `channel.Adaptor`。

**步骤**

1. **建包** `relay/channel/<vendor>/`，两个文件：
   - `constants.go`：`ModelList`、`ChannelName`
   - `adaptor.go`：实现 `channel.Adaptor`

2. **实现 Adaptor 骨架**：

```go
package myvendor

type Adaptor struct {
    ChannelType int
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
    a.ChannelType = info.ChannelType
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
    header.Set("Authorization", "Bearer "+info.ApiKey)
    header.Set("Content-Type", "application/json")
    return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
    // 把 dto.GeneralOpenAIRequest 转成上游结构体
    // 注意：可选标量字段用指针 + omitempty，保留显式零值
    return &upstreamReq{...}, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
    return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
    if info.IsStream {
        return myStreamHandler(c, info, resp)
    }
    return myHandler(c, info, resp)
}

// 未支持的格式直接返回错误
func (a *Adaptor) ConvertRerankRequest(...) (any, error) { return nil, errors.New("not implemented") }
// ... 其余 Convert 方法同理

func (a *Adaptor) GetModelList() []string   { return ModelList }
func (a *Adaptor) GetChannelName() string   { return ChannelName }
```

3. **注册**：
   - `constant/api_type.go` 末尾（`APITypeDummy` **之前**）加 `APITypeMyVendor`；
   - `common/api_type.go` 的 `ChannelType2APIType` 加映射；
   - `relay/relay_adaptor.go:55` 的 `GetAdaptor` 加 `case constant.APITypeMyVendor: return &myvendor.Adaptor{}`；
   - `constant/channel.go` 加 `ChannelTypeMyVendor`、`ChannelBaseURLs`、`ChannelTypeName`；
   - 需要则加 `streamSupportedChannels`。

4. **流式**：用 `helper.StreamScannerHandler`，参考 `relay/channel/openai/relay-openai.go:104`。

5. **前端**：同场景 B 第 5 步。

**关键注意点**

- `DoResponse` 返回的 `usage` 必须是 `*dto.Usage`——`TextHelper` 会直接 `usage.(*dto.Usage)` 断言（`relay/compatible_handler.go:214`）。
- 可选标量字段必须用指针 + `omitempty`，否则显式 `0` / `false` 会被静默丢弃。
- `GetRequestURL` 返回的地址要拼 `info.ChannelBaseUrl`（用户可覆写），不要硬编码域名。

### 6.5 场景 D：新增异步任务渠道

以接入一个新的视频生成上游为例。

**步骤**

1. **建包** `relay/channel/task/<vendor>/`，含 `constants.go`（`ModelList`、`ChannelName`）与 `adaptor.go`。

2. **实现骨架**：

```go
package myvendor

type TaskAdaptor struct {
    taskcommon.BaseBilling        // 内嵌：拿到三个计费方法的默认实现
    ChannelType int
    apiKey      string
    baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
    a.ChannelType = info.ChannelType
    a.baseURL = info.ChannelBaseUrl
    a.apiKey = info.ApiKey
}

// 校验请求；通用校验器只认顶层 prompt，原生格式需自行回填
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
    return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
    // 返回倍率，如 {"seconds": 5, "resolution-1080P": 1.6}
    // 用户可控数值必须先用 relaycommon.MaxTaskDurationSeconds 等常量限流
    return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
    return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
    req.Header.Set("Authorization", "Bearer "+a.apiKey)
    req.Header.Set("Content-Type", "application/json")
    return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
    req, err := relaycommon.GetTaskRequest(c)
    if err != nil { return nil, err }
    body := a.convertToUpstream(&req, info)
    data, err := common.Marshal(body)
    if err != nil { return nil, err }
    return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
    return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, err *dto.TaskError) {
    responseBody, _ := io.ReadAll(resp.Body)
    _ = resp.Body.Close()
    var up upstreamResp
    if e := common.Unmarshal(responseBody, &up); e != nil {
        return "", nil, service.TaskErrorWrapper(e, "unmarshal_response_body_failed", http.StatusInternalServerError)
    }
    if up.ID == "" {
        return "", nil, service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
    }
    ov := dto.NewOpenAIVideo()
    ov.ID = info.PublicTaskID
    ov.TaskID = info.PublicTaskID
    ov.CreatedAt = time.Now().Unix()
    ov.Model = info.OriginModelName
    c.JSON(http.StatusOK, ov)          // 先响应用户，再返回上游任务 ID
    return up.ID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
    taskID, ok := body["task_id"].(string)
    if !ok { return nil, fmt.Errorf("invalid task_id") }
    req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/v1/tasks/%s", baseUrl, taskID), nil)
    if err != nil { return nil, err }
    req.Header.Set("Authorization", "Bearer "+key)
    client, err := service.GetHttpClientWithProxy(proxy)
    if err != nil { return nil, err }
    return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
    // 把上游状态映射到 model.TaskStatusXxx，填 Url / Reason / Progress
}

// 可选：让前端按 OpenAI Video 格式读取任务
func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) { ... }
```

3. **注册**：
   - `constant/channel.go` 加 `ChannelTypeMyVendorVideo`、`ChannelBaseURLs`、`ChannelTypeName`；
   - `relay/relay_adaptor.go:146` 的 `GetTaskAdaptor` 加 `case constant.ChannelTypeMyVendorVideo: return &myvendor.TaskAdaptor{}`；
   - 若渠道有专属 URL 前缀（如 `/kling/v1`），在 `router/video-router.go` 加路由组并配相应转换中间件。

4. **计费**：若需按分辨率/时长差异化，实现 `EstimateBilling` 并在 `constants.go` 里维护价格表（参考 `relay/channel/task/ali/constants.go:30` 的 `videoPriceTable` 或 `relay/channel/task/doubao/constants.go:30`）。

**关键注意点**

- `DoResponse` **必须先 `c.JSON` 响应客户端**，再返回 `(上游任务ID, 原始响应体)`。原始响应体会存库供轮询解析。
- `BuildRequestURL` / `BuildRequestHeader` 里不要读 body——body 已经在 `BuildRequestBody` 阶段被消费。
- 上游原生格式若把 prompt 放在嵌套字段（如 `content[].text`），通用校验器 `ValidateBasicTaskRequest` 会报 "prompt is required"。需要在校验前回填，参考 `relay/channel/task/doubao2/adaptor.go:135` 的 `prefillNativePrompt`。
- `EstimateBilling` 在 `ModelPriceHelperPerCall` **之后**调用（`relay/relay_task.go:188-195`），因为后者会重建 `PriceData`。

### 6.6 场景 E：新增入口协议

极少见。需要：

1. `types/relay_format.go` 加 `RelayFormatXxx`；
2. `relay/constant/relay_mode.go` 加 `RelayModeXxx`，并在 `Path2RelayMode` 加路径识别；
3. `router/relay-router.go` 注册路由；
4. `dto` 里定义请求结构体并实现 `dto.Request` 接口；
5. `relay/helper/valid_request.go` 的 `GetAndValidateRequest` 加分支；
6. `relay/common/relay_info.go` 加 `GenRelayInfoXxx` 并在 `GenRelayInfo`（`:543`）加 case；
7. 新建 `relay/xxx_handler.go` 的 Helper，在 `controller/relay.go:37` 的 `relayHandler` 分派。

### 6.7 开发检查清单

适配完成后逐项确认：

- [ ] `constant/channel.go`：类型常量、`ChannelBaseURLs`（**按索引对齐**）、`ChannelTypeName` 三处都加了
- [ ] `common/api_type.go`：`ChannelType2APIType` 有映射
- [ ] `relay/relay_adaptor.go`：`GetAdaptor` 或 `GetTaskAdaptor` 已注册
- [ ] 上游支持 `StreamOptions` 则加入 `streamSupportedChannels`
- [ ] 所有 JSON 序列化走 `common.Marshal` / `common.Unmarshal`
- [ ] 可选标量字段用指针 + `omitempty`
- [ ] 用户可控的计费倍率（数量、时长、分辨率）已在校验阶段限流
- [ ] 配额转换用 `common.QuotaFromFloat*` / `QuotaRound*`，无裸 `int()` 强转
- [ ] 若从 `metadata` / multipart 读倍率，已就地限流
- [ ] 异步渠道：`DoResponse` 先响应客户端、后返回上游 ID
- [ ] 数据库代码在 SQLite / MySQL / PostgreSQL 三库可用
- [ ] 前端 `CHANNEL_TYPES` 已加（可选：`CHANNEL_TYPE_CONFIGS`）
- [ ] `go build ./...` 通过

---

## 七、参考实现索引

按复杂度从低到高：

| 参考对象 | 路径 | 适合作为模板的场景 |
|---|---|---|
| 阿里云视频 | `relay/channel/task/ali/adaptor.go` | 异步任务、分辨率/时长倍率计费、metadata 透传 |
| 豆包视频（原生格式） | `relay/channel/task/doubao2/adaptor.go` | 异步任务、原生请求体预处理回填 |
| 豆包视频（旧版） | `relay/channel/task/doubao/adaptor.go` + `constants.go` | 多档位价格表 |
| OpenAI | `relay/channel/openai/adaptor.go` | 同步全格式适配，最完整的 `Adaptor` 实现 |
| OpenAI 流式 | `relay/channel/openai/relay-openai.go` | SSE 流式处理 |
| Claude | `relay/channel/claude/adaptor.go` | 非 OpenAI 协议的同步适配 |
| Coze | `relay/channel/coze/adaptor.go` | 仅实现部分格式（其余返回 not implemented） |
| 高级自定义 | `relay/channel/advancedcustom/adaptor.go` | 用户自定义请求模板 |
