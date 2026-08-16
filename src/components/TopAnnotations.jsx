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

export default function TopAnnotations() {
  const time = useClock();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-6 sm:px-10 sm:pt-8 bg-transparent">
      <div className="ink-soft font-mono text-2xl font-semibold tracking-[0.16em] sm:text-3xl">
        {time ?? "\u00a0"}
      </div>
    </div>
  );
}
