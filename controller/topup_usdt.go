package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type UsdtPayRequest struct {
	Amount         int64  `json:"amount"`
	BlockchainType string `json:"blockchain_type"`
}

// RequestUsdtPay handles POST /api/user/usdt/pay
func RequestUsdtPay(c *gin.Context) {
	var req UsdtPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	userId := c.GetInt("id")
	resp, err := service.CreateUsdtOrder(userId, req.Amount, req.BlockchainType)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, resp)
}

// GetUsdtOrderStatus handles GET /api/user/usdt/status/:trade_no
func GetUsdtOrderStatus(c *gin.Context) {
	tradeNo := c.Param("trade_no")
	if tradeNo == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	order := service.GetUsdtOrderStatus(tradeNo)
	if order == nil {
		common.ApiErrorI18n(c, i18n.MsgUsdtOrderNotFound)
		return
	}
	common.ApiSuccess(c, order)
}
