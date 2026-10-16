import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plane, MapPin, CalendarDays, Users, Wallet, Sparkles, ShieldCheck, Map,
  Building2, Compass, Menu, Search, ArrowRight, Clock3, Heart, ChevronDown,
  X, Mountain, Camera, Coffee, LogIn, LogOut, User, CloudSun, MessageCircle,
  Download, Plus, Trash2, Star, Receipt, Navigation, Send, CheckCircle2,
  Hotel, Zap, Globe, Sun, Wind, Droplets, Thermometer, TrendingUp, BarChart3,
  Shield, Bell, Settings, Eye, EyeOff, PieChart, Map as MapIcon, Bookmark,
  Award, Filter, SortAsc, ChevronUp, RefreshCw, AlertCircle, Info, Check,
  Phone, Mail, FileText, Car, Activity, Loader, Lock, Edit3, Save, Home,
  Layers, Tag, Package, Briefcase, DollarSign, Grid, List, MoreHorizontal,
  Clock, Share2, ExternalLink, Maximize2, ChevronLeft, ChevronRight, Bot
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const INTEREST_OPTIONS = ['Nature', 'Adventure', 'Food', 'Culture', 'Relaxation', 'Nightlife', 'Shopping', 'Spiritual', 'Photography', 'Sports'];
const EXPENSE_CATEGORIES = ['Food', 'Stay', 'Transport', 'Activity', 'Shopping', 'Medical', 'Other'];
const BUDGET_OPTIONS = ['₹5,000', '₹10,000', '₹15,000', '₹25,000', '₹50,000', '₹1,00,000', '₹2,00,000+'];

const DEFAULT_DESTINATIONS = [
  { id: 1, name: 'Manali, Himachal Pradesh', days: '3–5 days', price: 'From ₹6,500', img: 'photo-1626621341517-bbf3d9990a23', tag: 'Mountain escape', description: 'A stunning hill station nestled in the Himalayas.', highlights: ['Rohtang Pass','Solang Valley','Hadimba Temple','Old Manali'] },
  { id: 2, name: 'Goa, India', days: '3–4 days', price: 'From ₹7,000', img: 'photo-1512343879784-a960bf40e7f2', tag: 'Beach & sunshine', description: "India's favourite coastal paradise.", highlights: ['Baga Beach','Old Goa Churches','Dudhsagar Falls','Night Markets'] },
  { id: 3, name: 'Jaipur, Rajasthan', days: '2–3 days', price: 'From ₹4,500', img: 'photo-1599661046827-dacff0c0f09a', tag: 'Culture & heritage', description: 'The Pink City — forts, palaces and vibrant bazaars.', highlights: ['Amber Fort','Hawa Mahal','City Palace','Jantar Mantar'] },
  { id: 4, name: 'Kerala Backwaters', days: '4–6 days', price: 'From ₹9,000', img: 'photo-1602216056096-3b40cc0c9944', tag: 'Nature & serenity', description: "God's own country — lush greenery and backwaters.", highlights: ['Alleppey Houseboats','Munnar Tea Gardens','Periyar Wildlife','Kovalam Beach'] },
  { id: 5, name: 'Leh-Ladakh', days: '5–7 days', price: 'From ₹12,000', img: 'photo-1506038634487-60a69ae4b7b1', tag: 'Adventure & altitude', description: 'High-altitude desert landscapes and monasteries.', highlights: ['Pangong Lake','Nubra Valley','Magnetic Hill','Hemis Monastery'] },
  { id: 6, name: 'Varanasi, UP', days: '2–3 days', price: 'From ₹3,500', img: 'photo-1561361058-c24cecae35ca', tag: 'Spiritual journey', description: 'The spiritual capital of India on the Ganges.', highlights: ['Ganga Aarti','Dashashwamedh Ghat','Kashi Vishwanath','Sarnath'] },
];

