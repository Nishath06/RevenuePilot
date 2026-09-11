from datetime import datetime, timezone
from typing import Dict, Any
from beanie import Document, Indexed
from pydantic import Field

class WebhookEvent(Document):
    event_id: Indexed(str, unique=True)
    event_type: str
    payload: Dict[str, Any]
    processed: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "webhook_events"
