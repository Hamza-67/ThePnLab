from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class WaitlistEntry(Base):
    __tablename__ = "waitlist"

    id: Mapped[int]        = mapped_column(primary_key=True)
    email: Mapped[str]     = mapped_column(String(255), unique=True, index=True)
    source: Mapped[str]    = mapped_column(String(50), default="landing")   # landing | popup | footer
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
