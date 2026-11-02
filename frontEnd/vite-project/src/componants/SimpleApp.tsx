/*import React, { useRef, useState } from "react"; v1-> works fine doesnt show more than 2 responses and overlaps ? also no connection to esp

const BACKEND_URL = "http://localhost:8000";

// Utility: Get audio duration for debugging
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [replyUrl, setReplyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Start recording
  const startRecording = async () => {
    setReplyUrl(null);
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    // Let browser pick default type (most reliable)
    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Use correct file extension
        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            setReplyUrl(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      <div>
        {audioUrl && (
          <div>
            <p>Your recording:</p>
            <audio src={audioUrl} controls />
          </div>
        )}
        {replyUrl && (
          <div>
            <p>Museum response:</p>
            <audio src={replyUrl} controls autoPlay />
          </div>
        )}
        {error && (
          <div style={{ color: "red", marginTop: 20 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleApp;*/

/* v1.1 -> works better, queues up but doesnt show the respones of the ai also doesnt show previous records and no esp *//*
import React, { useRef, useState, useCallback } from "react";

// Extend the Window interface to include _introQueued
declare global {
  interface Window {
    _introQueued?: boolean;
  }
}

const BACKEND_URL = "http://localhost:8000";

// Utility: Get audio duration for debugging
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  // Call this to add an audio URL to the queue
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
  }, []);

  // When queue or currentlyPlaying changes, play next if idle
  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  // When currentlyPlaying changes, play it
  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  // When audio finishes, start next
  const onAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Use correct file extension
        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            // ENQUEUE the museum reply
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- DEMO: QUEUE INTRO/OUTRO/ITEM SOUNDS ---
  // Example: queue an intro sound on first render
  React.useEffect(() => {
    // Only queue once!
    if (window._introQueued) return;
    window._introQueued = true;
    // Example: replace with your own intro file URL
    // queueAudio("/intro.mp3");
    // Example: queue a TTS of "Welcome to the AI museum!"
    // (You could fetch a TTS mp3 from backend and queue it here)
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      <div>
        {audioUrl && (
          <div>
            <p>Your recording:</p>
            <audio src={audioUrl} controls />
          </div>
        )}
        <audio
          ref={audioRef}
          style={{ display: "none" }}
          onEnded={onAudioEnded}
          onPause={onAudioEnded}
        />
        {currentlyPlaying && (
          <div>
            <p>Playing: Museum response</p>
          </div>
        )}
        {error && (
          <div style={{ color: "red", marginTop: 20 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{marginTop: 40}}>
        <button
          onClick={() => {
            // Example: add a queued message for Item 1.
            // You would fetch/generate the audio URL for Item 1 here
            // e.g. queueAudio("/item1.mp3")
            // Or dynamically fetch from backend:
            // fetch(BACKEND_URL + "/tts-test?lang=en")
            //   .then(res => res.blob())
            //   .then(blob => queueAudio(URL.createObjectURL(blob)));
            alert("Replace this with your 'item 1' sound logic!");
          }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/

/* v1.2 -> works better, queues up and shows the respones of the ai also shows previous records but no esp
import React, { useRef, useState, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  const onAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages((prev) => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- DEMO: QUEUE INTRO/OUTRO/ITEM SOUNDS ---
  React.useEffect(() => {
    // Only queue once!
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // queueAudio("/intro.mp3");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>

      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>

      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
        onPause={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => {
            // Example: add a queued message for Item 1.
            // fetch(BACKEND_URL + "/tts-test?lang=en")
            //   .then(res => res.blob())
            //   .then(blob => queueAudio(URL.createObjectURL(blob)));
            alert("Replace this with your 'item 1' sound logic!");
          }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/

/*Version 1.3 -> works better, queues up and shows the respones of the ai also shows previous records and esp proximity/gone events BUT DOESNT POLL THE EVENTS FROM THE SERVER/BACKEND SO IT DOESNT WORK 
import React, { useRef, useState, useCallback } from "react";

const BACKEND_URL = "http://192.168.55.211:8000";

// Helper for getting audio duration
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  const onAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages((prev) => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- ESP32/Proximity/Gone Logic DEMO ---
  // Call this to play a proximity or gone event from the backend, queueing the audio
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) {
        // Event ignored (bad sequence)
        return;
      }
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  React.useEffect(() => {
    // Only queue once!
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // To auto-play intro from backend:
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>

      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>

      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
        onPause={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            // Example: add a queued message for Item 1 (demo)
            // fetch(BACKEND_URL + "/tts-test?lang=en")
            //   .then(res => res.blob())
            //   .then(blob => queueAudio(URL.createObjectURL(blob)));
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/


/*import React, { useRef, useState, useCallback } from "react"; v1.4 -> works better, queues up but doesnt do it well and shows the respones of the ai also shows previous records and esp proximity/gone events AND POLLS THE EVENTS FROM THE SERVER/BACKEND SO IT WORKS */

