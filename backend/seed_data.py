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
# Lahore, Pakistan bounding box
# ---------------------------------------------------------------------------
LAHORE_CENTER = (31.5204, 74.3587)
LAHORE_BOUNDS = {
    "lat_min": 31.4000,  # southern edge
    "lat_max": 31.6500,  # northern edge
    "lon_min": 74.2000,  # western edge
    "lon_max": 74.5000,  # eastern edge
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
# Synthetic names (Pakistani)
# ---------------------------------------------------------------------------
FIRST_NAMES = [
    "Ahmed", "Fatima", "Ali", "Ayesha", "Hassan", "Zainab", "Usman", "Maryam",
    "Omar", "Sana", "Bilal", "Hira", "Kamal", "Noor", "Tariq", "Amna",
    "Faisal", "Rabia", "Imran", "Sadia", "Asif", "Nida", "Shahid", "Bushra",
    "Daniyal", "Mehreen", "Farhan", "Iqra", "Hamza", "Laiba", "Danish", "Yasmin",
    "Rizwan", "Hania", "Saad", "Amina", "Adil", "Zara", "Khalid", "Saima",
    "Noman", "Rida", "Waqas", "Maham", "Saif", "Eman", "Junaid", "Aisha",
    "Shehryar", "Tamanna", "Arslan", "Ismat", "Faizan", "Nazia", "Sufyan", "Rubab",
    "Nabeel", "Aleeza", "Taimoor", "Shanza", "Zubair", "Bisma", "Moiz", "Aqsa",
    "Haris", "Kinza", "Basit", "Maha", "Affan", "Tuba", "Shayan", "Palwasha",
    "Rohail", "Amber", "Ayaan", "Saba", "Shoaib", "Naila", "Osama", "Madiha",
    "Arsalan", "Rukhsana", "Bilal", "Samina", "Waleed", "Farah", "Zeeshan", "Shazia",
    "Yasir", "Gul", "Abdul", "Hina", "Zubair", "Nadia", "Rashid", "Parveen",
]
LAST_NAMES = [
    "Khan", "Malik", "Butt", "Chaudhry", "Sheikh", "Siddiqui", "Qureshi", "Rao",
    "Bhatti", "Gill", "Awan", "Dogar", "Cheema", "Gondal", "Jatt", "Warraich",
    "Khokhar", "Niazi", "Syed", "Hussain", "Shah", "Raza", "Mirza", "Baig",
    "Shamsi", "Ansari", "Akhtar", "Sial", "Durrani", "Mughal", "Bukhari", "Tareen",
    "Nawaz", "Kayani", "Lodhi", "Khosa", "Dahar", "Bizenjo", "Mazari", "Rind",
    "Jamali", "Zehri", "Khattak", "Orakzai", "Mehsud", "Wazir", "Yusufzai", "Swati",
    "Chishti", "Naqvi", "Jafri", "Tirmizi", "Abbasi", "Shirazi", "Gilani", "Zaidi",
    "Kazmi", "Nomani", "Farooqi", "Usmani", "Deobandi", "Barelvi", "Shah", "Nizami",
    "Ahmad", "Ismail", "Ibrahim", "Khalil", "Memon", "Memom", "Dawood", "Adamjee",
    "Lakhani", "Habib", "Dossa", "Poonawala", "Bharucha", "Patel", "Kapadia", "Vakil",
    "Meer", "Hyder", "Abbas", "Jilani", "Gardezi", "Sahi", "Bhutta", "Lashari",
]

# ---------------------------------------------------------------------------
# Hospital locations (real Lahore hospitals with approximate coordinates)
# ---------------------------------------------------------------------------
HOSPITALS = [
    {"name": "Jinnah Hospital Lahore",              "lat": 31.5160, "lon": 74.3480},
    {"name": "Mayo Hospital Lahore",                "lat": 31.5580, "lon": 74.3500},
    {"name": "Services Hospital Lahore",            "lat": 31.5530, "lon": 74.3460},
    {"name": "General Hospital Lahore",             "lat": 31.5450, "lon": 74.3350},
    {"name": "Punjab Institute of Cardiology",      "lat": 31.5500, "lon": 74.3420},
    {"name": "Lahore General Hospital",             "lat": 31.5750, "lon": 74.3530},
    {"name": "Ittefaq Hospital Lahore",             "lat": 31.5080, "lon": 74.3400},
    {"name": "National Hospital Lahore",            "lat": 31.5200, "lon": 74.3700},
    {"name": "Shaukat Khanum Memorial Hospital",    "lat": 31.4810, "lon": 74.3600},
    {"name": "Hameed Latif Hospital Lahore",        "lat": 31.5050, "lon": 74.3550},
]


def random_point_in_city() -> tuple[float, float]:
    """Return a random (lat, lon) within the Lahore bounding box."""
    lat = random.uniform(LAHORE_BOUNDS["lat_min"], LAHORE_BOUNDS["lat_max"])
    lon = random.uniform(LAHORE_BOUNDS["lon_min"], LAHORE_BOUNDS["lon_max"])
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
    """Delete all rows from matches, requests, donors, hospitals, patients."""
    session.execute(text("DELETE FROM matches"))
    session.execute(text("DELETE FROM requests"))
    session.execute(text("DELETE FROM donors"))
    session.execute(text("DELETE FROM hospitals"))
    session.execute(text("DELETE FROM patients"))
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
        lat, lon = random_point_in_city()
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
            # Hospital requests are verified from creation — staff have
            # confirmed the need is real as part of clinical workflow.
            verified_by_hospital=True,
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
