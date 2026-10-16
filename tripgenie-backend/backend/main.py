import os, sqlite3, secrets, hashlib, hmac, json, time, math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict

APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(APP_DIR / "tripgenie.db")))
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret-before-deployment")
TOKEN_TTL = int(os.getenv("TOKEN_TTL_SECONDS", "604800"))

app = FastAPI(
    title="TripGenie AI API",
    version="2.0.0",
    description="Smart Trip Planner — AI Itinerary, Auth, Bookings, Reviews, Expenses & Admin"
)

origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ─── Database ────────────────────────────────────────────────────────────────
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def now(): return datetime.now(timezone.utc).isoformat()

def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            preferences TEXT NOT NULL DEFAULT '{}',
            avatar TEXT DEFAULT NULL,
            created_at TEXT NOT NULL
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            destination TEXT NOT NULL,
            trip_json TEXT NOT NULL,
            is_public INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'Other',
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            place TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
            text TEXT NOT NULL,
            by_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            destination TEXT NOT NULL,
            check_in TEXT,
            check_out TEXT,
            price REAL,
            status TEXT NOT NULL DEFAULT 'confirmed',
            details TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS destinations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            country TEXT NOT NULL DEFAULT '',
            tag TEXT NOT NULL DEFAULT 'Discover',
            img TEXT NOT NULL DEFAULT '',
            days TEXT NOT NULL DEFAULT '3–5 days',
            price TEXT NOT NULL DEFAULT 'From ₹5,000',
            description TEXT NOT NULL DEFAULT '',
            highlights TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        )""")
        # ── Lightweight migrations for databases created by older versions ──
        def _cols(table):
            return {r["name"] for r in c.execute(f"PRAGMA table_info({table})").fetchall()}
        for table, column, ddl in [
            ("users", "role", "TEXT NOT NULL DEFAULT 'user'"),
            ("users", "preferences", "TEXT NOT NULL DEFAULT '{}'"),
            ("users", "avatar", "TEXT DEFAULT NULL"),
            ("trips", "is_public", "INTEGER NOT NULL DEFAULT 0"),
        ]:
            if column not in _cols(table):
                c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

        # Bootstrap: ensure at least one admin exists so the dashboard is reachable
        if c.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0] == 0:
            c.execute("UPDATE users SET role='admin' WHERE id=(SELECT id FROM users ORDER BY id ASC LIMIT 1)")

        # Seed default destinations
        default_destinations = [
            ("Manali, Himachal Pradesh", "India", "Mountain escape", "photo-1626621341517-bbf3d9990a23", "3–5 days", "From ₹6,500", "A stunning hill station nestled in the Himalayas.", '["Rohtang Pass","Solang Valley","Hadimba Temple","Old Manali"]'),
            ("Goa, India", "India", "Beach & sunshine", "photo-1512343879784-a960bf40e7f2", "3–4 days", "From ₹7,000", "India's favourite coastal paradise with golden beaches.", '["Baga Beach","Old Goa Churches","Dudhsagar Falls","Night Markets"]'),
            ("Jaipur, Rajasthan", "India", "Culture & heritage", "photo-1599661046827-dacff0c0f09a", "2–3 days", "From ₹4,500", "The Pink City — forts, palaces and vibrant bazaars.", '["Amber Fort","Hawa Mahal","City Palace","Jantar Mantar"]'),
            ("Kerala Backwaters", "India", "Nature & serenity", "photo-1602216056096-3b40cc0c9944", "4–6 days", "From ₹9,000", "God's own country — lush greenery and tranquil backwaters.", '["Alleppey Houseboats","Munnar Tea Gardens","Periyar Wildlife","Kovalam Beach"]'),
            ("Leh-Ladakh", "India", "Adventure & altitude", "photo-1506038634487-60a69ae4b7b1", "5–7 days", "From ₹12,000", "High-altitude desert landscapes and Buddhist monasteries.", '["Pangong Lake","Nubra Valley","Magnetic Hill","Hemis Monastery"]'),
            ("Varanasi, UP", "India", "Spiritual journey", "photo-1561361058-c24cecae35ca", "2–3 days", "From ₹3,500", "The spiritual capital of India on the banks of the Ganges.", '["Ganga Aarti","Dashashwamedh Ghat","Kashi Vishwanath","Sarnath"]'),
        ]
        for d in default_destinations:
            try:
                c.execute("INSERT INTO destinations(name,country,tag,img,days,price,description,highlights,created_at) VALUES(?,?,?,?,?,?,?,?,?)", (*d, now()))
            except sqlite3.IntegrityError:
                pass

init_db()


# ─── Helpers ─────────────────────────────────────────────────────────────────
def now(): return datetime.now(timezone.utc).isoformat()

def hash_password(password: str, salt: Optional[bytes] = None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310000)
    return salt.hex() + "$" + digest.hex()

def verify_password(password, stored):
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 310000).hex()
        return hmac.compare_digest(actual, digest_hex)
    except Exception:
        return False

def make_token(user_id: int):
    expires = int(time.time()) + TOKEN_TTL
    payload = f"{user_id}:{expires}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"

def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in to continue.")
    try:
        uid_s, exp_s, signature = authorization.split(" ", 1)[1].split(":", 2)
        payload = f"{uid_s}:{exp_s}"
        expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected) or int(exp_s) < int(time.time()):
            raise ValueError()
        uid = int(uid_s)
    except Exception:
        raise HTTPException(401, "Your session is invalid or expired. Please log in again.")
    with db() as c:
        row = c.execute("SELECT id,name,email,role,preferences,created_at FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(401, "Account not found.")
    return dict(row)

def require_admin(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required.")
    return user

def optional_user(authorization: Optional[str] = Header(default=None)):
    if not authorization:
        return None
    try:
        return current_user(authorization)
    except Exception:
        return None


# ─── AI Trip Planning Engine ──────────────────────────────────────────────────
DESTINATION_DB = {
    "goa": {
        "type": "beach",
        "highlights": ["Baga Beach", "Old Goa Churches", "Dudhsagar Falls", "Night Markets", "Water Sports"],
        "hotels": ["Taj Exotica", "The Leela", "Alila Diwa", "W Goa", "Cidade de Goa"],
        "food": ["Fish curry rice", "Bebinca dessert", "Xacuti", "Prawn balchão", "Feni cocktails"],
        "transport": "Rent a scooter (₹300/day) or hire a taxi",
        "best_time": "November to February",
        "tip": "Visit North Goa for parties, South Goa for peaceful beaches"
    },
    "manali": {
        "type": "hill",
        "highlights": ["Rohtang Pass", "Solang Valley", "Hadimba Temple", "Beas River", "Old Manali"],
        "hotels": ["Span Resort", "The Manali Inn", "Snow Valley Resorts", "Solang Valley Camps"],
        "food": ["Siddu", "Trout fish", "Chha Gosht", "Aktori", "Thukpa"],
        "transport": "HRTC bus or private taxi; hire bikes locally",
        "best_time": "October to June (avoid monsoon)",
        "tip": "Book Rohtang Pass permit 2 days in advance online"
    },
    "jaipur": {
        "type": "culture",
        "highlights": ["Amber Fort", "Hawa Mahal", "City Palace", "Jantar Mantar", "Nahargarh Fort"],
        "hotels": ["Rambagh Palace", "Jai Mahal Palace", "Samode Haveli", "The Oberoi Rajvilas"],
        "food": ["Dal Baati Churma", "Ghewar", "Laal Maas", "Pyaaz Kachori", "Lassi"],
        "transport": "Auto-rickshaws, tuk-tuks or hire a car with driver",
        "best_time": "October to March",
        "tip": "Buy a composite ticket for all major monuments to save money"
    },
    "ladakh": {
        "type": "adventure",
        "highlights": ["Pangong Lake", "Nubra Valley", "Magnetic Hill", "Hemis Monastery", "Zanskar Valley"],
        "hotels": ["The Grand Dragon", "Ladakh Sarai", "Nimmu House", "Lchang Nang Retreat"],
        "food": ["Thukpa", "Skyu", "Chhang (barley beer)", "Tsampa", "Butter tea"],
        "transport": "Rent Royal Enfield or hire a jeep; Inner Line Permit required",
        "best_time": "June to September",
        "tip": "Acclimatize for 2 days before strenuous activity; stay hydrated"
    },
    "kerala": {
        "type": "nature",
        "highlights": ["Alleppey Backwaters", "Munnar Tea Gardens", "Periyar Wildlife Sanctuary", "Kovalam Beach"],
        "hotels": ["Kumarakom Lake Resort", "Taj Green Cove", "Marari Beach Resort"],
        "food": ["Appam with stew", "Kerala fish curry", "Puttu & Kadala", "Prawn moilee", "Payasam"],
        "transport": "Houseboat for backwaters; hire car for hill stations",
        "best_time": "September to March",
        "tip": "Book houseboat stays 3–4 months in advance for peak season"
    },
    "varanasi": {
        "type": "spiritual",
        "highlights": ["Ganga Aarti at Dashashwamedh Ghat", "Kashi Vishwanath Temple", "Sarnath", "Boat ride at sunrise"],
        "hotels": ["Taj Ganges", "BrijRama Palace", "Ramada Plaza", "Hotel Surya"],
        "food": ["Banarasi paan", "Kachori sabzi", "Malaiyo", "Tamatar chaat", "Lassi from Blue Lassi"],
        "transport": "Cycle rickshaws and auto-rickshaws; boats for Ganga",
        "best_time": "October to March",
        "tip": "Wake up early for the sunrise boat ride — the most magical experience"
    },
    "dubai": {
        "type": "luxury",
        "highlights": ["Burj Khalifa", "Dubai Mall", "Palm Jumeirah", "Dubai Frame", "Desert Safari"],
        "hotels": ["Burj Al Arab", "Atlantis The Palm", "Address Downtown", "Jumeirah Beach Hotel"],
        "food": ["Shawarma", "Al Harees", "Luqaimat", "Arabic mezze", "Camel milk ice cream"],
        "transport": "Dubai Metro (efficient & cheap); taxis available everywhere",
        "best_time": "November to April",
        "tip": "Visit during Dubai Shopping Festival for massive discounts"
    },
    "bali": {
        "type": "beach",
        "highlights": ["Tanah Lot Temple", "Ubud Monkey Forest", "Tegallalang Rice Terraces", "Seminyak Beach"],
        "hotels": ["Four Seasons Sayan", "COMO Shambhala", "Alaya Ubud", "W Bali Seminyak"],
        "food": ["Nasi Goreng", "Babi Guling", "Satay", "Mie Goreng", "Fresh coconuts"],
        "transport": "Rent a scooter (cheapest); hire a driver for day trips",
        "best_time": "April to October (dry season)",
        "tip": "Dress modestly when visiting temples — sarong required"
    },
}

def get_dest_info(destination: str) -> dict:
    dest_lower = destination.lower()
    for key, info in DESTINATION_DB.items():
        if key in dest_lower:
            return info
    # Default generic
    return {
        "type": "explore",
        "highlights": ["Main city attraction", "Local market", "Heritage site", "Viewpoint", "Local restaurant"],
        "hotels": ["City Grand Hotel", "Comfort Inn", "Boutique Stay", "Heritage Haveli"],
        "food": ["Local cuisine", "Street food", "Regional specialties"],
        "transport": "Local taxis and public transport",
        "best_time": "Check local weather forecasts",
        "tip": "Research local customs and carry cash for small vendors"
    }

def generate_itinerary(destination, dates, travellers, budget, interests, cities, num_days=3):
    places = [x.strip() for x in cities.split(",") if x.strip()] if cities.strip() else [destination.strip()]
    target = " → ".join(places)
    budget_num = int("".join(ch for ch in str(budget) if ch.isdigit()) or "10000")

    # Budget allocation
    stay_pct, food_pct, transport_pct, activities_pct, buffer_pct = 0.32, 0.20, 0.28, 0.10, 0.10
    budget_breakdown = {
        "accommodation": int(budget_num * stay_pct),
        "food": int(budget_num * food_pct),
        "transport": int(budget_num * transport_pct),
        "activities": int(budget_num * activities_pct),
        "buffer": int(budget_num * buffer_pct),
    }

    # Per city info
    all_info = [get_dest_info(p) for p in places]
    primary_info = all_info[0]
    dest_type = primary_info.get("type", "explore")

    # Activity templates per type
    templates = {
        "beach": [
            ["Arrive and check in to your hotel", "Explore the local beach and promenade", "Sunset dinner at a beachside restaurant"],
            ["Morning water sports (surfing/kayaking/snorkelling)", "Visit nearby coastal village", "Relax by the pool; evening at a beach shack"],
            ["Explore a heritage or nature site", "Local market and souvenir shopping", "Farewell seafood lunch before departure"],
        ],
        "hill": [
            ["Arrive and acclimatize", "Explore the main town and local cafés", "Sunset from a scenic viewpoint"],
            ["Guided nature walk or trek to waterfall", "Visit a nearby village and interact with locals", "Cozy dinner at a mountain café"],
            ["Leisurely breakfast with mountain views", "Short heritage or temple visit", "Head back; pick up local handicrafts"],
        ],
        "culture": [
            ["Arrive; visit the main heritage monument", "Explore the royal palace or fort", "Street food walk in the old city"],
            ["Visit cultural or religious sites", "Explore a local museum or art gallery", "Traditional dinner with folk performances"],
            ["Morning bazaar and handicraft shopping", "Visit a lesser-known local attraction", "Departure; pick up local sweets"],
        ],
        "adventure": [
            ["Arrive and get adventure gear ready", "Orientation trek or introductory activity", "Bonfire evening with fellow travellers"],
            ["Main adventure activity (rafting/climbing/biking)", "Explore the natural landscape", "Camping or stay at a remote resort"],
            ["Sunrise photography or short hike", "Visit a local monastery or landmark", "Descend and head to departure point"],
        ],
        "spiritual": [
            ["Arrive; attend the evening Aarti ceremony", "Sunrise boat ride on the sacred river", "Visit the main temple at dawn"],
            ["Explore ghats and meditation spots", "Visit a nearby spiritual site or museum", "Attend a local religious ceremony"],
            ["Morning meditation at the ghat", "Visit a heritage temple or monastery", "Depart with blessings and memories"],
        ],
        "luxury": [
            ["Arrive; check in to your luxury hotel", "Explore the iconic landmark (e.g., Burj Khalifa/Colosseum)", "Fine dining experience"],
            ["Exclusive city tour or private excursion", "Spa and wellness morning", "Sunset cruise or rooftop dinner"],
            ["Luxury shopping district or boutique experience", "Brunch at a Michelin-starred restaurant", "Departure in style"],
        ],
        "nature": [
            ["Arrive; check in to your eco-resort or houseboat", "Boat ride through backwaters or nature walk", "Dinner with local flavours"],
            ["Wildlife sanctuary or bird watching tour", "Visit a tea or spice plantation", "Sunset at a scenic viewpoint"],
            ["Morning yoga or nature walk", "Village homestay experience or cooking class", "Departure; take home local spices"],
        ],
        "explore": [
            ["Arrive and get settled", "Explore the main local attraction", "Try a popular local restaurant"],
            ["Visit a landmark or cultural site", "Explore a market or neighbourhood", "Sunset walk and dinner"],
            ["Discover a nearby attraction", "Local brunch and shopping", "Departure"],
        ],
    }

    act = templates.get(dest_type, templates["explore"])
    # Extend for more days
    extra_days = []
    for i in range(3, num_days):
        extra_days.append({
            "label": f"DAY {i+1:02d}",
            "title": f"Explore {places[i % len(places)] if len(places) > 1 else destination} deeper",
            "activities": [
                f"Visit a hidden gem near {places[i % len(places)] if len(places) > 1 else destination}",
                "Local experiences and cultural immersion",
                "Evening relaxation and trip journaling"
            ]
        })

    days = [{"label": f"DAY {i+1:02d}", "title": ["Arrive & explore", "Discover the highlights", "A relaxed final day"][i], "activities": act[i]} for i in range(min(3, num_days))]
    days.extend(extra_days)

    # Hotel recommendations
    hotels = [{"name": h, "type": "Hotel", "price_per_night": int(budget_breakdown["accommodation"] / max(num_days, 1))} for h in primary_info.get("hotels", ["City Grand Hotel"])[:3]]
    # Transport
    transport_info = primary_info.get("transport", "Local taxis and public transport")

    return {
        "destination": target,
        "dates": dates or "Dates not set",
        "travellers": travellers,
        "budget": budget,
        "budgetNum": budget_num,
        "budgetBreakdown": budget_breakdown,
        "interests": interests,
        "cities": places,
        "numDays": num_days,
        "days": days,
        "estimatedTotal": budget_num,
        "destType": dest_type,
        "highlights": primary_info.get("highlights", []),
        "cityCoords": [c for c in (local_coords(p) for p in places) if c],
        "recommendedHotels": hotels,
        "localFood": primary_info.get("food", []),
        "transportTip": transport_info,
        "bestTime": primary_info.get("best_time", "Year-round"),
        "localTip": primary_info.get("tip", "Carry cash and local emergency numbers."),
        "generatedAt": now(),
        "generation": "tripgenie-v2"
    }


# ─── Geocoding & Route Optimization ───────────────────────────────────────────
LOCAL_COORDS = {
    "goa": (15.2993, 74.1240, "India"),
    "manali": (32.2432, 77.1892, "India"),
    "himachal": (31.1048, 77.1734, "India"),
    "jaipur": (26.9124, 75.7873, "India"),
    "rajasthan": (26.9124, 75.7873, "India"),
    "kerala": (9.4981, 76.3388, "India"),
    "alleppey": (9.4981, 76.3388, "India"),
    "munnar": (10.0889, 77.0595, "India"),
    "ladakh": (34.1526, 77.5770, "India"),
    "leh": (34.1526, 77.5770, "India"),
    "varanasi": (25.3176, 82.9739, "India"),
    "delhi": (28.6139, 77.2090, "India"),
    "agra": (27.1767, 78.0081, "India"),
    "mumbai": (19.0760, 72.8777, "India"),
    "bangalore": (12.9716, 77.5946, "India"),
    "bengaluru": (12.9716, 77.5946, "India"),
    "chennai": (13.0827, 80.2707, "India"),
    "kolkata": (22.5726, 88.3639, "India"),
    "shimla": (31.1048, 77.1734, "India"),
    "rishikesh": (30.0869, 78.2676, "India"),
    "udaipur": (24.5854, 73.7125, "India"),
    "dubai": (25.2048, 55.2708, "UAE"),
    "bali": (-8.4095, 115.1889, "Indonesia"),
    "paris": (48.8566, 2.3522, "France"),
    "london": (51.5074, -0.1278, "UK"),
    "singapore": (1.3521, 103.8198, "Singapore"),
    "bangkok": (13.7563, 100.5018, "Thailand"),
    "tokyo": (35.6762, 139.6503, "Japan"),
    "rome": (41.9028, 12.4964, "Italy"),
    "new york": (40.7128, -74.0060, "USA"),
    "male": (4.1755, 73.5093, "Maldives"),
    "maldives": (4.1755, 73.5093, "Maldives"),
    "sri lanka": (6.9271, 79.8612, "Sri Lanka"),
    "colombo": (6.9271, 79.8612, "Sri Lanka"),
}

_geocache: dict = {}

def geocode_city(name: str):
    """Resolve a place name to coordinates. Uses a local table first, then the
    Open-Meteo geocoding API (no API key required). Returns dict or None."""
    key = name.strip().lower()
    if not key:
        return None
    for token, (lat, lon, country) in LOCAL_COORDS.items():
        if token in key:
            return {"name": name.strip(), "lat": lat, "lon": lon, "country": country}
    if key in _geocache:
        return _geocache[key]
    try:
        import urllib.request, urllib.parse
        url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(
            {"name": name.strip(), "count": 1, "language": "en", "format": "json"})
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        results = data.get("results") or []
        if not results:
            _geocache[key] = None
            return None
        p = results[0]
        out = {"name": name.strip(), "lat": p["latitude"], "lon": p["longitude"], "country": p.get("country", "")}
        _geocache[key] = out
        return out
    except Exception:
        return None

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 1)

def _route_distance(order):
    return sum(haversine_km(order[i]["lat"], order[i]["lon"], order[i + 1]["lat"], order[i + 1]["lon"]) for i in range(len(order) - 1))

def optimize_route(cities: List[str]):
    """Geocode each city and re-order them with a nearest-neighbour heuristic so
    the total travel distance is minimised. Keeps the first stop as the start."""
    resolved, missing = [], []
    for name in cities:
        coords = geocode_city(name)
        if coords:
            resolved.append(coords)
        else:
            missing.append(name)
    # de-duplicate consecutive identical coordinates
    deduped = []
    for c in resolved:
        if not deduped or (deduped[-1]["lat"], deduped[-1]["lon"]) != (c["lat"], c["lon"]):
            deduped.append(c)
    resolved = deduped

    if len(resolved) <= 1:
        order = resolved
    else:
        remaining = resolved[1:]
        order = [resolved[0]]
        while remaining:
            last = order[-1]
            nearest = min(remaining, key=lambda c: haversine_km(last["lat"], last["lon"], c["lat"], c["lon"]))
            order.append(nearest)
            remaining.remove(nearest)

    legs = []
    for i in range(len(order) - 1):
        km = haversine_km(order[i]["lat"], order[i]["lon"], order[i + 1]["lat"], order[i + 1]["lon"])
        legs.append({
            "from": order[i]["name"], "to": order[i + 1]["name"],
            "distance_km": km,
            "duration_hours": round(km * 1.25 / 55, 1),  # road factor, avg 55 km/h
        })
    total_km = round(sum(l["distance_km"] for l in legs), 1)
    total_hours = round(sum(l["duration_hours"] for l in legs), 1)
    original_km = _route_distance(resolved)
    route_points = [{"order": i + 1, **p} for i, p in enumerate(order)]
    best_mode = "flight" if total_km > 900 else ("train" if total_km > 300 else "road")
    mode_label = {"flight": "Flights + local transfers", "train": "Train / intercity bus", "road": "Road trip (self-drive or taxi)"}[best_mode]
    return {
        "route": route_points,
        "legs": legs,
        "optimizedOrder": [p["name"] for p in order],
        "originalOrder": [p["name"] for p in resolved],
        "totalDistanceKm": total_km,
        "totalDurationHours": total_hours,
        "distanceSavedKm": round(max(original_km - total_km, 0), 1),
        "suggestedTransport": mode_label,
        "transportMode": best_mode,
        "unresolved": missing,
    }

def local_coords(name: str):
    """Coordinate lookup from the local table only (no network) — used to attach
    instant map points to a generated itinerary."""
    key = name.strip().lower()
    for token, (lat, lon, country) in LOCAL_COORDS.items():
        if token in key:
            return {"name": name.strip(), "lat": lat, "lon": lon, "country": country}
    return None


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)

class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: Optional[str] = Field(default=None, max_length=100)
    preferences: Optional[dict] = None

class TripPlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    destination: str = Field(min_length=1, max_length=120)
    cities: str = Field(default="", max_length=500)
    dates: str = Field(default="", max_length=100)
    travellers: str = Field(default="2 travellers", max_length=50)
    budget: str = Field(default="₹10,000", max_length=50)
    interests: list[str] = Field(default_factory=list, max_length=15)
    num_days: int = Field(default=3, ge=1, le=14)

class SaveTripRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=500)
    trip: dict
    is_public: bool = False

class ExpenseRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    category: str = Field(default="Other", max_length=50)
    date: str = Field(default="", max_length=20)
    trip_id: Optional[int] = None

class ReviewRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    place: str = Field(min_length=1, max_length=200)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=5, max_length=2000)

class BookingRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    type: str = Field(default="hotel", max_length=30)  # hotel | flight | activity
    name: str = Field(min_length=1, max_length=200)
    destination: str = Field(min_length=1, max_length=200)
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    price: Optional[float] = None
    details: dict = Field(default_factory=dict)

class DestinationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    country: str = Field(default="", max_length=100)
    tag: str = Field(default="Discover", max_length=50)
    img: str = Field(default="", max_length=300)
    days: str = Field(default="3–5 days", max_length=30)
    price: str = Field(default="From ₹5,000", max_length=30)
    description: str = Field(default="", max_length=500)
    highlights: list[str] = Field(default_factory=list)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    destination: Optional[str] = None
    budget: Optional[str] = None
    context: Optional[str] = None

class RouteRequest(BaseModel):
    cities: list[str] = Field(min_length=1, max_length=12)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def home(): return {"message": "Welcome to TripGenie AI v2!", "docs": "/docs", "version": "2.0.0"}

@app.get("/api/health")
def health(): return {"status": "healthy", "project": "TripGenie AI", "version": "2.0.0", "timestamp": now()}


# Auth
@app.post("/api/auth/signup", status_code=201)
def signup(req: SignupRequest):
    email = req.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(422, "Enter a valid email address.")
    try:
        with db() as c:
            existing_users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            role = "admin" if existing_users == 0 else "user"
            cur = c.execute(
                "INSERT INTO users(name,email,password_hash,role,preferences,created_at) VALUES(?,?,?,?,?,?)",
                (req.name.strip(), email, hash_password(req.password), role, "{}", now())
            )
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists. Please log in.")
    return {"token": make_token(uid), "user": {"id": uid, "name": req.name.strip(), "email": email, "role": role}}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    with db() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect.")
    return {"token": make_token(row["id"]), "user": {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}}

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    prefs = {}
    try:
        prefs = json.loads(user.get("preferences") or "{}")
    except Exception:
        pass
    return {"user": {**user, "preferences": prefs}}

@app.put("/api/auth/me")
def update_profile(req: UpdateProfileRequest, user=Depends(current_user)):
    updates = {}
    if req.name:
        updates["name"] = req.name
    if req.preferences is not None:
        updates["preferences"] = json.dumps(req.preferences)
    if not updates:
        return {"user": user}
    sets = ", ".join(f"{k}=?" for k in updates)
    vals = list(updates.values()) + [user["id"]]
    with db() as c:
        c.execute(f"UPDATE users SET {sets} WHERE id=?", vals)
        row = c.execute("SELECT id,name,email,role,preferences,created_at FROM users WHERE id=?", (user["id"],)).fetchone()
    return {"user": dict(row)}


# Trip Planning
@app.post("/api/plan-trip")
def plan_trip(req: TripPlanRequest, user=Depends(optional_user)):
    itinerary = generate_itinerary(
        destination=req.destination,
        dates=req.dates,
        travellers=req.travellers,
        budget=req.budget,
        interests=req.interests or ["Explore"],
        cities=req.cities,
        num_days=req.num_days
    )
    # Personalize if user logged in
    if user:
        try:
            prefs = json.loads(user.get("preferences") or "{}")
            if prefs.get("preferred_style"):
                itinerary["personalNote"] = f"Personalized for your {prefs['preferred_style']} travel style."
        except Exception:
            pass
    return itinerary

@app.get("/api/destinations")
def list_destinations():
    with db() as c:
        rows = c.execute("SELECT * FROM destinations ORDER BY id ASC").fetchall()
    return {"destinations": [dict(r) for r in rows]}

@app.get("/api/destinations/{dest_id}")
def get_destination(dest_id: int):
    with db() as c:
        row = c.execute("SELECT * FROM destinations WHERE id=?", (dest_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Destination not found.")
    return dict(row)


# Route Optimization
@app.post("/api/optimize-route")
def optimize_route_endpoint(req: RouteRequest):
    cities = [c.strip() for c in req.cities if c and c.strip()]
    if not cities:
        raise HTTPException(422, "Provide at least one city.")
    result = optimize_route(cities)
    if not result["route"]:
        raise HTTPException(404, "Could not locate any of the given places. Try more specific names.")
    return result


# Personalised Recommendations
INTEREST_KEYWORDS = {
    "nature": ["nature", "serenity", "greenery", "backwater", "wildlife", "tea", "waterfall"],
    "adventure": ["adventure", "altitude", "trek", "mountain", "pass", "valley", "camp", "rafting"],
    "food": ["food", "cuisine", "market", "street", "culinary"],
    "culture": ["culture", "heritage", "fort", "palace", "museum", "temple", "history"],
    "relaxation": ["beach", "serenity", "backwater", "lake", "spa", "sunshine", "peaceful"],
    "nightlife": ["night", "party", "market", "beach", "bar"],
    "shopping": ["market", "bazaar", "shopping", "mall"],
    "spiritual": ["spiritual", "temple", "aarti", "monastery", "ghat", "sacred"],
    "photography": ["viewpoint", "lake", "sunset", "landscape", "scenic", "valley"],
    "sports": ["water sports", "rafting", "ski", "bike", "trek", "surf"],
}

def _match_interests(text, interests):
    text = text.lower()
    score, hits = 0, []
    for interest in interests:
        for kw in INTEREST_KEYWORDS.get(interest.lower(), []):
            if kw in text:
                score += 2
                hits.append(interest)
                break
    return score, sorted(set(hits))

@app.get("/api/recommendations")
def recommendations(limit: int = Query(default=6, ge=1, le=12), user=Depends(optional_user)):
    with db() as c:
        dests = [dict(r) for r in c.execute("SELECT * FROM destinations ORDER BY id ASC").fetchall()]
        review_counts = {r["place"].lower(): r["n"] for r in c.execute(
            "SELECT LOWER(place) AS place, COUNT(*) AS n FROM reviews GROUP BY LOWER(place)").fetchall()}
        booking_counts = {r["destination"].lower(): r["n"] for r in c.execute(
            "SELECT LOWER(destination) AS destination, COUNT(*) AS n FROM bookings GROUP BY LOWER(destination)").fetchall()}

    interests, saved_names = [], []
    if user:
        try:
            prefs = json.loads(user.get("preferences") or "{}")
            interests = prefs.get("interests") or []
            style = (prefs.get("preferred_style") or "").lower()
            if style and style not in [i.lower() for i in interests]:
                interests.append(style)
        except Exception:
            pass
        with db() as c:
            saved_names = [r["destination"].lower() for r in c.execute(
                "SELECT destination FROM trips WHERE user_id=?", (user["id"],)).fetchall()]

    scored = []
    for d in dests:
        text = " ".join([d.get("tag", ""), d.get("description", ""), d.get("name", ""), str(d.get("highlights", ""))])
        popularity = 0
        for k, n in review_counts.items():
            if k and (k in d["name"].lower() or d["name"].lower() in k):
                popularity += n * 3
        for k, n in booking_counts.items():
            if k and (k in d["name"].lower() or d["name"].lower() in k):
                popularity += n * 2
        match_score, hits = _match_interests(text, interests)
        saved_boost = 6 if any(s and (s in d["name"].lower() or d["name"].lower() in s) for s in saved_names) else 0
        total = popularity + match_score + saved_boost
        if hits:
            reason = f"Matches your interest in {', '.join(hits)}"
        elif saved_boost:
            reason = "Similar to trips you've saved"
        elif popularity:
            reason = "Popular with TripGenie travellers"
        else:
            reason = "A great place to start exploring"
        scored.append({**d, "score": total, "reason": reason, "matchedInterests": hits})

    scored.sort(key=lambda x: (x["score"], -x["id"]), reverse=True)
    return {"recommendations": scored[:limit], "interests": interests}



# Saved Trips
@app.get("/api/trips")
def list_trips(user=Depends(current_user)):
    with db() as c:
        rows = c.execute("SELECT id,destination,trip_json,is_public,created_at FROM trips WHERE user_id=? ORDER BY id DESC", (user["id"],)).fetchall()
    return {"trips": [{"id": r["id"], "destination": r["destination"], "trip": json.loads(r["trip_json"]), "isPublic": bool(r["is_public"]), "createdAt": r["created_at"]} for r in rows]}

@app.get("/api/trips/public")
def list_public_trips(limit: int = Query(default=12, le=50)):
    with db() as c:
        rows = c.execute("""
            SELECT t.id, t.destination, t.trip_json, t.created_at, u.name as author
            FROM trips t JOIN users u ON t.user_id=u.id
            WHERE t.is_public=1 ORDER BY t.id DESC LIMIT ?
        """, (limit,)).fetchall()
    return {"trips": [{"id": r["id"], "destination": r["destination"], "trip": json.loads(r["trip_json"]), "author": r["author"], "createdAt": r["created_at"]} for r in rows]}

@app.post("/api/trips", status_code=201)
def save_trip(req: SaveTripRequest, user=Depends(current_user)):
    with db() as c:
        cur = c.execute(
            "INSERT INTO trips(user_id,destination,trip_json,is_public,created_at) VALUES(?,?,?,?,?)",
            (user["id"], req.destination, json.dumps(req.trip, ensure_ascii=False), 1 if req.is_public else 0, now())
        )
        trip_id = cur.lastrowid
    return {"id": trip_id, "destination": req.destination, "trip": req.trip}

@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: int, user=Depends(current_user)):
    with db() as c:
        cur = c.execute("DELETE FROM trips WHERE id=? AND user_id=?", (trip_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(404, "Saved trip not found.")
    return {"deleted": True}


# Expenses
@app.get("/api/expenses")
def list_expenses(user=Depends(current_user)):
    with db() as c:
        rows = c.execute("SELECT * FROM expenses WHERE user_id=? ORDER BY id DESC", (user["id"],)).fetchall()
    return {"expenses": [dict(r) for r in rows]}

@app.post("/api/expenses", status_code=201)
def add_expense(req: ExpenseRequest, user=Depends(current_user)):
    date = req.date or datetime.now().strftime("%Y-%m-%d")
    with db() as c:
        cur = c.execute(
            "INSERT INTO expenses(user_id,trip_id,name,amount,category,date,created_at) VALUES(?,?,?,?,?,?,?)",
            (user["id"], req.trip_id, req.name, req.amount, req.category, date, now())
        )
        eid = cur.lastrowid
        row = c.execute("SELECT * FROM expenses WHERE id=?", (eid,)).fetchone()
    return dict(row)

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, user=Depends(current_user)):
    with db() as c:
        cur = c.execute("DELETE FROM expenses WHERE id=? AND user_id=?", (expense_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(404, "Expense not found.")
    return {"deleted": True}

@app.get("/api/expenses/summary")
def expense_summary(user=Depends(current_user)):
    with db() as c:
        rows = c.execute("SELECT category, SUM(amount) as total FROM expenses WHERE user_id=? GROUP BY category", (user["id"],)).fetchall()
        grand = c.execute("SELECT SUM(amount) as total FROM expenses WHERE user_id=?", (user["id"],)).fetchone()
    return {"byCategory": [{"category": r["category"], "total": r["total"]} for r in rows], "grandTotal": grand["total"] or 0}


# Reviews
@app.get("/api/reviews")
def list_reviews(place: Optional[str] = Query(default=None)):
    with db() as c:
        if place:
            rows = c.execute("SELECT * FROM reviews WHERE LOWER(place) LIKE ? ORDER BY id DESC", (f"%{place.lower()}%",)).fetchall()
        else:
            rows = c.execute("SELECT * FROM reviews ORDER BY id DESC LIMIT 50").fetchall()
    return {"reviews": [dict(r) for r in rows]}

@app.post("/api/reviews", status_code=201)
def add_review(req: ReviewRequest, user=Depends(optional_user)):
    by_name = user["name"] if user else "Anonymous"
    with db() as c:
        cur = c.execute(
            "INSERT INTO reviews(user_id,place,rating,text,by_name,created_at) VALUES(?,?,?,?,?,?)",
            (user["id"] if user else None, req.place, req.rating, req.text, by_name, now())
        )
        rid = cur.lastrowid
        row = c.execute("SELECT * FROM reviews WHERE id=?", (rid,)).fetchone()
    return dict(row)

@app.delete("/api/reviews/{review_id}")
def delete_review(review_id: int, user=Depends(current_user)):
    with db() as c:
        if user["role"] == "admin":
            cur = c.execute("DELETE FROM reviews WHERE id=?", (review_id,))
        else:
            cur = c.execute("DELETE FROM reviews WHERE id=? AND user_id=?", (review_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(404, "Review not found.")
    return {"deleted": True}


# Bookings
@app.get("/api/bookings")
def list_bookings(user=Depends(current_user)):
    with db() as c:
        rows = c.execute("SELECT * FROM bookings WHERE user_id=? ORDER BY id DESC", (user["id"],)).fetchall()
    return {"bookings": [{**dict(r), "details": json.loads(r["details"])} for r in rows]}

@app.post("/api/bookings", status_code=201)
def create_booking(req: BookingRequest, user=Depends(current_user)):
    with db() as c:
        cur = c.execute(
            "INSERT INTO bookings(user_id,type,name,destination,check_in,check_out,price,status,details,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (user["id"], req.type, req.name, req.destination, req.check_in, req.check_out, req.price, "confirmed", json.dumps(req.details), now())
        )
        bid = cur.lastrowid
        row = c.execute("SELECT * FROM bookings WHERE id=?", (bid,)).fetchone()
    return {**dict(row), "details": json.loads(row["details"])}

@app.delete("/api/bookings/{booking_id}")
def cancel_booking(booking_id: int, user=Depends(current_user)):
    with db() as c:
        cur = c.execute("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=?", (booking_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(404, "Booking not found.")
    return {"cancelled": True}


# AI Travel Chatbot
CHAT_KNOWLEDGE = {
    "budget": lambda dest, budget: f"For {dest or 'your destination'}, with a {budget or '₹10,000'} budget, allocate: 32% accommodation, 20% food, 28% transport, 10% activities, and keep a 10% buffer for surprises. Book transport in advance to save up to 30%.",
    "pack": lambda dest, _: f"For {dest or 'your trip'}: pack weather-appropriate layers, comfortable walking shoes, ID, medication, charger, power bank, reusable water bottle, and booking confirmations. Check the weather forecast 48hrs before departure.",
    "hotel": lambda dest, _: f"For stays in {dest or 'your destination'}, compare reviews on TripAdvisor, check cancellation policies (free cancellation is always safer), verify the location on Google Maps, and watch for hidden taxes. Booking 4–6 weeks early gives best rates.",
    "food": lambda dest, _: f"In {dest or 'your destination'}, always try the local street food — it's authentic and affordable. Look for busy stalls (popularity = safety). Carry antacids just in case and drink only bottled or filtered water.",
    "safety": lambda dest, _: f"Stay safe in {dest or 'your destination'}: keep digital copies of your documents, share your itinerary with someone at home, use hotel-booked transport at night, and keep emergency contacts saved offline.",
    "visa": lambda dest, _: f"Check visa requirements for {dest or 'your destination'} at the official government travel portal. Indian citizens can visit many SEA destinations visa-on-arrival. Always check at least 4 weeks before your travel date.",
    "weather": lambda dest, _: f"Use the Weather tab in TripGenie to get a live 3-day forecast for {dest or 'your destination'} powered by Open-Meteo (no API key needed). Best to check 48–72 hours before departure for accuracy.",
    "itinerary": lambda dest, budget: f"Use the Plan Trip form to create a day-by-day itinerary for {dest or 'your destination'}. Set your budget ({budget or '₹10,000'}), add multiple cities for a multi-city trip, and pick your interests for a personalized plan.",
}

@app.post("/api/chat")
def chat(req: ChatRequest, user=Depends(optional_user)):
    msg = req.message.lower()
    dest = req.destination or "your destination"
    budget = req.budget or "your budget"

    # Match intent
    answer = None
    for keyword, fn in CHAT_KNOWLEDGE.items():
        if keyword in msg:
            answer = fn(dest, budget)
            break

    if not answer:
        if any(w in msg for w in ["hello", "hi", "hey", "start"]):
            name = user["name"] if user else "traveller"
            answer = f"Hi {name}! 👋 I'm your TripGenie AI assistant. Ask me about destinations, budgets, packing, hotels, food, safety, visa, or itinerary planning. I'm here to make your trip perfect!"
        elif any(w in msg for w in ["recommend", "suggest", "best place", "where should"]):
            answer = f"Top destinations right now: 🏖️ **Goa** (beaches, Nov–Feb), 🏔️ **Manali** (mountains, Oct–Jun), 🏯 **Jaipur** (culture, Oct–Mar), 🌿 **Kerala** (nature, Sep–Mar), ⛰️ **Ladakh** (adventure, Jun–Sep). Which interests you most?"
        elif any(w in msg for w in ["flight", "train", "transport", "travel"]):
            answer = "For flights, compare on MakeMyTrip, Ixigo or Google Flights — book 3–6 weeks ahead for best prices. For trains in India, book on IRCTC at least 2 months ahead. Consider overnight trains to save on one night's accommodation!"
        else:
            answer = f"Great question about {dest}! For the most accurate and personalized advice, I recommend using the **Plan Trip** form to generate a full itinerary. You can also check **Weather**, **Expenses**, and **Reviews** sections for more insights. What else can I help with?"

    return {
        "answer": answer,
        "timestamp": now(),
        "user": user["name"] if user else "Guest"
    }


# Admin
@app.get("/api/admin/stats")
def admin_stats(admin=Depends(require_admin)):
    with db() as c:
        users_count = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        trips_count = c.execute("SELECT COUNT(*) FROM trips").fetchone()[0]
        reviews_count = c.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
        bookings_count = c.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        destinations_count = c.execute("SELECT COUNT(*) FROM destinations").fetchone()[0]
        recent_users = c.execute("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC LIMIT 10").fetchall()
    return {
        "stats": {
            "users": users_count,
            "trips": trips_count,
            "reviews": reviews_count,
            "bookings": bookings_count,
            "destinations": destinations_count,
        },
        "recentUsers": [dict(u) for u in recent_users]
    }

@app.get("/api/admin/users")
def admin_list_users(admin=Depends(require_admin)):
    with db() as c:
        rows = c.execute("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC").fetchall()
    return {"users": [dict(r) for r in rows]}

@app.put("/api/admin/users/{user_id}/role")
def admin_set_role(user_id: int, role: str = Query(...), admin=Depends(require_admin)):
    if role not in ("user", "admin"):
        raise HTTPException(422, "Role must be 'user' or 'admin'.")
    with db() as c:
        c.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
    return {"updated": True}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot delete your own admin account.")
    with db() as c:
        cur = c.execute("DELETE FROM users WHERE id=?", (user_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "User not found.")
    return {"deleted": True}

@app.post("/api/admin/destinations", status_code=201)
def admin_add_destination(req: DestinationRequest, admin=Depends(require_admin)):
    try:
        with db() as c:
            cur = c.execute(
                "INSERT INTO destinations(name,country,tag,img,days,price,description,highlights,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                (req.name, req.country, req.tag, req.img, req.days, req.price, req.description, json.dumps(req.highlights), now())
            )
            did = cur.lastrowid
            row = c.execute("SELECT * FROM destinations WHERE id=?", (did,)).fetchone()
        return dict(row)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "A destination with this name already exists.")

@app.delete("/api/admin/destinations/{dest_id}")
def admin_delete_destination(dest_id: int, admin=Depends(require_admin)):
    with db() as c:
        cur = c.execute("DELETE FROM destinations WHERE id=?", (dest_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Destination not found.")
    return {"deleted": True}