/*const BACKEND_URL = "http://localhost:8000"; // or your LAN IP, e.g., "http://192.168.55.211:8000"

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  const onAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages((prev) => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- POLLING FOR ESP AUDIO EVENTS ---
  React.useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Ignore polling errors or optionally set error
      }
    }, 3000); // every 3 seconds
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) return;
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  React.useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // Optionally: triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>

      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>

      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
        onPause={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            // Example: add a queued message for Item 1 (demo)
            // fetch(BACKEND_URL + "/tts-test?lang=en")
            //   .then(res => res.blob())
            //   .then(blob => queueAudio(URL.createObjectURL(blob)));
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/

/*import React, { useRef, useState, useCallback } from "react"; v1.6 -> it didnt overlap this time but it didnt play automaticly the next record

const BACKEND_URL = "http://localhost:8000"; // Change to your LAN IP if needed

// Helper for getting audio duration
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  const onAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        setMessages((prev) => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- POLLING FOR ESP EVENTS ---
  React.useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) {
        return;
      }
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  React.useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // Optionally: triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>

      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>

      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
        onPause={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            // Example: add a queued message for Item 1 (demo)
            // fetch(BACKEND_URL + "/tts-test?lang=en")
            //   .then(res => res.blob())
            //   .then(blob => queueAudio(URL.createObjectURL(blob)));
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/
/*version 1.7 -> works perfect no overlapping and automaticly plays the next record in the queue + polls the backend for esp events but no button */

/*
import React, { useRef, useState, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000"; // Or your LAN IP

// Helper for getting audio duration (optional, for recording sanity checks)
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  // Play next audio in queue if idle
  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  // Play audio when currentlyPlaying changes
  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  // Advance to next audio on end
  const onAudioEnded = () => setCurrentlyPlaying(null);

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages(prev => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // --- POLLING FOR ESP EVENTS ---
  React.useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) {
        return;
      }
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  // Only queue intro once, if you want to do it automatically on page load
  React.useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/


/*version 1.8 -> works perfect no overlapping this time with click sounds + automaticly plays the next record in the queue + polls the backend for esp events with button */
/*import React, { useRef, useState, useCallback, useEffect } from "react";

const BACKEND_URL = "http://localhost:8000"; // Or your LAN IP
const CLICK_SOUND_URL = "/click.wav"; // Make sure click.wav is in public!

// Helper for getting audio duration (optional, for recording sanity checks)
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  // Play next audio in queue if idle
  React.useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  // Play audio when currentlyPlaying changes
  React.useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  // Advance to next audio on end
  const onAudioEnded = () => setCurrentlyPlaying(null);

  // Play click sound
  const playClickSound = () => {
    const click = new window.Audio(CLICK_SOUND_URL);
    click.currentTime = 0;
    click.play();
};
  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);
    playClickSound();

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        playClickSound();
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages(prev => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    playClickSound();
  };

  // --- SPACEBAR SHORTCUT LOGIC ---
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && !isRecording) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording]);

  // --- POLLING FOR ESP EVENTS ---
  React.useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) {
        return;
      }
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  // Only queue intro once, if you want to do it automatically on page load
  React.useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      {/* Hidden click sound player *//*}
      <audio ref={clickAudioRef} src={CLICK_SOUND_URL} preload="auto" style={{ display: "none" }} />
      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/
/*

import React, { useRef, useState, useCallback, useEffect } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.wav"; // Must exist in public!

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

// Always play a NEW Audio object so it works every time!
const playClickSound = () => {
  const click = new window.Audio(CLICK_SOUND_URL);
  click.play();
};

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  const onAudioEnded = () => setCurrentlyPlaying(null);

  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    playClickSound(); // PLAY CLICK ON PRESS DOWN

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        playClickSound(); // PLAY CLICK ON RELEASE

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }
        setMessages(prev => [...prev, { sender: "me", blobUrl: url }]);
        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    // NO NEED to play click here, it's already played in onstop above!
  };

  // SPACEBAR SHORTCUT FOR BLIND USERS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && !isRecording) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording]);

  // POLLING FOR ESP EVENTS (unchanged)
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // Only queue intro once, if you want to do it automatically on page load
  React.useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => queueAudio('/intro.mp3')}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => queueAudio('/outro.mp3')}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/

/*VERSION THAT WORKS 2*/

