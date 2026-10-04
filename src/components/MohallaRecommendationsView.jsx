import React, { useState, useEffect } from "react";
import AuthModal from "@/components/AuthModal";
import { getStoredUser, clearSession, isTokenValid, setStoredUser } from "@/lib/auth";

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

export default function MohallaRecommendationsView({ currentUser, onRequireAuth, onOfferToLend, onNavigateLend }) {
  // Data state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal State
  const [activePost, setActivePost] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reply Form State
  const [replyContent, setReplyContent] = useState("");
  const [showAddRec, setShowAddRec] = useState(false);
  const [recName, setRecName] = useState("");
  const [recCategory, setRecCategory] = useState("");
  const [recDescription, setRecDescription] = useState("");
  const [recLocation, setRecLocation] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Services");
  const [newDescription, setNewDescription] = useState("");
  const [newArea, setNewArea] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postError, setPostError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Auth Modal State fallback
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");
  const [authInitialMode, setAuthInitialMode] = useState("login");

  const requireAuth = (callback, msg) => {
    if (onRequireAuth) {
      return onRequireAuth(callback, msg);
    }
    const user = getStoredUser();
    if (!user?.token || !isTokenValid(user.token)) {
      clearSession("expired");
      setAuthTriggerMsg(msg || "Sign in to ask your mohalla or share recommendations.");
      setAuthInitialMode("login");
      setShowAuthModal(true);
      return false;
    }
    if (callback) callback();
    return true;
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

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
    <div className="flex flex-col gap-8 py-2 animate-fadeIn relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[120] bg-[#facc15] text-black font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-yellow-300 animate-bounce">
          <span>🫶</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER ROW - EXACT MATCHING STYLING TO "कहानी मोहल्ले मोहल्ले की" */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] animate-pulse" />
            <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
              NEIGHBOURHOOD KNOWLEDGE & RECOMMENDATIONS
            </span>
          </div>
          {/* HEADING IN DEVANAGARI HINDI WITH BRAND TYPOGRAPHY */}
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
            पड़ोसियों से पूछ लो
          </h2>
        </div>

        <div className="flex flex-col sm:items-end gap-3">
          <p className="text-xs text-neutral-400 max-w-md leading-relaxed text-left sm:text-right">
            Real recommendations from people around you.
          </p>
          <button
            type="button"
            onClick={() => {
              if (requireAuth(null, "Sign in to ask your mohalla.")) {
                setShowCreateModal(true);
              }
            }}
            className="bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer transform hover:scale-105"
          >
            <span className="text-sm">＋</span>
            <span>Ask</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR & CATEGORY FILTERS */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="What are you looking for in your mohalla? (e.g., tailor, electrician, momos...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-3.5 pl-12 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#facc15]/60 focus:ring-1 focus:ring-[#facc15]/40 transition-all shadow-inner"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-base">
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

        {/* Category Pills */}
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
      </div>

      {/* FEED CONTENT GRID */}
      {loading ? (
        <div className="w-full py-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-400 font-mono">Asking your mohalla...</p>
        </div>
      ) : posts.length === 0 ? (
        /* Empty State */
        <div className="w-full py-16 px-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl text-center space-y-4 max-w-xl mx-auto my-6">
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
            className="bg-[#facc15] hover:bg-yellow-300 text-black font-bold text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg transition-all inline-flex items-center gap-1.5 cursor-pointer"
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
                className="group relative bg-[#0b0b0e] hover:bg-[#111218] border border-neutral-800 hover:border-[#facc15]/50 rounded-[2rem] p-6 transition-all duration-300 cursor-pointer shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-3">
                  
                  {/* Category & Location Header */}
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

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-[#facc15] transition-colors leading-snug">
                    {post.title}
                  </h3>

                  {/* Description Snippet */}
                  {post.description && (
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {post.description}
                    </p>
                  )}

                  {/* Top Structured Recommendation Highlight Box */}
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

      {/* POST DETAIL MODAL */}
      {activePost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#111722] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
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
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Question Banner */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400 font-mono">
                  <span>Asked by @{activePost.username}</span>
                  {currentUser?.username !== activePost.username && onNavigateLend && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePost(null);
                        onNavigateLend();
                      }}
                      className="bg-[#facc15]/10 hover:bg-[#facc15]/20 text-[#facc15] border border-[#facc15]/30 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🤝 Offer to Lend an Item</span>
                    </button>
                  )}
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

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111722] border border-neutral-800 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  पड़ोसियों से पूछ लो
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

      {/* Standalone Auth Modal Fallback */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authInitialMode}
        triggerMsg={authTriggerMsg}
        onSuccess={(session) => {
          setStoredUser(session);
        }}
      />

    </div>
  );
}
