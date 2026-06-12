/**
 * ============================================================
 * Chatbot Widget — widget.js
 * ============================================================
 * USAGE: paste one line into any website's <body>:
 *
 *   <script src="YOUR_KOYEB_URL/static/widget.js"></script>
 *
 * That's it. No frameworks, no dependencies.
 * ============================================================
 */

(function () {
  "use strict";

  // ----------------------------------------------------------
  // ✏️  CONFIG — swap YOUR_KOYEB_URL for your live backend URL
  // ----------------------------------------------------------
  const API_BASE = "YOUR_KOYEB_URL";

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------
  let messageCount   = 0;         // how many messages the user has sent
  let leadCaptured   = false;     // has the lead form been submitted?
  let brandColor     = "#f97316"; // default; overwritten by /config call

  // ----------------------------------------------------------
  // Fetch brand color from backend
  // ----------------------------------------------------------
  fetch(`${API_BASE}/config`)
    .then((r) => r.json())
    .then((cfg) => {
      brandColor = cfg.brand_color || brandColor;
      applyBrandColor(brandColor);
    })
    .catch(() => {/* silently use default */});

  // ----------------------------------------------------------
  // Inject global styles
  // ----------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    #sr-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }

    /* --- Bubble button --- */
    #sr-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--sr-brand, #f97316);
      border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #sr-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.32); }
    #sr-bubble svg { width: 28px; height: 28px; fill: #fff; }

    /* --- Unread badge --- */
    #sr-badge {
      position: absolute; top: 2px; right: 2px;
      background: #ef4444; color: #fff;
      font-size: 11px; font-weight: 700;
      width: 18px; height: 18px; border-radius: 50%;
      display: none; align-items: center; justify-content: center;
    }

    /* --- Chat window --- */
    #sr-window {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      width: 360px; max-height: 560px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex; flex-direction: column;
      overflow: hidden;
      transform: scale(0.85) translateY(20px);
      opacity: 0; pointer-events: none;
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), opacity 0.2s;
    }
    #sr-window.sr-open {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }

    /* --- Header --- */
    #sr-header {
      background: var(--sr-brand, #f97316);
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
      color: #fff;
    }
    #sr-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #sr-header-text h3 { font-size: 15px; font-weight: 700; }
    #sr-header-text p  { font-size: 12px; opacity: 0.85; margin-top: 1px; }
    #sr-close {
      margin-left: auto; background: none; border: none;
      color: #fff; cursor: pointer; font-size: 22px; line-height: 1;
      opacity: 0.85; padding: 0 4px;
    }
    #sr-close:hover { opacity: 1; }

    /* --- Messages area --- */
    #sr-messages {
      flex: 1; overflow-y: auto; padding: 16px 14px;
      display: flex; flex-direction: column; gap: 10px;
      background: #f8f9fb;
    }
    #sr-messages::-webkit-scrollbar { width: 4px; }
    #sr-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

    /* --- Individual bubbles --- */
    .sr-msg {
      max-width: 82%; padding: 10px 13px;
      border-radius: 14px; font-size: 13.5px; line-height: 1.45;
      word-break: break-word; animation: srFadeIn 0.2s ease;
    }
    .sr-msg.bot {
      background: #fff; color: #1f2937;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px; align-self: flex-start;
    }
    .sr-msg.user {
      background: var(--sr-brand, #f97316); color: #fff;
      border-bottom-right-radius: 4px; align-self: flex-end;
    }
    @keyframes srFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* --- Typing indicator --- */
    #sr-typing {
      display: none; align-self: flex-start;
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 14px; border-bottom-left-radius: 4px;
      padding: 10px 14px; gap: 5px; align-items: center;
    }
    #sr-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #9ca3af; display: inline-block;
      animation: srBounce 1.2s infinite ease-in-out;
    }
    #sr-typing span:nth-child(2) { animation-delay: 0.2s; }
    #sr-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes srBounce {
      0%,60%,100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }

    /* --- Forms (lead & booking) --- */
    .sr-form { padding: 14px; background: #fff; border-top: 1px solid #f0f0f0; }
    .sr-form p { font-size: 13px; color: #374151; margin-bottom: 10px; font-weight: 600; }
    .sr-form input {
      width: 100%; padding: 8px 10px; margin-bottom: 8px;
      border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 13px; color: #111;
      transition: border-color 0.15s;
    }
    .sr-form input:focus { outline: none; border-color: var(--sr-brand, #f97316); }
    .sr-form button {
      width: 100%; padding: 9px;
      background: var(--sr-brand, #f97316); color: #fff;
      border: none; border-radius: 8px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity 0.15s;
    }
    .sr-form button:hover { opacity: 0.88; }
    .sr-form .sr-skip {
      background: none; color: #9ca3af;
      font-weight: 400; margin-top: 4px; font-size: 12px;
    }
    .sr-form .sr-skip:hover { color: #6b7280; opacity: 1; }

    /* --- Input bar --- */
    #sr-input-bar {
      display: flex; gap: 8px; padding: 12px 14px;
      border-top: 1px solid #f0f0f0; background: #fff;
    }
    #sr-input {
      flex: 1; padding: 9px 12px;
      border: 1px solid #d1d5db; border-radius: 10px;
      font-size: 13.5px; color: #111; resize: none;
      transition: border-color 0.15s;
    }
    #sr-input:focus { outline: none; border-color: var(--sr-brand, #f97316); }
    #sr-send {
      background: var(--sr-brand, #f97316); color: #fff;
      border: none; border-radius: 10px;
      width: 38px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s; flex-shrink: 0;
    }
    #sr-send:hover { opacity: 0.88; }
    #sr-send svg { width: 18px; height: 18px; fill: #fff; }

    /* --- Responsive --- */
    @media (max-width: 420px) {
      #sr-window {
        width: 100vw; max-height: 80vh;
        bottom: 0; right: 0; border-radius: 16px 16px 0 0;
      }
      #sr-bubble { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ----------------------------------------------------------
  // Build HTML
  // ----------------------------------------------------------
  const container = document.createElement("div");
  container.id = "sr-widget";
  container.innerHTML = `
    <button id="sr-bubble" aria-label="Open chat">
      <div id="sr-badge">1</div>
      <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
    </button>

    <div id="sr-window" role="dialog" aria-label="Chat with us">
      <div id="sr-header">
        <div id="sr-avatar">🏠</div>
        <div id="sr-header-text">
          <h3>Sunshine Realty</h3>
          <p>We typically reply instantly</p>
        </div>
        <button id="sr-close" aria-label="Close chat">×</button>
      </div>

      <div id="sr-messages">
        <div id="sr-typing">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div id="sr-form-slot"></div>

      <div id="sr-input-bar">
        <input id="sr-input" type="text" placeholder="Type a message…" autocomplete="off" aria-label="Your message" />
        <button id="sr-send" aria-label="Send">
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // ----------------------------------------------------------
  // Element references
  // ----------------------------------------------------------
  const bubble   = document.getElementById("sr-bubble");
  const badge    = document.getElementById("sr-badge");
  const chatWin  = document.getElementById("sr-window");
  const messages = document.getElementById("sr-messages");
  const typingEl = document.getElementById("sr-typing");
  const formSlot = document.getElementById("sr-form-slot");
  const inputEl  = document.getElementById("sr-input");
  const sendBtn  = document.getElementById("sr-send");

  // ----------------------------------------------------------
  // Brand colour
  // ----------------------------------------------------------
  function applyBrandColor(color) {
    document.documentElement.style.setProperty("--sr-brand", color);
  }
  applyBrandColor(brandColor);

  // ----------------------------------------------------------
  // Open / close
  // ----------------------------------------------------------
  let isOpen = false;

  function openChat() {
    isOpen = true;
    chatWin.classList.add("sr-open");
    badge.style.display = "none";
    inputEl.focus();
    if (messageCount === 0) {
      addBotMessage("👋 Hi there! I'm your Sunshine Realty assistant. Ask me about our listings, pricing, or book an inspection!");
    }
  }

  function closeChat() {
    isOpen = false;
    chatWin.classList.remove("sr-open");
  }

  bubble.addEventListener("click", () => (isOpen ? closeChat() : openChat()));
  document.getElementById("sr-close").addEventListener("click", closeChat);

  // Show badge after 3s to prompt engagement
  setTimeout(() => { if (!isOpen) badge.style.display = "flex"; }, 3000);

  // ----------------------------------------------------------
  // Messages
  // ----------------------------------------------------------
  function addMessage(text, role) {
    typingEl.style.display = "none";
    const div = document.createElement("div");
    div.className = `sr-msg ${role}`;
    div.textContent = text;
    messages.insertBefore(div, typingEl);
    messages.scrollTop = messages.scrollHeight;
  }

  function addBotMessage(text)  { addMessage(text, "bot");  }
  function addUserMessage(text) { addMessage(text, "user"); }

  function showTyping() {
    typingEl.style.display = "flex";
    messages.scrollTop = messages.scrollHeight;
  }

  // ----------------------------------------------------------
  // Send message to backend
  // ----------------------------------------------------------
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    messageCount++;
    addUserMessage(text);
    showTyping();

    // Check for booking keywords before API call
    maybeShowBookingForm(text);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, message_count: messageCount }),
      });
      const data = await res.json();
      addBotMessage(data.reply);

      // Show lead form after 2nd message (once only)
      if (data.collect_lead && !leadCaptured) {
        showLeadForm(text, data.reply);
      }
    } catch (err) {
      addBotMessage("Sorry, I'm having trouble connecting. Please try again in a moment.");
      console.error("[widget] chat error:", err);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ----------------------------------------------------------
  // Lead capture form
  // ----------------------------------------------------------
  function showLeadForm(lastUserMsg, lastBotReply) {
    formSlot.innerHTML = `
      <div class="sr-form" id="sr-lead-form">
        <p>👤 Mind sharing your details so we can follow up?</p>
        <input type="text"  id="sr-lead-name"  placeholder="Your name"     />
        <input type="email" id="sr-lead-email" placeholder="Email address" />
        <button id="sr-lead-submit">Save my details</button>
        <button class="sr-skip" id="sr-lead-skip">Skip for now</button>
      </div>
    `;

    document.getElementById("sr-lead-submit").addEventListener("click", async () => {
      const name  = document.getElementById("sr-lead-name").value.trim();
      const email = document.getElementById("sr-lead-email").value.trim();
      if (!name || !email) { alert("Please enter both name and email."); return; }

      try {
        await fetch(`${API_BASE}/lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message: lastUserMsg, bot_reply: lastBotReply }),
        });
        leadCaptured = true;
        formSlot.innerHTML = "";
        addBotMessage(`Thanks, ${name}! I've saved your details. Would you like to book an inspection? Just say "book inspection" anytime 🏠`);
      } catch (err) {
        console.error("[widget] lead save error:", err);
        addBotMessage("Couldn't save your details right now, but feel free to keep chatting!");
        formSlot.innerHTML = "";
      }
    });

    document.getElementById("sr-lead-skip").addEventListener("click", () => {
      leadCaptured = true;
      formSlot.innerHTML = "";
    });
  }

  // ----------------------------------------------------------
  // Booking form
  // ----------------------------------------------------------
  function maybeShowBookingForm(text) {
    const lower = text.toLowerCase();
    if (lower.includes("book") || lower.includes("inspection") || lower.includes("schedule")) {
      showBookingForm();
    }
  }

  function showBookingForm() {
    if (document.getElementById("sr-booking-form")) return; // don't stack

    formSlot.innerHTML = `
      <div class="sr-form" id="sr-booking-form">
        <p>📅 Book an Inspection</p>
        <input type="text"  id="sr-book-name"    placeholder="Your full name"        />
        <input type="email" id="sr-book-email"   placeholder="Email address"         />
        <input type="text"  id="sr-book-date"    placeholder="Preferred date & time" />
        <input type="text"  id="sr-book-service" placeholder="Property / service"    />
        <button id="sr-book-submit">Confirm Booking</button>
        <button class="sr-skip" id="sr-book-cancel">Cancel</button>
      </div>
    `;

    document.getElementById("sr-book-submit").addEventListener("click", async () => {
      const name    = document.getElementById("sr-book-name").value.trim();
      const email   = document.getElementById("sr-book-email").value.trim();
      const date    = document.getElementById("sr-book-date").value.trim();
      const service = document.getElementById("sr-book-service").value.trim();

      if (!name || !email || !date || !service) {
        alert("Please fill in all fields to book an inspection.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, date, service }),
        });
        const data = await res.json();
        formSlot.innerHTML = "";
        addBotMessage(data.message || "Booking confirmed! We'll be in touch soon.");
      } catch (err) {
        console.error("[widget] booking error:", err);
        addBotMessage("Couldn't process the booking right now. Please call us on 09059144435.");
        formSlot.innerHTML = "";
      }
    });

    document.getElementById("sr-book-cancel").addEventListener("click", () => {
      formSlot.innerHTML = "";
    });
  }

})();