/*doesnt work!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

import React, { useRef, useState, useCallback, useEffect } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3"; // Make sure click.mp3 exists in public!

// Helper for getting audio duration (optional, for recording sanity checks)
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

// Play click sound locally with a new Audio object every time
const playClickSound = () => {
  const click = new window.Audio(CLICK_SOUND_URL);
  click.currentTime = 0;
  click.play();
  click.onended = () => {
    // Clean up automatically
    // (This is optional but doesn't actually do much since Audio isn't a DOM node)
  };
};

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  // Play next audio in queue if idle
  useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  // Play audio when currentlyPlaying changes
  useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  // Advance to next audio on end
  const onAudioEnded = () => setCurrentlyPlaying(null);

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    playClickSound(); // Feedback on press

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        playClickSound(); // Feedback on release

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages(prev => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          const contentType = res.headers.get("content-type") || "";
          if (res.ok && (contentType.includes("audio/mpeg") || contentType.includes("audio/wav"))) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else if (res.status === 204 || (contentType && !contentType.startsWith("audio/"))) {
            // No audio: e.g. language-choice step, skip
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    // Click sound already played in onstop
  };

  // --- SPACEBAR SHORTCUT LOGIC ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && !isRecording) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording]);

  // --- POLLING FOR ESP EVENTS ---
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && (contentType.includes("audio/mpeg") || contentType.includes("audio/wav"))) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.status === 204) {
        return;
      }
      if (res.ok && (contentType.includes("audio/mpeg") || contentType.includes("audio/wav"))) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  // Only queue intro once, if you want to do it automatically on page load
  useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",                                                         
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;*/

