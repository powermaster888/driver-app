import pytest
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models import Driver

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine)

SEED_DRIVERS = [
    {"name": "耀", "phone": "+85200000001", "pin": "1234", "odoo_shipper_value": "yiu"},
    {"name": "明", "phone": "+85200000002", "pin": "1234", "odoo_shipper_value": "ming"},
    {"name": "華", "phone": "+85200000003", "pin": "1234", "odoo_shipper_value": "wah"},
]


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def _override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_db(db):
    for d in SEED_DRIVERS:
        driver = Driver(
            name=d["name"],
            phone=d["phone"],
            pin_hash=hash_pin(d["pin"]),
            odoo_shipper_value=d["odoo_shipper_value"],
            active=True,
        )
        db.add(driver)
    db.commit()
    return db


@pytest.fixture
def auth_token(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "1234"})
    return resp.json()["token"]
