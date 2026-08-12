// Tiny "who's lending near me" algorithm: haversine distance + activity decay score.
const ME = { lat: 28.6448, lng: 77.2167 };

const LENDERS = [
  { who: "Ravi · Gali 4", lat: 28.6462, lng: 77.2181, lastSeenMins: 4, items: 3 },
  { who: "Sunita aunty", lat: 28.6421, lng: 77.2129, lastSeenMins: 26, items: 5 },
  { who: "Imran", lat: 28.6503, lng: 77.2242, lastSeenMins: 12, items: 2 },
  { who: "Meera", lat: 28.6377, lng: 77.2311, lastSeenMins: 70, items: 4 },
  { who: "Hardware Verma", lat: 28.6455, lng: 77.2124, lastSeenMins: 2, items: 9 },
  { who: "Sharma ji", lat: 28.6439, lng: 77.2189, lastSeenMins: 48, items: 6 },
  { who: "Store counter", lat: 28.6449, lng: 77.2168, lastSeenMins: 1, items: 11 },
  { who: "Fauzia", lat: 28.6588, lng: 77.2401, lastSeenMins: 210, items: 2 },
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function scanActiveLenders(radiusKm = 5) {
  return LENDERS.map((l) => {
    const km = haversineKm(ME, l);
    const freshness = Math.exp(-l.lastSeenMins / 90); // decays over ~1.5h
    const proximity = 1 / (1 + km);
    return { ...l, km, score: freshness * 0.6 + proximity * 0.3 + Math.min(l.items, 10) * 0.01 };
  })
    .filter((l) => l.km <= radiusKm && l.lastSeenMins <= 120)
    .sort((a, b) => b.score - a.score);
}

export function formatKm(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export const CATALOGUE = [
  { name: "Epson projector", who: "Ravi · Gali 4" },
  { name: "Folding ladder", who: "Sunita aunty" },
  { name: "Cricket kit", who: "Imran" },
  { name: "Camping tent (4p)", who: "Meera" },
  { name: "Drill machine", who: "Hardware Verma" },
  { name: "Steel degchi 20L", who: "Sharma ji" },
  { name: "Bicycle pump", who: "Store counter" },
  { name: "Sewing machine", who: "Fauzia" },
];