/*
/*VERSION THAT WORKS */ /*
import React, { useRef, useState, useCallback, useEffect } from "react";

const BACKEND_URL = "http://localhost:8000"; // Or your LAN IP
const CLICK_SOUND_URL = "/click.mp3"; // Make sure click.mp3 is in public!

// Helper for getting audio duration (optional, for recording sanity checks)
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}
/* DONNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNT USE THIS VERSION!!!!!!!!!!!!!!!
// Play click sound locally with a new Audio object every time
const playClickSound = () => {
  try {
    const click = new window.Audio(CLICK_SOUND_URL);
    // Optional: Lower volume if your click is loud
    // click.volume = 0.5;
    click.play();
  } catch (e) {
    // Silently ignore if browser blocks playback (e.g. on mobile, not a user gesture)
  }
};
*/
/*
const playClickSound = () => {
  const click = new window.Audio(CLICK_SOUND_URL);
  click.currentTime = 0;
  click.play();
  click.onended = () => {
    click.remove(); // Clean up once played (optional, good for memory)
  };
};

function SimpleApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; blobUrl: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO QUEUE LOGIC ---
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  // Play next audio in queue if idle
  useEffect(() => {
    if (!currentlyPlaying && queue.length > 0) {
      setCurrentlyPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, currentlyPlaying]);

  // Play audio when currentlyPlaying changes
  useEffect(() => {
    if (currentlyPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = currentlyPlaying;
      audioRef.current.play();
    }
  }, [currentlyPlaying]);

  // Advance to next audio on end
  const onAudioEnded = () => setCurrentlyPlaying(null);

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    setAudioUrl(null);
    setError(null);
    setIsRecording(true);

    playClickSound(); // PLAY CLICK ON PRESS DOWN (mouse/touch/SPACE)

    let mimeType = "";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        playClickSound(); // PLAY CLICK ON RELEASE (mouse/touch/SPACE)

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (blob.size < 2048) {
          setError("Recording was empty or too short. Try again.");
          setIsRecording(false);
          return;
        }
        const duration = await getAudioDuration(blob);
        if (!duration || duration < 0.4) {
          setError("No speech detected! Try again.");
          setIsRecording(false);
          return;
        }

        // Add user message to history
        setMessages(prev => [...prev, { sender: "me", blobUrl: url }]);

        let filename = "recording.webm";
        if (blob.type.includes("wav")) filename = "recording.wav";
        else if (blob.type.includes("ogg")) filename = "recording.ogg";
        else if (blob.type.includes("mp3")) filename = "recording.mp3";

        // Send to backend
        const formData = new FormData();
        formData.append("file", blob, filename);
        try {
          const res = await fetch(`${BACKEND_URL}/post-audio`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const replyBlob = await res.blob();
            const replyUrl = URL.createObjectURL(replyBlob);
            queueAudio(replyUrl);
          } else {
            setError("Upload failed: " + (await res.text()));
          }
        } catch (e: any) {
          setError("Network error: " + (e?.message || e));
        }
        setIsRecording(false);
      };
      mediaRecorder.start();
    } catch (err: any) {
      setError("Could not start recording: " + (err?.message || err));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    // No need to play click sound here; it is played in mediaRecorder.onstop
  };

  // --- SPACEBAR SHORTCUT LOGIC ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && !isRecording) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording]);

  // --- POLLING FOR ESP EVENTS ---
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
        }
      } catch (e) {
        // Optionally: setError("Polling error");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [queueAudio]);

  // --- ESP32/Proximity/Gone Logic DEMO ---
  const triggerEspEvent = async (eventType: "proximity" | "gone", lang: string = "en") => {
    try {
      const res = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, lang }),
      });
      if (res.status === 204) {
        return;
      }
      if (res.ok && res.headers.get("content-type")?.includes("audio/mpeg")) {
        const blob = await res.blob();
        queueAudio(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError("Failed to play museum event audio");
    }
  };

  // Only queue intro once, if you want to do it automatically on page load
  useEffect(() => {
    if ((window as any)._introQueued) return;
    (window as any)._introQueued = true;
    // triggerEspEvent("proximity");
  }, [queueAudio]);

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "auto", fontFamily: "sans-serif" }}>
      <h2>Simple Voice AI Museum Demo</h2>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
        style={{
          background: isRecording ? "red" : "#1976d2",
          color: "#fff",
          padding: "1em 2em",
          border: "none",
          borderRadius: 8,
          fontSize: 20,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {isRecording ? "Recording... Release to stop" : "Hold to Record"}
      </button>
      {/* Conversation history *//*}
      <div style={{ margin: "32px 0" }}>
        {messages.map((audio, idx) => (
          <div key={idx + audio.sender} style={{ marginTop: 12 }}>
            <p style={{
              color: audio.sender === "museum_ai" ? "green" : "blue",
              fontStyle: "italic",                                                         
              fontSize: "0.95em"
            }}>
              {audio.sender === "museum_ai" ? "Museum AI" : "You"}
            </p>
            <audio src={audio.blobUrl} controls />
          </div>
        ))}
      </div>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onEnded={onAudioEnded}
      />
      {currentlyPlaying && (
        <div>
          <p>Playing: Museum response</p>
        </div>
      )}
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          {error}
        </div>
      )}
      <div style={{marginTop: 40}}>
        <button
          onClick={() => triggerEspEvent("proximity")}
          style={{ marginRight: 10 }}
        >
          Trigger Proximity (Intro)
        </button>
        <button
          onClick={() => triggerEspEvent("gone")}
        >
          Trigger Gone (Outro)
        </button>
        <button
          onClick={() => {
            alert("Replace this with your 'item 1' sound logic!");
          }}
          style={{ marginLeft: 10 }}
        >
          Queue Item 1 Audio
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;
*/
/*FINAL VERSION THAT WORKS WITH CYCLIC ITEMS- not well*/
/*
import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// Items that are CYCLIC (0-based index from ESP)
const CYCLIC_ITEMS = [1, 2];

const playClick = () => {
  const a = new Audio(CLICK_SOUND_URL);
  a.currentTime = 0;
  a.play();
};

function SimpleApp() {
  const [activeItem, setActiveItem] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // -------------------------
  // AUDIO QUEUE
  // -------------------------

  useEffect(() => {
  const pollItem = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/session-state`);
      if (!res.ok) return;
      const data = await res.json();

      // item_index: number | null
      setActiveItem(
        typeof data.item_index === "number" ? data.item_index : null
      );
    } catch {}
  }, 500); // fast but safe

  return () => clearInterval(pollItem);
}, []);

  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
  }, []);

  useEffect(() => {
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, playing]);

  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.src = playing;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }, [playing]);

  const onEnded = () => setPlaying(null);

  // -------------------------
  // RECORDING (CHAT ITEMS)
  // -------------------------
  const startRecording = async () => {
    playClick();
    setIsRecording(true);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = rec;

    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      playClick();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const reply = await res.blob();
          queueAudio(URL.createObjectURL(reply));
        }
      } catch {
        setError("Upload failed");
      }

      setIsRecording(false);
    };

    rec.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // -------------------------
  // SPACE KEY LOGIC ⭐
  // -------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();

      // 🔁 CYCLIC ITEM → ask backend for NEXT audio
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/esp-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "item",
            item_index: activeItem,
          }),
        });
        return;
      }

      // 🎙 NORMAL ITEM → RECORD
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
  // ESP AUDIO POLLING
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
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
          {activeItem !== null && CYCLIC_ITEMS.includes(activeItem)
            ? "Cyclic Audio"
            : "Voice Chat"}
        </strong>
      </p>

      <audio ref={audioRef} onEnded={onEnded} />

      {playing && <p>🔊 Playing audio…</p>}
      {isRecording && <p>🎙 Recording…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default SimpleApp;
*/

