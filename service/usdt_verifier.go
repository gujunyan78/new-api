package service

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/shopspring/decimal"
)

const (
	usdtVerifierTickInterval = 30 * time.Second
	// TRC-20 USDT contract address on Tron mainnet.
	tronUsdtContract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
	// ERC-20 USDT contract address on Ethereum mainnet.
	ethUsdtContract = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
)

var (
	usdtVerifierOnce    sync.Once
	usdtVerifierRunning atomic.Bool
)

// ---------- Order-level lock for the verifier ----------
// This is a local lock to prevent concurrent verification of the same order
// within the verifier goroutine. It mirrors the controller.LockOrder pattern
// but avoids an import cycle (service cannot import controller).

var (
	usdtOrderLocks     sync.Map
	usdtOrderLockGuard sync.Mutex
)

type usdtRefCountedMutex struct {
	mu       sync.Mutex
	refCount int
}

func lockUsdtOrder(tradeNo string) {
	usdtOrderLockGuard.Lock()
	var rcm *usdtRefCountedMutex
	if v, ok := usdtOrderLocks.Load(tradeNo); ok {
		rcm = v.(*usdtRefCountedMutex)
	} else {
		rcm = &usdtRefCountedMutex{}
		usdtOrderLocks.Store(tradeNo, rcm)
	}
	rcm.refCount++
	usdtOrderLockGuard.Unlock()
	rcm.mu.Lock()
}

func unlockUsdtOrder(tradeNo string) {
	v, ok := usdtOrderLocks.Load(tradeNo)
	if !ok {
		return
	}
	rcm := v.(*usdtRefCountedMutex)
	rcm.mu.Unlock()

	usdtOrderLockGuard.Lock()
	rcm.refCount--
	if rcm.refCount == 0 {
		usdtOrderLocks.Delete(tradeNo)
	}
	usdtOrderLockGuard.Unlock()
}

// StartUsdtVerifier launches the background goroutine that periodically
// verifies pending USDT orders. Only runs on the master node.
func StartUsdtVerifier() {
	usdtVerifierOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("USDT verifier started: tick=%s", usdtVerifierTickInterval))
			ticker := time.NewTicker(usdtVerifierTickInterval)
			defer ticker.Stop()

			runUsdtVerifierOnce()
			for range ticker.C {
				runUsdtVerifierOnce()
			}
		})
	})
}

// runUsdtVerifierOnce executes a single verification cycle. It uses an atomic
// flag to prevent overlapping runs.
func runUsdtVerifierOnce() {
	if !usdtVerifierRunning.CompareAndSwap(false, true) {
		return
	}
	defer usdtVerifierRunning.Store(false)

	if !setting.UsdtEnabled {
		return
	}

	ExpireTimedOutOrders()
	VerifyPendingOrders()
}

// ExpireTimedOutOrders marks all pending USDT orders whose expire_time has
// passed as expired.
func ExpireTimedOutOrders() {
	ctx := context.Background()
	orders, err := model.GetPendingUsdtOrders()
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to get pending orders: %v", err))
		return
	}

	now := common.GetTimestamp()
	for _, order := range orders {
		var info constant.UsdtExtraInfo
		if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
			continue
		}
		if info.ExpireTime > 0 && now > info.ExpireTime {
			order.Status = common.TopUpStatusExpired
			if err := order.Update(); err != nil {
				logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to expire order %s: %v", order.TradeNo, err))
			}
		}
	}
}

