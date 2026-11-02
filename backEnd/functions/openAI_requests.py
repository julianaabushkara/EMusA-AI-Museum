from decouple import config
from openai import OpenAI
from typing import IO, Optional, Union
import os
import json
import tempfile, os, traceback
import random
#import custom instructions
from functions.database import get_recent_messages


# Initialize OpenAI client with API key and organization
client = OpenAI(
    api_key=config("OPENAI_API_KEY"),
    organization=config("OPENAI_ORG")
)


# OPENAI - WHISPER
# CONVERT AUDIO TO TEXT
def convert_audio_to_text(audio_file: Union[str, IO[bytes]]):
    try:
        transcript = client.audio.transcriptions.create(
            #model="gpt-4o-mini-transcribe",
            model="whisper-1",
            #model="gpt-4o-mini-tts",   # NEW speech-to-text model
            file=audio_file
        )
        message_text = transcript.text
        return message_text
    except Exception as e: 
        print("Whisper error:", e)
        raise  # <-- This will show the actual error in your FastAPI logs


def get_chat_response(message_input, lifted_index: Optional[int] = None):  # CHANGES HERE: add lifted_index param
    messages = get_recent_messages(lifted_index=lifted_index)
    user_message = {"role": "user", "content": message_input}
    messages.append(user_message)
    try: 
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
        )
        messages_text = resp.choices[0].message.content
        return messages_text
    except Exception as e:
        print(e)
        return
