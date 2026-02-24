"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff } from "lucide-react";
import React, { useRef } from "react";
import { useCallContext } from "@/app/context/callContext";
import { sendMessage } from "@/app/lib/api";
import { useWebSocket } from "@/app/hooks/useWebSocket";

interface UserCallWindowProps {
  sessionStarted: boolean;
  sessionId: string | null;
}

const UserCallWindow = ({ sessionStarted, sessionId }: UserCallWindowProps) => {
  const { setText, setIsProcessing } = useCallContext();
  const { socket, isConnected } = useWebSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  
  // MediaSource API refs for progressive streaming
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<Uint8Array[]>([]); // Queue for chunks when buffer is updating

  console.log("sessionStarted in UserCallWindow:", sessionStarted);
  console.log("WebSocket connected:", isConnected);

  const handleOnRecord = () => {
    console.log("Recording started");

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const speechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!speechRecognition) {
      console.error("SpeechRecognition API is not supported in this browser.");
      return;
    } else {
      console.log("SpeechRecognition API is supported.");
    }

    const recognition = new speechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async function (event) {
      const result = event.results[event.resultIndex];

      if (!result.isFinal) return;

      const transcript = result[0].transcript.trim();
      console.log("Transcript:", transcript);

      if (transcript) {
        setText(transcript);
        console.log("Sending transcript to API:", transcript);
        await sendTranscriptToAPI(transcript);
        console.log("Transcript sent successfully");
      } else {
        console.log("Transcript was empty or whitespace only.");
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.start();
  };

  const initializeMediaSource = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log("🎬 [MEDIA] Initializing MediaSource");
        
        // Check browser support
        if (!('MediaSource' in window)) {
          throw new Error("MediaSource API not supported");
        }

        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;

        // Create audio element with MediaSource
        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        audioRef.current = audio;

        mediaSource.addEventListener('sourceopen', () => {
          console.log("✅ [MEDIA] MediaSource opened");
          
          try {
            // For MP3 streaming, use 'audio/mpeg'
            // IMPORTANT: Not all browsers support MP3 in MediaSource
            // Chrome/Edge: YES, Firefox/Safari: LIMITED
            const mimeType = 'audio/mpeg';
            
            if (!MediaSource.isTypeSupported(mimeType)) {
              console.error(`❌ [MEDIA] MIME type ${mimeType} not supported`);
              reject(new Error("MP3 streaming not supported in this browser"));
              return;
            }

            const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            sourceBufferRef.current = sourceBuffer;

            // Handle when buffer finishes updating
            sourceBuffer.addEventListener('updateend', () => {
              console.log("📝 [MEDIA] Buffer update complete");
              
              // Process queued chunks
              if (queueRef.current.length > 0 && !sourceBuffer.updating) {
                const nextChunk = queueRef.current.shift();
                if (nextChunk) {
                  sourceBuffer.appendBuffer(nextChunk.buffer as ArrayBuffer);
                }
              }
            });

            sourceBuffer.addEventListener('error', (e) => {
              console.error("❌ [MEDIA] SourceBuffer error:", e);
            });

            resolve();
          } catch (error) {
            console.error("❌ [MEDIA] Error creating SourceBuffer:", error);
            reject(error);
          }
        });

        mediaSource.addEventListener('error', (e) => {
          console.error("❌ [MEDIA] MediaSource error:", e);
          reject(e);
        });

      } catch (error) {
        console.error("❌ [MEDIA] Initialization error:", error);
        reject(error);
      }
    });
  };

  const sendTranscriptToAPI = async (transcript: string) => {
    setIsProcessing(true);

    if (!transcript.trim() || !sessionId) {
      setIsProcessing(false);
      return;
    }

    // USE WEBSOCKET if connected, fallback to HTTP
    if (socket && isConnected) {
      console.log("Sending via WebSocket");
      sendViaWebSocket(transcript);
    } else {
      console.log("Sending via HTTP (WebSocket not available)");
      sendViaHTTP(transcript);
    }
  };

  const sendViaWebSocket = async (transcript: string) => {
    if (!socket) {
      console.error("❌ [WS] Socket not available");
      return;
    }

    console.log("🎯 [WS] Sending message via WebSocket");

    // Reset state
    audioChunksRef.current = [];
    isPlayingRef.current = false;
    queueRef.current = [];

    // Stop and cleanup previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    if (mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }
      } catch (e) {
        console.warn("MediaSource cleanup warning:", e);
      }
      mediaSourceRef.current = null;
    }
    sourceBufferRef.current = null;

    // Initialize new MediaSource
    try {
      await initializeMediaSource();
      console.log("✅ [MEDIA] Ready for streaming");
    } catch (error) {
      console.error("❌ [MEDIA] Failed to initialize, falling back to HTTP");
      sendViaHTTP(transcript);
      return;
    }

    // Send message via WebSocket
    socket.emit("sendMessage", {
      sessionId,
      userResponse: transcript,
    });
    console.log("✅ [WS] Message emitted");

    // Handle audio chunks with MediaSource API
    const handleAudioChunk = async (chunk: Uint8Array | ArrayBuffer | number[] | unknown) => {
      try {
        // Convert Socket.IO data to Uint8Array
        let uint8Chunk: Uint8Array;

        if (chunk instanceof Uint8Array) {
          uint8Chunk = chunk;
        } else if (chunk instanceof ArrayBuffer) {
          uint8Chunk = new Uint8Array(chunk);
        } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(chunk)) {
          uint8Chunk = new Uint8Array(chunk);
        } else if (Array.isArray(chunk)) {
          uint8Chunk = new Uint8Array(chunk);
        } else {
          console.error("❌ [AUDIO] Unknown chunk type:", typeof chunk);
          return;
        }

        const chunkNumber = audioChunksRef.current.length + 1;
        console.log(`📦 [AUDIO] Chunk ${chunkNumber}: ${uint8Chunk.length} bytes`);

        // Store for fallback
        audioChunksRef.current.push(uint8Chunk);

        // Append to MediaSource
        const sourceBuffer = sourceBufferRef.current;
        
        if (!sourceBuffer) {
          console.warn("⚠️ [MEDIA] SourceBuffer not ready, chunk queued");
          return;
        }

        // If buffer is updating, queue the chunk
        if (sourceBuffer.updating) {
          console.log("⏳ [MEDIA] Buffer busy, queueing chunk");
          queueRef.current.push(uint8Chunk);
        } else {
          console.log("➕ [MEDIA] Appending chunk to buffer");
          sourceBuffer.appendBuffer(uint8Chunk.buffer as ArrayBuffer);
        }

        // Start playback after first few chunks buffered
        if (!isPlayingRef.current && audioChunksRef.current.length >= 2) {
          console.log("▶️ [MEDIA] Starting playback");
          audioRef.current?.play()
            .then(() => {
              console.log("✅ [AUDIO] Playback started");
              isPlayingRef.current = true;
            })
            .catch(err => console.error("❌ [AUDIO] Play error:", err));
        }

      } catch (error) {
        console.error("❌ [AUDIO] Chunk processing error:", error);
      }
    };

    // Handle completion
    const handleAudioComplete = (data: { text: string }) => {
      console.log("✅ [AUDIO] Stream complete:", {
        totalChunks: audioChunksRef.current.length,
        text: data.text.substring(0, 50) + "...",
      });

      // End the MediaSource stream
      const mediaSource = mediaSourceRef.current;
      const sourceBuffer = sourceBufferRef.current;

      if (mediaSource && sourceBuffer && mediaSource.readyState === 'open') {
        // Wait for buffer to finish updating before ending
        const endStream = () => {
          if (!sourceBuffer.updating && queueRef.current.length === 0) {
            try {
              console.log("🏁 [MEDIA] Ending stream");
              mediaSource.endOfStream();
            } catch (error) {
              console.error("❌ [MEDIA] Error ending stream:", error);
            }
          } else {
            // Wait and try again
            setTimeout(endStream, 100);
          }
        };
        endStream();
      }

      setIsProcessing(false);
      setText(data.text);

      // Cleanup listeners
      socket.off("audioChunk", handleAudioChunk);
      socket.off("audioComplete", handleAudioComplete);
      socket.off("audioError", handleAudioError);
    };

    // Handle errors
    const handleAudioError = (error: { message: string }) => {
      console.error("❌ [AUDIO] Streaming error:", error.message);
      setIsProcessing(false);
      alert("Error: " + error.message);

      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Cleanup listeners
      socket.off("audioChunk", handleAudioChunk);
      socket.off("audioComplete", handleAudioComplete);
      socket.off("audioError", handleAudioError);
    };

    // Attach event listeners
    console.log("👂 [WS] Attaching audio event listeners");
    socket.on("audioChunk", handleAudioChunk);
    socket.on("audioComplete", handleAudioComplete);
    socket.on("audioError", handleAudioError);
  };

  const sendViaHTTP = async (transcript: string) => {
    // Fallback to existing HTTP implementation
    try {
      const data = await sendMessage(sessionId!, transcript);

      setText(data.audio);
      setIsProcessing(false);

      // Stop any previous audio before playing new one
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      audioRef.current = new Audio(data.audio);
      audioRef.current.play();
    } catch (error) {
      console.error("Failed to send transcript:", error);
      setIsProcessing(false);

      if (error instanceof Error && error.message.includes("Session expired")) {
        alert("Your session has expired. Please login again.");
      }
    }
  };

  return (
    <Card className="w-full max-w-md h-96 bg-green-600 border-none shadow-2xl overflow-hidden relative group mx-auto">
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
          <div className="w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-green-700 bg-opacity-50 flex items-center justify-center shadow-lg">
          <span className="text-2xl font-bold text-white">AK</span>
        </div>
      </div>

      {/* WebSocket Status Indicator (optional) */}
      {isConnected && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-white text-sm font-medium">
            Atharva Kurumbhatte
          </span>
        </div>

        {sessionStarted ? (
          <Button
            size="sm"
            className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm border-none rounded-full w-10 h-10 p-0"
            onClick={handleOnRecord}
          >
            <Mic className="w-4 h-4 text-white" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm border-none rounded-full w-10 h-10 p-0"
          >
            <MicOff className="w-4 h-4 text-white" />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default UserCallWindow;
