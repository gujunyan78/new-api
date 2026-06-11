package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type SilkroadPayRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
	TradeNo       string  `json:"trade_no,omitempty"`
}

type SilkroadPayResponse struct {
	Success    bool    `json:"success"`
	Message    string  `json:"message"`
	TradeNo    string  `json:"trade_no,omitempty"`
	CodeURL    string  `json:"code_url,omitempty"`
	CodeImgURL string  `json:"code_img_url,omitempty"`
	PayURL     string  `json:"pay_url,omitempty"`
	Amount     float64 `json:"amount,omitempty"`
}

type SilkroadQueryResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	TradeNo   string `json:"trade_no,omitempty"`
	IsSuccess bool   `json:"is_success"`
}

type silkroadApiResponse struct {
	Code    string                 `json:"code"`
	Msg     string                 `json:"msg"`
	Data    *silkroadApiResultData `json:"data"`
	Success bool                   `json:"success"`
}

type silkroadApiResultData struct {
	PrepayId      int64               `json:"prepay_id"`
	TransactionId int64               `json:"transaction_id"`
	ExtOrderNo    string              `json:"ext_order_no"`
	QrCode        string              `json:"qr_code"`      // 旧版兼容
	QrCodeUrl     string              `json:"qr_code_url"`  // 旧版兼容
	QrCodeInfo    *silkroadQrCodeInfo `json:"qr_code_info"` // 新版 Gwiff Pay
	PaymentLink   string              `json:"payment_link"`
	Status        string              `json:"status"`
}

type silkroadQrCodeInfo struct {
	QrcId    string `json:"qrc_id"`
	QrcImage string `json:"qrc_image"` // base64 图片
}

type silkroadNotifyBody struct {
	Type string              `json:"type"`
	Data *silkroadNotifyData `json:"data"`
}

type silkroadNotifyData struct {
	TransactionId int64   `json:"transaction_id"`
	OrderNo       string  `json:"order_no"`
	ExtOrderNo    string  `json:"ext_order_no"`
	Status        int     `json:"status"` // -2过期 -1失败 0待处理 1处理中 2成功 3退款 4部分退款
	Amount        float64 `json:"amount"` // 支付金额，用于校验
}

