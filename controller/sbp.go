package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func SbpNotify(c *gin.Context) {
	notify, err := model.SbpReadNotifyBody(c.Request.Body)
	if err != nil {
		common.SysError("failed to read SBP notify body: " + err.Error())
		c.String(http.StatusOK, "FAIL")
		return
	}

	privateKey := common.OptionMap["SbpPrivateKey"]

	params := map[string]string{
		"charset":            notify.Charset,
		"fee_type":           notify.FeeType,
		"local_fee_type":     notify.LocalFeeType,
		"local_total_fee":    notify.LocalTotalFee,
		"mch_id":             notify.MchId,
		"nonce_str":          notify.NonceStr,
		"order_fee":          notify.OrderFee,
		"out_trade_no":       notify.OutTradeNo,
		"out_transaction_id": notify.OutTransactionId,
		"pay_result":         notify.PayResult,
		"result_code":        notify.ResultCode,
		"sign":               notify.Sign,
		"sign_type":          notify.SignType,
		"status":             notify.Status,
		"time_end":           notify.TimeEnd,
		"total_fee":          notify.TotalFee,
		"trade_state":        notify.TradeState,
		"trade_type":         notify.TradeType,
		"transaction_id":     notify.TransactionId,
		"version":            notify.Version,
	}

	if !model.SbpVerifySign(params, privateKey) {
		common.SysError("SBP notify sign verification failed for order: " + notify.OutTradeNo)
		c.String(http.StatusOK, "FAIL")
		return
	}

	if notify.Status != "0" || notify.ResultCode != "0" {
		common.SysError("SBP notify failed for order: " + notify.OutTradeNo)
		c.String(http.StatusOK, "FAIL")
		return
	}

	if notify.TradeState != model.SbpTradeStateSuccess {
		c.String(http.StatusOK, "SUCCESS")
		return
	}

	var topUp model.TopUp
	err = model.DB.Where("trade_no = ?", notify.OutTradeNo).First(&topUp).Error
	if err != nil {
		common.SysError("SBP notify: order not found: " + notify.OutTradeNo)
		c.String(http.StatusOK, "FAIL")
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		c.String(http.StatusOK, "SUCCESS")
		return
	}

	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = time.Now().Unix()
	model.DB.Save(&topUp)
	model.IncreaseUserQuota(topUp.UserId, int(topUp.Amount), false)

	c.String(http.StatusOK, "SUCCESS")
}
