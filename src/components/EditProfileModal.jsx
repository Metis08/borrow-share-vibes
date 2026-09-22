import React, { useState, useEffect } from "react";

export default function EditProfileModal({
  isOpen,
  onClose,
  currentProfile,
  currentUser,
  onSaveSuccess,
}) {
  const [fullName, setFullName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [shelfName, setShelfName] = useState("");
  const [bio, setBio] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      setFullName(currentProfile.fullName || currentUser?.username || "");
      setArea(currentProfile.area || "");
      setPhone(currentProfile.phone || "");
      setShelfName(currentProfile.shelfName || `${currentUser?.username || "My"}'s Shelf`);
      setBio(currentProfile.bio || "");
    }
  }, [currentProfile, currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSaving(true);

    const updatedProfile = {
      fullName: fullName.trim() || currentUser?.username || "",
      area: area.trim(),
      phone: phone.trim(),
      shelfName: shelfName.trim() || `${currentUser?.username || "My"}'s Shelf`,
      bio: bio.trim(),
    };

    try {
      localStorage.setItem("mohalla_profile", JSON.stringify(updatedProfile));

      if (currentUser?.token) {
        const res = await fetch("http://localhost:8085/api/setup_profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            fullName: updatedProfile.fullName,
            area: updatedProfile.area,
            phone: updatedProfile.phone,
            shelfName: updatedProfile.shelfName,
            bio: updatedProfile.bio,
          }),
        });

        if (!res.ok) {
          const txt = await res.text();
          setErrorMsg(txt || "Failed to sync profile with server.");
          return;
        }
      }

      if (onSaveSuccess) {
        onSaveSuccess(updatedProfile);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg("Saved locally, but failed to sync with backend server.");
      if (onSaveSuccess) {
        onSaveSuccess(updatedProfile);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0d0f17] border border-neutral-800 rounded-3xl p-5 sm:p-8 shadow-[0_25px_100px_rgba(0,0,0,0.9)] text-white font-sans max-h-[85vh] overflow-y-auto my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 text-base">
              ✏️
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">
                Edit Mohalla Profile
              </h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">
                UPDATE MEMBER IDENTITY & SHELF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 text-xs font-mono text-amber-300 bg-amber-950/60 border border-amber-800/80 p-2.5 rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-1.5 font-bold">
              Full Name / Display Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="eg Mahek Aghija"
              className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-amber-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-1.5 font-bold">
              Location / Area / Block *
            </label>
            <input
              type="text"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="eg Block E · Terrace Apartment 402"
              className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-amber-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-1.5 font-bold">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="eg +91 98765 43210"
              className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-amber-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-1.5 font-bold">
              Shelf Title *
            </label>
            <input
              type="text"
              required
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
              placeholder="eg Mahek's Corner Shelf"
              className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-amber-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-1.5 font-bold">
              Bio / Mohalla Note
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your padosis a bit about what you lend or borrow..."
              className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-amber-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 font-sans resize-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-mono text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Profile ✓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
