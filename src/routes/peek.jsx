import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { LendPage } from "./lend";

export const Route = createFileRoute("/peek")({
  head: () => ({
    meta: [
      { title: "Welcome to the Mohalla Store" },
      {
        name: "description",
        content: "Clean editorial archival collage of community objects in Mohalla Store.",
      },
    ],
  }),
  component: RepositoryOfRemnantsPage,
});

function RepositoryOfRemnantsPage() {
  const [activeItem, setActiveItem] = useState("radio");
  const [isScrolled, setIsScrolled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeNavTab, setActiveNavTab] = useState("explore"); // "explore" | "stories" | "messages" | "profile"
  const [showFlyer, setShowFlyer] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFlyer(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Borrowing Form State inside Glass Panel
  const [borrowingItemKey, setBorrowingItemKey] = useState(null); // null or item key e.g. "radio"
  const [selectedBorrowDates, setSelectedBorrowDates] = useState([8, 9, 10]); // selected day numbers
  const [borrowRequestSent, setBorrowRequestSent] = useState(false);

  // Chat State for Messages Section (Lenders & Chat thread)
  const [selectedLender, setSelectedLender] = useState("aarav");
  const [activeChatId, setActiveChatId] = useState(null); // null = card grid view, "aarav"|"ananya"|"rohan"|"priya" = direct chat screen
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState({
    aarav: {
      name: "Aarav",
      fullName: "Aarav Sharma",
      block: "Block E · 150m away",
      item: "Vintage Orange Transistor Radio",
      role: "Lender",
      status: "Online",
      bgColor: "#f498b5",
      tagline: "Fixes Radios",
      messages: [
        { id: 1, sender: "aarav", text: "Namaste Mahek! Did you get a chance to tune into AIR Vividh Bharati?", time: "10:14 AM" },
        { id: 2, sender: "me", text: "Hey Aarav! Yes, listened to ghazals yesterday. It worked beautifully on the terrace!", time: "10:16 AM" },
        { id: 3, sender: "aarav", text: "That's awesome! Keep it for as long as you need for the weekend tea party.", time: "10:18 AM" }
      ]
    },
    ananya: {
      name: "Ananya",
      fullName: "Ananya Roy",
      block: "Block C · 300m away",
      item: "Leica M6 35mm Camera",
      role: "Lender",
      status: "Active 5m ago",
      bgColor: "#9dbb85",
      tagline: "Lends Cameras",
      messages: [
        { id: 1, sender: "ananya", text: "Hi Mahek! The Leica M6 is ready. I loaded a roll of Kodak Tri-X 400 B&W film in it.", time: "Yesterday, 4:20 PM" },
        { id: 2, sender: "me", text: "Thank you so much Ananya! I'll take great care of it at the street festival tomorrow.", time: "Yesterday, 4:25 PM" },
        { id: 3, sender: "ananya", text: "Enjoy shooting! Remember to use manual focus ring gently.", time: "Yesterday, 4:28 PM" }
      ]
    },
    rohan: {
      name: "Rohan",
      fullName: "Rohan Verma",
      block: "Block B · 80m away",
      item: "Casio Scientific Calculator",
      role: "Lender",
      status: "Online",
      bgColor: "#f5b72b",
      tagline: "Has Casio Calc",
      messages: [
        { id: 1, sender: "rohan", text: "Hey! Left the Casio FX-991EX calculator with Uncle at the main security gate.", time: "2 days ago" },
        { id: 2, sender: "me", text: "Got it Rohan! Just finished my calculus exam prep, returning it by evening.", time: "Yesterday, 11:00 AM" },
        { id: 3, sender: "rohan", text: "No rush at all! Hope the exam goes great 🎯", time: "Yesterday, 11:05 AM" }
      ]
    },
    priya: {
      name: "Priya",
      fullName: "Priya Kapoor",
      block: "Block A · 120m away",
      item: "Giant Jenga & Board Games",
      role: "Lender",
      status: "Nearby",
      bgColor: "#7bc4e2",
      tagline: "Lends Board Games",
      messages: [
        { id: 1, sender: "priya", text: "Hi Mahek! The Jenga set has all 54 wooden blocks packed nicely.", time: "3 days ago" },
        { id: 2, sender: "me", text: "Awesome Priya! We had so much fun playing Jenga on the rooftop last night!", time: "2 days ago" }
      ]
    }
  });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    const activeKey = activeChatId || selectedLender || "aarav";
    const newMsg = {
      id: Date.now(),
      sender: "me",
      text: text,
      time: "Just now"
    };

    setChats((prev) => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        messages: [...prev[activeKey].messages, newMsg]
      }
    }));
    setChatInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const itemTitle = chats[activeKey]?.item || "the item";
      const replies = [
        `Namaste! Got your message regarding ${itemTitle}. Feel free to drop by whenever you're free today!`,
        "Sounds perfect! Thanks for keeping me posted.",
        "Glad to help out a neighbor! Keep it as long as needed for your event.",
        "Got it! Let me know if you need anything else from my archive."
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      const autoReplyMsg = {
        id: Date.now() + 1,
        sender: activeKey,
        text: randomReply,
        time: "Just now"
      };
      setChats((prev) => ({
        ...prev,
        [activeKey]: {
          ...prev[activeKey],
          messages: [...prev[activeKey].messages, autoReplyMsg]
        }
      }));
    }, 1400);
  };

  // Track window scroll to slide up glassmorphed panel
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const itemDetails = {
    radio: {
      id: "E 1009",
      title: "Vintage Orange Transistor Radio",
      code: "1963",
      owner: "Aarav Sharma",
      distance: "150m away",
      category: "Electronics",
      status: "Available Now",
      desc: "A spectrocolorimeter is a form of spectrophotometer that can calculate tristimulus values, or the light intensity of primary color values in a sample.",
      image: "/vintage-radio.png",
    },
    calculator: {
      id: "CASIO-991",
      title: "Pink Casio Scientific Calculator",
      code: "2nd Edition",
      owner: "Riya Verma",
      distance: "220m away",
      category: "Electronics",
      status: "Available Now",
      desc: "High-precision natural display calculation unit borrowed for university exam emergencies and late-night physics problem sets.",
      image: "/casio-calculator.png",
    },
    racket: {
      id: "YONEX-77",
      title: "Vintage Badminton Racket",
      code: "GRAPHITE",
      owner: "Karan Mehta",
      distance: "80m away",
      category: "Outdoor",
      status: "Available Now",
      desc: "Classic tight-strung badminton racket kept in mint condition. Ideal for evening neighborhood matches and terrace games.",
      image: "/badminton-racket.png",
    },
    camera: {
      id: "LEICA-M6",
      title: "Leica M6 Rangefinder Camera",
      code: "1984",
      owner: "Ananya Iyer",
      distance: "300m away",
      category: "Electronics",
      status: "Reserved",
      desc: "Mechanical 35mm film rangefinder preserved by Riya for 3 years. Pristine shutter accuracy and original leatherette finish.",
      image: "/leica-camera.png",
    },
    jenga: {
      id: "JENGA-WOOD",
      title: "Hardwood Jenga Tower Set",
      code: "54 BLOCKS",
      owner: "Vikram Malhotra",
      distance: "190m away",
      category: "Books & Games",
      status: "Available Now",
      desc: "Precision-cut solid hardwood blocks for weekend board game nights and balcony building challenges.",
      image: "/jenga.png",
    },
    sleepingBag: {
      id: "RUMPL-ROLL",
      title: "Rolled Outdoor Camping Blanket",
      code: "SNOW PEAK",
      owner: "Priya Nair",
      distance: "400m away",
      category: "Outdoor",
      status: "Available Now",
      desc: "Insulated weather-resistant rolled outdoor blanket with leather carry straps. Perfect for stargazing trips.",
      image: "/sleeping-bag.png",
    },
    hammer: {
      id: "TOOL-BOX",
      title: "Heavy Duty Claw Steel Hammer",
      code: "CHROME 16OZ",
      owner: "Kabir Singh",
      distance: "120m away",
      category: "Tools",
      status: "Available Now",
      desc: "Forged steel claw hammer with ergonomic rubber grip. Ideal for DIY framing, hanging frames, and repair projects.",
      image: "/hammer.png",
    },
    books: {
      id: "MADELINE-SET",
      title: "Madeline Hardcover Book Collection",
      code: "LUDWIG BEMELMANS",
      owner: "Meera Gupta",
      distance: "350m away",
      category: "Books & Games",
      status: "Available Now",
      desc: "Vintage illustrated children's storybook collection featuring classic artwork and original Paris adventure tales.",
      image: "/books-stack.png",
    },
  };

  const categories = ["All", "Electronics", "Outdoor", "Books & Games", "Tools"];

  const filteredItems = Object.entries(itemDetails).filter(([_, item]) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.owner.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const showPanel = isScrolled || panelOpen;

  return (
    <main className="w-full bg-[#121212] text-[#e0e0e0] font-sans antialiased selection:bg-[#ffff00] selection:text-black relative">
      
      {/* STICKY BACKGROUND HERO FRAME */}
      <div className="sticky top-0 z-10 h-screen w-full flex flex-col justify-between overflow-hidden bg-[#121212] pb-2">
        
        {/* 1. TOP NAVIGATION BAR */}
        <header className="w-full max-w-7xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between border-b border-neutral-800/60 relative z-10">
          {/* Left Brand Title in Hindi */}
          <Link to="/" className="flex items-center gap-3 group">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#f5e6c8] group-hover:text-white transition-colors">
              मोहल्ला स्टोर
            </span>
          </Link>

          {/* Center Navigation Options */}
          <nav className="flex items-center gap-8 text-xs font-medium tracking-wide text-neutral-300">
            <button
              onClick={() => {
                setActiveNavTab("explore");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "explore" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Explore your Mohalla
            </button>
            <button
              onClick={() => {
                setActiveNavTab("stories");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "stories" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Mohalla Stories
            </button>
            <button
              onClick={() => {
                setActiveNavTab("messages");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "messages" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => {
                setActiveNavTab("profile");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                activeNavTab === "profile" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
              }`}
            >
              Profile
            </button>
            <Link
              to="/radar"
              className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
            >
              Mohalla Radar
            </Link>
          </nav>

          {/* Right CTA Button: + Lend Something */}
          <div className="flex items-center gap-4">
            <Link
              to="/lend"
              className="btn-peek-sm"
            >
              + LEND SOMETHING
            </Link>
          </div>
        </header>

        {/* 2. HERO ARCHIVAL HEADER */}
        <section className="w-full max-w-7xl mx-auto px-6 pt-4 pb-2">
          {/* Top Tagline / Breadcrumb Row */}
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-2">
            <div className="flex items-center gap-2 tracking-wider">
              <span>BORROW</span>
              <span>/</span>
              <span>LEND</span>
              <span>/</span>
              <span>CONNECT</span>
              <span>/</span>
              <span className="text-neutral-300 font-semibold">REPEAT</span>
            </div>
          </div>

          {/* Main Serif Display Title */}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl text-[#f5f5f5] tracking-tight font-normal mb-4"
            style={{ fontFamily: "'Playfair Display', 'Cormorant Garamond', serif" }}
          >
            Welcome to the Mohalla Store.
          </h1>

          {/* Two-Column Archival Description Paragraphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-xs text-neutral-400 leading-relaxed font-sans max-w-5xl">
            <div>
              <span className="block font-mono text-[11px] tracking-wider text-neutral-500 uppercase mb-2">
                01 — ABOUT THE MOHALLA
              </span>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                A collection of things, people and little stories from just around the corner. Look around. Something might be waiting for you.
              </p>
            </div>
            <div>
              <span className="block font-mono text-[11px] tracking-wider text-neutral-500 uppercase mb-2">
                02 — HOW IT WORKS
              </span>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Find something you need. Borrow it from someone nearby. Return it when you're done. Maybe lend something of your own.
              </p>
            </div>
          </div>
        </section>

        {/* 3. MAIN CENTRED SHOWCASE COLLAGE */}
        <section className="relative flex-1 w-full max-w-[1350px] mx-auto px-2 sm:px-6 my-2 flex items-center justify-center">

          {/* COLLAGE CONTAINER */}
          <div className="relative w-full max-w-[1200px] h-[520px] sm:h-[580px] flex items-center justify-center">

            {/* SOFT & SUBTLE BLUISH TEAL GLOW BEHIND THE RADIO SHOWCASE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[220px] bg-gradient-to-r from-[#00b4d8]/20 via-[#0d9488]/25 to-[#06b6d4]/20 blur-3xl rounded-full pointer-events-none z-10 opacity-50" />

            {/* LEFT ARCHIVAL PAPERWORK STACK */}
            <div className="absolute left-[6%] sm:left-[10%] top-[6%] z-10 pointer-events-none select-none">
              
              {/* 14 DAY USE Library Slip (Blue Card) */}
              <div className="bg-[#b3d7ec] text-[#1a3547] w-[220px] sm:w-[270px] h-[290px] p-4.5 rounded-sm shadow-xl transform -rotate-6 border border-[#96c1da] flex flex-col justify-between font-mono text-xs">
                <div>
                  <div className="font-bold text-center border-b border-[#7fb3d1] pb-2 mb-3 text-sm tracking-wider">
                    14 DAY USE
                  </div>
                  <div className="text-[10px] text-[#2c4e63] mb-4 uppercase">
                    RETURN TO DESK FROM WHICH BORROWED
                    <br />
                    THE LIBRARY OF THE UNIVERSITY OF CALIFORNIA
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5">
                      <span>JUL 20 RECD</span>
                      <span className="font-bold">LIB-09</span>
                    </div>
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5">
                      <span>MAR 10 RECD</span>
                      <span className="font-bold">MOHALLA</span>
                    </div>
                    <div className="flex justify-between border-b border-[#90b8d0] pb-0.5 text-blue-950 font-semibold">
                      <span>16 NOV RECD</span>
                      <span className="font-bold">STORE</span>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-right text-[#426a83]">
                  FORM 102-A
                </div>
              </div>

              {/* Manila Folder / Library Envelope */}
              <div className="absolute top-[80px] left-[-30px] bg-[#e4d6b6] text-[#332a1d] w-[210px] sm:w-[250px] h-[270px] p-4 rounded-sm shadow-2xl transform -rotate-12 border border-[#c8b792] flex flex-col justify-between font-mono">
                <div>
                  <div className="border-b border-[#b5a37d] pb-2 mb-2">
                    <span className="text-[9px] block uppercase text-[#61523c]">PHYSICAL SCIENCES LIBRARY</span>
                    <span className="text-[11px] font-bold block">Thomas Wilson</span>
                    <span className="text-[10px] text-[#705e45]">16 Nov 1962</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div>T2 01</div>
                    <div>AO</div>
                    <div>43</div>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-full border-2 border-[#8c2a2a] text-[#8c2a2a] flex items-center justify-center p-1 transform rotate-12 opacity-80 self-start">
                  <span className="text-[8px] font-bold text-center leading-none uppercase">
                    UNIVERSITY OF CALIFORNIA
                  </span>
                </div>
              </div>

              {/* Historical Yield Graph Paper Slip */}
              <div className="absolute top-[170px] left-[60px] bg-[#f0e6d2] text-black w-[190px] sm:w-[230px] h-[200px] p-3 rounded-sm shadow-lg transform rotate-3 border border-[#d6c7ab]">
                <div className="text-[9px] font-mono font-bold uppercase mb-1 border-b border-neutral-400 pb-1">
                  HISTORICAL YIELD DATA
                </div>
                <svg className="w-full h-32 text-neutral-700 stroke-current fill-none" viewBox="0 0 100 60">
                  <path d="M 5 50 L 20 40 L 35 45 L 50 20 L 65 30 L 80 10 L 95 15" strokeWidth="1.5" />
                  <line x1="5" y1="55" x2="95" y2="55" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="5" y1="5" x2="5" y2="55" strokeWidth="1" />
                </svg>
                <span className="text-[8px] font-mono text-neutral-600 block text-right">FIG. 209</span>
              </div>

            </div>

            {/* OBJECT 1: MADELINE BOOKS STACK (LEFT) */}
            <div
              onClick={() => {
                setActiveItem("books");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute left-[-6%] sm:left-[-4%] top-[-6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "books" ? "z-40" : ""
              }`}
            >
              <img
                src="/books-stack.png"
                alt="Madeline Books Stack"
                className="w-[240px] sm:w-[320px] md:w-[400px] h-auto object-contain transform -rotate-12 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 2: PINK CASIO CALCULATOR (MID TOP LEFT) */}
            <div
              onClick={() => {
                setActiveItem("calculator");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute left-[16%] sm:left-[22%] top-[6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "calculator" ? "z-40" : ""
              }`}
            >
              <img
                src="/casio-calculator.png"
                alt="Casio Calculator"
                className="w-[160px] sm:w-[210px] md:w-[250px] h-auto object-contain transform -rotate-[14deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 3: BADMINTON RACKET (TILTED 20 DEGREES TOWARDS LEFT FROM BOTTOM) */}
            <div
              onClick={() => {
                setActiveItem("racket");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute left-[6%] sm:left-[12%] top-[18%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "racket" ? "z-40" : ""
              }`}
            >
              <img
                src="/badminton-racket.png"
                alt="Badminton Racket"
                className="w-[260px] sm:w-[340px] md:w-[420px] h-auto object-contain transform -rotate-[20deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 4: STEEL CLAW HAMMER (MOVED LEFT BEHIND RADIO) */}
            <div
              onClick={() => {
                setActiveItem("hammer");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute right-[32%] sm:right-[38%] top-[8%] sm:top-[12%] z-[15] transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "hammer" ? "z-40" : ""
              }`}
            >
              <img
                src="/hammer.png"
                alt="Claw Steel Hammer"
                className="w-[200px] sm:w-[280px] md:w-[340px] h-auto object-contain transform rotate-[25deg] drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 5: CENTERPIECE VINTAGE ORANGE RADIO */}
            <div
              onClick={() => {
                setActiveItem("radio");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`relative z-20 transition-transform duration-300 ease-out cursor-pointer flex items-center justify-center transform hover:scale-105 hover:z-50 ${
                activeItem === "radio" ? "z-40" : ""
              }`}
            >
              <img
                src="/vintage-radio.png"
                alt="Vintage Transistor Radio"
                className="w-[360px] sm:w-[460px] md:w-[520px] h-auto object-contain drop-shadow-[0_15px_25px_rgba(0,180,216,0.2)]"
              />
            </div>

            {/* OBJECT 6: JENGA BLOCK TOWER (TOP RIGHT CLOSER TO RADIO) */}
            <div
              onClick={() => {
                setActiveItem("jenga");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute right-[28%] sm:right-[32%] top-[-2%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "jenga" ? "z-40" : ""
              }`}
            >
              <img
                src="/jenga.png"
                alt="Jenga Tower"
                className="w-[130px] sm:w-[170px] md:w-[210px] h-auto object-contain transform rotate-6 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 7: LEICA CAMERA (UPPER RIGHT) */}
            <div
              onClick={() => {
                setActiveItem("camera");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute right-[-10%] sm:right-[-6%] top-[-16%] sm:top-[-14%] z-40 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "camera" ? "z-40" : ""
              }`}
            >
              <img
                src="/leica-camera.png"
                alt="Leica M6 Camera"
                className="w-[380px] sm:w-[500px] md:w-[620px] h-auto object-contain transform rotate-12 drop-shadow-2xl"
              />
            </div>

            {/* OBJECT 8: ROLLED CAMPING SLEEPING BAG (LOWER RIGHT) */}
            <div
              onClick={() => {
                setActiveItem("sleepingBag");
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`absolute right-[-8%] sm:right-[-4%] bottom-[-10%] sm:bottom-[-6%] z-30 transition-transform duration-300 ease-out cursor-pointer transform hover:scale-106 hover:z-50 ${
                activeItem === "sleepingBag" ? "z-40" : ""
              }`}
            >
              <img
                src="/sleeping-bag.png"
                alt="Rolled Camping Blanket"
                className="w-[420px] sm:w-[560px] md:w-[680px] h-auto object-contain transform -rotate-12 drop-shadow-2xl"
              />
            </div>

          </div>

          {/* BOTTOM SCROLL PROMPT BUTTON */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            <button
              onClick={() => {
                document.getElementById("glass-vault-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-[#1e1e24]/90 hover:bg-[#2a2a32] text-neutral-300 hover:text-white px-5 py-2 rounded-full text-xs font-mono border border-neutral-700/60 backdrop-blur-md shadow-xl flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span>Scroll down to explore Glassmorphic Vault</span>
              <svg
                className="w-3.5 h-3.5 animate-bounce"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

        </section>

      </div>

      {/* 4. OVERLAPPING GLASSMORPHIC PANEL SLIDING FROM BOTTOM ON SCROLL */}
      <section
        id="glass-vault-panel"
        className="relative z-20 w-full min-h-screen bg-[#141418] border-t border-neutral-700/60 rounded-t-[2.5rem] shadow-[0_-30px_100px_rgba(0,0,0,0.95)] p-6 sm:p-10 md:p-12 font-sans -mt-6"
      >
        {/* Screen-Wide Glassmorphic Container Backdrop */}
        <div className="w-full max-w-[1380px] mx-auto flex flex-col gap-6">
            {/* Top Glass Navbar Header inside Panel - STICKY AT TOP */}
            <div className="sticky top-0 z-40 bg-[#141418]/95 backdrop-blur-xl border-b border-neutral-800/80 pb-4 pt-2 flex items-center justify-between -mx-6 sm:-mx-10 md:-mx-12 px-6 sm:px-10 md:px-12 -mt-6 sm:-mt-10 md:-mt-12 rounded-t-[2.5rem]">
              {/* Brand Title */}
              <Link to="/" className="flex items-center gap-3 group">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[#f5e6c8] group-hover:text-white transition-colors">
                  मोहल्ला स्टोर
                </span>
              </Link>

              {/* Navigation Options */}
              <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide text-neutral-300">
                <button
                  onClick={() => setActiveNavTab("explore")}
                  className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                    activeNavTab === "explore" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                  }`}
                >
                  Explore your Mohalla
                </button>
                <button
                  onClick={() => setActiveNavTab("stories")}
                  className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                    activeNavTab === "stories" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                  }`}
                >
                  Mohalla Stories
                </button>
                <button
                  onClick={() => setActiveNavTab("messages")}
                  className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                    activeNavTab === "messages" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                  }`}
                >
                  Messages
                </button>
                <button
                  onClick={() => setActiveNavTab("profile")}
                  className={`hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer ${
                    activeNavTab === "profile" ? "text-[#facc15] font-semibold underline underline-offset-4 decoration-[#facc15]" : ""
                  }`}
                >
                  Profile
                </button>
                <Link
                  to="/radar"
                  className="hover:text-[#facc15] hover:underline hover:underline-offset-4 hover:decoration-[#facc15] transition-all cursor-pointer"
                >
                  Mohalla Radar
                </Link>
              </nav>

              {/* Right Actions: + Lend Something CTA & Close */}
              <div className="flex items-center gap-4">
                <Link
                  to="/lend"
                  className="btn-peek-sm"
                >
                  + LEND SOMETHING
                </Link>

                <button
                  onClick={() => setPanelOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-semibold"
                  title="Close Panel"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TAB CONTENT: LEND FORM, MOHALLA STORIES OR EXPLORE ITEMS */}
            {activeNavTab === "lend" ? (
              <div className="animate-fadeIn">
                <LendPage onBack={() => setActiveNavTab("explore")} />
              </div>
            ) : activeNavTab === "stories" ? (
              <div className="flex flex-col gap-8 py-2 animate-fadeIn">
                {/* MOHALLA STORIES VIEW (MODISK BENTO CARD LAYOUT) */}
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] animate-pulse" />
                      <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                        COMMUNITY ARCHIVE & MEMORIES
                      </span>
                    </div>
                    {/* HEADING IN THE EXACT BRAND TYPOGRAPHY STYLE */}
                    <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
                      कहानी मोहल्ले मोहल्ले की
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-400 max-w-md leading-relaxed text-left sm:text-right">
                    Little stories, cherished memories, and human connections behind every borrowed object in your neighborhood.
                  </p>
                </div>

                {/* MODISK-style Bento Grid of Stories */}
                <div className="flex flex-col gap-10">
                  
                  {/* STORY 1: Aarav & The Vintage Orange Transistor Radio */}
                  <div className="bg-[#0b0b0e] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 flex flex-col lg:flex-row gap-6 shadow-2xl relative overflow-hidden group hover:border-neutral-700 transition-all">
                    
                    {/* Vertical Side Title Axis (MODISK Style) */}
                    <div className="w-14 shrink-0 bg-white/5 border border-neutral-800/80 rounded-2xl hidden md:flex flex-col items-center justify-between p-4">
                      <span className="[writing-mode:vertical-lr] rotate-180 font-black text-2xl tracking-[0.25em] text-[#f5e6c8] uppercase select-none opacity-90">
                        MOHALLA
                      </span>
                      <span className="font-mono text-xs text-[#facc15] font-bold">01</span>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col gap-6">
                      
                      {/* Top White & Dark Bluish Teal Modular Blocks Row */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Upper White Spec Block */}
                        <div className="lg:col-span-7 bg-white text-black p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 shadow-lg">
                          <div>
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-3">
                              HEARD ON THE ROOFTOP DURING 1983 WORLD CUP.
                            </h3>
                            <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                              Passed down from Aarav's grandfather in Block E. Still tuned crisp to AIR Vividh Bharati & evening ghazal broadcasts.
                            </p>
                          </div>

                          {/* Spec Pills Row */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                              E 1009
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                              150M AWAY
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                              AIR TRANSISTOR
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                              SMART TUNE MODE
                            </span>
                          </div>
                        </div>

                        {/* Dark Bluish Teal Accent Block */}
                        <div className="lg:col-span-5 bg-gradient-to-br from-[#0a3038] via-[#09414b] to-[#042028] text-white p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-4 shadow-xl border border-[#0c5360]/50 relative overflow-hidden">
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-mono tracking-wider font-semibold uppercase text-teal-200">
                              Lending Impact
                            </span>
                            <div className="w-8 h-8 rounded-full bg-[#09414b]/60 border border-[#0c5360] flex items-center justify-center text-teal-200 text-sm font-bold">
                              ↗
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-bold uppercase leading-tight mb-4 text-teal-100/90">
                              BUILT FOR THE MOHALLA. TRUSTED IN THE BALCONY. NEVER SITTING IDLE.
                            </p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl sm:text-6xl font-black tracking-tighter text-teal-100">34</span>
                              <span className="text-xl font-bold text-teal-200/80">Lends Total</span>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Bottom Row: Thumbnail Box & Detail Highlights */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        
                        {/* Thumbnail Box */}
                        <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex items-center justify-center shrink-0 min-h-[120px]">
                          <img
                            src="/vintage-radio.png"
                            alt="Vintage Radio"
                            className="max-h-24 object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                          />
                        </div>

                        {/* Detail Info & Bullet Points */}
                        <div className="md:col-span-8 bg-neutral-900/80 border border-neutral-800/90 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <ul className="text-xs text-neutral-300 space-y-1.5 font-sans">
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Lent to Priya for her vintage terrace tea party</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Used by Uncle Sharma to listen to India vs Pak commentary</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Returned with fresh Duracell batteries & handwritten note</span>
                            </li>
                          </ul>

                          <button className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-5 py-2.5 rounded-full shrink-0 transition-all shadow-md cursor-pointer self-start sm:self-auto">
                            READ FULL STORY ↗
                          </button>
                        </div>

                      </div>

                    </div>

                    {/* Right Visual Column (MODISK Claw/Object Box Style) */}
                    <div className="w-full lg:w-72 bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden relative shrink-0 min-h-[320px] flex flex-col justify-between p-6">
                      <div className="flex justify-between items-center z-10">
                        <span className="font-mono text-[10px] text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          FEATURED STORY
                        </span>
                      </div>
                      
                      <div className="my-auto py-6 flex items-center justify-center z-10">
                        <img
                          src="/vintage-radio.png"
                          alt="Radio Visual"
                          className="max-h-48 object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                        />
                      </div>

                      <div className="z-10 border-t border-neutral-800 pt-3">
                        <p className="text-xs font-bold text-white">Aarav Sharma</p>
                        <p className="text-[10px] text-neutral-400 font-mono">Lender in Block E · 150m</p>
                      </div>
                    </div>

                  </div>


                  {/* STORY 2: Ananya & The Leica M6 Camera */}
                  <div className="bg-[#0b0b0e] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 flex flex-col lg:flex-row gap-6 shadow-2xl relative overflow-hidden group hover:border-neutral-700 transition-all">
                    
                    {/* Vertical Side Title Axis (MODISK Style) */}
                    <div className="w-14 shrink-0 bg-white/5 border border-neutral-800/80 rounded-2xl hidden md:flex flex-col items-center justify-between p-4">
                      <span className="[writing-mode:vertical-lr] rotate-180 font-black text-2xl tracking-[0.25em] text-[#f5e6c8] uppercase select-none opacity-90">
                        STORIES
                      </span>
                      <span className="font-mono text-xs text-[#facc15] font-bold">02</span>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col gap-6">
                      
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7 bg-white text-black p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 shadow-lg">
                          <div>
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-3">
                              DOCUMENTING NEIGHBORHOOD SMILES SINCE 1984.
                            </h3>
                            <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                              Mechanical 35mm rangefinder camera preserved by Ananya. Captured Diwali fairs, street dogs, and local tea stall moments.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                              LEICA-M6
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                              300M AWAY
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 border border-black/30 rounded-full">
                              35MM FILM
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 bg-black text-white rounded-full">
                              MANUAL FOCUS
                            </span>
                          </div>
                        </div>

                        {/* Dark Bluish Teal Accent Block */}
                        <div className="lg:col-span-5 bg-gradient-to-br from-[#0a3038] via-[#09414b] to-[#042028] text-white p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-4 shadow-xl border border-[#0c5360]/50 relative overflow-hidden">
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-mono tracking-wider font-semibold uppercase text-teal-200">
                              Community Rolls
                            </span>
                            <div className="w-8 h-8 rounded-full bg-[#09414b]/60 border border-[#0c5360] flex items-center justify-center text-teal-200 text-sm font-bold">
                              ↗
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-bold uppercase leading-tight mb-4 text-teal-100/90">
                              CAPTURED OVER 50 LOCAL WEDDINGS & NEIGHBORHOOD FAIRS.
                            </p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl sm:text-6xl font-black tracking-tighter text-teal-100">50+</span>
                              <span className="text-xl font-bold text-teal-200/80">Rolls Shot</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex items-center justify-center shrink-0 min-h-[120px]">
                          <img
                            src="/leica-camera.png"
                            alt="Leica Camera"
                            className="max-h-24 object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="md:col-span-8 bg-neutral-900/80 border border-neutral-800/90 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <ul className="text-xs text-neutral-300 space-y-1.5 font-sans">
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Borrowed by Rohan for final college photography portfolio</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Traveled to Spiti Valley & returned with zero scratches</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              <span>Includes customized leather strap signed by local creators</span>
                            </li>
                          </ul>

                          <button className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-5 py-2.5 rounded-full shrink-0 transition-all shadow-md cursor-pointer self-start sm:self-auto">
                            READ FULL STORY ↗
                          </button>
                        </div>
                      </div>

                    </div>

                    <div className="w-full lg:w-72 bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden relative shrink-0 min-h-[320px] flex flex-col justify-between p-6">
                      <div className="flex justify-between items-center z-10">
                        <span className="font-mono text-[10px] text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          FEATURED STORY
                        </span>
                      </div>
                      
                      <div className="my-auto py-6 flex items-center justify-center z-10">
                        <img
                          src="/leica-camera.png"
                          alt="Camera Visual"
                          className="max-h-48 object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                        />
                      </div>

                      <div className="z-10 border-t border-neutral-800 pt-3">
                        <p className="text-xs font-bold text-white">Ananya Iyer</p>
                        <p className="text-[10px] text-neutral-400 font-mono">Lender in Block C · 300m</p>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            ) : activeNavTab === "messages" ? (
              /* MOHALLA MESSAGES & CHATTING HUB (GLASS PANEL BECOMES CHAT SECTION ON CARD CLICK) */
              <div className="flex flex-col gap-6 py-2 animate-fadeIn">
                {activeChatId === null ? (
                  /* CARDS OVERVIEW VIEW */
                  <div className="flex flex-col gap-6">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                            DIRECT MOHALLA CONNECT & CHAT
                          </span>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
                          बात-चीत मोहल्ले की
                        </h2>
                      </div>
                      <p className="text-xs text-neutral-400 max-w-md leading-relaxed text-left sm:text-right">
                        Connect directly with lenders and borrowers nearby. Click any card to convert this panel into a direct 2-way chat!
                      </p>
                    </div>

                    {/* LENDERS CARDS GRID (MATCHING USER REFERENCE IMAGE) */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                          NEIGHBORHOOD LENDERS · CLICK ANY CARD TO START CHAT
                        </span>
                        <span className="text-xs text-neutral-500 font-mono hidden sm:block">
                          4 Active Lenders Online
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
                        {Object.entries(chats).map(([key, chat]) => {
                          const glassStyles = "bg-[#222325] border border-[#333436] hover:border-[#444548] shadow-none";

                          return (
                            <div
                              key={key}
                              onClick={() => {
                                setSelectedLender(key);
                                setActiveChatId(key);
                              }}
                              className={`rounded-[2.2rem] p-6 h-[370px] flex flex-col justify-between relative cursor-pointer transition-all duration-200 group overflow-hidden ${glassStyles}`}
                            >

                              {/* Top Bar: Bold Name & 4-Line Burger Icon */}
                              <div className="flex items-center justify-between z-10">
                                <div>
                                  <h3 className="text-3xl font-black tracking-tight text-white font-sans">
                                    {chat.name}
                                  </h3>
                                  <span className="text-[11px] font-mono text-neutral-400 block mt-0.5">
                                    {chat.block}
                                  </span>
                                </div>
                                {/* 4 Parallel Lines Menu Icon */}
                                <div className="flex flex-col gap-1 w-6 bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
                                  <div className="h-[2px] bg-white rounded-full w-full" />
                                  <div className="h-[2px] bg-white rounded-full w-full" />
                                  <div className="h-[2px] bg-white rounded-full w-full" />
                                  <div className="h-[2px] bg-white rounded-full w-full" />
                                </div>
                              </div>

                              {/* Center Whimsical Character Illustration (Matching Reference Image) */}
                              <div className="my-auto py-2 flex items-center justify-center relative z-10">
                                {key === "aarav" && (
                                  /* Pink Card: Character with Bowling Pins */
                                  <svg className="w-40 h-36 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" viewBox="0 0 160 140" fill="none">
                                    <path d="M25 60 C25 50 35 50 35 60 L38 90 C38 98 22 98 22 90 Z" fill="white" stroke="black" strokeWidth="2.5" />
                                    <path d="M27 72 H33" stroke="#e53935" strokeWidth="3" />
                                    <path d="M50 55 C50 45 60 45 60 55 L63 88 C63 96 47 96 47 88 Z" fill="white" stroke="black" strokeWidth="2.5" />
                                    <path d="M52 67 H58" stroke="#e53935" strokeWidth="3" />
                                    <circle cx="115" cy="38" r="14" fill="#fce4ec" stroke="black" strokeWidth="2.5" />
                                    <path d="M105 38 Q115 42 125 38" stroke="black" strokeWidth="2.5" fill="none" />
                                    <path d="M102 30 C102 24 125 24 125 30" fill="black" />
                                    <path d="M100 52 L128 52 L135 95 L118 95 L114 68 L108 95 L92 95 Z" fill="#212121" stroke="black" strokeWidth="2.5" />
                                    <circle cx="95" cy="50" r="14" fill="#42a5f5" stroke="black" strokeWidth="2.5" />
                                    <circle cx="92" cy="48" r="2" fill="black" />
                                    <circle cx="98" cy="48" r="2" fill="black" />
                                  </svg>
                                )}

                                {key === "ananya" && (
                                  /* Green Card: Character dropping bottle into recycling bin */
                                  <svg className="w-40 h-36 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" viewBox="0 0 160 140" fill="none">
                                    <circle cx="28" cy="28" r="14" fill="#fbc02d" stroke="black" strokeWidth="2" />
                                    <path d="M22 26 Q28 32 34 26" stroke="black" strokeWidth="2" fill="none" />
                                    <circle cx="92" cy="32" r="13" fill="#fff3e0" stroke="black" strokeWidth="2.5" />
                                    <path d="M82 24 C82 18 102 18 102 24" fill="black" />
                                    <path d="M85 45 L50 65" stroke="black" strokeWidth="4" strokeLinecap="round" />
                                    <path d="M42 55 L52 75 L45 78 L35 58 Z" fill="#1e88e5" stroke="black" strokeWidth="2" />
                                    <path d="M75 70 L115 70 L108 120 L82 120 Z" fill="white" stroke="black" strokeWidth="2.5" />
                                  </svg>
                                )}

                                {key === "rohan" && (
                                  /* Yellow Card: Character writing with pencil at desk */
                                  <svg className="w-40 h-36 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" viewBox="0 0 160 140" fill="none">
                                    <path d="M20 30 L40 25 L35 45 L15 50 Z" fill="white" stroke="black" strokeWidth="2" />
                                    <path d="M120 20 L145 28 L138 48 L113 40 Z" fill="#90caf9" stroke="black" strokeWidth="2" />
                                    <path d="M20 90 H140 V95 H20 Z" fill="black" />
                                    <path d="M30 95 V125 M130 95 V125" stroke="black" strokeWidth="2.5" />
                                    <circle cx="102" cy="38" r="12" fill="#fff3e0" stroke="black" strokeWidth="2.5" />
                                    <path d="M94 30 C94 24 110 24 110 30" fill="black" />
                                    <path d="M88 50 L118 50 L110 90 L80 90 Z" fill="#212121" stroke="black" strokeWidth="2.5" />
                                    <path d="M68 35 L78 35 L78 85 L68 85 Z" fill="#fb8c00" stroke="black" strokeWidth="2.5" />
                                    <path d="M68 85 L73 95 L78 85 Z" fill="#424242" />
                                  </svg>
                                )}

                                {key === "priya" && (
                                  /* Blue Card: Character reading / carrying books */
                                  <svg className="w-40 h-36 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" viewBox="0 0 160 140" fill="none">
                                    <rect x="25" y="75" width="45" height="12" rx="3" fill="#ef5350" stroke="black" strokeWidth="2" />
                                    <rect x="22" y="87" width="50" height="12" rx="3" fill="#ffee58" stroke="black" strokeWidth="2" />
                                    <rect x="20" y="99" width="55" height="14" rx="3" fill="#26a69a" stroke="black" strokeWidth="2" />
                                    <circle cx="108" cy="36" r="13" fill="#fff3e0" stroke="black" strokeWidth="2.5" />
                                    <path d="M98 28 C98 22 118 22 118 28" fill="black" />
                                    <path d="M96 50 L122 50 L126 95 L92 95 Z" fill="#212121" stroke="black" strokeWidth="2.5" />
                                  </svg>
                                )}
                              </div>

                              {/* Bottom Section: Tagline & Frosted Glass CTA */}
                              <div className="flex flex-col gap-2.5 z-10">
                                <span className="text-sm font-bold text-neutral-200 font-sans leading-tight">
                                  {chat.tagline}
                                </span>
                                
                                <div className="btn-peek-sm w-full flex items-center justify-between mt-1">
                                  <span>OPEN 2-WAY CHAT</span>
                                  <span>➔</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* THE GLASS PANEL BECOMES THE ENTIRE CHAT SECTION ITSELF */
                  <div className="bg-[#0c0d12]/90 border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden animate-fadeIn">
                    
                    {/* Navigation Top Bar: Back to Cards + Active Lender Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setActiveChatId(null)}
                          className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-mono text-xs px-4 py-2.5 rounded-full border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                        >
                          <span>←</span> Back to Lender Cards
                        </button>

                        <div className="flex items-center gap-3">
                          <div
                            style={{ backgroundColor: chats[activeChatId].bgColor }}
                            className="w-12 h-12 rounded-full flex items-center justify-center font-black text-black text-xl shadow-md shrink-0"
                          >
                            {chats[activeChatId].name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-white">
                                {chats[activeChatId].fullName}
                              </h3>
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-xs text-emerald-400 font-mono">
                                {chats[activeChatId].status}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 font-mono mt-0.5">
                              {chats[activeChatId].block} · Borrowing: <span className="text-neutral-200 font-medium">{chats[activeChatId].item}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Lender Switcher Tabs */}
                      <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1.5 rounded-full border border-neutral-800 overflow-x-auto">
                        {Object.keys(chats).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedLender(key);
                              setActiveChatId(key);
                            }}
                            className={`text-xs font-mono px-3.5 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                              activeChatId === key
                                ? "bg-[#09414b] text-white font-bold border border-[#0c5360] shadow-md"
                                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                            }`}
                          >
                            {chats[key].name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message Stream Area */}
                    <div className="flex flex-col gap-4 min-h-[340px] max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                      {chats[activeChatId].messages.map((msg) => {
                        const isMe = msg.sender === "me";
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"} gap-1`}
                          >
                            <div
                              className={`max-w-md p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                isMe
                                  ? "bg-[#09414b] text-white border border-[#0c5360] font-medium rounded-tr-none shadow-md"
                                  : "bg-neutral-800/90 text-neutral-100 rounded-tl-none border border-neutral-700/60"
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[10px] font-mono text-neutral-500 px-1">
                              {msg.time}
                            </span>
                          </div>
                        );
                      })}

                      {/* Real-time Typing Indicator */}
                      {isTyping && (
                        <div className="flex items-center gap-2 text-xs font-mono text-neutral-300 bg-[#09414b]/30 border border-[#0c5360] px-4 py-2 rounded-full w-fit animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>{chats[activeChatId].name} is typing a response...</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Suggestion Chips */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800/80">
                      <button
                        type="button"
                        onClick={() => setChatInput("Is the item available for pick up today?")}
                        className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                      >
                        📍 Ask Pick-up Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatInput("Thank you so much! Returning it safely by evening.")}
                        className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                      >
                        🤝 Confirm Return
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatInput("Can I extend the borrow by 1 more day?")}
                        className="text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 transition-colors cursor-pointer"
                      >
                        ⌛ Request Extension
                      </button>
                    </div>

                    {/* Message Input Form */}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder={`Message ${chats[activeChatId].name} about borrowing ${chats[activeChatId].item}...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-[#0c5360] focus:outline-none rounded-2xl px-5 py-3.5 text-xs sm:text-sm text-white placeholder-neutral-500 font-sans"
                      />
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-[#09414b] via-[#083842] to-[#042028] hover:from-[#0c5360] hover:to-[#09414b] text-teal-100 font-bold text-xs px-6 py-3.5 rounded-2xl border border-[#0c5360] transition-all shadow-lg cursor-pointer shrink-0"
                      >
                        Send ➔
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : activeNavTab === "profile" ? (
              /* MOHALLA MEMBER PROFILE VIEW WITH USER NAME & TRUST IDENTITY CARD */
              <div className="flex flex-col gap-8 py-4 animate-fadeIn">
                {/* Profile Title Header & User Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-neutral-800 pb-6">
                  <div className="flex items-center gap-4">
                    {/* User Avatar Circle */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-pink-500 p-1 shadow-xl shrink-0">
                      <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-white font-black text-2xl">
                        M
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                          MOHALLA MEMBER PROFILE
                        </span>
                      </div>
                      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f5e6c8]">
                        Mahek Aghija
                      </h2>
                      <p className="text-xs text-neutral-400 font-mono mt-1">
                        Block E · Resident & Lender · Trust Level: <span className="text-amber-400 font-semibold">Gold Member 🏅</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-mono text-xs px-4 py-2.5 rounded-full border border-neutral-700 transition-colors cursor-pointer"
                    >
                      ✏️ Edit Profile
                    </button>
                  </div>
                </div>

                {/* 1. ACTIVE LENDS & BORROWS GRID (DISPLAYED FIRST) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="bg-[#222325] border border-[#333436] rounded-3xl p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                        CURRENTLY BORROWED
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">1 Active</span>
                    </div>
                    <div className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-white">Vintage Transistor Radio</h4>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">Lender: Aarav Sharma (Block E)</p>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono px-3 py-1 rounded-full">
                        Due in 2 days
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#222325] border border-[#333436] rounded-3xl p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-neutral-400 uppercase tracking-wider font-medium">
                        MY ACTIVE LENDS
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">1 Active</span>
                    </div>
                    <div className="bg-[#191a1c] p-4 rounded-2xl border border-[#2d2e30] flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-white">Casio Scientific Calculator</h4>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">Borrower: Rohan Verma (Block B)</p>
                      </div>
                      <span className="bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs font-mono px-3 py-1 rounded-full">
                        Active Borrow
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. COMMUNITY TRUST IDENTITY SECTION (DISPLAYED BELOW BORROWS/LENDS) */}
                <div className="flex flex-col gap-3">
                  <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest font-medium px-1">
                    COMMUNITY TRUST IDENTITY
                  </span>

                  {/* TRUST IDENTITY CARD (GLASS MORPHED DARK THEME MATCHING APP DESIGN) */}
                  <div className="bg-[#222325] rounded-3xl p-6 sm:p-8 border border-[#333436] flex flex-col gap-6 text-white backdrop-blur-2xl relative overflow-hidden">
                    
                    {/* Header Row: Shield Icon + Title & Verified Resident Badge */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* Shield Icon */}
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M9 12l2 2 4-4" />
                          </svg>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                          Mohalla Trust Identity
                        </h3>
                      </div>

                      {/* Verified Resident Badge */}
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm shrink-0 backdrop-blur-md">
                        <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>Verified Resident</span>
                      </div>
                    </div>

                    {/* Inner Stats Card Grid (3 Columns) */}
                    <div className="bg-[#191a1c] border border-[#2d2e30] rounded-2xl p-6 sm:p-7 grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-neutral-800/90 backdrop-blur-xl">
                      
                      {/* Stat 1: On-Time Returns */}
                      <div className="flex flex-col items-center justify-center pt-2 md:pt-0">
                        <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                          96%
                        </span>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>On-Time Returns</span>
                        </div>
                      </div>

                      {/* Stat 2: Exchanges */}
                      <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
                        <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                          8
                        </span>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          <span>Exchanges</span>
                        </div>
                      </div>

                      {/* Stat 3: Member Since */}
                      <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
                        <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
                          2025
                        </span>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-neutral-400 mt-2">
                          <span>Member Since</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : borrowingItemKey && itemDetails[borrowingItemKey] ? (
              /* BORROWING FORM VIEW INSIDE THE GLASSMORPHED PANEL */
              <div className="flex flex-col gap-6 py-2 animate-fadeIn">
                {/* Top Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setBorrowingItemKey(null);
                        setBorrowRequestSent(false);
                      }}
                      className="btn-peek-sm"
                    >
                      ← BACK TO STORE ITEMS
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono text-[11px] text-neutral-400 uppercase tracking-widest">
                          DIRECT MOHALLA BORROWING
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#f5e6c8]">
                        Borrowing Request Form
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full w-fit">
                    <span>✓ 100% Free Neighborhood Sharing</span>
                  </div>
                </div>

                {borrowRequestSent ? (
                  /* SUCCESS STATE UPON SENDING BORROW REQUEST */
                  <div className="py-14 flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-4xl shadow-xl animate-bounce">
                      ✓
                    </div>
                    <h3 className="text-3xl font-bold text-white">Borrow Request Sent!</h3>
                    <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
                      Your request for <span className="text-teal-200 font-semibold">{itemDetails[borrowingItemKey].title}</span> has been sent to <span className="text-white font-semibold">{itemDetails[borrowingItemKey].owner}</span>. They will reply directly in your Messages tab!
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBorrowingItemKey(null);
                          setBorrowRequestSent(false);
                          setActiveNavTab("messages");
                        }}
                        className="btn-peek-sm"
                      >
                        GO TO MESSAGES →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBorrowingItemKey(null);
                          setBorrowRequestSent(false);
                        }}
                        className="btn-peek-sm"
                      >
                        KEEP BROWSING
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MAIN 2-COLUMN BORROWING FORM LAYOUT */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT COLUMN: ITEM IMAGE SPOTLIGHT */}
                    <div className="lg:col-span-5 flex flex-col gap-4 h-full">
                      <div className="bg-neutral-900/90 border border-neutral-800 rounded-[2.5rem] p-8 flex flex-col justify-between items-center relative overflow-hidden backdrop-blur-2xl shadow-2xl h-full min-h-[560px] lg:min-h-[620px]">
                        
                        {/* Top Bar inside Left Card */}
                        <div className="w-full flex items-center justify-between z-10">
                          <span className="font-mono text-xs text-teal-200 uppercase tracking-widest bg-[#09414b]/30 px-3 py-1 rounded-full border border-[#0c5360]/50">
                            {itemDetails[borrowingItemKey].code}
                          </span>
                          <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                            {itemDetails[borrowingItemKey].status}
                          </span>
                        </div>

                        {/* Center Image */}
                        <div className="my-auto py-8 flex items-center justify-center z-10 w-full">
                          <img
                            src={itemDetails[borrowingItemKey].image}
                            alt={itemDetails[borrowingItemKey].title}
                            className="max-h-80 sm:max-h-96 max-w-full object-contain filter drop-shadow-[0_25px_40px_rgba(0,0,0,0.95)] transform hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Bottom Info inside Left Card */}
                        <div className="w-full bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 flex items-center justify-between z-10">
                          <div>
                            <span className="text-xs text-neutral-400 font-mono block">Lender & Location</span>
                            <span className="text-sm font-bold text-white">{itemDetails[borrowingItemKey].owner}</span>
                          </div>
                          <span className="text-xs font-mono text-teal-200 bg-[#083842] px-3 py-1 rounded-full border border-[#09414b]">
                            {itemDetails[borrowingItemKey].distance}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: NAME, DESCRIPTION & INTERACTIVE DATE PICKER */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                      
                      {/* TOP SECTION: ITEM NAME & DESCRIPTION DETAILS */}
                      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-[2.5rem] p-6 sm:p-7 backdrop-blur-2xl flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider bg-neutral-800 px-3 py-1 rounded-full">
                            {itemDetails[borrowingItemKey].category}
                          </span>
                          <span className="text-[11px] font-mono text-teal-200 bg-[#09414b]/30 px-3 py-1 rounded-full border border-[#0c5360]/50">
                            Lender: {itemDetails[borrowingItemKey].owner}
                          </span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
                          {itemDetails[borrowingItemKey].title}
                        </h3>

                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                          {itemDetails[borrowingItemKey].desc}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800/80">
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            🤝 Verified Neighbor
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            ⚡ Instant Approval
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
                            🛡️ Zero Deposit Required
                          </span>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: INTERACTIVE DATE PICKER CARD */}
                      <div className="relative group">
                        {/* MAIN CARD CONTAINER WITH NOTCHED CUTOUT AT TOP-RIGHT */}
                        <div className="bg-[#121319] border border-neutral-800 rounded-[2.5rem] p-6 sm:p-7 backdrop-blur-2xl flex flex-col gap-5 relative overflow-hidden shadow-2xl">
                          
                          {/* TOP-RIGHT NOTCHED CUTOUT WITH FLOATING (+) BUTTON */}
                          <div className="absolute top-0 right-0 z-20 flex items-center justify-center p-3 bg-[#16161c] rounded-bl-3xl border-b border-l border-neutral-800">
                            <button
                              type="button"
                              title="Add Custom Slot"
                              onClick={() => {
                                if (selectedBorrowDates.length < 5) {
                                  const nextDate = Math.max(...selectedBorrowDates, 5) + 1;
                                  setSelectedBorrowDates([...selectedBorrowDates, nextDate]);
                                }
                              }}
                              className="w-11 h-11 rounded-full bg-[#0c5360] hover:bg-[#09414b] text-teal-100 font-extrabold flex items-center justify-center transition-all cursor-pointer shadow-md text-xl border border-[#146b7a]"
                            >
                              +
                            </button>
                          </div>

                          {/* Header Row: Lender Avatar & Date Selection Subtitle */}
                          <div className="flex items-center gap-4 pr-16 z-10">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0a3038] via-[#09414b] to-[#042028] border border-[#0c5360] flex items-center justify-center font-bold text-teal-100 text-lg shadow-md shrink-0">
                              {itemDetails[borrowingItemKey].owner[0]}
                            </div>
                            <div>
                              <h4 className="text-base sm:text-lg font-bold text-white font-sans">
                                Select Borrowing Dates
                              </h4>
                              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
                                <span>📅 Sep {selectedBorrowDates[0] || 9} - Sep {selectedBorrowDates[selectedBorrowDates.length - 1] || 12}</span>
                                <span className="text-teal-200 font-semibold">({selectedBorrowDates.length} Days)</span>
                              </div>
                            </div>
                          </div>

                          {/* Day Labels Row */}
                          <div className="grid grid-cols-7 text-center font-mono text-xs text-neutral-400 pt-1 z-10">
                            <span>M</span>
                            <span>T</span>
                            <span>W</span>
                            <span>T</span>
                            <span>F</span>
                            <span className="col-span-2 text-neutral-300 font-semibold">Weekend</span>
                          </div>

                          {/* Interactive Date Circles Grid */}
                          <div className="grid grid-cols-7 gap-2.5 items-center justify-items-center z-10">
                            {/* Disabled/Past Date Circles */}
                            <div className="w-10 h-10 rounded-full border border-dashed border-neutral-700/60 flex items-center justify-center text-neutral-600 text-xs font-mono select-none">
                              •
                            </div>
                            <div className="w-10 h-10 rounded-full border border-dashed border-neutral-700/60 flex items-center justify-center text-neutral-600 text-xs font-mono select-none">
                              •
                            </div>

                            {/* Dates 1 to 12 */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((dayNum) => {
                              const isSelected = selectedBorrowDates.includes(dayNum);
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedBorrowDates.length > 1) {
                                        setSelectedBorrowDates(selectedBorrowDates.filter((d) => d !== dayNum));
                                      }
                                    } else {
                                      setSelectedBorrowDates([...selectedBorrowDates, dayNum].sort((a, b) => a - b));
                                    }
                                  }}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center font-sans text-xs transition-all cursor-pointer select-none ${
                                    isSelected
                                      ? "bg-gradient-to-r from-[#09414b] to-[#0c5360] text-teal-100 font-extrabold scale-105 border-2 border-[#146b7a] shadow-md"
                                      : dayNum >= 4 && dayNum <= 5
                                      ? "bg-neutral-800/90 text-neutral-300 font-semibold border border-neutral-700 hover:border-neutral-500"
                                      : "bg-neutral-900 text-white font-medium border border-neutral-800 hover:border-[#0c5360]"
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>

                          {/* Indicator Dots at bottom of calendar card */}
                          <div className="flex items-center justify-center gap-1.5 pt-1 z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0c5360]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                          </div>
                        </div>
                      </div>

                      {/* SEND BORROW REQUEST CTA BUTTON */}
                      <button
                        type="button"
                        onClick={() => setBorrowRequestSent(true)}
                        className="btn-peek w-full"
                      >
                        <span>SEND BORROW REQUEST TO {itemDetails[borrowingItemKey].owner.toUpperCase()}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* EXPLORE MOHALLA ITEMS VAULT (STANDARD VIEW) */
              <>
                {/* Selected Item Spotlight Banner */}
                {activeItem && itemDetails[activeItem] && (
                  <div className="bg-gradient-to-r from-neutral-800/60 via-neutral-900/50 to-neutral-800/60 border border-neutral-700/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-neutral-950/80 rounded-xl p-3 border border-neutral-800 flex items-center justify-center shrink-0">
                        <img
                          src={itemDetails[activeItem].image}
                          alt={itemDetails[activeItem].title}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-mono text-[10px] text-teal-200 bg-[#09414b]/40 px-2 py-0.5 rounded border border-[#0c5360]">
                            {itemDetails[activeItem].id}
                          </span>
                          <span className="text-xs text-neutral-400">{itemDetails[activeItem].owner} ({itemDetails[activeItem].distance})</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{itemDetails[activeItem].title}</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                          {itemDetails[activeItem].desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setBorrowingItemKey(activeItem)}
                        className="btn-peek-sm"
                      >
                        REQUEST TO BORROW
                      </button>
                    </div>
                  </div>
                )}

                {/* PROMINENT SEARCH BAR UNDER SPOTLIGHT BANNER */}
                <div className="w-full relative my-1">
                  <div className="relative flex items-center w-full bg-neutral-900/90 hover:bg-neutral-900/95 border border-neutral-700/70 focus-within:border-[#0c5360] rounded-2xl px-5 py-3.5 transition-all shadow-xl backdrop-blur-xl">
                    {/* Search Icon */}
                    <svg
                      className="w-5 h-5 text-teal-200 shrink-0 mr-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>

                    {/* Input with Meaningful Placeholder */}
                    <input
                      type="text"
                      placeholder="Search for something to borrow in your Mohalla (e.g. 'Leica camera', 'Casio', 'Riya', 'Tools')..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder-neutral-400 focus:outline-none font-sans tracking-wide"
                    />

                    {/* Clear / Shortcut Badge */}
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-md bg-neutral-800 shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : (
                      <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] font-mono text-neutral-400 bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-1 rounded-md">
                        <span>⌘K</span>
                        <span>or</span>
                        <span>Search</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter Tabs / Categories Below Search Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`text-xs font-mono px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                          activeCategory === cat
                            ? "bg-white text-black font-semibold shadow-md"
                            : "bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-mono text-neutral-400 shrink-0 hidden sm:block">
                    Showing {filteredItems.length} items nearby
                  </div>
                </div>

                {/* Grid of Neighborhood Remnants Cards (Screen Wide 4-column layout) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
                  {filteredItems.map(([key, item]) => (
                    <div
                      key={key}
                      onClick={() => setBorrowingItemKey(key)}
                      className={`group relative bg-neutral-900/50 hover:bg-neutral-800/60 border rounded-2xl p-5 flex flex-col justify-between transition-colors duration-200 cursor-pointer ${
                        activeItem === key
                          ? "border-[#0c5360] bg-[#09414b]/20"
                          : "border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      {/* Status Badge */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-3">
                        <span className="text-neutral-500">{item.code}</span>
                        <span className="text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                          {item.status}
                        </span>
                      </div>

                      {/* Item Thumbnail */}
                      <div className="w-full h-36 flex items-center justify-center my-2 p-2">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain transform group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>

                      {/* Info */}
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold text-white group-hover:text-teal-200 transition-colors line-clamp-1">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-neutral-400 mt-1.5">
                          <span>{item.owner}</span>
                          <span className="font-mono text-neutral-500 text-[11px]">{item.distance}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 5. FOOTER INSIDE GLASS PANEL */}
          <footer className="w-full max-w-[1380px] mx-auto pt-10 mt-12 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-mono gap-4 relative z-10">
            <div>
              <span>Mohalla Store © 1975 — 2026. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-neutral-400">
              <a href="#privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-white transition-colors">
                Terms of Borrowing
              </a>
              <Link to="/radar" className="text-white hover:underline">
                Back to Mohalla Radar →
              </Link>
            </div>
          </footer>
        </section>

        {/* 6. 5-SECOND FLYING AD FLYER OVERLAY (MOHALLA RULES) */}
        {showFlyer && (
          <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-all duration-500 animate-fadeIn"
            onClick={() => setShowFlyer(false)}
          >
            <div 
              className="relative max-w-md sm:max-w-lg w-full flex flex-col items-center animate-fly-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Close Cross Button */}
              <button
                type="button"
                onClick={() => setShowFlyer(false)}
                className="absolute -top-4 -right-4 sm:-top-5 sm:-right-5 w-11 h-11 rounded-full bg-[#1b4332] hover:bg-black text-[#f5e6c8] hover:text-white border-2 border-[#f5e6c8] flex items-center justify-center text-xl font-bold transition-all hover:scale-110 cursor-pointer shadow-2xl z-30"
                aria-label="Close Rules Flyer"
                title="Close Flyer"
              >
                ✕
              </button>

              {/* Flying Flyer Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] border-2 border-[#2d6a4f]/60 bg-[#0b2b1d]">
                <img
                  src="/mohalla-rules-flyer.jpg"
                  alt="Mohalla Rules - Tum aye toh aya mujhe yaad"
                  className="w-full max-h-[75vh] object-contain rounded-2xl"
                />
              </div>

              {/* Bottom CTA Button */}
              <button
                type="button"
                onClick={() => setShowFlyer(false)}
                className="btn-peek mt-5 px-8 py-3 text-xs tracking-widest uppercase font-mono shadow-xl bg-[#1b4332] hover:bg-white text-white hover:text-black border border-[#2d6a4f] transition-all cursor-pointer"
              >
                SAMJH GAYA · GOT IT 👍
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }
