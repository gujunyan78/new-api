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
	"github.com/gin-gonic/gin"
)

// WepayPayRequest represents the request body for wepay payment
type WepayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"` // "sbp" or "mir"
	TradeNo       string `json:"trade_no,omitempty"`
}

// WepayOrderRequest represents the request body for creating a wepay order
type WepayOrderRequest struct {
	Amount int64 `json:"amount"`
}

// WepayOrderResponse represents the response for wepay order creation
type WepayOrderResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	TradeNo string `json:"trade_no,omitempty"`
	Amount  int    `json:"amount,omitempty"`
}

// WepayPayResponse represents the response for wepay payment
type WepayPayResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	TradeNo    string `json:"trade_no,omitempty"`
	CodeURL    string `json:"code_url,omitempty"`
	CodeImgURL string `json:"code_img_url,omitempty"`
	PayURL     string `json:"pay_url,omitempty"`
	Amount     int    `json:"amount,omitempty"`
}

// WepayQueryResponse represents the response for wepay order query
type WepayQueryResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	TradeNo   string `json:"trade_no,omitempty"`
	IsSuccess bool   `json:"is_success"`
}

// CreateWepayOrder creates a wepay order without executing payment
func CreateWepayOrder(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")

	var req WepayOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, WepayOrderResponse{
			Success: false,
			Message: "invalid request",
		})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusOK, WepayOrderResponse{
			Success: false,
			Message: "invalid amount",
		})
		return
	}

	amount := int(req.Amount)
	tradeNo := fmt.Sprintf("WEPAY%s%d", common.GetRandomString(16), time.Now().UnixMilli())

	topUp := &model.TopUp{
		UserId:        userId,
		Username:      username,
		TradeNo:       tradeNo,
		Amount:        int64(amount),
		Money:         float64(amount),
		Status:        common.TopUpStatusPending,
		CreateTime:    time.Now().Unix(),
		PaymentMethod: "wepay",
	}

	if err := model.DB.Create(topUp).Error; err != nil {
		common.SysError("failed to create wepay order: " + err.Error())
		c.JSON(http.StatusOK, WepayOrderResponse{
			Success: false,
			Message: "failed to create order",
		})
		return
	}

	c.JSON(http.StatusOK, WepayOrderResponse{
		Success: true,
		TradeNo: tradeNo,
		Amount:  amount,
	})
}

// RequestWepayPay handles the wepay payment request
func RequestWepayPay(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")

	var req WepayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "invalid request",
		})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "invalid amount",
		})
		return
	}

	if req.PaymentMethod != "sbp" && req.PaymentMethod != "mir" {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "invalid payment method",
		})
		return
	}

	amount := int(req.Amount)

	var topUp *model.TopUp

	if req.TradeNo != "" {
		topUp = model.GetTopUpByTradeNo(req.TradeNo)
		if topUp == nil {
			c.JSON(http.StatusOK, WepayPayResponse{
				Success: false,
				Message: "order not found",
			})
			return
		}
		if topUp.UserId != userId {
			c.JSON(http.StatusOK, WepayPayResponse{
				Success: false,
				Message: "order does not belong to current user",
			})
			return
		}
		if topUp.Status != common.TopUpStatusPending {
			c.JSON(http.StatusOK, WepayPayResponse{
				Success: false,
				Message: "order already processed",
			})
			return
		}
		topUp.PaymentMethod = model.PaymentMethodSbp
		if req.PaymentMethod == "mir" {
			topUp.PaymentMethod = model.PaymentMethodMir
		}
		model.DB.Save(topUp)
	} else {
		tradeNo := fmt.Sprintf("WEPAY%s%d", common.GetRandomString(16), time.Now().UnixMilli())

		paymentMethod := model.PaymentMethodSbp
		if req.PaymentMethod == "mir" {
			paymentMethod = model.PaymentMethodMir
		}

		topUp = &model.TopUp{
			UserId:        userId,
			Username:      username,
			TradeNo:       tradeNo,
			Amount:        int64(amount),
			Money:         float64(amount),
			Status:        common.TopUpStatusPending,
			CreateTime:    time.Now().Unix(),
			PaymentMethod: paymentMethod,
		}

		if err := model.DB.Create(topUp).Error; err != nil {
			common.SysError("failed to create topup order: " + err.Error())
			c.JSON(http.StatusOK, WepayPayResponse{
				Success: false,
				Message: "failed to create order",
			})
			return
		}
	}

	if req.PaymentMethod == "sbp" {
		handleSbpPayment(c, topUp)
	} else {
		handleMirPayment(c, topUp)
	}
}

// handleSbpPayment handles SBP payment processing
func handleSbpPayment(c *gin.Context, topUp *model.TopUp) {
	mchId := common.OptionMap["WepayMerchantId"]
	privateKey := common.OptionMap["SbpPrivateKey"]
	notifyUrl := common.OptionMap["SbpNotifyUrl"]
	callbackUrl := common.OptionMap["SbpCallbackUrl"]

	if notifyUrl == "" {
		notifyUrl = service.GetCallbackAddress() + "/api/sbp/notify"
	}

	clientIP := c.ClientIP()
	body := fmt.Sprintf("TopUp-%s", topUp.TradeNo)
	totalFee := int64(topUp.Amount)

	payReq := model.SbpBuildPayParams(mchId, topUp.TradeNo, totalFee, clientIP, body, notifyUrl, callbackUrl, privateKey)

	xmlData, err := model.SbpMarshalXML(payReq)
	if err != nil {
		common.SysError("failed to marshal SBP pay request: " + err.Error())
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "failed to create payment request",
		})
		return
	}

	platformUrl := common.OptionMap["SbpPlatformUrl"]
	if common.OptionMap["WepaySandbox"] == "true" {
		platformUrl = common.OptionMap["SbpSandboxUrl"]
	}
	platformUrl = strings.TrimRight(platformUrl, "/")

	payUrl := platformUrl + "/pay/gateway"

	resp, err := http.Post(payUrl, "application/xml", strings.NewReader(string(xmlData)))
	if err != nil {
		common.SysError("SBP pay request failed: " + err.Error())
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "payment gateway request failed",
		})
		return
	}
	defer resp.Body.Close()

	var payResp model.SbpPayResponse
	if err := model.SbpUnmarshalXMLFromReader(resp.Body, &payResp); err != nil {
		common.SysError("failed to parse SBP pay response: " + err.Error())
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "failed to parse payment response",
		})
		return
	}

	if payResp.Status != "0" || payResp.ResultCode != "0" {
		errMsg := payResp.ErrMsg
		if errMsg == "" {
			errMsg = "unknown error"
		}
		common.SysError("SBP pay failed: " + errMsg)
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: errMsg,
		})
		return
	}

	c.JSON(http.StatusOK, WepayPayResponse{
		Success:    true,
		Message:    "",
		TradeNo:    topUp.TradeNo,
		CodeURL:    payResp.CodeUrl,
		CodeImgURL: payResp.CodeImgUrl,
		Amount:     int(topUp.Amount),
	})
}

// handleMirPayment handles MIR payment processing
func handleMirPayment(c *gin.Context, topUp *model.TopUp) {
	if !isMirEnabled() {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "管理员未开启 MIR 支付",
		})
		return
	}

	_, merchantId, privateKey, publicKey, platformUrl, sandboxUrl, notifyUrl, callbackUrl, _ := getMirConfig()

	host := platformUrl
	if common.OptionMap["WepaySandbox"] == "true" && sandboxUrl != "" {
		host = sandboxUrl
	}
	host = strings.TrimRight(host, "/")

	if notifyUrl == "" {
		notifyUrl = service.GetCallbackAddress() + "/api/mir/notify"
	}

	if callbackUrl == "" {
		callbackUrl = service.GetCallbackAddress() + "/api/mir/callback"
	}
	callbackUrl = callbackUrl + "?orderId=" + topUp.TradeNo

	amountInCents := int(topUp.Amount * 100)
	goodsDetail, _ := common.Marshal([]map[string]interface{}{
		{
			"price": amountInCents,
			"num":   1,
			"name":  "TopUp",
		},
	})

	paymentReq := MirPaymentRequestBody{
		Ip: c.ClientIP(),
		OrderInformation: MirOrderInformation{
			Amount:      amountInCents,
			OrderAmount: amountInCents,
			OrderId:     topUp.TradeNo,
			GoodsDetail: string(goodsDetail),
			NotifyUrl:   notifyUrl,
		},
		CallbackUrl: callbackUrl,
	}

	reqBody, err := common.Marshal(paymentReq)
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付请求失败",
		})
		return
	}

	encryptedBody, err := mirEncryptJWE(reqBody, publicKey)
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付请求加密失败",
		})
		return
	}

	jwsAuth, err := mirSignJWS([]byte(encryptedBody), privateKey)
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付请求签名失败",
		})
		return
	}

	payUrl := host + "/gateway/payment/online/mtspay/payment"
	httpReq, err := http.NewRequest("POST", payUrl, strings.NewReader(encryptedBody))
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付请求失败",
		})
		return
	}

	httpReq.Header.Set("Content-Type", "application/jose")
	httpReq.Header.Set("Authorization", jwsAuth)
	httpReq.Header.Set("Merchant-Id", merchantId)
	httpReq.Header.Set("Customer-Request-Id", fmt.Sprintf("%s%d", common.GetRandomString(16), time.Now().UnixMilli()))
	httpReq.Header.Set("Accept-Language", "en-US")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付网关请求失败",
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付网关响应失败",
		})
		return
	}

	var mirResp MirAPIResponse
	if err := common.Unmarshal(respBody, &mirResp); err != nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付网关响应解析失败",
		})
		return
	}

	if mirResp.Code != "00" {
		errMsg := mirResp.Message
		if errMsg == "" {
			errMsg = "支付失败"
		}
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: errMsg,
		})
		return
	}

	if mirResp.Data == nil || mirResp.Data.OrderInformation == nil {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付网关响应格式错误",
		})
		return
	}

	paymentUrl := mirResp.Data.OrderInformation.PaymentUrl
	if paymentUrl == "" {
		c.JSON(http.StatusOK, WepayPayResponse{
			Success: false,
			Message: "支付网关未返回支付链接",
		})
		return
	}

	c.JSON(http.StatusOK, WepayPayResponse{
		Success: true,
		Message: "success",
		TradeNo: topUp.TradeNo,
		PayURL:  paymentUrl,
		Amount:  int(topUp.Amount),
	})
}

// QueryWepayOrder handles wepay order status query
func QueryWepayOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	paymentMethod := c.Query("payment_method")

	if tradeNo == "" {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "trade_no is required",
		})
		return
	}

	if paymentMethod == "sbp" {
		querySbpOrder(c, tradeNo)
	} else if paymentMethod == "mir" {
		queryMirOrder(c, tradeNo)
	} else {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "invalid payment method",
		})
	}
}

func querySbpOrder(c *gin.Context, tradeNo string) {
	mchId := common.OptionMap["WepayMerchantId"]
	privateKey := common.OptionMap["SbpPrivateKey"]

	queryReq := model.SbpBuildQueryParams(mchId, tradeNo, "", privateKey)

	xmlData, err := model.SbpMarshalXML(queryReq)
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "failed to create query request",
		})
		return
	}

	platformUrl := common.OptionMap["SbpPlatformUrl"]
	if common.OptionMap["WepaySandbox"] == "true" {
		platformUrl = common.OptionMap["SbpSandboxUrl"]
	}
	platformUrl = strings.TrimRight(platformUrl, "/")

	queryUrl := platformUrl + "/pay/gateway"

	resp, err := http.Post(queryUrl, "application/xml", strings.NewReader(string(xmlData)))
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "query request failed",
		})
		return
	}
	defer resp.Body.Close()

	var queryResp model.SbpQueryResponse
	if err := model.SbpUnmarshalXMLFromReader(resp.Body, &queryResp); err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "failed to parse query response",
		})
		return
	}

	if queryResp.Status != "0" || queryResp.ResultCode != "0" {
		errMsg := queryResp.ErrMsg
		if errMsg == "" {
			errMsg = "unknown error"
		}
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   errMsg,
			TradeNo:   tradeNo,
			IsSuccess: false,
		})
		return
	}

	isSuccess := queryResp.TradeState == model.SbpTradeStateSuccess

	if isSuccess {
		var topUp model.TopUp
		err := model.DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
		if err == nil && topUp.Status == common.TopUpStatusPending {
			topUp.Status = common.TopUpStatusSuccess
			topUp.CompleteTime = time.Now().Unix()
			model.DB.Save(&topUp)
			model.IncreaseUserQuota(topUp.UserId, int(topUp.Amount), false)
		}
	}

	c.JSON(http.StatusOK, WepayQueryResponse{
		Success:   true,
		TradeNo:   tradeNo,
		IsSuccess: isSuccess,
	})
}

