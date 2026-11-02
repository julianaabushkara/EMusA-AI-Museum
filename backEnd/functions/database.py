import json
import os, tempfile
from typing import Optional, List, Dict, Any
import random

from datetime import datetime
from zoneinfo import ZoneInfo


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backEnd/
LOG_FILE = os.path.join(BASE_DIR, "interaction_log.jsonl")

print("LOG PATH =", os.path.abspath(LOG_FILE))
TZ = ZoneInfo("Asia/Jerusalem")
# Create file if it doesn't exist
if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("")


FILE_NAME = "stored_data.json"

# Object Descriptions Dictionary (make sure these are filled in with your actual descriptions)
OBJECT_DESCRIPTIONS = {
    0: """**Kohl Vessel**  
A finely crafted glass vessel used to store kohl (cosmetics).
It consists of two tubes joined together, wrapped with a glass thread forming a wavy decorative pattern. 
Although parts of the decoration are missing, the delicate craftsmanship shows the high value of its contents. 
Often paired with a thin metal stick to extract oils and pigments from within. This vessel reflects the importance of beauty practices and women’s status in Byzantine society.""",

    1: """hidden artifact description""",

    2: """hidden artifact description""",

    3: """**Nike Figurine**  
(Roman period, 63 BCE–320 CE) — A terracotta figurine of Nike (Greek goddess of victory; Victoria in Roman tradition). 
She wears a chiton with many folds, a halo or crown on her head, and wings spread wide. 
She leans on a column with her left wrist, touching her right shoulder with her right hand. 
Beside her stands Eros (Cupid), nude with outstretched wings, holding the crown of victory. Nike symbolized divine support for triumph and was revered for siding with Zeus against the Titans. 
Her presence beside Zeus at Olympia reinforced her role as the goddess who grants victory to mortals and gods alike."""
}

AI_ENABLED_ITEMS = {0, 3}

AI_OBJECT_DESCRIPTIONS = {
    k: v for k, v in OBJECT_DESCRIPTIONS.items()
    if k in AI_ENABLED_ITEMS
}


# Store the last lifted index to reset history if the item changes
LAST_LIFTED_INDEX = None

def reset_messages() -> None:
    _atomic_write_json(FILE_NAME, [])

