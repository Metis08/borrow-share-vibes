import { useEffect, useMemo, useState } from "react";
import { scanActiveLenders, formatKm, CATALOGUE } from "@/lib/lenders";
import BorrowedProfile from "@/components/BorrowedProfile";

function useLenderScan() {
  const [phase, setPhase] = useState(0);
  const lenders = useMemo(() => scanActiveLenders(5), []);
  useEffect(() => {
    const a = setTimeout(() => setPhase(1), 700);
    const b = setTimeout(() => setPhase(2), 1600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return { phase, lenders };
}

export default function BorrowerPanel() {
  const [q, setQ] = useState("");
  const [view, setView] = useState("search");
  const { lenders } = useLenderScan();

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const active = new Set(lenders.map((l) => l.who));
    return CATALOGUE.filter((s) => (s.name + " " + s.who).toLowerCase().includes(t)).map((s) => {
      const l = lenders.find((x) => x.who === s.who);
      return { ...s, far: l ? formatKm(l.km) : "away", online: Boolean(active.has(s.who)) };
    });
  }, [q, lenders]);

  return (
    <div>
      <nav className="flex items-center justify-center gap-8 font-mono text-[10px] font-light uppercase tracking-[0.34em] text-panel-note">
        <button
          type="button"
          onClick={() => setView("search")}
          className={view === "search" ? "ink-link is-on" : "ink-link"}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setView("profile")}
          className={view === "profile" ? "ink-link is-on" : "ink-link"}
        >
          My profile
        </button>
      </nav>

      {view === "profile" ? (
        <div className="mt-16">
          <BorrowedProfile />
        </div>
      ) : (
        <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <h2 className="display-xl">
              What are you
              <br />
              searching for?
            </h2>
            <p className="mt-5 font-hand text-3xl text-panel-note">be specific. or don’t.</p>
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
                      className="scatter-row animate-fade-in"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className="font-display text-2xl tracking-wide">{r.name}</span>
                      <span className="font-mono text-[10px] font-light uppercase tracking-[0.28em] text-panel-note">
                        {r.who} — {r.far}
                        {r.online ? " · active now" : ""}
                      </span>
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
      )}
    </div>
  );
}
