from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import APIError
from app.models import Driver

security = HTTPBearer()


def verify_pin(plain_pin: str, pin_hash: str) -> bool:
    return bcrypt.checkpw(plain_pin.encode("utf-8"), pin_hash.encode("utf-8"))


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_token(driver_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": str(driver_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_driver(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Driver:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        driver_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise APIError(401, "unauthorized", "Invalid or expired token")

    driver = db.query(Driver).filter(Driver.id == driver_id, Driver.active.is_(True)).first()
    if driver is None:
        raise APIError(401, "unauthorized", "Invalid or expired token")
    return driver
