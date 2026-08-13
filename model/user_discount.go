package model

import (
	"sort"
	"strings"

	"gorm.io/gorm"
)

type UserDiscount struct {
	Id        int     `json:"id"`
	UserId    int     `json:"user_id" gorm:"index;default:0"`
	Group     string  `json:"group" gorm:"type:varchar(64);index;default:''"`
	ModelId   string  `json:"model_id" gorm:"type:varchar(255);index;default:''"`
	Discount  float64 `json:"discount"`
	Enabled   bool    `json:"enabled" gorm:"default:true"`
	CreatedAt int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

func GetAllUserDiscounts() ([]*UserDiscount, error) {
	var discounts []*UserDiscount
	err := DB.Order("id ASC").Find(&discounts).Error
	return discounts, err
}

func GetUserDiscountById(id int) (*UserDiscount, error) {
	var discount UserDiscount
	err := DB.Where("id = ?", id).First(&discount).Error
	if err != nil {
		return nil, err
	}
	return &discount, nil
}

func (d *UserDiscount) Insert() error {
	return DB.Create(d).Error
}

func (d *UserDiscount) Update() error {
	return DB.Model(d).Select("*").Updates(d).Error
}

func DeleteUserDiscountById(id int) error {
	return DB.Delete(&UserDiscount{}, id).Error
}

// GetUserDiscountMultiplier returns the discount multiplier for a given user, group, and model.
// It finds the most specific matching rule. Returns 1.0 if no matching rule is found.
// Priority: (userId+group+modelId) > (userId+group) > (userId+modelId) > (group+modelId) > (userId) > (group) > (modelId)
func GetUserDiscountMultiplier(userId int, group string, modelId string) float64 {
	discounts, err := GetAllUserDiscounts()
	if err != nil || len(discounts) == 0 {
		return 1.0
	}

	type match struct {
		discount *UserDiscount
		score    int // higher score = more specific match
	}

	var matches []match
	for _, d := range discounts {
		if !d.Enabled {
			continue
		}
		sc := matchScore(d, userId, group, modelId)
		if sc > 0 {
			matches = append(matches, match{discount: d, score: sc})
		}
	}

	if len(matches) == 0 {
		return 1.0
	}

	// sort by score descending (most specific first)
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].score > matches[j].score
	})

	return matches[0].discount.Discount
}

// matchScore returns a positive score if the discount matches, 0 if not.
// Specificity scoring: userId=4, group=2, modelId=1
func matchScore(d *UserDiscount, userId int, group string, modelId string) int {
	userIdMatch := d.UserId == 0 || d.UserId == userId
	groupMatch := d.Group == "" || strings.EqualFold(d.Group, group)
	modelMatch := d.ModelId == "" || matchModelId(d.ModelId, modelId)

	if !userIdMatch || !groupMatch || !modelMatch {
		return 0
	}

	score := 0
	if d.UserId != 0 {
		score += 4
	}
	if d.Group != "" {
		score += 2
	}
	if d.ModelId != "" {
		score += 1
	}
	return score
}

// matchModelId checks if the rule's modelId matches the given modelId.
// Supports wildcard matching: "gpt-*" matches "gpt-4", "gpt-3.5-turbo", etc.
func matchModelId(ruleModelId, actualModelId string) bool {
	if strings.HasSuffix(ruleModelId, "*") {
		prefix := strings.TrimSuffix(ruleModelId, "*")
		return strings.HasPrefix(strings.ToLower(actualModelId), strings.ToLower(prefix))
	}
	return strings.EqualFold(ruleModelId, actualModelId)
}

func (d *UserDiscount) BeforeCreate(tx *gorm.DB) error {
	if d.Discount < 0 {
		d.Discount = 0
	}
	if d.Discount > 1 {
		d.Discount = 1
	}
	return nil
}

func (d *UserDiscount) BeforeUpdate(tx *gorm.DB) error {
	if d.Discount < 0 {
		d.Discount = 0
	}
	if d.Discount > 1 {
		d.Discount = 1
	}
	return nil
}
