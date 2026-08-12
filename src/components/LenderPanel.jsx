const SHELF = [
  { name: "Bosch drill", state: "out with Imran · back sat", tilt: -2 },
  { name: "Blue camping tent", state: "idle 41 days", tilt: 1.5 },
  { name: "Rice cooker", state: "requested twice this week", tilt: -1 },
  { name: "Ladder, 6 ft", state: "on the terrace", tilt: 2.5 },
  { name: "Carrom board", state: "idle since diwali", tilt: -1.5 },
];

export default function LenderPanel() {
  return (
    <div>
      <p className="font-hand text-lg text-panel-note sm:text-2xl">
        your stuff could be doing more than collecting dust.
      </p>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <h2 className="display-xl">
            What’s sitting
            <br />
            around?
          </h2>
          <a href="#shelf" className="ink-link mt-6 inline-block font-mono text-[11px] tracking-[0.24em] uppercase">
            Go to your lending profile →
          </a>
        </div>

        <div id="shelf" className="lg:pt-6">
          <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-panel-note">
            on your shelf — 5 things
          </p>
          <ul className="mt-7 space-y-6">
            {SHELF.map((item, i) => (
              <li
                key={item.name}
                className="scatter-row animate-fade-in"
                style={{
                  marginLeft: `${(i % 3) * 22}px`,
                  transform: `rotate(${item.tilt}deg)`,
                  animationDelay: `${i * 70}ms`,
                }}
              >
                <span className="font-hand text-2xl">{item.name}</span>
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-panel-note">
                  {item.state}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-10 font-hand text-xl text-panel-note">
            add one more thing to the shelf →
          </p>
        </div>
      </div>
    </div>
  );
}
