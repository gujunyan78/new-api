package model

import (
	"crypto/md5"
	"encoding/xml"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	PaymentMethodSbp     = "sbp"
	PaymentProviderSbp   = "sbp"
	SbpServicePay        = "pay.mts.native"
	SbpServiceQuery      = "unified.trade.query"
	SbpSignTypeMD5       = "MD5"
	SbpVersion           = "2.0"
	SbpTradeStateSuccess = "SUCCESS"
	SbpTradeStateNotPay  = "NOTPAY"
	SbpTradeStateFail    = "FAIL"
	SbpTradeStateRefund  = "REFUND"
)

type SbpPayRequest struct {
	XMLName     xml.Name `xml:"xml"`
	Service     string   `xml:"service"`
	Version     string   `xml:"version"`
	NonceStr    string   `xml:"nonce_str"`
	Sign        string   `xml:"sign"`
	SignType    string   `xml:"sign_type"`
	MchId       string   `xml:"mch_id"`
	OutTradeNo  string   `xml:"out_trade_no"`
	TotalFee    int64    `xml:"total_fee"`
	MchCreateIp string   `xml:"mch_create_ip"`
	Body        string   `xml:"body"`
	NotifyUrl   string   `xml:"notify_url"`
	CallbackUrl string   `xml:"callback_url,omitempty"`
	DeviceInfo  string   `xml:"device_info,omitempty"`
	TimeoutRule int      `xml:"timeout_rule,omitempty"`
}

type SbpPayResponse struct {
	XMLName          xml.Name `xml:"xml"`
	Version          string   `xml:"version"`
	Status           string   `xml:"status"`
	ResultCode       string   `xml:"result_code"`
	NonceStr         string   `xml:"nonce_str"`
	SignType         string   `xml:"sign_type"`
	Sign             string   `xml:"sign"`
	Charset          string   `xml:"charset"`
	MchId            string   `xml:"mch_id"`
	OutTradeNo       string   `xml:"out_trade_no"`
	TransactionId    string   `xml:"transaction_id"`
	OutTransactionId string   `xml:"out_transaction_id"`
	LocalQrcId       string   `xml:"local_qrc_id"`
	CodeImgUrl       string   `xml:"code_img_url"`
	CodeUrl          string   `xml:"code_url"`
	ErrCode          string   `xml:"err_code"`
	ErrMsg           string   `xml:"err_msg"`
}

type SbpQueryRequest struct {
	XMLName       xml.Name `xml:"xml"`
	Version       string   `xml:"version"`
	Service       string   `xml:"service"`
	NonceStr      string   `xml:"nonce_str"`
	Charset       string   `xml:"charset"`
	MchId         string   `xml:"mch_id"`
	OutTradeNo    string   `xml:"out_trade_no,omitempty"`
	TransactionId string   `xml:"transaction_id,omitempty"`
	Sign          string   `xml:"sign"`
	SignType      string   `xml:"sign_type"`
}

type SbpQueryResponse struct {
	XMLName          xml.Name `xml:"xml"`
	Version          string   `xml:"version"`
	Charset          string   `xml:"charset"`
	SignType         string   `xml:"sign_type"`
	Sign             string   `xml:"sign"`
	ResultCode       string   `xml:"result_code"`
	Status           string   `xml:"status"`
	NonceStr         string   `xml:"nonce_str"`
	PayResult        string   `xml:"pay_result"`
	FeeType          string   `xml:"fee_type"`
	LocalFeeType     string   `xml:"local_fee_type"`
	LocalTotalFee    string   `xml:"local_total_fee"`
	MchId            string   `xml:"mch_id"`
	OrderFee         string   `xml:"order_fee"`
	OutTradeNo       string   `xml:"out_trade_no"`
	OutTransactionId string   `xml:"out_transaction_id"`
	TimeEnd          string   `xml:"time_end"`
	TotalFee         string   `xml:"total_fee"`
	TradeState       string   `xml:"trade_state"`
	TradeType        string   `xml:"trade_type"`
	TransactionId    string   `xml:"transaction_id"`
	DeviceInfo       string   `xml:"device_info"`
	ErrCode          string   `xml:"err_code"`
	ErrMsg           string   `xml:"err_msg"`
}

