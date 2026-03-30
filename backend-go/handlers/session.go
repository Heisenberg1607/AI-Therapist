package handlers

import (
	"net/http"

	"ai-therapist/backend-go/config"
	"ai-therapist/backend-go/middleware"
	"ai-therapist/backend-go/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func StartSession(c *gin.Context) {
	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	uid := userID.(string)
	session := models.Session{
		ID:     uuid.New().String(),
		UserID: &uid,
	}

	if err := config.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to start session"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"sessionId": session.ID})
}

type ResumeSessionRequest struct {
	SessionID string `json:"sessionId" binding:"required"`
}

func ResumeSession(c *gin.Context) {
	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	var req ResumeSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Session ID is req"})
		return
	}

	var session models.Session
	if err := config.DB.Where("id = ?", req.SessionID).First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Session not found"})
		return
	}

	if session.UserID == nil || *session.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "Unauthorized to resume the session."})
		return
	}

	var messages []models.Message
	if err := config.DB.Where(`"sessionId" = ?`, req.SessionID).Order(`"createdAt" asc`).Find(&messages).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Messages not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessionId": session.ID,
		"messages":  messages,
	})
}
