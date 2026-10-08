import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroAsset from "@/assets/mohalla-hero.png";
import TopAnnotations from "@/components/TopAnnotations";
import PanelHeader from "@/components/PanelHeader";
import BorrowerPanel from "@/components/BorrowerPanel";
import LenderPanel from "@/components/LenderPanel";
import BorrowedProfile from "@/components/BorrowedProfile";
import MohallaRadar from "@/components/MohallaRadar";
import AuthModal from "@/components/AuthModal";
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
import { backStack } from "@/lib/backStack";

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
    if (showAuthModal) {
      backStack.push("index_auth", () => {
        setShowAuthModal(false);
      });
    } else {
      if (backStack.has("index_auth")) {
        backStack.dismiss("index_auth");
      }
    }
  }, [showAuthModal]);

  useEffect(() => {
    const handleAuthChange = (e) => {
      setCurrentUser(e.detail || null);
    };

    const handleSessionExpired = () => {
      setCurrentUser(null);
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  // Auth modal managed via unified AuthModal component

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
                <button
                  type="button"
                  onClick={() => {
                    clearSession("logout");
                    setCurrentUser(null);
                    setActiveTab("content");
                    setPanelView("welcome");
                  }}
                  className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-red-400/80 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Logout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthTriggerMsg("");
                    setAuthMode("login");
                    setShowAuthModal(true);
                  }}
                  className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.28em] border border-panel-line px-4 py-1.5 hover:border-white transition-colors cursor-pointer"
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
                      <button
                        type="button"
                        onClick={() => {
                          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                          navigate({
                            to: "/peek",
                            search: {},
                          });
                        }}
                        className="btn-peek px-12 py-4 cursor-pointer"
                      >
                        TAKE A PEEK
                      </button>
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

      {/* Auth Modal overlay */}
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authMode}
        triggerMsg={authTriggerMsg}
        onClose={() => {
          if (backStack.has("index_auth")) {
            backStack.pop("index_auth", () => setShowAuthModal(false));
          } else {
            setShowAuthModal(false);
          }
        }}
        onSuccess={(user) => {
          setStoredUser(user);
          setCurrentUser(user);
          if (backStack.has("index_auth")) {
            backStack.dismiss("index_auth");
          }
          setShowAuthModal(false);
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          navigate({
            to: "/peek",
            search: {},
          });
        }}
      />
    </main>
  );
}