func RequestSilkroadPay(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")

	cfg := setting.GetSilkroadConfig()
	common.SysLog(fmt.Sprintf("[DEBUG] silkroad config: Enabled=%v, MchId=%s, AppId=%s, SerialNo=%s, GatewayUrl=%s, PrivateKeyLen=%d",
		cfg.Enabled, cfg.MchId, cfg.AppId, cfg.SerialNo, cfg.GatewayUrl, len(cfg.PrivateKey)))

	if !cfg.Enabled {
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "Gwiff Pay 未启用",
		})
		return
	}

	var req SilkroadPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.SysError("[DEBUG] silkroad bind request failed: " + err.Error())
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "invalid request",
		})
		return
	}

	common.SysLog(fmt.Sprintf("[DEBUG] silkroad request: Amount=%v, PaymentMethod=%s, TradeNo=%s",
		req.Amount, req.PaymentMethod, req.TradeNo))

	if req.Amount <= 0 {
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "invalid amount",
		})
		return
	}

	if req.PaymentMethod != "sbp" && req.PaymentMethod != "mir" {
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "invalid payment method",
		})
		return
	}

	paymentMethod := model.PaymentMethodSbp
	if req.PaymentMethod == "mir" {
		paymentMethod = model.PaymentMethodMir
	}

	var tradeNo string
	if req.TradeNo != "" {
		tradeNo = req.TradeNo
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil || topUp.UserId != userId || topUp.Status != common.TopUpStatusPending {
			c.JSON(http.StatusOK, SilkroadPayResponse{
				Success: false,
				Message: "订单不存在或已处理",
			})
			return
		}
		topUp.PaymentMethod = paymentMethod
		topUp.PaymentProvider = "silkroad"
		model.DB.Save(topUp)
	} else {
		tradeNo = fmt.Sprintf("SILKROAD%s%d", common.GetRandomString(16), time.Now().UnixMilli())
		topUp := &model.TopUp{
			UserId:          userId,
			Username:        username,
			TradeNo:         tradeNo,
			Amount:          int64(req.Amount),
			Money:           req.Amount,
			Status:          common.TopUpStatusPending,
			CreateTime:      time.Now().Unix(),
			PaymentMethod:   paymentMethod,
			PaymentProvider: "silkroad",
		}
		if err := model.DB.Create(topUp).Error; err != nil {
			common.SysError("failed to create silkroad topup order: " + err.Error())
			c.JSON(http.StatusOK, SilkroadPayResponse{
				Success: false,
				Message: "创建订单失败",
			})
			return
		}
	}

	notifyUrl := cfg.NotifyUrl
	if notifyUrl == "" {
		notifyUrl = service.GetCallbackAddress() + "/api/silkroad/notify"
	}

	common.SysLog(fmt.Sprintf("[DEBUG] silkroad notify_url: %s", notifyUrl))

	apiBody := map[string]interface{}{
		"category":       cfg.Category,
		"ext_order_no":   tradeNo,
		"nonce":          tradeNo,
		"amount":         req.Amount,
		"currency":       cfg.Currency,
		"payment_method": cfg.PaymentMethod,
		"notify_url":     notifyUrl,
		"description":    "Account TopUp",
	}

	common.SysLog(fmt.Sprintf("[DEBUG] silkroad apiBody: category=%d, ext_order_no=%s, nonce=%s, amount=%v, currency=%s, payment_method=%s",
		cfg.Category, tradeNo, tradeNo, req.Amount, cfg.Currency, cfg.PaymentMethod))

	apiPath := "/v1/payment/qrcode"
	if req.PaymentMethod == "mir" {
		apiPath = "/v1/payment/initiate"
	}

	bodyBytes, _ := common.Marshal(apiBody)
	gatewayUrl := strings.TrimRight(cfg.GatewayUrl, "/")
	apiUrl := gatewayUrl + apiPath

	common.SysLog("[DEBUG] silkroad pay request: url=" + apiUrl + ", body=" + string(bodyBytes))

	httpReq, err := http.NewRequest("POST", apiUrl, strings.NewReader(string(bodyBytes)))
	if err != nil {
		common.SysError("silkroad create http request failed: " + err.Error())
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "请求创建失败",
		})
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")
	authHeader := buildSilkroadAuthHeader(cfg, "POST", apiPath, string(bodyBytes))
	common.SysLog("[DEBUG] silkroad auth header: " + authHeader)
	httpReq.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		common.SysError("silkroad api request failed: " + err.Error())
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "支付网关请求失败",
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	common.SysLog("[DEBUG] silkroad api response: status=" + resp.Status + ", body=" + string(respBody))
	if err != nil {
		common.SysError("silkroad read response failed: " + err.Error())
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "读取响应失败",
		})
		return
	}

	var apiResp silkroadApiResponse
	if err := common.Unmarshal(respBody, &apiResp); err != nil {
		common.SysError("silkroad parse response failed: " + err.Error())
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: "解析响应失败",
		})
		return
	}

	if !isSilkroadSuccess(apiResp.Code, apiResp.Success) {
		errMsg := apiResp.Msg
		if errMsg == "" {
			errMsg = "支付失败"
		}
		common.SysError("silkroad api error: code=" + apiResp.Code + ", msg=" + errMsg)
		c.JSON(http.StatusOK, SilkroadPayResponse{
			Success: false,
			Message: errMsg,
		})
		return
	}

	result := SilkroadPayResponse{
		Success: true,
		TradeNo: tradeNo,
		Amount:  req.Amount,
	}

	if apiResp.Data != nil {
		if req.PaymentMethod == "sbp" {
			// 优先使用新版 qr_code_info (Gwiff Pay 新格式)
			if apiResp.Data.QrCodeInfo != nil && apiResp.Data.QrCodeInfo.QrcImage != "" {
				result.CodeImgURL = apiResp.Data.QrCodeInfo.QrcImage
				result.CodeURL = apiResp.Data.QrCodeInfo.QrcImage
			} else {
				// 旧版兼容
				result.CodeURL = apiResp.Data.QrCode
				if result.CodeURL == "" {
					result.CodeURL = apiResp.Data.QrCodeUrl
				}
				result.CodeImgURL = apiResp.Data.QrCodeUrl
			}
		} else {
			result.PayURL = apiResp.Data.PaymentLink
		}
	}

	c.JSON(http.StatusOK, result)
}

func QuerySilkroadOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(http.StatusOK, SilkroadQueryResponse{
			Success: false,
			Message: "trade_no is required",
		})
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		c.JSON(http.StatusOK, SilkroadQueryResponse{
			Success: false,
			Message: "订单不存在",
		})
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, SilkroadQueryResponse{
			Success:   true,
			TradeNo:   tradeNo,
			IsSuccess: true,
		})
		return
	}

	c.JSON(http.StatusOK, SilkroadQueryResponse{
		Success:   true,
		TradeNo:   tradeNo,
		IsSuccess: false,
	})
}

