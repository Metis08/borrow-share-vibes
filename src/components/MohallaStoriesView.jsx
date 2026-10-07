import React, { useState, useEffect, useRef } from "react";
import AuthModal from "@/components/AuthModal";
import { getStoredUser, clearSession, isTokenValid } from "@/lib/auth";
import { apiUrl } from "@/lib/api";
import { backStack } from "@/lib/backStack";
import { uploadImage } from "@/lib/storage";

const resolveMomentPhoto = (url) => {
  if (!url || typeof url !== "string") return "";
  return apiUrl(url);
};

const formatMomentDate = (raw) => {
  if (!raw) return "Recent";
  try {
    const d = new Date(String(raw).replace(" ", "T"));
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
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
  const [uploadedPhotos, setUploadedPhotos] = useState([]); // Cloudinary secure_urls or existing URLs
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Three-dot Action Menu State & Edit/Delete Modals
  const [activeMenuMomentId, setActiveMenuMomentId] = useState(null);
  const [editingMoment, setEditingMoment] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isUploadingEditPhotos, setIsUploadingEditPhotos] = useState(false);
  const [showDeleteConfirmMoment, setShowDeleteConfirmMoment] = useState(null);
  const [isDeletingMoment, setIsDeletingMoment] = useState(false);

  // Auth Fallback State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTriggerMsg, setAuthTriggerMsg] = useState("");
  const [authInitialMode, setAuthInitialMode] = useState("login");

  // Close three-dot menu when clicking anywhere outside
  useEffect(() => {
    if (!activeMenuMomentId) return;
    const handleClickOutside = (e) => {
      if (e.target.closest && e.target.closest("[data-story-menu]")) {
        return;
      }
      setActiveMenuMomentId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [activeMenuMomentId]);

  // Back stack registration for Edit Story Modal
  useEffect(() => {
    if (editingMoment) {
      backStack.push("stories_edit", () => {
        setEditingMoment(null);
      });
    } else {
      if (backStack.has("stories_edit")) {
        backStack.pop("stories_edit");
      }
    }
  }, [editingMoment]);

  // Back stack registration for Delete Confirmation Modal
  useEffect(() => {
    if (showDeleteConfirmMoment) {
      backStack.push("stories_delete", () => {
        setShowDeleteConfirmMoment(null);
      });
    } else {
      if (backStack.has("stories_delete")) {
        backStack.pop("stories_delete");
      }
    }
  }, [showDeleteConfirmMoment]);

  // Back stack registration for Share Moment Modal
  useEffect(() => {
    if (showShareModal) {
      backStack.push("stories_share", () => {
        setShowShareModal(false);
      });
    } else {
      if (backStack.has("stories_share")) {
        backStack.pop("stories_share");
      }
    }
  }, [showShareModal]);

  // Back stack registration for Auth Modal
  useEffect(() => {
    if (showAuthModal) {
      backStack.push("stories_auth", () => {
        setShowAuthModal(false);
      });
    } else {
      if (backStack.has("stories_auth")) {
        backStack.pop("stories_auth");
      }
    }
  }, [showAuthModal]);

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

  // Fetch Real Moments from Backend (Single Source of Truth)
  const fetchMoments = async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(apiUrl(`/api/moments?_t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        const incoming = Array.isArray(data.moments) ? data.moments : [];
        setMoments(incoming);
        setTotalBorrowedCount(data.totalBorrowedCount || incoming.length);
      }
    } catch (err) {
      console.error("Failed to fetch Mohalla Moments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getActiveUser = () => {
    if (currentUser?.token) return currentUser;
    const stored = getStoredUser();
    if (stored?.token) return stored;
    return currentUser || null;
  };

  // Fetch logged in user's accepted borrow requests to populate dropdown
  const fetchUserBorrowRequests = async () => {
    const user = getActiveUser();
    if (!user?.token) return;
    try {
      const res = await fetch(apiUrl("/api/borrow-requests"), {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter requests where current user is borrower AND status is accepted
        const myBorrows = (data || []).filter(
          (r) =>
            r.borrowerUsername?.toLowerCase() === user.username?.toLowerCase() &&
            r.status === "accepted",
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

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (uploadedPhotos.length + files.length > 4) {
      alert("You can upload a maximum of 4 photos per Mohalla Moment.");
      return;
    }

    setIsUploadingPhotos(true);
    try {
      for (const file of files) {
        if (!file.type?.startsWith("image/")) continue;
        const secureUrl = await uploadImage(file);
        setUploadedPhotos((prev) => [...prev, secureUrl]);
      }
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      alert(err.message || "Could not upload photo to Cloudinary. Please try again.");
    } finally {
      setIsUploadingPhotos(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemovePhoto = (index) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleShareMoment = async (e) => {
    e.preventDefault();
    if (!borrowedItem.trim()) {
      alert("Please enter the name of the borrowed or shared item.");
      return;
    }
    if (!usageHeadline.trim() || !usageDescription.trim()) {
      alert("Please fill in the usage headline and description.");
      return;
    }

    if (!requireAuth()) return;

    const user = getActiveUser();
    const token = user?.token;
    if (!token) {
      alert("Please sign in to publish your story.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        borrowRequestId: selectedBorrowRequestId ? parseInt(selectedBorrowRequestId, 10) : 0,
        itemName: borrowedItem.trim() || "Community Item",
        lenderUsername: lenderName.trim() || "neighbour",
        itemCategory: itemCategory.trim() || "Borrowed Item",
        usageHeadline: usageHeadline.trim(),
        usageDescription: usageDescription.trim(),
        thankYouMessage: thankYouMessage.trim(),
        photos: uploadedPhotos,
        area: areaName.trim(),
      };

      const res = await fetch(apiUrl("/api/moments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

        // Immediately refetch from backend: database is the single source of truth
        await fetchMoments(true);
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

  // Edit & Delete Story Handlers
  const handleOpenEdit = (moment) => {
    setEditingMoment({
      id: moment.id,
      itemName: moment.itemName || "",
      itemCategory: moment.itemCategory || "Borrowed Item",
      usageHeadline: moment.usageHeadline || "",
      usageDescription: moment.usageDescription || "",
      thankYouMessage: moment.thankYouMessage || "",
      area: moment.area || "",
      photos: Array.isArray(moment.photos) ? [...moment.photos] : [],
    });
  };

  const handleEditPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !editingMoment) return;

    if ((editingMoment.photos?.length || 0) + files.length > 4) {
      alert("You can have a maximum of 4 photos per Mohalla Story.");
      return;
    }

    setIsUploadingEditPhotos(true);
    try {
      for (const file of files) {
        if (!file.type?.startsWith("image/")) continue;
        const secureUrl = await uploadImage(file);
        setEditingMoment((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), secureUrl],
        }));
      }
    } catch (err) {
      console.error("Cloudinary upload failed during story edit:", err);
      alert(err.message || "Could not upload photo. Please try again.");
    } finally {
      setIsUploadingEditPhotos(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveEditPhoto = (photoIdx) => {
    setEditingMoment((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((_, idx) => idx !== photoIdx),
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMoment) return;
    if (!editingMoment.itemName?.trim()) {
      alert("Please provide the borrowed item name.");
      return;
    }
    if (!editingMoment.usageHeadline?.trim() || !editingMoment.usageDescription?.trim()) {
      alert("Please provide both a headline and description for your story.");
      return;
    }

    const user = getActiveUser();
    const token = user?.token;
    if (!token) {
      requireAuth(null, "Sign in to edit your Mohalla Story.");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const payload = {
        id: editingMoment.id,
        itemName: editingMoment.itemName.trim(),
        itemCategory: editingMoment.itemCategory?.trim() || "Borrowed Item",
        usageHeadline: editingMoment.usageHeadline.trim(),
        usageDescription: editingMoment.usageDescription.trim(),
        thankYouMessage: editingMoment.thankYouMessage?.trim() || "",
        area: editingMoment.area?.trim() || "",
        photos: editingMoment.photos || [],
      };

      const res = await fetch(apiUrl("/api/moments"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Your Mohalla Story has been updated! ✨");
        // Update local state immediately
        setMoments((prev) =>
          prev.map((m) =>
            m.id === editingMoment.id
              ? {
                  ...m,
                  itemName: payload.itemName,
                  itemCategory: payload.itemCategory,
                  usageHeadline: payload.usageHeadline,
                  usageDescription: payload.usageDescription,
                  thankYouMessage: payload.thankYouMessage,
                  area: payload.area,
                  photos: payload.photos,
                }
              : m
          )
        );
        setEditingMoment(null);
        // Silent sync with Firestore
        await fetchMoments(true);
      } else {
        const txt = await res.text();
        alert(txt || "Failed to update story.");
      }
    } catch (err) {
      console.error("Error saving story edit:", err);
      alert("Failed to connect to server. Please try again.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteMoment = async (momentId) => {
    if (!momentId) return;
    const user = getActiveUser();
    const token = user?.token;
    if (!token) {
      requireAuth(null, "Sign in to delete your Mohalla Story.");
      return;
    }

    setIsDeletingMoment(true);
    try {
      const res = await fetch(apiUrl(`/api/moments?id=${momentId}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showToast("Your Mohalla Story has been deleted. 🗑️");
        setShowDeleteConfirmMoment(null);
        // Update local state immediately
        setMoments((prev) => prev.filter((m) => m.id !== momentId));
        setTotalBorrowedCount((prev) => Math.max(0, prev - 1));
        // Silent sync with Firestore
        await fetchMoments(true);
      } else {
        const txt = await res.text();
        alert(txt || "Failed to delete story.");
      }
    } catch (err) {
      console.error("Error deleting story:", err);
      alert("Failed to connect to server. Please try again.");
    } finally {
      setIsDeletingMoment(false);
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
            Real stories, uploaded photos, and gratitude behind every borrowed object in your
            neighborhood.
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
              Your first borrow could become one. Real community stories appear here once neighbours
              complete a borrow.
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

            // Only the story author sees the three-dot button to edit or delete
            const activeUser = getActiveUser();
            const currentUsername = (activeUser?.username || currentUser?.username || "").trim().toLowerCase();
            const momentBorrower = (moment.borrowerUsername || "").trim().toLowerCase();
            const isMyStory = Boolean(currentUsername && momentBorrower && momentBorrower === currentUsername);

            return (
              <div key={moment.id} className="w-full">
                {/* =========================================================================
                    MOBILE PHONE VIEW ONLY (< md / < 768px) — BESPOKE BENTO BOX UI
                    ========================================================================= */}
                <div className="block md:hidden bg-[#0c0d12] border border-neutral-800/90 rounded-3xl p-4 shadow-2xl relative overflow-hidden group">
                  {/* 1. Bento Header Pill Strip */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-widest text-[#facc15] bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-0.5 rounded-full uppercase">
                        MOHALLA {formattedIndex}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        @{moment.borrowerUsername}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                      <span>{formatMomentDate(moment.createdAt)}</span>

                      {/* Three-dot menu: strictly ONLY for the author of this story */}
                      {isMyStory && (
                        <div className="relative" data-story-menu="true">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMomentId((prev) => (prev === moment.id ? null : moment.id));
                            }}
                            className="p-1 -mr-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                            title="Story options"
                            aria-label="Story options"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {activeMenuMomentId === moment.id && (
                            <div
                              className="absolute right-0 top-full mt-1.5 w-36 bg-[#161822] border border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 animate-fadeIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuMomentId(null);
                                  handleOpenEdit(moment);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800/80 hover:text-[#facc15] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <span>✏️</span>
                                <span>Edit Story</span>
                              </button>
                              <div className="border-t border-neutral-800/80 my-0.5" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuMomentId(null);
                                  setShowDeleteConfirmMoment(moment);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <span>🗑️</span>
                                <span>Delete Story</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Bento Compartment 1: Hero White Spec Block */}
                  <div className="bg-white text-black p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3 shadow-md mb-3">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-tight mb-2 text-neutral-950">
                        BORROWED {String(moment.itemName || "ITEM").toUpperCase()} FOR{" "}
                        {String(moment.usageHeadline || "MOHALLA STORY").toUpperCase()}
                      </h3>
                      <p className="text-xs text-neutral-700 font-sans leading-relaxed">
                        {moment.usageDescription}
                      </p>
                    </div>

                    {/* Spec Pills Row */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 bg-black text-white rounded-full">
                        {moment.itemName}
                      </span>
                      {moment.area && (
                        <span className="text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 border border-black/30 text-neutral-900 rounded-full">
                          {moment.area}
                        </span>
                      )}
                      {moment.itemCategory && (
                        <span className="text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 border border-black/30 text-neutral-900 rounded-full">
                          {moment.itemCategory}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3. Bento 2-Column Split: Photo Compartment & Gratitude Note */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Left Bento Tile: Photo Compartment */}
                    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-2.5 flex flex-col justify-between gap-2 shadow-inner relative overflow-hidden">
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800/80 flex items-center justify-center">
                        {hasPhotos ? (
                          <>
                            <img
                              src={resolveMomentPhoto(currentPhoto)}
                              alt={`${moment.itemName} usage photo`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="absolute top-1.5 left-1.5 z-10">
                              <span className="font-mono text-[8px] text-amber-300 font-bold bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-amber-400/30">
                                MOHALLA LOVE 💛
                              </span>
                            </div>
                            {moment.photos.length > 1 && (
                              <div className="absolute bottom-1.5 inset-x-0 flex justify-center gap-1 z-10">
                                {moment.photos.map((_, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPhotoIndexMap((prev) => ({
                                        ...prev,
                                        [moment.id]: pIdx,
                                      }));
                                    }}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                      activePhotoIdx === pIdx ? "bg-amber-400 w-3" : "bg-white/50"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-center p-2">
                            <span className="text-2xl">📦</span>
                            <span className="text-[9px] font-mono text-neutral-400">Mohalla Item</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-0.5">
                        <p className="text-[10px] font-mono text-neutral-400 leading-snug truncate">
                          from <strong className="text-teal-200">@{moment.lenderUsername}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Right Bento Tile: Gratitude Compartment */}
                    <div className="bg-gradient-to-br from-[#161720] to-[#0e0f14] border border-neutral-800 rounded-2xl p-3 flex flex-col justify-between gap-2 shadow-inner relative overflow-hidden">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#facc15] uppercase tracking-wide truncate mb-1.5">
                          <span>THANKS, {String(moment.lenderUsername || "NEIGHBOUR").toUpperCase()}</span>
                          <span>💛</span>
                        </div>

                        <p className="text-[11px] text-neutral-200 italic font-sans leading-relaxed line-clamp-4">
                          &ldquo;{moment.thankYouMessage || moment.usageDescription}&rdquo;
                        </p>
                      </div>

                      <div className="pt-1 border-t border-neutral-800/80 flex items-center justify-between text-[9px] font-mono text-neutral-400">
                        <span>Shared by</span>
                        <strong className="text-white">@{moment.borrowerUsername}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================================================
                    IPAD, DESKTOP & LAPTOP VIEW (>= md / >= 768px): 100% UNTOUCHED ORIGINAL
                    ========================================================================= */}
                <div className="hidden md:flex bg-[#0b0b0e] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 flex-col lg:flex-row gap-6 shadow-2xl relative group hover:border-neutral-700 transition-all">
                  {/* Three-dot menu on top-right of the outer container card: strictly ONLY for the author of this story */}
                  {isMyStory && (
                    <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-40" data-story-menu="true">
                      <button
                        type="button"
                        id={`story-menu-desktop-${moment.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMomentId((prev) => (prev === moment.id ? null : moment.id));
                        }}
                        className="w-9 h-9 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 hover:border-yellow-400 text-neutral-300 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xl backdrop-blur-md"
                        title="Story options"
                        aria-label="Story options"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {activeMenuMomentId === moment.id && (
                        <div
                          className="absolute right-0 top-full mt-2 w-36 bg-[#161822] border border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuMomentId(null);
                              handleOpenEdit(moment);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800/80 hover:text-[#facc15] flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>✏️</span>
                            <span>Edit Story</span>
                          </button>
                          <div className="border-t border-neutral-800/80 my-0.5" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuMomentId(null);
                              setShowDeleteConfirmMoment(moment);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>🗑️</span>
                            <span>Delete Story</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

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
                            BORROWED {String(moment.itemName || "ITEM").toUpperCase()} FOR{" "}
                            {String(moment.usageHeadline || "MOHALLA STORY").toUpperCase()}
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
                                      activePhotoIdx === pIdx
                                        ? "bg-amber-400 w-4"
                                        : "bg-neutral-600 hover:bg-neutral-400"
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
                            <span>THANK YOU, {String(moment.lenderUsername || "NEIGHBOUR").toUpperCase()}</span>
                            <span>💛</span>
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-neutral-200 italic font-sans leading-relaxed bg-neutral-950/40 p-3 rounded-2xl border border-neutral-800/60">
                          &ldquo;{moment.thankYouMessage || moment.usageDescription}&rdquo;
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-neutral-400">
                          <span>
                            — Shared by{" "}
                            <strong className="text-white">@{moment.borrowerUsername}</strong>
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {formatMomentDate(moment.createdAt)}
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
                <h3 className="text-xl font-bold text-[#f5e6c8]">कहानी मोहल्ले मोहल्ले की</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Share a real Mohalla Moment from your borrowing experience
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (backStack.has("stories_share")) {
                    backStack.pop("stories_share", () => setShowShareModal(false));
                  } else {
                    setShowShareModal(false);
                  }
                }}
                className="text-neutral-400 hover:text-white text-sm bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleShareMoment} className="space-y-4">
              {borrowRequests.length > 0 && (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                    Link to an Accepted Borrow (Optional)
                  </label>
                  <select
                    value={selectedBorrowRequestId}
                    onChange={handleSelectBorrowRequest}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="">-- Enter item details manually below or select a borrow --</option>
                    {borrowRequests.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.itemName} (Lender: @{req.lenderUsername})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                    Item Borrowed / Shared *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Projector, Drill Machine..."
                    value={borrowedItem}
                    onChange={(e) => setBorrowedItem(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-teal-200 mb-1">
                    Lender / Neighbour
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. mohalla_friend"
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500/50"
                  />
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
                      <div
                        key={pIdx}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-700"
                      >
                        <img
                          src={photo}
                          alt={`Upload ${pIdx}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {isUploadingPhotos && (
                      <div className="w-16 h-16 rounded-xl border border-yellow-400/40 bg-neutral-900/80 flex flex-col items-center justify-center text-yellow-400 gap-1">
                        <span className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[8px] font-mono">Uploading</span>
                      </div>
                    )}

                    {!isUploadingPhotos && uploadedPhotos.length < 4 && (
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
                    disabled={isSubmitting || isUploadingPhotos}
                    className="w-full bg-[#facc15] hover:bg-yellow-300 disabled:opacity-50 text-black font-extrabold text-sm uppercase py-3 rounded-2xl shadow-xl transition-all cursor-pointer"
                  >
                    {isSubmitting
                      ? "Publishing Moment..."
                      : isUploadingPhotos
                        ? "Uploading Photos to Cloudinary..."
                        : "Publish Mohalla Moment →"}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* EDIT MOHALLA STORY MODAL */}
      {editingMoment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#111722] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#f5e6c8]">Edit Mohalla Story</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Update your story headline, experience, note or photos
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (backStack.has("stories_edit")) {
                    backStack.pop("stories_edit", () => setEditingMoment(null));
                  } else {
                    setEditingMoment(null);
                  }
                }}
                className="text-neutral-400 hover:text-white text-sm bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                  Borrowed Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingMoment.itemName}
                  onChange={(e) => setEditingMoment({ ...editingMoment, itemName: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. Badminton Racket, Camping Tent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editingMoment.itemCategory}
                    onChange={(e) => setEditingMoment({ ...editingMoment, itemCategory: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
                    placeholder="e.g. Sports, Kitchen, Tools"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                    Area / Mohalla
                  </label>
                  <input
                    type="text"
                    value={editingMoment.area}
                    onChange={(e) => setEditingMoment({ ...editingMoment, area: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
                    placeholder="e.g. Indiranagar, HSR Layout"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                  Story Headline *
                </label>
                <input
                  type="text"
                  required
                  value={editingMoment.usageHeadline}
                  onChange={(e) => setEditingMoment({ ...editingMoment, usageHeadline: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. Sunday Tournament with Friends"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                  Experience / Usage Details *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingMoment.usageDescription}
                  onChange={(e) => setEditingMoment({ ...editingMoment, usageDescription: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400 resize-none"
                  placeholder="Describe how this borrowed item was useful to you..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                  Thank-You Note to Lender
                </label>
                <textarea
                  rows={2}
                  value={editingMoment.thankYouMessage}
                  onChange={(e) => setEditingMoment({ ...editingMoment, thankYouMessage: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400 resize-none"
                  placeholder="A heartfelt message to the neighbour who lent it..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-amber-300 mb-1">
                  Story Photos ({editingMoment.photos?.length || 0}/4)
                </label>
                <div className="flex flex-wrap gap-2.5 mt-1.5">
                  {(editingMoment.photos || []).map((photoUrl, pIdx) => (
                    <div
                      key={pIdx}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-700 group shrink-0"
                    >
                      <img
                        src={resolveMomentPhoto(photoUrl)}
                        alt={`Photo ${pIdx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEditPhoto(pIdx)}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {isUploadingEditPhotos && (
                    <div className="w-16 h-16 rounded-xl border border-yellow-400/40 bg-neutral-900/80 flex flex-col items-center justify-center text-yellow-400 gap-1 shrink-0">
                      <span className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[8px] font-mono">Uploading</span>
                    </div>
                  )}

                  {!isUploadingEditPhotos && (editingMoment.photos?.length || 0) < 4 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-700 hover:border-yellow-400 flex flex-col items-center justify-center cursor-pointer transition-colors text-neutral-400 hover:text-white shrink-0">
                      <span className="text-xl">📷</span>
                      <span className="text-[9px] font-mono">+Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (backStack.has("stories_edit")) {
                      backStack.pop("stories_edit", () => setEditingMoment(null));
                    } else {
                      setEditingMoment(null);
                    }
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-sm uppercase py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || isUploadingEditPhotos}
                  className="flex-1 bg-[#facc15] hover:bg-yellow-300 disabled:opacity-50 text-black font-extrabold text-sm uppercase py-3 rounded-2xl shadow-xl transition-all cursor-pointer"
                >
                  {isSubmittingEdit ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirmMoment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-[#111722] border border-red-500/30 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Delete Mohalla Story?</h3>
                <p className="text-xs text-neutral-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-black/40 border border-neutral-800/80 p-3 rounded-xl">
              Are you sure you want to permanently delete your story for{" "}
              <strong className="text-white">&ldquo;{showDeleteConfirmMoment.itemName}&rdquo;</strong>?
            </p>

            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeletingMoment}
                onClick={() => {
                  if (backStack.has("stories_delete")) {
                    backStack.pop("stories_delete", () => setShowDeleteConfirmMoment(null));
                  } else {
                    setShowDeleteConfirmMoment(null);
                  }
                }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 font-bold text-xs uppercase py-3 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingMoment}
                onClick={() => handleDeleteMoment(showDeleteConfirmMoment.id)}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase py-3 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeletingMoment ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal Fallback */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          if (backStack.has("stories_auth")) {
            backStack.pop("stories_auth", () => setShowAuthModal(false));
          } else {
            setShowAuthModal(false);
          }
        }}
        initialMode={authInitialMode}
        triggerMsg={authTriggerMsg}
      />
    </div>
  );
}
