# utils/lang_detect_openai.py
from openai import OpenAI
from decouple import config

import os

# reads OPENAI_API_KEY from env
# Initialize OpenAI client with API key and organization
client = OpenAI(
    api_key=config("OPENAI_API_KEY"),
    organization=config("OPENAI_ORG")
)


def detect_lang_openai(text: str) -> str:
    """
    Classify text language using OpenAI (v1).
    Returns 'en', 'ar', or 'he' (default 'en' on uncertainty).
    """
    txt = (text or "").strip()
    if not txt:
        return "en"

    prompt = (
        "Detect the language of this text and reply with ONLY one code: "
        "'en' (English), 'ar' (Arabic), or 'he' (Hebrew).\n\n"
        f"Text: {txt}"
    )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    code = (resp.choices[0].message.content or "").strip().lower()
    return code if code in {"en", "ar", "he"} else "en"
