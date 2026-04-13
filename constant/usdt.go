package constant

// UsdtExtraInfo stores USDT order extension data in TopUp.ExtraInfo as JSON.
type UsdtExtraInfo struct {
	BlockchainType string `json:"blockchain_type"`
	WalletAddress  string `json:"wallet_address"`
	UsdtAmount     string `json:"usdt_amount"`
	ExpireTime     int64  `json:"expire_time"`
}

// UsdtWallet represents a configured USDT receiving wallet address.
type UsdtWallet struct {
	Address        string `json:"address"`
	BlockchainType string `json:"blockchain_type"`
	Priority       int    `json:"priority"`
	Enabled        bool   `json:"enabled"`
}

// BlockchainTransaction represents a single on-chain USDT transfer record.
type BlockchainTransaction struct {
	TxHash    string  `json:"tx_hash"`
	From      string  `json:"from"`
	To        string  `json:"to"`
	Amount    float64 `json:"amount"`
	Timestamp int64   `json:"timestamp"`
}
