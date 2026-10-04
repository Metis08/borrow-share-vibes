import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Mohalla Recommendations — Padosiyon se pooch lo." },
      {
        name: "description",
        content: "Real recommendations from people around you in your neighbourhood mohalla.",
      },
    ],
  }),
  component: RecommendationsPage,
});

const CATEGORIES = [
  { id: "All", label: "All", icon: "✨" },
  { id: "Services", label: "Services", icon: "🔧" },
  { id: "Food", label: "Food & Spots", icon: "🍜" },
  { id: "Shopping", label: "Shopping", icon: "🛍️" },
  { id: "Home", label: "Home & Repairs", icon: "🏠" },
  { id: "Self Care", label: "Self Care", icon: "💇" },
  { id: "Education", label: "Education & Tutors", icon: "📚" },
  { id: "Local Spots", label: "Local Spots", icon: "📍" },
  { id: "General", label: "General", icon: "💬" },
];

export function RecommendationsPage() {
  const navigate = useNavigate();

  // User Auth state
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");
  const [authInitialMode, setAuthInitialMode] = useState("login");

  // Create Post Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
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
      setShowCreateModal(false);
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

  const requireAuth = (onSuccessCallback, msg) => {
    const user = getStoredUser();
    if (!user || !user.token || !isTokenValid(user.token)) {
      clearSession("expired");
      setAuthTriggerMsg(msg || "Sign in to ask your mohalla or share recommendations.");
      setAuthInitialMode("login");
      setShowAuthModal(true);
      return false;
    }
    if (onSuccessCallback) onSuccessCallback();
    return true;
  };

  // Data state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Post detail modal state
  const [activePost, setActivePost] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reply form state inside detail modal
  const [replyContent, setReplyContent] = useState("");
  const [showAddRec, setShowAddRec] = useState(false);
  const [recName, setRecName] = useState("");
  const [recCategory, setRecCategory] = useState("");
  const [recDescription, setRecDescription] = useState("");
  const [recLocation, setRecLocation] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Create Post Modal form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Services");
  const [newDescription, setNewDescription] = useState("");
  const [newArea, setNewArea] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postError, setPostError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Toast auto-clear
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Fetch posts from backend API
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.append("category", selectedCategory);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`http://localhost:8085/api/recommendations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, searchQuery]);

  // Fetch post details (with replies & structured recommendations)
  const openPostDetail = async (postId) => {
    setLoadingDetail(true);
    try {
      const headers = {};
      if (currentUser?.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
      }
      const res = await fetch(`http://localhost:8085/api/recommendations/detail?id=${postId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActivePost(data);
      }
    } catch (err) {
      console.error("Failed to load post detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Create Post Submit
  const handleCreatePost = async (e) => {
    e.preventDefault();
    setPostError("");

    if (!newTitle.trim()) {
      setPostError("Please enter what you need help with.");
      return;
    }

    if (!requireAuth()) return;

    setIsSubmittingPost(true);
    try {
      const res = await fetch("http://localhost:8085/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          description: newDescription.trim(),
          area: newArea.trim() || "Your mohalla",
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewArea("");
        showToast("Posted to your mohalla 🫶 Let's see what your neighbours recommend!");
        fetchPosts();
      } else {
        const txt = await res.text();
        if (res.status === 401 || txt.includes("Unauthorized") || txt.includes("expired")) {
          setShowCreateModal(false);
          clearSession("expired");
          setAuthTriggerMsg("Your session has expired. Please log in again.");
          setAuthInitialMode("login");
          setShowAuthModal(true);
          return;
        }
        setPostError(txt || "Failed to create post.");
      }
    } catch (err) {
      console.error(err);
      setPostError("Cannot connect to server.");
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Handle Reply Submit
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    if (!requireAuth()) return;

    setIsSubmittingReply(true);
    try {
      const res = await fetch("http://localhost:8085/api/recommendations/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          postId: activePost.id,
          content: replyContent.trim(),
          recName: showAddRec ? recName.trim() : "",
          recCategory: showAddRec ? recCategory.trim() : "",
          recDescription: showAddRec ? recDescription.trim() : "",
          recLocation: showAddRec ? recLocation.trim() : "",
        }),
      });

      if (res.ok) {
        setReplyContent("");
        setShowAddRec(false);
        setRecName("");
        setRecCategory("");
        setRecDescription("");
        setRecLocation("");
        showToast("Reply & recommendation added!");
        openPostDetail(activePost.id);
        fetchPosts();
      } else {
        const txt = await res.text();
        if (res.status === 401 || txt.includes("Unauthorized") || txt.includes("expired")) {
          clearSession("expired");
          setAuthTriggerMsg("Your session has expired. Please log in again.");
          setAuthInitialMode("login");
          setShowAuthModal(true);
          return;
        }
        alert(txt || "Failed to post reply.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting reply.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Toggle Helpful Vote on Reply
  const handleToggleHelpful = async (replyId) => {
    if (!requireAuth()) return;

    try {
      const res = await fetch("http://localhost:8085/api/recommendations/reply/helpful", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ replyId }),
      });

      if (res.ok) {
        openPostDetail(activePost.id);
      } else if (res.status === 401) {
        clearSession("expired");
        setAuthTriggerMsg("Your session has expired. Please log in again.");
        setAuthInitialMode("login");
        setShowAuthModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Endorse on Recommendation
  const handleToggleEndorse = async (recommendationId) => {
    if (!requireAuth()) return;

    try {
      const res = await fetch("http://localhost:8085/api/recommendations/endorse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ recommendationId }),
      });

      if (res.ok) {
        if (activePost) openPostDetail(activePost.id);
        fetchPosts();
      } else if (res.status === 401) {
        clearSession("expired");
        setAuthTriggerMsg("Your session has expired. Please log in again.");
        setAuthInitialMode("login");
        setShowAuthModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete own post
  const handleDeletePost = async (postId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this post?")) return;
    if (!currentUser?.token) return;

    try {
      const res = await fetch(`http://localhost:8085/api/recommendations?id=${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        showToast("Post deleted.");
        if (activePost?.id === postId) setActivePost(null);
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="w-full min-h-screen bg-[#0d1117] text-[#e0e0e0] font-sans antialiased selection:bg-[#facc15] selection:text-black relative pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[120] bg-[#facc15] text-black font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-yellow-300 animate-bounce">
          <span>🫶</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP NAVBAR */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800/80 gap-4">
        <div className="flex items-center justify-between w-full md:w-auto shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="text-2xl font-bold tracking-tight text-[#f5e6c8] group-hover:text-white transition-colors">
              मोहल्ला स्टोर
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-yellow-500/10 text-[#facc15] border border-yellow-500/20">
              Community Noticeboard
            </span>
          </Link>

          {/* Mobile Ask CTA */}
          <button
            type="button"
            onClick={() => {
              if (requireAuth(null, "Sign in to ask your mohalla.")) {
                setShowCreateModal(true);
              }
            }}
            className="md:hidden bg-[#facc15] text-black font-bold text-xs uppercase px-3 py-1.5 rounded-lg shadow-lg hover:bg-yellow-300 transition-all flex items-center gap-1"
          >
            <span>＋</span>
            <span>Ask</span>
          </button>
        </div>

        {/* Center Nav Options */}
        <nav className="flex items-center gap-4 sm:gap-6 text-xs font-medium tracking-wide text-neutral-300 overflow-x-auto scrollbar-none py-1">
          <Link
            to="/peek"
            className="hover:text-[#facc15] hover:underline underline-offset-4 transition-all whitespace-nowrap"
          >
            Explore your Mohalla
          </Link>
          <Link
            to="/recommendations"
            className="text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15] flex items-center gap-1 whitespace-nowrap"
          >
            <span>🫂</span>
            <span>Recommendations</span>
          </Link>
          <Link
            to="/radar"
            className="hover:text-[#facc15] hover:underline underline-offset-4 transition-all whitespace-nowrap"
          >
            Mohalla Radar
          </Link>
          <Link
            to="/lend"
            className="hover:text-[#facc15] hover:underline underline-offset-4 transition-all whitespace-nowrap"
          >
            Lend / Shelf
          </Link>
        </nav>

        {/* Desktop Right Action CTA */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{currentUser.username}</span>
              </div>
              <button
                type="button"
                onClick={() => clearSession("logout")}
                className="text-[11px] text-neutral-500 hover:text-red-400 font-mono transition-colors cursor-pointer px-1 py-1"
                title="Sign Out"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthTriggerMsg("Sign in to ask your mohalla or share recommendations.");
                setAuthInitialMode("login");
                setShowAuthModal(true);
              }}
              className="text-xs text-neutral-400 hover:text-white underline cursor-pointer px-2 py-1"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (requireAuth(null, "Sign in to ask your mohalla.")) {
                setShowCreateModal(true);
              }
            }}
            className="bg-[#facc15] hover:bg-yellow-300 text-black font-bold text-xs uppercase px-4 py-2 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5"
          >
            <span className="text-sm">＋</span>
            <span>Ask</span>
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8">
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-[#161f2e] via-[#111722] to-[#0a0e17] border border-neutral-800 shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-[#facc15] text-xs font-mono">
              <span>📍 Neighbourhood Knowledge Exchange</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Padosiyon se pooch lo.
            </h1>

            <p className="text-xl sm:text-2xl font-semibold text-[#f5e6c8]">
              Real recommendations from people around you.
            </p>

            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl">
              Need a good tailor? Looking for a reliable electrician? Can&apos;t remember where that one amazing momo place was? Ask your mohalla.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (requireAuth(null, "Sign in to ask your mohalla.")) {
                    setShowCreateModal(true);
                  }
                }}
                className="bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-sm uppercase px-6 py-3 rounded-2xl shadow-xl transition-all flex items-center gap-2 cursor-pointer transform hover:scale-105"
              >
                <span className="text-base">＋</span>
                <span>Ask</span>
              </button>

              <span className="text-xs text-neutral-500 font-mono">
                • Trusted by real neighbours in your area
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CATEGORY FILTERS & SEARCH BAR */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Search Bar */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="What are you looking for in your mohalla? (e.g., tailor, electrician, momos...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-4 pl-12 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#facc15]/60 focus:ring-1 focus:ring-[#facc15]/40 transition-all shadow-inner"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-lg">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs bg-neutral-800 px-2 py-1 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#facc15] text-black font-bold shadow-md"
                    : "bg-neutral-900/80 text-neutral-300 hover:bg-neutral-800 hover:text-white border border-neutral-800"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

      </section>

      {/* 4. RECOMMENDATIONS FEED */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        
        {loading ? (
          <div className="w-full py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-400 font-mono">Asking your mohalla...</p>
          </div>
        ) : posts.length === 0 ? (
          /* Empty State */
          <div className="w-full py-16 px-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl text-center space-y-4 max-w-xl mx-auto my-8">
            <div className="text-4xl">👀</div>
            <h3 className="text-lg font-bold text-white">
              Hmm, your mohalla hasn&apos;t talked about this yet.
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Be the first to ask! Someone nearby probably knows the answer.
            </p>
            <button
              type="button"
              onClick={() => {
                if (requireAuth(null, "Sign in to ask your mohalla.")) {
                  setShowCreateModal(true);
                }
              }}
              className="bg-[#facc15] hover:bg-yellow-300 text-black font-bold text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg transition-all inline-flex items-center gap-1.5"
            >
              <span>＋</span>
              <span>Ask</span>
            </button>
          </div>
        ) : (
          /* Feed Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => {
              const topRec = post.recommendations && post.recommendations[0];
              const isFavourite = topRec && topRec.recommendedCount >= 3;
              const isOwnPost = currentUser?.username === post.username;

              return (
                <div
                  key={post.id}
                  onClick={() => openPostDetail(post.id)}
                  className="group relative bg-[#141b26]/90 hover:bg-[#182232] border border-neutral-800 hover:border-[#facc15]/50 rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-[#facc15] border border-yellow-500/20 font-semibold">
                          {post.category}
                        </span>
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <span>📍</span>
                          <span>{post.area || "Your mohalla"}</span>
                        </span>
                      </div>

                      {isOwnPost && (
                        <button
                          onClick={(e) => handleDeletePost(post.id, e)}
                          className="text-xs text-red-400/70 hover:text-red-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete post"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>

                    {/* Post Title */}
                    <h3 className="text-lg font-bold text-white group-hover:text-[#facc15] transition-colors leading-snug">
                      {post.title}
                    </h3>

                    {/* Post Description */}
                    {post.description && (
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {post.description}
                      </p>
                    )}

                    {/* Structured Recommendation Preview Card */}
                    {topRec && (
                      <div className="mt-3 p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-yellow-200 flex items-center gap-1">
                            <span>⚡</span>
                            <span>{topRec.name}</span>
                          </span>

                          {isFavourite ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <span>🫶</span>
                              <span>Mohalla Favourite</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">
                              👍 {topRec.recommendedCount} recommendations
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-1">
                          {topRec.description || topRec.category}
                        </p>
                        {topRec.location && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {topRec.location}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Card Footer Metadata */}
                  <div className="mt-5 pt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span>💬</span>
                        <span>{post.repliesCount} replies</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        <span>{post.neighbourCount} neighbours</span>
                      </span>
                    </div>

                    <div className="text-neutral-500 font-mono text-[11px]">
                      By @{post.username}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. POST DETAIL MODAL / DRAWER */}
      {activePost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#111722] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-yellow-500/10 text-[#facc15] border border-yellow-500/20 font-bold">
                  {activePost.category}
                </span>
                <span className="text-xs text-neutral-400">
                  📍 {activePost.area || "Your mohalla"}
                </span>
              </div>

              <button
                onClick={() => setActivePost(null)}
                className="text-neutral-400 hover:text-white text-sm bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Question Banner */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                  <span>Asked by @{activePost.username}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {activePost.title}
                </h2>
                {activePost.description && (
                  <p className="text-sm text-neutral-300 leading-relaxed bg-neutral-900/60 p-4 rounded-xl border border-neutral-800/80">
                    {activePost.description}
                  </p>
                )}
              </div>

              {/* Structured Recommendations Section */}
              {activePost.recommendations && activePost.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[#facc15]">
                    ⭐ Mohalla Recommendations ({activePost.recommendations.length})
                  </h4>

                  <div className="space-y-3">
                    {activePost.recommendations.map((rec) => {
                      const isFav = rec.recommendedCount >= 3;
                      return (
                        <div
                          key={rec.id}
                          className="p-4 bg-neutral-900 border border-neutral-800 hover:border-yellow-500/40 rounded-2xl space-y-2 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="text-base font-bold text-white">
                                  ⚡ {rec.name}
                                </h5>
                                {isFav && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    🫶 Mohalla Favourite
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-neutral-400 mt-0.5">
                                {rec.category} {rec.location && `• ${rec.location}`}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleEndorse(rec.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                rec.hasEndorsed
                                  ? "bg-yellow-400 text-black shadow-md"
                                  : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                              }`}
                            >
                              <span>👍</span>
                              <span>
                                {rec.hasEndorsed ? "Recommended" : "Recommend"} ({rec.recommendedCount})
                              </span>
                            </button>
                          </div>

                          {rec.description && (
                            <p className="text-xs text-neutral-300 bg-neutral-950/50 p-2.5 rounded-lg">
                              &ldquo;{rec.description}&rdquo;
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Replies Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                  💬 Neighbour Replies ({activePost.replies ? activePost.replies.length : 0})
                </h4>

                {activePost.replies && activePost.replies.length > 0 ? (
                  <div className="space-y-3">
                    {activePost.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-4 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-yellow-200">
                            @{reply.username}
                          </span>
                          <span className="text-neutral-500 text-[11px] font-mono">
                            {reply.createdAt}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-200 leading-relaxed">
                          {reply.content}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleToggleHelpful(reply.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                              reply.hasVotedHelpful
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "text-neutral-400 hover:text-white bg-neutral-800/60"
                            }`}
                          >
                            <span>👍 Helpful</span>
                            <span>({reply.helpfulCount})</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 italic py-2">
                    No replies yet. Be the first neighbour to respond!
                  </p>
                )}
              </div>

            </div>

            {/* Reply Input Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 space-y-3">
              <form onSubmit={handleReplySubmit} className="space-y-3">
                <textarea
                  rows={2}
                  placeholder="Write a recommendation or response for your neighbour..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />

                {/* Option to attach structured place recommendation */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRec(!showAddRec)}
                    className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAddRec ? "➖ Hide structured recommendation" : "➕ Recommend a specific place/person"}</span>
                  </button>

                  {showAddRec && (
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="Place / Service Name (e.g., Neha Tailors)"
                        value={recName}
                        onChange={(e) => setRecName(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Category (e.g. Tailoring)"
                          value={recCategory}
                          onChange={(e) => setRecCategory(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Location (e.g. 0.4 km away)"
                          value={recLocation}
                          onChange={(e) => setRecLocation(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Why do you recommend them? (optional)"
                        value={recDescription}
                        onChange={(e) => setRecDescription(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !replyContent.trim()}
                    className="bg-[#facc15] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold text-xs uppercase px-4 py-2 rounded-xl shadow cursor-pointer"
                  >
                    {isSubmittingReply ? "Posting..." : "Post Reply →"}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* 6. CREATE RECOMMENDATION POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111722] border border-neutral-800 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Padosiyon se pooch lo.
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Ask your neighbourhood for suggestions & recommendations
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white text-sm bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {postError && (
              <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/60 p-3 rounded-xl">
                ⚠️ {postError}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  What do you need help with? *
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g., "Koi acha ladies tailor suggest krdo?" or "Reliable electrician near sector C?"'
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    {CATEGORIES.filter((c) => c.id !== "All").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                    Your Area / Sector
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Kalkaji, Sector C..."
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  Details / Context (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide extra details so neighbours can give the best suggestions..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPost || !newTitle.trim()}
                  className="w-full bg-[#facc15] hover:bg-yellow-300 disabled:opacity-50 text-black font-extrabold text-sm uppercase py-3 rounded-2xl shadow-xl transition-all cursor-pointer"
                >
                  {isSubmittingPost ? "Posting to Mohalla..." : "Post to Mohalla →"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Auth Modal Trigger */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authInitialMode}
        triggerMsg={authTriggerMsg}
        onSuccess={(userSession) => {
          setStoredUser(userSession);
          setCurrentUser(userSession);
        }}
      />

    </main>
  );
}
