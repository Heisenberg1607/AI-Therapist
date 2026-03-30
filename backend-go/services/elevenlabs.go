package services

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

const defaultVoiceID = "ADd2WEtjmwokqUr0Y5Ad"

func StreamSpeechWithElevenLabs(
	text string,
	onChunk func([]byte),
	onComplete func(),
	onError func(error),
) {
	if text == "" {
		onError(fmt.Errorf("text input to ElevenLabs cannot be empty"))
		return
	}
	if len(text) > 5000 {
		onError(fmt.Errorf("text input exceeds ElevenLabs character limit"))
		return
	}

	apiKey := os.Getenv("ELEVEN_LABS_API_KEY")
	if apiKey == "" {
		onError(fmt.Errorf("ELEVEN_LABS_API_KEY not set"))
		return
	}

	voiceID := os.Getenv("ELEVENLABS_VOICE_ID")
	if voiceID == "" {
		voiceID = defaultVoiceID
	}

	url := fmt.Sprintf("https://api.elevenlabs.io/v1/text-to-speech/%s/stream", voiceID)

	body := fmt.Sprintf(`{"text":%q,"model_id":"eleven_flash_v2_5","output_format":"mp3_44100_128"}`, text)

	req, err := http.NewRequest("POST", url, strings.NewReader(body))
	if err != nil {
		onError(fmt.Errorf("failed to create ElevenLabs request: %w", err))
		return
	}

	req.Header.Set("xi-api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg")

	log.Printf("🎙️ [ELEVENLABS] Requesting stream for text: %.50s...\n", text)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		onError(fmt.Errorf("ElevenLabs request failed: %w", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		onError(fmt.Errorf("ElevenLabs returned status %d", resp.StatusCode))
		return
	}

	log.Println("✅ [ELEVENLABS] Stream started, reading chunks...")

	buf := make([]byte, 4096)
	chunkCount := 0

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			chunkCount++
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			log.Printf("📦 [ELEVENLABS] Chunk %d: %d bytes\n", chunkCount, n)
			onChunk(chunk)
		}
		if err != nil {
			if err == io.EOF {
				log.Printf("✅ [ELEVENLABS] Stream complete. Total chunks: %d\n", chunkCount)
				onComplete()
				return
			}
			onError(fmt.Errorf("ElevenLabs stream read error: %w", err))
			return
		}
	}
}
