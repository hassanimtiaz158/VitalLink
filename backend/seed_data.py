"""Seed the VitalLink database with synthetic donors and hospital requests.

Usage:
    python seed_data.py              # uses DATABASE_URL from .env or defaults
    python seed_data.py --clear      # drop all data before seeding

Generates ~100 donors and ~10 requests spread across New York City with
realistic blood-type distribution and pre-set critical requests for demo drama.
"""
import argparse
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import engine, SessionLocal
from app.models.hospital import Hospital
from app.models.donor import Donor
from app.models.request import Request
from app.models.match import Match

# ---------------------------------------------------------------------------
# New York City bounding box (covers all five boroughs)
# ---------------------------------------------------------------------------
NYC_CENTER = (40.7128, -74.0060)
NYC_BOUNDS = {
    "lat_min": 40.4950,  # Staten Island south
    "lat_max": 40.9176,  # Bronx north
    "lon_min": -74.2591,  # Staten Island west
    "lon_max": -73.7004,  # Queens east
}

# ---------------------------------------------------------------------------
# Realistic US blood-type distribution (approximate percentages)
# ---------------------------------------------------------------------------
BLOOD_TYPE_WEIGHTS = {
    "O+":  37.4,
    "O-":   6.6,
    "A+":  35.7,
    "A-":   6.3,
    "B+":   8.5,
    "B-":   1.5,
    "AB+":  3.4,
    "AB-":  0.6,
}
BLOOD_TYPES = list(BLOOD_TYPE_WEIGHTS.keys())
BLOOD_WEIGHTS = list(BLOOD_TYPE_WEIGHTS.values())

# ---------------------------------------------------------------------------
# Synthetic names
# ---------------------------------------------------------------------------
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael",
    "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan",
    "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Daniel",
    "Lisa", "Matthew", "Nancy", "Anthony", "Betty", "Mark", "Margaret",
    "Donald", "Sandra", "Steven", "Ashley", "Paul", "Dorothy", "Andrew",
    "Kimberly", "Joshua", "Emily", "Kenneth", "Donna", "Kevin", "Michelle",
    "Brian", "Carol", "George", "Amanda", "Timothy", "Melissa", "Ronald",
    "Deborah", "Edward", "Stephanie", "Jason", "Rebecca", "Jeffrey", "Sharon",
    "Ryan", "Laura", "Jacob", "Cynthia", "Gary", "Kathleen", "Nicholas",
    "Amy", "Eric", "Angela", "Jonathan", "Shirley", "Stephen", "Anna",
    "Larry", "Brenda", "Justin", "Pamela", "Scott", "Emma", "Brandon",
    "Nicole", "Benjamin", "Helen", "Samuel", "Samantha", "Raymond", "Katherine",
    "Gregory", "Christine", "Frank", "Debra", "Alexander", "Rachel", "Patrick",
    "Carolyn", "Jack", "Janet", "Dennis", "Catherine", "Jerry", "Maria",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
    "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
    "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
    "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
    "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez",
    "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
    "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long",
]

# ---------------------------------------------------------------------------
# Hospital locations (real NYC hospitals with approximate coordinates)
# ---------------------------------------------------------------------------
HOSPITALS = [
    {"name": "NYU Langone Medical Center",       "lat": 40.7425, "lon": -73.9723},
    {"name": "Mount Sinai Hospital",              "lat": 40.7903, "lon": -73.9533},
    {"name": "NewYork-Presbyterian Hospital",     "lat": 40.7649, "lon": -73.9556},
    {"name": "Brooklyn Hospital Center",          "lat": 40.6921, "lon": -73.9795},
    {"name": "Lincoln Medical Center",            "lat": 40.8243, "lon": -73.9246},
    {"name": "Elmhurst Hospital Center",          "lat": 40.7465, "lon": -73.8790},
    {"name": "Jacobi Medical Center",             "lat": 40.8460, "lon": -73.8471},
    {"name": "Coney Island Hospital",             "lat": 40.5843, "lon": -73.9631},
    {"name": "Bellevue Hospital Center",          "lat": 40.7392, "lon": -73.9757},
    {"name": "Woodhull Medical Center",           "lat": 40.6952, "lon": -73.9444},
]


