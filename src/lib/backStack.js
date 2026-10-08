// src/lib/backStack.js
// Universal Back-Navigation and Hardware/Gesture Popstate Manager
// Handles mobile hardware back button, Android back gesture, and browser back
// so users navigate hierarchically through modals, sheets, chats, and tabs rather than exiting the app.

class BackStackManager {
  constructor() {
    this.stack = [];
    this.isProgrammaticPop = false;
    this.listenerAttached = false;
  }

  setupListener() {
    if (typeof window === "undefined" || this.listenerAttached) return;
    this.listenerAttached = true;

    window.addEventListener("popstate", (e) => {
      // If this popstate was triggered programmatically by backStack.pop(), skip running the close handler again
      if (this.isProgrammaticPop) {
        this.isProgrammaticPop = false;
        return;
      }

      // Hardware/browser back button or mobile swipe gesture was triggered
      if (this.stack.length > 0) {
        const topLayer = this.stack.pop();
        if (topLayer && typeof topLayer.close === "function") {
          try {
            topLayer.close();
          } catch (err) {
            console.error("[backStack] Error executing close handler for layer:", topLayer.id, err);
          }
        }
      }
    });
  }

  /**
   * Pushes a layer onto the back stack and pushes a history entry to window.history.
   * If a layer with the same id is already at the top of the stack, updates its close callback without pushing a duplicate history entry.
   * @param {string} id Unique identifier for the layer (e.g. "chat", "borrow", "modal_auth")
   * @param {Function} closeFn Callback to execute when user presses back
   */
  push(id, closeFn) {
    if (typeof window === "undefined") return;
    this.setupListener();

    const top = this.stack[this.stack.length - 1];
    if (top && top.id === id) {
      top.close = closeFn;
      return;
    }

    // Push layer to internal stack
    this.stack.push({ id, close: closeFn });

    // Push entry to browser history
    try {
      window.history.pushState({ mohallaBackLayer: id, timestamp: Date.now() }, "");
    } catch (err) {
      console.error("[backStack] Failed to pushState for layer:", id, err);
    }
  }

  /**
   * Closes a layer programmatically (e.g. user clicked an on-screen close button or 'X').
   * Immediately runs the close action for instant UI response and calls window.history.back()
   * so browser history stays balanced.
   * @param {string} id Unique identifier of the layer
   * @param {Function} [fallbackClose] Optional fallback if layer wasn't found in stack
   */
  pop(id, fallbackClose) {
    if (typeof window === "undefined") {
      if (fallbackClose) fallbackClose();
      return;
    }

    this.setupListener();

    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      const [layer] = this.stack.splice(index, 1);

      // Execute close handler immediately for responsive UI
      if (layer && typeof layer.close === "function") {
        try {
          layer.close();
        } catch (err) {
          console.error("[backStack] Error closing layer on pop:", id, err);
        }
      }

      // Pop the browser history entry so future back presses don't encounter a zombie entry
      this.isProgrammaticPop = true;
      try {
        window.history.back();
      } catch (err) {
        this.isProgrammaticPop = false;
      }
    } else {
      if (fallbackClose) fallbackClose();
    }
  }

  /**
   * Silently removes a layer from the stack without executing window.history.back().
   * Used when transitioning/navigating to a new page where history is naturally replaced.
   */
  dismiss(id) {
    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.stack.splice(index, 1);
    }
  }

  /**
   * Checks whether a layer with the given ID is currently on the stack
   */
  has(id) {
    return this.stack.some((item) => item.id === id);
  }

  /**
   * Clears all registered layers from the back stack.
   */
  clear() {
    this.stack = [];
  }

  /**
   * Current depth of the back stack
   */
  depth() {
    return this.stack.length;
  }
}

export const backStack = new BackStackManager();
