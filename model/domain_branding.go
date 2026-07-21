package model

import (
	"time"
)

type DomainBranding struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	Domain          string `json:"domain" gorm:"type:varchar(256);uniqueIndex;not null"`
	SystemName      string `json:"system_name" gorm:"type:varchar(256);default:''"`
	Logo            string `json:"logo" gorm:"type:varchar(512);default:''"`
	DocsLink        string `json:"docs_link" gorm:"type:varchar(512);default:''"`
	HomePageContent string `json:"home_page_content" gorm:"type:text"`
	About           string `json:"about" gorm:"type:text"`
	Footer          string `json:"footer" gorm:"type:text"`
	// HeaderAnalytics / BodyAnalytics 页面统计代码,分别注入到该域名首页的 <head> 与 </body> 之前。
	// 留空则不注入。仅在域名品牌管理(管理员)中可配置,因此属于受信任的管理员输入。
	HeaderAnalytics string `json:"header_analytics" gorm:"type:text"`
	BodyAnalytics   string `json:"body_analytics" gorm:"type:text"`
	// DefaultUserGroup 该域名注册新用户时缺省写入的 User.Group;为空则使用 model 默认值。
	DefaultUserGroup string `json:"default_user_group" gorm:"type:varchar(64);default:''"`
	// UsableGroups 逗号分隔的资源组白名单,用于模型广场与令牌可选组过滤;为空表示不过滤。
	UsableGroups string    `json:"usable_groups" gorm:"type:varchar(512);default:''"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func GetAllDomainBrandings() ([]*DomainBranding, error) {
	var brandings []*DomainBranding
	err := DB.Order("id asc").Find(&brandings).Error
	return brandings, err
}

func GetDomainBrandingByDomain(domain string) (*DomainBranding, error) {
	var branding DomainBranding
	err := DB.Where("domain = ?", domain).First(&branding).Error
	if err != nil {
		return nil, err
	}
	return &branding, nil
}

func GetDomainBrandingById(id int) (*DomainBranding, error) {
	var branding DomainBranding
	err := DB.First(&branding, id).Error
	if err != nil {
		return nil, err
	}
	return &branding, nil
}

func CreateDomainBranding(branding *DomainBranding) error {
	return DB.Create(branding).Error
}

func UpdateDomainBranding(branding *DomainBranding) error {
	return DB.Save(branding).Error
}

func DeleteDomainBranding(id int) error {
	return DB.Delete(&DomainBranding{}, id).Error
}

// IsDomainTaken checks if a domain is already used by another branding config.
// Returns true on DB errors (fail-closed) to prevent domain conflicts.
func IsDomainTaken(domain string, excludeId int) bool {
	var count int64
	query := DB.Model(&DomainBranding{}).Where("domain = ?", domain)
	if excludeId > 0 {
		query = query.Where("id != ?", excludeId)
	}
	res := query.Count(&count)
	if res.Error != nil {
		return true
	}
	return count > 0
}
