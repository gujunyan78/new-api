package setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

var (
	UsdtEnabled     bool
	UsdtMinTopUp    int    = 1
	UsdtWallets     string = "[]"
	TronGridApiKey  string
	EtherscanApiKey string
)

// GetUsdtWallets deserializes the UsdtWallets JSON string from OptionMap.
func GetUsdtWallets() []constant.UsdtWallet {
	common.OptionMapRWMutex.RLock()
	jsonStr := common.OptionMap["UsdtWallets"]
	common.OptionMapRWMutex.RUnlock()

	if jsonStr == "" || jsonStr == "[]" {
		return nil
	}
	var wallets []constant.UsdtWallet
	if err := common.UnmarshalJsonStr(jsonStr, &wallets); err != nil {
		return nil
	}
	return wallets
}

// SetUsdtWallets serializes the wallet list and updates OptionMap.
func SetUsdtWallets(wallets []constant.UsdtWallet) error {
	jsonBytes, err := common.Marshal(wallets)
	if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap["UsdtWallets"] = string(jsonBytes)
	common.OptionMapRWMutex.Unlock()
	return nil
}

// MaskApiKey masks an API key for display, keeping the first 4 and last 4 characters.
// Keys shorter than 8 characters are fully masked.
func MaskApiKey(key string) string {
	if len(key) < 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
