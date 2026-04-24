# models/response_models.py

from pydantic import BaseModel
from typing import Optional


class ChatResponse(BaseModel):
    query: str
    response: str
    task_type: str
    sources: list[str]
    chunks_used: int
    top_score: float
    avg_score: float
    used_fallback: bool
    is_valid: bool
    warnings: list[str]
    error: Optional[str]
    processing_time_ms: float