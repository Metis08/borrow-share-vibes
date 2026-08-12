import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import heroAsset from "@/assets/mohalla-hero.png.asset.json";
import TopAnnotations from "@/components/TopAnnotations";
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

function Index() {
  const [mode, setMode] = useState("borrower");

  return (
    <main className="relative bg-hero-deep">
      <div className="relative h-[210vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <img
            src={heroAsset.url}
            alt="A lit-up neighbourhood store under a big tree on a rainy blue evening"
            className="h-full w-full object-cover"
          />
          <div className="hero-vignette" aria-hidden="true" />

          <TopAnnotations mode={mode} setMode={setMode} />

          <span className="float-note left-6 top-1/2 sm:left-12">Open today</span>
          <span className="float-note right-8 top-[38%] sm:right-16">Nearby: 18 lenders</span>
          <span className="float-note bottom-40 left-1/2 -translate-x-1/2 font-hand !text-lg !tracking-normal !normal-case sm:!text-xl">
            the mohalla is awake
          </span>

          <p className="absolute inset-x-0 bottom-14 text-center font-mono text-[9px] leading-relaxed tracking-[0.3em] uppercase text-hero-tag sm:bottom-20 sm:text-[11px]">
            Borrow it. Return it. Keep the mohalla moving.
          </p>
        </div>

        <section id="panel" className="glass-sheet relative z-30 -mt-[42vh] min-h-screen">
          <div className="grain" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 sm:px-12 sm:pt-28">
            {mode === "borrower" ? <BorrowerPanel /> : <LenderPanel />}

            <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-panel-line pt-8 font-mono text-[10px] tracking-[0.22em] uppercase text-panel-note">
              <span>मोहल्ला स्टोर — since forever</span>
              <span>trust, mostly</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
