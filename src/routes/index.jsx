import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import heroAsset from "@/assets/mohalla-hero.png.asset.json";
import TopAnnotations from "@/components/TopAnnotations";
import PanelHeader from "@/components/PanelHeader";
import BorrowerPanel from "@/components/BorrowerPanel";
import LenderPanel from "@/components/LenderPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mohalla Store — Borrow it. Return it." },
      {
        name: "description",
        content:
          "Mohalla Store is a neighbourhood lending shop: borrow what you need for a day, lend what's collecting dust.",
      },
      { property: "og:title", content: "Mohalla Store — Borrow it. Return it." },
      {
        property: "og:description",
        content: "Borrow it. Return it. Keep the mohalla moving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const span = window.innerHeight * 0.55;
      setP(Math.min(1, Math.max(0, window.scrollY / span)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return p;
}

function Index() {
  const [mode, setMode] = useState("borrower");
  const p = useScrollProgress();

  return (
    <main className="relative bg-hero-deep">
      <div className="relative">
        <div className="sticky top-0 h-screen overflow-hidden">
          <img
            src={heroAsset.url}
            alt="A lit-up neighbourhood store under a big tree on a rainy blue evening"
            className="h-full w-full object-cover"
          />
          <div className="hero-vignette" aria-hidden="true" />

          <TopAnnotations mode={mode} setMode={setMode} />

          <span className="ink-soft absolute bottom-40 left-1/2 -translate-x-1/2 font-hand text-3xl sm:text-4xl">
            the mohalla is awake
          </span>

          <p className="absolute inset-x-0 bottom-14 text-center font-mono text-[9px] font-light uppercase leading-relaxed tracking-[0.42em] text-hero-tag sm:bottom-20 sm:text-[11px]">
            Borrow it. Return it. Keep the mohalla moving.
          </p>
        </div>

        <div className="h-[70vh]" aria-hidden="true" />

        <section
          id="panel"
          className="glass-sheet panel-stage relative z-30 min-h-screen"
          style={{
            transform: `translateY(${(1 - p) * 22}vh)`,
            opacity: p <= 0.02 ? 0 : Math.min(1, p * 1.6),
            pointerEvents: p <= 0.02 ? "none" : "auto",
          }}
        >
          <div className="grain" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 sm:px-12 sm:pt-24">
            <PanelHeader />

            <div className="mt-14">
              {mode === "borrower" ? <BorrowerPanel /> : <LenderPanel />}
            </div>

            <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-panel-line pt-8 font-mono text-[10px] font-light uppercase tracking-[0.32em] text-panel-note">
              <span>मोहल्ला स्टोर — since forever</span>
              <span>trust, mostly</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