// VerifyPendingOrders iterates over all pending USDT orders, queries the
// corresponding blockchain API, and completes orders whose transactions match.
func VerifyPendingOrders() {
	ctx := context.Background()
	orders, err := model.GetPendingUsdtOrders()
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to get pending orders: %v", err))
		return
	}

	for _, order := range orders {
		var info constant.UsdtExtraInfo
		if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
			logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to parse extra_info for order %s: %v", order.TradeNo, err))
			continue
		}

		// Skip already-expired orders (may have been expired in the same cycle).
		if info.ExpireTime > 0 && common.GetTimestamp() > info.ExpireTime {
			continue
		}

		// Order-level lock to prevent concurrent processing.
		lockUsdtOrder(order.TradeNo)

		// Re-fetch order status under lock to avoid stale reads.
		freshOrder := model.GetTopUpByTradeNo(order.TradeNo)
		if freshOrder == nil || freshOrder.Status != common.TopUpStatusPending {
			unlockUsdtOrder(order.TradeNo)
			continue
		}

		var transactions []constant.BlockchainTransaction
		var queryErr error

		switch strings.ToLower(info.BlockchainType) {
		case "tron":
			transactions, queryErr = QueryTronTransactions(info.WalletAddress, setting.TronGridApiKey)
		case "ethereum":
			transactions, queryErr = QueryEthereumTransactions(info.WalletAddress, setting.EtherscanApiKey)
		default:
			unlockUsdtOrder(order.TradeNo)
			continue
		}

		if queryErr != nil {
			logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to query %s transactions for order %s: %v", info.BlockchainType, order.TradeNo, queryErr))
			unlockUsdtOrder(order.TradeNo)
			continue
		}

		matched := MatchTransaction(freshOrder, transactions)
		if matched != nil {
			if err := CompleteUsdtOrder(freshOrder.TradeNo); err != nil {
				logger.LogError(ctx, fmt.Sprintf("USDT verifier: failed to complete order %s: %v", freshOrder.TradeNo, err))
			}
		}

		unlockUsdtOrder(order.TradeNo)
	}
}

// MatchTransaction finds a blockchain transaction whose amount matches the
// order's usdt_amount (to three decimal places) and whose recipient is the
// order's wallet address.
func MatchTransaction(order *model.TopUp, transactions []constant.BlockchainTransaction) *constant.BlockchainTransaction {
	var info constant.UsdtExtraInfo
	if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
		return nil
	}

	orderAmount, err := decimal.NewFromString(info.UsdtAmount)
	if err != nil {
		return nil
	}

	for i := range transactions {
		tx := &transactions[i]
		// Verify recipient matches the wallet address (case-insensitive for Ethereum).
		if !strings.EqualFold(tx.To, info.WalletAddress) {
			continue
		}
		txAmount := decimal.NewFromFloat(tx.Amount)
		// Compare to three decimal places: difference must be < 0.001.
		diff := orderAmount.Sub(txAmount).Abs()
		if diff.LessThan(decimal.NewFromFloat(0.001)) {
			return tx
		}
	}
	return nil
}

// CompleteUsdtOrder marks a pending USDT order as success and increases the
// user's quota. It reuses the same quota calculation logic as ManualCompleteTopUp
// (Amount * QuotaPerUnit for non-stripe orders).
func CompleteUsdtOrder(tradeNo string) error {
	ctx := context.Background()
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return fmt.Errorf("订单不存在: %s", tradeNo)
	}
	if topUp.Status != common.TopUpStatusPending {
		return nil // idempotent
	}

	dAmount := decimal.NewFromInt(topUp.Amount)
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
	if quotaToAdd <= 0 {
		return fmt.Errorf("无效的充值额度: order %s", tradeNo)
	}

	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = common.GetTimestamp()
	if err := topUp.Update(); err != nil {
		return fmt.Errorf("更新订单状态失败: %w", err)
	}

	if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
		return fmt.Errorf("增加用户额度失败: %w", err)
	}

	model.RecordLog(topUp.UserId, model.LogTypeTopup,
		fmt.Sprintf("USDT 自动充值成功，充值额度: %v，支付金额: %s USDT",
			logger.FormatQuota(quotaToAdd), getOrderUsdtAmount(topUp)))

	logger.LogInfo(ctx, fmt.Sprintf("USDT verifier: order %s completed, user %d, quota +%d",
		tradeNo, topUp.UserId, quotaToAdd))

	return nil
}

// getOrderUsdtAmount extracts the usdt_amount from the order's ExtraInfo.
func getOrderUsdtAmount(order *model.TopUp) string {
	var info constant.UsdtExtraInfo
	if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
		return "unknown"
	}
	return info.UsdtAmount
}

// ---------- Blockchain API queries ----------

// tronTRC20Response represents the TronGrid TRC-20 transaction list response.
type tronTRC20Response struct {
	Data []tronTRC20Tx `json:"data"`
}

type tronTRC20Tx struct {
	TransactionID  string `json:"transaction_id"`
	From           string `json:"from"`
	To             string `json:"to"`
	Value          string `json:"value"`
	BlockTimestamp int64  `json:"block_timestamp"`
}

