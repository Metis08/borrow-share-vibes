import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroAsset from "@/assets/mohalla-hero.png";
import TopAnnotations from "@/components/TopAnnotations";
import PanelHeader from "@/components/PanelHeader";
import BorrowerPanel from "@/components/BorrowerPanel";
import LenderPanel from "@/components/LenderPanel";
import BorrowedProfile from "@/components/BorrowedProfile";
import MohallaRadar from "@/components/MohallaRadar";
import {
  getStoredUser,
  setStoredUser,
  clearSession,
  isTokenValid,
  AUTH_CHANGE_EVENT,
  SESSION_EXPIRED_EVENT,
  didSessionExpireOnStartup,
  resetSessionExpiredOnStartupFlag,
} from "@/lib/auth";
import { apiUrl } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "mohalla store" },
      {
        name: "description",
        content:
          "Mohalla Store is a neighbourhood lending shop: borrow what you need for a day, lend what's collecting dust.",
      },
      { property: "og:title", content: "Mohalla Store — Borrow it. Return it." },
      {
        property: "og:description",
        content: "Borrow it. Return it. Keep the mohalla moving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const span = window.innerHeight * 0.55;
      setP(Math.min(1, Math.max(0, window.scrollY / span)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return p;
}

function Index() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("borrower");
  const [panelView, setPanelView] = useState("welcome");
  const p = useScrollProgress();

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [activeTab, setActiveTab] = useState("content"); // "content" | "profile"
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");

  useEffect(() => {
    if (didSessionExpireOnStartup()) {
      resetSessionExpiredOnStartupFlag();
      setAuthTriggerMsg("Your session has expired. Please log in again.");
      setAuthMode("login");
      setShowAuthModal(true);
    }

    const handleAuthChange = (e) => {
      setCurrentUser(e.detail || null);
    };

    const handleSessionExpired = (e) => {
      setCurrentUser(null);
      setAuthTriggerMsg("Your session has expired. Please log in again.");
      setAuthMode("login");
      setShowAuthModal(true);
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  // Modal Inputs
  const [usernameValue, setUsernameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [shelfNameValue, setShelfNameValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [registeredToken, setRegisteredToken] = useState("");

  // Radar & Geolocation States
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [userCoords, setUserCoords] = useState(null); // { lat, lng }
  const [currentPage, setCurrentPage] = useState("store"); // "store" | "radar"

  // Sync location opt-in & coords from profile
  useEffect(() => {
    const fetchLocationStatus = async () => {
      if (!currentUser) {
        setLocationSharingEnabled(false);
        setUserCoords(null);
        return;
      }
      try {
        const res = await fetch(apiUrl("/api/profile"), {
          headers: {
            "Authorization": `Bearer ${currentUser.token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setLocationSharingEnabled(data.locationSharingEnabled || false);
          if (data.latitude && data.longitude) {
            setUserCoords({ lat: data.latitude, lng: data.longitude });
          } else {
            setUserCoords(null);
          }
        }
      } catch (err) {
        console.error("Error loading location details:", err);
      }
    };
    fetchLocationStatus();
  }, [currentUser]);

  const saveUserCoordinates = async (lat, lng) => {
    if (!currentUser) return;
    try {
      const res = await fetch(apiUrl("/api/user/location"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          locationSharingEnabled: true,
          latitude: lat,
          longitude: lng,
        }),
      });
      if (res.ok) {
        setLocationSharingEnabled(true);
        setUserCoords({ lat, lng });
      }
    } catch (err) {
      console.error("Error saving user location coordinates:", err);
    }
  };

  const requestLocationForRadar = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        saveUserCoordinates(lat, lng);
      },
      () => {
        alert("Location access denied by browser.");
      }
    );
  };

  const handleRadarClick = () => {
    setCurrentPage("radar");

    if (currentUser) {
      if (locationSharingEnabled) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              saveUserCoordinates(lat, lng);
            },
            () => {}
          );
        }
      } else {
        requestLocationForRadar();
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {}
        );
      }
    }
  };

  const handleAuthRequired = (reasonMessage) => {
    setAuthTriggerMsg(reasonMessage);
    setAuthMode("register");
    setShowAuthModal(true);
  };

  const handleBorrowSuccess = (itemName) => {
    alert(`Success! You have borrowed a "${itemName}". Checking your personal profile...`);
    setActiveTab("profile");
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
      const res = await fetch(apiUrl(`/api/${endpoint}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (res.ok) {
        if (authMode === "login") {
          const data = await res.json();
          const userSession = { username: data.username, token: data.token };
          setStoredUser(userSession);
          setCurrentUser(userSession);
          setShowAuthModal(false);
          setActiveTab("content");
          setPanelView("active");
          setUsernameValue("");
          setPasswordValue("");
          setAuthTriggerMsg("");
          navigate({ to: "/peek" });
        } else {
          const regData = await res.json();
          const userSession = { username: regData.username || u, token: regData.token || "" };
          setStoredUser(userSession);
          setCurrentUser(userSession);
          setShowAuthModal(false);
          setActiveTab("content");
          setPanelView("active");
          setUsernameValue("");
          setPasswordValue("");
          setAuthTriggerMsg("");
          navigate({ to: "/peek" });
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
      const headers = { "Content-Type": "application/json" };
      if (registeredToken) {
        headers["Authorization"] = `Bearer ${registeredToken}`;
      }
      const res = await fetch(apiUrl("/api/setup_profile"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: usernameValue.trim(),
          phone,
          area,
          shelfName,
        }),
      });
      if (res.ok) {
        // Log them in!
        const userSession = { username: usernameValue.trim(), token: registeredToken || usernameValue.trim() };
        setStoredUser(userSession);
        setCurrentUser(userSession);

        // Close auth modal and bring user inside to /peek
        setShowAuthModal(false);
        setActiveTab("content");
        setPanelView("active");

        // Clear values
        setUsernameValue("");
        setPasswordValue("");
        setPhoneValue("");
        setAreaValue("");
        setShelfNameValue("");
        setAuthTriggerMsg("");
        setErrorMsg("");
        setSuccessMsg("");
        navigate({ to: "/peek" });
      } else {
        const text = await res.text();
        setErrorMsg(text || "Failed to setup profile details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Cannot establish connection to local Go server.");
    }
  };

  if (currentPage === "radar") {
    return (
      <MohallaRadar
        currentUser={currentUser}
        onAuthRequired={handleAuthRequired}
        onBorrowSuccess={handleBorrowSuccess}
        initialLocationSharing={locationSharingEnabled}
        initialLat={userCoords?.lat}
        initialLng={userCoords?.lng}
        onBack={() => setCurrentPage("store")}
      />
    );
  }

  return (
    <main className="relative bg-[#060a12] text-white">
      <div className="relative">
        <div className="sticky top-0 h-screen overflow-hidden">
          <img
            src={heroAsset}
            alt="A lit-up neighbourhood store under a big tree on a rainy blue evening"
            className="h-full w-full object-cover"
          />
          <div className="hero-vignette" aria-hidden="true" />

          <TopAnnotations />

          <span className="ink-soft absolute bottom-28 sm:bottom-40 left-1/2 -translate-x-1/2 font-hand text-3xl sm:text-5xl whitespace-nowrap">
            the mohalla is awake
          </span>

          <p className="absolute inset-x-0 bottom-12 sm:bottom-20 text-center font-mono text-[10px] sm:text-[13px] md:text-[16px] font-light uppercase leading-relaxed tracking-[0.22em] sm:tracking-[0.42em] text-hero-tag px-4 max-w-md sm:max-w-none mx-auto">
            Borrow it. Return it. Keep the mohalla moving.
          </p>

          {/* Subtle mobile-only glassmorphic peek sheet */}
          <div
            onClick={() => {
              document.getElementById("panel")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="md:hidden absolute inset-x-0 bottom-0 z-30 h-7 glass-sheet rounded-t-[36px] border-t border-white/20 cursor-pointer shadow-[0_-10px_25px_rgba(0,0,0,0.6)]"
            style={{
              opacity: Math.max(0, 1 - p * 3),
              pointerEvents: p > 0.3 ? "none" : "auto",
            }}
            aria-hidden="true"
          >
            <div className="grain" aria-hidden="true" />
          </div>
        </div>

        <div className="h-[70vh]" aria-hidden="true" />

        <section
          id="panel"
          className="glass-sheet panel-stage relative z-30 min-h-screen"
          style={{
            transform: `translateY(${(1 - p) * 22}vh)`,
            opacity: p <= 0.02 ? 0 : Math.min(1, p * 1.6),
            pointerEvents: p <= 0.02 ? "none" : "auto",
          }}
        >
          <div className="grain" aria-hidden="true" />
          
          <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 sm:px-12 sm:pt-28">
            
            {/* Top Left corner of the glass panel: Padosi ID */}
            {currentUser && (
              <div className="absolute left-6 top-6 z-40 sm:left-12 sm:top-8">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-yellow-400">
                  PADOSI ID: <strong className="text-yellow-300 font-bold">{currentUser.username}</strong>
                </span>
              </div>
            )}

            {/* Top Right corner of the glass panel: Profile and session details */}
            <div className="absolute right-6 top-6 z-40 sm:right-12 sm:top-8">
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      clearSession("logout");
                      setCurrentUser(null);
                      setActiveTab("content");
                      setPanelView("welcome");
                    }}
                    className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-red-400/80 hover:text-red-300 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthTriggerMsg("");
                    setAuthMode("login");
                    setShowAuthModal(true);
                  }}
                  className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.28em] border border-panel-line px-4 py-1.5 hover:border-white transition-colors"
                >
                  Join / Sign In
                </button>
              )}
            </div>

            <PanelHeader />

            <div className="mt-1 sm:mt-2">
              {activeTab === "profile" ? (
                <BorrowedProfile 
                  currentUser={currentUser} 
                  onLocationUpdated={(enabled, lat, lng) => {
                    setLocationSharingEnabled(enabled);
                    if (enabled) {
                      setUserCoords({ lat, lng });
                    } else {
                      setUserCoords(null);
                    }
                  }} 
                />
              ) : panelView === "welcome" ? (
                <div className="text-center max-w-4xl mx-auto px-4 py-8">
                  {/* Headline */}
                  <h2 className="font-zeyada text-3xl sm:text-[44px] font-normal tracking-wide text-white mb-6 leading-[1.3]">
                    Jo chahiye, ho sakta hai bagal wale
                    <br />
                    ke paas ho.
                  </h2>
                  
                  {/* Description */}
                  <p className="font-mono text-sm sm:text-lg leading-relaxed text-panel-note max-w-2xl mx-auto mb-16 uppercase tracking-wider">
                    Mohalla Store connects people living in the same neighbourhood, so they can borrow things they need and lend things they already have — because not everything needs to be bought new.
                  </p>

                  {/* Take a Peek Button */}
                  <div className="flex justify-center items-center pointer-events-auto mb-6">
                    <Link
                      to="/peek"
                      className="btn-peek px-12 py-4"
                    >
                      TAKE A PEEK
                    </Link>
                  </div>
                </div>
              ) : mode === "borrower" ? (
                <div>
                  <button 
                    onClick={() => setPanelView("welcome")}
                    className="mb-8 font-mono text-[10px] text-panel-note hover:text-white transition-colors tracking-widest uppercase flex items-center gap-2 cursor-pointer pb-2 border-b border-white/5 w-fit"
                  >
                    ← back to welcome info
                  </button>
                  <BorrowerPanel
                    currentUser={currentUser}
                    onAuthRequired={handleAuthRequired}
                    onBorrowSuccess={handleBorrowSuccess}
                  />
                </div>
              ) : (
                <div>
                  <button 
                    onClick={() => setPanelView("welcome")}
                    className="mb-8 font-mono text-[10px] text-panel-note hover:text-white transition-colors tracking-widest uppercase flex items-center gap-2 cursor-pointer pb-2 border-b border-white/5 w-fit"
                  >
                    ← back to welcome info
                  </button>
                  <LenderPanel
                    currentUser={currentUser}
                    onAuthRequired={handleAuthRequired}
                  />
                </div>
              )}
            </div>

            <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-panel-line pt-8 font-mono text-[10px] font-light uppercase tracking-[0.32em] text-panel-note">
              <span>मोहल्ला स्टोर — since forever</span>
              <span>trust, mostly</span>
            </div>
          </div>
        </section>
      </div>

      {/* Brown Parchment Receipt Modal overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-fade-in">
          <div className="relative w-full max-w-sm animate-fade-in">
            
            {/* The Close Button above the receipt */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setUsernameValue("");
                setPasswordValue("");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="absolute -top-10 right-0 text-white hover:text-red-300 transition-colors text-xs font-mono tracking-widest z-50"
              aria-label="Close"
            >
              ✕ CLOSE
            </button>

            {/* Top Zigzag Edge */}
            <div className="receipt-edge-top absolute -top-[12px] left-0 right-0" />

            {/* Receipt Card */}
            <div className="receipt-card">
              {authMode === "login" ? (
                <>
                  {/* Header */}
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      MOHALLA STORE
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      lending terminal #03
                    </p>
                    <p className="text-[8px] text-neutral-500 mt-0.5">
                      date: 12 aug // time: active
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
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                          className="receipt-field pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-0 text-neutral-600 hover:text-neutral-900 transition-colors p-1 cursor-pointer focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                              <line x1="2" x2="22" y1="2" y2="22" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black"
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
                      className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline"
                    >
                      New user? Create a shelf
                    </button>

                    {/* Receipt Barcode */}
                    <div className="flex justify-center items-center gap-[2px] opacity-75 mt-3">
                      <div className="w-[2px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[3px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[2px] h-6 bg-neutral-800" />
                      <div className="w-[4px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[2px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                    </div>
                  </div>
                </>
              ) : authMode === "register" ? (
                <>
                  {/* Header */}
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      JOIN MOHALLA
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      new shelf registry
                    </p>
                    <p className="text-[8px] text-neutral-500 mt-0.5">
                      date: 12 aug // time: active
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
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                          className="receipt-field pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-0 text-neutral-600 hover:text-neutral-900 transition-colors p-1 cursor-pointer focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                              <line x1="2" x2="22" y1="2" y2="22" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black"
                      >
                        Create Shelf →
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
                      className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline"
                    >
                      Registered already? Switch to Sign In
                    </button>

                    {/* Receipt Barcode */}
                    <div className="flex justify-center items-center gap-[2px] opacity-75 mt-3">
                      <div className="w-[3px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[2px] h-6 bg-neutral-800" />
                      <div className="w-[1.5px] h-6 bg-neutral-800" />
                      <div className="w-[3px] h-6 bg-neutral-800" />
                      <div className="w-[4px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[2px] h-6 bg-neutral-800" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Header */}
                  <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                      MOHALLA PROFILE
                    </h3>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                      customize your active shelf
                    </p>
                    <p className="text-[8px] text-neutral-500 mt-0.5">
                      owner identity: {usernameValue}
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
                        className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black"
                      >
                        Activate Shelf →
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 text-center font-mono border-t border-dashed border-neutral-400 pt-3">
                    {/* Receipt Barcode */}
                    <div className="flex justify-center items-center gap-[2px] opacity-75 mt-1">
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[3px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[5px] h-6 bg-neutral-800" />
                      <div className="w-[2px] h-6 bg-neutral-800" />
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="w-[4px] h-6 bg-neutral-800" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Zigzag Edge */}
            <div className="receipt-edge-bottom absolute -bottom-[12px] left-0 right-0" />
          </div>
        </div>
      )}
    </main>
  );
}
