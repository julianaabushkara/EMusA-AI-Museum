""" 
from fastapi import FastAPI, File, UploadFile, HTTPException v1-v1.1 -> chat works fine saves to json translate but doesnt connect to esp / also need more prompt system -> intro if asked specific on an item to talk also if asked about the instructions but at the same time to know what item currently on
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

# CORS setup for all common dev ports and both localhost/127.0.0.1
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

# --- Utility: Convert webm to wav (for browser uploads) ---
def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)


@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}


@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}


@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    # Read the uploaded file
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

    # If it's webm, convert to wav for Whisper
    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
        except Exception as e:
            print("FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    # Wrap in BytesIO and set .name so openai infers format
    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # Transcribe with Whisper
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    # Detect language & get chat response
    lang = detect_lang_openai(message_decoded)
    chat_response = get_chat_response(message_decoded)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    # Store in conversation history
    store_messages(message_decoded, chat_response)

    # Synthesize response to speech
    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")


@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg") """



""" from fastapi import FastAPI, File, UploadFile, HTTPException, Request V1.2-1.3 DOESNT POLL TO THE ESP EVENTS SO PROXIMITY/GONE DOESNT WORK
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

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

# --- Utility: Convert webm to wav (for browser uploads) ---
def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- PROXIMITY/GONE SESSION STATE ----
SESSION_STATE = {"active": False}

@app.post("/esp-event")
async def esp_event(request: Request):"""#POST {"event_type": "proximity" | "gone"}
    #Handles proximity/gone event logic and returns TTS streaming audio.
"""
    data = await request.json()
    event_type = data.get("event_type", "").lower()
    lang = data.get("lang", "en")  # Optional: allow setting language

    # --- Logic for proximity/gone state ---
    if event_type == "proximity":
        if SESSION_STATE["active"]:
            # Already in proximity; ignore until gone
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        # Welcome message (customize as needed)
        welcome = "Welcome to the AI museum! Feel free to ask me about any item or about women in history."
        audio = convert_text_to_speech(welcome, lang)
        if not audio:
            raise HTTPException(status_code=502, detail="TTS error")
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            # Can't trigger gone before proximity
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        # Goodbye message (customize as needed)
        goodbye = "Thank you for visiting the AI museum. Goodbye!"
        audio = convert_text_to_speech(goodbye, lang)
        if not audio:
            raise HTTPException(status_code=502, detail="TTS error")
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        # Unknown event_type (could extend for 'lift_state')
        raise HTTPException(status_code=400, detail="Invalid event_type")

# Existing endpoints (unchanged)...
# ... (rest of your file as before)
@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}


@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}


@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    # Read the uploaded file
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

    # If it's webm, convert to wav for Whisper
    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
        except Exception as e:
            print("FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    # Wrap in BytesIO and set .name so openai infers format
    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # Transcribe with Whisper
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    # Detect language & get chat response
    lang = detect_lang_openai(message_decoded)
    chat_response = get_chat_response(message_decoded)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    # Store in conversation history
    store_messages(message_decoded, chat_response)

    # Synthesize response to speech
    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")


@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")  """

""" 
from fastapi import FastAPI, File, UploadFile, HTTPException, Request v1.4 - works fine but need to add the lifted state to the esp event and it generates the welcom and outro response dynamically
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed, e.g. "http://192.168.55.211:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Utility: Convert webm to wav (for browser uploads) ---
def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- PROXIMITY/GONE SESSION STATE ----
SESSION_STATE = {"active": False}

# ---- ESP AUDIO QUEUE FOR FRONTEND POLLING ----
ESP_AUDIO_QUEUE = []

@app.post("/esp-event")
async def esp_event(request: Request):
    """
    #POST {"event_type": "proximity" | "gone"}
    #Handles proximity/gone event logic and returns TTS streaming audio, and queues it for frontend polling.
"""
    data = await request.json()
    event_type = data.get("event_type", "").lower()
    lang = data.get("lang", "en")  # Optional: allow setting language

    # --- Logic for proximity/gone state ---
    if event_type == "proximity":
        if SESSION_STATE["active"]:
            # Already in proximity; ignore until gone
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        welcome = "Welcome to the AI museum! Feel free to ask me about any item or about women in history."
        audio = convert_text_to_speech(welcome, lang)
        if not audio:
            raise HTTPException(status_code=502, detail="TTS error")
        ESP_AUDIO_QUEUE.append(audio)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        goodbye = "Thank you for visiting the AI museum. Goodbye!"
        audio = convert_text_to_speech(goodbye, lang)
        if not audio:
            raise HTTPException(status_code=502, detail="TTS error")
        ESP_AUDIO_QUEUE.append(audio)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    # Read the uploaded file
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

    # If it's webm, convert to wav for Whisper
    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
        except Exception as e:
            print("FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    # Wrap in BytesIO and set .name so openai infers format
    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # Transcribe with Whisper
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    # Detect language & get chat response
    lang = detect_lang_openai(message_decoded)
    chat_response = get_chat_response(message_decoded)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    # Store in conversation history
    store_messages(message_decoded, chat_response)

    # Synthesize response to speech
    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg") """


""" from fastapi import FastAPI, File, UploadFile, HTTPException, Request v1.5 - works fine with the esp polling and proximity/gone states but doesnt queue the voices and it overlaps sometimes
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed, e.g. "http://192.168.55.211:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Utility: Convert webm to wav (for browser uploads) ---
def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- PROXIMITY/GONE SESSION STATE ----
SESSION_STATE = {"active": False}
ESP_AUDIO_QUEUE = []

@app.post("/esp-event")
async def esp_event(request: Request):
    """
    #POST {"event_type": "proximity" | "gone"}
    #Returns your local intro.mp3/outro.mp3 and queues the bytes for polling.
"""
    data = await request.json()
    event_type = data.get("event_type", "").lower()

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        audio_path = "intro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="intro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        audio_path = "outro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="outro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

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

    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = detect_lang_openai(message_decoded)
    chat_response = get_chat_response(message_decoded)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg") """