def get_recent_messages(lifted_index: Optional[int] = None):
    global LAST_LIFTED_INDEX
    print("in database lifted_index= ", lifted_index)

    # Reset history if the lifted item changes
    if lifted_index is not None and lifted_index != LAST_LIFTED_INDEX:
        reset_messages()
    LAST_LIFTED_INDEX = lifted_index

    file_name = FILE_NAME
    learn_instruction = {
    "role": "system",
    "content": """
You are an AI museum assistant named Musea built to support blind and visually impaired visitors.  
Your responses should also serve all visitors, regardless of ability.

Your role is to answer voice-recorded visitor questions in a clear, calm, and supportive manner, based on their interaction with physical museum items and general historical knowledge.

Speak slowly and clearly. Use short sentences (1–3 per response). Never invent facts.

Use the description of the lifted object as your **main source** when answering object-specific questions
You may also use **general historical, cultural, or contextual knowledge** if relevant and accurate with preference for regional relevance.
If unsure or data is missing, say politely:
> “I don’t have enough information about that, but we can explore something else.”
---

###  Object Detection

You will receive a single value called `lifted_index`. This represents the object currently being held:

0 → Kohl Vessel  
3 → Nike Figurine  


If `lifted_index = None`, and the visiter asks about "what am i holding in my hand?", say:

> “I’m not detecting an item right now. Please place it down and move on to the next item for now to reboot the conversation we can come back to it later.”

If the visitor asks **how to use the stand**, say:

“To use the stand, lift one object at a time. I will recognize it and describe what you're holding. If it's an AI-supported object, you can ask me questions. If it's not, pressing the button will play pre-recorded explanations.”
When an object is lifted, assume deterministically that **this is the item currently in the visitor’s hand**. Use its description .

---

###  Visitor Intent Examples

Visitors may ask:

1. “What is this?” → Use the description of the lifted item to describe it.  
2. “What do women have to do with this object?” → Describe how it connects to women’s roles , If the answer is not found in the object description, respond briefly with known historical context. If unknown, politely say you don’t have enough information.
3. “Who is Nike?” → Allowed.  
4. “Can you speak in Hebrew/Arabic/English?” → Say: “Yes, I can speak in Hebrew/Arabic/English. Please start speaking.”  
5. “Tell me about women in Roman society.” → Allowed. Prefer regional context.  
6. “What were women’s roles in ancient times?” → Allowed. Provide a short, factual summary.  
7. “Tell me about women in Roman/Byzantine society” → Allowed
---

###  Language and Voice

- Detect and respond in the visitor’s language: Arabic, Hebrew, or English.  
- If uncertain, default to simple English.

---

###  Optional Ending Behavior

- A fact about the current status of women today related to the object’s context If the answer is not found in the object description, respond briefly with known historical context.
  *e.g., “Today, many textile workers around the world are still women—especially in developing countries.”*

---

Be warm, patient, and factual.  
Support natural exploration and allow curiosity.  
Never guess. Prioritize clarity and accessibility.
"""
}



    print("in database lifted_index 2", lifted_index)

    # --- Inject explicit context if an item is lifted ---
    if lifted_index is not None and lifted_index in AI_OBJECT_DESCRIPTIONS:
        current_description = OBJECT_DESCRIPTIONS.get(lifted_index, "")
        learn_instruction["content"] += f"""

---
IMPORTANT CONTEXT UPDATE:
⚠️ The visitor is currently holding **item #{lifted_index}**.
Use this object's description to describe it when responding to questions like “What is this?” or “What am I holding?”.

For general historical or cultural questions, you may use your broader knowledge—just keep it factual and regionally relevant.

{current_description}

"""

    messages = [learn_instruction]
    try:
        prior = _safe_load_history(file_name)
        if prior:
            messages.extend(prior[-5:] if len(prior) > 5 else prior)
    except Exception as e:
        print(e)
    return messages

def store_messages(request_message, response, lifted_index: Optional[int] = None):
    prior = get_recent_messages(lifted_index)[1:]  # drop system
    prior.append({"role": "user", "content": request_message})
    prior.append({"role": "assistant", "content": response})
    _atomic_write_json(FILE_NAME, prior)
    
    _append_jsonl(LOG_FILE, {
        "ts": _now_iso(),
        "type": "chat",
        "lifted_index": lifted_index,
        "chat_enabled": (lifted_index in AI_ENABLED_ITEMS),
        "user": request_message,
        "assistant": response,
        
    })

def _atomic_write_json(path: str, data: List[Dict[str, Any]]) -> None:
    dir_ = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=dir_, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
        

def log_pipeline(
    lifted_index,
    stt,
    gpt,
    lang,
    tts,
    total,
    input_text,
    output_text,
    language,
):
    _append_jsonl(LOG_FILE, {
        "ts": _now_iso(),
        "type": "pipeline",
        "lifted_index": lifted_index,
        "stt_sec": round(stt, 3),
        "gpt_sec": round(gpt, 3),
        "lang_sec": round(lang, 3),
        "tts_sec": round(tts, 3),
        "total_sec": round(total, 3),
        "input_text": input_text,
        "output_text": output_text,
        "input_chars": len(input_text),
        "output_chars": len(output_text),
        "language": language
    })


def _append_jsonl(path: str, obj: Dict[str, Any]) -> None:
    # one JSON object per line (safe + easy to stream / analyze)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def _now_iso() -> str:
    return datetime.now(TZ).isoformat(timespec="seconds")

def _safe_load_history(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        return []
    try:
        if os.path.getsize(path) == 0:
            return []
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return [m for m in data if m.get("role") in ("user", "assistant")]
    except Exception as e:
        print("history load error, using []:", e)
        return []