type SbpNotifyRequest struct {
	XMLName          xml.Name `xml:"xml"`
	Charset          string   `xml:"charset"`
	FeeType          string   `xml:"fee_type"`
	LocalFeeType     string   `xml:"local_fee_type"`
	LocalTotalFee    string   `xml:"local_total_fee"`
	MchId            string   `xml:"mch_id"`
	NonceStr         string   `xml:"nonce_str"`
	OrderFee         string   `xml:"order_fee"`
	OutTradeNo       string   `xml:"out_trade_no"`
	OutTransactionId string   `xml:"out_transaction_id"`
	PayResult        string   `xml:"pay_result"`
	ResultCode       string   `xml:"result_code"`
	Sign             string   `xml:"sign"`
	SignType         string   `xml:"sign_type"`
	Status           string   `xml:"status"`
	TimeEnd          string   `xml:"time_end"`
	TotalFee         string   `xml:"total_fee"`
	TradeState       string   `xml:"trade_state"`
	TradeType        string   `xml:"trade_type"`
	TransactionId    string   `xml:"transaction_id"`
	Version          string   `xml:"version"`
	DeviceInfo       string   `xml:"device_info"`
}

func SbpSign(params map[string]string, privateKey string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "sign" || params[k] == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var signStr strings.Builder
	for i, k := range keys {
		if i > 0 {
			signStr.WriteString("&")
		}
		signStr.WriteString(k)
		signStr.WriteString("=")
		signStr.WriteString(params[k])
	}
	signStr.WriteString("&key=")
	signStr.WriteString(privateKey)

	hash := md5.Sum([]byte(signStr.String()))
	return strings.ToUpper(fmt.Sprintf("%x", hash))
}

func SbpVerifySign(params map[string]string, privateKey string) bool {
	if params["sign"] == "" {
		return false
	}
	expectedSign := SbpSign(params, privateKey)
	return strings.EqualFold(expectedSign, params["sign"])
}

func SbpMarshalXML(v interface{}) ([]byte, error) {
	data, err := xml.Marshal(v)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func SbpUnmarshalXML(data []byte, v interface{}) error {
	return xml.Unmarshal(data, v)
}

func SbpBuildPayParams(mchId, outTradeNo string, totalFee int64, mchCreateIp, body, notifyUrl, callbackUrl, privateKey string) *SbpPayRequest {
	params := map[string]string{
		"service":       SbpServicePay,
		"version":       SbpVersion,
		"nonce_str":     common.GetRandomString(32),
		"sign_type":     SbpSignTypeMD5,
		"mch_id":        mchId,
		"out_trade_no":  outTradeNo,
		"total_fee":     fmt.Sprintf("%d", totalFee),
		"mch_create_ip": mchCreateIp,
		"body":          body,
		"notify_url":    notifyUrl,
	}
	if callbackUrl != "" {
		params["callback_url"] = callbackUrl
	}

	sign := SbpSign(params, privateKey)

	return &SbpPayRequest{
		Service:     SbpServicePay,
		Version:     SbpVersion,
		NonceStr:    params["nonce_str"],
		Sign:        sign,
		SignType:    SbpSignTypeMD5,
		MchId:       mchId,
		OutTradeNo:  outTradeNo,
		TotalFee:    totalFee,
		MchCreateIp: mchCreateIp,
		Body:        body,
		NotifyUrl:   notifyUrl,
		CallbackUrl: callbackUrl,
	}
}

func SbpBuildQueryParams(mchId, outTradeNo, transactionId, privateKey string) *SbpQueryRequest {
	params := map[string]string{
		"version":   SbpVersion,
		"service":   SbpServiceQuery,
		"nonce_str": common.GetRandomString(32),
		"charset":   "UTF-8",
		"mch_id":    mchId,
	}
	if outTradeNo != "" {
		params["out_trade_no"] = outTradeNo
	}
	if transactionId != "" {
		params["transaction_id"] = transactionId
	}

	sign := SbpSign(params, privateKey)

	return &SbpQueryRequest{
		Version:       SbpVersion,
		Service:       SbpServiceQuery,
		NonceStr:      params["nonce_str"],
		Charset:       "UTF-8",
		MchId:         mchId,
		OutTradeNo:    outTradeNo,
		TransactionId: transactionId,
		Sign:          sign,
		SignType:      SbpSignTypeMD5,
	}
}

func SbpReadNotifyBody(body io.Reader) (*SbpNotifyRequest, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	var notify SbpNotifyRequest
	if err := xml.Unmarshal(data, &notify); err != nil {
		return nil, err
	}
	return &notify, nil
}

func SbpUnmarshalXMLFromReader(r io.Reader, v interface{}) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	return SbpUnmarshalXML(data, v)
}
