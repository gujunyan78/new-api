package controller

import (
	"crypto/md5"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

// PaynicornPayRequest is the request body for Paynicorn payment.
type PaynicornPayRequest struct {
	Amount int64 `json:"amount"`
}

// paynicornInitPaymentRequest mirrors the Paynicorn API request body fields.
type paynicornInitPaymentRequest struct {
	Amount             string `json:"amount"`
	CountryCode        string `json:"countryCode"`
	Currency           string `json:"currency"`
	OrderId            string `json:"orderId"`
	OrderDescription   string `json:"orderDescription"`
	CpFrontPage        string `json:"cpFrontPage"`
	PayByLocalCurrency string `json:"payByLocalCurrency"`
}

// paynicornInitPaymentResponse mirrors the Paynicorn API response content.
type paynicornInitPaymentResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	TxnId   string `json:"txnId"`
	Status  string `json:"status"`
	WebUrl  string `json:"webUrl"`
}

// paynicornRequestBody is the signed envelope sent to the Paynicorn API.
type paynicornRequestBody struct {
	Content string `json:"content"`
	Sign    string `json:"sign"`
	AppKey  string `json:"appKey"`
}

// paynicornResponseBody is the signed envelope returned by the Paynicorn API.
type paynicornResponseBody struct {
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	Content         string `json:"content"`
	Sign            string `json:"sign"`
}

// paynicornPostbackRequest is the async notification body from Paynicorn.
type paynicornPostbackRequest struct {
	Content string `json:"content"`
	Sign    string `json:"sign"`
}

// paynicornPostbackInfo is the decoded postback content after signature verification.
type paynicornPostbackInfo struct {
	TxnId       string `json:"txnId"`
	OrderId     string `json:"orderId"`
	Amount      string `json:"amount"`
	Currency    string `json:"currency"`
	CountryCode string `json:"countryCode"`
	Status      string `json:"status"`
	Code        string `json:"code"`
	Message     string `json:"message"`
}

// paynicornSign computes the MD5 signature of content + merchantSecret.
func paynicornSign(content, merchantSecret string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(content+merchantSecret)))
}

// paynicornGatewayUrl returns the configured gateway URL, respecting sandbox mode.
func paynicornGatewayUrl() string {
	if common.OptionMap["PaynicornSandbox"] == "true" {
		if url := common.OptionMap["PaynicornSandboxUrl"]; url != "" {
			return strings.TrimRight(url, "/")
		}
	}
	if url := common.OptionMap["PaynicornGatewayUrl"]; url != "" {
		return strings.TrimRight(url, "/")
	}
	// Default to the official Paynicorn API endpoint
	return "https://api.paynicorn.com"
}

// getPaynicornPayMoney converts the user-facing quota amount to the payment
// amount in the configured currency, mirroring the Waffo pricing logic.
func getPaynicornPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * topupGroupRatio * discount
}

// RequestPaynicornPay creates a local order and initiates a Paynicorn payment,
// returning the cashier WebUrl for the frontend to redirect to.
func RequestPaynicornPay(c *gin.Context) {
	if common.OptionMap["PaynicornEnabled"] != "true" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Paynicorn 支付未启用"})
		return
	}

	var req PaynicornPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额无效"})
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, _ := model.GetUserGroup(userId, true)
	payMoney := getPaynicornPayMoney(float64(req.Amount), group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// Normalize Amount for token display mode
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = int64(float64(req.Amount) / common.QuotaPerUnit)
		if amount < 1 {
			amount = 1
		}
	}

	tradeNo := fmt.Sprintf("PAYNICORN-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodPaynicorn,
		PaymentProvider: model.PaymentProviderPaynicorn,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", userId, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	appKey := common.OptionMap["PaynicornAppKey"]
	merchantSecret := common.OptionMap["PaynicornAppSecret"]
	currency := common.OptionMap["PaynicornCurrency"]
	if currency == "" {
		currency = "USD"
	}
	countryCode := common.OptionMap["PaynicornCountryCode"]

	// Frontend redirect URL after payment completion
	returnUrl := common.OptionMap["PaynicornReturnUrl"]
	if returnUrl == "" {
		returnUrl = paymentReturnPath("/console/topup?show_history=true")
	}

	appName := strings.TrimSpace(common.SystemName)
	if appName == "" {
		appName = "New API"
	}

	payReq := paynicornInitPaymentRequest{
		Amount:             strconv.FormatFloat(payMoney, 'f', -1, 64),
		CountryCode:        countryCode,
		Currency:           currency,
		OrderId:            tradeNo,
		OrderDescription:   fmt.Sprintf("%s Recharge %d", appName, amount),
		CpFrontPage:        returnUrl,
		PayByLocalCurrency: "true",
	}

	payUrl := paynicornGatewayUrl() + "/trade/v3/transaction/pay"

	webUrl, txnId, apiErr := paynicornCallInitPayment(payUrl, appKey, merchantSecret, payReq)
	if apiErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn 发起支付失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, apiErr.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	if webUrl == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paynicorn 返回空 WebUrl user_id=%d trade_no=%s txn_id=%s", userId, tradeNo, txnId))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paynicorn 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f txn_id=%s", userId, tradeNo, req.Amount, payMoney, txnId))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": webUrl,
			"order_id":    tradeNo,
		},
	})
}

