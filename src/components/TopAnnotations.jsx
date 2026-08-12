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
      <div className="ink-soft font-mono text-2xl font-semibold tracking-[0.16em] sm:text-3xl">
        {time ?? "\u00a0"}
      </div>

      <div className="pointer-events-auto flex items-center gap-3 font-mono text-xs font-light uppercase tracking-[0.34em] sm:text-sm">
        <button
          type="button"
          onClick={() => setMode("borrower")}
          className={mode === "borrower" ? "mode-word is-active" : "mode-word"}
        >
          Borrower
        </button>
        <span className="mode-track" aria-hidden="true" style={{ width: "24px" }}>
          <span
            className="mode-dot"
            style={{ transform: mode === "borrower" ? "translateX(0)" : "translateX(18px)" }}
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
