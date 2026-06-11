package setting

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
)

const SilkroadSignAlgorithm = "RSA-SHA256"

type SilkroadConfig struct {
	Enabled           bool
	Sandbox           bool
	MchId             string
	AppId             string
	SerialNo          string
	GatewayUrl        string
	SandboxUrl        string
	NotifyUrl         string
	PrivateKey        string
	PlatformPublicKey string
	PaymentMethod     string
	Category          int
	Currency          string
}

func GetSilkroadConfig() SilkroadConfig {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	enabled := common.OptionMap["pay_silkroad_enable"] == "true"
	sandbox := common.OptionMap["pay_silkroad_sandbox"] == "true"
	gatewayUrl := common.OptionMap["pay_silkroad_gateway_url"]
	sandboxUrl := common.OptionMap["pay_silkroad_sandbox_url"]
	category, _ := strconv.Atoi(common.OptionMap["pay_silkroad_category"])
	currency := common.OptionMap["pay_silkroad_currency"]

	effectiveUrl := gatewayUrl
	if sandbox && sandboxUrl != "" {
		effectiveUrl = sandboxUrl
	}

	return SilkroadConfig{
		Enabled:           enabled,
		Sandbox:           sandbox,
		MchId:             common.OptionMap["pay_silkroad_mch_id"],
		AppId:             common.OptionMap["pay_silkroad_app_id"],
		SerialNo:          common.OptionMap["pay_silkroad_serial_no"],
		GatewayUrl:        effectiveUrl,
		SandboxUrl:        sandboxUrl,
		NotifyUrl:         common.OptionMap["pay_silkroad_notify_url"],
		PrivateKey:        common.OptionMap["pay_silkroad_private_key"],
		PlatformPublicKey: common.OptionMap["pay_silkroad_platform_public_key"],
		PaymentMethod:     common.OptionMap["pay_silkroad_payment_method"],
		Category:          category,
		Currency:          currency,
	}
}
