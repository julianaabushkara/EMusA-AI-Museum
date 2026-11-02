import requests
from decouple import config

# =========================
# API KEYS
# =========================
NARAKEET_API_KEY = config("NARAKEET_API_KEY")
ELEVENLABS_API_KEY = config("ELEVENLABS_API_KEY")

# =========================
# ELEVENLABS CONFIG
# =========================
# English / Arabic voice (Jessica)
VOICE_EN_AR = "cgSgspJ2msm6clMCkdW9"
MODEL_EN_AR = "eleven_multilingual_v2"

ELEVEN_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"

ELEVEN_HEADERS = {
    "xi-api-key": ELEVENLABS_API_KEY,
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
}

# =========================
# NARAKEET CONFIG (HEBREW)
# =========================
# Voice from UI: Ayelet (Female)
NARAKEET_VOICE_HE = "ayelet"

# You can change mp3 → m4a or wav if you want
NARAKEET_BASE_URL = "https://api.narakeet.com/text-to-speech/mp3"

NARAKEET_HEADERS = {
    "Accept": "application/octet-stream",
    "Content-Type": "text/plain",
    "x-api-key": NARAKEET_API_KEY,
}

# =========================
# MAIN TTS FUNCTION
# =========================
def convert_text_to_speech(message: str, lang: str = "en") -> bytes:
    """
    Hybrid Text-to-Speech
    ---------------------
    Hebrew  -> Narakeet (Ayelet)
    English / Arabic -> ElevenLabs

    lang: 'he' | 'en' | 'ar'
    returns: raw MP3 bytes
    """

    text = (message or "").strip()
    if not text:
        text = "I didn’t catch that."

    # =========================
    # 🇮🇱 HEBREW → NARAKEET
    # =========================
    if lang == "he":
        try:
            url = (
                f"{NARAKEET_BASE_URL}"
                f"?voice={NARAKEET_VOICE_HE}"
                f"&voice-speed=normal"
                f"&voice-volume=standard"
            )

            resp = requests.post(
                url,
                headers=NARAKEET_HEADERS,
                data=text.encode("utf-8"),
                timeout=30,
            )

            if resp.status_code == 200 and resp.content:
                return resp.content

            print(f"[Narakeet] Error {resp.status_code}: {resp.text}")
            return b""

        except Exception as e:
            print(f"[Narakeet] Request failed: {e}")
            return b""

    # =========================
    # 🌍 ENGLISH / ARABIC → ELEVENLABS
    # =========================
    body = {
        "text": text,
        "model_id": MODEL_EN_AR,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.7,
        },
    }

    try:
        endpoint = f"{ELEVEN_BASE_URL}/{VOICE_EN_AR}"

        resp = requests.post(
            endpoint,
            headers=ELEVEN_HEADERS,
            json=body,
        )

        if resp.status_code == 200 and resp.content:
            return resp.content

        print(f"[ElevenLabs] Error {resp.status_code}: {resp.text}")
        return b""

    except Exception as e:
        print(f"[ElevenLabs] Request failed: {e}")
        return b""


    #    return response.content
    #else:
    #    print(f"ElevenLabs API error: {response.status_code} - {response.text}")
    #    return"""
