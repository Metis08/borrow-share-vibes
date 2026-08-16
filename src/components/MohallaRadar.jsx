import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { formatKm } from "@/lib/lenders";

const CATEGORIES = ["All", "Electronics", "Tools", "Books", "Home", "Outdoor", "Events", "Other"];

const getMockupItems = (lat, lng) => [
  { 
    id: "fallback-tripod", 
    itemName: "Tripod", 
    category: "Electronics", 
    description: "Professional aluminum travel tripod", 
    distanceKm: 0.40, 
    owner: "Lender 7", 
    shelfName: "Ritu's Shelf",
    phone: "9876543216",
    latitude: lat - 0.007, 
    longitude: lng - 0.018, 
    locationName: "Nehru Enclave",
    hasPin: true
  },
  { 
    id: "fallback-proj", 
    itemName: "Projector", 
    category: "Electronics", 
    description: "Full HD Home Theater Projector", 
    distanceKm: 0.65, 
    owner: "Lender 1", 
    shelfName: "Mahek's Shelf",
    phone: "9876543210",
    latitude: lat - 0.005, 
    longitude: lng - 0.015, 
    locationName: "East of Kailash",
    hasPin: true
  },
  { 
    id: "fallback-lad", 
    itemName: "Ladder", 
    category: "Tools", 
    description: "6-foot folding aluminum ladder", 
    distanceKm: 0.90, 
    owner: "Lender 2", 
    shelfName: "Rohan's Shelf",
    phone: "9876543211",
    latitude: lat - 0.014, 
    longitude: lng - 0.024, 
    locationName: "Saket",
    hasPin: true
  },
  { 
    id: "fallback-cam", 
    itemName: "Camera", 
    category: "Electronics", 
    description: "Nikon D3500 DSLR with kit lens", 
    distanceKm: 1.20, 
    owner: "Lender 3", 
    shelfName: "Priyanka's Shelf",
    phone: "9876543212",
    latitude: lat + 0.008, 
    longitude: lng + 0.010, 
    locationName: "Govindpuri",
    hasPin: true
  },
  { 
    id: "fallback-cont", 
    itemName: "Controller", 
    category: "Electronics", 
    description: "Xbox Wireless Controller", 
    distanceKm: 1.40, 
    owner: "Lender 4", 
    shelfName: "Ankit's Shelf",
    phone: "9876543213",
    latitude: lat + 0.015, 
    longitude: lng + 0.020, 
    locationName: "Okhla",
    hasPin: true
  },
  { 
    id: "fallback-tent", 
    itemName: "Tent", 
    category: "Outdoor", 
    description: "3-person camping tent", 
    distanceKm: 1.60, 
    owner: "Lender 5", 
    shelfName: "Sanya's Shelf",
    phone: "9876543214",
    latitude: lat - 0.010, 
    longitude: lng + 0.025, 
    locationName: "Malviya Nagar",
    hasPin: true
  },
  { 
    id: "fallback-books", 
    itemName: "Books", 
    category: "Books", 
    description: "Set of classic fiction novels", 
    distanceKm: 1.80, 
    owner: "Lender 6", 
    shelfName: "Kabir's Shelf",
    phone: "9876543215",
    latitude: lat + 0.014, 
    longitude: lng - 0.028, 
    locationName: "Nehru Place",
    hasPin: true
  },
  { 
    id: "fallback-drill", 
    itemName: "Drill", 
    category: "Tools", 
    description: "Cordless power drill with bit set", 
    distanceKm: 2.10, 
    owner: "Lender 8", 
    shelfName: "Dev's Shelf",
    phone: "9876543217",
    latitude: lat + 0.017, 
    longitude: lng + 0.024, 
    locationName: "Kalkaji Extension",
    hasPin: true
  },
  { 
    id: "fallback-gk", 
    itemName: "Greater Kailash Local Annotation",
    category: "Other", 
    latitude: lat - 0.003, 
    longitude: lng - 0.012, 
    locationName: "Greater Kailash", 
    isDecorationOnly: true,
    hasPin: false
  },
  { 
    id: "fallback-kalkaji", 
    itemName: "Kalkaji Local Annotation",
    category: "Other", 
    latitude: lat + 0.007, 
    longitude: lng - 0.002, 
    locationName: "Kalkaji", 
    isDecorationOnly: true,
    hasPin: false
  },
  { 
    id: "fallback-jasola", 
    itemName: "Jasola Local Annotation",
    category: "Other", 
    latitude: lat - 0.012, 
    longitude: lng + 0.004, 
    locationName: "Jasola", 
    isDecorationOnly: true,
    hasPin: false
  },
  { 
    id: "fallback-kb", 
    itemName: "Karauli Bagh Local Annotation",
    category: "Other", 
    latitude: lat + 0.002, 
    longitude: lng - 0.026, 
    locationName: "Karauli Bagh", 
    isDecorationOnly: true,
    hasPin: false
  },
  { 
    id: "fallback-yamuna", 
    itemName: "Yamuna Local Annotation",
    category: "Other", 
    latitude: lat + 0.011, 
    longitude: lng + 0.027, 
    locationName: "Yamuna", 
    isDecorationOnly: true,
    hasPin: false
  }
];

