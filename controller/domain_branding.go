package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllDomainBrandings(c *gin.Context) {
	brandings, err := model.GetAllDomainBrandings()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    brandings,
	})
}

func CreateDomainBranding(c *gin.Context) {
	var branding model.DomainBranding
	if err := c.ShouldBindJSON(&branding); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}
	if branding.Domain == "" {
		common.ApiErrorMsg(c, "域名不能为空")
		return
	}
	if model.IsDomainTaken(branding.Domain, 0) {
		common.ApiErrorMsg(c, "该域名已存在")
		return
	}
	if err := model.CreateDomainBranding(&branding); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshDomainBrandingCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    branding,
	})
}

func UpdateDomainBranding(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}
	var req model.DomainBranding
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}
	if req.Domain == "" {
		common.ApiErrorMsg(c, "域名不能为空")
		return
	}
	existing, err := model.GetDomainBrandingById(id)
	if err != nil {
		common.ApiErrorMsg(c, "未找到该域名品牌配置")
		return
	}
	if model.IsDomainTaken(req.Domain, id) {
		common.ApiErrorMsg(c, "该域名已存在")
		return
	}
	existing.Domain = req.Domain
	existing.SystemName = req.SystemName
	existing.Logo = req.Logo
	existing.HomePageContent = req.HomePageContent
	existing.About = req.About
	existing.Footer = req.Footer
	if err := model.UpdateDomainBranding(existing); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshDomainBrandingCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
		"data":    existing,
	})
}

func DeleteDomainBranding(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}
	if err := model.DeleteDomainBranding(id); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshDomainBrandingCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}
