import io
import json
from typing import Any

import edge_tts
import groq
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings

TTS_VOICE = "en-US-JennyNeural"

router = APIRouter(prefix="/voice", tags=["voice"])


class ExtractRequest(BaseModel):
    transcription: str
    field_key: str
    field_type: str
    field_label: str
    options: list[str] | None = None
    current_value: str | list[str] | None = None


class TtsRequest(BaseModel):
    text: str


def _parse_llm_json(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)) -> dict[str, str]:
    settings = get_settings()
    api_key = settings.require_groq()
    client = groq.Groq(api_key=api_key)
    audio_bytes = await audio.read()
    filename = audio.filename or "audio.webm"

    try:
        transcription = client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3",
            response_format="text",
        )
        return {"text": str(transcription).strip()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/extract")
async def extract_field(req: ExtractRequest) -> dict[str, Any]:
    settings = get_settings()
    api_key = settings.require_groq()
    client = groq.Groq(api_key=api_key)

    options_str = json.dumps(req.options) if req.options else "any value"

    prompt = f"""Extract the agent's answer from their spoken transcription.

Field: {req.field_label}
Field type: {req.field_type}
Valid options: {options_str}
Agent said: "{req.transcription}"

Rules:
- multiselect: return array of matching option strings exactly as listed
- select/radio/yes_no: return single matching option string exactly as listed
- text: return the spoken value as a string
- number: return numeric value as string (strip $ and commas)
- currency: return numeric value as string (strip $ and commas)
- date: return ISO format YYYY-MM-DD
- Match options case-insensitively and by partial/synonym match
- "none", "not applicable", "n/a", "no" for a yes_no field = return "No"
- "yes", "yeah", "yep" for a yes_no field = return "Yes"
- If answer is unclear set confident=false and write a clarification question
- NEVER invent options not in the valid options list

Return ONLY this JSON, nothing else:
{{"value": <extracted value>, "confident": true or false, "clarification_needed": null or "question string"}}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200,
        )
        content = response.choices[0].message.content or ""
        return _parse_llm_json(content)
    except Exception:
        return {
            "value": None,
            "confident": False,
            "clarification_needed": "Sorry, I didn't catch that. Could you repeat?",
        }


@router.post("/tts")
async def text_to_speech(req: TtsRequest) -> StreamingResponse:
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        communicate = edge_tts.Communicate(
            text=req.text.strip(),
            voice=TTS_VOICE,
            rate="+0%",
            volume="+0%",
            pitch="+0Hz",
        )

        audio_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()

        if not audio_bytes:
            raise RuntimeError("No audio generated")

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache",
                "Content-Length": str(len(audio_bytes)),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"TTS generation failed: {str(exc)}",
        ) from exc
