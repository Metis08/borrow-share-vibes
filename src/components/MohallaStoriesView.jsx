import React, { useState, useEffect } from "react";
import AuthModal from "@/components/AuthModal";
import { getStoredUser, clearSession, isTokenValid } from "@/lib/auth";

const resolveMomentPhoto = (url) => {
  if (!url) return "";
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  if (url.startsWith("/")) {
    return `http://localhost:8085${url}`;
  }
  return url;
};

export default function MohallaStoriesView({ currentUser, onRequireAuth }) {
  const [moments, setMoments] = useState([]);
  const [totalBorrowedCount, setTotalBorrowedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedPhotoIndexMap, setSelectedPhotoIndexMap] = useState({});

  // Form State for creating a new Mohalla Moment
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [selectedBorrowRequestId, setSelectedBorrowRequestId] = useState("");
  const [borrowedItem, setBorrowedItem] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [itemCategory, setItemCategory] = useState("Borrowed Item");
  const [usageHeadline, setUsageHeadline] = useState("");
  const [usageDescription, setUsageDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [areaName, setAreaName] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState([]); // Base64 data URLs
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth Fallback State
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
      setAuthTriggerMsg(msg || "Sign in to share your Mohalla Moment.");
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

  // Fetch Real Moments from Backend
  const fetchMoments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8085/api/moments");
      if (res.ok) {
        const data = await res.json();
        setMoments(data.moments || []);
        setTotalBorrowedCount(data.totalBorrowedCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch Mohalla Moments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch logged in user's accepted borrow requests to populate dropdown
  const fetchUserBorrowRequests = async () => {
    if (!currentUser?.token) return;
    try {
      const res = await fetch("http://localhost:8085/api/borrow-requests", {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter requests where current user is borrower AND status is accepted
        const myBorrows = (data || []).filter(
          (r) =>
            r.borrowerUsername?.toLowerCase() === currentUser.username?.toLowerCase() &&
            r.status === "accepted"
        );
        setBorrowRequests(myBorrows);
        if (myBorrows.length > 0) {
          const first = myBorrows[0];
          setSelectedBorrowRequestId(String(first.id));
          setBorrowedItem(first.itemName || "");
          setLenderName(first.lenderUsername || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch user borrow requests:", err);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, []);

  useEffect(() => {
    if (showShareModal) {
      fetchUserBorrowRequests();
    }
  }, [showShareModal, currentUser]);

  const handleSelectBorrowRequest = (e) => {
    const reqId = e.target.value;
    setSelectedBorrowRequestId(reqId);
    if (!reqId) return;

    const matched = borrowRequests.find((r) => String(r.id) === String(reqId));
    if (matched) {
      setBorrowedItem(matched.itemName || "");
      setLenderName(matched.lenderUsername || "");
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (uploadedPhotos.length + files.length > 4) {
      alert("You can upload a maximum of 4 photos per Mohalla Moment.");
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhotos((prev) => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleShareMoment = async (e) => {
    e.preventDefault();
    if (!selectedBorrowRequestId) {
      alert("Please select an accepted borrow request.");
      return;
    }
    if (!usageHeadline.trim() || !usageDescription.trim()) {
      alert("Please fill in the usage headline and description.");
      return;
    }

    if (!requireAuth()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        borrowRequestId: parseInt(selectedBorrowRequestId, 10),
        usageHeadline: usageHeadline.trim(),
        usageDescription: usageDescription.trim(),
        thankYouMessage: thankYouMessage.trim(),
        photos: uploadedPhotos,
        area: areaName.trim(),
      };

      const res = await fetch("http://localhost:8085/api/moments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Your Mohalla Moment has been published! 💖");
        setShowShareModal(false);

        // Reset Form
        setSelectedBorrowRequestId("");
        setBorrowedItem("");
        setLenderName("");
        setItemCategory("Borrowed Item");
        setUsageHeadline("");
        setUsageDescription("");
        setThankYouMessage("");
        setAreaName("");
        setUploadedPhotos([]);

        fetchMoments();
      } else {
        const txt = await res.text();
        alert(txt || "Failed to publish moment.");
      }
    } catch (err) {
      console.error("Error creating moment:", err);
      alert("Cannot connect to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 py-2 animate-fadeIn relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[120] bg-[#facc15] text-black font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-yellow-300 animate-bounce">
          <span>💖</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER ROW - EXACT MATCHING BRAND TYPOGRAPHY */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] animate-pulse" />
            <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
              COMMUNITY ARCHIVE & MOMENTS
            </span>
          </div>
          {/* HEADING IN THE EXACT BRAND TYPOGRAPHY STYLE */}
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
            कहानी मोहल्ले मोहल्ले की
          </h2>
        </div>

        <div className="flex flex-col sm:items-end gap-3">
          <p className="text-xs text-neutral-400 max-w-md leading-relaxed text-left sm:text-right">
            Real stories, uploaded photos, and gratitude behind every borrowed object in your neighborhood.
          </p>

          <button
            type="button"
            onClick={() => {
              if (requireAuth(null, "Sign in to share your Mohalla Moment.")) {
                setShowShareModal(true);
              }
            }}
            className="bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer transform hover:scale-105"
          >
            <span className="text-sm">＋</span>
            <span>Share Your Moment</span>
          </button>
        </div>
      </div>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="py-20 text-center font-mono text-xs text-neutral-400 flex flex-col items-center gap-3">
          <span className="w-6 h-6 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
          <span>Loading real Mohalla Moments from database...</span>
        </div>
      )}

      {/* REAL EMPTY STATE (WHEN NO MOMENTS EXIST IN DATABASE) */}
      {!isLoading && moments.length === 0 && (
        <div className="bg-[#0b0b0e] border border-neutral-800/90 rounded-[2.5rem] p-10 sm:p-16 text-center flex flex-col items-center justify-center gap-6 shadow-2xl relative overflow-hidden my-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0a3038] to-[#0c5360] border border-[#146b7a] flex items-center justify-center text-teal-100 text-3xl shadow-xl">
            🤝
          </div>

          <div className="space-y-2 max-w-md">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#f5e6c8]">
              NO MOHALLA MOMENTS YET
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 font-mono leading-relaxed">
              Your first borrow could become one. Real community stories appear here once neighbours complete a borrow.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (requireAuth(null, "Sign in to share your Mohalla Moment.")) {
                setShowShareModal(true);
              }
            }}
            className="bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-6 py-3 rounded-2xl shadow-xl transition-all cursor-pointer transform hover:scale-105 flex items-center gap-2"
          >
            <span>＋ Share The First Mohalla Moment</span>
          </button>
        </div>
      )}

      {/* MODISK-style Bento Grid of Real Backend Moments */}
      {!isLoading && moments.length > 0 && (
        <div className="flex flex-col gap-10">
          {moments.map((moment, index) => {
            const formattedIndex = String(index + 1).padStart(2, "0");
            const activePhotoIdx = selectedPhotoIndexMap[moment.id] || 0;
            const hasPhotos = moment.photos && moment.photos.length > 0;
            const currentPhoto = hasPhotos ? moment.photos[activePhotoIdx] : null;

            return (
              <div
                key={moment.id}
                className="bg-[#0b0b0e] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 flex flex-col lg:flex-row gap-6 shadow-2xl relative overflow-hidden group hover:border-neutral-700 transition-all"
              >
                {/* Vertical Side Title Axis (MODISK Style) */}
                <div className="w-14 shrink-0 bg-white/5 border border-neutral-800/80 rounded-2xl hidden md:flex flex-col items-center justify-between p-4">
                  <span className="[writing-mode:vertical-lr] rotate-180 font-black text-2xl tracking-[0.25em] text-[#f5e6c8] uppercase select-none opacity-90">
                    MOHALLA
                  </span>
                  <span className="font-mono text-xs text-[#facc15] font-bold">
                    {formattedIndex}
                  </span>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col gap-6">

                  {/* Top White & Dark Bluish Teal Modular Blocks Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* 1. Upper White Spec Block */}
                    <div className="lg:col-span-7 bg-white text-black p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 shadow-lg">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-3">
                          BORROWED {moment.itemName.toUpperCase()} FOR {moment.usageHeadline.toUpperCase()}
                        </h3>
                        <p className="text-xs text-neutral-700 font-sans leading-relaxed">
                          {moment.usageDescription}
                        </p>
                      </div>

                      {/* Spec Pills Row */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                          {moment.itemName}
                        </span>
                        {moment.area && (
                          <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                            {moment.area}
                          </span>
                        )}
                        {moment.itemCategory && (
                          <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                            {moment.itemCategory}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                          BORROWED
                        </span>
                      </div>
                    </div>

                    {/* 2. Dark Bluish Teal Accent Block */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-[#0a3038] via-[#09414b] to-[#042028] text-white p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-4 shadow-xl border border-[#0c5360]/50 relative overflow-hidden">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono tracking-wider font-semibold uppercase text-teal-200">
                          MOHALLA MOMENT
                        </span>
                        <div className="w-8 h-8 rounded-full bg-[#09414b]/60 border border-[#0c5360] flex items-center justify-center text-teal-200 text-sm font-bold">
                          ↗
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-bold uppercase leading-tight mb-4 text-teal-100/90">
                          REAL COMMUNITY BORROWING EXPERIENCE
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl sm:text-6xl font-black tracking-tighter text-teal-100">
                            {totalBorrowedCount}
                          </span>
                          <span className="text-xl font-bold text-teal-200/80">
                            Things Borrowed
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Bottom Row: Thumbnail Box & Detail Thank-You Note */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* 3. Bottom-Left Image Card (Displays Real Uploaded Photos) */}
                    <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex flex-col items-center justify-center shrink-0 min-h-[140px] relative overflow-hidden group">
                      {hasPhotos ? (
                        <>
                          <img
                            src={resolveMomentPhoto(currentPhoto)}
                            alt={`${moment.itemName} usage photo`}
                            className="max-h-32 w-full object-cover rounded-2xl filter drop-shadow-md group-hover:scale-105 transition-transform"
                          />
                          {moment.photos.length > 1 && (
                            <div className="flex items-center gap-1.5 mt-2 z-10">
                              {moment.photos.map((_, pIdx) => (
                                <button
                                  key={pIdx}
                                  onClick={() =>
                                    setSelectedPhotoIndexMap((prev) => ({
                                      ...prev,
                                      [moment.id]: pIdx,
                                    }))
                                  }
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    activePhotoIdx === pIdx ? "bg-amber-400 w-4" : "bg-neutral-600 hover:bg-neutral-400"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-3 flex flex-col items-center gap-1">
                          <span className="text-2xl">📦</span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            No photo uploaded
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 4. Bottom-Middle Content Card (Borrower Thank-You Note) */}
                    <div className="md:col-span-8 bg-neutral-900/80 border border-neutral-800/90 p-5 rounded-3xl flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#facc15] uppercase tracking-wider flex items-center gap-1.5">
                          <span>THANK YOU, {moment.lenderUsername.toUpperCase()}</span>
                          <span>💛</span>
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-neutral-200 italic font-sans leading-relaxed bg-neutral-950/40 p-3 rounded-2xl border border-neutral-800/60">
                        &ldquo;{moment.thankYouMessage || moment.usageDescription}&rdquo;
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-neutral-400">
                        <span>
                          — Shared by <strong className="text-white">@{moment.borrowerUsername}</strong>
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {moment.createdAt ? new Date(moment.createdAt).toLocaleDateString() : "Recent"}
                        </span>
                      </div>
                    </div>

                  </div>

                </div>

                {/* 5. Right-Side Featured Card */}
                <div className="w-full lg:w-72 bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden relative shrink-0 min-h-[320px] flex flex-col justify-between p-6">
                  <div className="flex justify-between items-center z-10">
                    <span className="font-mono text-[10px] text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      MOHALLA LOVE 💛
                    </span>
                  </div>

                  <div className="my-auto py-6 flex flex-col items-center justify-center z-10">
                    {hasPhotos ? (
                      <img
                        src={resolveMomentPhoto(currentPhoto)}
                        alt={moment.borrowerUsername}
                        className="max-h-48 w-full object-cover rounded-2xl filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl">
                        🎁
                      </div>
                    )}
                  </div>

                  <div className="z-10 border-t border-neutral-800 pt-3">
                    <p className="text-xs font-bold text-white">@{moment.borrowerUsername}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5 leading-snug">
                      borrowed <strong className="text-amber-300">{moment.itemName}</strong> from{" "}
                      <strong className="text-teal-200">@{moment.lenderUsername}</strong>
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* SHARE MOHALLA MOMENT MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#111722] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#f5e6c8]">
                  कहानी मोहल्ले मोहल्ले की
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Share a real Mohalla Moment from your borrowing experience
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-neutral-400 hover:text-white text-sm bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {borrowRequests.length === 0 ? (
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 mx-auto flex items-center justify-center text-2xl">
                  🤝
                </div>
                <h4 className="text-base font-bold text-[#f5e6c8]">No Accepted Borrows Yet</h4>
                <p className="text-xs text-neutral-400 font-mono leading-relaxed max-w-sm mx-auto">
                  A Mohalla Moment must represent a real borrowing interaction. Find an item in Explore the Mohalla, send a borrow request, and once accepted by the owner, you can share your real experience, photo, and thank-you note here!
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg transition-all"
                  >
                    Got It
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleShareMoment} className="space-y-4">

                {/* Select from Accepted Borrows */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                    Select Your Accepted Borrow *
                  </label>
                  <select
                    value={selectedBorrowRequestId}
                    onChange={handleSelectBorrowRequest}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    {borrowRequests.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.itemName} (Lender: @{req.lenderUsername})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                      Borrowed Item
                    </label>
                    <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 text-xs text-amber-300 font-bold font-mono truncate">
                      {borrowedItem || "Selected Item"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                      Lender
                    </label>
                    <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 text-xs text-teal-200 font-bold font-mono truncate">
                      @{lenderName || "Lender"}
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Electronics, Outdoor..."
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                    Neighbourhood / Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Block E, Indiranagar..."
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  Usage Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g., "A TERRACE MOVIE NIGHT", "EXAM PREP EMERGENCY"'
                  value={usageHeadline}
                  onChange={(e) => setUsageHeadline(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  How Did You Use The Item? *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your experience using the borrowed item..."
                  value={usageDescription}
                  onChange={(e) => setUsageDescription(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  Thank-You Note for Lender 💛
                </label>
                <input
                  type="text"
                  placeholder='e.g., "Priya&apos;s projector saved our movie night! Thank you Priya!"'
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1">
                  Upload Usage Photos (1-4 Photos)
                </label>
                <div className="flex flex-wrap gap-3 items-center mt-1">
                  {uploadedPhotos.map((photo, pIdx) => (
                    <div key={pIdx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-700">
                      <img src={photo} alt={`Upload ${pIdx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(pIdx)}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {uploadedPhotos.length < 4 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-700 hover:border-yellow-400 flex flex-col items-center justify-center cursor-pointer transition-colors text-neutral-400 hover:text-white">
                      <span className="text-xl">📷</span>
                      <span className="text-[9px] font-mono">+Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#facc15] hover:bg-yellow-300 disabled:opacity-50 text-black font-extrabold text-sm uppercase py-3 rounded-2xl shadow-xl transition-all cursor-pointer"
                >
                  {isSubmitting ? "Publishing Moment..." : "Publish Mohalla Moment →"}
                </button>
              </div>
            </form>
            )}

          </div>
        </div>
      )}

      {/* Auth Modal Fallback */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authInitialMode}
        triggerMsg={authTriggerMsg}
      />

    </div>
  );
}
