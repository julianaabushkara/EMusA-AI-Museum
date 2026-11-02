from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io, os, subprocess, tempfile, threading
import time

from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages,log_pipeline, _append_jsonl, _now_iso, LOG_FILE, AI_ENABLED_ITEMS
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech

app = FastAPI()

# -----------------------
# CORS
# -----------------------
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# STATE
# -----------------------
SESSION_STATE = {
    "active": False,
    "item_index": None
}

ESP_AUDIO_QUEUE = []

# 🔁 CYCLIC ITEMS
CYCLIC_ITEMS = {
    1: ["item_2.mp3", "item_2_1.mp3", "item_2_2.mp3"],
    2: ["item_3.mp3", "item_3_1.mp3", "item_3_2.mp3"],
}

CYCLIC_INDEX = {k: 0 for k in CYCLIC_ITEMS}
LOCK = threading.Lock()

# -----------------------
# HELPERS
# -----------------------
def find_audio(name: str) -> str:
    if os.path.exists(name):
        return name
    raise HTTPException(404, f"{name} not found")


def convert_webm_to_wav_bytes(webm_bytes: bytes) -> bytes:
    """
    Converts browser audio/webm (opus) into 16kHz mono wav bytes using ffmpeg.
    """
    webm_path = None
    wav_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(webm_bytes)
            f.flush()
            webm_path = f.name
            wav_path = webm_path.replace(".webm", ".wav")

        # -nostdin avoids ffmpeg hanging on stdin in some environments
        proc = subprocess.run(
            ["ffmpeg", "-nostdin", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="ignore")[:1000]
            raise RuntimeError(f"ffmpeg failed: {err}")

        with open(wav_path, "rb") as w:
            return w.read()

    finally:
        if webm_path and os.path.exists(webm_path):
            os.remove(webm_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

# -----------------------
# ESP EVENTS
# -----------------------
@app.post("/esp-event")
async def esp_event(request: Request):
    data = await request.json()
    event_type = data.get("event_type")

    # -----------------------
    # PROXIMITY
    # -----------------------
    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)

        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None

        path = find_audio("intro.mp3")
        with open(path, "rb") as f:
            ESP_AUDIO_QUEUE.append(f.read())

        _append_jsonl(LOG_FILE, {
            "ts": _now_iso(),
            "type": "session",
            "event": "enter"
        })

        return FileResponse(path, media_type="audio/mpeg")

    # -----------------------
    # ITEM EVENTS
    # -----------------------
    if event_type == "item":

        # MULTI
        if data.get("multi") is True:
            path = find_audio("multiple_items.mp3")
            with open(path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())

            _append_jsonl(LOG_FILE, {
                "ts": _now_iso(),
                "type": "esp_item",
                "event": "multi"
            })

            return FileResponse(path, media_type="audio/mpeg")

        # SINGLE / RETURN
        idx = data.get("item_index")
        prev = SESSION_STATE["item_index"]

        is_return = (
            idx == -1
            or idx is None
            or (not isinstance(idx, int))
            or idx < 0
            or idx > 3
        )

        if is_return:
            SESSION_STATE["item_index"] = None

            _append_jsonl(LOG_FILE, {
                "ts": _now_iso(),
                "type": "esp_item",
                "event": "none",
                "idx_raw": idx
            })

            # only confirm return if we previously had an item
            if prev is not None:
                path = find_audio("correct.mp3")
                with open(path, "rb") as f:
                    ESP_AUDIO_QUEUE.append(f.read())

            # reset cyclic indexes
            for k in CYCLIC_INDEX:
                CYCLIC_INDEX[k] = 0

            return {"status": "no_item"}

        # LIFTED item 0..3
        SESSION_STATE["item_index"] = idx
        _append_jsonl(LOG_FILE, {
            "ts": _now_iso(),
            "type": "esp_item",
            "event": "lift",
            "lifted_index": idx,
            "chat_enabled": (idx in AI_ENABLED_ITEMS)
        })

        # CYCLIC items
        if idx in CYCLIC_ITEMS:
            with LOCK:
                filename = CYCLIC_ITEMS[idx][0]
                CYCLIC_INDEX[idx] = 1 % len(CYCLIC_ITEMS[idx])

            path = find_audio(filename)
            with open(path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())

            return FileResponse(path, media_type="audio/mpeg")

        # NORMAL item
        path = find_audio(f"item_{idx+1}.mp3")
        with open(path, "rb") as f:
            ESP_AUDIO_QUEUE.append(f.read())

        return FileResponse(path, media_type="audio/mpeg")

    raise HTTPException(400, "Invalid event_type")

# -----------------------
# AUDIO POLLING
# -----------------------
@app.get("/get-latest-esp-audio")
async def get_latest_audio():
    if ESP_AUDIO_QUEUE:
        return StreamingResponse(
            io.BytesIO(ESP_AUDIO_QUEUE.pop(0)),
            media_type="audio/mpeg"
        )
    return {"status": "no_event"}

# -----------------------
# CHAT (BLOCKED FOR CYCLIC)
# -----------------------
@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    pipeline_start = time.perf_counter()
    idx = SESSION_STATE["item_index"]

    # 🚫 HARD BLOCK CHAT
    if idx in CYCLIC_ITEMS:
        return StreamingResponse(io.BytesIO(b""), status_code=204)

    print("SESSION_STATE at /post-audio:", SESSION_STATE)

    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

    # If it's webm -> convert to wav (for Whisper / STT reliability)
    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
        except Exception as e:
            print("FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # 1) STT
    stt_start = time.perf_counter()
    message_decoded = convert_audio_to_text(audio_io)
    stt_time = time.perf_counter() - stt_start
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lifted_index = SESSION_STATE.get("item_index")  # Pass item context!
    print("Item index received in chat _main :", lifted_index)

    # 2) LLM
    gpt_start = time.perf_counter()


    chat_response = get_chat_response(message_decoded, lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)
    gpt_time = time.perf_counter() - gpt_start
    # 3) Lang detect (moved here; tiny speed-up vs doing before LLM)
    lang_start = time.perf_counter()

    lang = detect_lang_openai(message_decoded) or "en"
    lang_time = time.perf_counter() - lang_start
    # 4) TTS
    tts_start = time.perf_counter()

    audio_output = convert_text_to_speech(chat_response, lang)
    tts_time = time.perf_counter() - tts_start
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get TTS audio response.")

    def iterfile():
        yield audio_output

    total_time = time.perf_counter() - pipeline_start
    log_pipeline(
    lifted_index,
    stt_time,
    gpt_time,
    lang_time,
    tts_time,
    total_time,
    message_decoded,
    chat_response,
    lang
)
    return StreamingResponse(iterfile(), media_type="audio/mpeg")

# -----------------------
# MISC
# -----------------------
@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.get("/session-state")
async def session_state():
    return {
        "active": SESSION_STATE["active"],
        "item_index": SESSION_STATE["item_index"]
    }

@app.post("/cycle-next")
async def cycle_next():
    idx = SESSION_STATE["item_index"]

    if idx not in CYCLIC_ITEMS:
        return {"status": "not_cyclic"}

    with LOCK:
        i = CYCLIC_INDEX[idx]
        filename = CYCLIC_ITEMS[idx][i]
        CYCLIC_INDEX[idx] = (i + 1) % len(CYCLIC_ITEMS[idx])

    path = find_audio(filename)
    with open(path, "rb") as f:
        ESP_AUDIO_QUEUE.append(f.read())

    return FileResponse(path, media_type="audio/mpeg")




    
