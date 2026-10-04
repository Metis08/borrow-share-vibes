import React, { useState, useEffect } from "react";
import { setStoredUser } from "@/lib/auth";

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "register", // "register" (Create Shelf Form) | "login"
  triggerMsg = "",
  onSuccess,
}) {
  const [authMode, setAuthMode] = useState(initialMode); // "register" | "login" | "setup"

  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode || "login");
      setErrorMsg("");
      setSuccessMsg("");
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  // Form states
  const [usernameValue, setUsernameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [shelfNameValue, setShelfNameValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authToken, setAuthToken] = useState("");

  if (!isOpen) return null;

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const u = usernameValue.trim();
    const p = passwordValue;
    const phone = phoneValue.trim();
    const area = areaValue.trim();
    const shelfName = shelfNameValue.trim();

    if (!u || p.length < 3) {
      setErrorMsg("Username and password (min 3 characters) required.");
      return;
    }
    if (!phone || !area || !shelfName) {
      setErrorMsg("All profile fields (phone, area, shelf title) are required to create your shelf.");
      return;
    }

    try {
      // Step 1: Call /api/register (password hashed on backend using bcrypt)
      const res = await fetch("http://localhost:8085/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      if (!res.ok) {
        const text = await res.text();
        setErrorMsg(text || "Registration failed. Username may already be taken.");
        return;
      }

      const regData = await res.json();
      const token = regData.token;
      setAuthToken(token);

      // Step 2: Call /api/setup_profile to activate Mohalla shelf
      const setupRes = await fetch("http://localhost:8085/api/setup_profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone,
          area,
          shelfName,
        }),
      });

      if (!setupRes.ok) {
        const setupText = await setupRes.text();
        setErrorMsg(setupText || "Failed to set up shelf details.");
        return;
      }

      // Successful Create Shelf Flow
      const userSession = { username: u, token };
      setStoredUser(userSession);
      if (onSuccess) onSuccess(userSession);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg("Cannot connect to local Go backend server (port 8085).");
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const u = usernameValue.trim();
    const p = passwordValue;

    if (!u || !p) {
      setErrorMsg("Username and password are required.");
      return;
    }

    try {
      // Call /api/login (verifies password against bcrypt hash)
      const res = await fetch("http://localhost:8085/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      if (!res.ok) {
        const text = await res.text();
        setErrorMsg(text || "Invalid username or password.");
        return;
      }

      const data = await res.json();
      const userSession = { username: data.username, token: data.token };
      setStoredUser(userSession);
      if (onSuccess) onSuccess(userSession);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg("Cannot connect to local Go backend server (port 8085).");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm my-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-9 right-0 text-white/90 hover:text-red-300 transition-colors text-xs font-mono tracking-widest z-50 cursor-pointer px-2 py-1 bg-black/60 rounded border border-white/20"
          aria-label="Close"
        >
          ✕ CLOSE
        </button>

        {/* Top Zigzag Edge */}
        <div className="receipt-edge-top absolute -top-[12px] left-0 right-0" />

        {/* Parchment Receipt Card */}
        <div className="receipt-card max-h-[80vh] sm:max-h-[85vh] overflow-y-auto">
          
          {triggerMsg && (
            <div className="mb-3 text-center text-[11px] font-mono text-amber-900 bg-amber-100/90 border border-amber-300/80 p-2 rounded">
              ⚡ {triggerMsg}
            </div>
          )}

          {authMode === "register" ? (
            <>
              {/* Header: Create Shelf Form */}
              <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                  CREATE SHELF
                </h3>
                <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                  MOHALLA STORE SHELF REGISTRY
                </p>
                <p className="text-[8px] text-neutral-500 mt-0.5">
                  sign up to lend & borrow items
                </p>
              </div>

              {errorMsg && (
                <div className="mt-2 text-center text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3 font-mono">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      username *
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="eg Mahek"
                    value={usernameValue}
                    onChange={(e) => setUsernameValue(e.target.value)}
                    className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      password * (hashed)
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      className="receipt-field pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-0 text-neutral-600 hover:text-neutral-900 transition-colors p-1 cursor-pointer focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      phone number *
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="eg 9876543210"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                  />
                </div>

                <div>
                  <div className="mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      location / area *
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="eg Block E, Sector 4"
                    value={areaValue}
                    onChange={(e) => setAreaValue(e.target.value)}
                    className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                  />
                </div>

                <div>
                  <div className="mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      shelf title *
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="eg Mahek's Corner Shelf"
                    value={shelfNameValue}
                    onChange={(e) => setShelfNameValue(e.target.value)}
                    className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black cursor-pointer font-bold"
                  >
                    Create Shelf & Continue →
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center font-mono border-t border-dashed border-neutral-400 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setSuccessMsg("");
                    setShowPassword(false);
                    setAuthMode("login");
                  }}
                  className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline cursor-pointer"
                >
                  Already have an account? Sign In
                </button>

                {/* Receipt Barcode */}
                <div className="flex justify-center items-center gap-[2px] opacity-75 mt-3">
                  <div className="w-[3px] h-6 bg-neutral-800" />
                  <div className="w-[1px] h-6 bg-neutral-800" />
                  <div className="w-[2px] h-6 bg-neutral-800" />
                  <div className="w-[1.5px] h-6 bg-neutral-800" />
                  <div className="w-[3px] h-6 bg-neutral-800" />
                  <div className="w-[4px] h-6 bg-neutral-800" />
                  <div className="w-[1px] h-6 bg-neutral-800" />
                  <div className="w-[2px] h-6 bg-neutral-800" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Header: Sign In */}
              <div className="text-center font-mono border-b border-dashed border-neutral-400 pb-3">
                <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-800">
                  SIGN IN
                </h3>
                <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-1">
                  MOHALLA STORE TERMINAL
                </p>
                <p className="text-[8px] text-neutral-500 mt-0.5">
                  enter credentials to access lend & borrow
                </p>
              </div>

              {errorMsg && (
                <div className="mt-2 text-center text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4 font-mono">
                <div>
                  <div className="mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      username
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="eg Mahek"
                    value={usernameValue}
                    onChange={(e) => setUsernameValue(e.target.value)}
                    className="receipt-field placeholder:text-neutral-500 placeholder:text-xs"
                  />
                </div>

                <div>
                  <div className="mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-700">
                      password
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      className="receipt-field pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-0 text-neutral-600 hover:text-neutral-900 transition-colors p-1 cursor-pointer focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-neutral-900 text-[#cfbda3] font-mono text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors text-center border-b-2 border-black cursor-pointer font-bold"
                  >
                    Open Shelf & Log In →
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center font-mono border-t border-dashed border-neutral-400 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setSuccessMsg("");
                    setShowPassword(false);
                    setAuthMode("register");
                  }}
                  className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-800 underline cursor-pointer"
                >
                  New user? Create a shelf
                </button>

                {/* Receipt Barcode */}
                <div className="flex justify-center items-center gap-[2px] opacity-75 mt-3">
                  <div className="w-[2px] h-6 bg-neutral-800" />
                  <div className="w-[1px] h-6 bg-neutral-800" />
                  <div className="w-[3px] h-6 bg-neutral-800" />
                  <div className="w-[1px] h-6 bg-neutral-800" />
                  <div className="w-[2px] h-6 bg-neutral-800" />
                  <div className="w-[4px] h-6 bg-neutral-800" />
                  <div className="w-[1px] h-6 bg-neutral-800" />
                  <div className="w-[2px] h-6 bg-neutral-800" />
                </div>
              </div>
            </>
          )}

        </div>

        {/* Bottom Zigzag Edge */}
        <div className="receipt-edge-bottom absolute -bottom-[12px] left-0 right-0" />
      </div>
    </div>
  );
}
