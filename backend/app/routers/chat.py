from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import ChatMessageIn, ChatMessageOut

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message", response_model=ChatMessageOut)
def send_message(payload: ChatMessageIn, current_user: User = Depends(get_current_user)):
    mode_label = {
        "competitors": "Анализ конкурентов",
        "market": "Анализ рынка",
    }.get(payload.mode or "", "Чат")
    reply = (
        f"[{mode_label}] Заглушка ответа для {current_user.email}.\n"
        f"Вы написали: {payload.message}"
    )
    return ChatMessageOut(reply=reply)
