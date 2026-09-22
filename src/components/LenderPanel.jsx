import { useEffect, useState } from "react";

export default function LenderPanel({ currentUser, onAuthRequired }) {
  const [shelfItems, setShelfItems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLentItems = async () => {
    if (!currentUser) {
      setShelfItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8085/api/profile", {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const customItems = (data.lent || []).map((item) => ({
          name: item.itemName,
          state: `${item.category || "Other"} · ready to share`,
          tilt: (Math.random() - 0.5) * 4,
        }));
        setShelfItems(customItems);
      }
    } catch (err) {
      console.error("Error fetching lent items:", err);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ 
          itemName, 
          category: newItemCategory, 
          description: newItemDescription 
        }),
      });
      if (res.ok) {
        setNewItemName("");
        setNewItemCategory("Other");
        setNewItemDescription("");
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
          {shelfItems.length > 0 ? (
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
          ) : (
            <p className="mt-7 font-hand text-2xl text-panel-note">
              {currentUser ? "your shelf is empty. put an item up for lending below!" : "sign in to view and manage items on your shelf."}
            </p>
          )}

          {showAddForm ? (
            <form onSubmit={handleAddShelfItem} className="mt-8 animate-fade-in space-y-5">
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#cfbda3]/75 block mb-1">
                  Item Name
                </label>
                <input
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="What item are you adding?"
                  className="ink-field font-display text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#cfbda3]/75 block mb-1">
                  Category
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full bg-[#121c2c]/80 border border-white/10 text-white rounded px-3 py-2.5 font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-yellow-400 mt-1 cursor-pointer"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Tools">Tools</option>
                  <option value="Books">Books</option>
                  <option value="Home">Home</option>
                  <option value="Outdoor">Outdoor</option>
                  <option value="Events">Events</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#cfbda3]/75 block mb-1">
                  Short Description
                </label>
                <input
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="e.g. HDMI cable, return dry..."
                  className="ink-field font-mono text-sm"
                />
              </div>

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
