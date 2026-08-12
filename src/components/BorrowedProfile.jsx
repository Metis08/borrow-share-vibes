import { useEffect, useRef, useState } from "react";

const BORROWED = [
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

export default function BorrowedProfile() {
  const [openId, setOpenId] = useState(BORROWED[0].id);
  const active = BORROWED.find((b) => b.id === openId) ?? BORROWED[0];
  const [threads, setThreads] = useState(() =>
    Object.fromEntries(
      BORROWED.map((b) => [
        b.id,
        [{ from: "them", text: `${b.name} — ${b.note}` }],
      ]),
    ),
  );
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [threads, openId]);

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setThreads((t) => ({ ...t, [openId]: [...t[openId], { from: "me", text }] }));
    const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    setTimeout(() => {
      setThreads((t) => ({ ...t, [openId]: [...t[openId], { from: "them", text: reply }] }));
    }, 800);
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <div>
        <h2 className="display-xl">Everything you’ve borrowed</h2>
        <p className="mt-4 font-hand text-3xl text-panel-note">three things, one is overdue.</p>

        <ul className="mt-10 space-y-6">
          {BORROWED.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpenId(b.id)}
                className="scatter-row w-full text-left"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-2xl tracking-wide">{b.name}</span>
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

      <div className="lg:pt-4">
        <p className="eyebrow text-panel-note">chat with {active.lender}</p>
        <div className="mt-5 flex h-72 flex-col gap-3 overflow-y-auto pr-1">
          {threads[openId].map((m, i) => (
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

        <p className="mt-6 font-mono text-[10px] font-light uppercase leading-loose tracking-[0.28em] text-panel-note">
          returns happen at the counter · no deposits, only faces
        </p>
      </div>
    </div>
  );
}
