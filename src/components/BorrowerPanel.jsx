import { useEffect, useMemo, useState } from "react";
import { clearSession } from "@/lib/auth";
import { apiUrl } from "@/lib/api";

export default function BorrowerPanel({ currentUser, onAuthRequired, onBorrowSuccess }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch(apiUrl("/api/items"))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
        }
      })
      .catch((err) => console.error("Error fetching items in borrower panel:", err));
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return items
      .filter((s) => {
        const name = s.itemName || s.item_name || "";
        const who = s.lenderName || s.username || "";
        const desc = s.description || "";
        return (name + " " + who + " " + desc).toLowerCase().includes(t);
      })
      .map((s) => ({
        id: s.id,
        name: s.itemName || s.item_name,
        who: s.lenderName || s.username,
        far: s.area || "Nearby",
        category: s.category,
        online: true,
      }));
  }, [q, items]);

  const handleBorrow = async (item) => {
    if (!currentUser) {
      onAuthRequired("Please sign up or sign in to borrow items.");
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/borrow-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          itemId: String(item.id || item.name.toLowerCase().replace(/\s+/g, "-")),
          itemName: item.name,
          lender: item.who,
          note: "Requested via Borrower search panel",
        }),
      });
      if (res.ok) {
        onBorrowSuccess(item.name);
      } else {
        const text = await res.text();
        if (res.status === 401 || text.toLowerCase().includes("unauthorized") || text.toLowerCase().includes("expired")) {
          clearSession("expired");
          onAuthRequired("Your session expired. Please sign in or create your shelf to send a borrow request.");
        } else {
          alert(text || "Failed to submit borrow request.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting the server.");
    }
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      <div>
        <h2 className="display-xl">
          What are you
          <br />
          searching for?
        </h2>
        <p className="mt-5 eyebrow text-panel-note">be specific. or don’t.</p>
      </div>

      <div className="lg:pt-4">
        <label
          htmlFor="search"
          className="eyebrow text-panel-note"
        >
          ask the mohalla
        </label>
        <input
          id="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search items in database..."
          className="ink-field font-display"
          autoComplete="off"
        />

        {q.trim() ? (
          <ul className="mt-8 space-y-5">
            {results.length ? (
              results.map((r, i) => (
                <li
                  key={`${r.name}-${r.id || i}`}
                  className="scatter-row animate-fade-in flex items-center justify-between gap-4"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div>
                    <span className="font-display text-2xl font-bold tracking-wide block">{r.name}</span>
                    <span className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-panel-note">
                      {r.who} — {r.far}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBorrow(r)}
                    className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.23em] border border-panel-line px-3 py-1 hover:border-white transition-colors cursor-pointer"
                  >
                    Borrow
                  </button>
                </li>
              ))
            ) : (
              <li className="font-hand text-2xl text-panel-note">
                nobody has listed that yet in your mohalla.
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-8 font-mono text-[10px] font-light uppercase leading-loose tracking-[0.3em] text-panel-note">
            {items.length > 0
              ? `available in mohalla: ${items.slice(0, 4).map((it) => it.itemName || it.item_name).join(" · ")}`
              : "no items listed yet in the database"}
          </p>
        )}
      </div>
    </div>
  );
}
