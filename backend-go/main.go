package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"ai-therapist/backend-go/config"
	"ai-therapist/backend-go/handlers"
	"ai-therapist/backend-go/middleware"
	appsocket "ai-therapist/backend-go/socket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect database
	config.ConnectDatabase()

	port := os.Getenv("PORT")
	if port == "" {
		port = "5001"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Setup Gin
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowed := []string{
			"http://localhost:3000",
			"http://localhost:3001",
			frontendURL,
		}
		for _, a := range allowed {
			if a == origin {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Routes
	api := router.Group("/api")
	{
		// Public
		api.POST("/login", handlers.Login)
		api.POST("/register", handlers.Register)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Protected
		api.POST("/startSession", middleware.Authenticate(), handlers.StartSession)
		api.POST("/resumeSession", middleware.Authenticate(), handlers.ResumeSession)
		api.GET("/me", middleware.Authenticate(), handlers.GetMe)
	}

	// Create HTTP server with Gin as the base handler
	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	// Attach socket.io (modifies httpServer.Handler to multiplex /socket.io/ + gin)
	appsocket.AttachSocket(httpServer)

	log.Printf("Server running at http://localhost:%s\n", port)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
