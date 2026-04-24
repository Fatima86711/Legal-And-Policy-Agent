# models/request_models.py

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="The user's legal query string.",
        examples=["What are the GDPR penalties for data breaches?"],
    )