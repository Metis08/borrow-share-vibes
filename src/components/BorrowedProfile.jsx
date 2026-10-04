import { useEffect, useRef, useState } from "react";
import EditProfileModal from "@/components/EditProfileModal";
import { apiUrl } from "@/lib/api";

export default function BorrowedProfile({ currentUser, onLocationUpdated, onOpenMessages, onItemDeleted }) {
  const [borrowedItems, setBorrowedItems] = useState([]);
  const [lentItems, setLentItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileMeta, setProfileMeta] = useState({ 
    phone: "", 
    area: "", 
    shelfName: "",
    locationSharingEnabled: false,
    latitude: 0,
    longitude: 0
  });

  // Delete Lent Item state & handler
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemFeedback, setDeleteItemFeedback] = useState(null);

  const handleDeleteLentItem = async (item) => {
    if (!item?.id || !currentUser?.token) return;
    setDeletingItemId(item.id);
    setDeleteItemFeedback(null);
    try {
      const res = await fetch(apiUrl(`/api/items?id=${encodeURIComponent(item.id)}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        setDeleteItemFeedback({
          type: "success",
          message: `"${item.itemName || "Item"}" removed from shelf.`,
        });
        setTimeout(() => setDeleteItemFeedback(null), 4000);
        setLentItems((prev) => prev.filter((x) => x.id !== item.id));
        fetchProfileData();
        if (onItemDeleted) onItemDeleted(item.id);
      } else {
        const errText = await res.text();
        setDeleteItemFeedback({
          type: "error",
          message: errText || "Failed to delete item from shelf.",
        });
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      setDeleteItemFeedback({
        type: "error",
        message: "Network error while deleting item.",
      });
    } finally {
      setDeletingItemId(null);
      setItemToDelete(null);
    }
  };

  const fetchProfileData = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(apiUrl("/api/profile"), {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        
        // Map database items
        const dbBorrowed = (data.borrowed || []).map((b) => ({
          id: `db-borrow-${b.id}`,
          name: b.itemName,
          lender: b.lender,
          daysLeft: b.daysLeft,
          since: b.since || "active borrow",
          note: b.note,
        }));
        
        setBorrowedItems(dbBorrowed);
        setLentItems(data.listings && data.listings.length > 0 ? data.listings : (data.lent || []));
        setProfileMeta({
          fullName: data.fullName || currentUser?.username || "",
          bio: data.bio || "",
          phone: data.phone || "",
          area: data.area || "",
          shelfName: data.shelfName || `${currentUser?.username || "My"}'s Shelf`,
          locationSharingEnabled: data.locationSharingEnabled || false,
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
        });

        if (onLocationUpdated) {
          onLocationUpdated(data.locationSharingEnabled || false, data.latitude || 0, data.longitude || 0);
        }
      }
    } catch (err) {
      console.error("Error loading profile details:", err);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [currentUser]);

  const toggleRadarSharing = async () => {
    const nextEnabled = !profileMeta.locationSharingEnabled;
    let lat = profileMeta.latitude;
    let lng = profileMeta.longitude;

    if (nextEnabled) {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          await saveRadarSharing(true, lat, lng);
        },
        (error) => {
          console.error(error);
          alert("Location permission denied. Please allow location access to share coordinates on Mohalla Radar.");
        }
      );
    } else {
      await saveRadarSharing(false, 0, 0);
    }
  };

  const saveRadarSharing = async (enabled, lat, lng) => {
    try {
      const res = await fetch(apiUrl("/api/user/location"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          locationSharingEnabled: enabled,
          latitude: lat,
          longitude: lng,
        }),
      });
      if (res.ok) {
        setProfileMeta((prev) => ({
          ...prev,
          locationSharingEnabled: enabled,
          latitude: lat,
          longitude: lng,
        }));
        if (onLocationUpdated) {
          onLocationUpdated(enabled, lat, lng);
        }
      } else {
        alert("Failed to update radar sharing settings on server.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating location settings.");
    }
  };

  const active = borrowedItems.find((b) => b.id === openId) ?? borrowedItems[0] ?? null;

  return (
    <div className="grid gap-12 lg:grid-cols-[1.1fr_1.1fr] lg:gap-16">
      {/* User Metadata / Shelf Title */}
      <div className="lg:col-span-2 border-b border-panel-line pb-8">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#cfbda3]/75 block mb-1">
              active neighborhood shelf
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white mb-2">
              {profileMeta.shelfName || `${currentUser?.username}'s Shelf`}
            </h1>
            <p className="font-mono text-[10px] text-panel-note uppercase tracking-widest">
              owner: {currentUser?.username}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 font-mono text-[10px] uppercase tracking-wider text-panel-note bg-white/5 border border-white/10 px-4 py-3 rounded-sm">
            <div>
              <span className="text-[#cfbda3]/70 block text-[8px] tracking-widest mb-0.5">phone:</span>
              <span className="text-white font-medium">{profileMeta.phone || "not registered"}</span>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-6">
              <span className="text-[#cfbda3]/70 block text-[8px] tracking-widest mb-0.5">location/area:</span>
              <span className="text-white font-medium">{profileMeta.area || "mohalla center"}</span>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-6">
              <span className="text-[#cfbda3]/70 block text-[8px] tracking-widest mb-0.5">radar sharing:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={toggleRadarSharing}
                  className={`px-2 py-0.5 rounded text-[8px] tracking-widest uppercase transition-all font-bold cursor-pointer ${
                    profileMeta.locationSharingEnabled
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/15 text-red-400 border border-red-500/30"
                  }`}
                >
                  {profileMeta.locationSharingEnabled ? "Active" : "Disabled"}
                </button>
              </div>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-6 flex items-center">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 rounded text-[9px] font-mono tracking-widest uppercase transition-all cursor-pointer font-bold"
              >
                ✏️ Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Column 1: Borrowing and Lending Lists */}
      <div className="space-y-12">
        <div>
          <h2 className="display-xl">Everything you’ve borrowed</h2>
          <p className="mt-4 eyebrow text-panel-note">
            <span className="text-red-500 font-semibold">{borrowedItems.filter(b => b.daysLeft === 0).length} overdue</span>, <span className="text-yellow-400 font-semibold">{borrowedItems.length} total</span>
          </p>

          {borrowedItems.length === 0 ? (
            <p className="mt-6 font-hand text-xl text-panel-note italic">No active borrowed items.</p>
          ) : (
            <ul className="mt-7 space-y-6">
              {borrowedItems.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(b.id)}
                    className="scatter-row w-full text-left"
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="font-display text-2xl font-bold tracking-wide">{b.name}</span>
                      <span
                        className="font-mono text-[10px] font-light uppercase tracking-[0.28em]"
                        style={{
                          color:
                            b.daysLeft === 0
                              ? "oklch(0.72 0.18 30)"
                              : "oklch(0.88 0.16 92)",
                        }}
                      >
                        {b.daysLeft === 0 ? "due today" : `${b.daysLeft} days left`}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-panel-note">
                      {b.lender} · {b.since}
                      {openId === b.id ? " · chatting" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="display-xl">What you are sharing</h2>
          <p className="mt-4 eyebrow text-panel-note">Items you put on shelves</p>

          {/* Feedback banner */}
          {deleteItemFeedback && (
            <div
              className={`mt-4 p-3 rounded-lg text-xs font-mono flex items-center justify-between gap-2 border animate-fadeIn ${
                deleteItemFeedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              <span>{deleteItemFeedback.message}</span>
              <button
                type="button"
                onClick={() => setDeleteItemFeedback(null)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer ml-auto"
              >
                ✕
              </button>
            </div>
          )}

          {lentItems.length === 0 ? (
            <p className="mt-6 font-hand text-xl text-panel-note italic">Your shelf is currently empty.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {lentItems.map((l) => (
                <li key={l.id} className="scatter-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                    <span className="font-display text-xl font-bold tracking-wide">{l.itemName}</span>
                    <span className="font-mono text-[9px] font-light uppercase tracking-[0.2em] text-green-400">
                      {l.status} on shelf
                    </span>
                  </div>

                  {/* Delete Item Option */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {itemToDelete?.id === l.id ? (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <span className="text-[10px] font-mono text-red-400 mr-1 hidden xs:inline">Confirm?</span>
                        <button
                          type="button"
                          disabled={deletingItemId === l.id}
                          onClick={() => handleDeleteLentItem(l)}
                          className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-mono text-[10px] font-semibold px-2.5 py-1 rounded transition-all cursor-pointer shadow-md flex items-center gap-1"
                        >
                          {deletingItemId === l.id ? (
                            <>
                              <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <span>✓ Yes, Delete</span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={deletingItemId === l.id}
                          onClick={() => setItemToDelete(null)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[10px] px-2 py-1 rounded transition-all cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setItemToDelete(l)}
                        className="text-neutral-400 hover:text-red-400 hover:bg-red-500/10 border border-neutral-700/80 hover:border-red-500/30 px-2.5 py-1 rounded font-mono text-[10px] transition-all flex items-center gap-1 cursor-pointer group"
                        title="Delete this lent item"
                      >
                        <svg
                          className="w-3 h-3 text-neutral-400 group-hover:text-red-400 transition-colors"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Column 2: Direct Real Messaging Integration */}
      <div className="lg:pt-4 flex flex-col justify-between">
        <div className="bg-[#18191c] border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest font-semibold">
              REAL-TIME NEIGHBOUR MESSAGING
            </span>
          </div>

          {active ? (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white font-display">
                Chatting with {active.lender}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                Item: <span className="text-amber-300 font-bold">{active.name}</span> ({active.since})
              </p>
              <button
                type="button"
                onClick={() => onOpenMessages && onOpenMessages()}
                className="w-full bg-[#facc15] hover:bg-yellow-300 text-black font-extrabold text-xs uppercase px-5 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💬 Open Conversation in Messages Tab →</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-2">
              <span className="text-3xl">💬</span>
              <p className="font-hand text-xl text-neutral-400">
                Select a borrowed item or accept a request to open live chat
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 font-mono text-[10px] font-light uppercase leading-loose tracking-[0.28em] text-panel-note">
          returns happen at the counter · no deposits, only faces
        </p>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentProfile={{
          phone: profileMeta.phone,
          area: profileMeta.area,
          shelfName: profileMeta.shelfName,
        }}
        currentUser={currentUser}
        onSaveSuccess={(updated) => {
          setProfileMeta((prev) => ({
            ...prev,
            phone: updated.phone,
            area: updated.area,
            shelfName: updated.shelfName,
          }));
        }}
      />
    </div>
  );
}