/*`FINAL FINAL VERSION THAT WORKS WITH CYCLIC ITEMS AND MESSAGE HISTORY DISPLAYED but doesnt stop */
/*
import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// CYCLIC ITEMS (ESP index)
const CYCLIC_ITEMS = [1, 2];

type Message = {
  sender: "me" | "museum_ai";
  blobUrl: string;
};

const playClick = () => {
  const a = new Audio(CLICK_SOUND_URL);
  a.currentTime = 0;
  a.play();
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // -------------------------
  // SESSION STATE (ACTIVE ITEM)
  // -------------------------
  useEffect(() => {
    const pollItem = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/session-state`);
        if (!res.ok) return;
        const data = await res.json();
        setActiveItem(
          typeof data.item_index === "number" ? data.item_index : null
        );
      } catch {}
    }, 500);

    return () => clearInterval(pollItem);
  }, []);

  // -------------------------
  // AUDIO QUEUE
  // -------------------------
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  useEffect(() => {
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, playing]);

  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.src = playing;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }, [playing]);

  const onEnded = () => setPlaying(null);

  // -------------------------
  // RECORDING (CHAT ITEMS)
  // -------------------------
  const startRecording = async () => {
    playClick();
    setIsRecording(true);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = rec;

    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      playClick();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const userUrl = URL.createObjectURL(blob);

      setMessages(prev => [...prev, { sender: "me", blobUrl: userUrl }]);

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const reply = await res.blob();
          queueAudio(URL.createObjectURL(reply));
        }
      } catch {
        setError("Upload failed");
      }

      setIsRecording(false);
    };

    rec.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // -------------------------
  // SPACE KEY LOGIC ⭐
  // -------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
        // 🚫 NEW: ignore browser auto-repeat
      if (e.repeat) return;
      e.preventDefault();
      

      // 🔁 CYCLIC ITEM → play next audio
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/cycle-next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "item",
            item_index: activeItem,
          }),
        });
        return;
      }




      // 🎙 NORMAL ITEM / NO ITEM → RECORD
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
  // ESP AUDIO POLLING
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
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
          {activeItem !== null && CYCLIC_ITEMS.includes(activeItem)
            ? "Cyclic Audio"
            : "Voice Chat"}
        </strong>
      </p>

      <audio ref={audioRef} onEnded={onEnded} />

      {playing && <p>🔊 Playing audio…</p>}
      {isRecording && <p>🎙 Recording…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Conversation History *//*}
      <div style={{ marginTop: 30 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
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
*//*FINAL FINAL VERSION THAT WORKS WITH CYCLIC ITEMS AND MESSAGE HISTORY DISPLAYED AND FIXED SPACE KEY REPEAT ISSUE*/

