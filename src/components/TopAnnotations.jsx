import { useEffect, useState } from "react";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TopAnnotations({ mode, setMode }) {
  const time = useClock();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-5 sm:px-10 sm:pt-8">
      <div className="ink-soft">
        <div className="font-hand text-xl leading-none sm:text-2xl">{time}</div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase opacity-80">
          <span className="live-dot" aria-hidden="true" />
          32 people online
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <nav className="flex items-center gap-6 font-mono text-[10px] tracking-[0.22em] uppercase sm:text-[11px]">
          <a href="#panel" className="ink-link">
            Explore
          </a>
          <a href="#panel" className="ink-link">
            My profile
          </a>
        </nav>

        <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase sm:text-xs">
          <button
            type="button"
            onClick={() => setMode("borrower")}
            className={mode === "borrower" ? "mode-word is-active" : "mode-word"}
          >
            Borrower
          </button>
          <span className="mode-track" aria-hidden="true">
            <span
              className="mode-dot"
              style={{ transform: mode === "borrower" ? "translateX(0)" : "translateX(14px)" }}
            />
          </span>
          <button
            type="button"
            onClick={() => setMode("lender")}
            className={mode === "lender" ? "mode-word is-active" : "mode-word"}
          >
            Lender
          </button>
        </div>
      </div>
    </div>
  );
}
