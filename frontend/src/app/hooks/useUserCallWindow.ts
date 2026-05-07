"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCallContext } from "@/app/context/callContext";
import { sendMessage } from "@/app/lib/api";
import { useWebSocket } from "@/app/hooks/useWebSocket";
import type { CustomSpeechRecognitionEvent } from "@/app/types/speechRecognition";

type UseUserCallWindowParams = {
  sessionId: string | null;
};

type AudioChunkPayload = Uint8Array | ArrayBuffer | number[] | unknown;

export const useUserCallWindow = ({ sessionId }: UseUserCallWindowParams) => {
  const { setText, setIsProcessing, setIsAudioPlaying } = useCallContext();
  const { socket, isConnected, isCrisis, dismissCrisis } = useWebSocket();

  const [isRecording, setIsRecording] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const recognitionRef = useRef<InstanceType<
    typeof window.SpeechRecognition | typeof window.webkitSpeechRecognition
  > | null>(null);
  const accumulatedTranscriptRef = useRef<string>("");

  // MediaSource API refs for progressive streaming
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<Uint8Array[]>([]);

  const toExactArrayBuffer = useCallback((chunk: Uint8Array): ArrayBuffer => {
    const exactBuffer = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(exactBuffer).set(chunk);
    return exactBuffer;
  }, []);

  const cleanupPlaybackAndStream = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === "open") {
          mediaSourceRef.current.endOfStream();
        }
      } catch (e) {
        console.warn("MediaSource cleanup warning:", e);
      }
      mediaSourceRef.current = null;
    }

    sourceBufferRef.current = null;
    queueRef.current = [];
    audioChunksRef.current = [];
    isPlayingRef.current = false;
    setIsAudioPlaying(false);
  }, [setIsAudioPlaying]);

  const initializeMediaSource = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!("MediaSource" in window)) {
          throw new Error("MediaSource API not supported");
        }

        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;

        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        audio.onended = () => setIsAudioPlaying(false);
        audioRef.current = audio;

        mediaSource.addEventListener("sourceopen", () => {
          try {
            const mimeType = "audio/mpeg";

            if (!MediaSource.isTypeSupported(mimeType)) {
              reject(new Error("MP3 streaming not supported in this browser"));
              return;
            }

            const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            sourceBufferRef.current = sourceBuffer;

            sourceBuffer.addEventListener("updateend", () => {
              if (queueRef.current.length > 0 && !sourceBuffer.updating) {
                const nextChunk = queueRef.current.shift();
                if (nextChunk) {
                  sourceBuffer.appendBuffer(toExactArrayBuffer(nextChunk));
                }
              }
            });

            sourceBuffer.addEventListener("error", (e) => {
              console.error("SourceBuffer error:", e);
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        });

        mediaSource.addEventListener("error", (e) => {
          reject(e);
        });
      } catch (error) {
        reject(error);
      }
    });
  }, [toExactArrayBuffer]);

  const sendViaHTTP = useCallback(
    async (transcript: string) => {
      try {
        const data = await sendMessage(sessionId!, transcript);
        setText(data.audio);
        setIsProcessing(false);

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        audioRef.current = new Audio(data.audio);
        audioRef.current.onended = () => setIsAudioPlaying(false);
        setIsAudioPlaying(true);
        await audioRef.current.play();
      } catch (error) {
        console.error("Failed to send transcript:", error);
        setIsProcessing(false);
        setIsAudioPlaying(false);

        if (
          error instanceof Error &&
          error.message.includes("Session expired")
        ) {
          alert("Your session has expired. Please login again.");
        }
      }
    },
    [sessionId, setIsProcessing, setIsAudioPlaying, setText],
  );

  const sendViaWebSocket = useCallback(
    async (transcript: string) => {
      if (!socket) {
        console.error("Socket not available");
        return;
      }

      try {
        await initializeMediaSource();
      } catch (error) {
        console.error("MediaSource init failed, falling back to HTTP:", error);
        void sendViaHTTP(transcript);
        return;
      }

      socket.emit("sendMessage", {
        sessionId,
        userResponse: transcript,
      });

      const handleAudioChunk = async (chunk: AudioChunkPayload) => {
        try {
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
            console.error("Unknown chunk type:", typeof chunk);
            return;
          }

          audioChunksRef.current.push(uint8Chunk);

          const sourceBuffer = sourceBufferRef.current;
          if (!sourceBuffer) {
            queueRef.current.push(uint8Chunk);
            return;
          }

          if (sourceBuffer.updating) {
            queueRef.current.push(uint8Chunk);
          } else {
            sourceBuffer.appendBuffer(toExactArrayBuffer(uint8Chunk));
          }

          if (!isPlayingRef.current && audioChunksRef.current.length >= 2) {
            audioRef.current
              ?.play()
              .then(() => {
                isPlayingRef.current = true;
                setIsAudioPlaying(true);
              })
              .catch((err) => console.error("Play error:", err));
          }
        } catch (error) {
          console.error("Chunk processing error:", error);
        }
      };

      const handleAudioError = (error: { message: string }) => {
        console.error("Streaming error:", error.message);
        setIsProcessing(false);
        setIsAudioPlaying(false);
        alert("Error: " + error.message);

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        socket.off("audioChunk", handleAudioChunk);
        socket.off("audioComplete", handleAudioComplete);
        socket.off("audioError", handleAudioError);
      };

      const handleAudioComplete = (data: { text: string }) => {
        const mediaSource = mediaSourceRef.current;
        const sourceBuffer = sourceBufferRef.current;

        if (mediaSource && sourceBuffer && mediaSource.readyState === "open") {
          const endStream = () => {
            if (!sourceBuffer.updating && queueRef.current.length === 0) {
              try {
                mediaSource.endOfStream();
              } catch (error) {
                console.error("Error ending stream:", error);
              }
            } else {
              setTimeout(endStream, 100);
            }
          };
          endStream();
        }

        setIsProcessing(false);
        setText(data.text);

        socket.off("audioChunk", handleAudioChunk);
        socket.off("audioComplete", handleAudioComplete);
        socket.off("audioError", handleAudioError);
      };

      socket.on("audioChunk", handleAudioChunk);
      socket.on("audioComplete", handleAudioComplete);
      socket.on("audioError", handleAudioError);
    },
    [
      initializeMediaSource,
      sendViaHTTP,
      sessionId,
      setIsProcessing,
      setIsAudioPlaying,
      setText,
      socket,
      toExactArrayBuffer,
    ],
  );

  const sendTranscriptToAPI = useCallback(
    async (transcript: string) => {
      setIsProcessing(true);

      if (!transcript.trim() || !sessionId) {
        setIsProcessing(false);
        return;
      }

      if (socket && isConnected) {
        void sendViaWebSocket(transcript);
      } else {
        void sendViaHTTP(transcript);
      }
    },
    [
      isConnected,
      sendViaHTTP,
      sendViaWebSocket,
      sessionId,
      setIsProcessing,
      socket,
    ],
  );

  const handleOnRecord = useCallback(() => {
    // --- STOP recording: user clicked mic-off ---
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    // --- START recording ---

    // Interrupt any ongoing AI audio
    if (socket && isConnected) {
      socket.emit("interrupt");
    }
    if (socket) {
      socket.off("audioChunk");
      socket.off("audioComplete");
      socket.off("audioError");
    }
    cleanupPlaybackAndStream();

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      console.error("SpeechRecognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    accumulatedTranscriptRef.current = "";

    recognition.onresult = (event: CustomSpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          accumulatedTranscriptRef.current += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Show live transcript as user speaks
      setText(accumulatedTranscriptRef.current + interim);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      const finalTranscript = accumulatedTranscriptRef.current.trim();
      accumulatedTranscriptRef.current = "";
      if (finalTranscript) {
        void sendTranscriptToAPI(finalTranscript);
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      recognitionRef.current = null;
      accumulatedTranscriptRef.current = "";
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [
    isRecording,
    cleanupPlaybackAndStream,
    isConnected,
    sendTranscriptToAPI,
    setText,
    socket,
  ]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (socket) {
        socket.off("audioChunk");
        socket.off("audioComplete");
        socket.off("audioError");
      }
      cleanupPlaybackAndStream();
    };
  }, [cleanupPlaybackAndStream, socket]);

  return {
    handleOnRecord,
    isRecording,
    isConnected,
    isCrisis,
    dismissCrisis,
  };
};
