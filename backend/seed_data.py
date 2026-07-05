"""Seed the database with synthetic donors and requester-driven requests.

Generates:
  - 100 donors with Pakistani names around Lahore
  - 5 requesters
  - 10 requests at various stages (open, donor_accepted, contact_shared)
  - Pre-seeded matches at different states for the live demo
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import engine, Base
from app.models.donor import Donor
from app.models.requester import Requester
from app.models.request import Request
from app.models.match import Match


# Lahore, Pakistan bounding box
LAHORE_LAT_MIN, LAHORE_LAT_MAX = 31.40, 31.65
LAHORE_LNG_MIN, LAHORE_LNG_MAX = 74.20, 74.50

# Pakistani first/last names
FIRST_NAMES_M = [
    "Ahmed", "Ali", "Bilal", "Danish", "Faizan", "Hamza", "Imran", "Kamal",
    "Moiz", "Osama", "Saad", "Tariq", "Usman", "Waqas", "Zeeshan", "Zubair",
    "Asif", "Basit", "Farhan", "Haris", "Ismail", "Junaid", "Khalid", "Liaqat",
    "Naveed", "Omar", "Rashid", "Shehryar", "Umar", "Yasir",
]
FIRST_NAMES_F = [
    "Amina", "Ayesha", "Bisma", "Farah", "Hira", "Iqra", "Laiba", "Maha",
    "Naila", "Rabia", "Saba", "Sadia", "Sana", "Saima", "Shanza", "Tamanna",
    "Tuba", "Yasmin", "Zara", "Aleeza", "Maryam", "Parveen",
]
LAST_NAMES = [
    "Ahmad", "Butt", "Cheema", "Chaudhry", "Durrani", "Gill", "Hussain",
    "Jafri", "Khalil", "Khan", "Malik", "Memon", "Niazi", "Qureshi",
    "Rao", "Siddiqui", "Syed", "Tirmizi", "Wazir", "Zaidi",
]

BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
URGENCIES = ["critical", "high", "routine"]

# Pre-seeded requesters
REQUESTERS = [
    {"name": "Ahmed Khan", "email": "ahmed.khan@test.com", "phone": "+923001234567", "lat": 31.5204, "lng": 74.3587},
    {"name": "Fatima Ali", "email": "fatima.ali@test.com", "phone": "+923009876543", "lat": 31.5500, "lng": 74.3500},
    {"name": "Bilal Malik", "email": "bilal.malik@test.com", "phone": None, "lat": 31.4800, "lng": 74.3200},
    {"name": "Sana Sheikh", "email": "sana.sheikh@test.com", "phone": "+923211234567", "lat": 31.5800, "lng": 74.4000},
    {"name": "Omar Nawaz", "email": "omar.nawaz@test.com", "phone": "+923331234567", "lat": 31.4500, "lng": 74.2800},
]

# Pre-seeded requests
REQUESTS = [
    {"req_idx": 0, "blood_type": "O+", "units": 2, "urgency": "critical", "status": "open"},
    {"req_idx": 0, "blood_type": "A+", "units": 1, "urgency": "high", "status": "open"},
    {"req_idx": 1, "blood_type": "B-", "units": 1, "urgency": "critical", "status": "donor_accepted"},
    {"req_idx": 1, "blood_type": "O-", "units": 3, "urgency": "high", "status": "open"},
    {"req_idx": 2, "blood_type": "AB+", "units": 1, "urgency": "routine", "status": "open"},
    {"req_idx": 2, "blood_type": "A-", "units": 2, "urgency": "high", "status": "contact_shared"},
    {"req_idx": 3, "blood_type": "O+", "units": 1, "urgency": "critical", "status": "donor_accepted"},
    {"req_idx": 3, "blood_type": "B+", "units": 1, "urgency": "routine", "status": "open"},
    {"req_idx": 4, "blood_type": "A+", "units": 2, "urgency": "high", "status": "open"},
    {"req_idx": 4, "blood_type": "O-", "units": 1, "urgency": "critical", "status": "donor_confirmed"},
]


def clear_db():
    """Clear all existing data."""
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM messages"))
        conn.execute(text("DELETE FROM blocks"))
        conn.execute(text("DELETE FROM matches"))
        conn.execute(text("DELETE FROM requests"))
        conn.execute(text("DELETE FROM requesters"))
        conn.commit()
    print("Cleared existing data")


def seed_donors(session: Session, count: int = 100) -> list[Donor]:
    """Generate synthetic donors around Lahore."""
    donors = []
    for i in range(count):
        first = random.choice(FIRST_NAMES_M + FIRST_NAMES_F)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}@example.com"
        blood_type = random.choice(BLOOD_TYPES)
        phone = f"+92300{random.randint(1000000, 9999999)}" if random.random() > 0.3 else None

        lat = random.uniform(LAHORE_LAT_MIN, LAHORE_LAT_MAX)
        lng = random.uniform(LAHORE_LNG_MIN, LAHORE_LNG_MAX)

        donor = Donor(
            name=name,
            blood_type=blood_type,
            email=email,
            phone=phone,
            location=text(f"ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)"),
            available=random.random() > 0.2,
        )
        session.add(donor)
        donors.append(donor)

    session.flush()
    print(f"Seeded {len(donors)} donors")
    return donors


def seed_requesters(session: Session) -> list[Requester]:
    """Create pre-defined requesters."""
    requesters = []
    for spec in REQUESTERS:
        point = text(f"ST_SetSRID(ST_MakePoint({spec['lng']}, {spec['lat']}), 4326)")
        requester = Requester(
            name=spec["name"],
            email=spec["email"],
            phone=spec["phone"],
            location=point,
        )
        session.add(requester)
        requesters.append(requester)

    session.flush()
    print(f"Seeded {len(requesters)} requesters")
    return requesters


def seed_requests(session: Session, requesters: list[Requester], donors: list[Donor]):
    """Create pre-seeded requests with matches at various states."""
    for spec in REQUESTS:
        requester = requesters[spec["req_idx"]]
        request = Request(
            requester_id=requester.requester_id,
            blood_type=spec["blood_type"],
            units_needed=spec["units"],
            urgency=spec["urgency"],
            status=spec["status"],
        )
        session.add(request)
        session.flush()

        # Create matches based on status
        compatible_donors = [d for d in donors if d.blood_type in _compatible(spec["blood_type"]) and d.available]
        random.shuffle(compatible_donors)

        if spec["status"] == "open":
            # No matches yet
            pass
        elif spec["status"] == "donor_accepted":
            # 1-2 accepted matches
            for d in compatible_donors[:random.randint(1, 2)]:
                match = Match(
                    request_id=request.request_id,
                    donor_id=d.donor_id,
                    response="accepted_by_requester",
                    notified_at=datetime.now(timezone.utc) - timedelta(hours=1),
                    accepted_at=datetime.now(timezone.utc),
                )
                session.add(match)
        elif spec["status"] == "donor_confirmed":
            # Donor confirmed
            for d in compatible_donors[:1]:
                match = Match(
                    request_id=request.request_id,
                    donor_id=d.donor_id,
                    response="donor_confirmed",
                    notified_at=datetime.now(timezone.utc) - timedelta(hours=2),
                    accepted_at=datetime.now(timezone.utc) - timedelta(hours=1),
                    confirmed_at=datetime.now(timezone.utc),
                )
                session.add(match)
        elif spec["status"] == "contact_shared":
            # Contact shared
            for d in compatible_donors[:spec["units"]]:
                match = Match(
                    request_id=request.request_id,
                    donor_id=d.donor_id,
                    response="contact_shared",
                    notified_at=datetime.now(timezone.utc) - timedelta(hours=3),
                    accepted_at=datetime.now(timezone.utc) - timedelta(hours=2),
                    confirmed_at=datetime.now(timezone.utc) - timedelta(hours=1),
                    contact_shared_at=datetime.now(timezone.utc),
                )
                session.add(match)

    session.commit()
    print(f"Seeded {len(REQUESTS)} requests with matches")


def _compatible(blood_type: str) -> list[str]:
    """Return compatible donor blood types."""
    from app.matching_engine import COMPATIBILITY_MAP
    return COMPATIBILITY_MAP.get(blood_type, [])


def seed():
    """Run the full seed process."""
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        clear_db()
        donors = seed_donors(session)
        requesters = seed_requesters(session)
        seed_requests(session, requesters, donors)
    print("Seed complete!")


if __name__ == "__main__":
    seed()