/*  

import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// ESP item indices that are cyclic
const CYCLIC_ITEMS = [1, 2];

type Message = {
  sender: "me" | "museum_ai";
  blobUrl: string;
};

const playClick = () => {
  const a = new Audio(CLICK_SOUND_URL);
  a.currentTime = 0;
  a.play();
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // -------------------------
  // RESET PLAYBACK (ON -1)
  // -------------------------
  const resetPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setQueue([]);
    setPlaying(null);
  };

  // -------------------------
  // SESSION STATE (SINGLE SOURCE OF TRUTH)
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/session-state`);
        if (!res.ok) return;

        const data = await res.json();
        const idx =
          typeof data.item_index === "number" ? data.item_index : null;

        // 🔁 RESET FROM ESP (-1)
        if (idx === -1 || idx === null) {
          resetPlayback();
          setActiveItem(null);
          return;
        }

        setActiveItem(idx);
      } catch {}
    }, 500);

    return () => clearInterval(poll);
  }, []);

  // -------------------------
  // AUDIO QUEUE
  // -------------------------
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  useEffect(() => {
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, playing]);

  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.src = playing;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }, [playing]);

  const onEnded = () => setPlaying(null);

  // -------------------------
  // RECORDING (CHAT ITEMS ONLY)
  // -------------------------
  const startRecording = async () => {
    playClick();
    setIsRecording(true);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = rec;

    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      playClick();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const userUrl = URL.createObjectURL(blob);

      setMessages(prev => [...prev, { sender: "me", blobUrl: userUrl }]);

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const reply = await res.blob();
          queueAudio(URL.createObjectURL(reply));
        }
      } catch {
        setError("Upload failed");
      }

      setIsRecording(false);
    };

    rec.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // -------------------------
  // SPACE KEY LOGIC ⭐ (CORRECT)
  // -------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();

      // 🔁 CYCLIC ITEM → request next audio
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/cycle-next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_index: activeItem }),
        });
        return;
      }

      // 🎙 CHAT ITEMS
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
  // ESP AUDIO POLLING
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          queueAudio(URL.createObjectURL(blob));
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
        Active item: <strong>{activeItem === null ? "None" : activeItem + 1}</strong>
      </p>

      <p>
        Mode:{" "}
        <strong>
          {activeItem !== null && CYCLIC_ITEMS.includes(activeItem)
            ? "Cyclic Audio"
            : "Voice Chat"}
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
*/
/*FINAL FINAL VERSION THAT WORKS WITH CYCLIC ITEMS AND MESSAGE HISTORY DISPLAYED AND FIXED SPACE KEY REPEAT ISSUE AND HANDLES ESP RESET WITH -1 INDEX*/
/*import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// ESP item indices that are cyclic
const CYCLIC_ITEMS = [1, 2];

type Message = {
  sender: "me" | "museum_ai";
  blobUrl: string;
};

const playClick = () => {
  const a = new Audio(CLICK_SOUND_URL);
  a.currentTime = 0;
  a.play();
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

  // 🔑 WHO OWNS THE SPEAKER
  const [audioSource, setAudioSource] =
    useState<"esp" | "chat" | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);


  const RETURN_SOUND_URL = "/correct.mp3";

const playReturnVoice = () => {
  const a = new Audio(RETURN_SOUND_URL);
  a.currentTime = 0;
  a.play().catch(console.error);
};
  const prevItemRef = useRef<number | null>(null);

  // -------------------------
  // RESET PLAYBACK (ESP ONLY)
  // -------------------------
  const resetPlayback = () => {
    if (audioSource === "chat") return; //  do NOT stop chat

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setQueue([]);
    setPlaying(null);
    setAudioSource(null);
  };

  // -------------------------
  // SESSION STATE (ESP TRUTH)
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/session-state`);
        if (!res.ok) return;

        const data = await res.json();
        const idx =
          typeof data.item_index === "number"
            ? data.item_index
            : null;

        const prev = prevItemRef.current;
prevItemRef.current = idx;

if (prev !== null && idx === null) {
  // optional local fallback voice:
  // playReturnVoice();
  resetPlayback();
  setActiveItem(null);
  return;
}

if (idx === null) {
  setActiveItem(null);
  return;
}

/*
        // 🔁 ESP returned NO ITEM
        if (idx === null) {
          if (audioSource === "esp") {
            //playClick();                  // <-- Add this line for instant click

            resetPlayback(); // stop ESP only
            setActiveItem(null);
          }
          return;
        }*/

        // 🆕 NEW ITEM LIFTED/*
        /*
        setActiveItem(idx);
        setAudioSource("esp"); // ESP takes over speaker
      } catch {}
    }, 500);

    return () => clearInterval(poll);
  }, [audioSource]);

  // -------------------------
  // AUDIO QUEUE
  // -------------------------
  const queueAudio = useCallback((url: string) => {
    setQueue(q => [...q, url]);
    setMessages(prev => [
      ...prev,
      { sender: "museum_ai", blobUrl: url },
    ]);
  }, []);

  useEffect(() => {
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;

    audio.src = playing;
    audio.currentTime = 0;

    audio.play().catch(err => {
      if (err.name !== "AbortError") {
        console.error("Audio play failed:", err);
      }
    });
  }, [playing]);

  const onEnded = () => setPlaying(null);

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

    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      playClick();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const userUrl = URL.createObjectURL(blob);

      setMessages(prev => [...prev, { sender: "me", blobUrl: userUrl }]);

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const reply = await res.blob();
          setAudioSource("chat"); // 🎙 chat owns speaker
          queueAudio(URL.createObjectURL(reply));
        }
      } catch {
        setError("Upload failed");
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

      // 🔁 CYCLIC ESP ITEMS
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/cycle-next`, { method: "POST" });
        return;
      }

      // 🎙 CHAT
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
  // ESP AUDIO POLLING
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          setAudioSource("esp");
          queueAudio(URL.createObjectURL(blob));
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
          {audioSource === "esp"
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

export default SimpleApp;*/
/*
import React, { useRef, useState, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8000";
const CLICK_SOUND_URL = "/click.mp3";

// ESP item indices that are cyclic
const CYCLIC_ITEMS = [1, 2];

// ✅ WAIT LOOP FILES (put in /public)
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

  // 🔑 WHO OWNS THE SPEAKER
  const [audioSource, setAudioSource] = useState<"esp" | "chat" | null>(null);

  // ✅ WAIT LOOP STATE
  const [isWaiting, setIsWaiting] = useState(false);
  const waitIdxRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const prevItemRef = useRef<number | null>(null);

  // -------------------------
  // FORCE-PLAY (interrupt anything)
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
  // WAIT LOOP
  // -------------------------
  const startWaitLoop = useCallback(() => {
    // Chat owns speaker while waiting (prevents ESP logic from killing playback)
    setAudioSource("chat");

    waitIdxRef.current = 0;
    setIsWaiting(true);

    // play immediately
    interruptAndPlay(WAIT_SOUNDS[0]);
    waitIdxRef.current = 1;
  }, [interruptAndPlay]);

  const stopWaitLoop = useCallback(() => {
    setIsWaiting(false);
  }, []);

  // -------------------------
  // RESET PLAYBACK (ESP ONLY)
  // -------------------------
  const resetPlayback = useCallback(() => {
    if (audioSource === "chat") return; // do NOT stop chat

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

        // returned to none
        if (prev !== null && idx === null) {
          resetPlayback();
          setActiveItem(null);
          return;
        }

        if (idx === null) {
          setActiveItem(null);
          return;
        }

        // new item lifted
        setActiveItem(idx);
        setAudioSource("esp");
      } catch {}
    }, 500);

    return () => clearInterval(poll);
  }, [resetPlayback]);

  // -------------------------
  // AUDIO QUEUE (normal museum audio, AI audio)
  // -------------------------
  const queueAudio = useCallback((url: string) => {
    setQueue((q) => [...q, url]);
    setMessages((prev) => [...prev, { sender: "museum_ai", blobUrl: url }]);
  }, []);

  useEffect(() => {
    if (!playing && queue.length > 0) {
      setPlaying(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;

    audio.src = playing;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Audio play failed:", err);
      }
    });
  }, [playing]);

  // ✅ onEnded: if waiting -> play next wait clip in loop
  const onEnded = () => {
    if (isWaiting) {
      const next = WAIT_SOUNDS[waitIdxRef.current % WAIT_SOUNDS.length];
      waitIdxRef.current = (waitIdxRef.current + 1) % WAIT_SOUNDS.length;
      setPlaying(next);
      return;
    }
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

      // ✅ start wait loop immediately after user stops talking
      startWaitLoop();

      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      try {
        const res = await fetch(`${BACKEND_URL}/post-audio`, {
          method: "POST",
          body: fd,
        });

        // If backend returns audio reply
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const replyBlob = await res.blob();
          const replyUrl = URL.createObjectURL(replyBlob);

          // ✅ stop waiting and interrupt to play reply immediately
          stopWaitLoop();
          interruptAndPlay(replyUrl);

          // show reply in UI (optional, but usually nice)
          setMessages((prev) => [
            ...prev,
            { sender: "museum_ai", blobUrl: replyUrl },
          ]);
        } else {
          stopWaitLoop();
        }
      } catch {
        stopWaitLoop();
        setError("Upload failed");
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

      // 🔁 CYCLIC ESP ITEMS
      if (activeItem !== null && CYCLIC_ITEMS.includes(activeItem)) {
        fetch(`${BACKEND_URL}/cycle-next`, { method: "POST" });
        return;
      }

      // 🎙 CHAT
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
  // ESP AUDIO POLLING
  // -------------------------
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-audio`);
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();

          // ESP takes speaker only when not waiting for chat reply
          // (If you want ESP to still interrupt waiting, remove this if)
          if (!isWaiting) setAudioSource("esp");

          const url = URL.createObjectURL(blob);
          queueAudio(url);
        }
      } catch {}
    }, 1500);

    return () => clearInterval(poll);
  }, [queueAudio, isWaiting]);

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
            ? "Thinking (wait loop)"
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

*/

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
