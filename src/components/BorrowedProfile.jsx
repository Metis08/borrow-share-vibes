import { useEffect, useRef, useState } from "react";

const BASE_BORROWED = [
  {
    id: "proj",
    name: "Epson projector",
    lender: "Ravi · Gali 4",
    daysLeft: 2,
    since: "borrowed 12 Aug",
    note: "keep the remote in the pouch",
  },
  {
    id: "ladder",
    name: "Folding ladder, 6 ft",
    lender: "Sunita aunty",
    daysLeft: 5,
    since: "borrowed 9 Aug",
    note: "return before her painter comes",
  },
  {
    id: "degchi",
    name: "Steel degchi 20L",
    lender: "Sharma ji",
    daysLeft: 0,
    since: "borrowed 1 Aug",
    note: "due today — he asked twice",
  },
];

const REPLIES = [
  "haan ji, no problem. keep it one more day.",
  "aa jao shaam ko, main ghar pe hoon.",
  "theek hai. bas thoda sambhal ke.",
  "koi jaldi nahi, jab free ho tab.",
];

export default function BorrowedProfile({ currentUser, onLocationUpdated }) {
  const [borrowedItems, setBorrowedItems] = useState(BASE_BORROWED);
  const [lentItems, setLentItems] = useState([]);
  const [openId, setOpenId] = useState("proj");
  const [profileMeta, setProfileMeta] = useState({ 
    phone: "", 
    area: "", 
    shelfName: "",
    locationSharingEnabled: false,
    latitude: 0,
    longitude: 0
  });
  
  const [threads, setThreads] = useState(() =>
    Object.fromEntries(
      BASE_BORROWED.map((b) => [
        b.id,
        [{ from: "them", text: `${b.name} — ${b.note}` }],
      ]),
    ),
  );
  
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  const fetchProfileData = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("http://localhost:8085/api/profile", {
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
          since: b.since,
          note: b.note,
        }));
        
        setBorrowedItems([...BASE_BORROWED, ...dbBorrowed]);
        setLentItems(data.lent || []);
        setProfileMeta({
          phone: data.phone || "",
          area: data.area || "",
          shelfName: data.shelfName || "",
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
      const res = await fetch("http://localhost:8085/api/user/location", {
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

  useEffect(() => {
    // Generate thread slots for newly loaded/added items
    setThreads((prev) => {
      const copy = { ...prev };
      borrowedItems.forEach((b) => {
        if (!copy[b.id]) {
          copy[b.id] = [{ from: "them", text: `${b.name} — ${b.note}` }];
        }
      });
      return copy;
    });
  }, [borrowedItems]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [threads, openId]);

  const active = borrowedItems.find((b) => b.id === openId) ?? borrowedItems[0] ?? BASE_BORROWED[0];

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    
    const curId = active.id;
    setThreads((t) => ({ ...t, [curId]: [...(t[curId] || []), { from: "me", text }] }));
    const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    setTimeout(() => {
      setThreads((t) => ({ ...t, [curId]: [...(t[curId] || []), { from: "them", text: reply }] }));
    }, 800);
  };

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
        </div>

        <div>
          <h2 className="display-xl">What you are sharing</h2>
          <p className="mt-4 eyebrow text-panel-note">Items you put on shelves</p>
          {lentItems.length === 0 ? (
            <p className="mt-6 font-hand text-xl text-panel-note italic">Your shelf is currently empty.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {lentItems.map((l) => (
                <li key={l.id} className="scatter-row">
                  <span className="font-display text-xl font-bold tracking-wide">{l.itemName}</span>
                  <span className="font-mono text-[9px] font-light uppercase tracking-[0.2em] text-green-400">
                    {l.status} on shelf
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Column 2: Chat Simulator */}
      <div className="lg:pt-4">
        {active ? (
          <>
            <p className="eyebrow text-panel-note">chat with {active.lender}</p>
            <div className="mt-5 flex h-[320px] flex-col gap-3 overflow-y-auto pr-1">
              {(threads[active.id] || []).map((m, i) => (
                <div key={i} className={m.from === "me" ? "chat-bubble me" : "chat-bubble them"}>
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="mt-4 flex items-center gap-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ek din aur mil jayega?"
                className="ink-field font-display !text-lg"
                aria-label={`Message ${active.lender}`}
              />
              <button
                type="submit"
                className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.34em]"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <p className="font-hand text-2xl text-panel-note">Select an item to chat</p>
        )}

        <p className="mt-6 font-mono text-[10px] font-light uppercase leading-loose tracking-[0.28em] text-panel-note">
          returns happen at the counter · no deposits, only faces
        </p>
      </div>
    </div>
  );
}
