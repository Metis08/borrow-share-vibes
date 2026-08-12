import { useMemo, useState } from "react";

const STUFF = [
  { name: "Epson projector", who: "Ravi · Gali 4", far: "300 m" },
  { name: "Folding ladder", who: "Sunita aunty", far: "600 m" },
  { name: "Cricket kit", who: "Imran", far: "1.1 km" },
  { name: "Camping tent (4p)", who: "Meera", far: "1.8 km" },
  { name: "Drill machine", who: "Hardware Verma", far: "450 m" },
  { name: "Steel degchi 20L", who: "Sharma ji", far: "200 m" },
  { name: "Bicycle pump", who: "Store counter", far: "0 m" },
];

export default function BorrowerPanel() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return STUFF.filter((s) => (s.name + " " + s.who).toLowerCase().includes(t));
  }, [q]);

  return (
    <div>
      <p className="font-hand text-lg text-panel-note sm:text-2xl">
        18 people within 5 km are lending stuff rn 👀
      </p>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <h2 className="display-xl">
            What are you
            <br />
            searching for?
          </h2>
          <p className="mt-4 font-hand text-xl text-panel-note">“be specific. or don’t.”</p>
        </div>

        <div className="lg:pt-6">
          <label htmlFor="search" className="font-mono text-[10px] tracking-[0.24em] uppercase text-panel-note">
            ask the mohalla
          </label>
          <input
            id="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="projector for saturday...?"
            className="ink-field font-hand"
            autoComplete="off"
          />

          {q.trim() ? (
            <ul className="mt-8 space-y-5">
              {results.length ? (
                results.map((r, i) => (
                  <li
                    key={r.name}
                    className="scatter-row animate-fade-in"
                    style={{ marginLeft: `${(i % 3) * 18}px`, animationDelay: `${i * 60}ms` }}
                  >
                    <span className="font-hand text-2xl">{r.name}</span>
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-panel-note">
                      {r.who} — {r.far}
                    </span>
                  </li>
                ))
              ) : (
                <li className="font-hand text-xl text-panel-note">
                  nobody has that yet. ask again tomorrow?
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-8 font-mono text-[10px] leading-loose tracking-[0.2em] uppercase text-panel-note">
              try: ladder · projector · degchi · tent
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
