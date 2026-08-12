import { useEffect, useMemo, useState } from "react";
import { scanActiveLenders, formatKm } from "@/lib/lenders";

export default function PanelHeader() {
  const [phase, setPhase] = useState(0);
  const lenders = useMemo(() => scanActiveLenders(5), []);

  useEffect(() => {
    const a = setTimeout(() => setPhase(1), 700);
    const b = setTimeout(() => setPhase(2), 1700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  return (
    <header className="text-center">
      <h1 className="plate-title font-display">मोहल्ला स्टोर</h1>
      <p className="scan-line mt-4">
        {phase === 0
          ? "scanning your mohalla…"
          : phase === 1
            ? `matching ${lenders.length * 3} shelves within 5 km…`
            : `${lenders.length} lenders active near you · closest ${formatKm(lenders[0].km)}`}
      </p>
    </header>
  );
}
