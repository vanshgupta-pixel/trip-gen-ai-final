# TripGenie AI — Full-stack starter

## Requirements
- Python 3.10+
- Node.js 20+ (recommended)

## Run the backend
```bash
cd tripgenie-backend/backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs
Health: http://localhost:8000/api/health

## Run the frontend (new terminal)
```bash
cd tripgenie-frontend
npm install
npm run dev
```
Open http://localhost:5173. The frontend defaults to http://localhost:8000 for backend requests; set `VITE_API_URL` in `.env` when deployed.

## Implemented API
- `POST /api/auth/signup` — creates account and returns a bearer token (first account becomes admin)
- `POST /api/auth/login` — verifies password and returns token
- `GET /api/auth/me`, `PUT /api/auth/me` — read/update profile & travel preferences
- `POST /api/plan-trip` — returns a personalized day-by-day itinerary (multi-city supported)
- `POST /api/optimize-route` — geocodes cities and returns a distance-optimized route with map points
- `GET /api/recommendations` — personalized destination suggestions from user preferences & saved trips
- `GET/POST /api/trips`, `DELETE /api/trips/{id}` — saved trips for authenticated users
- `GET /api/destinations` — destination catalogue
- `GET/POST/DELETE /api/expenses` — travel expense tracker
- `GET/POST/DELETE /api/reviews` — reviews & ratings
- `GET/POST/DELETE /api/bookings` — hotel / flight / activity bookings
- `POST /api/chat` — AI travel chatbot
- `GET /api/admin/*` — admin dashboard (users, destinations, stats)
- `GET /api/health` — health check

## Feature map
AI itinerary generation · destination recommendations · budget optimization · interactive map &
route optimization (Leaflet + OpenStreetMap) · hotel & travel booking · auth & saved trips ·
AI travel chatbot · live weather (Open-Meteo) · expense tracker (estimated vs actual) ·
reviews & ratings · PDF itinerary export · responsive design · admin dashboard · multi-city
planning · personalized recommendations.

## Before production
Set a strong random `SECRET_KEY`; configure `ALLOWED_ORIGINS` to the exact deployed frontend origin; use persistent storage for SQLite or migrate to PostgreSQL; enable HTTPS; implement rate limiting, password reset/email verification, and server-side authorization for any admin tools. Route optimization and weather use free keyless services (Open-Meteo, OpenStreetMap); map tiles and geocoding require outbound internet access. Hotel/transport booking and real payment integrations are not included (bookings are stored records only).
