import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { LendPage } from "./lend";
import MohallaRecommendationsView from "@/components/MohallaRecommendationsView";
import MohallaStoriesView from "@/components/MohallaStoriesView";
import AuthModal from "@/components/AuthModal";
import EditProfileModal from "@/components/EditProfileModal";
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

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8085";

function resolveItemImage(item) {
  const raw = String(item?.imageUrl || item?.image_url || item?.image || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }
  if (raw.startsWith("/")) return `${API_BASE}${raw}`;
  return raw;
}

function ItemPhoto({ src, alt, className }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center text-neutral-500 ${className || ""}`}>
        <span className="text-2xl" aria-hidden>
          📷
        </span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} />;
}

export const Route = createFileRoute("/peek")({
  head: () => ({
    meta: [
      { title: "mohalla store" },
      {
        name: "description",
        content: "Clean editorial archival collage of community objects in Mohalla Store.",
      },
    ],
  }),
  component: RepositoryOfRemnantsPage,
});

function RepositoryOfRemnantsPage() {
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");
  const [authInitialMode, setAuthInitialMode] = useState("login");

  useEffect(() => {
    // If expired session was detected during initial startup, prompt user to login
    if (didSessionExpireOnStartup()) {
      resetSessionExpiredOnStartupFlag();
      setAuthTriggerMsg("Your session has expired. Please log in again.");
      setAuthInitialMode("login");
      setShowAuthModal(true);
    }

    const handleAuthChange = (e) => {
      setCurrentUser(e.detail || null);
    };

    const handleSessionExpired = (e) => {
      setCurrentUser(null);
      setProfileData(null);
      setAuthTriggerMsg("Your session has expired. Please log in again.");
      setAuthInitialMode("login");
      setShowAuthModal(true);
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const [activeItem, setActiveItem] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeNavTab, setActiveNavTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t && ["explore", "stories", "recommendations", "messages", "profile", "lend"].includes(t)) {
        return t;
      }
    }
    return "explore";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab") || (location?.search && location.search.tab);
      if (t && ["explore", "stories", "recommendations", "messages", "profile", "lend"].includes(t)) {
        setActiveNavTab(t);
        if (t !== "explore") {
          setTimeout(() => {
            document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
          }, 150);
        }
      }
    }
  }, [location?.search, location?.searchStr, location?.href]);

  const [showFlyer, setShowFlyer] = useState(false);
  const [dbItems, setDbItems] = useState({});

  useEffect(() => {
    const fetchDbItems = async () => {
      try {
        const res = await fetch("http://localhost:8085/api/items");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped = {};
            data.forEach((item) => {
              const key = `lent_${item.id}`;
              const title = item.itemName || item.item_name || "Mohalla Item";
              const owner = item.lenderName || item.username || "Padosi";
              const category = item.category || "Other";
              const area = item.area || "Nearby";
              const image = resolveItemImage(item);
              mapped[key] = {
                id: `LEND-${item.id}`,
                realId: item.id,
                title: title,
                code: `LEND-${item.id}`,
                owner: owner,
                rawUsername: item.username || owner,
                distance: area,
                category: category,
                status: item.status ? (item.status === "active" ? "Available Now" : item.status) : "Available Now",
                desc: item.description || "Listed in Mohalla Store.",
                phone: item.phone || "",
                duration: item.duration || "7 Days",
                condition: item.condition || "Good Working 👍",
                image: image,
              };
            });
            setDbItems(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to fetch DB items:", err);
      }
    };
    fetchDbItems();
  }, [activeNavTab]);

  useEffect(() => {
    const keys = Object.keys(dbItems);
    if (keys.length > 0) {
      if (!activeItem || !dbItems[activeItem]) {
        setActiveItem(keys[0]);
      }
    } else {
      setActiveItem(null);
    }
  }, [dbItems, activeItem]);

  useEffect(() => {
    try {
      const hasSeenFlyer = localStorage.getItem("mohalla_flyer_seen");
      if (!hasSeenFlyer) {
        const timer = setTimeout(() => {
          setShowFlyer(true);
          try {
            localStorage.setItem("mohalla_flyer_seen", "true");
          } catch {}
        }, 5000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== "undefined" && window.location.hash === "#terms") {
        setShowFlyer(true);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleDismissFlyer = () => {
    setShowFlyer(false);
    try {
      localStorage.setItem("mohalla_flyer_seen", "true");
    } catch {}
  };

  // Borrowing Form State inside Glass Panel
  const [borrowingItemKey, setBorrowingItemKey] = useState(null);
  const [selectedBorrowDates, setSelectedBorrowDates] = useState([8, 9, 10]);
  const [borrowRequestSent, setBorrowRequestSent] = useState(false);
  const [borrowError, setBorrowError] = useState("");
  const [isSendingBorrowRequest, setIsSendingBorrowRequest] = useState(false);

  // Authentication & Profile Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real Profile State
  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Real Chat & Messages State
  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState("");

  const fetchProfile = async () => {
    if (!currentUser?.token) {
      console.log("[DEBUG PROFILE] No currentUser.token, resetting profileData to null");
      setProfileData(null);
      return;
    }
    setIsLoadingProfile(true);
    try {
      console.log("[DEBUG PROFILE] Calling /api/profile with token prefix:", currentUser.token.slice(0, 15));
      const res = await fetch("http://localhost:8085/api/profile", {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      console.log("[DEBUG PROFILE] /api/profile response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[DEBUG PROFILE] /api/profile data received! listings count:", data.listings?.length, "lent count:", data.lent?.length);
        setProfileData(data);
      } else {
        const errText = await res.text();
        console.error("[DEBUG PROFILE] /api/profile error:", res.status, errText);
      }
    } catch (err) {
      console.error("[DEBUG PROFILE] Failed to fetch profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchConversations = async () => {
    if (!currentUser?.token) {
      setConversations([]);
      return;
    }
    setIsLoadingConversations(true);
    try {
      const res = await fetch("http://localhost:8085/api/conversations", {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchMessages = async (convId) => {
    if (!currentUser?.token || !convId) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`http://localhost:8085/api/conversations/messages?conversationId=${convId}`, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Real Borrow Requests State
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [isLoadingBorrowRequests, setIsLoadingBorrowRequests] = useState(false);
  const [isProcessingRequestId, setIsProcessingRequestId] = useState(null);

  const fetchBorrowRequests = async () => {
    if (!currentUser?.token) {
      setBorrowRequests([]);
      return;
    }
    setIsLoadingBorrowRequests(true);
    try {
      const res = await fetch("http://localhost:8085/api/borrow-requests", {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBorrowRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch borrow requests:", err);
    } finally {
      setIsLoadingBorrowRequests(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    if (!currentUser?.token || !requestId) return;
    setIsProcessingRequestId(requestId);
    try {
      const res = await fetch("http://localhost:8085/api/borrow-requests/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        await Promise.all([fetchBorrowRequests(), fetchConversations()]);
      } else {
        const txt = await res.text();
        alert(txt || "Failed to accept borrow request.");
      }
    } catch (err) {
      console.error("Error accepting borrow request:", err);
      alert("Network error accepting borrow request.");
    } finally {
      setIsProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!currentUser?.token || !requestId) return;
    setIsProcessingRequestId(requestId);
    try {
      const res = await fetch("http://localhost:8085/api/borrow-requests/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        await fetchBorrowRequests();
      } else {
        const txt = await res.text();
        alert(txt || "Failed to decline borrow request.");
      }
    } catch (err) {
      console.error("Error declining borrow request:", err);
      alert("Network error declining borrow request.");
    } finally {
      setIsProcessingRequestId(null);
    }
  };

  useEffect(() => {
    if (activeNavTab === "messages") {
      fetchConversations();
      fetchBorrowRequests();
    } else if (activeNavTab === "profile") {
      fetchProfile();
      fetchBorrowRequests();
    }
  }, [activeNavTab, currentUser?.token]);

  useEffect(() => {
    if (!activeChatId || !currentUser?.token) {
      setMessages([]);
      return;
    }
    fetchMessages(activeChatId);

    let ws = null;
    try {
      const wsUrl = `ws://localhost:8085/api/conversations/ws?token=${encodeURIComponent(currentUser.token)}&conversationId=${activeChatId}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.conversationId === activeChatId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            fetchConversations();
          }
        } catch (e) {
          console.error("Failed to parse ws message:", e);
        }
      };
    } catch (err) {
      console.error("WebSocket connection error:", err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [activeChatId, currentUser?.token]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !activeChatId || !currentUser?.token || isSendingMessage) return;
    const content = chatInput.trim();
    setChatInput("");
    setIsSendingMessage(true);
    setChatError("");

    try {
      const res = await fetch("http://localhost:8085/api/conversations/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          conversationId: activeChatId,
          content: content,
        }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        fetchConversations();
      } else {
        const errText = await res.text();
        setChatError(errText || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setChatError("Network error while sending message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendBorrowRequest = async () => {
    if (!currentUser?.token || !isTokenValid(currentUser.token)) {
      clearSession("expired");
      setAuthTriggerMsg("Sign in to send a borrow request.");
      setAuthInitialMode("login");
      setShowAuthModal(true);
      return;
    }
    const item = dbItems[borrowingItemKey];
    if (!item) return;

    setIsSendingBorrowRequest(true);
    setBorrowError("");

    try {
      const res = await fetch("http://localhost:8085/api/borrow-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          itemId: String(item.realId || item.id || borrowingItemKey),
          itemName: item.title,
          lender: item.rawUsername || item.owner,
          note: `Requesting to borrow for dates: Sep ${selectedBorrowDates.join(", ")}`,
        }),
      });

      if (res.ok) {
        setBorrowRequestSent(true);
        setBorrowError("");
        fetchBorrowRequests();
      } else {
        const errMsg = await res.text();
        if (res.status === 401 || errMsg.includes("Unauthorized") || errMsg.includes("expired")) {
          clearSession("expired");
          setBorrowError("");
          setAuthTriggerMsg("Your session has expired. Please log in again.");
          setAuthInitialMode("login");
          setShowAuthModal(true);
          return;
        }
        setBorrowError(errMsg || "Failed to send borrow request.");
      }
    } catch (err) {
      console.error("Error sending borrow request:", err);
      setBorrowError("Network error sending borrow request. Please try again.");
    } finally {
      setIsSendingBorrowRequest(false);
    }
  };

  // Track window scroll to slide up glassmorphed panel
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const itemDetails = dbItems;

  const selectItemByKeyword = (keyword) => {
    const keys = Object.keys(itemDetails);
    const found = keys.find((k) => {
      const it = itemDetails[k];
      return (
        k.toLowerCase().includes(keyword.toLowerCase()) ||
        (it.title && it.title.toLowerCase().includes(keyword.toLowerCase())) ||
        (it.category && it.category.toLowerCase().includes(keyword.toLowerCase()))
      );
    });
    if (found) {
      setActiveItem(found);
    } else if (keys.length > 0) {
      setActiveItem(keys[0]);
    }
    document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
  };

  const categories = ["All", "Electronics & Gear", "Tools & Repair", "Books & Games", "Household", "Other"];

  const filteredItems = Object.entries(itemDetails).filter(([_, item]) => {
    const itemCat = (item.category || "").toLowerCase();
    const activeCat = activeCategory.toLowerCase();
    const matchesCategory =
      activeCategory === "All" ||
      itemCat === activeCat ||
      itemCat.includes(activeCat) ||
      activeCat.includes(itemCat);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.owner && item.owner.toLowerCase().includes(q)) ||
      (item.desc && item.desc.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.distance && item.distance.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const showPanel = isScrolled || panelOpen;

  return (
    <main className="w-full bg-[#121212] text-[#e0e0e0] font-sans antialiased selection:bg-[#ffff00] selection:text-black relative">
      
      {/* STICKY BACKGROUND HERO FRAME */}
      <div className="sticky top-0 z-10 h-screen w-full flex flex-col justify-between overflow-hidden bg-[#121212] pb-2">
        
        {/* 1. TOP NAVIGATION BAR */}
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-4 flex items-center justify-between border-b border-neutral-800/60 relative z-10">
          {/* Left Brand Title in Hindi */}
          <Link
            to="/peek"
            search={{ tab: "explore" }}
            onClick={() => setActiveNavTab("explore")}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <img
              src="/favicon.png"
              alt="Mohalla Store Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-teal-500/30 object-contain shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#f5e6c8] group-hover:text-white transition-colors">
              मोहल्ला स्टोर
            </span>
          </Link>

          {/* Center Navigation Options (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium tracking-wide text-neutral-300">
            <button
              onClick={() => {
                setActiveNavTab("explore");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "explore" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Explore your Mohalla
            </button>
            <button
              onClick={() => {
                setActiveNavTab("stories");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "stories" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Mohalla Stories
            </button>
            <button
              onClick={() => {
                setActiveNavTab("recommendations");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "recommendations" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Recommendations
            </button>
            <button
              onClick={() => {
                setActiveNavTab("messages");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "messages" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => {
                setActiveNavTab("profile");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "profile" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Profile
            </button>
            <Link
              to="/radar"
              className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
            >
              Mohalla Radar
            </Link>
          </nav>

          {/* Right CTA Button: + Lend Something + Mobile Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group/lend">
              <button
                type="button"
                onClick={() => {
                  setActiveNavTab("lend");
                  setPanelOpen(true);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="btn-peek-sm cursor-pointer"
              >
                + LEND SOMETHING
              </button>
              
              {/* Hanging Nimbu Mirchi Totem */}
              <div className="absolute top-full -right-2 sm:-right-3 -mt-[2px] pointer-events-none z-30 flex flex-col items-end">
                <img
                  src="/nimbu-mirchi.png"
                  alt="Nimbu Mirchi Nazar Battu"
                  className="w-24 sm:w-32 md:w-40 lg:w-48 h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)] animate-nimbu-sway origin-top"
                />
              </div>
            </div>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-xs shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>

          {/* Mobile Navigation Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#141418]/98 backdrop-blur-2xl border-b border-neutral-800 p-4 flex flex-col gap-2 shadow-2xl">
              <button
                onClick={() => {
                  setActiveNavTab("explore");
                  setMobileMenuOpen(false);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left text-xs font-mono py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeNavTab === "explore" ? "bg-[#facc15]/10 text-[#facc15] font-bold" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                Explore your Mohalla
              </button>
              <button
                onClick={() => {
                  setActiveNavTab("stories");
                  setMobileMenuOpen(false);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left text-xs font-mono py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeNavTab === "stories" ? "bg-[#facc15]/10 text-[#facc15] font-bold" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                Mohalla Stories
              </button>
              <button
                onClick={() => {
                  setActiveNavTab("recommendations");
                  setMobileMenuOpen(false);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left text-xs font-mono py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeNavTab === "recommendations" ? "bg-[#facc15]/10 text-[#facc15] font-bold" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                Recommendations
              </button>
              <button
                onClick={() => {
                  setActiveNavTab("messages");
                  setMobileMenuOpen(false);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left text-xs font-mono py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeNavTab === "messages" ? "bg-[#facc15]/10 text-[#facc15] font-bold" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                Messages
              </button>
              <button
                onClick={() => {
                  setActiveNavTab("profile");
                  setMobileMenuOpen(false);
                  document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left text-xs font-mono py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeNavTab === "profile" ? "bg-[#facc15]/10 text-[#facc15] font-bold" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                Profile
              </button>
              <Link
                to="/radar"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left text-xs font-mono py-2 px-3 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Mohalla Radar ↗
              </Link>
            </div>
          )}
        </header>

        {/* 2. HERO ARCHIVAL HEADER */}
        <section className="w-full max-w-7xl mx-auto px-6 pt-4 pb-2">
          {/* Top Tagline / Breadcrumb Row */}
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-2">
            <div className="flex items-center gap-2 tracking-wider">
              <span>BORROW</span>
              <span>/</span>
              <span>LEND</span>
              <span>/</span>
              <span>CONNECT</span>
              <span>/</span>
              <span className="text-neutral-300 font-semibold">REPEAT</span>
            </div>
          </div>

          {/* Main Serif Display Title */}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl text-[#f5f5f5] tracking-tight font-normal mb-4"
            style={{ fontFamily: "'Playfair Display', 'Cormorant Garamond', serif" }}
          >
            Welcome to the Mohalla Store.
          </h1>

          {/* Two-Column Archival Description Paragraphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-xs text-neutral-400 leading-relaxed font-sans max-w-5xl">
            <div>
              <span className="block font-mono text-[11px] tracking-wider text-neutral-500 uppercase mb-2">
                01 — ABOUT THE MOHALLA
              </span>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                A collection of things, people and little stories from just around the corner. Look around. Something might be waiting for you.
              </p>
            </div>
            <div>
              <span className="block font-mono text-[11px] tracking-wider text-neutral-500 uppercase mb-2">
                02 — HOW IT WORKS
              </span>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Find something you need. Borrow it from someone nearby. Return it when you're done. Maybe lend something of your own.
              </p>
            </div>
          </div>
        </section>

        {/* 3. MAIN CENTRED SHOWCASE COLLAGE */}
        <section className="relative flex-1 w-full max-w-[1350px] mx-auto px-2 sm:px-6 my-2 flex items-center justify-center">

          {/* COLLAGE CONTAINER */}
          <div className="relative w-full max-w-[1200px] h-[520px] sm:h-[580px] flex items-center justify-center">

            {/* SOFT & SUBTLE BLUISH TEAL GLOW BEHIND THE RADIO SHOWCASE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[220px] bg-gradient-to-r from-[#00b4d8]/20 via-[#0d9488]/25 to-[#06b6d4]/20 blur-3xl rounded-full pointer-events-none z-10 opacity-50" />

            {/* LEFT ARCHIVAL PAPERWORK STACK */}
            <div className="absolute left-[6%] sm:left-[10%] top-[6%] z-10 pointer-events-none select-none">
              
              {/* 14 DAY USE Library Slip (Blue Card) */}
              <div className="bg-[#b3d7ec] text-[#1a3547] w-[220px] sm:w-[270px] h-[290px] p-4.5 rounded-sm shadow-xl transform -rotate-6 border border-[#96c1da] flex flex-col justify-between font-mono text-xs">
                <div>
                  <div className="font-bold text-center border-b border-[#7fb3d1] pb-2 mb-3 text-sm tracking-wider">
                    14 DAY USE
                  </div>
                  <div className="text-[10px] text-[#2c4e63] mb-4 uppercase">
                    RETURN TO DESK FROM WHICH BORROWED
                    <br />
                    THE LIBRARY OF THE UNIVERSITY OF CALIFORNIA
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5">
                      <span>JUL 20 RECD</span>
                      <span className="font-bold">LIB-09</span>
                    </div>
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5">
                      <span>MAR 10 RECD</span>
                      <span className="font-bold">MOHALLA</span>
                    </div>
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5 text-blue-950 font-semibold">
                      <span>16 NOV RECD</span>
                      <span className="font-bold">STORE</span>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-right text-[#426a83]">
                  FORM 102-A
                </div>
              </div>

              {/* Manila Folder / Library Envelope */}
              <div className="absolute top-[80px] left-[-30px] bg-[#e4d6b6] text-[#332a1d] w-[210px] sm:w-[250px] h-[270px] p-4 rounded-sm shadow-2xl transform -rotate-12 border border-[#c8b792] flex flex-col justify-between font-mono">
                <div>
                  <div className="border-b border-[#b5a37d] pb-2 mb-2">
                    <span className="text-[9px] block uppercase text-[#61523c]">PHYSICAL SCIENCES LIBRARY</span>
                    <span className="text-[11px] font-bold block">Thomas Wilson</span>
                    <span className="text-[10px] text-[#705e45]">16 Nov 1962</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div>T2 01</div>
                    <div>AO</div>
                    <div>43</div>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-full border-2 border-[#8c2a2a] text-[#8c2a2a] flex items-center justify-center p-1 transform rotate-12 opacity-80 self-start">
                  <span className="text-[8px] font-bold text-center leading-none uppercase">
                    UNIVERSITY OF CALIFORNIA
                  </span>
                </div>
              </div>

              {/* Historical Yield Graph Paper Slip */}
              <div className="absolute top-[170px] left-[60px] bg-[#f0e6d2] text-black w-[190px] sm:w-[230px] h-[200px] p-3 rounded-sm shadow-lg transform rotate-3 border border-[#d6c7ab]">
                <div className="text-[9px] font-mono font-bold uppercase mb-1 border-b border-neutral-400 pb-1">
                  HISTORICAL YIELD DATA
                </div>
                <svg className="w-full h-32 text-neutral-700 stroke-current fill-none" viewBox="0 0 100 60">
                  <path d="M 5 50 L 20 40 L 35 45 L 50 20 L 65 30 L 80 10 L 95 15" strokeWidth="1.5" />
                  <line x1="5" y1="55" x2="95" y2="55" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="5" y1="5" x2="5" y2="55" strokeWidth="1" />
                </svg>
                <span className="text-[8px] font-mono text-neutral-600 block text-right">FIG. 209</span>
              </div>

            </div>

            {/* OBJECT 1: MADELINE BOOKS STACK (LEFT) */}
            <div
              onClick={() => selectItemByKeyword("book")}
              className="absolute left-[-6%] sm:left-[-4%] top-[-6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/books-stack.png"
                alt="Madeline Books Stack"
                className="w-[240px] sm:w-[320px] md:w-[400px] h-auto object-contain transform -rotate-12 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 2: PINK CASIO CALCULATOR (MID TOP LEFT) */}
            <div
              onClick={() => selectItemByKeyword("calculator")}
              className="absolute left-[16%] sm:left-[22%] top-[6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/casio-calculator.png"
                alt="Casio Calculator"
                className="w-[160px] sm:w-[210px] md:w-[250px] h-auto object-contain transform -rotate-[14deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 3: BADMINTON RACKET (TILTED 20 DEGREES TOWARDS LEFT FROM BOTTOM) */}
            <div
              onClick={() => selectItemByKeyword("racket")}
              className="absolute left-[6%] sm:left-[12%] top-[18%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/badminton-racket.png"
                alt="Badminton Racket"
                className="w-[260px] sm:w-[340px] md:w-[420px] h-auto object-contain transform -rotate-[20deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 4: STEEL CLAW HAMMER (MOVED LEFT BEHIND RADIO) */}
            <div
              onClick={() => selectItemByKeyword("hammer")}
              className="absolute right-[32%] sm:right-[38%] top-[8%] sm:top-[12%] z-[15] transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/hammer.png"
                alt="Claw Steel Hammer"
                className="w-[200px] sm:w-[280px] md:w-[340px] h-auto object-contain transform rotate-[25deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 5: CENTERPIECE VINTAGE ORANGE RADIO */}
            <div
              onClick={() => selectItemByKeyword("radio")}
              className="relative z-20 transition-transform duration-300 ease-out cursor-pointer flex items-center justify-center transform hover:scale-105 hover:z-50"
            >
              <img
                src="/vintage-radio.png"
                alt="Vintage Transistor Radio"
                className="w-[360px] sm:w-[460px] md:w-[520px] h-auto object-contain drop-shadow-[0_15px_25px_rgba(0,180,216,0.2)]"
              />
            </div>

            {/* OBJECT 6: JENGA BLOCK TOWER (TOP RIGHT CLOSER TO RADIO) */}
            <div
              onClick={() => selectItemByKeyword("jenga")}
              className="absolute right-[28%] sm:right-[32%] top-[-2%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/jenga.png"
                alt="Jenga Tower"
                className="w-[130px] sm:w-[170px] md:w-[210px] h-auto object-contain transform rotate-6 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 7: LEICA CAMERA (UPPER RIGHT) */}
            <div
              onClick={() => selectItemByKeyword("camera")}
              className="absolute right-[-10%] sm:right-[-6%] top-[-16%] sm:top-[-14%] z-40 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/leica-camera.png"
                alt="Leica M6 Camera"
                className="w-[380px] sm:w-[500px] md:w-[620px] h-auto object-contain transform rotate-12 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 8: ROLLED CAMPING SLEEPING BAG (LOWER RIGHT) */}
            <div
              onClick={() => selectItemByKeyword("sleeping")}
              className="absolute right-[-8%] sm:right-[-4%] bottom-[-10%] sm:bottom-[-6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50"
            >
              <img
                src="/sleeping-bag.png"
                alt="Rolled Camping Blanket"
                className="w-[420px] sm:w-[560px] md:w-[680px] h-auto object-contain transform -rotate-12 drop-shadow-2xl"
              />
            </div>

          </div>

          {/* BOTTOM SCROLL PROMPT BUTTON */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            <button
              onClick={() => {
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-[#1e1e24]/90 hover:bg-[#2a2a32] text-neutral-300 hover:text-white px-5 py-2 rounded-full text-xs font-mono border border-neutral-700/60 backdrop-blur-md shadow-xl flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span>Scroll down to explore Glassmorphic Vault</span>
              <svg
                className="w-3.5 h-3.5 animate-bounce"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

        </section>

      </div>

      {/* 4. OVERLAPPING GLASSMORPHIC PANEL SLIDING FROM BOTTOM ON SCROLL */}
      <section
        id="glass-vault-panel"
        className="relative z-20 w-full min-h-screen bg-[#141418] border-t border-neutral-700/60 rounded-t-[2.5rem] shadow-[0_-30px_100px_rgba(0,0,0,0.95)] p-4 sm:p-10 md:p-12 font-sans -mt-6"
      >
        {/* Screen-Wide Glassmorphic Container Backdrop */}
        <div className="w-full max-w-[1380px] mx-auto flex flex-col gap-6">
            {/* Top Glass Navbar Header inside Panel - STICKY AT TOP */}
            <div className="sticky top-0 z-40 bg-[#141418]/95 backdrop-blur-xl border-b border-neutral-800/80 pb-3 pt-2 flex flex-col -mx-4 sm:-mx-10 md:-mx-12 px-4 sm:px-10 md:px-12 -mt-4 sm:-mt-10 md:-mt-12 rounded-t-[2.5rem] gap-2">
              <div className="flex items-center justify-between w-full">
                {/* Brand Title */}
                <Link
                  to="/peek"
                  search={{ tab: "explore" }}
                  onClick={() => setActiveNavTab("explore")}
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

                {/* Navigation Options (Desktop) */}
                <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium tracking-wide text-neutral-300">
                  <button
                    onClick={() => setActiveNavTab("explore")}
                    className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                      activeNavTab === "explore" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                    }`}
                  >
                    Explore your Mohalla
                  </button>
                  <button
                    onClick={() => setActiveNavTab("stories")}
                    className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                      activeNavTab === "stories" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                    }`}
                  >
                    Mohalla Stories
                  </button>
                  <button
                    onClick={() => setActiveNavTab("recommendations")}
                    className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                      activeNavTab === "recommendations" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                    }`}
                  >
                    Recommendations
                  </button>
                  <button
                    onClick={() => setActiveNavTab("messages")}
                    className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                      activeNavTab === "messages" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                    }`}
                  >
                    Messages
                  </button>
                  <button
                    onClick={() => setActiveNavTab("profile")}
                    className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                      activeNavTab === "profile" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                    }`}
                  >
                    Profile
                  </button>
                  <Link
                    to="/radar"
                    className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
                  >
                    Mohalla Radar
                  </Link>
                </nav>

                {/* Right Actions: + Lend Something CTA & Close */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNavTab("lend");
                    }}
                    className="btn-peek-sm cursor-pointer"
                  >
                    + LEND SOMETHING
                  </button>

                  <button
                    onClick={() => setPanelOpen(false)}
                    className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-semibold shrink-0"
                    title="Close Panel"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Mobile Navigation Tab Strip (Visible on screens < 768px) */}
              <div className="flex md:hidden items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5">
                {[
                  { id: "explore", label: "Explore" },
                  { id: "stories", label: "Stories" },
                  { id: "recommendations", label: "Recommendations" },
                  { id: "messages", label: "Messages" },
                  { id: "profile", label: "Profile" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveNavTab(tab.id)}
                    className={`text-[11px] font-mono px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      activeNavTab === tab.id
                        ? "bg-[#09414b] text-teal-100 font-bold border border-[#0c5360] shadow-md"
                        : "bg-neutral-900/90 text-neutral-400 border border-neutral-800 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <Link
                  to="/radar"
                  className="text-[11px] font-mono px-3 py-1.5 rounded-full bg-neutral-900/90 text-neutral-400 border border-neutral-800 hover:text-white transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  Radar ↗
                </Link>
              </div>
            </div>

            {/* TAB CONTENT: LEND FORM, RECOMMENDATIONS, MOHALLA STORIES OR EXPLORE ITEMS */}
            {activeNavTab === "lend" ? (
              <div className="animate-fadeIn">
                <LendPage onBack={() => setActiveNavTab("explore")} />
              </div>
            ) : activeNavTab === "recommendations" ? (
              <div className="animate-fadeIn">
                <MohallaRecommendationsView
                  currentUser={currentUser}
                  onRequireAuth={(callback) => {
                    if (callback) callback();
                    return true;
                  }}
                />
              </div>
            ) : activeNavTab === "stories" ? (
              <div className="animate-fadeIn">
                <MohallaStoriesView
                  currentUser={currentUser}
                  onRequireAuth={(callback, msg) => {
                    if (!currentUser?.token) {
                      alert(msg || "Sign in to share your Mohalla Moment.");
                      return false;
                    }
                    if (callback) callback();
                    return true;
                  }}
                />
              </div>
            ) : activeNavTab === "messages" ? (
              /* MOHALLA MESSAGES & CHATTING HUB (CONNECTED TO REAL BACKEND CONVERSATIONS & WEBSOCKET) */
              <div className="flex flex-col gap-6 py-2 animate-fadeIn">
                {!currentUser?.token ? (
                  <div className="bg-[#222325] border border-[#333436] rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl">
                      🔒
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">Sign In for Messages</h3>
                      <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md mx-auto">
                        Connect directly with lenders and borrowers in your neighborhood. Sign in to view your conversations and exchange messages.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="btn-peek-sm mt-2"
                    >
                      SIGN IN / JOIN MOHALLA
                    </button>
                  </div>
                ) : activeChatId === null ? (
                  /* CARDS OVERVIEW VIEW */
                  <div className="flex flex-col gap-6">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                            DIRECT MOHALLA CONNECT & CHAT
                          </span>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
                          बात-चीत मोहल्ले की
                        </h2>
                      </div>
                      <p className="text-xs text-neutral-400 max-w-md leading-relaxed text-left sm:text-right">
                        Connect directly with lenders and borrowers nearby. Click any card to convert this panel into a direct 2-way chat!
                      </p>
                    </div>

                    {/* INCOMING BORROW REQUESTS SECTION (LENDER DECISION) */}
                    {(() => {
                      const incoming = borrowRequests.filter(
                        (r) =>
                          r.lenderUsername?.toLowerCase() === currentUser?.username?.toLowerCase() &&
                          r.status === "pending"
                      );
                      if (incoming.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              INCOMING BORROW REQUESTS ({incoming.length})
                            </span>
                            <span className="text-[11px] font-mono text-neutral-400">
                              Requires Your Decision
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incoming.map((req) => (
                              <div
                                key={req.id}
                                className="bg-[#222325] border border-amber-500/40 rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-lg hover:border-amber-500/60 transition-all"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider">
                                      Borrower: <span className="text-white font-semibold">@{req.borrowerUsername}</span>
                                    </span>
                                    <h4 className="text-xl font-bold text-white font-sans mt-0.5">
                                      {req.itemName}
                                    </h4>
                                    {req.note && (
                                      <p className="text-xs text-neutral-300 font-sans mt-2 italic bg-black/40 p-2.5 rounded-xl border border-white/5">
                                        "{req.note}"
                                      </p>
                                    )}
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono uppercase tracking-wider font-semibold">
                                    Pending
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptRequest(req.id)}
                                    disabled={isProcessingRequestId === req.id}
                                    className="flex-1 bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    {isProcessingRequestId === req.id ? "Processing..." : "✓ Accept & Start Chat"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectRequest(req.id)}
                                    disabled={isProcessingRequestId === req.id}
                                    className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-mono uppercase rounded-xl transition-all cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* OUTGOING BORROW REQUESTS SECTION (BORROWER STATUS) */}
                    {(() => {
                      const outgoing = borrowRequests.filter(
                        (r) =>
                          r.borrowerUsername?.toLowerCase() === currentUser?.username?.toLowerCase() &&
                          r.status === "pending"
                      );
                      if (outgoing.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                              YOUR OUTGOING REQUESTS ({outgoing.length})
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500">
                              Awaiting Lender Approval
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {outgoing.map((req) => (
                              <div
                                key={req.id}
                                className="bg-[#222325] border border-neutral-800 rounded-3xl p-5 flex flex-col justify-between gap-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider">
                                      Lender: <span className="text-white font-semibold">@{req.lenderUsername}</span>
                                    </span>
                                    <h4 className="text-xl font-bold text-white font-sans mt-0.5">
                                      {req.itemName}
                                    </h4>
                                    {req.note && (
                                      <p className="text-xs text-neutral-400 font-sans mt-2 italic bg-black/20 p-2.5 rounded-xl border border-white/5">
                                        "{req.note}"
                                      </p>
                                    )}
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-[10px] font-mono uppercase tracking-wider">
                                    Awaiting Approval
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  Requested on {req.createdAt || "recently"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* CONVERSATION CARDS GRID */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                          NEIGHBORHOOD CONVERSATIONS · CLICK ANY CARD TO START CHAT
                        </span>
                        <span className="text-xs text-neutral-500 font-mono hidden sm:block">
                          {conversations.length} Active Conversation{conversations.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {isLoadingConversations ? (
                        <div className="py-16 text-center text-xs font-mono text-neutral-400">
                          Loading conversations...
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="bg-[#222325] border border-[#333436] rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl">
                            💬
                          </div>
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-white">No Active Conversations</h3>
                            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md mx-auto">
                              You don't have any open conversations yet. When you request to borrow an item, or when a neighbor requests to borrow one of your listed items, your direct 2-way chat channel will appear here.
                            </p>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              type="button"
                              onClick={() => setActiveNavTab("explore")}
                              className="btn-peek-sm"
                            >
                              EXPLORE ITEMS TO BORROW
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveNavTab("lend")}
                              className="btn-peek-sm cursor-pointer"
                            >
                              + LEND AN ITEM
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
                          {conversations.map((conv, idx) => {
                            const palette = ["#f498b5", "#9dbb85", "#f5b72b", "#7bc4e2"];
                            const bgColor = palette[idx % palette.length];
                            const isLender = currentUser?.username === conv.lenderUsername;
                            const role = isLender ? "Borrower" : "Lender";

                            return (
                              <div
                                key={conv.id}
                                onClick={() => setActiveChatId(conv.id)}
                                className="bg-[#222325] border border-[#333436] hover:border-[#444548] rounded-[2.2rem] p-6 h-[370px] flex flex-col justify-between relative cursor-pointer transition-all duration-200 group overflow-hidden"
                              >
                                {/* Top Bar: Bold Name & 4-Line Burger Icon */}
                                <div className="flex items-center justify-between z-10">
                                  <div>
                                    <h3 className="text-2xl font-black tracking-tight text-white font-sans line-clamp-1">
                                      {conv.otherUser}
                                    </h3>
                                    <span className="text-[11px] font-mono text-neutral-400 block mt-0.5">
                                      {role} · {conv.itemName}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 w-6 bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
                                    <div className="h-[2px] bg-white rounded-full w-full" />
                                    <div className="h-[2px] bg-white rounded-full w-full" />
                                    <div className="h-[2px] bg-white rounded-full w-full" />
                                    <div className="h-[2px] bg-white rounded-full w-full" />
                                  </div>
                                </div>

                                {/* Center Initial Avatar */}
                                <div className="my-auto py-2 flex items-center justify-center relative z-10">
                                  <div
                                    style={{ backgroundColor: bgColor }}
                                    className="w-24 h-24 rounded-full flex items-center justify-center font-black text-black text-3xl shadow-xl border-4 border-black/20"
                                  >
                                    {(conv.otherUser || "M")[0].toUpperCase()}
                                  </div>
                                </div>

                                {/* Bottom Section: Last message preview & CTA */}
                                <div className="flex flex-col gap-2.5 z-10">
                                  <span className="text-xs text-neutral-300 font-sans line-clamp-2">
                                    {conv.lastMessage ? `"${conv.lastMessage}"` : "No messages yet. Tap to start chatting!"}
                                  </span>
                                  <div className="btn-peek-sm w-full flex items-center justify-between mt-1">
                                    <span>OPEN 2-WAY CHAT</span>
                                    <span>➔</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* DIRECT CHAT SCREEN */
                  (() => {
                    const activeConv = conversations.find((c) => c.id === activeChatId);
                    const partnerName = activeConv?.otherUser || "Neighbor";
                    const itemName = activeConv?.itemName || "Shared Item";

                    return (
                      <div className="bg-[#0c0d12]/90 border border-neutral-800 rounded-[2.5rem] p-4 sm:p-8 flex flex-col gap-5 sm:gap-6 shadow-2xl relative overflow-hidden animate-fadeIn">
                        {/* Navigation Top Bar: Back to Cards + Active Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
                          <div className="flex flex-wrap items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setActiveChatId(null)}
                              className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-mono text-xs px-4 py-2.5 rounded-full border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                            >
                              <span>←</span> Back to Conversations
                            </button>

                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-pink-500 flex items-center justify-center font-black text-black text-xl shadow-md shrink-0">
                                {(partnerName || "N")[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xl font-bold text-white">
                                    {partnerName}
                                  </h3>
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="text-xs text-emerald-400 font-mono">
                                    Connected
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                                  Borrowing: <span className="text-neutral-200 font-medium">{itemName}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Quick Switcher Tabs */}
                          {conversations.length > 1 && (
                            <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1.5 rounded-full border border-neutral-800 overflow-x-auto">
                              {conversations.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setActiveChatId(c.id)}
                                  className={`text-xs font-mono px-3.5 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                                    activeChatId === c.id
                                      ? "bg-[#09414b] text-white font-bold border border-[#0c5360] shadow-md"
                                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                                  }`}
                                >
                                  {c.otherUser}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Message Stream Area */}
                        <div className="flex flex-col gap-4 min-h-[340px] max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                          {isLoadingMessages ? (
                            <div className="py-12 text-center text-neutral-400 text-xs font-mono">
                              Loading message history...
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="py-12 text-center text-neutral-400 text-xs font-mono">
                              No messages in this conversation yet. Send a message to get in touch!
                            </div>
                          ) : (
                            messages.map((msg) => {
                              const isMe = msg.senderUsername === currentUser?.username;
                              const timeStr = msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "Just now";

                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} gap-1`}
                                >
                                  <div
                                    className={`max-w-md p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed break-words ${
                                      isMe
                                        ? "bg-[#09414b] text-white border border-[#0c5360] font-medium rounded-tr-none shadow-md"
                                        : "bg-neutral-800/90 text-neutral-100 rounded-tl-none border border-neutral-700/60"
                                    }`}
                                  >
                                    {msg.content}
                                  </div>
                                  <span className="text-[10px] font-mono text-neutral-500 px-1">
                                    {timeStr}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Quick Action Suggestion Chips */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800/80">
                          <button
                            type="button"
                            onClick={() => setChatInput("Is the item available for pick up today?")}
                            className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                          >
                            📍 Ask Pick-up Slot
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatInput("Thank you so much! Returning it safely by evening.")}
                            className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                          >
                            🤝 Confirm Return
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatInput("Can I extend the borrow by 1 more day?")}
                            className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                          >
                            ⌛ Request Extension
                          </button>
                        </div>

                        {/* Message Input Form */}
                        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                          {chatError && (
                            <div className="text-xs text-red-400 font-mono px-2">
                              ⚠️ {chatError}
                            </div>
                          )}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <input
                              type="text"
                              placeholder={`Message ${partnerName} about ${itemName}...`}
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans"
                            />
                            <button
                              type="submit"
                              disabled={isSendingMessage}
                              className="bg-gradient-to-r from-[#09414b] via-[#083842] to-[#042028] hover:from-[#0c5360] hover:to-[#09414b] text-teal-100 font-bold text-xs px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl border border-[#0c5360] transition-all shadow-lg cursor-pointer shrink-0 disabled:opacity-50"
                            >
                              {isSendingMessage ? "Sending..." : "Send ➔"}
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : activeNavTab === "profile" ? (
              /* MOHALLA MEMBER PROFILE VIEW WITH AUTHENTICATED USER DATA */
              <div className="flex flex-col gap-8 py-4 animate-fadeIn">
                {!currentUser?.token ? (
                  <div className="bg-[#222325] border border-[#333436] rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl">
                      👤
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">Sign In for Profile</h3>
                      <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md mx-auto">
                        Sign in to view your neighborhood profile, manage your active borrowed & lent items, and view your community identity.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="btn-peek-sm mt-2"
                    >
                      SIGN IN / JOIN MOHALLA
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Profile Title Header & User Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-neutral-800 pb-6">
                      <div className="flex items-center gap-4">
                        {/* User Avatar Circle */}
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-pink-500 p-1 shadow-xl shrink-0">
                          <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-white font-black text-2xl">
                            {(profileData?.fullName || profileData?.username || currentUser?.username || "M")[0].toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                              MOHALLA MEMBER PROFILE
                            </span>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
                            {profileData?.fullName || profileData?.username || currentUser?.username}
                          </h2>
                          <p className="text-xs text-neutral-400 font-mono mt-1">
                            {profileData?.area || "Neighborhood Resident"}
                            {profileData?.shelfName ? ` · ${profileData.shelfName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditProfileModal(true)}
                          className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-mono text-xs px-4 py-2.5 rounded-full border border-neutral-700 transition-colors cursor-pointer"
                        >
                          ✏️ Edit Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => clearSession("logout")}
                          className="bg-neutral-900 hover:bg-red-950/40 text-red-400 hover:text-red-300 font-mono text-xs px-4 py-2.5 rounded-full border border-red-900/40 transition-colors cursor-pointer"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>

                    {/* 1. ACTIVE LENDS & BORROWS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="bg-[#222325] border border-[#333436] rounded-3xl p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                            CURRENTLY BORROWED
                          </span>
                          <span className="text-xs text-neutral-500 font-mono">
                            {(profileData?.borrowed || []).length} Active
                          </span>
                        </div>
                        {profileData?.borrowed && profileData.borrowed.length > 0 ? (
                          profileData.borrowed.map((b) => (
                            <div key={b.id} className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-white">{b.itemName}</h4>
                                <p className="text-[11px] text-neutral-400 font-mono">Lender: {b.lender} · {b.daysLeft || "Active"}</p>
                              </div>
                              <span className="bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[11px] font-mono px-2.5 py-1 rounded-full">
                                Borrowed
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between">
                            <p className="text-xs text-neutral-400 font-mono">No active borrowed items currently.</p>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const activeLends = (profileData?.listings && profileData.listings.length > 0)
                          ? profileData.listings
                          : (profileData?.lent || []);
                        return (
                          <div className="bg-[#222325] border border-[#333436] rounded-3xl p-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                                MY ACTIVE LENDS
                              </span>
                              <span className="text-xs text-neutral-500 font-mono">
                                {activeLends.length} Active
                              </span>
                            </div>
                            {activeLends.length > 0 ? (
                              activeLends.map((item) => (
                                <div key={item.id} className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between">
                                  <div>
                                    <h4 className="text-sm font-bold text-white">{item.itemName}</h4>
                                    <p className="text-[11px] text-neutral-400 font-mono">{item.category || "Item"}</p>
                                  </div>
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono px-2.5 py-1 rounded-full">
                                    {item.status || "Available"}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between text-neutral-400 text-xs font-mono">
                                <span>No items lent yet. Lend an item to share!</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2. COMMUNITY TRUST IDENTITY SECTION */}
                    <div className="flex flex-col gap-3">
                      <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest font-medium px-1">
                        COMMUNITY TRUST IDENTITY
                      </span>

                      <div className="bg-[#222325] rounded-3xl p-6 sm:p-8 border border-[#333436] flex flex-col gap-6 text-white backdrop-blur-2xl relative overflow-hidden">
                        {/* Header Row: Shield Icon + Title & Member Badge */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M9 12l2 2 4-4" />
                              </svg>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                              Mohalla Community Identity
                            </h3>
                          </div>

                          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm shrink-0 backdrop-blur-md">
                            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>Community Member</span>
                          </div>
                        </div>

                        {/* Inner Stats Card Grid (3 Columns) */}
                        <div className="bg-[#191a1c] border border-[#2d2e30] rounded-2xl p-6 sm:p-7 grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-neutral-800/90 backdrop-blur-xl">
                          {/* Stat 1: Return Rate / History */}
                          <div className="flex flex-col items-center justify-center pt-2 md:pt-0">
                            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                              —
                            </span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span>On-Time Rate</span>
                            </div>
                          </div>

                          {/* Stat 2: Exchanges */}
                          <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
                            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                              {(profileData?.totalBorrowedCount || 0) + (profileData?.totalLentCount || 0)}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                              <span>Exchanges</span>
                            </div>
                          </div>

                          {/* Stat 3: Member Since */}
                          <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
                            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                              {(() => {
                                const rawCreated = profileData?.createdAt || currentUser?.createdAt;
                                if (!rawCreated) return "—";
                                if (typeof rawCreated === 'number') {
                                  const d = new Date(rawCreated > 1e11 ? rawCreated : rawCreated * 1000);
                                  return isNaN(d.getFullYear()) ? "—" : d.getFullYear();
                                }
                                if (typeof rawCreated === 'object' && (rawCreated.seconds || rawCreated._seconds)) {
                                  const secs = rawCreated.seconds || rawCreated._seconds;
                                  const d = new Date(secs * 1000);
                                  return isNaN(d.getFullYear()) ? "—" : d.getFullYear();
                                }
                                if (typeof rawCreated === 'string') {
                                  const match = rawCreated.match(/^(\d{4})/);
                                  if (match) return match[1];
                                  const d = new Date(rawCreated);
                                  if (!isNaN(d.getFullYear())) return d.getFullYear();
                                }
                                return "—";
                              })()}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                              <span>Member Since</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : borrowingItemKey && itemDetails[borrowingItemKey] ? (
              /* BORROWING FORM VIEW INSIDE THE GLASSMORPHED PANEL */
              <div className="flex flex-col gap-6 py-2 animate-fadeIn">
                {/* Top Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setBorrowingItemKey(null);
                        setBorrowRequestSent(false);
                      }}
                      className="btn-peek-sm"
                    >
                      ← BACK TO STORE ITEMS
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono text-[11px] text-neutral-400 uppercase tracking-widest">
                          DIRECT MOHALLA BORROWING
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#f5e6c8]">
                        Borrowing Request Form
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full w-fit">
                    <span>✓ 100% Free Neighborhood Sharing</span>
                  </div>
                </div>

                {borrowRequestSent ? (
                  /* SUCCESS STATE UPON SENDING BORROW REQUEST */
                  <div className="py-14 flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-4xl shadow-xl animate-bounce">
                      ✓
                    </div>
                    <h3 className="text-3xl font-bold text-white">Borrow Request Sent!</h3>
                    <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
                      Your request for <span className="text-teal-200 font-semibold">{itemDetails[borrowingItemKey].title}</span> has been sent to <span className="text-white font-semibold">{itemDetails[borrowingItemKey].owner}</span>. They will reply directly in your Messages tab!
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBorrowingItemKey(null);
                          setBorrowRequestSent(false);
                          setActiveNavTab("messages");
                        }}
                        className="btn-peek-sm"
                      >
                        GO TO MESSAGES →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBorrowingItemKey(null);
                          setBorrowRequestSent(false);
                        }}
                        className="btn-peek-sm"
                      >
                        KEEP BROWSING
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MAIN 2-COLUMN BORROWING FORM LAYOUT */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT COLUMN: ITEM IMAGE SPOTLIGHT */}
                    <div className="lg:col-span-5 flex flex-col gap-4 h-full">
                      <div className="bg-neutral-900/90 border border-neutral-800 rounded-[2.5rem] p-8 flex flex-col justify-between items-center relative overflow-hidden backdrop-blur-2xl shadow-2xl h-full min-h-[560px] lg:min-h-[620px]">
                        
                        {/* Top Bar inside Left Card */}
                        <div className="w-full flex items-center justify-between z-10">
                          <span className="font-mono text-xs text-teal-200 uppercase tracking-widest bg-[#09414b]/30 px-3 py-1 rounded-full border border-[#0c5360]/50">
                            {itemDetails[borrowingItemKey].code}
                          </span>
                          <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                            {itemDetails[borrowingItemKey].status}
                          </span>
                        </div>

                        {/* Center Image */}
                        <div className="my-auto py-8 flex items-center justify-center z-10 w-full">
                          <ItemPhoto
                            src={itemDetails[borrowingItemKey].image}
                            alt={itemDetails[borrowingItemKey].title}
                            className="max-h-80 sm:max-h-96 max-w-full object-contain filter drop-shadow-[0_25px_40px_rgba(0,0,0,0.95)] transform hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Bottom Info inside Left Card */}
                        <div className="w-full bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 flex items-center justify-between z-10">
                          <div>
                            <span className="text-xs text-neutral-400 font-mono block">Lender & Location</span>
                            <span className="text-sm font-bold text-white">{itemDetails[borrowingItemKey].owner}</span>
                          </div>
                          <span className="text-xs font-mono text-teal-200 bg-[#083842] px-3 py-1 rounded-full border border-[#09414b]">
                            {itemDetails[borrowingItemKey].distance}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: NAME, DESCRIPTION & INTERACTIVE DATE PICKER */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                      
                      {/* TOP SECTION: ITEM NAME & DESCRIPTION DETAILS */}
                      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-[2.5rem] p-6 sm:p-7 backdrop-blur-2xl flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider bg-neutral-800 px-3 py-1 rounded-full">
                            {itemDetails[borrowingItemKey].category}
                          </span>
                          <span className="text-[11px] font-mono text-teal-200 bg-[#09414b]/30 px-3 py-1 rounded-full border border-[#0c5360]/50">
                            Lender: {itemDetails[borrowingItemKey].owner}
                          </span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
                          {itemDetails[borrowingItemKey].title}
                        </h3>

                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                          {itemDetails[borrowingItemKey].desc}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800/80">
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            🤝 Verified Neighbor
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            ⚡ Instant Approval
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            🛡️ Zero Deposit Required
                          </span>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: INTERACTIVE DATE PICKER CARD */}
                      <div className="relative group">
                        {/* MAIN CARD CONTAINER WITH NOTCHED CUTOUT AT TOP-RIGHT */}
                        <div className="bg-[#121319] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-7 backdrop-blur-2xl flex flex-col gap-5 relative overflow-hidden shadow-2xl">
                          
                          {/* TOP-RIGHT NOTCHED CUTOUT WITH FLOATING (+) BUTTON */}
                          <div className="absolute top-0 right-0 z-20 flex items-center justify-center p-3 bg-[#16161c] rounded-bl-3xl border-b border-l border-neutral-800">
                            <button
                              type="button"
                              title="Add Custom Slot"
                              onClick={() => {
                                if (selectedBorrowDates.length < 5) {
                                  const nextDate = Math.max(...selectedBorrowDates, 5) + 1;
                                  setSelectedBorrowDates([...selectedBorrowDates, nextDate]);
                                }
                              }}
                              className="w-11 h-11 rounded-full bg-[#0c5360] hover:bg-[#09414b] text-teal-100 font-extrabold flex items-center justify-center transition-all cursor-pointer shadow-md text-xl border border-[#146b7a]"
                            >
                              +
                            </button>
                          </div>

                          {/* Header Row: Lender Avatar & Date Selection Subtitle */}
                          <div className="flex items-center gap-4 pr-16 z-10">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0a3038] via-[#09414b] to-[#042028] border border-[#0c5360] flex items-center justify-center font-bold text-teal-100 text-lg shadow-md shrink-0">
                              {itemDetails[borrowingItemKey].owner[0]}
                            </div>
                            <div>
                              <h4 className="text-base sm:text-lg font-bold text-white font-sans">
                                Select Borrowing Dates
                              </h4>
                              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
                                <span>📅 Sep {selectedBorrowDates[0] || 9} - Sep {selectedBorrowDates[selectedBorrowDates.length - 1] || 12}</span>
                                <span className="text-teal-200 font-semibold">({selectedBorrowDates.length} Days)</span>
                              </div>
                            </div>
                          </div>

                          {/* Day Labels Row */}
                          <div className="grid grid-cols-7 text-center font-mono text-xs text-neutral-400 pt-1 z-10">
                            <span>M</span>
                            <span>T</span>
                            <span>W</span>
                            <span>T</span>
                            <span>F</span>
                            <span className="col-span-2 text-neutral-300 font-semibold">Weekend</span>
                          </div>

                          {/* Interactive Date Circles Grid */}
                          <div className="grid grid-cols-7 gap-1 sm:gap-2.5 items-center justify-items-center z-10">
                            {/* Disabled/Past Date Circles */}
                            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full border border-dashed border-neutral-700/60 flex items-center justify-center text-neutral-600 text-[10px] sm:text-xs font-mono select-none">
                              •
                            </div>
                            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full border border-dashed border-neutral-700/60 flex items-center justify-center text-neutral-600 text-[10px] sm:text-xs font-mono select-none">
                              •
                            </div>

                            {/* Dates 1 to 12 */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((dayNum) => {
                              const isSelected = selectedBorrowDates.includes(dayNum);
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedBorrowDates.length > 1) {
                                        setSelectedBorrowDates(selectedBorrowDates.filter((d) => d !== dayNum));
                                      }
                                    } else {
                                      setSelectedBorrowDates([...selectedBorrowDates, dayNum].sort((a, b) => a - b));
                                    }
                                  }}
                                  className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-sans text-[10px] sm:text-xs transition-all cursor-pointer select-none ${
                                    isSelected
                                      ? "bg-gradient-to-r from-[#09414b] to-[#0c5360] text-teal-100 font-extrabold scale-105 border-2 border-[#146b7a] shadow-md"
                                      : dayNum >= 4 && dayNum <= 5
                                      ? "bg-neutral-800/90 text-neutral-300 font-semibold border border-neutral-700 hover:border-neutral-500"
                                      : "bg-neutral-900 text-white font-medium border border-neutral-800 hover:border-[#0c5360]"
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>

                          {/* Indicator Dots at bottom of calendar card */}
                          <div className="flex items-center justify-center gap-1.5 pt-1 z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0c5360]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                          </div>
                        </div>
                      </div>

                      {/* Real error message if any */}
                      {borrowError && (
                        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 font-mono">
                          ⚠️ {borrowError}
                        </div>
                      )}

                      {/* SEND BORROW REQUEST CTA BUTTON */}
                      <button
                        type="button"
                        onClick={handleSendBorrowRequest}
                        disabled={isSendingBorrowRequest}
                        className="btn-peek w-full disabled:opacity-50"
                      >
                        <span>
                          {isSendingBorrowRequest
                            ? "SENDING REQUEST..."
                            : `SEND BORROW REQUEST TO ${(itemDetails[borrowingItemKey]?.owner || "LENDER").toUpperCase()}`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* EXPLORE MOHALLA ITEMS VAULT (STANDARD VIEW) */
              <>
                {/* Selected Item Spotlight Banner */}
                {activeItem && itemDetails[activeItem] && (
                  <div className="bg-gradient-to-r from-neutral-800/60 via-neutral-900/50 to-neutral-800/60 border border-neutral-700/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-neutral-950/80 rounded-xl p-3 border border-neutral-800 flex items-center justify-center shrink-0">
                        <ItemPhoto
                          src={itemDetails[activeItem].image}
                          alt={itemDetails[activeItem].title}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-mono text-[10px] text-teal-200 bg-[#09414b]/40 px-2 py-0.5 rounded border border-[#0c5360]">
                            {itemDetails[activeItem].id}
                          </span>
                          <span className="text-xs text-neutral-400">{itemDetails[activeItem].owner} ({itemDetails[activeItem].distance})</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{itemDetails[activeItem].title}</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                          {itemDetails[activeItem].desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setBorrowingItemKey(activeItem)}
                        className="btn-peek-sm"
                      >
                        REQUEST TO BORROW
                      </button>
                    </div>
                  </div>
                )}

                {/* PROMINENT SEARCH BAR UNDER SPOTLIGHT BANNER */}
                <div className="w-full relative my-1">
                  <div className="relative flex items-center w-full bg-neutral-900/90 hover:bg-neutral-900/95 border border-neutral-700/70 focus-within:border-[#0c5360] rounded-2xl px-5 py-3.5 transition-all shadow-xl backdrop-blur-xl">
                    {/* Search Icon */}
                    <svg
                      className="w-5 h-5 text-teal-200 shrink-0 mr-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>

                    {/* Input with Meaningful Placeholder */}
                    <input
                      type="text"
                      placeholder="Search for something to borrow in your Mohalla (e.g. 'Leica camera', 'Casio', 'Riya', 'Tools')..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder-neutral-400 focus:outline-none font-sans tracking-wide"
                    />

                    {/* Clear / Shortcut Badge */}
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-md bg-neutral-800 shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : (
                      <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] font-mono text-neutral-400 bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-1 rounded-md">
                        <span>⌘K</span>
                        <span>or</span>
                        <span>Search</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter Tabs / Categories Below Search Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`text-xs font-mono px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                          activeCategory === cat
                            ? "bg-white text-black font-semibold shadow-md"
                            : "bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-mono text-neutral-400 shrink-0 hidden sm:block">
                    Showing {filteredItems.length} items nearby
                  </div>
                </div>

                {/* Grid of Neighborhood Remnants Cards (Screen Wide 4-column layout) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
                  {filteredItems.length === 0 ? (
                    <div className="col-span-full py-16 text-center flex flex-col items-center justify-center gap-4 bg-neutral-900/40 rounded-3xl border border-neutral-800">
                      <div className="w-16 h-16 rounded-full bg-neutral-800/80 flex items-center justify-center text-3xl">
                        📦
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">No items listed in your Mohalla yet</h4>
                        <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                          {Object.keys(itemDetails).length === 0
                            ? "Only real items recorded in the database appear here. Lend something to start sharing with your neighbors!"
                            : "No items match your active search or category filter."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNavTab("lend");
                          setPanelOpen(true);
                        }}
                        className="btn-peek-sm mt-2 cursor-pointer"
                      >
                        + LEND SOMETHING
                      </button>
                    </div>
                  ) : (
                    filteredItems.map(([key, item]) => (
                      <div
                        key={key}
                        onClick={() => setBorrowingItemKey(key)}
                        className={`group relative bg-neutral-900/50 hover:bg-neutral-800/60 border rounded-2xl p-5 flex flex-col justify-between transition-colors duration-200 cursor-pointer ${
                          activeItem === key
                            ? "border-[#0c5360] bg-[#09414b]/20"
                            : "border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {/* Status Badge */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-3">
                          <span className="text-neutral-500">{item.code}</span>
                          <span className="text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                            {item.status}
                          </span>
                        </div>

                        {/* Item Thumbnail */}
                        <div className="w-full h-36 flex items-center justify-center my-2 p-2">
                          <ItemPhoto
                            src={item.image}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain transform group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>

                        {/* Info */}
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-white group-hover:text-teal-200 transition-colors line-clamp-1">
                            {item.title}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-neutral-400 mt-1.5">
                            <span>{item.owner}</span>
                            <span className="font-mono text-neutral-500 text-[11px]">{item.distance}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* 5. FOOTER INSIDE GLASS PANEL */}
          <footer className="w-full max-w-[1380px] mx-auto pt-10 mt-12 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-mono gap-4 relative z-10">
            <div>
              <span>Mohalla Store © 1975 — 2026. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-neutral-400">
              <a href="#privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a
                href="#terms"
                onClick={(e) => {
                  e.preventDefault();
                  setShowFlyer(true);
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms of Borrowing
              </a>
              <Link to="/radar" className="text-white hover:underline">
                Back to Mohalla Radar →
              </Link>
            </div>
          </footer>
        </section>

        {/* 6. 5-SECOND FLYING AD FLYER OVERLAY (MOHALLA RULES) */}
        {showFlyer && (
          <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-all duration-500 animate-fadeIn"
            onClick={handleDismissFlyer}
          >
            <div 
              className="relative max-w-md sm:max-w-lg w-full flex flex-col items-center animate-fly-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Close Cross Button */}
              <button
                type="button"
                onClick={handleDismissFlyer}
                className="absolute -top-4 -right-4 sm:-top-5 sm:-right-5 w-11 h-11 rounded-full bg-[#1b4332] hover:bg-black text-[#f5e6c8] hover:text-white border-2 border-[#f5e6c8] flex items-center justify-center text-xl font-bold transition-all hover:scale-110 cursor-pointer shadow-2xl z-30"
                aria-label="Close Rules Flyer"
                title="Close Flyer"
              >
                ✕
              </button>

              {/* Flying Flyer Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] border-2 border-[#2d6a4f]/60 bg-[#0b2b1d]">
                <img
                  src="/mohalla-rules-flyer.jpg"
                  alt="Mohalla Rules - Tum aye toh aya mujhe yaad"
                  className="w-full max-h-[75vh] object-contain rounded-2xl"
                />
              </div>

              {/* Bottom CTA Button */}
              <button
                type="button"
                onClick={handleDismissFlyer}
                className="btn-peek mt-5 px-8 py-3 text-xs tracking-widest uppercase font-mono shadow-xl bg-[#1b4332] hover:bg-white text-white hover:text-black border border-[#2d6a4f] transition-all cursor-pointer"
              >
                SAMJH GAYA · GOT IT 👍
              </button>
            </div>
          </div>
        )}

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authInitialMode}
          triggerMsg={authTriggerMsg}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user) => {
            setStoredUser(user);
            setCurrentUser(user);
            setShowAuthModal(false);
          }}
        />

        {/* Edit Profile Modal */}
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          currentProfile={profileData}
          currentUser={currentUser}
          onSaveSuccess={(updated) => {
            setProfileData((prev) => ({ ...prev, ...updated }));
            setShowEditProfileModal(false);
          }}
        />
      </main>
    );
  }
