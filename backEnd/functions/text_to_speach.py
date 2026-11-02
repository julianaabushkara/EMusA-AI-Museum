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


"""import requests
import os
from decouple import config
from fastapi.responses import Response, JSONResponse

NARAKEET_KEY = os.getenv("NARAKEET_API_KEY")
ELEVENLABS_API_KEY = config("ELEVENLABS_API_KEY")


#define the voices 
# English/Arabic voice -> jessica
VOICE_EN_AR = "cgSgspJ2msm6clMCkdW9"  
#Hebrew voice -> eli _ created by us MZkjbmkNIkbwx6XxWja6
VOICE_HE    = "ibf8bbzBgp54FKlAlsKF" #maria  




# Optional: choose models per language 
#v2 model is the best for arabic and english 
MODEL_EN_AR = "eleven_multilingual_v2"  
#only v3 deals with hebrew 
MODEL_HE    = "eleven_v3" 



BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"

HEADERS = {
    "xi-api-key": ELEVENLABS_API_KEY,
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
}


def convert_text_to_speech(message: str, lang: str = "en") -> bytes:
    """
    #message: text to synthesize
    #lang: 'en' | 'ar' | 'he'
    #returns raw MP3 bytes
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
            "similarity_boost": 0.7,
            # v3 accepts these too; safe to omit if unsure:
            #"style": 0.6,#-> worked not sure 
            #"use_speaker_boost": True #-> not checked
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



##eleven labs 
#convert to speach 
#def convert_text_to_speech(message, lang= "eng"):

    #define data body 
    #body={
    #    "text":message ,
    #    "model_id": "eleven_multilingual_v2",
    #    "voice_settings":{
    #        "stability": 0.5,
    #        "similarity_boost": 0.8,
    #    }
    #}


    #define voices
    #david castlemore
    #voice_eng_arabic="XjLkpWUlnhS8i7gGz3lZ"
    #eli voice_ created
    #voice_id_hebrew="MZkjbmkNIkbwx6XxWja6"
 




    #constructing headers and endpoint
    #headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", "accept": "audio/mpeg"}

    #if lang == "eng" or lang == "ar":
    #    endpoint = f"https://elevenlabs.io/v1/text-to-speech/{voice_eng_arabic}"
    #else:
        #define data body for v3 model 
    #    body = {
    #        "model_id": "eleven_multilingual_v3",
    #        "text": message,
    #        "voice_settings": {
    #            "stability": 0.5,
    #     }
    #    }
    #    endpoint = f"https://elevenlabs.io/v1/text-to-speech/{voice_id_hebrew}"



    #send request 
    #try:
    #    response = requests.post(endpoint, json=body, headers=headers)
    #except Exception as e: 
    #    print(f"Request error: {e}")
    #    return 

    #handle Response 
    #if response.status_code == 200:
    #    if not response.content:
    #        print("Warning: Received empty audio content from ElevenLabs API.")
    #    return response.content
    #else:
    #    print(f"ElevenLabs API error: {response.status_code} - {response.text}")
    #    return"""