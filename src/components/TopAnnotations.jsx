import { useEffect, useState } from "react";

function useClock() {
  const [time, setTime] = useState(null);
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function TopAnnotations({ mode, setMode }) {
  const time = useClock();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-6 sm:px-10 sm:pt-8">
      <div className="ink-soft font-display text-lg tracking-[0.28em] sm:text-xl">
        {time ?? "\u00a0"}
      </div>

      <div className="pointer-events-auto flex items-center gap-3 font-mono text-[10px] font-light uppercase tracking-[0.34em] sm:text-[11px]">
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
  );
}
