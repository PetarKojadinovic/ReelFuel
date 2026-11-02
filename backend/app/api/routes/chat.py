import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.models.database import get_db, ChatMessage
from app.services.chat_service import send_message

log = logging.getLogger("chat")
router = APIRouter()


class ChatRequest(BaseModel):
    message: str


@router.post("/")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        reply = send_message(request.message, db)
        return {"reply": reply}
    except Exception:
        log.exception("Greska u chat")
        raise HTTPException(status_code=500, detail="Asistent trenutno ne može da odgovori. Pokušaj ponovo.")


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).order_by(ChatMessage.id.asc()).all()
    return {
        "messages": [
            {"role": m.role, "content": m.content} for m in messages
        ]
    }