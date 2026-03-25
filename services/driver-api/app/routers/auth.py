from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import create_token, verify_pin
from app.database import get_db
from app.errors import APIError
from app.models import Driver
from app.schemas import DriverResponse, LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.phone == body.phone, Driver.active.is_(True)).first()
    if driver is None or not verify_pin(body.pin, driver.pin_hash):
        raise APIError(401, "invalid_credentials", "Phone or PIN is incorrect")
    token = create_token(driver.id)
    return LoginResponse(
        token=token,
        driver=DriverResponse(id=driver.id, name=driver.name, phone=driver.phone),
    )
