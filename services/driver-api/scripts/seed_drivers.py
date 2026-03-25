"""Seed the 3 initial drivers. Run: python -m scripts.seed_drivers"""
import bcrypt
from app.database import SessionLocal, create_tables
from app.models import Driver

DRIVERS = [
    {"name": "耀", "phone": "+85200000001", "pin": "1234", "odoo_shipper_value": "耀"},
    {"name": "盧生", "phone": "+85200000002", "pin": "1234", "odoo_shipper_value": "盧生"},
    {"name": "Barry", "phone": "+85200000003", "pin": "1234", "odoo_shipper_value": "Barry"},
]


def seed():
    create_tables()
    db = SessionLocal()
    for d in DRIVERS:
        existing = db.query(Driver).filter_by(phone=d["phone"]).first()
        if existing:
            print(f"Driver {d['name']} already exists, skipping")
            continue
        pin_hash = bcrypt.hashpw(d["pin"].encode(), bcrypt.gensalt()).decode()
        driver = Driver(
            name=d["name"],
            phone=d["phone"],
            pin_hash=pin_hash,
            odoo_shipper_value=d["odoo_shipper_value"],
            active=True,
        )
        db.add(driver)
        print(f"Created driver: {d['name']}")
    db.commit()
    db.close()


if __name__ == "__main__":
    seed()