"""
#v1.6 - works fine with the esp polling and proximity/gone states and queues the voices for polling so no overlaps and plays the intro/outro from local files the problem no ir sensor 
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed, e.g. "http://192.168.55.211:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Utility: Convert webm to wav (for browser uploads) ---
def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- PROXIMITY/GONE SESSION STATE ----
SESSION_STATE = {"active": False}
ESP_AUDIO_QUEUE = []

@app.post("/esp-event")
async def esp_event(request: Request):
    
    #POST {"event_type": "proximity" | "gone"}
    #Returns your local intro.mp3/outro.mp3 and queues the bytes for frontend polling.
    
    data = await request.json()
    event_type = data.get("event_type", "").lower()

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        audio_path = "intro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="intro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        audio_path = "outro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="outro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

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

    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = detect_lang_openai(message_decoded)
    chat_response = get_chat_response(message_decoded)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")

"""

""" version 1.7 - works fine with the esp polling and proximity/gone/item states and queues the voices for polling so no overlaps and plays the intro/outro/item from local files- added button and ir sensor support+ button """
"""from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- PROXIMITY/GONE/ITEM SESSION STATE ----
SESSION_STATE = {"active": False, "item_index": None}   # CHANGES HERE: add item_index state
ESP_AUDIO_QUEUE = []

@app.post("/esp-event")
async def esp_event(request: Request):
    """""""
    POST {"event_type": "proximity" | "gone" | "item", "item_index": int (optional)}
    Returns your local intro.mp3/outro.mp3/item_X.mp3 and queues the bytes for frontend polling.
    """""""
    data = await request.json()
    event_type = data.get("event_type", "").lower()
    # CHANGES HERE: handle item event
    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None  # Reset on new person
        audio_path = "intro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="intro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        SESSION_STATE["item_index"] = None
        audio_path = "outro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="outro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    elif event_type == "item":
        item_index = data.get("item_index")
        print("Item index received:", item_index)
        if item_index is None or not isinstance(item_index, int) or not (0 <= item_index <= 4):
            raise HTTPException(status_code=400, detail="Invalid or missing item_index")
        SESSION_STATE["item_index"] = item_index
        audio_path = f"item_{item_index+1}.mp3"  # Files: item_1.mp3, item_2.mp3, etc.
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail=f"{audio_path} not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    # Read the uploaded file
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

    # If it's webm, convert to wav for Whisper
    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
        except Exception as e:
            print("FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    # Wrap in BytesIO and set .name so openai infers format
    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # Transcribe with Whisper
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    # Detect language & get chat response
    lang = detect_lang_openai(message_decoded)
    lifted_index = SESSION_STATE.get("item_index")  # CHANGES HERE: pass item context!
    print("Item index received in chat _main :", lifted_index)

    chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    # Store in conversation history
    store_messages(message_decoded, chat_response,lifted_index)

    # Synthesize response to speech
    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")"""

""" Version 1.8 - final version with all the features working fine with the esp polling and proximity/gone/item states and queues the voices for polling so no overlaps and plays the intro/outro/item from local files- added button and ir sensor support+ button + fixed item index handling """



""" # Version 1.9 - final version with language selection support"""
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- SESSION STATE ----
SESSION_STATE = {
    "active": False,
    "item_index": None,
    "lang": None,
    "expect_language_choice": False,
}
ESP_AUDIO_QUEUE = []

# Path to your "which language?" mp3 (must exist for best UX)
LANGUAGE_PROMPT_PATH = "recordings/choose_language.mp3"