func queryMirOrder(c *gin.Context, tradeNo string) {
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success: false,
			Message: "订单不存在",
		})
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   true,
			TradeNo:   tradeNo,
			IsSuccess: true,
		})
		return
	}

	// Query MIR payment status from upstream
	enabled, merchantId, privateKey, _, platformUrl, sandboxUrl, _, _, _ := getMirConfig()
	if !enabled {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "MIR payment not enabled",
			IsSuccess: false,
		})
		return
	}

	url := platformUrl
	if common.OptionMap["WepaySandbox"] == "true" {
		url = sandboxUrl
	}
	url = strings.TrimRight(url, "/") + "/api/v1/order/query"

	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "failed to create request",
			IsSuccess: false,
		})
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Merchant-Id", merchantId)
	httpReq.Header.Set("Customer-Request-Id", fmt.Sprintf("%s%d", common.GetRandomString(16), time.Now().UnixMilli()))

	jwsAuth, err := mirSignJWS([]byte{}, privateKey)
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "failed to sign request",
			IsSuccess: false,
		})
		return
	}
	httpReq.Header.Set("Authorization", fmt.Sprintf("JWS %s", jwsAuth))

	httpReq.URL.Query().Set("orderId", tradeNo)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "query request failed",
			IsSuccess: false,
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "failed to read response",
			IsSuccess: false,
		})
		return
	}

	var mirResp MirAPIResponse
	if err := common.Unmarshal(respBody, &mirResp); err != nil {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   "failed to parse response",
			IsSuccess: false,
		})
		return
	}

	if mirResp.Code != "00" {
		c.JSON(http.StatusOK, WepayQueryResponse{
			Success:   false,
			Message:   mirResp.Message,
			IsSuccess: false,
		})
		return
	}

	isSuccess := mirResp.Data != nil && mirResp.Data.OrderInformation != nil

	if isSuccess && topUp.Status == common.TopUpStatusPending {
		topUp.Status = common.TopUpStatusSuccess
		topUp.CompleteTime = time.Now().Unix()
		model.DB.Save(&topUp)
		model.IncreaseUserQuota(topUp.UserId, int(topUp.Amount), false)
	}

	c.JSON(http.StatusOK, WepayQueryResponse{
		Success:   true,
		TradeNo:   tradeNo,
		IsSuccess: isSuccess,
	})
}

// isMirEnabled checks if MIR payment is enabled
func isMirEnabled() bool {
	return common.OptionMap["WepayEnabled"] == "true"
}

// getMirConfig retrieves MIR payment configuration
func getMirConfig() (enabled bool, merchantId, privateKey, publicKey, platformUrl, sandboxUrl, notifyUrl, callbackUrl, logo string) {
	enabled = common.OptionMap["WepayEnabled"] == "true"
	merchantId = common.OptionMap["WepayMerchantId"]
	privateKey = common.OptionMap["MirPrivateKey"]
	publicKey = common.OptionMap["MirPublicKey"]
	platformUrl = common.OptionMap["MirPlatformUrl"]
	sandboxUrl = common.OptionMap["MirSandboxUrl"]
	notifyUrl = common.OptionMap["MirNotifyUrl"]
	callbackUrl = common.OptionMap["MirCallbackUrl"]
	logo = common.OptionMap["MirLogo"]
	return
}

// MirOrderInformation represents MIR order information
type MirOrderInformation struct {
	Amount      int    `json:"amount"`
	OrderAmount int    `json:"orderAmount"`
	OrderId     string `json:"orderId"`
	GoodsDetail string `json:"goodsDetail"`
	NotifyUrl   string `json:"notifyUrl"`
	PaymentUrl  string `json:"paymentUrl,omitempty"`
}

// MirPaymentRequestBody represents MIR payment request body
type MirPaymentRequestBody struct {
	Ip               string              `json:"ip"`
	OrderInformation MirOrderInformation `json:"orderInformation"`
	CallbackUrl      string              `json:"callbackUrl"`
}

// MirAPIResponseData represents MIR API response data
type MirAPIResponseData struct {
	OrderInformation *MirOrderInformation `json:"orderInformation"`
}

// MirAPIResponse represents MIR API response
type MirAPIResponse struct {
	Code    string              `json:"code"`
	Message string              `json:"message"`
	Data    *MirAPIResponseData `json:"data"`
}

// mirEncryptJWE encrypts data using RSA-OAEP-256 and AES-GCM
func mirEncryptJWE(data []byte, publicKeyPEM string) (string, error) {
	return model.MirEncryptJWE(data, publicKeyPEM)
}

// mirSignJWS signs data using RS256
func mirSignJWS(data []byte, privateKeyPEM string) (string, error) {
	return model.MirSignJWS(data, privateKeyPEM)
}
