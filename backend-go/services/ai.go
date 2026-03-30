package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"

	"ai-therapist/backend-go/config"
	"ai-therapist/backend-go/models"

	openai "github.com/sashabaranov/go-openai"
)

const systemPrompt = `
Act as a real human therapist having a casual, natural conversation with a client.

Your tone should feel:

Warm and understanding

Simple and conversational

Like talking to a thoughtful friend, not a formal therapist

Style guidelines:

Use short to medium sentences (avoid long, perfect paragraphs)

Include natural pauses like: "hmm…", "yeah", "I get that"

Don't sound overly polished or "textbook"

Avoid over-explaining or analyzing everything

Don't always reframe or summarize — just respond naturally

Let the conversation breathe (some responses can be simple)

Occasionally reflect feelings, but keep it subtle

Ask gentle, simple follow-up questions (1 at a time)

Behavior:

Validate emotions in a natural way (not scripted like "that sounds difficult" every time)

Don't jump into solutions or advice too quickly

Don't try to sound perfect — slight imperfection makes it human

Avoid repeating patterns in every response

Let the conversation flow like a real back-and-forth



Make the conversation feel real, slightly messy, and emotionally genuine — not like AI or a scripted counselor.
When appropriate, use your available tools to log emotions, save important notes, or detect crisis situations.`

var therapistTools = []openai.Tool{
	{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        "detect_crisis_intent",
			Description: "Call this when the user expresses intent to harm themselves or others, mentions suicide, or shows signs of severe distress.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"severity": {
						"type": "string",
						"enum": ["low", "medium", "high"],
						"description": "Severity of the crisis signal"
					},
					"keywords": {
						"type": "array",
						"items": {"type": "string"},
						"description": "Specific phrases that triggered this"
					}
				},
				"required": ["severity", "keywords"]
			}`),
		},
	},
}

type DetectCrisisArgs struct {
	Severity string   `json:"severity"`
	Keywords []string `json:"keywords"`
}

func AIGenerateResponse(
	messages []models.Message,
	userID string,
	sessionID string,
	isInterrupted func() bool,
	onCrisisDetected func(),
) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", errors.New("OPENAI_API_KEY is not set")
	}

	client := openai.NewClient(apiKey)

	openAIMessages := []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
	}

	for _, msg := range messages {
		role := openai.ChatMessageRoleUser
		if msg.Sender == models.SenderAI {
			role = openai.ChatMessageRoleAssistant
		}
		openAIMessages = append(openAIMessages, openai.ChatCompletionMessage{
			Role:    role,
			Content: msg.Content,
		})
	}

	resp, err := client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
		Model:       openai.GPT4oMini,
		Messages:    openAIMessages,
		Tools:       therapistTools,
		ToolChoice:  "auto",
		Temperature: 1.0,
		MaxTokens:   400,
	})
	if err != nil {
		return "", fmt.Errorf("OpenAI API error: %w", err)
	}

	choice := resp.Choices[0]

	// Case 1: Normal text response
	if choice.FinishReason == openai.FinishReasonStop {
		text := choice.Message.Content
		if text == "" {
			log.Println("⚠️ [GPT] Empty response")
			return "", nil
		}
		return text, nil
	}

	// Case 2: Tool call
	if choice.FinishReason == openai.FinishReasonToolCalls && len(choice.Message.ToolCalls) > 0 {
		openAIMessages = append(openAIMessages, choice.Message)

		for _, toolCall := range choice.Message.ToolCalls {
			if toolCall.Type != openai.ToolTypeFunction {
				continue
			}
			funcName := toolCall.Function.Name

			var funcArgs map[string]interface{}
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &funcArgs); err != nil {
				log.Printf("❌ [AI] Failed to parse args for %s\n", funcName)
				continue
			}

			log.Printf("🔧 [AI] Executing function: %s %v\n", funcName, funcArgs)

			if isInterrupted() {
				openAIMessages = append(openAIMessages, openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					ToolCallID: toolCall.ID,
					Content:    `{"status":"CANCELLED"}`,
				})
				return "", nil
			}

			result := executeFunctionLocally(funcName, toolCall.Function.Arguments, userID, sessionID, onCrisisDetected)
			resultJSON, _ := json.Marshal(result)
			log.Printf("✅ [FUNCTION] Result: %v\n", result)

			openAIMessages = append(openAIMessages, openai.ChatCompletionMessage{
				Role:       openai.ChatMessageRoleTool,
				ToolCallID: toolCall.ID,
				Content:    string(resultJSON),
			})
		}

		// Second call after tools
		resp2, err := client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
			Model:       openai.GPT4oMini,
			Messages:    openAIMessages,
			MaxTokens:   400,
			Temperature: 1.0,
		})
		if err != nil {
			return "", fmt.Errorf("OpenAI second API error: %w", err)
		}
		return resp2.Choices[0].Message.Content, nil
	}

	return "", nil
}

func executeFunctionLocally(
	name string,
	argsJSON string,
	userID string,
	sessionID string,
	onCrisisDetected func(),
) map[string]interface{} {
	switch name {
	case "detect_crisis_intent":
		var args DetectCrisisArgs
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return map[string]interface{}{"status": "error", "error": "invalid args"}
		}

		if args.Severity == "" || len(args.Keywords) == 0 {
			return map[string]interface{}{"status": "error", "error": "severity and keywords required"}
		}

		// Flag session in DB
		if err := config.DB.Model(&models.Session{}).Where("id = ?", sessionID).Update("crisisFlag", true).Error; err != nil {
			log.Printf("❌ [FUNCTION] Failed to flag session: %v\n", err)
		}

		onCrisisDetected()

		log.Printf("🚨 CRISIS DETECTED for user %s — severity: %s, keywords: %v\n", userID, args.Severity, args.Keywords)

		return map[string]interface{}{
			"status": "success",
			"result": map[string]interface{}{
				"flagged":  true,
				"severity": args.Severity,
				"keywords": args.Keywords,
				"resources": []string{
					"988 Suicide & Crisis Lifeline (call or text 988)",
					"Crisis Text Line (text HOME to 741741)",
					"Emergency services: 911",
				},
				"message": "Session has been flagged for review.",
			},
		}

	default:
		return map[string]interface{}{"status": "error", "error": "Unknown function: " + name}
	}
}
