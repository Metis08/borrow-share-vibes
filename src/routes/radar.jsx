import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/radar")({
  component: MohallaRadarPage,
});

const radarItems = [
  {
    id: "camera",
    title: "Leica M6 Rangefinder Camera",
    owner: "Dev Anand",
    distance: "120m away",
    distMeters: 120,
    category: "Electronics & Gear",
    lat: 28.5494,
    lng: 77.2090,
    status: "Available Now",
    code: "LCM-904",
    image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=600",
    desc: "35mm analog film camera in pristine condition with 50mm f/2 Summicron lens."
  },
  {
    id: "calc",
    title: "Casio FX-991CW Scientific Calculator",
    owner: "Riya Sharma",
    distance: "50m away",
    distMeters: 50,
    category: "Electronics & Gear",
    lat: 28.5498,
    lng: 77.2096,
    status: "Available Now",
    code: "CSC-102",
    image: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&q=80&w=600",
    desc: "ClassWiz scientific calculator, essential for engineering exams & calculations."
  },
  {
    id: "hammer",
    title: "Stanley 16oz Claw Hammer",
    owner: "Karan Johar",
    distance: "220m away",
    distMeters: 220,
    category: "Tools & Repair",
    lat: 28.5488,
    lng: 77.2082,
    status: "Available Now",
    code: "STH-441",
    image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&q=80&w=600",
    desc: "Heavy-duty steel claw hammer with ergonomic grip for household repairs."
  },
  {
    id: "racket",
    title: "Yonex Astrox Pro Tennis Racket",
    owner: "Ananya Panday",
    distance: "350m away",
    distMeters: 350,
    category: "Board Games & Recreation",
    lat: 28.5505,
    lng: 77.2105,
    status: "In Use (Free Sep 14)",
    code: "YTR-782",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=600",
    desc: "High-strung graphite tennis racket with dampener & carrying bag."
  },
  {
    id: "jenga",
    title: "Jenga Giant Hardwood Tower",
    owner: "Rahul Mehta",
    distance: "180m away",
    distMeters: 180,
    category: "Board Games & Recreation",
    lat: 28.5491,
    lng: 77.2101,
    status: "Available Now",
    code: "JGT-009",
    image: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&q=80&w=600",
    desc: "Precision crafted wooden block stacking game. Perfect for weekend block parties."
  },
  {
    id: "drill",
    title: "Bosch Professional Power Drill 18V",
    owner: "Vikram Malhotra",
    distance: "410m away",
    distMeters: 410,
    category: "Tools & Repair",
    lat: 28.5479,
    lng: 77.2075,
    status: "Available Now",
    code: "BPD-512",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=600",
    desc: "Cordless masonry impact drill with complete 30-piece drill bit set."
  },
  {
    id: "tent",
    title: "Coleman Sundome 4-Person Tent",
    owner: "Siddharth Rao",
    distance: "290m away",
    distMeters: 290,
    category: "Household Essentials",
    lat: 28.5512,
    lng: 77.2088,
    status: "Available Now",
    code: "CST-330",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=600",
    desc: "Weatherproof dome tent with ground sheet & quick setup poles."
  },
  {
    id: "keyboard",
    title: "Keychron K2 Mechanical Keyboard",
    owner: "Priya Kapoor",
    distance: "90m away",
    distMeters: 90,
    category: "Electronics & Gear",
    lat: 28.5496,
    lng: 77.2087,
    status: "Available Now",
    code: "KKB-881",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600",
    desc: "Wireless RGB mechanical keyboard with Gateron Brown switches."
  }
];