@app.post("/esp-event")
async def esp_event(request: Request):
    """""""
    POST {"event_type": "proximity" | "gone" | "item", "item_index": int (optional)}
    Language should be set AFTER proximity.
    """""""
      data = await request.json()
    event_type = data.get("event_type", "").lower()

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None
        SESSION_STATE["lang"] = None
        SESSION_STATE["expect_language_choice"] = True

        if os.path.exists(LANGUAGE_PROMPT_PATH):
            with open(LANGUAGE_PROMPT_PATH, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            return FileResponse(LANGUAGE_PROMPT_PATH, media_type="audio/mpeg")
        else:
            # fallback to TTS
            tts_prompt = "Which language do you want? Please say English, Hebrew, or Arabic."
            audio_bytes = convert_text_to_speech(tts_prompt, "en")
            ESP_AUDIO_QUEUE.append(audio_bytes)
            return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        SESSION_STATE["item_index"] = None
        lang = SESSION_STATE.get("lang", "en") or "en"
        outro_path = f"recordings/{lang}/Outro.mp3"
        if not os.path.exists(outro_path):
            outro_path = "outro.mp3"
        if os.path.exists(outro_path):
            with open(outro_path, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            return FileResponse(outro_path, media_type="audio/mpeg")
        else:
            goodbye = "Thank you for visiting the AI museum. Goodbye!"
            audio_bytes = convert_text_to_speech(goodbye, lang)
            ESP_AUDIO_QUEUE.append(audio_bytes)
            return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    elif event_type == "item":
        item_index = data.get("item_index")
        lang = SESSION_STATE.get("lang", "en") or "en"
        print("Item index received:", item_index)
        # Accept None, -1, or invalid index as "no item lifted"
        if item_index is None or item_index == -1 or not isinstance(item_index, int) or not (0 <= item_index <= 3):
            SESSION_STATE["item_index"] = None
            return {"status": "no_item"}
        SESSION_STATE["item_index"] = item_index
        audio_path = f"recordings/{lang}/item_{item_index+1}.mp3"
        if not os.path.exists(audio_path):
            # fallback: root-level files
            audio_path = f"item_{item_index+1}.mp3"
        if os.path.exists(audio_path):
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            return FileResponse(audio_path, media_type="audio/mpeg")
        else:
            return {"status": f"item_{item_index+1}_audio_missing"}
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    print("SESSION_STATE at /post-audio:", SESSION_STATE)
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

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

    # -- LANGUAGE CHOICE STEP --
    if SESSION_STATE.get("expect_language_choice"):
        message_decoded = convert_audio_to_text(audio_io)
        print("[LANG CHOICE] Decoded:", message_decoded)

        lang = detect_lang_openai(message_decoded or "")
        if lang not in ("en", "ar", "he"):
            lang = "en"
        SESSION_STATE["lang"] = lang
        SESSION_STATE["expect_language_choice"] = False

        # Queue and play correct language's intro (if available)
        intro_path = f"recordings/{lang}/intro.mp3"
        if not os.path.exists(intro_path):
            intro_path = "intro.mp3"
        if os.path.exists(intro_path):
            with open(intro_path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())
        # DO NOT return a spoken reply to user, just return an empty response.
        return StreamingResponse(io.BytesIO(b""), status_code=204)

    # -- NORMAL FLOW --
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = SESSION_STATE.get("lang") or detect_lang_openai(message_decoded)
    lifted_index = SESSION_STATE.get("item_index")
    print("Item index received in chat:", lifted_index)

    chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")"""



""" # Version 1.10 - final version with language selection support - cleaned up debug prints  chat fo all items"""

"""version with multiple languages """
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)

# ---- SESSION STATE ----
SESSION_STATE = {
    "active": False,
    "item_index": None,
    "lang": None,
    "expect_language_choice": False,
}
ESP_AUDIO_QUEUE = []

# Path to your "which language?" mp3 (must exist for best UX)
LANGUAGE_PROMPT_PATH = "recordings/choose_language.mp3"

@app.post("/esp-event")
async def esp_event(request: Request):
    """
"""
    POST {"event_type": "proximity" | "gone" | "item", "item_index": int (optional)}
    Language should be set AFTER proximity.
    """
"""
    data = await request.json()
    event_type = data.get("event_type", "").lower()

    print("\n[ESP-EVENT] event_type:", event_type)
    print("[ESP-EVENT] SESSION_STATE before:", SESSION_STATE)

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            print("[ESP-EVENT] Already in proximity (active), ignoring.")
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None
        SESSION_STATE["lang"] = None
        SESSION_STATE["expect_language_choice"] = True

        if os.path.exists(LANGUAGE_PROMPT_PATH):
            with open(LANGUAGE_PROMPT_PATH, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print("[ESP-EVENT] Queued choose_language.mp3")
            return FileResponse(LANGUAGE_PROMPT_PATH, media_type="audio/mpeg")
        else:
            # fallback to TTS
            tts_prompt = "Which language do you want? Please say English, Hebrew, or Arabic."
            audio_bytes = convert_text_to_speech(tts_prompt, "en")
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print("[ESP-EVENT] Queued fallback TTS language prompt")
            return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    elif event_type == "gone":
        if not SESSION_STATE["active"]:
            print("[ESP-EVENT] Gone triggered but not active, ignoring.")
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = False
        SESSION_STATE["item_index"] = None
        lang = SESSION_STATE.get("lang", "en") or "en"
        outro_path = f"recordings/{lang}/Outro.mp3"
        if not os.path.exists(outro_path):
            outro_path = "outro.mp3"
        if os.path.exists(outro_path):
            with open(outro_path, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print(f"[ESP-EVENT] Queued outro: {outro_path}")
            return FileResponse(outro_path, media_type="audio/mpeg")
        else:
            goodbye = "Thank you for visiting the AI museum. Goodbye!"
            audio_bytes = convert_text_to_speech(goodbye, lang)
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print(f"[ESP-EVENT] Queued fallback TTS outro (lang={lang})")
            return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    elif event_type == "item":
        item_index = data.get("item_index")
        lang = SESSION_STATE.get("lang", "en") or "en"
        print("[ESP-EVENT] Item index received:", item_index, "| lang", lang)
        if item_index is None or item_index == -1 or not isinstance(item_index, int) or not (0 <= item_index <= 3):
            SESSION_STATE["item_index"] = None
            print("[ESP-EVENT] Ignoring item: invalid/lifted-index/off.")
            return {"status": "no_item"}
        SESSION_STATE["item_index"] = item_index
        audio_path = f"recordings/{lang}/item_{item_index+1}.mp3"
        if not os.path.exists(audio_path):
            audio_path = f"item_{item_index+1}.mp3"
        if os.path.exists(audio_path):
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print(f"[ESP-EVENT] Queued {audio_path}")
            return FileResponse(audio_path, media_type="audio/mpeg")
        else:
            print(f"[ESP-EVENT] Missing audio file: {audio_path}")
            return {"status": f"item_{item_index+1}_audio_missing"}
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        print("[ESP POLL] Served and popped one queued audio.")
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        print("[ESP POLL] No event/audio to serve.")
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    print("[RESET] Conversation history reset.")
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    print("\n[POST-AUDIO] SESSION_STATE at start:", SESSION_STATE)
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("[POST-AUDIO] Upload filename:", filename)
    print("[POST-AUDIO] Upload content_type:", content_type)
    print("[POST-AUDIO] Bytes received:", len(file_bytes))

    if filename.endswith(".webm") or content_type == "audio/webm":
        try:
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"
            content_type = "audio/wav"
            print("[POST-AUDIO] Converted to WAV for OpenAI Whisper")
        except Exception as e:
            print("[POST-AUDIO] FFmpeg conversion failed:", e)
            raise HTTPException(status_code=400, detail="Failed to convert webm to wav")

    audio_io = io.BytesIO(file_bytes)
    audio_io.name = filename

    # -- LANGUAGE CHOICE STEP --
    if SESSION_STATE.get("expect_language_choice"):
        message_decoded = convert_audio_to_text(audio_io)
        print("[LANG CHOICE] Decoded:", message_decoded)
        lang = detect_lang_openai(message_decoded or "")
        print("[LANG CHOICE] Detected language:", lang)
        if lang not in ("en", "ar", "he"):
            lang = "en"
        SESSION_STATE["lang"] = lang
        SESSION_STATE["expect_language_choice"] = False

        # Queue and play correct language's intro (if available)
        intro_path = f"recordings/{lang}/intro.mp3"
        if not os.path.exists(intro_path):
            intro_path = "intro.mp3"
        if os.path.exists(intro_path):
            with open(intro_path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())
            print(f"[LANG CHOICE] Queued intro: {intro_path}")
        else:
            print(f"[LANG CHOICE] No {intro_path} found to queue.")
        return StreamingResponse(io.BytesIO(b""), status_code=204)

    # -- NORMAL FLOW --
    message_decoded = convert_audio_to_text(audio_io)
    print("[POST-AUDIO] Decoded:", message_decoded)

    if not message_decoded:
        print("[POST-AUDIO] No transcript. Rejecting.")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    # Always print detection step. Use lang from session unless missing.
    lang_detected = detect_lang_openai(message_decoded)
    session_lang = SESSION_STATE.get("lang")
    lang = session_lang or lang_detected
    print(f"[POST-AUDIO] Detected language: {lang_detected} | Session lang: {session_lang} | Will use: {lang}")

    lifted_index = SESSION_STATE.get("item_index")
    print("[POST-AUDIO] Item index for chat context:", lifted_index)

    chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
    print(f"[POST-AUDIO] GPT chat_response:\n{chat_response}")

    if not chat_response:
        print("[POST-AUDIO] AI failed to answer.")
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    print(f"[POST-AUDIO] TTS audio_output size = {len(audio_output) if audio_output else 0}")
    if not audio_output:
        print("[POST-AUDIO] TTS failed to synthesize audio.")
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    print("[POST-AUDIO] Streaming response OK.\n")
    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    print(f"[TTS-TEST] Synthesized for lang={lang}: size={len(audio) if audio else 0}")
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")"""



""" adding guards against missing files and cyclic items support """ 
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile
import threading
import traceback  # ensure at top of file or here


# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)


# ---- PROXIMITY/GONE/ITEM SESSION STATE ----
SESSION_STATE = {"active": False, "item_index": None}
ESP_AUDIO_QUEUE = []

# Items that should NOT use chat — instead play prerecorded looping sequence
# NOTE: keys are zero-based item_index (1 -> human "item 2", 3 -> human "item 4")
CYCLIC_ITEMS = {
    1: ["item_2.mp3", "item_2_1.mp3", "item_2_2.mp3"],  # item_index == 1 => item_2.*
    2: ["item_3.mp3", "item_3_1.mp3", "item_3_2.mp3"],  # item_index == 2 => item_3.*
}

# Keep track of where we are in the cycle (per process)
CYCLIC_INDEX = {k: 0 for k in CYCLIC_ITEMS.keys()}
CYCLIC_LOCK = threading.Lock()


def find_audio_file(filename: str):
    """"""Look in recordings/ first, then project root."""""""
    for p in (os.path.join("recordings", filename), filename):
        if os.path.exists(p):
            return p
    return None

"""
"""
@app.post("/esp-event")
async def esp_event(request: Request):
    """""""
    POST {"event_type": "proximity" | "item", "item_index": int (optional)}
    Returns local intro.mp3/item_X.mp3 and queues the bytes for frontend polling.
    """""""
    data = await request.json()
    event_type = data.get("event_type", "").lower()

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None
        audio_path = "intro.mp3"
        path_found = find_audio_file(os.path.basename(audio_path))
        if not path_found:
            raise HTTPException(status_code=404, detail="intro.mp3 not found")
        with open(path_found, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(path_found, media_type="audio/mpeg")

    elif event_type == "item":
        item_index = data.get("item_index")
        print("Item index received:", item_index)

        # Validate index first
        if item_index is None or item_index == -1 or not isinstance(item_index, int) or not (0 <= item_index <= 3):
            SESSION_STATE["item_index"] = None
            return {"status": "no_item"}

        # If cyclic item: serve next variant, update session, and queue the bytes
        if item_index in CYCLIC_ITEMS:
            with CYCLIC_LOCK:
                cur = CYCLIC_INDEX.get(item_index, 0)
                parts = CYCLIC_ITEMS[item_index]
                filename = parts[cur]
                # advance for next click
                CYCLIC_INDEX[item_index] = (cur + 1) % len(parts)

            filepath = find_audio_file(filename)
            if not filepath:
                print(f"[CYCLIC] Missing file for item {item_index}: {filename}")
                raise HTTPException(status_code=404, detail=f"Missing audio file: {filename}")

            # Update session state so post-audio can know which item is active
            SESSION_STATE["item_index"] = item_index

            with open(filepath, "rb") as f:
                audio_bytes = f.read()

            ESP_AUDIO_QUEUE.append(audio_bytes)
            print(f"[CYCLIC] Serving {filepath} for item_index={item_index}")
            return FileResponse(filepath, media_type="audio/mpeg")

        # Non-special item: default behavior (single file)
        SESSION_STATE["item_index"] = item_index
        audio_path = f"item_{item_index+1}.mp3"
        path_found = find_audio_file(os.path.basename(audio_path))
        if not path_found:
            raise HTTPException(status_code=404, detail=f"{audio_path} not found")
        with open(path_found, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(path_found, media_type="audio/mpeg")

    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")
""""""

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}


@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}


@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

"""""""
@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    print("SESSION_STATE at /post-audio:", SESSION_STATE)
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

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

    # If a cyclic item is active, skip transcription/chat (no AI)
    lifted_index = SESSION_STATE.get("item_index")
    if lifted_index in CYCLIC_ITEMS:
        print(f"[POST-AUDIO] Skipping chat because item_index {lifted_index} is cyclic-only.")
        # Option A: return empty 204 so the frontend ignores (keeps behavior simple)
        return StreamingResponse(io.BytesIO(b""), status_code=204)
        # Option B (friendlier): return a short TTS message explaining why chat is disabled:
        # msg = "This item uses prerecorded audio. Use the button to cycle the parts."
        # audio_bytes = convert_text_to_speech(msg, SESSION_STATE.get("lang", "en") or "en")
        # if not audio_bytes:
        #     return StreamingResponse(io.BytesIO(b""), status_code=204)
        # return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")

    # Transcribe and forward to chat as before
    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = detect_lang_openai(message_decoded)
    print("Item index received in chat _main :", lifted_index)

    chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")
"""
""""
@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")



# Replace esp_event and post_audio in main.py with these versions


@app.post("/esp-event")
async def esp_event(request: Request):
    """""""
    Defensive esp-event handler with detailed logging for debugging.
    POST {"event_type": "...", ...}
    """""""
    try:
        # Log raw request body (helps catch malformed or empty payloads)
        raw = await request.body()
        try:
            print("[ESP-EVENT] raw body bytes:", raw)
            print("[ESP-EVENT] raw body text:", raw.decode("utf-8", errors="replace"))
        except Exception:
            # safe fallback
            print("[ESP-EVENT] raw body (binary) length:", len(raw))

        # parse json safely
        try:
            data = await request.json()
        except Exception as e:
            print("[ESP-EVENT] failed to parse JSON:", e)
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")

        print("[ESP-EVENT] parsed JSON:", data)
        event_type = (data.get("event_type") or "").lower()

        if not event_type:
            print("[ESP-EVENT] Missing event_type key in JSON")
            raise HTTPException(status_code=400, detail="Missing event_type")

        # --- existing logic, unchanged but now logged ---
        if event_type == "proximity":
            if SESSION_STATE.get("active"):
                print("[ESP-EVENT] proximity ignored (already active)")
                return StreamingResponse(io.BytesIO(b""), status_code=204)
            SESSION_STATE["active"] = True
            SESSION_STATE["item_index"] = None
            audio_path = "intro.mp3"
            path_found = find_audio_file(os.path.basename(audio_path))
            if not path_found:
                print(f"[ESP-EVENT] intro missing at {audio_path}")
                raise HTTPException(status_code=404, detail="intro.mp3 not found")
            with open(path_found, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print("[ESP-EVENT] queued intro audio")
            return FileResponse(path_found, media_type="audio/mpeg")

        elif event_type == "item":
            item_index = data.get("item_index")
            print("[ESP-EVENT] Item index received:", item_index)

            # validate index
            if item_index is None or item_index == -1 or not isinstance(item_index, int) or not (0 <= item_index <= 3):
                SESSION_STATE["item_index"] = None
                print("[ESP-EVENT] item_index invalid or -1 -> no_item")
                return {"status": "no_item"}

            # cyclic handling or default item audio handled elsewhere in your file;
            # keep same behavior but add logs: (this block assumes CYCLIC handling is above or in the same handler)
            if item_index in CYCLIC_ITEMS:
                print(f"[ESP-EVENT] item_index {item_index} is CYCLIC")
                with CYCLIC_LOCK:
                    cur = CYCLIC_INDEX.get(item_index, 0)
                    parts = CYCLIC_ITEMS[item_index]
                    filename = parts[cur]
                    CYCLIC_INDEX[item_index] = (cur + 1) % len(parts)
                filepath = find_audio_file(filename)
                if not filepath:
                    print(f"[ESP-EVENT] Missing cyclic file: {filename}")
                    raise HTTPException(status_code=404, detail=f"Missing audio file: {filename}")
                SESSION_STATE["item_index"] = item_index
                with open(filepath, "rb") as f:
                    audio_bytes = f.read()
                ESP_AUDIO_QUEUE.append(audio_bytes)
                print(f"[ESP-EVENT] Queued cyclic file {filepath}")
                return FileResponse(filepath, media_type="audio/mpeg")

            # non-cyclic item
            SESSION_STATE["item_index"] = item_index
            audio_path = f"item_{item_index+1}.mp3"
            path_found = find_audio_file(os.path.basename(audio_path))
            if not path_found:
                print(f"[ESP-EVENT] item audio missing: {audio_path}")
                raise HTTPException(status_code=404, detail=f"{audio_path} not found")
            with open(path_found, "rb") as f:
                audio_bytes = f.read()
            ESP_AUDIO_QUEUE.append(audio_bytes)
            print(f"[ESP-EVENT] Queued item audio {path_found}")
            return FileResponse(path_found, media_type="audio/mpeg")

        else:
            print(f"[ESP-EVENT] Unknown event_type: {event_type}")
            raise HTTPException(status_code=400, detail=f"Invalid event_type: {event_type}")

    except HTTPException:
        # re-raise to preserve intended HTTP responses
        raise
    except Exception as e:
        print("[ESP-EVENT] Unhandled exception:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")


@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    """""""
    post-audio with defensive logging and step-by-step tracing of failures.
    """""""
    try:
        print("\n[POST-AUDIO] SESSION_STATE at start:", SESSION_STATE)
        try:
            file_bytes = await file.read()
        except Exception as e:
            print("[POST-AUDIO] failed to read uploaded file:", e)
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"Failed to read upload: {e}")

        filename = file.filename or "audio.webm"
        content_type = (file.content_type or "").lower()
        print(f"[POST-AUDIO] filename={filename} content_type={content_type} bytes={len(file_bytes)}")

        # convert webm -> wav if needed
        if filename.endswith(".webm") or content_type == "audio/webm":
            try:
                file_bytes = convert_webm_to_wav_bytes(file_bytes)
                filename = "converted.wav"
                content_type = "audio/wav"
                print("[POST-AUDIO] converted webm -> wav")
            except Exception as e:
                print("[POST-AUDIO] FFmpeg conversion failed:", e)
                traceback.print_exc()
                raise HTTPException(status_code=400, detail=f"Failed to convert webm to wav: {e}")

        audio_io = io.BytesIO(file_bytes)
        audio_io.name = filename

        # If cyclic item active skip chat
        lifted_index = SESSION_STATE.get("item_index")
        if lifted_index in CYCLIC_ITEMS:
            print(f"[POST-AUDIO] Skipping chat because item_index {lifted_index} is cyclic-only.")
            return StreamingResponse(io.BytesIO(b""), status_code=204)

        # Transcription
        try:
            message_decoded = convert_audio_to_text(audio_io)
            print("[POST-AUDIO] Decoded message:", message_decoded)
        except Exception as e:
            print("[POST-AUDIO] convert_audio_to_text failed:", e)
            traceback.print_exc()
            raise HTTPException(status_code=502, detail=f"Transcription error: {e}")

        if not message_decoded:
            print("[POST-AUDIO] Empty transcription result")
            raise HTTPException(status_code=400, detail="Failed to decode audio")

        # Language detection (guarded)
        try:
            lang = detect_lang_openai(message_decoded)
            print(f"[POST-AUDIO] detect_lang_openai -> {lang}")
        except Exception as e:
            print("[POST-AUDIO] detect_lang_openai error:", e)
            traceback.print_exc()
            lang = "en"

        print("Item index received in chat _main :", lifted_index)

        # Chat call
        try:
            chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
            print("[POST-AUDIO] chat_response length:", len(chat_response) if chat_response else 0)
            print("[POST-AUDIO] chat_response (preview):", (chat_response or "")[:400])
        except Exception as e:
            print("[POST-AUDIO] get_chat_response failed:", e)
            traceback.print_exc()
            raise HTTPException(status_code=502, detail=f"Chat error: {e}")

        if not chat_response:
            print("[POST-AUDIO] Empty chat response")
            raise HTTPException(status_code=502, detail="Empty chat response")

        # Persist messages
        try:
            store_messages(message_decoded, chat_response, lifted_index)
            print("[POST-AUDIO] Stored conversation to history")
        except Exception as e:
            print("[POST-AUDIO] store_messages failed:", e)
            traceback.print_exc()

        # TTS
        try:
            audio_output = convert_text_to_speech(chat_response, lang or "en")
            print("[POST-AUDIO] TTS output size:", len(audio_output) if audio_output else 0)
        except Exception as e:
            print("[POST-AUDIO] convert_text_to_speech failed:", e)
            traceback.print_exc()
            raise HTTPException(status_code=502, detail=f"TTS error: {e}")

        if not audio_output:
            print("[POST-AUDIO] TTS returned empty bytes")
            raise HTTPException(status_code=502, detail="Empty TTS bytes")

        def iterfile():
            yield audio_output

        print("[POST-AUDIO] Streaming audio response OK")
        return StreamingResponse(iterfile(), media_type="audio/mpeg")

    except HTTPException:
        raise
    except Exception as e:
        print("[POST-AUDIO] Unhandled exception:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

#CHAT DOESNT WORK FOR CYCLIC ITEMS - handled in post-audio above
""" 
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile
import threading
import traceback

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

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


def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            return wav_file.read()
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)


# ------------------------
# SESSION STATE
# ------------------------
SESSION_STATE = {"active": False, "item_index": None}
ESP_AUDIO_QUEUE = []

# CYCLIC ITEMS (indexes from Arduino)
CYCLIC_ITEMS = {
    1: ["item_2.mp3", "item_2_1.mp3", "item_2_2.mp3"],  # Arduino sends 1 → slot 2
    2: ["item_3.mp3", "item_3_1.mp3", "item_3_2.mp3"],  # Arduino sends 2 → slot 3
}

CYCLIC_INDEX = {k: 0 for k in CYCLIC_ITEMS}
CYCLIC_LOCK = threading.Lock()


def find_audio_file(filename):
    """#Look in /recordings first, then root
"""
    for path in (os.path.join("recordings", filename), filename):
        if os.path.exists(path):
            return path
    return None


# ------------------------
# ESP EVENT ENDPOINT
# ------------------------

@app.post("/esp-event")
async def esp_event(request: Request):
    try:
        data = await request.json()
        event_type = (data.get("event_type") or "").lower()
        print("[ESP-EVENT]", data)

        if event_type == "proximity":
            if SESSION_STATE["active"]:
                return StreamingResponse(io.BytesIO(b""), status_code=204)

            SESSION_STATE["active"] = True
            SESSION_STATE["item_index"] = None

            path = find_audio_file("intro.mp3")
            if not path:
                raise HTTPException(404, "intro.mp3 not found")

            with open(path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())

            return FileResponse(path, media_type="audio/mpeg")

        elif event_type == "item":
            item_index = data.get("item_index")
            print("[ESP-EVENT] item_index =", item_index)

            # INVALID INDEX
            if (
                item_index is None or
                item_index == -1 or
                not isinstance(item_index, int) or
                not (0 <= item_index <= 3)
            ):
                SESSION_STATE["item_index"] = None
                return {"status": "no_item"}

            # ------------------------
            # CYCLIC ITEM (MAIN FIX!!!)
            # ------------------------
            if item_index in CYCLIC_ITEMS:
                print("[ESP-EVENT] CYCLIC ITEM DETECTED", item_index)

                with CYCLIC_LOCK:
                    cur = CYCLIC_INDEX[item_index]
                    filename = CYCLIC_ITEMS[item_index][cur]
                    CYCLIC_INDEX[item_index] = (cur + 1) % len(CYCLIC_ITEMS[item_index])

                path = find_audio_file(filename)
                if not path:
                    raise HTTPException(404, f"{filename} missing")

                SESSION_STATE["item_index"] = item_index

                with open(path, "rb") as f:
                    ESP_AUDIO_QUEUE.append(f.read())

                return FileResponse(path, media_type="audio/mpeg")

            # ------------------------
            # NORMAL NON-CYCLIC ITEM
            # ------------------------
            SESSION_STATE["item_index"] = item_index

            filename = f"item_{item_index + 1}.mp3"
            path = find_audio_file(filename)

            if not path:
                raise HTTPException(404, f"{filename} missing")

            with open(path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())

            return FileResponse(path, media_type="audio/mpeg")

        else:
            raise HTTPException(400, "Invalid event_type")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Server error: {e}")


# ------------------------
# POST-AUDIO ENDPOINT
# ------------------------

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    try:
        print("\n[POST-AUDIO] SESSION =", SESSION_STATE)

        # CYCLIC CHECK — BLOCK CHAT
        lifted = SESSION_STATE["item_index"]
        if lifted in CYCLIC_ITEMS:
            print("[POST-AUDIO] CHAT BLOCKED — CYCLIC ITEM")
            return StreamingResponse(io.BytesIO(b""), status_code=204)

        # Read bytes
        file_bytes = await file.read()
        filename = file.filename or "audio.webm"

        # Convert webm→wav
        if filename.endswith(".webm"):
            file_bytes = convert_webm_to_wav_bytes(file_bytes)
            filename = "converted.wav"

        audio_io = io.BytesIO(file_bytes)
        audio_io.name = filename

        # Whisper
        text = convert_audio_to_text(audio_io)
        print("[POST-AUDIO] Transcribed:", text)

        if not text:
            raise HTTPException(400, "Failed to decode audio")

        # Detect language
        lang = detect_lang_openai(text)

        # GPT
        reply = get_chat_response(text, lifted_index=lifted)
        print("[POST-AUDIO] GPT reply:", reply)

        store_messages(text, reply, lifted)

        # TTS
        audio_out = convert_text_to_speech(reply, lang or "en")

        return StreamingResponse(io.BytesIO(audio_out), media_type="audio/mpeg")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Server error: {e}")


# ------------------------
# OTHER ROUTES
# ------------------------

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        return StreamingResponse(io.BytesIO(ESP_AUDIO_QUEUE.pop(0)), media_type="audio/mpeg")
    return {"status": "no_event"}


@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "reset"}


@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")"""




"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io, os, subprocess, tempfile, threading
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(webm_bytes)
        f.flush()
        wav_path = f.name.replace(".webm", ".wav")
    subprocess.run([
        "ffmpeg", "-y", "-i", f.name, "-ar", "16000", "-ac", "1", wav_path
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with open(wav_path, "rb") as w:
        audio = w.read()
    os.remove(f.name)
    os.remove(wav_path)
    return audio


# -------------------------------
# STATE
# -------------------------------
SESSION_STATE = {"active": False, "item_index": None}
ESP_AUDIO_QUEUE = []

# ⭐ CYCLIC ITEMS (index from Arduino)
CYCLIC_ITEMS = {
    1: ["item_2.mp3", "item_2_1.mp3", "item_2_2.mp3"],  # item 2
    2: ["item_3.mp3", "item_3_1.mp3", "item_3_2.mp3"],  # item 3
}

CYCLIC_INDEX = {k: 0 for k in CYCLIC_ITEMS}
LOCK = threading.Lock()


def find_audio(name):
    if os.path.exists(f"recordings/{name}"):
        return f"recordings/{name}"
    if os.path.exists(name):
        return name
    return None


# -------------------------------
# ESP-EVENT
# -------------------------------
@app.post("/esp-event")
async def esp_event(request: Request):
    data = await request.json()
    event_type = data.get("event_type", "").lower()

    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)

        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None

        path = find_audio("intro.mp3")
        with open(path, "rb") as f:
            ESP_AUDIO_QUEUE.append(f.read())
        return FileResponse(path, media_type="audio/mpeg")

    elif event_type == "item":
        idx = data.get("item_index")

        if idx is None or idx == -1 or not (0 <= idx <= 3):
            SESSION_STATE["item_index"] = None
            return {"status": "no_item"}

        # ⭐ CYCLIC item
        if idx in CYCLIC_ITEMS:
            with LOCK:
                part_index = CYCLIC_INDEX[idx]
                filename = CYCLIC_ITEMS[idx][part_index]
                CYCLIC_INDEX[idx] = (part_index + 1) % len(CYCLIC_ITEMS[idx])

            path = find_audio(filename)
            SESSION_STATE["item_index"] = idx

            with open(path, "rb") as f:
                ESP_AUDIO_QUEUE.append(f.read())

            return FileResponse(path, media_type="audio/mpeg")

        # ⭐ NON-CYCLIC item → play item_X.mp3
        filename = f"item_{idx+1}.mp3"
        path = find_audio(filename)
        SESSION_STATE["item_index"] = idx

        with open(path, "rb") as f:
            ESP_AUDIO_QUEUE.append(f.read())
        return FileResponse(path, media_type="audio/mpeg")

    else:
        raise HTTPException(400, "Invalid event_type")


# -------------------------------
# POLLING ENDPOINT
# -------------------------------
@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        return StreamingResponse(io.BytesIO(ESP_AUDIO_QUEUE.pop(0)), media_type="audio/mpeg")
    return {"status": "no_event"}


# -------------------------------
# POST-AUDIO (chat)
# -------------------------------
@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    idx = SESSION_STATE["item_index"]

    # ⭐ If item is cyclic → block chat entirely
    if idx in CYCLIC_ITEMS:
        print("CHAT BLOCKED — CYCLIC ITEM")
        return StreamingResponse(io.BytesIO(b""), status_code=204)

    # Otherwise: FULL CHAT PIPELINE
    file_bytes = await file.read()
    if file.filename.endswith(".webm"):
        file_bytes = convert_webm_to_wav_bytes(file_bytes)

    audio_io = io.BytesIO(file_bytes)
    audio_io.name = "audio.wav"

    text = convert_audio_to_text(audio_io)
    lang = detect_lang_openai(text)

    reply = get_chat_response(text, lifted_index=idx)
    store_messages(text, reply, idx)

    audio_out = convert_text_to_speech(reply, lang or "en")
    return StreamingResponse(io.BytesIO(audio_out), media_type="audio/mpeg")"""


""" works 100% without cyclic items """

"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import subprocess
import tempfile

# Import your custom functions
from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages
from functions.lang_detect import detect_lang_openai
from functions.text_to_speach import convert_text_to_speech
from functions.test import convert_text_to_speech2

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Add your LAN IP if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_bytes)
        webm_file.flush()
        wav_path = webm_file.name.replace(".webm", ".wav")
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", webm_file.name,
            "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with open(wav_path, "rb") as wav_file:
            wav_bytes = wav_file.read()
        return wav_bytes
    finally:
        os.remove(webm_file.name)
        if os.path.exists(wav_path):
            os.remove(wav_path)




# ---- PROXIMITY/GONE/ITEM SESSION STATE ----
SESSION_STATE = {"active": False, "item_index": None}   # CHANGES HERE: add item_index state
ESP_AUDIO_QUEUE = []





@app.post("/esp-event")
async def esp_event(request: Request):
    """ 
    #POST {"event_type": "proximity" | "item", "item_index": int (optional)}
    #Returns your local intro.mp3/outro.mp3/item_X.mp3 and queues the bytes for frontend polling.
    # 
    # "" 
"""
    data = await request.json()
    event_type = data.get("event_type", "").lower()
    if event_type == "proximity":
        if SESSION_STATE["active"]:
            return StreamingResponse(io.BytesIO(b""), status_code=204)
        SESSION_STATE["active"] = True
        SESSION_STATE["item_index"] = None  # Reset on new item
        audio_path = "intro.mp3"
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="intro.mp3 not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    
    #elif event_type == "gone":
    #    if not SESSION_STATE["active"]:
    #        return StreamingResponse(io.BytesIO(b""), status_code=204)
    #    SESSION_STATE["active"] = False
    #    SESSION_STATE["item_index"] = None
    #    audio_path = "outro.mp3"
    #    if not os.path.exists(audio_path):
    #        raise HTTPException(status_code=404, detail="outro.mp3 not found")
    #    with open(audio_path, "rb") as f:
    #        audio_bytes = f.read()
    #    ESP_AUDIO_QUEUE.append(audio_bytes)
    #    return FileResponse(audio_path, media_type="audio/mpeg")
    elif event_type == "item":
        item_index = data.get("item_index")
        print("Item index received:", item_index)
        # Accept None, -1, or invalid index as "no item lifted"
        if item_index is None or item_index == -1 or not isinstance(item_index, int) or not (0 <= item_index <= 3):
            SESSION_STATE["item_index"] = None
            return {"status": "no_item"}
        SESSION_STATE["item_index"] = item_index
        audio_path = f"item_{item_index+1}.mp3"  # Files: item_1.mp3, item_2.mp3, etc.
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail=f"{audio_path} not found")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        ESP_AUDIO_QUEUE.append(audio_bytes)
        return FileResponse(audio_path, media_type="audio/mpeg")
    else:
        raise HTTPException(status_code=400, detail="Invalid event_type")

@app.get("/get-latest-esp-audio")
async def get_latest_esp_audio():
    if ESP_AUDIO_QUEUE:
        audio = ESP_AUDIO_QUEUE.pop(0)
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    else:
        return {"status": "no_event"}

@app.get("/Status_of_women")
async def check_status():
    return {"message": "women status in israel"}

@app.get("/reset")
async def reset_conversation():
    reset_messages()
    return {"messages": "conversation reset"}

@app.post("/post-audio")
async def post_audio(file: UploadFile = File(...)):
    print("SESSION_STATE at /post-audio:", SESSION_STATE)
    file_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = (file.content_type or "").lower()

    print("Upload filename:", filename)
    print("Upload content_type:", content_type)
    print("Bytes received:", len(file_bytes))

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

    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)

    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = detect_lang_openai(message_decoded)
    lifted_index = SESSION_STATE.get("item_index")  # Pass item context!
    print("Item index received in chat _main :", lifted_index)

    chat_response = get_chat_response(message_decoded, lifted_index=lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")

    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")

@app.get("/tts-test")
async def tts_test(lang: str = "en"):
    audio = convert_text_to_speech2("Hello from the museum!", lang)
    if not audio:
        raise HTTPException(status_code=502, detail="Empty TTS bytes")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")"""

""" works without cyclic items, but chat is not fast when ai. """
"""from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import io, os, subprocess, tempfile, threading

from functions.openAI_requests import convert_audio_to_text, get_chat_response
from functions.database import store_messages, reset_messages, _append_jsonl, _now_iso, LOG_FILE, AI_ENABLED_ITEMS

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
    # Add your LAN IP if needed
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
def find_audio(name):
    if os.path.exists(name):
        return name
    raise HTTPException(404, f"{name} not found")

def convert_webm_to_wav_bytes(webm_bytes):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(webm_bytes)
        f.flush()
        wav_path = f.name.replace(".webm", ".wav")

    subprocess.run([
        "ffmpeg", "-y", "-i", f.name, "-ar", "16000", "-ac", "1", wav_path
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    with open(wav_path, "rb") as w:
        audio = w.read()

    os.remove(f.name)
    os.remove(wav_path)
    return audio

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

        # Return = -1, None/missing, non-int, or out of range
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

            # ✅ only confirm return if we previously had an item
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

    message_decoded = convert_audio_to_text(audio_io)
    print("Decoded message:", message_decoded)



    if not message_decoded:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode audio. File received: {filename}, Content type: {content_type}"
        )

    lang = detect_lang_openai(message_decoded)

    lifted_index = SESSION_STATE.get("item_index")  # Pass item context!
    print("Item index received in chat _main :", {lifted_index})

    chat_response = get_chat_response(message_decoded, lifted_index)
    if not chat_response:
        raise HTTPException(status_code=400, detail="failed to get chat response.")

    store_messages(message_decoded, chat_response, lifted_index)

    audio_output = convert_text_to_speech(chat_response, lang or "en")
    
    if not audio_output:
        raise HTTPException(status_code=400, detail="failed to get 11 labs audio response.")
    
    def iterfile():
        yield audio_output

    return StreamingResponse(iterfile(), media_type="audio/mpeg")


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

    """

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

            # ✅ only confirm return if we previously had an item
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




    
