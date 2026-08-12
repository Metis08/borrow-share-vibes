import { useEffect, useState } from "react";

const BASE_SHELF = [
  { name: "Bosch drill", state: "out with Imran · back sat", tilt: -2 },
  { name: "Blue camping tent", state: "idle 41 days", tilt: 1.5 },
  { name: "Rice cooker", state: "requested twice this week", tilt: -1 },
  { name: "Ladder, 6 ft", state: "on the terrace", tilt: 2.5 },
  { name: "Carrom board", state: "idle since diwali", tilt: -1.5 },
];

export default function LenderPanel({ currentUser, onAuthRequired }) {
  const [shelfItems, setShelfItems] = useState(BASE_SHELF);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const fetchLentItems = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("http://localhost:8085/api/profile", {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        // Map backend lent items structure to the UI display format
        const customItems = (data.lent || []).map((item) => ({
          name: item.itemName,
          state: `ready to share · since today`,
          tilt: (Math.random() - 0.5) * 4,
        }));
        setShelfItems([...BASE_SHELF, ...customItems]);
      }
    } catch (err) {
      console.error("Error fetching lent items:", err);
    }
  };

  useEffect(() => {
    fetchLentItems();
  }, [currentUser]);

  const handleAddShelfItem = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      onAuthRequired("Please sign in or create a profile to lend items.");
      return;
    }
    const itemName = newItemName.trim();
    if (!itemName) return;

    try {
      const res = await fetch("http://localhost:8085/api/lend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ itemName }),
      });
      if (res.ok) {
        setNewItemName("");
        setShowAddForm(false);
        fetchLentItems();
      } else {
        alert("Failed to add lent item to server.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting backend.");
    }
  };

  return (
    <div>
      <p className="eyebrow text-panel-note">
        your stuff could be doing more than collecting dust.
      </p>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <h2 className="display-xl">
            What’s sitting
            <br />
            around?
          </h2>
        </div>

        <div className="lg:pt-6">
          <p className="font-mono text-[10px] font-light tracking-[0.3em] uppercase text-panel-note">
            on your shelf — {shelfItems.length} things
          </p>
          <ul className="mt-7 space-y-6">
            {shelfItems.map((item, i) => (
              <li
                key={`${item.name}-${i}`}
                className="scatter-row animate-fade-in"
                style={{
                  marginLeft: `${(i % 3) * 22}px`,
                  transform: `rotate(${item.tilt}deg)`,
                  animationDelay: `${i * 70}ms`,
                }}
              >
                <span className="font-display text-2xl font-bold tracking-wide">{item.name}</span>
                <span className="font-mono text-[10px] font-light tracking-[0.28em] uppercase text-panel-note">
                  {item.state}
                </span>
              </li>
            ))}
          </ul>

          {showAddForm ? (
            <form onSubmit={handleAddShelfItem} className="mt-8 animate-fade-in">
              <input
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="What item are you adding?"
                className="ink-field font-display text-xl"
                autoFocus
              />
              <div className="mt-4 flex gap-4">
                <button
                  type="submit"
                  className="ink-link font-mono text-[10px] font-light uppercase tracking-[0.2em] border border-panel-line px-3 py-1 hover:border-white transition-colors"
                >
                  Add on shelf
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="font-mono text-[10px] font-light uppercase tracking-[0.2em] text-panel-note"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => {
                if (!currentUser) {
                  onAuthRequired("Please sign in or create a profile to lend items.");
                } else {
                  setShowAddForm(true);
                }
              }}
              className="mt-10 font-hand text-2xl text-panel-note hover:text-white transition-colors block text-left"
            >
              add one more thing to the shelf →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
