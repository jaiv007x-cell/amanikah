/* Al Wali: visitor-owned, optional guidance. Never store questions or chat history. */
(function () {
  "use strict";
  if (document.getElementById("alWaliOpen") || document.body.hasAttribute("data-no-al-wali")) return;
  var css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "/css/al-wali.css?v=1";
  document.head.appendChild(css);

  var root = document.createElement("aside");
  root.className = "al-wali-root";
  root.setAttribute("aria-label", "Al Wali marriage guide");
  root.innerHTML = [
    '<section id="alWaliPanel" class="al-wali-panel" role="region" aria-label="Al Wali conversation" hidden>',
    ' <header class="al-wali-header">',
    '  <div class="al-wali-symbol" aria-hidden="true">☪</div>',
    '  <div><h2 class="al-wali-title">Al Wali</h2><div class="al-wali-sub">Your gentle Nikah guide · Amanikah</div></div>',
    '  <div class="al-wali-head-actions"><button type="button" id="alWaliClear" class="al-wali-icon" aria-label="Clear this conversation" title="Clear conversation">↺</button>',
    '   <button type="button" id="alWaliClose" class="al-wali-icon" aria-label="Close Al Wali" title="Close">✕</button></div>',
    ' </header>',
    ' <div class="al-wali-body" id="alWaliBody">',
    '  <div class="al-wali-welcome"><strong>Assalamu alaikum.</strong> I can help you prepare for Nikah, reflect on what matters and talk with family. You are always in control. I am a guide, not a human wali or scholar.</div>',
    '  <div id="alWaliQuick" class="al-wali-quick" aria-label="Helpful conversation starters"></div>',
    '  <div id="alWaliLog" role="log" aria-live="polite" aria-relevant="additions text"></div>',
    ' </div>',
    ' <details class="al-wali-progress" id="alWaliProgress">',
    '  <summary id="alWaliProgressTitle">Your gentle journey · 0 of 3 steps</summary>',
    '  <p>Mark the steps you have considered. Saved only in this browser, not your public profile.</p>',
    '  <div class="al-wali-progress-items">',
    '   <label><input type="checkbox" data-aw-step="priorities"> My priorities</label>',
    '   <label><input type="checkbox" data-aw-step="family"> Family conversation</label>',
    '   <label><input type="checkbox" data-aw-step="next"> My next step</label>',
    '  </div>',
    '  <button type="button" class="al-wali-text-button" id="alWaliReset">Reset journey</button>',
    ' </details>',
    ' <div class="al-wali-footer">',
    '  <div class="al-wali-mode"><label><input type="checkbox" id="alWaliConsent" disabled> Ask Groq AI (optional)</label>',
    '   <label for="alWaliLang">Language <select id="alWaliLang"><option value="en">English</option><option value="hi">हिन्दी</option><option value="ur">اردو</option></select></label>',
    '  </div>',
    '  <p class="al-wali-ai-notice" id="alWaliAiNotice">Free guided mode. AI chat is not configured yet. Your questions stay in this tab unless you send them.</p>',
    '  <form id="alWaliForm" class="al-wali-compose">',
    '   <textarea id="alWaliInput" rows="1" maxlength="600" aria-label="Ask Al Wali a question" placeholder="What is important to discuss before Nikah?" required></textarea>',
    '   <button type="submit" class="al-wali-send" id="alWaliSend">Ask</button>',
    '  </form>',
    '  <div class="al-wali-bottom"><span>No account required · No marriage scores</span><button class="al-wali-text-button" id="alWaliPrivacy" type="button">Privacy & safety</button></div>',
    '  <p id="alWaliStatus" class="al-wali-status" role="status" aria-live="polite"></p>',
    ' </div>',
    '</section>',
    '<button type="button" class="al-wali-launch" id="alWaliOpen" aria-controls="alWaliPanel" aria-expanded="false" aria-label="Open Al Wali marriage guide">',
    ' <span class="al-wali-launch-mark" aria-hidden="true">☪</span><span>Ask Al Wali</span>',
    '</button>'
  ].join("");
  document.body.appendChild(root);

  function by(id) { return document.getElementById(id); }
  var panel = by("alWaliPanel"), launch = by("alWaliOpen"), close = by("alWaliClose");
  var body = by("alWaliBody"), log = by("alWaliLog"), input = by("alWaliInput");
  var notice = by("alWaliAiNotice"), lang = by("alWaliLang"), consent = by("alWaliConsent");
  var status = by("alWaliStatus"), send = by("alWaliSend");
  var history = [];
  var aiAvailable = false;
  var busy = false;
  var allowedLinks = ["/nikah-readiness/", "/family-guide/", "/safety.html", "/community/"];
  var starter = {
    en: [
      ["My priorities", "How do I begin thinking about marriage priorities?"],
      ["Involving family", "How can I involve my family without pressure?"],
      ["Mahr", "How can we respectfully discuss mahr?"],
      ["Safety", "What should I do to stay safe?"]
    ],
    hi: [
      ["Meri soch", "Nikah se pehle kin baaton par sochun?"],
      ["Gharwale", "Family ko bina dabav ke kaise shamil karein?"],
      ["Mahr", "Mahr par izzat se kaise baat karein?"],
      ["Hifazat", "Apni safety kaise rakhein?"]
    ],
    ur: [
      ["ترجیحات", "نکاح سے پہلے کن باتوں پر سوچنا چاہیے؟"],
      ["خاندان", "گھر والوں کو بغیر دباؤ کے کیسے شامل کریں؟"],
      ["مہر", "مہر پر عزت سے بات کیسے کریں؟"],
      ["حفاظت", "اپنی حفاظت کا خیال کیسے رکھیں؟"]
    ]
  };
  function openPanel() {
    panel.hidden = false; launch.setAttribute("aria-expanded", "true");
    launch.hidden = true; input.focus();
  }
  function closePanel() {
    panel.hidden = true; launch.hidden = false;
    launch.setAttribute("aria-expanded", "false"); launch.focus();
  }
  launch.addEventListener("click", openPanel);
  close.addEventListener("click", closePanel);
  root.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); closePanel(); }
  });
  var stepStorageKey = "amanikah.alwali.journey.v1";
  function readSteps() {
    try {
      var saved = JSON.parse(localStorage.getItem(stepStorageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (_ignored) { return {}; }
  }
  function updateSteps(save) {
    var done = {};
    root.querySelectorAll("[data-aw-step]").forEach(function(c) { done[c.dataset.awStep] = !!c.checked; });
    by("alWaliProgressTitle").textContent = "Your gentle journey · " + Object.values(done).filter(Boolean).length + " of 3 steps";
    if (save) try { localStorage.setItem(stepStorageKey, JSON.stringify(done)); } catch (_ignored) {}
  }
  var saved = readSteps();
  root.querySelectorAll("[data-aw-step]").forEach(function(c) {
    c.checked = saved[c.dataset.awStep] === true;
    c.addEventListener("change", function() { updateSteps(true); });
  });
  updateSteps(false);
  by("alWaliReset").addEventListener("click", function() {
    root.querySelectorAll("[data-aw-step]").forEach(function(c) { c.checked = false; });
    try { localStorage.removeItem(stepStorageKey); } catch (_ignored) {}
    updateSteps(false);
  });

  function makeLine(from, value) {
    var line = document.createElement("div"), bubble = document.createElement("div");
    line.className = "al-wali-line"; line.dataset.from = from;
    bubble.className = "al-wali-bubble"; bubble.textContent = value;
    bubble.dir = lang.value === "ur" ? "rtl" : "auto";
    line.appendChild(bubble); log.appendChild(line);
    body.scrollTop = body.scrollHeight;
  }
  function makeResource(next) {
    if (!next || allowedLinks.indexOf(next.path) < 0) return;
    var a = document.createElement("a");
    a.className = "al-wali-resource"; a.href = next.path;
    a.textContent = "Explore: " + String(next.label || "A free Amanikah guide") + " ↗";
    log.appendChild(a);
    body.scrollTop = body.scrollHeight;
  }
  function quickChoices() {
    var area = by("alWaliQuick"); area.replaceChildren();
    starter[lang.value].forEach(function(pair) {
      var chip = document.createElement("button");
      chip.type = "button"; chip.className = "al-wali-chip"; chip.textContent = pair[0];
      chip.addEventListener("click", function() { ask(pair[1]); });
      area.appendChild(chip);
    });
  }
  lang.addEventListener("change", function() {
    quickChoices();
    input.dir = lang.value === "ur" ? "rtl" : "auto";
    input.placeholder = lang.value === "ur" ? "نکاح سے پہلے کیا بات کریں؟" :
      lang.value === "hi" ? "निकाह से पहले क्या बात करनी चाहिए?" :
      "What is important to discuss before Nikah?";
  });
  quickChoices();

  function setAiNotice() {
    if (!aiAvailable) {
      consent.disabled = true; consent.checked = false;
      notice.textContent = "Free guided mode is ready. AI chat will become available when the site owner adds the Groq API key.";
    } else if (consent.checked) {
      notice.textContent = "AI is on for this chat. The question and up to six previous messages you send go to Groq; avoid names, phone numbers, documents and private family details. Nothing here is saved to your Amanikah profile.";
    } else {
      notice.textContent = "Free guided mode. Switch on AI only if you want to send your typed question to Groq. Questions are not saved by Amanikah.";
    }
  }
  consent.addEventListener("change", setAiNotice);
  fetch("/api/amanikah/al-wali/status", {credentials:"same-origin",cache:"no-store"})
    .then(function(res) { if(!res.ok) throw new Error("status"); return res.json(); })
    .then(function(data) {
      aiAvailable = Boolean(data.ok && data.aiAvailable);
      consent.disabled = !aiAvailable; setAiNotice();
    }).catch(function() { aiAvailable = false; setAiNotice(); });

  function setBusy(value) {
    busy = value; send.disabled = value;
    send.textContent = value ? "…" : "Ask";
    root.querySelectorAll(".al-wali-chip").forEach(function(c) { c.disabled = value; });
  }
  function ask(value) {
    var question = String(value || "").trim();
    if (busy || question.length < 2 || question.length > 600) {
      if (!busy) status.textContent = "Please write a short question (up to 600 characters).";
      return;
    }
    status.textContent = "";
    makeLine("user", question);
    input.value = ""; setBusy(true);
    var typedHistory = history.slice(-6).map(function(m) {
      return {role:m.role,content:m.content.slice(0,600)};
    });
    fetch("/api/amanikah/al-wali/chat", {
      method:"POST", credentials:"same-origin",
      headers:{"Accept":"application/json","Content-Type":"application/json"},
      body:JSON.stringify({
        question:question, language:lang.value,
        consentToAI:Boolean(aiAvailable && consent.checked), history:typedHistory
      })
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok || !data.ok) throw new Error(data.message || "The guide could not respond.");
        return data;
      });
    }).then(function(data) {
      makeLine("assistant", data.answer);
      makeResource(data.nextStep);
      history.push({role:"user",content:question},{role:"assistant",content:data.answer});
      history = history.slice(-8);
      if (data.notice) status.textContent = data.notice;
    }).catch(function(error) {
      status.textContent = error.message || "Unable to reach the guide. Please try again.";
      makeLine("assistant","You can still try our free Nikah Priorities or Family Guide from the site menu.");
    }).finally(function() { setBusy(false); input.focus(); });
  }
  by("alWaliForm").addEventListener("submit",function(event) {
    event.preventDefault(); ask(input.value);
  });
  input.addEventListener("keydown",function(event) {
    if(event.key==="Enter"&&!event.shiftKey) {
      event.preventDefault(); ask(input.value);
    }
  });
  by("alWaliClear").addEventListener("click",function() {
    log.replaceChildren(); history = []; input.value = ""; status.textContent = "Conversation cleared from this page.";
    input.focus();
  });
  by("alWaliPrivacy").addEventListener("click",function() {
    makeLine("assistant",
      "You control this conversation. I do not read your private profile, audio or documents. Text is only sent to Groq if you enable the optional AI switch. To delete this page's conversation, choose Clear at the top. For safety concerns, use Amanikah's Safety page.");
    makeResource({path:"/safety.html",label:"Safety guidance"});
  });
})();