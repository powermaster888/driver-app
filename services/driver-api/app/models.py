from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Float, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    pin_hash: Mapped[str] = mapped_column(String(200))
    odoo_shipper_value: Mapped[str] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    action_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    driver_id: Mapped[int] = mapped_column(Integer)
    job_id: Mapped[int] = mapped_column(Integer)
    action_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[str] = mapped_column(Text)
    result: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    upload_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    driver_id: Mapped[int] = mapped_column(Integer)
    file_type: Mapped[str] = mapped_column(String(20))
    file_path: Mapped[str] = mapped_column(String(500))
    mimetype: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    linked_job_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