// paynicornCallInitPayment sends the signed InitPayment request to the Paynicorn API
// and returns the cashier WebUrl, transaction ID, and any error.
func paynicornCallInitPayment(payUrl, appKey, merchantSecret string, req paynicornInitPaymentRequest) (webUrl string, txnId string, err error) {
	jsonBytes, mErr := common.Marshal(req)
	if mErr != nil {
		return "", "", fmt.Errorf("failed to marshal request: %w", mErr)
	}

	content := base64.StdEncoding.EncodeToString(jsonBytes)
	body := paynicornRequestBody{
		Content: content,
		Sign:    paynicornSign(content, merchantSecret),
		AppKey:  appKey,
	}

	bodyBytes, mErr := common.Marshal(body)
	if mErr != nil {
		return "", "", fmt.Errorf("failed to marshal envelope: %w", mErr)
	}

	httpReq, rErr := http.NewRequest("POST", payUrl, strings.NewReader(string(bodyBytes)))
	if rErr != nil {
		return "", "", fmt.Errorf("failed to create request: %w", rErr)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, dErr := client.Do(httpReq)
	if dErr != nil {
		return "", "", fmt.Errorf("request failed: %w", dErr)
	}
	defer resp.Body.Close()

	respBytes, rErr := io.ReadAll(resp.Body)
	if rErr != nil {
		return "", "", fmt.Errorf("failed to read response: %w", rErr)
	}

	var rsp paynicornResponseBody
	if uErr := common.Unmarshal(respBytes, &rsp); uErr != nil {
		return "", "", fmt.Errorf("failed to parse response: %w", uErr)
	}

	if rsp.ResponseCode != "000000" {
		return "", "", fmt.Errorf("paynicorn error: %s", rsp.ResponseMessage)
	}

	// Verify response signature
	expectedSign := paynicornSign(rsp.Content, merchantSecret)
	if expectedSign != rsp.Sign {
		return "", "", fmt.Errorf("response signature verification failed")
	}

	// Decode the inner content
	innerBytes, dErr := base64.StdEncoding.DecodeString(rsp.Content)
	if dErr != nil {
		return "", "", fmt.Errorf("failed to decode content: %w", dErr)
	}

	var payResp paynicornInitPaymentResponse
	if uErr := common.Unmarshal(innerBytes, &payResp); uErr != nil {
		return "", "", fmt.Errorf("failed to parse payment response: %w", uErr)
	}

	return payResp.WebUrl, payResp.TxnId, nil
}

// PaynicornPostback handles the async notification from Paynicorn.
// On success it recharges the user's quota and acknowledges with "success_" + txnId.
func PaynicornPostback(c *gin.Context) {
	merchantSecret := common.OptionMap["PaynicornAppSecret"]

	var req paynicornPostbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(http.StatusInternalServerError, "")
		return
	}

	// Verify signature
	expectedSign := paynicornSign(req.Content, merchantSecret)
	if expectedSign != req.Sign {
		logger.LogWarn(c.Request.Context(), "Paynicorn postback signature verification failed")
		c.String(http.StatusInternalServerError, "")
		return
	}

	// Decode content
	innerBytes, err := base64.StdEncoding.DecodeString(req.Content)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn postback decode failed: %s", err.Error()))
		c.String(http.StatusInternalServerError, "")
		return
	}

	var info paynicornPostbackInfo
	if err := common.Unmarshal(innerBytes, &info); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn postback parse failed: %s", err.Error()))
		c.String(http.StatusInternalServerError, "")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paynicorn postback received order_id=%s txn_id=%s status=%s", info.OrderId, info.TxnId, info.Status))

	// Status "1" means success
	if info.Status != "1" {
		// Mark failed orders
		if info.OrderId != "" {
			if err := model.UpdatePendingTopUpStatus(info.OrderId, model.PaymentProviderPaynicorn, common.TopUpStatusFailed); err != nil &&
				!errors.Is(err, model.ErrTopUpNotFound) &&
				!errors.Is(err, model.ErrTopUpStatusInvalid) {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn 标记失败订单状态失败 trade_no=%s error=%q", info.OrderId, err.Error()))
			}
		}
		// Acknowledge receipt so Paynicorn stops retrying this notification
		c.String(http.StatusOK, "success_"+info.TxnId)
		return
	}

	LockOrder(info.OrderId)
	defer UnlockOrder(info.OrderId)

	if err := model.RechargePaynicorn(info.OrderId, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paynicorn 充值处理失败 trade_no=%s error=%q", info.OrderId, err.Error()))
		c.String(http.StatusInternalServerError, "")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paynicorn 充值成功 trade_no=%s txn_id=%s", info.OrderId, info.TxnId))

	// Acknowledge with "success_" + txnId as required by Paynicorn
	c.String(http.StatusOK, "success_"+info.TxnId)
}
