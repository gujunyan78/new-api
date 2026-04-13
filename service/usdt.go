package service

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/shopspring/decimal"
)

// UsdtOrderResponse is returned to the controller after a USDT order is created.
type UsdtOrderResponse struct {
	TradeNo        string `json:"trade_no"`
	WalletAddress  string `json:"wallet_address"`
	BlockchainType string `json:"blockchain_type"`
	UsdtAmount     string `json:"usdt_amount"`
	ExpireTime     int64  `json:"expire_time"`
	CreateTime     int64  `json:"create_time"`
}

// ValidateWalletAddress checks that address matches the expected format for blockchainType.
// Tron: starts with "T", length 34. Ethereum: starts with "0x", length 42.
func ValidateWalletAddress(address, blockchainType string) error {
	switch strings.ToLower(blockchainType) {
	case "tron":
		if !strings.HasPrefix(address, "T") || len(address) != 34 {
			return errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtInvalidTronAddress))
		}
	case "ethereum":
		if !strings.HasPrefix(address, "0x") || len(address) != 42 {
			return errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtInvalidEthAddress))
		}
	default:
		return errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtUnsupportedChain, map[string]any{"Type": blockchainType}))
	}
	return nil
}

// GetAvailableWallet returns the highest-priority enabled wallet matching blockchainType.
func GetAvailableWallet(blockchainType string) (*constant.UsdtWallet, error) {
	wallets := setting.GetUsdtWallets()
	if len(wallets) == 0 {
		return nil, errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtNoAvailableWallet))
	}

	var candidates []constant.UsdtWallet
	for _, w := range wallets {
		if w.Enabled && strings.EqualFold(w.BlockchainType, blockchainType) {
			candidates = append(candidates, w)
		}
	}
	if len(candidates) == 0 {
		return nil, errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtNoAvailableWallet))
	}

	// Sort by priority descending, pick the first one.
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Priority > candidates[j].Priority
	})
	result := candidates[0]
	return &result, nil
}

// GetAvailableBlockchainTypes returns the deduplicated set of blockchain types
// from all enabled wallets.
func GetAvailableBlockchainTypes() []string {
	wallets := setting.GetUsdtWallets()
	seen := make(map[string]struct{})
	var types []string
	for _, w := range wallets {
		if !w.Enabled {
			continue
		}
		lower := strings.ToLower(w.BlockchainType)
		if _, ok := seen[lower]; !ok {
			seen[lower] = struct{}{}
			types = append(types, w.BlockchainType)
		}
	}
	return types
}

// GenerateUniqueAmount produces a unique USDT payment amount by adding a small
// random offset (±0.001 to ±0.100, three decimal places) to baseAmount.
// It retries up to 10 times to avoid collisions with pending orders on the same wallet.
func GenerateUniqueAmount(baseAmount float64, walletAddress string) (string, error) {
	pendingOrders, err := model.GetPendingUsdtOrdersByWallet(walletAddress)
	if err != nil {
		return "", fmt.Errorf("%s: %w", i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtQueryOrderFailed), err)
	}

	// Collect existing amounts for collision detection.
	existingAmounts := make(map[string]struct{})
	for _, order := range pendingOrders {
		var info constant.UsdtExtraInfo
		if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
			continue
		}
		existingAmounts[info.UsdtAmount] = struct{}{}
	}

	base := decimal.NewFromFloat(baseAmount)

	for i := 0; i < 10; i++ {
		// Generate offset: random int in [1, 100], then divide by 1000 → [0.001, 0.100]
		offsetInt := rand.Intn(100) + 1 // 1..100
		offset := decimal.NewFromInt(int64(offsetInt)).Div(decimal.NewFromInt(1000))

		// Randomly negate the offset.
		if rand.Intn(2) == 0 {
			offset = offset.Neg()
		}

		amount := base.Add(offset)
		// Ensure three decimal places in the string representation.
		amountStr := amount.StringFixed(3)

		if _, exists := existingAmounts[amountStr]; !exists {
			return amountStr, nil
		}
	}

	return "", errors.New(i18n.Translate(i18n.DefaultLang, i18n.MsgUsdtAmountGenerateFail))
}