// ── Storage helpers ──────────────────────────────────────────────────────────
const getStore = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const setStore = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('tg_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

// ── Toast notification ───────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  return (
    <div style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`} onClick={() => remove(t.id)}>
          {t.type === 'success' && <CheckCircle2 size={16} />}
          {t.type === 'error' && <AlertCircle size={16} />}
          {t.type === 'info' && <Info size={16} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}

// ── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating, max = 5, size = 14 }) {
  return (
    <span className="star-rating" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} fill={i < rating ? '#f59e0b' : 'none'} color={i < rating ? '#f59e0b' : '#d1d5db'} />
      ))}
    </span>
  );
}

// ── Weather code → description ───────────────────────────────────────────────
const WMO = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 61: 'Slight rain', 63: 'Moderate rain', 71: 'Slight snow', 80: 'Rain showers', 95: 'Thunderstorm' };
const wmoDesc = c => WMO[c] || 'Variable';

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ id, className = '', children }) {
  return <section id={id} className={`section-wrap ${className}`}>{children}</section>;
}

// ── Route optimization helpers ────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function geocodeCity(name) {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    const g = await r.json();
    if (!g.results?.length) return null;
    const p = g.results[0];
    return { name: name.trim(), lat: p.latitude, lon: p.longitude, country: p.country || '' };
  } catch { return null; }
}

// Client-side fallback: geocode then nearest-neighbour ordering
async function optimizeRouteLocal(cities) {
  const resolved = [];
  for (const c of cities) {
    const g = await geocodeCity(c);
    if (g && !resolved.some(p => Math.abs(p.lat - g.lat) < 0.01 && Math.abs(p.lon - g.lon) < 0.01)) resolved.push(g);
  }
  if (resolved.length <= 1) return resolved.length ? { route: resolved.map((p, i) => ({ ...p, order: i + 1 })) } : null;
  const remaining = resolved.slice(1);
  const order = [resolved[0]];
  while (remaining.length) {
    const last = order[order.length - 1];
    let bi = 0, bd = Infinity;
    remaining.forEach((c, i) => { const d = haversineKm(last, c); if (d < bd) { bd = d; bi = i; } });
    order.push(remaining.splice(bi, 1)[0]);
  }
  const legs = order.slice(0, -1).map((p, i) => ({ from: p.name, to: order[i + 1].name, distance_km: Math.round(haversineKm(p, order[i + 1]) * 10) / 10 }));
  const total = Math.round(legs.reduce((s, l) => s + l.distance_km, 0) * 10) / 10;
  return {
    route: order.map((p, i) => ({ ...p, order: i + 1 })), legs,
    optimizedOrder: order.map(p => p.name), totalDistanceKm: total,
    totalDurationHours: Math.round((total * 1.25 / 55) * 10) / 10,
    suggestedTransport: total > 900 ? 'Flights + local transfers' : total > 300 ? 'Train / intercity bus' : 'Road trip (self-drive or taxi)',
    transportMode: total > 900 ? 'flight' : total > 300 ? 'train' : 'road', local: true,
  };
}

// ── Interactive map (Leaflet, loaded from CDN) ─────────────────────────────────
function InteractiveMap({ points, height = 340 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current || !points?.length) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([points[0].lat, points[0].lon], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const latlngs = points.map(p => [p.lat, p.lon]);
    points.forEach((p, i) => {
      const icon = L.divIcon({ className: 'tg-map-pin', html: `<span>${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      L.marker([p.lat, p.lon], { icon }).addTo(map).bindPopup(`<b>${i + 1}. ${p.name}</b>${p.country ? `<br/>${p.country}` : ''}`);
    });
    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: '#6366f1', weight: 4, opacity: 0.85, dashArray: '9 9' }).addTo(map);
      map.fitBounds(latlngs, { padding: [45, 45] });
    }
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [points]);

  if (!points?.length) return null;
  if (!window.L) {
    return (
      <div className="map-fallback" style={{ height }}>
        <MapIcon size={22} />
        <p>Interactive map unavailable offline.</p>
        <a className="btn btn-outline small" target="_blank" rel="noreferrer"
          href={`https://www.google.com/maps/dir/${points.map(p => encodeURIComponent(p.name)).join('/')}`}>
          Open route in Google Maps <ExternalLink size={13} />
        </a>
      </div>
    );
  }
  return <div className="interactive-map" ref={containerRef} style={{ height }} />;
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Nav
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Toast
  const { toasts, add: toast, remove: removeToast } = useToast();

  // Auth
  const [user, setUser] = useState(() => getStore('tg_user', null));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authShowPw, setAuthShowPw] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Planner
  const [destination, setDestination] = useState('Manali, India');
  const [cities, setCities] = useState('');
  const [dates, setDates] = useState('');
  const [travellers, setTravellers] = useState('2 travellers');
  const [budget, setBudget] = useState('₹10,000');
  const [interests, setInterests] = useState(['Nature', 'Adventure']);
  const [numDays, setNumDays] = useState(3);
  const [itinerary, setItinerary] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);

  // Route optimization + map
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Personalized recommendations
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // Destinations
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS);
  const [destFilter, setDestFilter] = useState('');
  const [destView, setDestView] = useState('grid');
  const [selectedDest, setSelectedDest] = useState(null);

  // Saved trips
  const [savedTrips, setSavedTrips] = useState(() => getStore('tg_saved', []));
  const [tripsLoading, setTripsLoading] = useState(false);

  // Expenses
  const [expenses, setExpenses] = useState([]);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCat, setExpCat] = useState('Food');
  const [expLoading, setExpLoading] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [revPlace, setRevPlace] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revText, setRevText] = useState('');
  const [revFilter, setRevFilter] = useState('');

  // Bookings
  const [bookings, setBookings] = useState([]);
  const [bookingModal, setBookingModal] = useState(false);
  const [bkType, setBkType] = useState('hotel');
  const [bkName, setBkName] = useState('');
  const [bkDest, setBkDest] = useState('');
  const [bkCheckIn, setBkCheckIn] = useState('');
  const [bkCheckOut, setBkCheckOut] = useState('');
  const [bkPrice, setBkPrice] = useState('');

  // Weather
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherDest, setWeatherDest] = useState('');

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([{ from: 'bot', text: "Hi! I'm TripGenie AI 🌍 Ask me about destinations, budgets, packing, hotels, food or itinerary tips!" }]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBodyRef = useRef(null);

  // Admin
  const [adminTab, setAdminTab] = useState('overview');
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDests, setAdminDests] = useState([]);
  const [newDestName, setNewDestName] = useState('');
  const [newDestTag, setNewDestTag] = useState('');

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefStyle, setPrefStyle] = useState('');
  const [prefInterests, setPrefInterests] = useState([]);
  const [prefs, setPrefs] = useState(() => getStore('tg_prefs', {}));

  // ── Route optimization & recommendations (defined before effects that use them) ─
  const optimizeRoute = useCallback(async (cities) => {
    const list = (cities || []).filter(Boolean);
    if (!list.length) return;
    setRouteLoading(true);
    try {
      const data = await apiFetch('/api/optimize-route', { method: 'POST', body: JSON.stringify({ cities: list }) });
      setRoute(data);
    } catch {
      const local = await optimizeRouteLocal(list);
      setRoute(local);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true);
    try {
      const d = await apiFetch('/api/recommendations?limit=6');
      setRecommendations(d.recommendations || []);
    } catch { setRecommendations([]); } finally { setRecLoading(false); }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { setStore('tg_saved', savedTrips); }, [savedTrips]);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatMessages]);

  // Load remote data
  useEffect(() => {
    apiFetch('/api/destinations').then(d => { if (d.destinations?.length) setDestinations(d.destinations); }).catch(() => {});
  }, []);

  // Optimize route whenever a new itinerary is generated
  useEffect(() => {
    if (!itinerary) { setRoute(null); return; }
    const list = (itinerary.cities?.length ? itinerary.cities : [itinerary.destination]);
    optimizeRoute(list);
  }, [itinerary, optimizeRoute]);

  // Personalized recommendations (refresh after login / preference changes)
  useEffect(() => { loadRecommendations(); }, [user, loadRecommendations]);

  // Load saved preferences for the logged-in user
  useEffect(() => {
    if (!user) { setPrefs({}); return; }
    const token = localStorage.getItem('tg_token');
    if (!token) return;
    apiFetch('/api/auth/me')
      .then(d => { const p = d.user?.preferences || {}; setPrefs(p); setStore('tg_prefs', p); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('tg_token');
    if (!token) return;
    setTripsLoading(true);
    apiFetch('/api/trips').then(d => setSavedTrips(d.trips || [])).catch(() => {}).finally(() => setTripsLoading(false));
    apiFetch('/api/expenses').then(d => setExpenses(d.expenses || [])).catch(() => {});
    apiFetch('/api/reviews').then(d => setReviews(d.reviews || [])).catch(() => {});
    apiFetch('/api/bookings').then(d => setBookings(d.bookings || [])).catch(() => {});
  }, [user]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleAuth = async e => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.includes('@') || authPassword.length < 8) {
      setAuthError('Enter a valid email and password (8+ chars).');
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload = authMode === 'signup'
        ? { name: authName.trim() || authEmail.split('@')[0], email: authEmail.trim().toLowerCase(), password: authPassword }
        : { email: authEmail.trim().toLowerCase(), password: authPassword };
      const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('tg_token', data.token);
      setUser(data.user);
      setStore('tg_user', data.user);
      setAuthOpen(false);
      setAuthPassword('');
      toast(authMode === 'signup' ? `Welcome to TripGenie, ${data.user.name}! 🎉` : `Welcome back, ${data.user.name}! ✈️`, 'success');
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tg_user');
    localStorage.removeItem('tg_token');
    setSavedTrips([]);
    setExpenses([]);
    setBookings([]);
    toast('You have been logged out.', 'info');
  };

  // ── Trip planning ──────────────────────────────────────────────────────────
  const planTrip = async e => {
    e?.preventDefault();
    if (!destination.trim()) { toast('Please enter a destination.', 'error'); return; }
    setIsPlanning(true);
    try {
      const data = await apiFetch('/api/plan-trip', {
        method: 'POST',
        body: JSON.stringify({ destination, cities, dates, travellers, budget, interests, num_days: numDays })
      });
      setItinerary(data);
      setWeatherDest(destination.split(',')[0]);
      setTimeout(() => document.getElementById('trip-result')?.scrollIntoView({ behavior: 'smooth' }), 100);
      toast('Your itinerary is ready! 🗺️', 'success');
    } catch (err) {
      // Fallback local generation
      const places = cities.trim() ? cities.split(',').map(s => s.trim()).filter(Boolean) : [destination];
      const budgetNum = parseInt(budget.replace(/[^0-9]/g, '')) || 10000;
      setItinerary({
        destination: places.join(' → '), dates: dates || 'Dates not set', travellers, budget,
        budgetNum, budgetBreakdown: { accommodation: Math.round(budgetNum * 0.32), food: Math.round(budgetNum * 0.20), transport: Math.round(budgetNum * 0.28), activities: Math.round(budgetNum * 0.10), buffer: Math.round(budgetNum * 0.10) },
        interests, cities: places, numDays,
        days: Array.from({ length: Math.min(numDays, 3) }, (_, i) => ({
          label: `DAY ${i + 1}`, title: ['Arrive & explore', 'Discover the highlights', 'Relaxed final day'][i],
          activities: [['Arrive and settle in', 'Explore the main attraction', 'Dinner at a local restaurant'], ['Visit a cultural site', 'Explore the neighbourhood', 'Sunset walk'], ['Morning at leisure', 'Local market', 'Head home']][i]
        })),
        highlights: [], localFood: [], transportTip: 'Use local taxis or auto-rickshaws.', bestTime: 'Year-round', localTip: 'Carry cash and stay hydrated.', estimatedTotal: budgetNum, generatedAt: new Date().toISOString(), generation: 'local'
      });
      toast('Itinerary generated (offline mode). Start the backend for AI-powered plans.', 'info');
    } finally {
      setIsPlanning(false);
    }
  };

  const saveTrip = async trip => {
    if (!user) { setAuthOpen(true); setAuthMode('login'); toast('Log in to save trips.', 'info'); return; }
    const item = trip || itinerary;
    if (!item) return;
    const alreadySaved = savedTrips.some(t => t.destination === item.destination);
    if (alreadySaved) { toast('Already in your saved trips.', 'info'); return; }
    try {
      const data = await apiFetch('/api/trips', { method: 'POST', body: JSON.stringify({ destination: item.destination, trip: item }) });
      setSavedTrips(p => [{ id: data.id, destination: data.destination, trip: data.trip, createdAt: new Date().toISOString() }, ...p]);
      toast('Trip saved! ❤️', 'success');
    } catch {
      setSavedTrips(p => [{ destination: item.destination, trip: item, createdAt: new Date().toISOString() }, ...p]);
      toast('Trip saved locally.', 'info');
    }
  };

  const deleteTrip = async (trip, idx) => {
    try {
      if (trip.id) await apiFetch(`/api/trips/${trip.id}`, { method: 'DELETE' });
    } catch {}
    setSavedTrips(p => p.filter((_, i) => i !== idx));
    toast('Trip removed.', 'info');
  };

  // ── Expenses ───────────────────────────────────────────────────────────────
  const totalExpenses = useMemo(() => expenses.reduce((s, x) => s + Number(x.amount || 0), 0), [expenses]);
  const expByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(x => { map[x.category] = (map[x.category] || 0) + Number(x.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const addExpense = async e => {
    e.preventDefault();
    const amount = Number(expAmount);
    if (!expName.trim() || !amount || amount < 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const newExp = { id: Date.now(), name: expName.trim(), amount, category: expCat, date, created_at: new Date().toISOString() };
    setExpenses(p => [newExp, ...p]);
    setExpName(''); setExpAmount('');
    try {
      const saved = await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify({ name: expName.trim(), amount, category: expCat, date }) });
      setExpenses(p => p.map(x => x.id === newExp.id ? saved : x));
    } catch {}
    toast('Expense added.', 'success');
  };

  const deleteExpense = async exp => {
    setExpenses(p => p.filter(x => x.id !== exp.id));
    try { if (exp.id && typeof exp.id === 'number' && exp.id < 1e12) await apiFetch(`/api/expenses/${exp.id}`, { method: 'DELETE' }); } catch {}
  };

  // ── Reviews ────────────────────────────────────────────────────────────────
  const submitReview = async e => {
    e.preventDefault();
    if (!revPlace.trim() || !revText.trim()) return;
    const newRev = { id: Date.now(), place: revPlace.trim(), rating: revRating, text: revText.trim(), by_name: user?.name || 'Guest', created_at: new Date().toISOString() };
    setReviews(p => [newRev, ...p]);
    setRevPlace(''); setRevText(''); setRevRating(5);
    try {
      const saved = await apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify({ place: revPlace.trim(), rating: revRating, text: revText.trim() }) });
      setReviews(p => p.map(x => x.id === newRev.id ? saved : x));
      toast('Review posted! ⭐', 'success');
    } catch { toast('Review saved locally.', 'info'); }
  };

  // ── Bookings ───────────────────────────────────────────────────────────────
  const addBooking = async e => {
    e.preventDefault();
    if (!bkName.trim() || !bkDest.trim()) return;
    try {
      const data = await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ type: bkType, name: bkName.trim(), destination: bkDest.trim(), check_in: bkCheckIn || null, check_out: bkCheckOut || null, price: bkPrice ? Number(bkPrice) : null })
      });
      setBookings(p => [data, ...p]);
      setBookingModal(false);
      setBkName(''); setBkDest(''); setBkCheckIn(''); setBkCheckOut(''); setBkPrice('');
      toast('Booking confirmed! 🏨', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const cancelBooking = async bk => {
    try { await apiFetch(`/api/bookings/${bk.id}`, { method: 'DELETE' }); } catch {}
    setBookings(p => p.map(x => x.id === bk.id ? { ...x, status: 'cancelled' } : x));
    toast('Booking cancelled.', 'info');
  };

  // ── Weather ────────────────────────────────────────────────────────────────
  const loadWeather = async (destName) => {
    const d = (destName || weatherDest || destination).split(',')[0].trim();
    if (!d) { toast('Enter a destination first.', 'error'); return; }
    setWeatherLoading(true); setWeather(null);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(d)}&count=1&language=en&format=json`);
      const g = await geo.json();
      if (!g.results?.length) throw new Error('Location not found. Try a different spelling.');
      const p = g.results[0];
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=7`);
      const w = await r.json();
      setWeather({ place: `${p.name}${p.country ? `, ${p.country}` : ''}`, current: w.current, daily: w.daily });
    } catch (err) {
      setWeather({ error: err.message });
    } finally {
      setWeatherLoading(false);
    }
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendChat = async e => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatMessages(p => [...p, { from: 'user', text: q }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: q, destination: destination || null, budget: budget || null })
      });
      setChatMessages(p => [...p, { from: 'bot', text: data.answer }]);
    } catch {
      // Fallback local responses
      const low = q.toLowerCase();
      let answer = `For ${destination}, start with the Plan Trip form. I can help with budgets, packing, hotels and more!`;
      if (/budget|cost|cheap/.test(low)) answer = `For ${destination} with a ${budget} budget: 32% accommodation, 20% food, 28% transport, 10% activities, 10% buffer.`;
      else if (/pack/.test(low)) answer = 'Pack essentials: comfortable shoes, ID, medicines, chargers, water bottle, and booking confirmations.';
      else if (/hotel|stay/.test(low)) answer = 'Compare reviews, check cancellation policies, and verify location before booking. Book 4–6 weeks early for best rates.';
      else if (/recommend|suggest|best/.test(low)) answer = '🏖️ Goa | 🏔️ Manali | 🏯 Jaipur | 🌿 Kerala | ⛰️ Ladakh — all amazing choices!';
      setChatMessages(p => [...p, { from: 'bot', text: answer }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Admin ──────────────────────────────────────────────────────────────────
  const loadAdminData = async () => {
    try {
      const [stats, users, dests] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/destinations'),
      ]);
      setAdminStats(stats);
      setAdminUsers(users.users || []);
      setAdminDests(dests.destinations || []);
    } catch (err) {
      toast('Failed to load admin data: ' + err.message, 'error');
    }
  };

  const exportPdf = () => {
    if (!itinerary) return;
    const it = itinerary;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const daysHtml = (it.days || []).map(d => `
      <div class="day">
        <div class="day-label">${esc(d.label || '')}</div>
        <h3>${esc(d.title || '')}</h3>
        <ul>${(d.activities || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>`).join('');
    const budgetHtml = it.budgetBreakdown
      ? Object.entries(it.budgetBreakdown).map(([k, v]) => `<tr><td>${esc(k.charAt(0).toUpperCase() + k.slice(1))}</td><td>₹${Number(v).toLocaleString('en-IN')}</td></tr>`).join('')
      : '';
    const hotelsHtml = (it.recommendedHotels || []).map(h => `<li>${esc(h.name)}${h.price_per_night ? ` — ~₹${Number(h.price_per_night).toLocaleString('en-IN')}/night` : ''}</li>`).join('');
    const highlights = (it.highlights || []).map(h => `<span class="chip">${esc(h)}</span>`).join('');
    const food = (it.localFood || []).map(f => `<span class="chip chip-food">${esc(f)}</span>`).join('');
    const routeHtml = (route?.route?.length)
      ? `<h2>Optimized Route</h2>
         <ol class="route">${route.route.map(p => `<li>${esc(p.name)}${p.country ? `, ${esc(p.country)}` : ''}</li>`).join('')}</ol>
         <p class="muted">Total distance: <b>${route.totalDistanceKm} km</b> · Est. travel time: <b>${route.totalDurationHours} hrs</b> · ${esc(route.suggestedTransport || '')}</p>`
      : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>TripGenie Itinerary — ${esc(it.destination)}</title>
      <style>
        *{box-sizing:border-box} body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#0f172a;margin:0;padding:40px;line-height:1.55}
        .brand{font-size:22px;font-weight:800;letter-spacing:-.4px} .brand b{color:#6366f1}
        header{border-bottom:3px solid #6366f1;padding-bottom:14px;margin-bottom:22px}
        h1{font-size:26px;margin:8px 0 4px} h2{font-size:17px;margin:26px 0 10px;color:#4338ca}
        h3{font-size:14px;margin:6px 0}
        .sub{color:#64748b;font-size:13px;margin:0}
        .meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
        .meta span{background:#eef2ff;color:#4338ca;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600}
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}
        .chip{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px}
        .chip-food{background:#fff7ed;border-color:#fed7aa}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .day{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;page-break-inside:avoid}
        .day-label{font-size:10px;font-weight:800;letter-spacing:1.2px;color:#6366f1}
        ul{margin:6px 0 0;padding-left:18px;font-size:13px} li{margin:3px 0}
        table{width:100%;border-collapse:collapse;font-size:13px;max-width:420px}
        td{padding:5px 8px;border-bottom:1px solid #eef2f7} td:last-child{text-align:right;font-weight:600}
        ol.route{font-size:13px;padding-left:20px}
        .muted{color:#64748b;font-size:12px}
        footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;color:#94a3b8;font-size:11px}
      </style></head>
      <body>
        <header>
          <div class="brand">Trip<b>Genie</b> AI</div>
          <h1>${esc(it.destination)}</h1>
          <p class="sub">${esc(it.travellers || '')} · ${esc(it.dates || 'Dates not set')} · ${it.numDays || ''} days · ${esc(it.budget || '')}</p>
        </header>
        <div class="meta">
          ${it.bestTime ? `<span>Best time: ${esc(it.bestTime)}</span>` : ''}
          ${it.transportTip ? `<span>${esc(it.transportTip)}</span>` : ''}
        </div>
        ${highlights ? `<h2>Must-visit spots</h2><div class="chips">${highlights}</div>` : ''}
        ${food ? `<h2>Local food to try</h2><div class="chips">${food}</div>` : ''}
        <h2>Day-by-day plan</h2>
        <div class="grid">${daysHtml}</div>
        ${budgetHtml ? `<h2>Budget breakdown</h2><table>${budgetHtml}</table>` : ''}
        ${hotelsHtml ? `<h2>Recommended stays</h2><ul>${hotelsHtml}</ul>` : ''}
        ${routeHtml}
        ${it.localTip ? `<h2>Local tip</h2><p class="muted">${esc(it.localTip)}</p>` : ''}
        <footer>Generated by TripGenie AI · ${new Date().toLocaleDateString()}</footer>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to export your itinerary.', 'error'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 400);
    toast('Itinerary ready — choose "Save as PDF". 🖨️', 'success');
  };

  // ── Filtered reviews ───────────────────────────────────────────────────────
  const filteredReviews = useMemo(() => revFilter
    ? reviews.filter(r => r.place.toLowerCase().includes(revFilter.toLowerCase()))
    : reviews, [reviews, revFilter]);

  const avgRating = useMemo(() => {
    if (!filteredReviews.length) return 0;
    return (filteredReviews.reduce((s, r) => s + r.rating, 0) / filteredReviews.length).toFixed(1);
  }, [filteredReviews]);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'planner', label: 'Plan Trip' },
    { id: 'destinations', label: 'Explore' },
    { id: 'recommendations', label: 'For You' },
    { id: 'my-trips', label: 'My Trips', badge: savedTrips.length || null },
    { id: 'tools', label: 'Tools' },
    { id: 'bookings', label: 'Bookings' },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  const scrollTo = id => {
    setMenuOpen(false);
    setActiveTab(id);
    if (id === 'admin' && user?.role === 'admin') { loadAdminData(); }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* NAVBAR */}
      <header className="navbar">
        <a className="brand" href="#home" aria-label="TripGenie AI home" onClick={() => scrollTo('home')}>
          <span className="brand-mark"><Plane size={22} strokeWidth={2.6} /><span className="brand-orbit" /></span>
          <span>Trip<span className="brand-dark">Genie</span> <b>AI</b></span>
        </a>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          {navLinks.map(l => (
            <a key={l.id} href={`#${l.id}`} className={activeTab === l.id ? 'active' : ''} onClick={() => scrollTo(l.id)}>
              {l.label}
              {l.badge ? <span className="badge">{l.badge}</span> : null}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="icon-btn" aria-label="Search" onClick={() => { scrollTo('destinations'); document.getElementById('dest-search')?.focus(); }}>
            <Search size={20} />
          </button>
          {user ? (
            <>
              <button className="user-chip" onClick={() => { setPrefStyle(prefs.preferred_style || ''); setPrefInterests(prefs.interests || []); setProfileOpen(true); }}>
                <div className="user-avatar">{user.name[0].toUpperCase()}</div>
                <span>{user.name.split(' ')[0]}</span>
              </button>
              <button className="btn btn-ghost small" onClick={logout}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <button className="btn btn-outline small" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}><LogIn size={15} /> Log in</button>
              <button className="btn btn-primary small" onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>Get started</button>
            </>
          )}
        </div>
      </header>

      <main>
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="hero" id="home">
          <div className="hero-image" role="img" aria-label="Scenic mountain lake landscape" />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR AI TRAVEL COMPANION</div>
            <h1>Plan smarter.<br />Travel better.<br /><span>With TripGenie AI</span></h1>
            <p className="hero-copy">Personalized AI itineraries, destination intelligence, budget optimization and real-time booking — all in one place.</p>
            <div className="hero-proof">
              <span><ShieldCheck size={17} /> Budget-aware plans</span>
              <span><Sparkles size={17} /> AI itinerary engine</span>
              <span><Globe size={17} /> Multi-city routing</span>
              <span><CloudSun size={17} /> Live weather</span>
            </div>
            <div className="hero-cta-row">
              <button className="btn btn-primary btn-lg" onClick={() => scrollTo('planner')}>
                <Sparkles size={18} /> Start planning <ArrowRight size={17} />
              </button>
              <button className="btn btn-glass btn-lg" onClick={() => scrollTo('destinations')}>
                <Globe size={17} /> Explore destinations
              </button>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><strong>10K+</strong><span>Trips planned</span></div>
            <div className="hero-stat-divider" />
            <div className="hero-stat"><strong>50+</strong><span>Destinations</span></div>
            <div className="hero-stat-divider" />
            <div className="hero-stat"><strong>4.9★</strong><span>User rating</span></div>
          </div>
          <div className="handwritten">More than just<br />a trip <Plane size={20} /></div>
        </section>

        {/* ── FEATURES STRIP ─────────────────────────────────────────────────── */}
        <div className="features-strip">
          {[
            { icon: Sparkles, label: 'AI Itinerary', color: '#6366f1' },
            { icon: Wallet, label: 'Budget Optimizer', color: '#f59e0b' },
            { icon: MapPin, label: 'Multi-city Routes', color: '#10b981' },
            { icon: CloudSun, label: 'Live Weather', color: '#3b82f6' },
            { icon: Hotel, label: 'Hotel Booking', color: '#ec4899' },
            { icon: Receipt, label: 'Expense Tracker', color: '#8b5cf6' },
            { icon: Star, label: 'Reviews & Ratings', color: '#f59e0b' },
            { icon: Bot, label: 'AI Travel Chat', color: '#14b8a6' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="strip-item">
              <div className="strip-icon" style={{ color, background: `${color}18` }}><Icon size={20} /></div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ── PLANNER ───────────────────────────────────────────────────────── */}
        <section className="planner-section" id="planner">
          <div className="planner-wrap">
            <form className="planner-card" onSubmit={planTrip}>
              <div className="planner-heading">
                <div>
                  <span className="section-kicker">LET'S MAKE IT HAPPEN</span>
                  <h2>Where do you want to go?</h2>
                </div>
                <span className="step-pill"><Sparkles size={14} /> AI-powered planning</span>
              </div>

              <div className="form-grid">
                <label className="field field-lg">
                  <span className="field-icon"><MapPin size={19} /></span>
                  <span className="field-label">Destination *</span>
                  <input id="destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Manali, Goa, Dubai, Bali" required />
                </label>
                <label className="field">
                  <span className="field-icon"><CalendarDays size={19} /></span>
                  <span className="field-label">Travel dates</span>
                  <input value={dates} onChange={e => setDates(e.target.value)} placeholder="e.g. Dec 12–15" />
                </label>
                <label className="field">
                  <span className="field-icon"><Users size={19} /></span>
                  <span className="field-label">Travellers</span>
                  <select value={travellers} onChange={e => setTravellers(e.target.value)}>
                    <option>1 traveller</option><option>2 travellers</option><option>3 travellers</option><option>4 travellers</option><option>5+ travellers</option>
                  </select>
                  <ChevronDown className="select-chevron" size={15} />
                </label>
                <label className="field">
                  <span className="field-icon"><Wallet size={19} /></span>
                  <span className="field-label">Total budget</span>
                  <select value={budget} onChange={e => setBudget(e.target.value)}>
                    {BUDGET_OPTIONS.map(b => <option key={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="select-chevron" size={15} />
                </label>
                <label className="field">
                  <span className="field-icon"><Clock size={19} /></span>
                  <span className="field-label">Duration (days)</span>
                  <select value={numDays} onChange={e => setNumDays(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,10,14].map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
                  </select>
                  <ChevronDown className="select-chevron" size={15} />
                </label>
                <button className="btn btn-primary plan-button" type="submit" disabled={isPlanning}>
                  {isPlanning ? <><Loader size={18} className="spin" /> Planning...</> : <><Sparkles size={18} /> Plan my trip <ArrowRight size={17} /></>}
                </button>
              </div>

              <label className="multi-city-field">
                <span><Layers size={14} /> Multi-city route (optional)</span>
                <input value={cities} onChange={e => setCities(e.target.value)} placeholder="e.g. Delhi, Agra, Jaipur — comma separated" />
              </label>

              <div className="interest-row">
                <span className="interest-label">INTERESTS</span>
                {INTEREST_OPTIONS.map(item => (
                  <button type="button" key={item} onClick={() => setInterests(p => p.includes(item) ? p.filter(x => x !== item) : [...p, item])} className={`interest-chip ${interests.includes(item) ? 'selected' : ''}`}>
                    {item}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        {/* ── ITINERARY RESULT ──────────────────────────────────────────────── */}
        {itinerary && (
          <section className="result-section content-width" id="trip-result">
            <div className="result-header">
              <div>
                <span className="section-kicker">YOUR PERSONALIZED ITINERARY</span>
                <h2>✈️ {itinerary.destination}</h2>
                <p>{itinerary.travellers} · {itinerary.dates} · {itinerary.numDays} days · {itinerary.budget}</p>
              </div>
              <div className="result-actions">
                <button className="btn btn-outline" onClick={() => saveTrip(itinerary)}><Heart size={16} /> Save</button>
                <button className="btn btn-outline" onClick={() => loadWeather(itinerary.destination.split(' → ')[0])}><CloudSun size={16} /> Weather</button>
                <button className="btn btn-primary" onClick={exportPdf}><Download size={16} /> PDF</button>
              </div>
            </div>

            {/* Highlights + Tips row */}
            {(itinerary.highlights?.length > 0 || itinerary.localTip) && (
              <div className="result-meta-row">
                {itinerary.highlights?.length > 0 && (
                  <div className="meta-card">
                    <div className="meta-card-title"><MapPin size={15} /> Must-visit spots</div>
                    <div className="highlights-list">
                      {itinerary.highlights.map(h => <span key={h} className="highlight-chip">{h}</span>)}
                    </div>
                  </div>
                )}
                {itinerary.localFood?.length > 0 && (
                  <div className="meta-card">
                    <div className="meta-card-title"><Coffee size={15} /> Local food to try</div>
                    <div className="highlights-list">
                      {itinerary.localFood.map(f => <span key={f} className="highlight-chip food-chip">{f}</span>)}
                    </div>
                  </div>
                )}
                {itinerary.localTip && (
                  <div className="meta-card tip-card">
                    <div className="meta-card-title"><Zap size={15} /> Local tip</div>
                    <p>{itinerary.localTip}</p>
                  </div>
                )}
              </div>
            )}

            {/* Day cards */}
            <div className="itinerary-grid">
              {(itinerary.days || []).map((day, i) => (
                <article className="day-card" key={day.label || i}>
                  <div className="day-label">
                    <span>{day.label}</span>
                    <Clock3 size={15} />
                  </div>
                  <h3>{day.title}</h3>
                  <ul>
                    {(day.activities || []).map((act, j) => (
                      <li key={j}><CheckCircle2 size={13} className="li-icon" />{act}</li>
                    ))}
                  </ul>
                </article>
              ))}
              {/* Budget card */}
              <article className="day-card budget-card">
                <div className="day-label"><span>BUDGET BREAKDOWN</span><Wallet size={15} /></div>
                <h3>{itinerary.budget} total</h3>
                {itinerary.budgetBreakdown && Object.entries(itinerary.budgetBreakdown).map(([k, v]) => (
                  <div className="budget-bar-row" key={k}>
                    <span>{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                    <div className="budget-bar-track">
                      <div className="budget-bar-fill" style={{ width: `${Math.round(v / itinerary.budgetNum * 100)}%` }} />
                    </div>
                    <strong>₹{v.toLocaleString('en-IN')}</strong>
                  </div>
                ))}
              </article>
            </div>

            {/* Hotel recommendations */}
            {itinerary.recommendedHotels?.length > 0 && (
              <div className="hotels-row">
                <h3 className="row-title"><Hotel size={18} /> Recommended stays</h3>
                <div className="hotels-grid">
                  {itinerary.recommendedHotels.map(h => (
                    <div key={h.name} className="hotel-card">
                      <div className="hotel-icon"><Hotel size={22} /></div>
                      <div>
                        <strong>{h.name}</strong>
                        <span>~₹{h.price_per_night?.toLocaleString('en-IN')}/night</span>
                      </div>
                      <button className="btn btn-outline small" onClick={() => { setBkType('hotel'); setBkName(h.name); setBkDest(itinerary.destination); setBookingModal(true); }}>
                        Book <ArrowRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Route + interactive map */}
            <div className="route-card">
              <Navigation size={21} />
              <div>
                <strong>{route?.optimizedOrder?.length > 1 ? 'Optimized route' : 'Route overview'}</strong>
                <p>{(route?.optimizedOrder?.length ? route.optimizedOrder : (itinerary.cities || [itinerary.destination])).join(' → ')}</p>
                <span className="route-tip">
                  {route
                    ? `${route.totalDistanceKm} km · ~${route.totalDurationHours} hrs · ${route.suggestedTransport}`
                    : itinerary.transportTip}
                </span>
              </div>
              <div className="route-actions">
                <button className="btn btn-outline small" disabled={routeLoading}
                  onClick={() => optimizeRoute(itinerary.cities?.length ? itinerary.cities : [itinerary.destination])}>
                  {routeLoading ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />} Re-optimize
                </button>
                <a className="btn btn-outline small" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps/dir/${(route?.optimizedOrder?.length ? route.optimizedOrder : (itinerary.cities || [itinerary.destination])).map(encodeURIComponent).join('/')}`}>
                  Open map <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {route?.route?.length > 0 && (
              <div className="map-card">
                <div className="map-card-head">
                  <MapIcon size={16} /> Interactive route map
                  {route.distanceSavedKm > 0 && <span className="map-badge saved">saved {route.distanceSavedKm} km</span>}
                  {route.transportMode && <span className="map-badge">{route.transportMode}</span>}
                </div>
                <InteractiveMap points={route.route} />
                {route.legs?.length > 0 && (
                  <div className="legs-list">
                    {route.legs.map((l, i) => (
                      <span key={`${l.from}-${l.to}-${i}`} className="leg-chip">
                        {l.from} → {l.to} · {l.distance_km} km{l.duration_hours ? ` · ~${l.duration_hours}h` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── DESTINATIONS ─────────────────────────────────────────────────── */}
        <section className="destinations-section" id="destinations">
          <div className="content-width">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">EXPLORE THE WORLD</span>
                <h2>Places worth dreaming about</h2>
                <p>Curated destinations — tap to plan your perfect trip.</p>
              </div>
              <div className="dest-controls">
                <div className="search-box">
                  <Search size={16} />
                  <input id="dest-search" value={destFilter} onChange={e => setDestFilter(e.target.value)} placeholder="Search destinations..." />
                  {destFilter && <button onClick={() => setDestFilter('')}><X size={14} /></button>}
                </div>
                <button className={`view-btn ${destView === 'grid' ? 'active' : ''}`} onClick={() => setDestView('grid')}><Grid size={16} /></button>
                <button className={`view-btn ${destView === 'list' ? 'active' : ''}`} onClick={() => setDestView('list')}><List size={16} /></button>
              </div>
            </div>

            <div className={`destination-grid ${destView === 'list' ? 'list-view' : ''}`}>
              {destinations
                .filter(d => !destFilter || d.name.toLowerCase().includes(destFilter.toLowerCase()) || d.tag?.toLowerCase().includes(destFilter.toLowerCase()))
                .map((place) => (
                  <article className="destination-card" key={place.name}>
                    <div className="destination-photo" style={{ backgroundImage: `url(https://images.unsplash.com/${place.img}?auto=format&fit=crop&w=900&q=85)` }}>
                      <span className="destination-tag">{place.tag || 'Discover'}</span>
                      <button className={`save-heart ${savedTrips.some(t => t.destination === place.name) ? 'saved' : ''}`}
                        aria-label={`Save ${place.name}`}
                        onClick={() => { if (!user) { setAuthOpen(true); return; } setSavedTrips(p => p.some(t => t.destination === place.name) ? p.filter(t => t.destination !== place.name) : [{ destination: place.name, dates: place.days, budget: place.price, travellers: '2 travellers', interests: [] }, ...p]); }}>
                        <Heart size={17} fill={savedTrips.some(t => t.destination === place.name) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <div className="destination-body">
                      <div className="destination-info">
                        <div>
                          <h3>{place.name}</h3>
                          <div className="dest-meta">
                            <span><CalendarDays size={13} /> {place.days}</span>
                            <span><Tag size={13} /> {place.price}</span>
                          </div>
                          {destView === 'list' && place.description && <p className="dest-desc">{place.description}</p>}
                          {destView === 'list' && place.highlights?.length > 0 && (
                            <div className="dest-highlights">
                              {(typeof place.highlights === 'string' ? JSON.parse(place.highlights) : place.highlights).slice(0, 3).map(h => <span key={h} className="highlight-chip small">{h}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="dest-actions">
                        <button className="btn btn-primary small" onClick={() => { setDestination(place.name); scrollTo('planner'); }}>
                          Plan trip <ArrowRight size={14} />
                        </button>
                        <button className="btn btn-outline small" onClick={() => loadWeather(place.name.split(',')[0])}>
                          <CloudSun size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </section>

        {/* ── RECOMMENDED FOR YOU ───────────────────────────────────────────── */}
        <section className="recommend-section content-width" id="recommendations">
          <div className="section-title-row">
            <div>
              <span className="section-kicker">PERSONALIZED FOR YOU</span>
              <h2>{user ? `Recommended for ${user.name.split(' ')[0]}` : 'Recommended for you'}</h2>
              <p>{user ? 'Tailored to your interests, travel style and saved trips.' : 'Log in to get suggestions based on your preferences.'}</p>
            </div>
            <button className="btn btn-outline small" onClick={loadRecommendations} disabled={recLoading}>
              {recLoading ? <Loader size={15} className="spin" /> : <RefreshCw size={15} />} Refresh
            </button>
          </div>
          {recLoading && !recommendations.length ? (
            <div className="loading-state"><Loader size={24} className="spin" /><span>Finding your perfect matches...</span></div>
          ) : recommendations.length ? (
            <div className="recommend-grid">
              {recommendations.map(r => (
                <article className="recommend-card" key={r.id ?? r.name}>
                  <div className="recommend-photo" style={{ backgroundImage: `url(https://images.unsplash.com/${r.img}?auto=format&fit=crop&w=700&q=85)` }}>
                    <span className="destination-tag">{r.tag || 'Discover'}</span>
                  </div>
                  <div className="recommend-body">
                    <h3>{r.name}</h3>
                    <p className="recommend-reason"><Sparkles size={13} /> {r.reason}</p>
                    <div className="recommend-actions">
                      <button className="btn btn-primary small" onClick={() => { setDestination(r.name); scrollTo('planner'); }}>
                        Plan trip <ArrowRight size={13} />
                      </button>
                      <button className="btn btn-outline small" aria-label={`Weather for ${r.name}`}
                        onClick={() => { const c = r.name.split(',')[0]; setWeatherDest(c); scrollTo('tools'); loadWeather(c); }}>
                        <CloudSun size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Sparkles size={26} /></div>
              <strong>No suggestions yet</strong>
              <p>Set your interests in your profile to unlock personalized picks.</p>
            </div>
          )}
        </section>

        {/* ── MY TRIPS ──────────────────────────────────────────────────────── */}
        <section className="saved-section content-width" id="my-trips">
          <div className="saved-heading">
            <div>
              <span className="section-kicker">YOUR COLLECTION</span>
              <h2>My Trips <span className="badge large">{savedTrips.length}</span></h2>
              <p>{user ? `Saved trips for ${user.name}.` : 'Log in to save and access your trips from any device.'}</p>
            </div>
            {!user && <button className="btn btn-primary small" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}><LogIn size={15} /> Log in</button>}
          </div>
          {tripsLoading ? (
            <div className="loading-state"><Loader size={24} className="spin" /><span>Loading your trips...</span></div>
          ) : savedTrips.length ? (
            <div className="saved-list">
              {savedTrips.map((trip, i) => (
                <div className="saved-item" key={`${trip.destination}-${i}`}>
                  <div className="saved-item-icon"><MapPin size={18} /></div>
                  <div className="saved-item-body">
                    <strong>{trip.destination}</strong>
                    <span>{trip.trip?.dates || trip.dates || 'No dates'} · {trip.trip?.budget || trip.budget || 'No budget'} · {trip.trip?.travellers || trip.travellers || ''}</span>
                  </div>
                  <div className="saved-item-actions">
                    <button className="btn btn-outline small" onClick={() => { setItinerary(trip.trip || trip); scrollTo('trip-result'); setTimeout(() => document.getElementById('trip-result')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>
                      <Eye size={14} /> View
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteTrip(trip, i)} aria-label="Remove trip"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Compass size={26} /></div>
              <strong>Your next adventure starts here</strong>
              <p>Plan a trip and save it to build your personal travel collection.</p>
              <button className="btn btn-primary" onClick={() => scrollTo('planner')}><Sparkles size={16} /> Plan a trip</button>
            </div>
          )}
        </section>

        {/* ── TOOLS ─────────────────────────────────────────────────────────── */}
        <section className="tools-section content-width" id="tools">
          <div className="section-heading">
            <span className="section-kicker">MORE THAN AN ITINERARY</span>
            <h2>Your complete travel toolkit</h2>
            <p>Weather intelligence, expense tracking, reviews and personal recommendations.</p>
          </div>
          <div className="tools-grid">

            {/* Weather Tool */}
            <article className="tool-card" id="weather">
              <div className="tool-header">
                <div className="tool-icon weather-icon"><CloudSun size={22} /></div>
                <div><h3>Live Weather</h3><p>7-day forecast via Open-Meteo</p></div>
              </div>
              <div className="weather-search-row">
                <input value={weatherDest} onChange={e => setWeatherDest(e.target.value)} placeholder="Enter city name..." onKeyDown={e => e.key === 'Enter' && loadWeather()} />
                <button className="btn btn-primary small" onClick={() => loadWeather()} disabled={weatherLoading}>
                  {weatherLoading ? <Loader size={15} className="spin" /> : <Search size={15} />}
                </button>
              </div>
              {weather?.error && <p className="tool-note error-note"><AlertCircle size={13} /> {weather.error}</p>}
              {weather && !weather.error && (
                <div className="weather-result">
                  <div className="weather-header">
                    <strong>{weather.place}</strong>
                    <span className="weather-condition">{wmoDesc(weather.current.weather_code)}</span>
                  </div>
                  <div className="weather-main">
                    <div className="weather-temp">{Math.round(weather.current.temperature_2m)}°C</div>
                    <div className="weather-details">
                      <span><Thermometer size={13} /> Feels {Math.round(weather.current.apparent_temperature)}°C</span>
                      <span><Droplets size={13} /> {weather.current.relative_humidity_2m}% humidity</span>
                      <span><Wind size={13} /> {Math.round(weather.current.wind_speed_10m)} km/h</span>
                    </div>
                  </div>
                  <div className="weather-forecast">
                    {weather.daily.time.slice(0, 7).map((d, i) => (
                      <div key={d} className="forecast-day">
                        <span>{i === 0 ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <div className="forecast-icon"><Sun size={13} /></div>
                        <span className="forecast-range">{Math.round(weather.daily.temperature_2m_min[i])}° / {Math.round(weather.daily.temperature_2m_max[i])}°</span>
                        {weather.daily.precipitation_probability_max?.[i] > 20 && <span className="precip-badge">{weather.daily.precipitation_probability_max[i]}%</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* Expense Tracker */}
            <article className="tool-card" id="expenses">
              <div className="tool-header">
                <div className="tool-icon expense-icon"><Receipt size={22} /></div>
                <div><h3>Expense Tracker</h3><p>Compare estimated vs actual spend</p></div>
              </div>
              <div className="expense-summary">
                <div className="expense-total-box">
                  <span>Total spent</span>
                  <strong>₹{totalExpenses.toLocaleString('en-IN')}</strong>
                </div>
                {itinerary && (
                  <div className="budget-compare">
                    <span>Planned: {itinerary.budget}</span>
                    <div className="compare-bar">
                      <div className="compare-fill" style={{ width: `${Math.min((totalExpenses / (itinerary.budgetNum || 10000)) * 100, 100)}%`, background: totalExpenses > (itinerary.budgetNum || 10000) ? '#ef4444' : '#10b981' }} />
                    </div>
                    <span>{Math.round((totalExpenses / (itinerary.budgetNum || 10000)) * 100)}% used</span>
                  </div>
                )}
              </div>
              {expByCategory.length > 0 && (
                <div className="expense-breakdown">
                  {expByCategory.map(([cat, total]) => (
                    <div key={cat} className="exp-cat-row">
                      <span>{cat}</span>
                      <div className="exp-cat-bar"><div style={{ width: `${(total / totalExpenses) * 100}%` }} /></div>
                      <strong>₹{total.toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>
              )}
              <form className="tool-form" onSubmit={addExpense}>
                <input value={expName} onChange={e => setExpName(e.target.value)} placeholder="Expense description" required />
                <div className="tool-form-row">
                  <input type="number" min="1" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="Amount ₹" required />
                  <select value={expCat} onChange={e => setExpCat(e.target.value)}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit"><Plus size={15} /> Add expense</button>
              </form>
              {expenses.length > 0 && (
                <div className="expense-list">
                  {expenses.slice(0, 6).map(x => (
                    <div key={x.id} className="expense-item">
                      <div className="exp-cat-badge">{x.category[0]}</div>
                      <div className="exp-details">
                        <span>{x.name}</span>
                        <small>{x.category} · {x.date}</small>
                      </div>
                      <strong>₹{Number(x.amount).toLocaleString('en-IN')}</strong>
                      <button aria-label="Remove" onClick={() => deleteExpense(x)}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </article>

            {/* Reviews */}
            <article className="tool-card" id="reviews">
              <div className="tool-header">
                <div className="tool-icon review-icon"><Star size={22} /></div>
                <div>
                  <h3>Reviews & Ratings</h3>
                  <p>{reviews.length > 0 ? `${reviews.length} reviews · Avg ${avgRating}★` : 'Share tips for fellow travellers'}</p>
                </div>
              </div>
              <div className="review-search">
                <Search size={14} />
                <input value={revFilter} onChange={e => setRevFilter(e.target.value)} placeholder="Filter by place..." />
              </div>
              <form className="tool-form" onSubmit={submitReview}>
                <input value={revPlace} onChange={e => setRevPlace(e.target.value)} placeholder="Hotel, restaurant or attraction" required />
                <div className="rating-picker">
                  <span>Your rating:</span>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button type="button" key={n} className={`star-btn ${n <= revRating ? 'active' : ''}`} onClick={() => setRevRating(n)}>
                      <Star size={18} fill={n <= revRating ? '#f59e0b' : 'none'} color={n <= revRating ? '#f59e0b' : '#d1d5db'} />
                    </button>
                  ))}
                </div>
                <textarea value={revText} onChange={e => setRevText(e.target.value)} placeholder="Share your experience — what should travellers know?" rows="2" required />
                <button className="btn btn-primary" type="submit"><Send size={15} /> Post review</button>
              </form>
              <div className="review-list">
                {filteredReviews.length ? filteredReviews.slice(0, 5).map(r => (
                  <div className="review-item" key={r.id}>
                    <div className="review-top">
                      <div>
                        <strong>{r.place}</strong>
                        <StarRating rating={r.rating} />
                      </div>
                      <small>{r.by_name || r.by} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</small>
                    </div>
                    <p>{r.text}</p>
                  </div>
                )) : <p className="tool-note">No reviews yet — be the first!</p>}
              </div>
            </article>
          </div>
        </section>

        {/* ── BOOKINGS ──────────────────────────────────────────────────────── */}
        <section className="bookings-section content-width" id="bookings">
          <div className="section-title-row">
            <div>
              <span className="section-kicker">HOTELS & TRAVEL</span>
              <h2>Your Bookings</h2>
              <p>Track hotel stays, flights and activities in one place.</p>
            </div>
            {user && <button className="btn btn-primary small" onClick={() => setBookingModal(true)}><Plus size={15} /> Add booking</button>}
          </div>
          {!user ? (
            <div className="empty-state">
              <div className="empty-icon"><Hotel size={26} /></div>
              <strong>Log in to manage bookings</strong>
              <p>Save your hotel stays, flights and activities all in one place.</p>
              <button className="btn btn-primary" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}><LogIn size={15} /> Log in</button>
            </div>
          ) : bookings.length ? (
            <div className="bookings-grid">
              {bookings.map(bk => (
                <div key={bk.id} className={`booking-card ${bk.status}`}>
                  <div className="booking-icon">
                    {bk.type === 'hotel' ? <Hotel size={20} /> : bk.type === 'flight' ? <Plane size={20} /> : <Activity size={20} />}
                  </div>
                  <div className="booking-body">
                    <strong>{bk.name}</strong>
                    <span>{bk.destination}</span>
                    {bk.check_in && <span className="booking-dates"><CalendarDays size={12} /> {bk.check_in}{bk.check_out ? ` → ${bk.check_out}` : ''}</span>}
                    {bk.price && <span className="booking-price"><DollarSign size={12} /> ₹{Number(bk.price).toLocaleString('en-IN')}</span>}
                  </div>
                  <div className="booking-right">
                    <span className={`booking-status ${bk.status}`}>{bk.status}</span>
                    {bk.status === 'confirmed' && (
                      <button className="btn btn-ghost small danger" onClick={() => cancelBooking(bk)}>Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Hotel size={26} /></div>
              <strong>No bookings yet</strong>
              <p>Add your hotel stays, flights and activities to keep everything organized.</p>
              <button className="btn btn-primary" onClick={() => setBookingModal(true)}><Plus size={16} /> Add your first booking</button>
            </div>
          )}
        </section>

        {/* ── ADMIN ─────────────────────────────────────────────────────────── */}
        {user?.role === 'admin' && (
          <section className="admin-section content-width" id="admin">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">ADMIN PANEL</span>
                <h2><ShieldCheck size={24} /> Admin Dashboard</h2>
                <p>Manage users, destinations and travel content.</p>
              </div>
              <button className="btn btn-outline small" onClick={loadAdminData}><RefreshCw size={15} /> Refresh</button>
            </div>

            <div className="admin-tabs">
              {['overview', 'users', 'destinations', 'reviews'].map(t => (
                <button key={t} className={`admin-tab ${adminTab === t ? 'active' : ''}`} onClick={() => setAdminTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {adminTab === 'overview' && adminStats && (
              <div>
                <div className="admin-stats-grid">
                  {[
                    { label: 'Total Users', val: adminStats.stats.users, icon: Users, color: '#6366f1' },
                    { label: 'Trips Saved', val: adminStats.stats.trips, icon: MapPin, color: '#10b981' },
                    { label: 'Reviews', val: adminStats.stats.reviews, icon: Star, color: '#f59e0b' },
                    { label: 'Bookings', val: adminStats.stats.bookings, icon: Hotel, color: '#ec4899' },
                    { label: 'Destinations', val: adminStats.stats.destinations, icon: Globe, color: '#3b82f6' },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="admin-stat-card" style={{ '--accent': color }}>
                      <Icon size={22} />
                      <strong>{val}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <h3 className="admin-sub-title">Recent Users</h3>
                <div className="admin-table">
                  <div className="admin-table-head">
                    <span>Name</span><span>Email</span><span>Role</span><span>Joined</span>
                  </div>
                  {adminStats.recentUsers?.map(u => (
                    <div key={u.id} className="admin-table-row">
                      <span><div className="mini-avatar">{u.name[0]}</div>{u.name}</span>
                      <span>{u.email}</span>
                      <span><span className={`role-badge ${u.role}`}>{u.role}</span></span>
                      <span>{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab === 'users' && (
              <div className="admin-table">
                <div className="admin-table-head">
                  <span>Name</span><span>Email</span><span>Role</span><span>Actions</span>
                </div>
                {adminUsers.map(u => (
                  <div key={u.id} className="admin-table-row">
                    <span><div className="mini-avatar">{u.name[0]}</div>{u.name}</span>
                    <span>{u.email}</span>
                    <span><span className={`role-badge ${u.role}`}>{u.role}</span></span>
                    <span className="admin-row-actions">
                      <button className="btn btn-outline xsmall" onClick={async () => {
                        const newRole = u.role === 'admin' ? 'user' : 'admin';
                        try { await apiFetch(`/api/admin/users/${u.id}/role?role=${newRole}`, { method: 'PUT' }); setAdminUsers(p => p.map(x => x.id === u.id ? { ...x, role: newRole } : x)); toast('Role updated.', 'success'); } catch (err) { toast(err.message, 'error'); }
                      }}>{u.role === 'admin' ? 'Revoke admin' : 'Make admin'}</button>
                      {u.id !== user.id && <button className="btn btn-ghost xsmall danger" onClick={async () => {
                        if (!confirm(`Delete user ${u.name}?`)) return;
                        try { await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' }); setAdminUsers(p => p.filter(x => x.id !== u.id)); toast('User deleted.', 'success'); } catch (err) { toast(err.message, 'error'); }
                      }}><Trash2 size={13} /></button>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'destinations' && (
              <div>
                <div className="tool-form" style={{ maxWidth: 500, marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 12px' }}>Add new destination</h4>
                  <input value={newDestName} onChange={e => setNewDestName(e.target.value)} placeholder="Destination name e.g. Pondicherry, TN" />
                  <input value={newDestTag} onChange={e => setNewDestTag(e.target.value)} placeholder="Tag e.g. French Quarter" />
                  <button className="btn btn-primary" onClick={async () => {
                    if (!newDestName.trim()) return;
                    try {
                      const d = await apiFetch('/api/admin/destinations', { method: 'POST', body: JSON.stringify({ name: newDestName, tag: newDestTag || 'Discover', img: 'photo-1501785888041-af3ef285b470' }) });
                      setAdminDests(p => [...p, d]); setDestinations(p => [...p, d]); setNewDestName(''); setNewDestTag(''); toast('Destination added!', 'success');
                    } catch (err) { toast(err.message, 'error'); }
                  }}><Plus size={15} /> Add destination</button>
                </div>
                <div className="admin-table">
                  <div className="admin-table-head"><span>Name</span><span>Tag</span><span>Actions</span></div>
                  {adminDests.map(d => (
                    <div key={d.id} className="admin-table-row">
                      <span>{d.name}</span><span>{d.tag}</span>
                      <span><button className="btn btn-ghost xsmall danger" onClick={async () => {
                        try { await apiFetch(`/api/admin/destinations/${d.id}`, { method: 'DELETE' }); setAdminDests(p => p.filter(x => x.id !== d.id)); setDestinations(p => p.filter(x => x.id !== d.id)); toast('Deleted.', 'success'); } catch (err) { toast(err.message, 'error'); }
                      }}><Trash2 size={13} /></button></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab === 'reviews' && (
              <div className="admin-table">
                <div className="admin-table-head"><span>Place</span><span>Rating</span><span>Review</span><span>By</span><span>Actions</span></div>
                {reviews.map(r => (
                  <div key={r.id} className="admin-table-row">
                    <span>{r.place}</span>
                    <span><StarRating rating={r.rating} size={12} /></span>
                    <span style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</span>
                    <span>{r.by_name || r.by}</span>
                    <span><button className="btn btn-ghost xsmall danger" onClick={async () => {
                      try { await apiFetch(`/api/reviews/${r.id}`, { method: 'DELETE' }); setReviews(p => p.filter(x => x.id !== r.id)); toast('Review deleted.', 'success'); } catch (err) { toast(err.message, 'error'); }
                    }}><Trash2 size={13} /></button></span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="cta-section">
          <div className="cta-glow" />
          <div className="cta-inner">
            <div className="cta-icon"><Mountain size={27} /></div>
            <span className="section-kicker">YOUR NEXT CHAPTER IS OUT THERE</span>
            <h2>Less planning stress.<br /><span>More unforgettable moments.</span></h2>
            <p>Tell us where you want to go. Let TripGenie AI shape the journey.</p>
            <button className="btn btn-white btn-lg" onClick={() => scrollTo('planner')}>
              <Sparkles size={17} /> Plan my trip <ArrowRight size={17} />
            </button>
          </div>
          <div className="cta-deco deco-one"><Camera size={24} /></div>
          <div className="cta-deco deco-two"><Coffee size={24} /></div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="footer">
        <a className="brand footer-brand" href="#home"><span className="brand-mark"><Plane size={19} /></span><span>Trip<span className="brand-dark">Genie</span> <b>AI</b></span></a>
        <div className="footer-links">
          <a href="#planner">Plan Trip</a>
          <a href="#destinations">Explore</a>
          <a href="#tools">Tools</a>
          <a href="#bookings">Bookings</a>
        </div>
        <p>Made for curious minds and open roads.</p>
        <span className="footer-note">© 2026 TripGenie AI · Smart Trip Planner</span>
      </footer>

      {/* ── CHAT FAB ───────────────────────────────────────────────────────── */}
      <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)} aria-label="Open AI travel chatbot">
        {chatOpen ? <X size={23} /> : <Bot size={23} />}
        {!chatOpen && <span className="chat-fab-dot" />}
      </button>
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="chat-head-avatar"><Bot size={18} /></div>
            <div><strong>TripGenie AI</strong><span>Travel assistant · Online</span></div>
            <button onClick={() => setChatOpen(false)} aria-label="Close chatbot"><X size={18} /></button>
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            {chatMessages.map((m, i) => (
              <div className={`chat-bubble ${m.from}`} key={i}>{m.text}</div>
            ))}
            {chatLoading && <div className="chat-bubble bot typing"><span /><span /><span /></div>}
          </div>
          <div className="chat-quick-replies">
            {['Best time to visit?', 'Budget breakdown', 'What to pack?', 'Hotel tips'].map(q => (
              <button key={q} className="quick-reply" onClick={() => { setChatInput(q); }}>{q}</button>
            ))}
          </div>
          <form className="chat-input-row" onSubmit={sendChat}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about your trip..." disabled={chatLoading} />
            <button type="submit" aria-label="Send" disabled={chatLoading || !chatInput.trim()}>
              <Send size={17} />
            </button>
          </form>
        </div>
      )}

      {/* ── AUTH MODAL ─────────────────────────────────────────────────────── */}
      {authOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={20} /></button>
            <div className="auth-brand"><span className="brand-mark"><Plane size={22} /></span><span>Trip<span className="brand-dark">Genie</span> <b>AI</b></span></div>
            <span className="section-kicker">YOUR NEXT ADVENTURE STARTS HERE</span>
            <h2 id="auth-title">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>{authMode === 'login' ? 'Log in to save your trips and preferences.' : 'Sign up free and start planning your next trip.'}</p>
            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === 'signup' && (
                <label>Full name<input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name" autoComplete="name" required /></label>
              )}
              <label>Email address<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
              <label>
                Password
                <div className="password-field">
                  <input type={authShowPw ? 'text' : 'password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength="8" required />
                  <button type="button" className="pw-toggle" onClick={() => setAuthShowPw(!authShowPw)}>{authShowPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </label>
              {authError && <p className="auth-error" role="alert"><AlertCircle size={14} /> {authError}</p>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? <><Loader size={16} className="spin" /> Please wait...</> : <>{authMode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17} /></>}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
                {authMode === 'login' ? 'Sign up free' : 'Log in'}
              </button>
            </p>
          </section>
        </div>
      )}

      {/* ── BOOKING MODAL ──────────────────────────────────────────────────── */}
      {bookingModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setBookingModal(false); }}>
          <section className="booking-modal" role="dialog">
            <button className="modal-close" onClick={() => setBookingModal(false)}><X size={20} /></button>
            <h2>Add Booking</h2>
            <form className="auth-form" onSubmit={addBooking}>
              <label>
                Booking type
                <select value={bkType} onChange={e => setBkType(e.target.value)}>
                  <option value="hotel">🏨 Hotel</option>
                  <option value="flight">✈️ Flight</option>
                  <option value="activity">🎭 Activity</option>
                  <option value="transport">🚗 Transport</option>
                </select>
              </label>
              <label>Name / Property<input value={bkName} onChange={e => setBkName(e.target.value)} placeholder="e.g. Taj Palace Hotel" required /></label>
              <label>Destination<input value={bkDest} onChange={e => setBkDest(e.target.value)} placeholder="e.g. Goa, India" required /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>Check-in / Departure<input type="date" value={bkCheckIn} onChange={e => setBkCheckIn(e.target.value)} /></label>
                <label>Check-out / Return<input type="date" value={bkCheckOut} onChange={e => setBkCheckOut(e.target.value)} /></label>
              </div>
              <label>Price (₹)<input type="number" value={bkPrice} onChange={e => setBkPrice(e.target.value)} placeholder="Total price" /></label>
              <button className="btn btn-primary auth-submit" type="submit"><Check size={16} /> Confirm booking</button>
            </form>
          </section>
        </div>
      )}

      {/* ── PROFILE MODAL ──────────────────────────────────────────────────── */}
      {profileOpen && user && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}>
          <section className="auth-modal" role="dialog">
            <button className="modal-close" onClick={() => setProfileOpen(false)}><X size={20} /></button>
            <div className="profile-header">
              <div className="profile-avatar">{user.name[0].toUpperCase()}</div>
              <div>
                <h3>{user.name}</h3>
                <p>{user.email}</p>
                <span className={`role-badge ${user.role}`}>{user.role}</span>
              </div>
            </div>
            <div className="profile-stats">
              <div><strong>{savedTrips.length}</strong><span>Trips</span></div>
              <div><strong>{expenses.length}</strong><span>Expenses</span></div>
              <div><strong>{bookings.length}</strong><span>Bookings</span></div>
            </div>
            <div className="profile-section">
              <h4>Travel style preference</h4>
              <div className="interest-row" style={{ marginTop: 8 }}>
                {['Budget', 'Comfort', 'Luxury', 'Adventure', 'Cultural'].map(s => (
                  <button key={s} type="button" className={`interest-chip ${prefStyle === s ? 'selected' : ''}`} onClick={() => setPrefStyle(s)}>{s}</button>
                ))}
              </div>
              <h4 style={{ marginTop: 16 }}>Interests (for recommendations)</h4>
              <div className="interest-row" style={{ marginTop: 8 }}>
                {INTEREST_OPTIONS.map(item => (
                  <button key={item} type="button" className={`interest-chip ${prefInterests.includes(item) ? 'selected' : ''}`}
                    onClick={() => setPrefInterests(p => p.includes(item) ? p.filter(x => x !== item) : [...p, item])}>{item}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={async () => {
              const nextPrefs = { ...prefs, preferred_style: prefStyle, interests: prefInterests };
              try {
                await apiFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify({ preferences: nextPrefs }) });
                setPrefs(nextPrefs); setStore('tg_prefs', nextPrefs);
                loadRecommendations();
                toast('Preferences saved!', 'success');
                setProfileOpen(false);
              } catch { setPrefs(nextPrefs); setStore('tg_prefs', nextPrefs); toast('Saved locally.', 'info'); setProfileOpen(false); }
            }}><Save size={16} /> Save preferences</button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, color: '#ef4444' }} onClick={() => { logout(); setProfileOpen(false); }}><LogOut size={15} /> Log out</button>
          </section>
        </div>
      )}

      {/* ── TOASTS ─────────────────────────────────────────────────────────── */}
      <Toast toasts={toasts} remove={removeToast} />

      {/* ── PRINT STYLES ───────────────────────────────────────────────────── */}
    </div>
  );
}
