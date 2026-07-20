from dataclasses import dataclass
from datetime import datetime


@dataclass
class Notification:
    id: int
    title: str
    message: str
    category: str
    severity: str
    created_at: datetime
    is_read: bool = False