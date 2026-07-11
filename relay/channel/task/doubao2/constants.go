package doubao2

var ModelList = []string{
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-2-0-filter-off",
	"doubao-seedance-2-0-fast-filter-off",
	"doubao-seedance-2-0-fast",
	"doubao-seedance-2-0",
}

var ChannelName = "doubao-video-2"

// videoInputRatioMap 视频输入折扣比率（含视频单价 / 不含视频单价）。
// 管理员应将 ModelRatio 设置为"不含视频"的较高费率，
// 系统在检测到视频输入时自动乘以此折扣。
var videoInputRatioMap = map[string]float64{
	"doubao-seedance-2-0-260128":          28.0 / 46.0, // ~0.6087
	"doubao-seedance-2-0-fast-260128":     22.0 / 37.0, // ~0.5946
	"doubao-seedance-2-0-filter-off":      28.0 / 46.0,
	"doubao-seedance-2-0-fast-filter-off": 22.0 / 37.0,
	"doubao-seedance-2-0-fast":            22.0 / 37.0,
	"doubao-seedance-2-0":                 28.0 / 46.0,
}

func GetVideoInputRatio(modelName string) (float64, bool) {
	r, ok := videoInputRatioMap[modelName]
	return r, ok
}
