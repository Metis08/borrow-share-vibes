import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/lend")({
  component: LendPage,
});

export function LendPage({ onBack }) {
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: "Mahek Aghija",
    area: "Block E · Terrace Apartment 402",
    phone: "+91 98765 43210",
    itemTitle: "",
    description: "",
    duration: "7 Days",
    category: "Electronics & Gear",
    condition: "Good Working 👍",
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      if (onBack) {
        onBack();
      } else {
        navigate({ to: "/peek" });
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white p-4 sm:p-8 md:p-12 relative overflow-hidden flex flex-col items-center justify-center font-sans">
      {/* Main Glass Container */}
      <div className="w-full max-w-6xl bg-[#0d0f17]/85 backdrop-blur-3xl border border-neutral-800 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_25px_100px_rgba(0,0,0,0.9)] flex flex-col gap-8 relative z-10">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
          <div className="flex items-center gap-4">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-4 py-2 rounded-full border border-neutral-700 text-xs font-mono transition-colors cursor-pointer flex items-center gap-2 shrink-0"
              >
                ← Back to Mohalla Store
              </button>
            ) : (
              <Link
                to="/peek"
                className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-4 py-2 rounded-full border border-neutral-700 text-xs font-mono transition-colors cursor-pointer flex items-center gap-2 shrink-0"
              >
                ← Back to Mohalla Store
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-[#0c5360]" />
                <span className="font-mono text-[11px] text-neutral-400 uppercase tracking-widest">
                  COMMUNITY ITEM SHARING
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#f5e6c8]">
                Lend an Item to Your Mohalla
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/radar"
              className="bg-[#09414b]/40 hover:bg-[#0c5360] text-teal-200 px-4 py-2 rounded-full border border-[#0c5360] text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              📡 Mohalla Radar
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400 bg-neutral-900/90 border border-neutral-800 px-4 py-2 rounded-full w-fit">
              <span>🛡️ 100% Verified Neighborhood Lends</span>
            </div>
          </div>
        </div>

        {submitted ? (
          /* SUCCESS CONFIRMATION STATE */
          <div className="py-16 flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-4xl shadow-xl animate-bounce">
              ✓
            </div>
            <h2 className="text-3xl font-bold text-white">Item Listed Successfully!</h2>
            <p className="text-sm text-neutral-400 max-w-md">
              Your item <span className="text-teal-200 font-semibold">{formData.itemTitle || "Listing"}</span> is now active on the Mohalla Store. Neighbors in Block E can now request to borrow it!
            </p>
            <span className="text-xs font-mono text-neutral-500 mt-2">Redirecting back to store...</span>
          </div>
        ) : (
          /* FORM & CARD CONTAINER */
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: ITEM IMAGE PLACEHOLDER CARD */}
            <div className="lg:col-span-5 flex flex-col gap-4 h-full">
              <div className="relative group h-full">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`min-h-[560px] sm:min-h-[620px] h-full rounded-[2.5rem] ${
                    isDragging ? "bg-[#09414b]/30" : "bg-gradient-to-br from-[#041a21] via-[#031319] to-[#01090d]"
                  } backdrop-blur-2xl p-7 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-2xl`}
                >
                  {/* Top Tag Pills */}
                  <div className="flex flex-wrap items-center gap-2 z-10">
                    <span className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/90 text-xs font-mono px-3 py-1.5 rounded-full border border-white/15">
                      Community of lenders
                    </span>
                    <span className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/90 text-xs font-mono px-3 py-1.5 rounded-full border border-white/15">
                      Creative resources
                    </span>
                  </div>

                  {/* Center Upload & Image Preview Box */}
                  <div className="my-auto py-8 flex flex-col items-center justify-center text-center z-10 w-full">
                    {imagePreview ? (
                      <div className="relative w-full max-h-80 sm:max-h-96 flex items-center justify-center group/img">
                        <img
                          src={imagePreview}
                          alt="Uploaded Item"
                          className="max-h-80 sm:max-h-96 max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute top-2 right-2 bg-black/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer group/label w-full">
                        <div className="w-24 h-24 rounded-3xl bg-white/10 border border-white/20 group-hover/label:border-[#0c5360] group-hover/label:scale-110 flex items-center justify-center text-white text-4xl mb-5 transition-all shadow-xl backdrop-blur-md">
                          📷
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-snug max-w-xs font-sans">
                          Drag & drop or click to attach item photo
                        </h3>
                        <p className="text-xs text-white/70 font-mono max-w-xs leading-relaxed">
                          Show the authentic condition of your item for your neighbors. High quality JPG, PNG or WEBP.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Bottom Quotation / Info Box inside Card */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5 z-10 mr-16">
                    <p className="text-sm font-semibold text-white/95 leading-relaxed font-sans">
                      "Items with clear photos get borrowed 3x faster in Block E!"
                    </p>
                    <div className="mt-2 text-[11px] text-white/70 font-mono">
                      Mohalla Lending Guidelines · Verified Standard
                    </div>
                  </div>

                  {/* BOTTOM-RIGHT NOTCHED CUTOUT WITH ACTION BUTTONS */}
                  <div className="absolute bottom-0 right-0 z-20 flex items-center gap-2 p-3 bg-[#0d0f17] rounded-tl-3xl">
                    <label
                      title="Upload Photo"
                      className="w-11 h-11 rounded-2xl bg-neutral-900 border border-neutral-700 hover:border-[#0c5360] text-teal-200 font-bold flex items-center justify-center transition-all cursor-pointer shadow-md text-base"
                    >
                      📷
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      title="Clear / Reset"
                      onClick={() => setImagePreview(null)}
                      className="w-11 h-11 rounded-2xl bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-bold flex items-center justify-center transition-all cursor-pointer shadow-md text-sm"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: FORM FIELDS */}
            <div className="lg:col-span-7 flex flex-col gap-5 bg-neutral-900/50 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-2xl">
              <span className="font-mono text-xs text-teal-200 uppercase tracking-wider font-semibold">
                LENDER & ITEM DETAILS FORM
              </span>

              {/* Row 1: Name & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-neutral-300">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Mahek Aghija"
                    className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-neutral-300">Area / Block Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder="e.g. Block E · 150m away"
                    className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Phone Number & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-neutral-300">Phone / WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-neutral-300">Item Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white font-sans transition-colors cursor-pointer"
                  >
                    <option value="Electronics & Gear">Electronics & Gear</option>
                    <option value="Tools & Repair">Tools & Repair</option>
                    <option value="Books & Stationery">Books & Stationery</option>
                    <option value="Board Games & Recreation">Board Games & Recreation</option>
                    <option value="Household Essentials">Household Essentials</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Item Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-300">Item Name / Title *</label>
                <input
                  type="text"
                  required
                  value={formData.itemTitle}
                  onChange={(e) => setFormData({ ...formData, itemTitle: e.target.value })}
                  placeholder="e.g. Casio Scientific Calculator / Leica Camera / Drill Machine"
                  className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans transition-colors"
                />
              </div>

              {/* Row 4: Item Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-300">Item Description & Borrowing Rules</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your item, accessories included, or any special guidelines for borrowers..."
                  className="bg-neutral-950/90 border border-neutral-700/80 focus:border-[#0c5360] focus:outline-none rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans transition-colors resize-none"
                />
              </div>

              {/* Row 5: Max Lend Duration */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono text-neutral-300">Max Lend Duration (Days)</label>
                <div className="flex flex-wrap gap-2">
                  {["1 Day", "3 Days", "7 Days", "14 Days", "Custom / Flexible"].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setFormData({ ...formData, duration: dur })}
                      className={`text-xs font-mono px-3.5 py-2 rounded-full border transition-all cursor-pointer ${
                        formData.duration === dur
                          ? "bg-gradient-to-r from-[#0a3038] via-[#09414b] to-[#042028] text-teal-100 border-[#0c5360] font-bold shadow-md"
                          : "bg-neutral-950/80 text-neutral-300 border-neutral-700/80 hover:border-neutral-500"
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="mt-2 bg-gradient-to-r from-[#0a3038] via-[#09414b] to-[#042028] hover:from-[#0c5360] hover:to-[#09414b] text-teal-100 font-extrabold text-sm sm:text-base py-4 rounded-2xl transition-all border border-[#0c5360] shadow-md hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 List Item on Mohalla Store</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
