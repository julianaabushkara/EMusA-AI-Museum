import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// ESP item indices that are cyclic
const CYCLIC_ITEMS = [1, 2];

// WAIT FILES (in frontEnd/vite-project/public/)
const WAIT_SOUNDS = [
  "/wait_1.mp3",
  "/wait_2.mp3",
  "/wait_3.mp3",
  "/wait_4.mp3",
  "/wait_5.mp3",
];

type Message = {
  sender: "me" | "museum_ai";
  blobUrl: string;
};

const playClick = () => {
  const a = new Audio(CLICK_SOUND_URL);
  a.currentTime = 0;
  a.play().catch(() => {});
};

function SimpleApp() {
  // -------------------------
  // STATE
  // -------------------------
  const [activeItem, setActiveItem] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [queue, setQueue] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // WHO OWNS SPEAKER
  const [audioSource, setAudioSource] = useState<"esp" | "chat" | null>(null);

  // WAITING FLAG (NO LOOP)
  const [isWaiting, setIsWaiting] = useState(false);
  const isWaitingRef = useRef(false);

  // which wait sound to use next question
  const waitQuestionIdxRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const prevItemRef = useRef<number | null>(null);

  useEffect(() => {
    isWaitingRef.current = isWaiting;
  }, [isWaiting]);

  // -------------------------
  // HARD INTERRUPT PLAY
  // -------------------------
  const interruptAndPlay = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setQueue([]);
    setPlaying(url);
  }, []);

  // -------------------------
  // WAIT: PLAY ONLY ONE CLIP PER QUESTION
  // -------------------------
  const startWaitOnce = useCallback(() => {
    setAudioSource("chat");

    isWaitingRef.current = true;
    setIsWaiting(true);

    // choose the wait clip for THIS question
    const clip = WAIT_SOUNDS[waitQuestionIdxRef.current % WAIT_SOUNDS.length];

    // advance index for NEXT question
    waitQuestionIdxRef.current =
      (waitQuestionIdxRef.current + 1) % WAIT_SOUNDS.length;

    // play it once
    interruptAndPlay(clip);
  }, [interruptAndPlay]);

  const stopWaiting = useCallback(() => {
    isWaitingRef.current = false;
    setIsWaiting(false);
  }, []);

  // -------------------------
  // RESET PLAYBACK (ESP ONLY)
  // -------------------------
  const resetPlayback = useCallback(() => {
    if (audioSource === "chat" || isWaitingRef.current) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setQueue([]);
    setPlaying(null);
    setAudioSource(null);
  }, [audioSource]);

  // -------------------------
  // SESSION STATE (ESP TRUTH)
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/session-state`);
        if (!res.ok) return;

        const data = await res.json();
        const idx = typeof data.item_index === "number" ? data.item_index : null;

        const prev = prevItemRef.current;
        prevItemRef.current = idx;

        if (prev !== null && idx === null) {
          resetPlayback();
          setActiveItem(null);
          return;
        }

        if (idx === null) {
          setActiveItem(null);
          return;
        }

        setActiveItem(idx);

        // ESP owns audio only if NOT waiting
        if (!isWaitingRef.current) setAudioSource("esp");
      } catch {}
    }, 500);

    return () => clearInterval(poll);
  }, [resetPlayback]);

  // -------------------------
  // QUEUE AUDIO (BLOCKED WHILE WAITING)
  // -------------------------
  const queueAudio = useCallback((url: string) => {
    if (isWaitingRef.current) return; // ✅ block ESP/museum audio while waiting

    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  // play queue only if NOT waiting and not already playing
  useEffect(() => {
    if (isWaitingRef.current) return;
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, playing]);

  // audio play effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;

    console.log("Now playing:", playing);

    audio.src = playing;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      if (err.name !== "AbortError") console.error("Audio play failed:", err);
    });
  }, [playing]);

  // onEnded: NO loop. If waiting, just stay silent until reply arrives.
  const onEnded = () => {
    console.log("Ended:", playing, "isWaiting:", isWaitingRef.current);
    setPlaying(null);
  };

  // -------------------------
  // RECORDING (CHAT)
  // -------------------------
  const startRecording = async () => {
    playClick();
    setIsRecording(true);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      playClick();

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const userUrl = URL.createObjectURL(blob);

      setMessages((prev) => [...prev, { sender: "me", blobUrl: userUrl }]);

      // ✅ play ONE wait clip per question
      startWaitOnce();

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        const ct = res.headers.get("content-type") || "";

        if (res.ok && ct.includes("audio")) {
          const replyBlob = await res.blob();
          const replyUrl = URL.createObjectURL(replyBlob);

          // ✅ stop waiting and play reply
          stopWaiting();
          interruptAndPlay(replyUrl);

          setMessages((prev) => [
            ...prev,
            { sender: "museum_ai", blobUrl: replyUrl },
          ]);
        } else {
          const txt = await res.text().catch(() => "");
          console.error("post-audio failed:", res.status, txt);
          setError(`post-audio failed: ${res.status}`);
          // keep waiting flag true? -> better to stop waiting if backend failed:
          stopWaiting();
        }
      } catch (e) {
        console.error(e);
        setError("Upload failed");
        stopWaiting();
      }

      setIsRecording(false);
    };

    rec.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // -------------------------
  // SPACE KEY LOGIC
  // -------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();

      // cyclic item uses /cycle-next
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/cycle-next`, { method: "POST" });
        return;
      }

      if (!isRecording) startRecording();
    };

    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (isRecording) stopRecording();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [activeItem, isRecording]);

  // -------------------------
  // ESP AUDIO POLLING (STOP WHILE WAITING)
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        if (isWaitingRef.current) return; // ✅ do nothing while waiting

        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          queueAudio(url);
        }
      } catch {}
    }, 1500);

    return () => clearInterval(poll);
  }, [queueAudio]);

  // -------------------------
  // UI
  // -------------------------
  return (
    <div style={{ padding: 40, maxWidth: 520, margin: "auto" }}>
      <h2>AI Museum Demo</h2>

      <p>
        Active item:{" "}
        <strong>{activeItem === null ? "None" : activeItem + 1}</strong>
      </p>

      <p>
        Mode:{" "}
        <strong>
          {isWaiting
            ? "Thinking (single wait clip)"
            : audioSource === "esp"
            ? "ESP Audio"
            : audioSource === "chat"
            ? "Voice Chat"
            : "Idle"}
        </strong>
      </p>

      <audio ref={audioRef} onEnded={onEnded} />

      {playing && <p>🔊 Playing audio…</p>}
      {isRecording && <p>🎙 Recording…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: 30 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <p style={{ color: m.sender === "me" ? "blue" : "green" }}>
              {m.sender === "me" ? "You" : "Museum AI"}
            </p>
            <audio src={m.blobUrl} controls />
          </div>
        ))}
      </div>
    </div>
  );
}

export default SimpleApp;
