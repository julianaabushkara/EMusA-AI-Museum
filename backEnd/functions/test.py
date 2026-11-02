import requests
from decouple import config

ELEVENLABS_API_KEY = config("ELEVENLABS_API_KEY")

VOICE_EN_AR = "XjLkpWUlnhS8i7gGz3lZ"   #  English/Arabic voice
VOICE_HE    = "MZkjbmkNIkbwx6XxWja6"   # ELI- Hebrew voice

# Optional: choose models per language (you said Hebrew may be different)
MODEL_EN_AR = "eleven_multilingual_v2"  # or v2 if you prefer
MODEL_HE    = "eleven_v3"  

BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"

HEADERS = {
    "xi-api-key": ELEVENLABS_API_KEY,
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
}

def convert_text_to_speech2(message: str, lang: str = "en") -> bytes:
    """
    message: text to synthesize
    lang: 'en' | 'ar' | 'he'
    returns raw MP3 bytes
    """
    text = (message or "").strip()
    if not text:
        text = "I didn’t catch that. Please try again."

    if lang == "he":
        voice_id = VOICE_HE
        model_id = MODEL_HE
    else:
        # default bucket for English + Arabic
        voice_id = VOICE_EN_AR
        model_id = MODEL_EN_AR

    body = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8,
            # v3 accepts these too; safe to omit if unsure:
            #"style": 0.5,-> worked not sure 
            # "use_speaker_boost": True -> not checked
        },
    }

    endpoint = f"{BASE_URL}/{voice_id}"
    try:
        resp = requests.post(endpoint, headers=HEADERS, json=body, timeout=60)
    except Exception as e:
        print(f"[TTS] Request error: {e}")
        return b""

    if resp.status_code == 200:
        if not resp.content:
            print("[TTS] Warning: empty audio content")
        return resp.content
    else:
        print(f"[TTS] ElevenLabs error {resp.status_code}: {resp.text}")
        return b""