// UsdtOrderStatusResponse is returned when the frontend polls order status.
type UsdtOrderStatusResponse struct {
	TradeNo        string `json:"trade_no"`
	Status         string `json:"status"`
	UsdtAmount     string `json:"usdt_amount"`
	BlockchainType string `json:"blockchain_type"`
	WalletAddress  string `json:"wallet_address"`
	ExpireTime     int64  `json:"expire_time"`
}

// GetUsdtOrderStatus returns the current status of a USDT order for frontend polling.
func GetUsdtOrderStatus(tradeNo string) *UsdtOrderStatusResponse {
	order := model.GetTopUpByTradeNo(tradeNo)
	if order == nil || order.PaymentMethod != "usdt" {
		return nil
	}

	var info constant.UsdtExtraInfo
	if err := common.UnmarshalJsonStr(order.ExtraInfo, &info); err != nil {
		return &UsdtOrderStatusResponse{
			TradeNo: order.TradeNo,
			Status:  order.Status,
		}
	}

	return &UsdtOrderStatusResponse{
		TradeNo:        order.TradeNo,
		Status:         order.Status,
		UsdtAmount:     info.UsdtAmount,
		BlockchainType: info.BlockchainType,
		WalletAddress:  info.WalletAddress,
		ExpireTime:     info.ExpireTime,
	}
}

// CreateUsdtOrder creates a new USDT top-up order for the given user.
func CreateUsdtOrder(userId int, amount int64, blockchainType string) (*UsdtOrderResponse, error) {
	// 1. Check USDT enabled.
	if !setting.UsdtEnabled {
		return nil, errors.New("USDT 支付未启用")
	}

	// 2. Check minimum top-up amount.
	if amount < int64(setting.UsdtMinTopUp) {
		return nil, fmt.Errorf("充值数量不能小于 %d", setting.UsdtMinTopUp)
	}

	// 3. Check user pending order limit (max 10).
	pendingCount, err := model.CountUserPendingUsdtOrders(userId)
	if err != nil {
		return nil, errors.New("查询订单失败")
	}
	if pendingCount >= 10 {
		return nil, errors.New("您有过多未完成的充值订单，请等待现有订单完成或过期后再试")
	}

	// 4. Get available wallet for the requested blockchain type.
	wallet, err := GetAvailableWallet(blockchainType)
	if err != nil {
		return nil, err
	}

	// 5. Generate unique USDT amount (base = amount as float64, 1:1 mapping).
	usdtAmount, err := GenerateUniqueAmount(float64(amount), wallet.Address)
	if err != nil {
		return nil, err
	}

	// 6. Create TopUp record.
	now := common.GetTimestamp()
	expireTime := now + 1800 // 30 minutes

	tradeNo := fmt.Sprintf("USDT_%d_%d_%s", userId, time.Now().UnixMilli(), common.GetUUID()[:8])

	extraInfo := constant.UsdtExtraInfo{
		BlockchainType: blockchainType,
		WalletAddress:  wallet.Address,
		UsdtAmount:     usdtAmount,
		ExpireTime:     expireTime,
	}
	extraInfoBytes, err := common.Marshal(extraInfo)
	if err != nil {
		return nil, errors.New("创建订单失败")
	}

	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        amount,
		Money:         float64(amount),
		TradeNo:       tradeNo,
		PaymentMethod: "usdt",
		CreateTime:    now,
		Status:        common.TopUpStatusPending,
		ExtraInfo:     string(extraInfoBytes),
	}
	if err := topUp.Insert(); err != nil {
		return nil, errors.New("创建订单失败")
	}

	return &UsdtOrderResponse{
		TradeNo:        tradeNo,
		WalletAddress:  wallet.Address,
		BlockchainType: blockchainType,
		UsdtAmount:     usdtAmount,
		ExpireTime:     expireTime,
		CreateTime:     now,
	}, nil
}