export function MohallaRadarPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const [filterRadius, setFilterRadius] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = radarItems.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterRadius === "100m") return item.distMeters <= 100;
    if (filterRadius === "250m") return item.distMeters <= 250;
    if (filterRadius === "tools") return item.category.includes("Tools");
    if (filterRadius === "electronics") return item.category.includes("Electronics");
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

      const centerLat = 28.5494;
      const centerLng = 77.2090;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      // Dark CartoDB / Mapbox Dark Matter vector tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Custom Dark Teal User Pin
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-9 h-9 rounded-full bg-[#083842] border-2 border-white/80 flex items-center justify-center text-white text-sm font-bold shadow-2xl animate-pulse">
              📍
            </div>
            <div class="absolute -top-7 bg-neutral-900 text-teal-100 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-neutral-800 whitespace-nowrap shadow-xl">
              You (Block E)
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([centerLat, centerLng], { icon: userIcon }).addTo(map);

      // Add Concentric Radar Rings
      L.circle([centerLat, centerLng], {
        radius: 100,
        color: "#083842",
        weight: 1,
        dashArray: "4, 6",
        fillColor: "#09414b",
        fillOpacity: 0.08
      }).addTo(map);

      L.circle([centerLat, centerLng], {
        radius: 250,
        color: "#083842",
        weight: 1,
        dashArray: "4, 8",
        fillColor: "#083842",
        fillOpacity: 0.04
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

  useEffect(() => {
    if (markersGroupRef.current) {
      const { L, markersGroup } = markersGroupRef.current;
      renderMarkers(filteredItems, L, markersGroup);
    }
  }, [filterRadius, searchQuery]);

  const renderMarkers = (items, L, markersGroup) => {
    markersGroup.clearLayers();
    items.forEach((item) => {
      const markerIcon = L.divIcon({
        className: "custom-item-marker",
        html: `
          <div class="group relative cursor-pointer flex flex-col items-center">
            <div class="w-11 h-11 rounded-2xl bg-[#0d0f17] border border-neutral-800 shadow-2xl p-1 flex items-center justify-center transform transition-transform group-hover:scale-110">
              <img src="${item.image}" alt="${item.title}" class="w-full h-full object-contain rounded-xl" />
            </div>
            <div class="mt-1 bg-neutral-950/90 text-neutral-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-neutral-800 whitespace-nowrap shadow-md">
              ${item.title.split(' ')[0]} • ${item.distance}
            </div>
          </div>
        `,
        iconSize: [44, 60],
        iconAnchor: [22, 30],
      });

      const popupContent = `
        <div style="background-color: #0d0f17; border: 1px solid #1e293b; border-radius: 1.25rem; padding: 14px; color: white; width: 230px; font-family: sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.9);">
          <div style="width: 100%; height: 100px; margin-bottom: 10px; border-radius: 12px; overflow: hidden; background: #04090d; display: flex; align-items: center; justify-center: center;">
            <img src="${item.image}" alt="${item.title}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
          <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin-bottom: 3px;">${item.category} • ${item.distance}</div>
          <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px; color: #ffffff;">${item.title}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Lender: <strong style="color: #ffffff;">${item.owner}</strong></div>
          <a href="/peek?borrow=${item.id}" style="display: block; width: 100%; text-align: center; background: linear-gradient(to right, #09414b, #083842); color: #ffffff; font-weight: 700; font-size: 11px; padding: 9px 0; border-radius: 9999px; text-decoration: none; border: 1px solid #1e293b;">
            Request to Borrow ⚡
          </a>
        </div>
      `;

      L.marker([item.lat, item.lng], { icon: markerIcon })
        .addTo(markersGroup)
        .bindPopup(popupContent, {
          closeButton: false,
          className: "mohalla-dark-popup"
        });
    });
  };

  return (
    <div className="h-screen w-screen bg-[#07080c] text-white flex flex-col font-sans relative overflow-hidden">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-[#07080c]/90 backdrop-blur-2xl border-b border-neutral-800/80 px-6 py-4 flex items-center justify-between shrink-0">
        {/* Left Brand Logo in Hindi */}
        <div className="flex items-center gap-3">
          <Link to="/peek" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-full bg-[#083842] border border-neutral-800 flex items-center justify-center font-bold text-teal-100 text-xs shadow-md">
              म
            </span>
            <span className="font-extrabold text-base tracking-wide text-white group-hover:text-teal-200 transition-colors">
              मोहल्ला स्टोर
            </span>
          </Link>
        </div>

        {/* Center Navbar Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide text-neutral-300">
          <Link to="/peek" className="hover:text-white transition-colors">
            Explore your Mohalla
          </Link>
          <Link to="/peek" className="hover:text-white transition-colors">
            Mohalla Stories
          </Link>
          <Link to="/peek" className="hover:text-white transition-colors">
            Messages
          </Link>
          <Link to="/peek" className="hover:text-white transition-colors">
            Profile
          </Link>
          <Link
            to="/radar"
            className="text-teal-100 font-semibold bg-[#083842]/70 px-3.5 py-1.5 rounded-full border border-neutral-800 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>📡 Mohalla Radar</span>
          </Link>
        </nav>

        {/* Right Action CTA */}
        <div className="flex items-center gap-4">
          <Link
            to="/lend"
            className="bg-gradient-to-r from-[#09414b] via-[#083842] to-[#042028] hover:from-[#0c5360] hover:to-[#09414b] text-white font-semibold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 border border-neutral-800 shadow-md transition-all cursor-pointer"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Lend Something</span>
          </Link>
        </div>
      </header>

      {/* 2. FULL SCREEN INTERACTIVE MAP AREA */}
      <main className="relative flex-1 w-full h-full">
        
        {/* MAP CANVAS */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* TOP FLOATING MAP CONTROLS & FILTER BAR */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-3xl bg-[#0d0f17]/95 backdrop-blur-2xl border border-neutral-800/90 rounded-full p-2 sm:p-2.5 shadow-2xl flex items-center justify-between gap-3">
          
          {/* Search Input inside Floating Filter */}
          <div className="relative flex-1 flex items-center ml-2">
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
              { key: "100m", label: "< 100m" },
              { key: "250m", label: "< 250m" },
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

        {/* BOTTOM LEFT LIVE STATUS BADGE */}
        <div className="absolute bottom-6 left-6 z-30 bg-[#0d0f17]/95 backdrop-blur-xl border border-neutral-800/90 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <span className="text-xs font-bold text-white block">Mohalla Live Geolocation Radar</span>
            <span className="text-[10px] font-mono text-neutral-400">
              {filteredItems.length} nearby items pinned within 500m radius
            </span>
          </div>
        </div>

        {/* BOTTOM RIGHT QUICK BACK TO STORE LINK */}
        <Link
          to="/peek"
          className="absolute bottom-6 right-6 z-30 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-mono px-4 py-2.5 rounded-2xl transition-all shadow-xl flex items-center gap-2 cursor-pointer"
        >
          <span>← Back to Vault Grid</span>
        </Link>
      </main>
    </div>
  );
}
