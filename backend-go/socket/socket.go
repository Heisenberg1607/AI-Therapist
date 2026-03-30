package socket

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"ai-therapist/backend-go/config"
	"ai-therapist/backend-go/models"
	"ai-therapist/backend-go/services"
	"ai-therapist/backend-go/utils"

	"github.com/google/uuid"
	sio "github.com/zishang520/socket.io/v2/socket"
	"github.com/zishang520/engine.io/v2/types"
)

type socketData struct {
	mu          sync.Mutex
	userID      string
	interrupted bool
	msgCount    int
	windowStart time.Time
}

var socketStore sync.Map // socketID -> *socketData

func AttachSocket(server *http.Server) {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	opts := sio.DefaultServerOptions()
	opts.SetCors(&types.Cors{
		// Supported types for Origin: string, []any, *regexp.Regexp, bool
		// bool(true) causes the handler to reflect the exact request Origin back,
		// which is required when Credentials: true (browsers reject Origin: *)
		Origin:      bool(true),
		Credentials: true,
	})

	io := sio.NewServer(nil, opts)

	// Auth middleware
	io.Use(func(s *sio.Socket, next func(*sio.ExtendedError)) {
		auth := s.Handshake().Auth
		if auth == nil {
			next(sio.NewExtendedError("Authentication error", nil))
			return
		}

		rawAuth, err := json.Marshal(auth)
		if err != nil {
			next(sio.NewExtendedError("Authentication error", nil))
			return
		}

		var authMap map[string]interface{}
		if err := json.Unmarshal(rawAuth, &authMap); err != nil {
			next(sio.NewExtendedError("Authentication error", nil))
			return
		}

		token, ok := authMap["token"].(string)
		if !ok || token == "" {
			next(sio.NewExtendedError("Authentication error", nil))
			return
		}

		claims, err := utils.VerifyToken(token)
		if err != nil {
			next(sio.NewExtendedError("Invalid token", nil))
			return
		}

		socketStore.Store(string(s.Id()), &socketData{
			userID:      claims.UserID,
			windowStart: time.Now(),
		})

		next(nil)
	})

	io.On("connection", func(clients ...interface{}) {
		s, ok := clients[0].(*sio.Socket)
		if !ok {
			return
		}

		sd := getSocketData(string(s.Id()))
		if sd == nil {
			return
		}

		log.Printf("Client connected: %s User: %s\n", s.Id(), sd.userID)

		s.On("sendMessage", func(args ...interface{}) {
			now := time.Now()

			sd.mu.Lock()
			if now.Sub(sd.windowStart) > 10*time.Second {
				sd.msgCount = 0
				sd.windowStart = now
			}
			sd.msgCount++
			count := sd.msgCount
			sd.interrupted = false
			sd.mu.Unlock()

			if count > 3 {
				s.Emit("audioError", map[string]interface{}{
					"message": "Too many requests. Please wait for 10 seconds before sending another message.",
				})
				return
			}

			if len(args) == 0 {
				return
			}

			rawData, err := json.Marshal(args[0])
			if err != nil {
				return
			}
			var data struct {
				SessionID    string `json:"sessionId"`
				UserResponse string `json:"userResponse"`
			}
			if err := json.Unmarshal(rawData, &data); err != nil {
				return
			}

			sessionID := data.SessionID
			userResponse := data.UserResponse
			userID := sd.userID

			log.Printf("🎯 [SOCKET] Received message: socketId=%s userId=%s sessionId=%s\n", s.Id(), userID, sessionID)

			go func() {
				// Save user message
				log.Println("💾 [DB] Saving user message...")
				userMsg := models.Message{
					ID:        uuid.New().String(),
					SessionID: sessionID,
					Sender:    models.SenderUser,
					Content:   userResponse,
				}
				if err := config.DB.Create(&userMsg).Error; err != nil {
					log.Printf("❌ [DB] Failed to save user message: %v\n", err)
					s.Emit("audioError", map[string]interface{}{"message": "Failed to save message"})
					return
				}
				log.Println("✅ [DB] User message saved")

				// Fetch all messages for context
				var messages []models.Message
				if err := config.DB.Where(`"sessionId" = ?`, sessionID).Order(`"createdAt" asc`).Find(&messages).Error; err != nil {
					log.Printf("❌ [DB] Failed to fetch messages: %v\n", err)
					s.Emit("audioError", map[string]interface{}{"message": "Failed to fetch history"})
					return
				}

				// Generate AI response
				log.Println("🤖 [AI] Generating response...")
				s.Emit("aiThinking")

				isInterrupted := func() bool {
					sd.mu.Lock()
					defer sd.mu.Unlock()
					return sd.interrupted
				}

				aiResponse, err := services.AIGenerateResponse(
					messages,
					userID,
					sessionID,
					isInterrupted,
					func() { s.Emit("crisisDetected") },
				)
				if err != nil {
					log.Printf("❌ [AI] Error: %v\n", err)
					s.Emit("audioError", map[string]interface{}{"message": err.Error()})
					return
				}

				log.Printf("✅ [AI] Response generated: %.100s...\n", aiResponse)

				if aiResponse == "" || isInterrupted() {
					return
				}

				// Save AI response
				log.Println("💾 [DB] Saving AI message...")
				aiMsg := models.Message{
					ID:        uuid.New().String(),
					SessionID: sessionID,
					Sender:    models.SenderAI,
					Content:   aiResponse,
				}
				if err := config.DB.Create(&aiMsg).Error; err != nil {
					log.Printf("❌ [DB] Failed to save AI message: %v\n", err)
				}
				log.Println("✅ [DB] AI message saved")

				// Stream audio
				log.Println("🎵 [ELEVENLABS] Starting audio stream...")
				services.StreamSpeechWithElevenLabs(
					aiResponse,
					func(chunk []byte) {
						if isInterrupted() {
							return
						}
						log.Printf("📦 [AUDIO] Sending chunk: %d bytes\n", len(chunk))
						s.Emit("audioChunk", chunk)
					},
					func() {
						if isInterrupted() {
							return
						}
						log.Println("✅ [AUDIO] Stream complete")
						s.Emit("audioComplete", map[string]interface{}{"text": aiResponse})
					},
					func(err error) {
						log.Printf("❌ [AUDIO] Stream error: %v\n", err)
						s.Emit("audioError", map[string]interface{}{"message": err.Error()})
					},
				)
			}()
		})

		s.On("interrupt", func(args ...interface{}) {
			log.Println("🛑 [SOCKET] Interrupt received")
			sd.mu.Lock()
			sd.interrupted = true
			sd.mu.Unlock()
		})

		s.On("disconnect", func(args ...interface{}) {
			log.Printf("Client disconnected: %s\n", s.Id())
			socketStore.Delete(string(s.Id()))
		})
	})

	// Multiplex: socket.io at /socket.io/, gin for everything else
	origHandler := server.Handler
	mux := http.NewServeMux()
	mux.Handle("/socket.io/", io.ServeHandler(nil))
	mux.Handle("/", origHandler)
	server.Handler = mux
}

func getSocketData(id string) *socketData {
	val, ok := socketStore.Load(id)
	if !ok {
		return nil
	}
	return val.(*socketData)
}