// QueryTronTransactions calls the TronGrid API to fetch recent TRC-20 USDT
// transfers to the given wallet address.
func QueryTronTransactions(walletAddress, apiKey string) ([]constant.BlockchainTransaction, error) {
	url := fmt.Sprintf(
		"https://api.trongrid.io/v1/accounts/%s/transactions/trc20?only_to=true&limit=50&contract_address=%s",
		walletAddress, tronUsdtContract,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	if apiKey != "" {
		req.Header.Set("TRON-PRO-API-KEY", apiKey)
	}

	client := GetHttpClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 TronGrid API 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TronGrid API 返回状态码 %d: %s", resp.StatusCode, string(body))
	}

	var result tronTRC20Response
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return nil, fmt.Errorf("解析 TronGrid 响应失败: %w", err)
	}

	var transactions []constant.BlockchainTransaction
	for _, tx := range result.Data {
		// TRC-20 USDT has 6 decimals; value is in the smallest unit.
		amount := parseTronAmount(tx.Value)
		transactions = append(transactions, constant.BlockchainTransaction{
			TxHash:    tx.TransactionID,
			From:      tx.From,
			To:        tx.To,
			Amount:    amount,
			Timestamp: tx.BlockTimestamp / 1000, // ms → s
		})
	}
	return transactions, nil
}

// parseTronAmount converts a TRC-20 raw value string (6 decimals) to a float64.
func parseTronAmount(value string) float64 {
	d, err := decimal.NewFromString(value)
	if err != nil {
		return 0
	}
	// USDT on Tron has 6 decimal places.
	result, _ := d.Div(decimal.NewFromFloat(math.Pow10(6))).Float64()
	return result
}

// etherscanTokenTxResponse represents the Etherscan ERC-20 token transfer response.
type etherscanTokenTxResponse struct {
	Status  string             `json:"status"`
	Message string             `json:"message"`
	Result  []etherscanTokenTx `json:"result"`
}

type etherscanTokenTx struct {
	Hash         string `json:"hash"`
	From         string `json:"from"`
	To           string `json:"to"`
	Value        string `json:"value"`
	TimeStamp    string `json:"timeStamp"`
	TokenDecimal string `json:"tokenDecimal"`
}

// QueryEthereumTransactions calls the Etherscan API to fetch recent ERC-20 USDT
// transfers to the given wallet address.
func QueryEthereumTransactions(walletAddress, apiKey string) ([]constant.BlockchainTransaction, error) {
	url := fmt.Sprintf(
		"https://api.etherscan.io/api?module=account&action=tokentxs&contractaddress=%s&address=%s&sort=desc&page=1&offset=50&apikey=%s",
		ethUsdtContract, walletAddress, apiKey,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	client := GetHttpClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 Etherscan API 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Etherscan API 返回状态码 %d: %s", resp.StatusCode, string(body))
	}

	var result etherscanTokenTxResponse
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return nil, fmt.Errorf("解析 Etherscan 响应失败: %w", err)
	}

	if result.Status != "1" {
		return nil, fmt.Errorf("Etherscan API 错误: %s", result.Message)
	}

	var transactions []constant.BlockchainTransaction
	for _, tx := range result.Result {
		amount := parseEtherscanAmount(tx.Value, tx.TokenDecimal)
		ts := parseTimestamp(tx.TimeStamp)
		transactions = append(transactions, constant.BlockchainTransaction{
			TxHash:    tx.Hash,
			From:      tx.From,
			To:        tx.To,
			Amount:    amount,
			Timestamp: ts,
		})
	}
	return transactions, nil
}

// parseEtherscanAmount converts a raw token value string with the given decimal
// places to a float64.
func parseEtherscanAmount(value, tokenDecimal string) float64 {
	d, err := decimal.NewFromString(value)
	if err != nil {
		return 0
	}
	dec, err := decimal.NewFromString(tokenDecimal)
	if err != nil {
		// Default USDT decimals = 6.
		dec = decimal.NewFromInt(6)
	}
	divisor := decimal.NewFromFloat(math.Pow10(int(dec.IntPart())))
	result, _ := d.Div(divisor).Float64()
	return result
}

// parseTimestamp converts a string Unix timestamp to int64.
func parseTimestamp(s string) int64 {
	d, err := decimal.NewFromString(s)
	if err != nil {
		return 0
	}
	return d.IntPart()
}
