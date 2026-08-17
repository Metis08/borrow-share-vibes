import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { formatKm } from "@/lib/lenders";

const CATEGORIES = ["All", "Electronics", "Tools", "Books", "Home", "Outdoor", "Events", "Other"];

// Generate procedural 3D building blocks around neighborhood
const generate3dBuildings = (centerLat, centerLng) => {
  const buildings = [];
  const count = 52;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 7) * 0.12;
    const dist = 0.002 + ((i * 31) % 120) * 0.00016;
    const lat = centerLat + Math.sin(angle) * dist;
    const lng = centerLng + Math.cos(angle) * dist * 1.35;
    const width = 26 + (i % 5) * 8;
    const height = 20 + (i % 4) * 6;
    const stories = 5 + ((i * 19) % 18); // 5 to 23 stories

    buildings.push({
      lat,
      lng,
      width,
      height,
      stories,
      colorFront: i % 3 === 0 ? "#0d3142" : "#08222f",
      colorSide: i % 3 === 0 ? "#14455d" : "#0e3447",
      colorRoof: i % 3 === 0 ? "#1c6082" : "#134966"
    });
  }
  return buildings;
};

// Canvas 3D Building Extrusion Layer for Leaflet
const create3dBuildingCanvasLayer = (L, centerLat, centerLng) => {
  const CanvasLayer = L.Layer.extend({
    onAdd: function (map) {
      this._map = map;
      this._canvas = L.DomUtil.create("canvas", "leaflet-3d-buildings-canvas");
      this._canvas.style.position = "absolute";
      this._canvas.style.top = "0";
      this._canvas.style.left = "0";
      this._canvas.style.pointerEvents = "none";
      this._canvas.style.zIndex = "4";
      map.getPanes().overlayPane.appendChild(this._canvas);

      map.on("move zoom reset", this._update, this);
      this._update();
    },

    onRemove: function (map) {
      L.DomUtil.remove(this._canvas);
      this._map.off("move zoom reset", this._update, this);
    },

    _update: function () {
      const map = this._map;
      if (!map) return;
      const size = map.getSize();
      this._canvas.width = size.x;
      this._canvas.height = size.y;

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, topLeft);

      const ctx = this._canvas.getContext("2d");
      ctx.clearRect(0, 0, size.x, size.y);

      const buildings = generate3dBuildings(centerLat, centerLng);
      // Sort buildings by latitude for correct 3D overlap depth
      buildings.sort((a, b) => b.lat - a.lat);

      buildings.forEach((b) => {
        const basePoint = map.latLngToContainerPoint([b.lat, b.lng]);
        const w = b.width;
        const h = b.height;
        const depth = b.stories * 2.4; // Extrusion height

        const x0 = basePoint.x - w / 2;
        const y0 = basePoint.y - h / 2;
        const x1 = basePoint.x + w / 2;
        const y1 = basePoint.y + h / 2;

        const rx0 = x0;
        const ry0 = y0 - depth;
        const rx1 = x1;
        const ry1 = y1 - depth;

        // Front Wall
        ctx.fillStyle = b.colorFront;
        ctx.beginPath();
        ctx.moveTo(x0, y1);
        ctx.lineTo(x1, y1);
        ctx.lineTo(rx1, ry1);
        ctx.lineTo(rx0, ry1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right Side Wall
        ctx.fillStyle = b.colorSide;
        ctx.beginPath();
        ctx.moveTo(x1, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(rx1, ry1);
        ctx.lineTo(rx1, ry0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.15)";
        ctx.stroke();

        // Roof Top
        ctx.fillStyle = b.colorRoof;
        ctx.beginPath();
        ctx.moveTo(rx0, ry0);
        ctx.lineTo(rx1, ry0);
        ctx.lineTo(rx1, ry1);
        ctx.lineTo(rx0, ry1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
        ctx.stroke();

        // Glowing Windows Grid on facades
        if (b.stories > 5) {
          ctx.fillStyle = "rgba(251, 191, 36, 0.75)";
          for (let floor = 1; floor < b.stories - 1; floor += 3) {
            const wy = y1 - floor * 2.2;
            ctx.fillRect(x0 + 4, wy, 3, 2);
            ctx.fillRect(x0 + 12, wy, 3, 2);
            if (w > 26) ctx.fillRect(x0 + 20, wy, 3, 2);
          }
        }
      });
    }
  });

  return new CanvasLayer();
};

const getMockupItems = (lat, lng) => [
  { 
    id: "fallback-cam", 
    itemName: "Sony Alpha DSLR", 
    category: "Electronics", 
    description: "Full-frame 4K Mirrorless Camera", 
    distanceKm: 0.35, 
    owner: "Priyanka S.", 
    shelfName: "Priyanka's Shelf",
    phone: "9876543212",
    latitude: lat + 0.0018, 
    longitude: lng - 0.0025, 
    locationName: "Govindpuri Block B",
    hasPin: true
  },
  { 
    id: "fallback-proj", 
    itemName: "Full HD Projector", 
    category: "Electronics", 
    description: "4K Home Theater Projector with screen", 
    distanceKm: 0.50, 
    owner: "Mahek A.", 
    shelfName: "Mahek's Shelf",
    phone: "9876543210",
    latitude: lat - 0.0015, 
    longitude: lng + 0.0028, 
    locationName: "Kalkaji D-Block",
    hasPin: true
  },
  { 
    id: "fallback-tripod", 
    itemName: "Carbon Tripod", 
    category: "Electronics", 
    description: "Professional lightweight camera tripod", 
    distanceKm: 0.65, 
    owner: "Ritu M.", 
    shelfName: "Ritu's Shelf",
    phone: "9876543216",
    latitude: lat + 0.0032, 
    longitude: lng + 0.0019, 
    locationName: "Nehru Enclave",
    hasPin: true
  },
  { 
    id: "fallback-lad", 
    itemName: "Telescopic Ladder", 
    category: "Tools", 
    description: "12-foot heavy duty aluminum ladder", 
    distanceKm: 0.85, 
    owner: "Rohan K.", 
    shelfName: "Rohan's Shelf",
    phone: "9876543211",
    latitude: lat - 0.0028, 
    longitude: lng - 0.0035, 
    locationName: "Alaknanda",
    hasPin: true
  },
  { 
    id: "fallback-tent", 
    itemName: "Quechua 3P Tent", 
    category: "Outdoor", 
    description: "Waterproof 3-person waterproof tent", 
    distanceKm: 1.10, 
    owner: "Vikram P.", 
    shelfName: "Vikram's Shelf",
    phone: "9876543214",
    latitude: lat + 0.0042, 
    longitude: lng - 0.0048, 
    locationName: "Chittaranjan Park",
    hasPin: true
  },
  { 
    id: "fallback-speaker", 
    itemName: "JBL PartyBox", 
    category: "Events", 
    description: "High bass bluetooth party speaker", 
    distanceKm: 1.25, 
    owner: "Aman T.", 
    shelfName: "Aman's Shelf",
    phone: "9876543215",
    latitude: lat - 0.0038, 
    longitude: lng + 0.0045, 
    locationName: "GK-II",
    hasPin: true
  },
  { 
    id: "fallback-gk", 
    itemName: "Greater Kailash",
    category: "Other", 
    latitude: lat - 0.003, 
    longitude: lng - 0.005, 
    locationName: "Greater Kailash", 
    isDecorationOnly: true,
    hasPin: false
  },
  { 
    id: "fallback-kalkaji", 
    itemName: "Kalkaji",
    category: "Other", 
    latitude: lat + 0.003, 
    longitude: lng - 0.001, 
    locationName: "Kalkaji", 
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

  const handleRecenterMap = () => {
    if (mapInstanceRef.current && centerLat && centerLng) {
      mapInstanceRef.current.setView([centerLat, centerLng], 15, { animate: true });
    }
  };

  const handleZoomMap = (delta) => {
    if (mapInstanceRef.current) {
      const zoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(zoom + delta);
    }
  };

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
    if (selectedItemFromParent && selectedItemFromParent.latitude && selectedItemFromParent.longitude) {
      setSelectedRadarItem(selectedItemFromParent);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({ center: [selectedItemFromParent.longitude, selectedItemFromParent.latitude], zoom: 16.5, pitch: 60 });
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

  // Trigger search on debounce
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

  // Leaflet 3D Building Dark Map Initialization
  useEffect(() => {
    if (!L || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // CartoDB Dark Matter Base Tiles (With custom Dark Teal Glassmorphic CSS filter)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      className: "mohalla-dark-teal-glass-map-tiles",
      attribution: '&copy; CartoDB &copy; OpenStreetMap'
    }).addTo(map);

    // 3D Extruded Building Layer
    const buildingCanvas = create3dBuildingCanvasLayer(L, centerLat, centerLng);
    buildingCanvas.addTo(map);

    const group = L.layerGroup().addTo(map);
    markersGroupRef.current = group;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L, centerLat, centerLng]);

  // Update map center when coordinates change
  useEffect(() => {
    if (L && mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], 15);
    }
  }, [L, centerLat, centerLng]);

  // Redraw custom 3D floating item markers & user location indicator
  useEffect(() => {
    if (!L) return;
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. User Location Indicator (3D Glowing Gold Ping)
    if (locationSharingEnabled && centerLat && centerLng) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-16 h-16 pointer-events-none select-none">
            <div class="absolute w-14 h-14 rounded-full border-2 border-amber-400/50 animate-ping"></div>
            <div class="absolute w-10 h-10 rounded-full border border-dashed border-amber-300/60"></div>
            <div class="absolute w-4 h-4 bg-amber-400 rounded-full border-2 border-white shadow-[0_0_20px_rgba(251,191,36,0.95)] z-10"></div>
          </div>
        `,
        className: "custom-user-indicator-marker",
        iconSize: [64, 64],
        iconAnchor: [32, 32]
      });
      L.marker([centerLat, centerLng], { icon: userIcon }).addTo(group);
    }

    // 2. Lendable Items Markers (Sleek Dark 3D Floating Pill Badges with Ground Pins)
    items.forEach((item) => {
      const locName = item.locationName || item.shelfName || "mohalla";
      const isDecor = item.isDecorationOnly;
      const emoji = getItemEmoji(item.category);

      if (isDecor) {
        const decorIcon = L.divIcon({
          html: `
            <div class="font-hand text-[22px] text-amber-300 font-bold whitespace-nowrap tracking-wide select-none filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              ${locName}
            </div>
          `,
          className: `radar-decor-${item.id}`,
          iconSize: [150, 40],
          iconAnchor: [75, 20]
        });
        L.marker([item.latitude, item.longitude], { icon: decorIcon }).addTo(group);
        return;
      }

      const itemIcon = L.divIcon({
        html: `
          <div class="group relative flex flex-col items-center justify-center cursor-pointer select-none">
            <!-- Dark 3D Floating Pill Badge -->
            <div class="flex items-center gap-2 bg-[#081522]/95 hover:bg-[#0e2238] text-white border border-amber-400/85 shadow-[0_12px_36px_rgba(0,0,0,0.95)] px-3.5 py-1.5 rounded-full backdrop-blur-md transform group-hover:scale-115 transition-all duration-300">
              <span class="text-base leading-none filter drop-shadow">${emoji}</span>
              <span class="font-display text-xs font-semibold tracking-wide text-white whitespace-nowrap">${item.itemName}</span>
              <span class="font-mono text-[10px] text-amber-300 font-bold whitespace-nowrap">· ${formatKm(item.distanceKm)}</span>
            </div>
            <!-- 3D Ground Stem Line -->
            <div class="w-0.5 h-3.5 bg-gradient-to-b from-amber-400/90 to-amber-400/20"></div>
            <div class="w-2.5 h-1 bg-amber-400/70 rounded-full blur-[1px]"></div>
          </div>
        `,
        className: `radar-item-marker-${item.id}`,
        iconSize: [180, 60],
        iconAnchor: [90, 60]
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: itemIcon }).addTo(group);
      marker.on("click", () => {
        setSelectedRadarItem(item);
      });
    });
  }, [L, items, locationSharingEnabled, centerLat, centerLng]);

  return (
    <div className={embedMode ? "fixed inset-0 w-screen h-screen z-0 bg-[#051722] flex flex-col overflow-hidden animate-fade-in" : "fixed inset-0 w-screen h-screen z-50 bg-[#051722] flex flex-col overflow-hidden decode-overlay"}>
      
      {/* Edge-to-Edge Full Screen 3D Map DOM */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Dark Blue Glassmorphic Atmosphere Overlay Layer */}
      <div className="absolute inset-0 z-5 pointer-events-none bg-gradient-to-br from-[#06293a]/45 via-[#09364c]/25 to-[#041926]/55 backdrop-blur-[1.5px] shadow-[inset_0_0_150px_rgba(14,116,144,0.38)] border border-teal-500/10" />

      {/* Floating Glassmorphic Map Controls Stack */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 pointer-events-auto">
        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenterMap}
          className="w-10 h-10 rounded-full border border-white/20 bg-slate-900/90 backdrop-blur-md flex items-center justify-center text-amber-400 hover:text-white hover:border-amber-400 transition-colors shadow-2xl cursor-pointer font-bold focus:outline-none"
          title="Recenter on User"
        >
          <span className="text-xl font-light leading-none">◎</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-full border border-white/20 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-2xl">
          <button
            type="button"
            onClick={() => handleZoomMap(1)}
            className="w-10 h-10 flex items-center justify-center text-amber-400 hover:text-white transition-colors border-b border-white/10 cursor-pointer font-light text-2xl focus:outline-none"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoomMap(-1)}
            className="w-10 h-10 flex items-center justify-center text-amber-400 hover:text-white transition-colors cursor-pointer font-light text-2xl focus:outline-none"
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
