import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/peek")({
  head: () => ({
    meta: [
      { title: "Mohalla Store — Taking a Peek" },
      { name: "description", content: "Taking a peek into the mohalla shelves..." }
    ]
  }),
  component: Peek,
});

function Peek() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 font-mono select-none">
      <div className="text-center max-w-lg">
        {/* Handwriting accent */}
        <h1 className="font-zeyada text-6xl text-white mb-6 animate-pulse">
          taking a peek...
        </h1>
        
        {/* Core title */}
        <h2 className="font-display text-2xl text-yellow-400/90 uppercase tracking-[0.25em] mb-4">
          Under Construction
        </h2>
        
        {/* Description tag */}
        <p className="text-xs text-panel-note leading-relaxed uppercase tracking-widest mb-12 max-w-md mx-auto">
          We are polishing the peek view to let you inspect every shelf in the neighbourhood.
        </p>

        {/* Back Link */}
        <div className="flex justify-center">
          <Link
            to="/"
            className="px-8 py-3.5 bg-transparent border border-white/20 hover:border-yellow-400 text-white hover:text-yellow-400 transition-all uppercase tracking-widest text-[11px] font-mono cursor-pointer"
          >
            ← Return to Mohalla
          </Link>
        </div>
      </div>
    </div>
  );
}
