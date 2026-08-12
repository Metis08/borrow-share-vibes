import { useMemo, useState } from "react";
import { scanActiveLenders, formatKm, CATALOGUE } from "@/lib/lenders";

export default function BorrowerPanel({ currentUser, onAuthRequired, onBorrowSuccess }) {
  const [q, setQ] = useState("");
  const lenders = useMemo(() => scanActiveLenders(5), []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const active = new Set(lenders.map((l) => l.who));
    return CATALOGUE.filter((s) => (s.name + " " + s.who).toLowerCase().includes(t)).map((s) => {
      const l = lenders.find((x) => x.who === s.who);
      return { ...s, far: l ? formatKm(l.km) : "away", online: Boolean(active.has(s.who)) };
    });
  }, [q, lenders]);

  const handleBorrow = async (item) => {
    if (!currentUser) {
      onAuthRequired("Please sign up or sign in to borrow items.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8085/api/borrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          itemId: item.name.toLowerCase().replace(/\s+/g, "-"),
          itemName: item.name,
          lender: item.who,
          daysLeft: 3,
          since: "borrowed today",
          note: "return within 3 days",
        }),
      });
      if (res.ok) {
        onBorrowSuccess(item.name);
      } else {
        alert("Failed to register borrowing on server.");
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
          placeholder="projector for saturday…"
          className="ink-field font-display"
          autoComplete="off"
        />

        {q.trim() ? (
          <ul className="mt-8 space-y-5">
            {results.length ? (
              results.map((r, i) => (
                <li
                  key={r.name}
                  className="scatter-row animate-fade-in flex items-center justify-between gap-4"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div>
                    <span className="font-display text-2xl font-bold tracking-wide block">{r.name}</span>
                    <span className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-panel-note">
                      {r.who} — {r.far}
                      {r.online ? " · active now" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBorrow(r)}
                    className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.23em] border border-panel-line px-3 py-1 hover:border-white transition-colors"
                  >
                    Borrow
                  </button>
                </li>
              ))
            ) : (
              <li className="font-hand text-2xl text-panel-note">
                nobody has that yet. ask again tomorrow?
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-8 font-mono text-[10px] font-light uppercase leading-loose tracking-[0.3em] text-panel-note">
            try: ladder · projector · degchi · tent
          </p>
        )}
      </div>
    </div>
  );
}