func SilkroadNotify(c *gin.Context) {
	cfg := setting.GetSilkroadConfig()
	if !cfg.Enabled {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "not enabled"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.SysError("silkroad notify read body failed: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "read body failed"})
		return
	}

	// 从 HTTP Header 获取签名、时间戳、随机串
	signature := c.GetHeader("Gwiffpay-Signature")
	timestamp := c.GetHeader("Gwiffpay-Timestamp")
	nonce := c.GetHeader("Gwiffpay-Nonce")

	if cfg.PlatformPublicKey != "" && signature != "" {
		// 验签名串: 应答时间戳\n应答随机串\n应答报文主体\n
		verifyData := fmt.Sprintf("%s\n%s\n%s\n", timestamp, nonce, string(bodyBytes))
		if err := common.VerifyRSA256(cfg.PlatformPublicKey, []byte(verifyData), signature); err != nil {
			common.SysError("silkroad notify signature verification failed: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "signature verification failed"})
			return
		}
	}

	var notify silkroadNotifyBody
	if err := common.Unmarshal(bodyBytes, &notify); err != nil {
		common.SysError("silkroad notify parse body failed: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "parse body failed"})
		return
	}

	if notify.Data == nil || notify.Data.Status != 2 {
		c.JSON(http.StatusOK, gin.H{"code": "OK"})
		return
	}

	// 按 trade_no + payment_provider 查询，排除非 silkroad 订单
	topUp := model.GetTopUpByTradeNoAndProvider(notify.Data.ExtOrderNo, "silkroad")
	if topUp == nil {
		common.SysError("silkroad notify: order not found or provider mismatch: " + notify.Data.ExtOrderNo)
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "order not found"})
		return
	}

	// 校验金额一致性
	if notify.Data.Amount > 0 && topUp.Money != notify.Data.Amount {
		common.SysError(fmt.Sprintf("silkroad notify: amount mismatch for order %s, expected: %.2f, got: %.2f",
			notify.Data.ExtOrderNo, topUp.Money, notify.Data.Amount))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "msg": "amount mismatch"})
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"code": "OK"})
		return
	}

	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = time.Now().Unix()
	model.DB.Save(topUp)

	// 金额转额度: Amount * QuotaPerUnit
	dAmount := decimal.NewFromInt(int64(topUp.Amount))
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
	model.IncreaseUserQuota(topUp.UserId, quotaToAdd, false)

	ip := c.ClientIP()
	model.RecordTopupLog(topUp.UserId, fmt.Sprintf("Gwiff Pay充值成功，充值额度: %d，支付金额: %.2f", quotaToAdd, topUp.Money), ip, topUp.PaymentMethod, "silkroad")

	c.JSON(http.StatusOK, gin.H{"code": "OK"})
}

func buildSilkroadAuthHeader(cfg setting.SilkroadConfig, method string, path string, body string) string {
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	nonce := common.GetRandomString(32)

	// Log private key diagnostic info BEFORE signing attempt
	keyLen := len(cfg.PrivateKey)
	keyPreview := ""
	if keyLen > 50 {
		keyPreview = cfg.PrivateKey[:50] + "..."
	} else {
		keyPreview = cfg.PrivateKey
	}
	common.SysLog(fmt.Sprintf("[DEBUG] silkroad private key: length=%d, preview=%s", keyLen, keyPreview))

	signData := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, path, timestamp, nonce, body)

	common.SysLog("[DEBUG] silkroad sign data:\n" + signData)

	signature, err := common.SignRSA256(cfg.PrivateKey, []byte(signData))
	if err != nil {
		common.SysError("silkroad sign failed: " + err.Error())
		return ""
	}

	common.SysLog("[DEBUG] silkroad signature: " + signature)

	return fmt.Sprintf(`merchant_id="%s",app_id="%s",nonce="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		cfg.MchId, cfg.AppId, nonce, signature, timestamp, cfg.SerialNo)
}

// isSilkroadSuccess checks whether the silkroad API response indicates success.
// Silkroad uses "code" field: "success" or "0000" for success.
func isSilkroadSuccess(code string, success bool) bool {
	if code == "success" || code == "0000" {
		return true
	}
	if success {
		return true
	}
	return false
}