export default function MohallaRadar({ 
  currentUser, 
  onAuthRequired, 
  onBorrowSuccess, 
  initialLocationSharing, 
  initialLat, 
  initialLng, 
  onBack,
  embedMode = false,
  selectedItemFromParent = null,
  onItemsUpdate = null
}) {
  const [L, setL] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((mod) => {
        setL(mod.default || mod);
      });
    }
  }, []);

  // Location settings
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(initialLocationSharing || false);
  const [centerLat, setCenterLat] = useState(initialLat || 28.6448);
  const [centerLng, setCenterLng] = useState(initialLng || 77.2167);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(5.0);
  const [category, setCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState("nearest");

  // Items State
  const [items, setItems] = useState([]);
  const [selectedRadarItem, setSelectedRadarItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Map DOM Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Synchronise initial locations when values are fetched
  useEffect(() => {
    setLocationSharingEnabled(initialLocationSharing);
    if (initialLat && initialLng) {
      setCenterLat(initialLat);
      setCenterLng(initialLng);
    }
  }, [initialLocationSharing, initialLat, initialLng]);

  // Automatically fetch local browser geolocation on start if not provided
  useEffect(() => {
    if (!initialLat && !initialLng && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocationSharingEnabled(true);
          setCenterLat(lat);
          setCenterLng(lng);
          if (currentUser) {
            updateSharingSettings(true, lat, lng);
          }
        },
        (error) => {
          console.error("Auto-location fetch on mount failed/denied:", error);
        }
      );
    }
  }, [initialLat, initialLng, currentUser]);

  // Synchronise selected item from discovery list
  useEffect(() => {
    if (selectedItemFromParent) {
      setSelectedRadarItem(selectedItemFromParent);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([selectedItemFromParent.latitude, selectedItemFromParent.longitude], 15);
      }
    }
  }, [selectedItemFromParent]);

  // Update parent when items update
  useEffect(() => {
    if (onItemsUpdate) {
      onItemsUpdate(items);
    }
  }, [items, onItemsUpdate]);

  // Fetch items from database via backend
  const fetchRadarItems = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const url = `http://localhost:8085/api/radar/items?lat=${centerLat}&lng=${centerLng}&radius=${radiusKm}&category=${category}&q=${searchQuery}&sort=${sortOrder}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const apiItems = data || [];
        const mocks = getMockupItems(centerLat, centerLng);
        // Merge DB items with mocked items dynamically by name
        const merged = [...apiItems, ...mocks.filter(m => !apiItems.some(i => i.itemName.toLowerCase() === m.itemName.toLowerCase()))];
        setItems(merged);
      } else {
        setItems(getMockupItems(centerLat, centerLng));
      }
    } catch (err) {
      console.error("Error loading radar items:", err);
      setItems(getMockupItems(centerLat, centerLng));
    } finally {
      setLoading(false);
    }
  };

  // Triggers reload on filter changes
  useEffect(() => {
    fetchRadarItems();
  }, [centerLat, centerLng, radiusKm, category, sortOrder]);

  // Trigger search on debounce or manual press
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRadarItems();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update backend coordinates
  const updateSharingSettings = async (enabled, lat, lng) => {
    if (!currentUser) return;
    try {
      const res = await fetch("http://localhost:8085/api/user/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          locationSharingEnabled: enabled,
          latitude: lat,
          longitude: lng,
        }),
      });
      if (res.ok) {
        setLocationSharingEnabled(enabled);
        setCenterLat(lat);
        setCenterLng(lng);
        // Refresh items explicitly
        fetchRadarItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Request browser location
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (currentUser) {
          updateSharingSettings(true, lat, lng);
        } else {
          setCenterLat(lat);
          setCenterLng(lng);
        }
      },
      (error) => {
        console.error("Location error:", error);
        alert("Location access was denied. Showing default mohalla center coordinates.");
      }
    );
  };

  const handleDisableSharing = () => {
    if (currentUser) {
      updateSharingSettings(false, 0, 0);
    } else {
      setLocationSharingEnabled(false);
    }
  };

  const handleRecenterMap = () => {
    if (mapInstanceRef.current && centerLat && centerLng) {
      mapInstanceRef.current.setView([centerLat, centerLng], 14, { animate: true });
    }
  };

  const handleZoomMap = (delta) => {
    if (mapInstanceRef.current) {
      const zoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(zoom + delta);
    }
  };

  // Ask to borrow action handler
  const handleAskToBorrow = async (item) => {
    if (!currentUser) {
      onAuthRequired("Please sign in or create a profile to borrow items.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8085/api/borrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          itemId: `radar-item-${item.id}`,
          itemName: item.itemName,
          lender: item.owner,
          daysLeft: 3,
          since: "borrowed today",
          note: item.description || `Borrowed via radar (${formatKm(item.distanceKm)} away)`,
        }),
      });
      if (res.ok) {
        setSelectedRadarItem(null);
        onBorrowSuccess(item.itemName);
      } else {
        alert("Failed to submit request to borrow on server.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting the server.");
    }
  };

  // Helper map emojis based on item categories
  const getItemEmoji = (cat) => {
    switch (cat) {
      case "Electronics": return "📽️";
      case "Tools": return "🪜";
      case "Books": return "📚";
      case "Home": return "🍚";
      case "Outdoor": return "⛺";
      case "Events": return "🔊";
      default: return "📦";
    }
  };

  // Leaflet Map Initialization and Operations
  useEffect(() => {
    if (!L || !mapContainerRef.current) return;

    // Destroy existing instance if container re-rendered
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true
    });
    mapInstanceRef.current = map;

    // Base Layer: Black map background with greyish roads
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      className: "grey-map-base",
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> contributors'
    }).addTo(map);

    // Labels Layer: City/neighbourhood names placed on top and filtered to teal
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      className: "teal-map-labels",
      attribution: ''
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    markersGroupRef.current = group;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L]);

  // Update map coordinates if map is running
  useEffect(() => {
    if (L && mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], 14);
    }
  }, [L, centerLat, centerLng]);

  // Redraw custom item pins & user indicator on map
  useEffect(() => {
    if (!L) return;
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Draw User coordinate marker if enabled
    if (locationSharingEnabled && centerLat && centerLng) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-32 h-32 pointer-events-none select-none">
            <div class="absolute w-28 h-28 rounded-full border border-cyan-400/10"></div>
            <div class="absolute w-20 h-20 rounded-full border border-dashed border-cyan-400/20"></div>
            <div class="absolute w-12 h-12 rounded-full border border-cyan-400/30"></div>
            <div class="absolute w-12 h-12 rounded-full border border-cyan-400/40 animate-ping opacity-25"></div>
            <div class="absolute w-3.5 h-3.5 bg-[#0dedff] rounded-full border border-white shadow-[0_0_12px_rgba(13,237,255,0.95)] z-10"></div>
          </div>
        `,
        className: "custom-user-indicator-marker",
        iconSize: [128, 128],
        iconAnchor: [64, 64]
      });
      L.marker([centerLat, centerLng], { icon: userIcon }).addTo(group);
    }

    // 2. Draw lendable items markers
    items.forEach((item) => {
      const locName = item.locationName || item.shelfName || "mohalla";
      const showPin = item.hasPin !== false;
      
      const itemIcon = L.divIcon({
        html: `
          <div class="relative flex flex-col items-center justify-start w-[200px] h-[60px] select-none pointer-events-none">
            ${showPin ? `
              <div class="relative flex flex-col items-center hover:scale-115 transition-transform duration-200 pointer-events-auto cursor-pointer">
                {/* Glow ring */}
                <div class="absolute -top-1 w-6 h-6 rounded-full bg-yellow-500/20 blur-sm"></div>
                {/* Tear-drop golden pin SVG */}
                <svg class="w-6 h-6 text-[#cfbda3] fill-current drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            ` : ""}
            <span class="absolute ${showPin ? "top-[25px]" : "top-[4px]"} font-hand text-[22px] sm:text-[25px] text-[#559eb4] whitespace-nowrap tracking-wide select-none leading-none pt-0.5 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              ${locName}
            </span>
          </div>
        `,
        className: `radar-marker-${item.id}`,
        iconSize: [200, 60],
        iconAnchor: [100, 10]
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: itemIcon }).addTo(group);
      marker.on("click", () => {
        setSelectedRadarItem(item);
      });
    });
  }, [L, items, locationSharingEnabled, centerLat, centerLng, currentUser]);

  return (
    <div className={embedMode ? "relative w-full h-full z-10 bg-slate-950 flex flex-col overflow-hidden animate-fade-in" : "fixed inset-0 w-screen h-screen z-50 bg-slate-950 flex flex-col overflow-hidden decode-overlay"}>
      
      {/* Edge-to-Edge Map DOM */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 w-full h-full z-10"
      />

      {/* Custom Sleek Glassmorphic Map Controls Stack */}
      <div className="absolute bottom-[160px] right-4 sm:right-6 md:right-8 z-25 flex flex-col gap-2 pointer-events-auto">
        {/* Recenter button */}
        <button
          type="button"
          onClick={handleRecenterMap}
          className="w-10 h-10 rounded-lg border border-teal-500/20 bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-teal-400 hover:text-yellow-400 hover:border-yellow-400/40 transition-colors shadow-lg cursor-pointer font-bold focus:outline-none"
          title="Recenter on User"
        >
          <span className="text-xl font-light leading-none">◎</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-lg border border-teal-500/20 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => handleZoomMap(1)}
            className="w-10 h-10 flex items-center justify-center text-teal-400 hover:text-yellow-400 transition-colors border-b border-teal-500/10 cursor-pointer font-light text-2xl focus:outline-none"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoomMap(-1)}
            className="w-10 h-10 flex items-center justify-center text-teal-400 hover:text-yellow-400 transition-colors cursor-pointer font-light text-2xl focus:outline-none"
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>

      {/* Embedded Gradient Blending Overlays */}
      {embedMode && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#020b18] via-[#020b18]/65 to-transparent z-25 pointer-events-none" />
        </>
      )}

      {/* Floating Header UI — Hidden in embedMode */}
      {!embedMode && (
        <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 pointer-events-none">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pointer-events-auto border-b border-dashed border-white/20 pb-4 bg-transparent px-2">
            
            {/* Back Action */}
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="bg-transparent hover:text-yellow-400 text-white font-mono text-xs sm:text-sm uppercase tracking-widest px-1 py-1 transition-all cursor-pointer flex items-center gap-1.5 border-b border-white/20 hover:border-yellow-400"
              >
                ← Back to Store
              </button>
              <div>
                <span className="font-zeyada text-4xl sm:text-5xl text-white font-normal pl-2 block tracking-wide select-none leading-none pt-0.5">
                  mohalla radar
                </span>
              </div>
            </div>
    
            {/* Quick Info & Option */}
            <div className="flex items-center gap-3">
              {locationSharingEnabled ? (
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] sm:text-xs text-green-400 uppercase tracking-wider pb-1 border-b border-green-500/20">
                    📡 Sharing (Fuzzed: ~100m shifted)
                  </span>
                  <button
                    type="button"
                    onClick={handleDisableSharing}
                    className="text-red-400 hover:text-red-300 font-mono text-[10px] sm:text-xs uppercase tracking-widest px-2 py-0.5 transition-all cursor-pointer bg-transparent border-b border-red-500/20 hover:border-red-400"
                  >
                    Disable
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRequestLocation}
                  className="font-mono text-[10px] sm:text-xs text-yellow-400 px-2 py-0.5 font-bold uppercase tracking-wider hover:text-yellow-300 transition-all cursor-pointer bg-transparent border-b border-yellow-500/20 hover:border-yellow-400"
                >
                  📍 Enable Location Sharing
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mini Location widget inside map when NOT embedded */}
      {!embedMode && (
        <div className="absolute top-4 right-4 z-35 pointer-events-auto bg-slate-950/85 backdrop-blur-md px-3 py-1.5 border border-white/10 rounded font-mono text-[10px] tracking-wider uppercase">
          {locationSharingEnabled ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-semibold">📡 Sharing</span>
              <button
                type="button"
                onClick={handleDisableSharing}
                className="text-red-400 hover:text-red-300 font-bold underline cursor-pointer ml-1"
              >
                Disable
              </button>
            </div>
          ) : (
            <button
              onClick={handleRequestLocation}
              className="text-yellow-400 hover:text-yellow-300 font-bold cursor-pointer"
            >
              📍 Share Location
            </button>
          )}
        </div>
      )}

      {/* Floating Filter Overlay when NOT embedded */}
      {!embedMode && (
        <div className="absolute top-28 sm:top-24 inset-x-0 z-30 p-4 pointer-events-none">
          <div className="max-w-7xl mx-auto grid gap-4 grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_0.3fr] pointer-events-auto border-b border-dashed border-white/20 pb-4 bg-transparent px-2">
            
            {/* Query Text Search */}
            <div className="col-span-2 md:col-span-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔎 Search items..."
                className="w-full bg-transparent border-0 border-b border-white/20 text-white px-1 py-1.5 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-yellow-400 placeholder:text-white/40 rounded-none"
              />
            </div>
      
            {/* Distance Threshold */}
            <div>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full bg-transparent text-white border-0 border-b border-white/20 px-1 py-1.5 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-yellow-400 cursor-pointer rounded-none"
              >
                <option value="0.5" className="bg-slate-950 text-white">500 m</option>
                <option value="1" className="bg-slate-950 text-white">1 km</option>
                <option value="2" className="bg-slate-950 text-white">2 km</option>
                <option value="5" className="bg-slate-950 text-white">5 km</option>
                <option value="10" className="bg-slate-950 text-white">10 km</option>
              </select>
            </div>
      
            {/* Category Dropdown */}
            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-white border-0 border-b border-white/20 px-1 py-1.5 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-yellow-400 cursor-pointer rounded-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-950 text-white">
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
            </div>
      
            {/* Sorting Option */}
            <div>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full bg-transparent text-white border-0 border-b border-white/20 px-1 py-1.5 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-yellow-400 cursor-pointer rounded-none"
              >
                <option value="nearest" className="bg-slate-950 text-white">Nearest First</option>
                <option value="recent" className="bg-slate-950 text-white">Recent First</option>
              </select>
            </div>
      
            {/* Refresh Location Center button */}
            <div className="col-span-2 md:col-span-1 flex justify-end">
              <button
                type="button"
                onClick={handleRequestLocation}
                title="Refresh / Recenter location"
                className="w-full h-8 justify-center items-center flex bg-transparent border-0 border-b border-white/20 hover:border-yellow-400 text-white hover:text-yellow-400 transition-colors uppercase tracking-widest font-mono text-xl sm:text-2xl cursor-pointer rounded-none animate-pulse"
              >
                ◎
              </button>
            </div>
      
          </div>
        </div>
      )}
  
      {/* Floating Bottom Metadata and Controls when NOT embedded */}
      {!embedMode && (
        <div className="absolute bottom-12 right-12 z-30 pointer-events-auto border-b border-dashed border-white/20 pb-1 px-1">
          <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.25em] text-[#cfbda3] font-bold">
            {items.length} active things found in range
          </span>
        </div>
      )}
 
      {/* Loading / Error overlays */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-20 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.25em] text-yellow-400 animate-pulse bg-slate-900/80 px-4 py-2 border border-white/5 rounded">
            Scanning Padosi Shelves...
          </span>
        </div>
      )}
 
      {errorMsg && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border border-white/10 p-6 rounded text-center shadow-2xl w-80">
          <span className="text-2xl mb-1 block">📡</span>
          <p className="font-mono text-xs text-[#cfbda3] tracking-widest uppercase mb-4">{errorMsg}</p>
          <button
            onClick={fetchRadarItems}
            className="bg-white/5 border border-white/10 hover:border-white text-white font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}
 
      {items.length === 0 && !loading && !errorMsg && !embedMode && (
        <div className="absolute top-1/7 left-1/2 -translate-x-1/2 z-45 bg-[#0a121e]/95 border border-white/15 p-6 rounded text-center shadow-2xl w-80 backdrop-blur-md">
          <span className="text-3xl block mb-2">🤷‍♂️</span>
          <h5 className="font-display text-lg font-bold text-white mb-1">Your neighbourhood is quiet...</h5>
          <p className="font-mono text-sm uppercase tracking-wider text-panel-note mb-4">
            No items listed within {radiusKm} km.
          </p>
          <button
            onClick={() => setRadiusKm(10)}
            className="w-full text-center bg-white/5 border border-white/10 hover:border-white text-white font-mono text-sm uppercase tracking-widest py-2 transition-colors cursor-pointer"
          >
            Expand Range to 10 km
          </button>
        </div>
      )}

      {/* Item drawer detail overlay card */}
      {selectedRadarItem && (
        <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:w-96 bg-transparent border-t border-dashed border-white/30 p-5 z-30 transition-all duration-300 animate-fade-in text-left">
          <button
            onClick={() => setSelectedRadarItem(null)}
            className="absolute top-3 right-3 text-white/50 hover:text-white font-mono text-sm cursor-pointer"
          >
            ✕
          </button>
          <div className="flex items-start gap-4">
            <span className="text-3xl mt-1">{getItemEmoji(selectedRadarItem.category)}</span>
            <div>
              <h3 className="font-display text-2xl sm:text-3xl font-black text-white hover:text-yellow-400 transition-colors">
                {selectedRadarItem.itemName}
              </h3>
              <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.2em] text-[#cfbda3] block mt-1">
                {selectedRadarItem.category} · {formatKm(selectedRadarItem.distanceKm)} away
              </span>
              <span className="font-mono text-xs sm:text-sm text-panel-note block my-1">
                🚶 ~{Math.round(selectedRadarItem.distanceKm * 12)} min walk
              </span>
            </div>
          </div>

          {selectedRadarItem.description && (
            <p className="text-sm font-mono text-panel-note border-b border-dashed border-white/15 pb-2 line-clamp-3 mt-3">
              {selectedRadarItem.description}
            </p>
          )}

          <div className="mt-4 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] sm:text-xs text-panel-note uppercase tracking-wider block">Owner</span>
                <span className="font-mono text-xs sm:text-sm text-white">
                  🚪 {selectedRadarItem.shelfName || `${selectedRadarItem.owner}'s Shelf`}
                </span>
              </div>
              <span className="bg-green-500/10 text-green-400 border border-green-500/25 rounded px-2 py-0.5 font-mono text-[10px] sm:text-xs uppercase tracking-widest font-bold">
                Available
              </span>
            </div>

            {currentUser && selectedRadarItem.owner === currentUser.username ? (
              <div className="w-full text-center border-t border-white/10 text-white/50 font-mono text-xs sm:text-sm uppercase tracking-widest py-2 select-none">
                This is your item
              </div>
            ) : (
              <button
                onClick={() => handleAskToBorrow(selectedRadarItem)}
                className="w-full text-center bg-[#ea580c] hover:bg-orange-500 text-white font-mono text-xs sm:text-sm uppercase tracking-widest py-2.5 font-bold cursor-pointer transition-all border-b border-orange-300/30"
              >
                Ask to Borrow
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
