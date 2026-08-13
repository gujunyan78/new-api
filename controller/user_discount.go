package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type UserDiscountRequest struct {
	UserId   int     `json:"user_id"`
	Group    string  `json:"group"`
	ModelId  string  `json:"model_id"`
	Discount float64 `json:"discount"`
	Enabled  bool    `json:"enabled"`
}

func ListUserDiscounts(c *gin.Context) {
	discounts, err := model.GetAllUserDiscounts()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if discounts == nil {
		discounts = []*model.UserDiscount{}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    discounts,
	})
}

func CreateUserDiscount(c *gin.Context) {
	var req UserDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数无效",
		})
		return
	}
	if req.Discount < 0 || req.Discount > 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "折扣值必须在 0 到 1 之间",
		})
		return
	}
	discount := &model.UserDiscount{
		UserId:   req.UserId,
		Group:    req.Group,
		ModelId:  req.ModelId,
		Discount: req.Discount,
		Enabled:  true,
	}
	if err := discount.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    discount,
	})
}

func UpdateUserDiscount(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的 ID",
		})
		return
	}
	discount, err := model.GetUserDiscountById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "折扣规则不存在",
		})
		return
	}
	var req UserDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数无效",
		})
		return
	}
	if req.Discount < 0 || req.Discount > 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "折扣值必须在 0 到 1 之间",
		})
		return
	}
	discount.UserId = req.UserId
	discount.Group = req.Group
	discount.ModelId = req.ModelId
	discount.Discount = req.Discount
	discount.Enabled = req.Enabled
	if err := discount.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    discount,
	})
}

func DeleteUserDiscount(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的 ID",
		})
		return
	}
	if err := model.DeleteUserDiscountById(id); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}
