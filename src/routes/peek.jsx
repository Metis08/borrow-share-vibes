import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import MohallaRadar from "@/components/MohallaRadar";

export const Route = createFileRoute("/peek")({
  head: () => ({
    meta: [
      { title: "Mohalla Store — Around the Mohalla" },
      { name: "description", content: "Explore items your neighbours are sharing nearby." }
    ]
  }),
  component: PeekPage,
});

function PeekPage() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("mohalla_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Items and selections
  const [itemsFromRadar, setItemsFromRadar] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Authentication modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register" | "setup"
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Input states
  const [usernameValue, setUsernameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [shelfNameValue, setShelfNameValue] = useState("");

  // Carousel ref and scrolling functions
  const carouselRef = useRef(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -240, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 240, behavior: "smooth" });
    }
  };

  const handleAuthRequired = (reasonMessage) => {
    setAuthTriggerMsg(reasonMessage);
    setAuthMode("login");
    setShowAuthModal(true);
  };

  const handleBorrowSuccess = (itemName) => {
    alert(`Success! You have borrowed a "${itemName}". Checking your personal profile...`);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const u = usernameValue.trim();
    const p = passwordValue;
    if (!u || p.length < 3) {
      setErrorMsg("Username and password (min 3 characters) required.");
      return;
    }
    const endpoint = authMode === "login" ? "login" : "register";
    try {
      const res = await fetch(`http://localhost:8085/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (res.ok) {
        if (authMode === "login") {
          const data = await res.json();
          const userSession = { username: data.username, token: data.token };
          localStorage.setItem("mohalla_user", JSON.stringify(userSession));
          setCurrentUser(userSession);
          setShowAuthModal(false);
          setUsernameValue("");
          setPasswordValue("");
          setAuthTriggerMsg("");
        } else {
          setSuccessMsg("Shelf created! Please customize your profile below.");
          setAuthMode("setup");
          setPasswordValue("");
        }
      } else {
        const text = await res.text();
        setErrorMsg(text || "Authentication request failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Cannot establish connection to local Go server.");
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const phone = phoneValue.trim();
    const area = areaValue.trim();
    const shelfName = shelfNameValue.trim();
    if (!phone || !area || !shelfName) {
      setErrorMsg("All profile fields are required to activate your Mohalla shelf.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8085/api/setup_profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameValue.trim(),
          phone,
          area,
          shelfName,
        }),
      });
      if (res.ok) {
        const userSession = { username: usernameValue.trim(), token: usernameValue.trim() };
        localStorage.setItem("mohalla_user", JSON.stringify(userSession));
        setCurrentUser(userSession);
        setShowAuthModal(false);

        setUsernameValue("");
        setPasswordValue("");
        setPhoneValue("");
        setAreaValue("");
        setShelfNameValue("");
        setAuthTriggerMsg("");
        setErrorMsg("");
        setSuccessMsg("");
      } else {
        const text = await res.text();
        setErrorMsg(text || "Failed to setup profile details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Cannot establish connection to local Go server.");
    }
  };

  // Helper categories emoji matching (enriched title lookup supporting escaping icons)
  const getItemEmoji = (cat, name) => {
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("projector")) return "📽️";
    if (lowerName.includes("ladder")) return "🪜";
    if (lowerName.includes("camera")) return "📷";
    if (lowerName.includes("controller")) return "🎮";
    if (lowerName.includes("tent")) return "⛺";
    if (lowerName.includes("books")) return "📚";
    if (lowerName.includes("drill")) return "🔌";
    if (lowerName.includes("tripod")) return "🔭";
    if (lowerName.includes("game")) return "🎲";
    switch (cat) {
      case "Electronics": return "🔌";
      case "Tools": return "🪜";
      case "Books": return "📚";
      case "Home": return "🍚";
      case "Outdoor": return "⛺";
      case "Events": return "🔊";
      default: return "📦";
    }
  };

  const getItemImage = (cat, name) => {
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("projector")) return "/projector.png";
    if (lowerName.includes("ladder")) return "/ladder.png";
    if (lowerName.includes("camera")) return "/camera.png";
    if (lowerName.includes("controller")) return "/controller.png";
    if (lowerName.includes("tent")) return "/tent.png";
    if (lowerName.includes("book")) return "/books.png";
    return null;
  };

  const formatKm = (val) => {
    if (val === undefined || val === null) return "";
    return val < 1.0 ? `${Math.round(val * 1000)} m` : `${val.toFixed(1)} km`;
  };

  const fallbackItems = [
    { id: "fallback-tripod", itemName: "Tripod", category: "Electronics", distanceKm: 0.400, owner: "Lender 7" },
    { id: "fallback-proj", itemName: "Projector", category: "Electronics", distanceKm: 0.650, owner: "Lender 1" },
    { id: "fallback-lad", itemName: "Ladder", category: "Tools", distanceKm: 0.900, owner: "Lender 2" },
    { id: "fallback-cam", itemName: "Camera", category: "Electronics", distanceKm: 1.200, owner: "Lender 3" },
    { id: "fallback-cont", itemName: "Controller", category: "Electronics", distanceKm: 1.400, owner: "Lender 4" },
    { id: "fallback-tent", itemName: "Tent", category: "Outdoor", distanceKm: 1.600, owner: "Lender 5" },
    { id: "fallback-books", itemName: "Books", category: "Books", distanceKm: 1.800, owner: "Lender 6" },
    { id: "fallback-drill", itemName: "Drill", category: "Tools", distanceKm: 2.100, owner: "Lender 8" }
  ];

  // Merge database items and fallbacks uniquely by title
  const displayItems = itemsFromRadar.length > 0 
    ? itemsFromRadar.filter(item => !item.isDecorationOnly)
    : fallbackItems;

  return (
    <main className="min-h-screen bg-[#020b18] bg-gradient-to-b from-[#020b18] via-[#031326] to-[#010813] text-white flex flex-col justify-between select-none">
      
      {/* Immersive Header + Map Stack (Map starts at absolute Y=0 / top of screen) */}
      <div className="relative w-full h-[75vh] min-h-[500px]">
        {/* Map Canvas (Absolute inset to fill the container from Y=0) */}
        <div className="absolute inset-0 w-full h-full z-0">
          <MohallaRadar
            embedMode={true}
            currentUser={currentUser}
            onAuthRequired={handleAuthRequired}
            onBorrowSuccess={handleBorrowSuccess}
            onItemsUpdate={setItemsFromRadar}
            selectedItemFromParent={selectedItem}
          />
        </div>

        {/* Floating Editorial Header (Overlaying the Map at the top directly) */}
        <div className="absolute top-0 inset-x-0 z-10 pointer-events-none">
          <div className="max-w-7xl mx-auto pt-10 pb-16 px-6 md:px-8 flex items-start justify-between pointer-events-auto">
            <div className="flex flex-col">
              <h1 className="font-zeyada text-5xl sm:text-7xl lg:text-[76px] font-normal leading-none text-white tracking-wide select-text">
                Hi, {currentUser?.username || "Mahek09"}
              </h1>
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.35em] text-[#cfbda3] mt-2 block select-text">
                LET'S SEE WHAT THE <span className="text-yellow-400 font-bold">MOHALLA</span> HAS TO OFFER.
              </p>
            </div>
            <Link
              to="/"
              className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-[#cfbda3]/70 hover:text-white px-4 py-2 border border-white/10 hover:border-yellow-400 transition-colors w-fit block rounded-none bg-slate-900/60 backdrop-blur-sm"
            >
              ← Return to Mohalla
            </Link>
          </div>
        </div>
      </div>

      {/* Overlapping discovery container */}
      <div className="relative z-20 -mt-36 sm:-mt-40 md:-mt-44 w-full px-8 sm:px-16 pb-12 flex flex-col pointer-events-none">
        
        {/* Heading row */}
        <div className="mb-4 pointer-events-auto">
          <h2 className="font-hand text-3xl sm:text-4xl md:text-5xl text-white/90 select-text tracking-wide lowercase pt-4">
            a few things, just around the corner.
          </h2>
        </div>

        {/* Horizontal Carousel and navigation arrows */}
        <div className="relative pointer-events-auto flex items-center w-full gap-4">
          <button
            onClick={scrollLeft}
            className="hidden sm:flex w-9 h-9 rounded-full border border-teal-500/10 hover:border-yellow-400/40 bg-[#0f203b]/25 hover:bg-[#0f203b]/70 items-center justify-center transition-all cursor-pointer text-teal-400 hover:text-yellow-400 flex-shrink-0 z-30 shadow-lg backdrop-blur-md focus:outline-none"
            title="Scroll Left"
          >
            ←
          </button>
          
          {/* Scrollable track wrapper */}
          <div 
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto pb-8 pt-16 scrollbar-none w-full scroll-smooth select-text"
          >
            {displayItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group w-[200px] flex-shrink-0 text-left relative p-6 pt-24 pb-8 flex flex-col justify-between min-h-[240px] focus:outline-none cursor-pointer hover:-translate-y-2.5 transition-all duration-500 ease-out z-20"
              >
                {/* Visual Glassmorphic Plate background (Masked and blurred, sitting beneath the 3D image) */}
                <div className="absolute inset-0 dark-teal-glass-card pointer-events-none z-0 transition-shadow duration-500 group-hover:shadow-[0_0_30px_rgba(13,237,255,0.12)]" />

                {/* Soft Backplate Glow */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-cyan-500/10 blur-xl pointer-events-none z-10 group-hover:bg-cyan-400/15 transition-colors duration-500" />

                {/* 3D Floating render overlapping the top border boundary layer */}
                <div 
                  className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 transition-transform duration-500 ease-out group-hover:scale-115 group-hover:-translate-y-3 pointer-events-none select-none w-36 h-36 flex items-center justify-center filter drop-shadow-[0_14px_28px_rgba(0,0,0,0.85)]"
                  style={{ mixBlendMode: "screen" }}
                >
                  {getItemImage(item.category, item.itemName) ? (
                    <img 
                      src={getItemImage(item.category, item.itemName)} 
                      alt={item.itemName} 
                      className="w-full h-full object-contain filter brightness-[1.12]"
                      style={{ mixBlendMode: "screen" }}
                    />
                  ) : (
                    <span className="text-5xl sm:text-6xl block">{getItemEmoji(item.category, item.itemName)}</span>
                  )}
                </div>

                {/* Content layers */}
                <div className="relative z-10 flex flex-col justify-between h-full w-full">
                  <div>
                    <h3 className="font-display text-2xl sm:text-3xl text-white group-hover:text-yellow-400 transition-colors leading-tight font-normal line-clamp-1">
                      {item.itemName}
                    </h3>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-yellow-400/85 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5 fill-current text-yellow-400/60" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      {formatKm(item.distanceKm)} away
                    </span>
                    <span className="font-mono text-[11px] text-[#4fc3f7]/55 block">
                      available nearby
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={scrollRight}
            className="hidden sm:flex w-9 h-9 rounded-full border border-teal-500/10 hover:border-yellow-400/40 bg-[#0f203b]/25 hover:bg-[#0f203b]/70 items-center justify-center transition-all cursor-pointer text-teal-400 hover:text-yellow-400 flex-shrink-0 z-30 shadow-lg backdrop-blur-md focus:outline-none"
            title="Scroll Right"
          >
            →
          </button>
        </div>

        {/* Scroll indicator details */}
        <div className="flex justify-center items-center gap-2 text-white/40 text-[9px] uppercase tracking-[0.25em] font-mono mt-4 pointer-events-auto">
          <span className="animate-bounce">🖱️</span>
          <span>scroll to explore more</span>
        </div>

      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 animate-fade-in backdrop-blur-xs">
          <div className="relative w-full max-w-sm animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setUsernameValue("");
                setPasswordValue("");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="absolute -top-10 right-0 text-white hover:text-red-300 transition-colors text-xs font-mono tracking-widest z-50 cursor-pointer"
            >
              ✕ CLOSE
            </button>

            <div className="receipt-edge-top absolute -top-[12px] left-0 right-0" />

            <div className="receipt-card">
              {authMode === "login" ? (
                <>
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      MOHALLA STORE
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      lending terminal #03
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="mt-2 text-center text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                      {errorMsg}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="mt-4 space-y-4 font-mono">
                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          username
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="eg Mahek"
                        value={usernameValue}
                        onChange={(e) => setUsernameValue(e.target.value)}
                        className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                      />
                    </div>

                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          password
                        </span>
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        className="receipt-field"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black cursor-pointer"
                      >
                        Open Shelf →
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 text-center font-mono border-t border-dashed border-neutral-400 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg("");
                        setSuccessMsg("");
                        setAuthMode("register");
                      }}
                      className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline cursor-pointer"
                    >
                      New Neighbor? Create Profile
                    </button>
                  </div>
                </>
              ) : authMode === "register" ? (
                <>
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      NEW PROFILE
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      join the neighborhood
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="mt-2 text-center text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                      {errorMsg}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="mt-4 space-y-4 font-mono">
                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          username
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="eg Mahek"
                        value={usernameValue}
                        onChange={(e) => setUsernameValue(e.target.value)}
                        className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                      />
                    </div>

                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          password
                        </span>
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        className="receipt-field"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black cursor-pointer"
                      >
                        Register Details →
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 text-center font-mono border-t border-dashed border-neutral-400 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg("");
                        setSuccessMsg("");
                        setAuthMode("login");
                      }}
                      className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline cursor-pointer"
                    >
                      Already registered? Log In
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      CREATE SHELF
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      activate sharing library
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="mt-2 text-center text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                      {errorMsg}
                    </div>
                  )}
                  {successMsg && (
                    <div className="mt-2 text-center text-xs text-green-700 bg-green-50 border border-green-200 p-2 font-mono">
                      {successMsg}
                    </div>
                  )}

                  <form onSubmit={handleSetupSubmit} className="mt-4 space-y-4 font-mono">
                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          phone number
                        </span>
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="eg 9876543210"
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                      />
                    </div>

                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#27211a]">
                          location / area
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="eg Gali 4, Sector C"
                        value={areaValue}
                        onChange={(e) => setAreaValue(e.target.value)}
                        className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                      />
                    </div>

                    <div>
                      <div className="mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                          shelf title
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="eg Mahek's Tool Shed"
                        value={shelfNameValue}
                        onChange={(e) => setShelfNameValue(e.target.value)}
                        className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black cursor-pointer"
                      >
                        Activate Shelf →
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="receipt-edge-bottom absolute -bottom-[12px] left-0 right-0" />
          </div>
        </div>
      )}

    </main>
  );
}
