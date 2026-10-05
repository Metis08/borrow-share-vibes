import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

export const Route = createFileRoute("/radar")({
  component: MohallaRadarPage,
});

const resolveRadarImage = (url) => {
  if (!url) return "";
  return apiUrl(url);
};

export function MohallaRadarPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const userMarkerRef = useRef(null);
  const circle100Ref = useRef(null);
  const circle250Ref = useRef(null);

  const [filterRadius, setFilterRadius] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [radarItems, setRadarItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exact real coordinates (default: Ekta Square base coords)
  const storedUser = typeof window !== "undefined" ? getStoredUser() : null;
  const initialLat = storedUser?.latitude && storedUser.latitude !== 0 ? storedUser.latitude : 28.53139;
  const initialLng = storedUser?.longitude && storedUser.longitude !== 0 ? storedUser.longitude : 77.25447;

  const [centerLat, setCenterLat] = useState(initialLat);
  const [centerLng, setCenterLng] = useState(initialLng);

  // Request user high-accuracy geolocation on mount
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenterLat(pos.coords.latitude);
          setCenterLng(pos.coords.longitude);
        },
        (err) => {
          console.log("Using stored/default Mohalla coordinates:", err.message);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }
  }, []);

  // Fetch real items from backend Radar API
  useEffect(() => {
    const fetchRadar = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/radar/items?lat=${centerLat}&lng=${centerLng}&radius=50`));
        if (res.ok) {
          const data = await res.json();
          setRadarItems(Array.isArray(data) ? data : []);
        } else {
          setRadarItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch radar items:", err);
        setRadarItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRadar();
  }, [centerLat, centerLng]);

  const filteredItems = radarItems.filter((item) => {
    const title = item.itemName || item.title || "";
    const owner = item.shelfName || item.owner || "";
    const cat = item.category || "";
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    const distMeters = (item.distanceKm || item.distanceKM || 0) * 1000;
    if (filterRadius === "100m") return distMeters <= 100;
    if (filterRadius === "250m") return distMeters <= 250;
    if (filterRadius === "500m") return distMeters <= 500;
    if (filterRadius === "5km") return distMeters <= 5000;
    if (filterRadius === "tools") return cat.toLowerCase().includes("tool");
    if (filterRadius === "electronics") return cat.toLowerCase().includes("electronic") || cat.toLowerCase().includes("gear");
    return true;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    let isMounted = true;

    Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css")
    ]).then(([leafletModule]) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = leafletModule.default || leafletModule;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      // High-detail OpenStreetMap tile layer with full neighborhood boundaries, blocks, and street grids
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 19,
        className: "mohalla-dark-map-base",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Custom Dark Teal User Pin
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-9 h-9 rounded-full bg-[#083842] border-2 border-white/80 flex items-center justify-center text-white text-sm font-bold shadow-2xl animate-pulse">
              📍
            </div>
            <div class="absolute -top-7 bg-neutral-900 text-neutral-200 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-neutral-700 whitespace-nowrap shadow-xl">
              You (Ekta Square)
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      userMarkerRef.current = L.marker([centerLat, centerLng], { icon: userIcon }).addTo(map);

      // Concentric Radar Area Rings in Dark Grey Lines
      circle100Ref.current = L.circle([centerLat, centerLng], {
        radius: 100,
        color: "#4b5563",
        weight: 1.5,
        dashArray: "4, 6",
        fillColor: "#1f2937",
        fillOpacity: 0.12
      }).addTo(map);

      circle250Ref.current = L.circle([centerLat, centerLng], {
        radius: 250,
        color: "#374151",
        weight: 1.5,
        dashArray: "4, 8",
        fillColor: "#111827",
        fillOpacity: 0.06
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = { L, markersGroup };

      mapInstanceRef.current = map;
      renderMarkers(filteredItems, L, markersGroup);
    }).catch(err => {
      console.error("Leaflet map load error:", err);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Dynamically synchronize User Pin and Radar Rings when live GPS updates
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([centerLat, centerLng]);
    }
    if (circle100Ref.current) {
      circle100Ref.current.setLatLng([centerLat, centerLng]);
    }
    if (circle250Ref.current) {
      circle250Ref.current.setLatLng([centerLat, centerLng]);
    }
  }, [centerLat, centerLng]);

  const handleRecenterGPS = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCenterLat(lat);
          setCenterLng(lng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true });
          }
        },
        (err) => {
          console.warn("GPS error:", err.message);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([centerLat, centerLng], 16, { animate: true });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([centerLat, centerLng], 16, { animate: true });
    }
  };

  useEffect(() => {
    if (markersGroupRef.current) {
      const { L, markersGroup } = markersGroupRef.current;
      renderMarkers(filteredItems, L, markersGroup);
    }
  }, [filteredItems, filterRadius, searchQuery]);

  const renderMarkers = (items, L, markersGroup) => {
    markersGroup.clearLayers();
    items.forEach((item) => {
      const lat = item.latitude || item.lat;
      const lng = item.longitude || item.lng;
      if (!lat || !lng) return;

      const title = item.itemName || item.title || "Item";
      const owner = item.shelfName || item.owner || "Neighbour";
      const category = item.category || "General";
      const distanceStr = item.distanceKm ? `${item.distanceKm.toFixed(2)}km away` : (item.distance || "Nearby");
      const img = resolveRadarImage(item.imageUrl || item.image_url || item.image);

      const markerIcon = L.divIcon({
        className: "custom-item-marker",
        html: `
          <div class="group relative cursor-pointer flex flex-col items-center select-none">
            <div class="w-12 h-12 rounded-2xl bg-[#0d0f17] border border-teal-500/50 shadow-2xl p-1 flex items-center justify-center transform transition-transform group-hover:scale-115">
              ${img ? `<img src="${img}" alt="${title}" class="w-full h-full object-contain rounded-xl" />` : `<span class="text-xl">📦</span>`}
            </div>
            <div class="mt-1 bg-neutral-950/95 text-neutral-200 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-neutral-700 whitespace-nowrap shadow-lg">
              ${title.split(' ')[0]} • ${distanceStr}
            </div>
          </div>
        `,
        iconSize: [48, 64],
        iconAnchor: [24, 32],
      });

      const popupContent = `
        <div style="background-color: #0d0f17; border: 1px solid #1e293b; border-radius: 1.25rem; padding: 14px; color: white; width: 230px; font-family: sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.9);">
          <div style="width: 100%; height: 100px; margin-bottom: 10px; border-radius: 12px; overflow: hidden; background: #04090d; display: flex; align-items: center; justify-content: center;">
            ${img ? `<img src="${img}" alt="${title}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : `<span style="font-size: 32px;">📦</span>`}
          </div>
          <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin-bottom: 3px;">${category} • ${distanceStr}</div>
          <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px; color: #ffffff;">${title}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Lender: <strong style="color: #ffffff;">${owner}</strong></div>
          <a href="/peek?tab=explore" style="display: block; width: 100%; text-align: center; background: linear-gradient(to right, #09414b, #083842); color: #ffffff; font-weight: 700; font-size: 11px; padding: 9px 0; border-radius: 9999px; text-decoration: none; border: 1px solid #1e293b;">
            Request to Borrow ⚡
          </a>
        </div>
      `;

      L.marker([lat, lng], { icon: markerIcon })
        .addTo(markersGroup)
        .bindPopup(popupContent, {
          closeButton: false,
          className: "mohalla-dark-popup"
        });
    });

    // Auto-fit bounds so all nearby items are framed on screen
    if (items.length > 0 && mapInstanceRef.current) {
      const validCoords = items
        .filter((it) => (it.latitude || it.lat) && (it.longitude || it.lng))
        .map((it) => [it.latitude || it.lat, it.longitude || it.lng]);
      if (validCoords.length > 0) {
        validCoords.push([centerLat, centerLng]);
        const bounds = L.latLngBounds(validCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-[#07080c] text-white flex flex-col font-sans relative overflow-hidden">
      {/* 1. TOP NAVBAR (Matching Panel Navbar Exactly) */}
      <header className="sticky top-0 z-40 bg-[#141418]/95 backdrop-blur-xl border-b border-neutral-800/80 px-4 sm:px-10 md:px-12 py-3.5 sm:py-4 flex items-center justify-between shrink-0 shadow-sm">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link
            to="/peek"
            search={{ tab: "explore", panel: "open" }}
            className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer"
          >
            <img
              src="/favicon.png"
              alt="Mohalla Store Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-teal-500/30 object-contain shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="text-base sm:text-xl font-bold tracking-tight text-[#f5e6c8] group-hover:text-white transition-colors">
              मोहल्ला स्टोर
            </span>
          </Link>
        </div>

        {/* Center Navbar Links (Redirecting directly to specific panel sections) */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium tracking-wide text-neutral-300">
          <Link
            to="/peek"
            search={{ tab: "explore", panel: "open" }}
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
          >
            Explore your Mohalla
          </Link>
          <Link
            to="/peek"
            search={{ tab: "stories", panel: "open" }}
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
          >
            Mohalla Stories
          </Link>
          <Link
            to="/peek"
            search={{ tab: "recommendations", panel: "open" }}
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
          >
            Recommendations
          </Link>
          <Link
            to="/peek"
            search={{ tab: "messages", panel: "open" }}
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
          >
            Messages
          </Link>
          <Link
            to="/peek"
            search={{ tab: "profile", panel: "open" }}
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
          >
            Profile
          </Link>
          <Link
            to="/radar"
            className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer font-semibold text-[#facc15] underline underline-offset-4 decoration-[#facc15]"
          >
            Mohalla Radar
          </Link>
        </nav>

        {/* Right Action CTA */}
        <div className="flex items-center gap-3">
          <Link
            to="/peek"
            search={{ tab: "lend", panel: "open" }}
            className="btn-peek-sm px-3 py-1.5 sm:px-5 sm:py-2 tracking-wider sm:tracking-[0.2em] text-[11px] sm:text-[0.7rem] cursor-pointer"
          >
            + LEND SOMETHING
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#141418]/98 backdrop-blur-2xl border-b border-neutral-800 p-4 flex flex-col gap-2 shadow-2xl">
            <Link
              to="/peek"
              search={{ tab: "explore", panel: "open" }}
              className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Explore your Mohalla
            </Link>
            <Link
              to="/peek"
              search={{ tab: "stories", panel: "open" }}
              className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Mohalla Stories
            </Link>
            <Link
              to="/peek"
              search={{ tab: "recommendations", panel: "open" }}
              className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Recommendations
            </Link>
            <Link
              to="/peek"
              search={{ tab: "messages", panel: "open" }}
              className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Messages
            </Link>
            <Link
              to="/peek"
              search={{ tab: "profile", panel: "open" }}
              className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            <Link
              to="/radar"
              className="text-left text-xs font-mono py-2 px-3 rounded-lg bg-[#09414b] text-teal-100 font-bold border border-[#0c5360] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Mohalla Radar
            </Link>
          </div>
        )}
      </header>

      {/* 2. FULL SCREEN INTERACTIVE MAP AREA */}
      <main className="relative flex-1 w-full h-full bg-[#07080c]">
        
        {/* MAP CANVAS */}
        <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#07080c]" />

        {/* Dark Atmosphere Vignette Overlay Layer */}
        <div className="absolute inset-0 z-5 pointer-events-none bg-gradient-to-b from-[#07080c]/50 via-transparent to-[#07080c]/80 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />

        {/* TOP FLOATING MAP CONTROLS & FILTER BAR */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-3xl bg-[#0d0f17]/95 backdrop-blur-2xl border border-neutral-800/90 rounded-full p-2 sm:p-2.5 shadow-2xl flex items-center justify-between gap-3">
          
          {/* Search Input inside Floating Filter */}
          <div className="relative flex-1 flex items-center ml-2 min-w-[80px]">
            <span className="text-neutral-400 mr-2 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Filter items on Mohalla map..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none font-sans tracking-wide"
            />
          </div>

          {/* Filter Pills with NO Cyan Outlines */}
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pr-1">
            {[
              { key: "all", label: "All Radius" },
              { key: "500m", label: "< 500m" },
              { key: "5km", label: "< 5km" },
              { key: "tools", label: "Tools" },
              { key: "electronics", label: "Gear" }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterRadius(f.key)}
                className={`text-[11px] font-mono px-3.5 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterRadius === f.key
                    ? "bg-[#083842] text-white font-bold border border-neutral-700/60 shadow-md"
                    : "bg-neutral-900/90 text-neutral-400 border border-neutral-800 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Zoom & GPS Recenter Controls */}
        <div className="absolute right-5 bottom-20 sm:bottom-24 z-30 flex flex-col gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleRecenterGPS}
            className="w-10 h-10 rounded-xl bg-[#0d0f17]/95 hover:bg-[#182030] border border-neutral-700/80 text-amber-400 hover:text-amber-300 font-bold text-base flex items-center justify-center shadow-2xl transition-all active:scale-95 cursor-pointer"
            title="Snap to My Exact Live Location"
            aria-label="Snap to My Exact Live Location"
          >
            ◎
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-10 h-10 rounded-xl bg-[#0d0f17]/95 hover:bg-[#182030] border border-neutral-700/80 text-white font-bold text-lg flex items-center justify-center shadow-2xl transition-all active:scale-95 cursor-pointer"
            title="Zoom In"
            aria-label="Zoom in on Mohalla map"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-10 h-10 rounded-xl bg-[#0d0f17]/95 hover:bg-[#182030] border border-neutral-700/80 text-white font-bold text-lg flex items-center justify-center shadow-2xl transition-all active:scale-95 cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom out on Mohalla map"
          >
            −
          </button>
        </div>

        {/* BOTTOM CONTROLS: LIVE STATUS BADGE + QUICK BACK LINK (NON-OVERLAPPING) */}
        <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pointer-events-none">
          {/* LIVE STATUS BADGE */}
          <div className="pointer-events-auto bg-[#0d0f17]/95 backdrop-blur-xl border border-neutral-800/90 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div>
              <span className="text-xs font-bold text-white block">Mohalla Live Geolocation Radar</span>
              <span className="text-[10px] font-mono text-neutral-400">
                {filteredItems.length > 0
                  ? `${filteredItems.length} nearby items pinned on Radar`
                  : "0 nearby items on Radar · neighborhood shelves empty"}
              </span>
            </div>
          </div>

          {/* QUICK BACK TO STORE LINK */}
          <Link
            to="/peek"
            search={{ tab: "explore" }}
            className="pointer-events-auto bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-mono px-4 py-2.5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>← Back to Vault Grid</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