def random_point_in_nyc() -> tuple[float, float]:
    """Return a random (lat, lon) within the NYC bounding box."""
    lat = random.uniform(NYC_BOUNDS["lat_min"], NYC_BOUNDS["lat_max"])
    lon = random.uniform(NYC_BOUNDS["lon_min"], NYC_BOUNDS["lon_max"])
    return round(lat, 5), round(lon, 5)


def random_blood_type() -> str:
    """Pick a blood type following realistic population distribution."""
    return random.choices(BLOOD_TYPES, weights=BLOOD_WEIGHTS, k=1)[0]


def random_name() -> str:
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def random_email(name: str) -> str:
    slug = name.lower().replace(" ", ".")
    domains = ["example.com", "mailinator.com", "test.org"]
    return f"{slug}@{random.choice(domains)}"


def clear_db(session: Session) -> None:
    """Delete all rows from matches, requests, donors, hospitals."""
    session.execute(text("DELETE FROM matches"))
    session.execute(text("DELETE FROM requests"))
    session.execute(text="DELETE FROM donors")
    session.execute(text="DELETE FROM hospitals")
    session.commit()
    print("Cleared all data.")


def seed_hospitals(session: Session) -> list[Hospital]:
    """Insert the preset NYC hospitals and return them."""
    hospitals = []
    for h in HOSPITALS:
        point = text(f"ST_SetSRID(ST_MakePoint({h['lon']}, {h['lat']}), 4326)")
        hospital = Hospital(
            name=h["name"],
            location=point,
            verified=True,
        )
        session.add(hospital)
        hospitals.append(hospital)
    session.flush()
    print(f"Inserted {len(hospitals)} hospitals.")
    return hospitals


def seed_donors(session: Session, count: int = 100) -> list[Donor]:
    """Insert synthetic donors spread across NYC."""
    donors = []
    for _ in range(count):
        name = random_name()
        lat, lon = random_point_in_nyc()
        point = text(f"ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)")

        # ~80% available, ~20% unavailable
        available = random.random() < 0.80

        # Some donors have a recent donation date (medical safety)
        last_donation = None
        if random.random() < 0.15:
            last_donation = date.today() - timedelta(days=random.randint(30, 90))

        donor = Donor(
            name=name,
            blood_type=random_blood_type(),
            email=random_email(name),
            location=point,
            available=available,
            last_donation_date=last_donation,
        )
        session.add(donor)
        donors.append(donor)
    session.flush()
    print(f"Inserted {len(donors)} donors ({sum(1 for d in donors if d.available)} available).")
    return donors


def seed_requests(session: Session, hospitals: list[Hospital]) -> list[Request]:
    """Insert a mix of routine, high, and critical shortage requests."""
    request_specs = [
        # Critical requests — the drama for the demo
        {"hosp": 0, "type": "O-",  "units": 4, "urgency": "critical"},
        {"hosp": 3, "type": "AB-", "units": 2, "urgency": "critical"},
        {"hosp": 6, "type": "B-",  "units": 3, "urgency": "critical"},
        # High urgency
        {"hosp": 1, "type": "O+",  "units": 6, "urgency": "high"},
        {"hosp": 4, "type": "A+",  "units": 3, "urgency": "high"},
        {"hosp": 7, "type": "B+",  "units": 2, "urgency": "high"},
        # Routine
        {"hosp": 2, "type": "A-",  "units": 5, "urgency": "routine"},
        {"hosp": 5, "type": "O+",  "units": 4, "urgency": "routine"},
        {"hosp": 8, "type": "AB+", "units": 2, "urgency": "routine"},
        {"hosp": 9, "type": "A+",  "units": 3, "urgency": "routine"},
    ]

    requests = []
    for spec in request_specs:
        request = Request(
            hospital_id=hospitals[spec["hosp"]].hospital_id,
            blood_type=spec["type"],
            units_needed=spec["units"],
            urgency=spec["urgency"],
            status="open",
        )
        session.add(request)
        requests.append(request)
    session.flush()
    print(f"Inserted {len(requests)} requests "
          f"({sum(1 for r in requests if r.urgency == 'critical')} critical).")
    return requests


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed VitalLink demo data")
    parser.add_argument("--clear", action="store_true", help="Clear existing data first")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        if args.clear:
            clear_db(session)

        hospitals = seed_hospitals(session)
        donors = seed_donors(session, count=100)
        requests = seed_requests(session, hospitals)

        session.commit()
        print("\nSeed complete. Database is ready for the demo.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
