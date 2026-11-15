(function () {
  "use strict";

  var STORAGE = {
    answers: "amanikah.nikahReadiness.answers",
    profile: "amanikah.nikahReadiness.profile",
    consent: "amanikah.nikahReadiness.shareConsent",
    analytics: "amanikah.analytics"
  };

  var QUESTIONS = [
    {
      id: "timeline",
      theme: "Marriage timeline and intent",
      priority: "Clear timeline and intent",
      prompt: "When do you hope to marry, if you find the right person?",
      help: "There is no right answer. Choose what feels honest for you.",
      options: [
        { id: "year", label: "Within about a year", tags: ["timeline"], wedding: null, family: null, relocate: null, next: "Begin introductions carefully" },
        { id: "ready", label: "When both people are clearly ready", tags: ["readiness"], next: "Take time to know each other" },
        { id: "open", label: "No fixed timeline", tags: ["patience"], next: "Explore without pressure" },
        { id: "unsure", label: "I am still figuring this out", tags: ["reflection"], next: "Clarify what you want first" }
      ]
    },
    {
      id: "wedding",
      theme: "Simple vs elaborate wedding preferences",
      priority: "Wedding style that fits your values",
      prompt: "What kind of celebration feels right for your nikah?",
      help: "This is about preference, not virtue.",
      options: [
        { id: "intimate", label: "An intimate gathering with close family", tags: ["simplicity"], wedding: "Intimate gathering" },
        { id: "moderate", label: "A moderate family celebration", tags: ["balance"], wedding: "Moderate family celebration" },
        { id: "large", label: "A larger celebration", tags: ["celebration"], wedding: "Larger celebration" },
        { id: "flexible", label: "Flexible, if both families agree", tags: ["flexibility"], wedding: "Flexible with family agreement" }
      ]
    },
    {
      id: "finance",
      theme: "Mahr, dowry demands, and financial expectations",
      priority: "Honest financial expectations",
      prompt: "How should money and gifts be handled around the nikah?",
      note: "Mahr is the bride’s right in the nikah contract. It is not dowry, and it is not a payment demanded from her family.",
      options: [
        { id: "no_dowry", label: "No dowry demands; mahr discussed with respect", tags: ["no-dowry", "mahr-respect"], next: "Discuss mahr and finances early" },
        { id: "open_talk", label: "Open discussion of family expectations before commitments", tags: ["transparency"], next: "Name money questions before introductions deepen" },
        { id: "simple_costs", label: "Keep wedding costs modest and shared fairly", tags: ["simplicity", "fairness"] },
        { id: "later", label: "I would rather discuss this later with the right person", tags: ["patience"] }
      ]
    },
    {
      id: "family",
      theme: "Family involvement",
      priority: "Family involvement on clear terms",
      prompt: "How should families take part in an introduction?",
      options: [
        { id: "early", label: "Involved from the early conversations", tags: ["family-close"], family: "Early family involvement" },
        { id: "after", label: "After both people wish to continue", tags: ["couple-first"], family: "After both people wish to continue" },
        { id: "support", label: "Supportive, without deciding for us", tags: ["autonomy"], family: "Supportive without deciding for us" },
        { id: "case", label: "Depends on the situation and the families", tags: ["flexibility"], family: "Case by case" }
      ]
    },
    {
      id: "location",
      theme: "Location and relocation",
      priority: "Clarity about where life may be built",
      prompt: "Where do you hope to build married life?",
      options: [
        { id: "same", label: "Preferably in the same city I live in now", tags: ["stability"], relocate: "Prefer same city" },
        { id: "india", label: "Open to moving within India", tags: ["mobility"], relocate: "Open within India" },
        { id: "abroad", label: "Open to life abroad", tags: ["mobility", "nri"], relocate: "Open to life abroad" },
        { id: "flex", label: "Flexible if both people agree", tags: ["flexibility"], relocate: "Flexible by mutual agreement" }
      ]
    },
    {
      id: "career",
      theme: "Career and educational aspirations",
      priority: "Respect for work and learning goals",
      prompt: "How important is supporting each other’s work or studies?",
      options: [
        { id: "central", label: "Very important — goals should be discussed early", tags: ["ambition", "support"] },
        { id: "balanced", label: "Important, balanced with family life", tags: ["balance"] },
        { id: "home_focus", label: "I hope home life is the clearer focus for a while", tags: ["home"] },
        { id: "discuss", label: "It depends on what we both want", tags: ["flexibility"] }
      ]
    },
    {
      id: "household",
      theme: "Household responsibilities",
      priority: "Fairness at home",
      prompt: "How should everyday household responsibilities be shared?",
      options: [
        { id: "shared", label: "Shared according to capacity and agreement", tags: ["fairness", "partnership"] },
        { id: "roles", label: "With some traditional roles, discussed openly", tags: ["roles", "transparency"] },
        { id: "help", label: "With help from family or paid support if needed", tags: ["support"] },
        { id: "figure", label: "We would figure it out together over time", tags: ["adaptability"] }
      ]
    },
    {
      id: "communication",
      theme: "Communication and conflict resolution",
      priority: "Calm, direct communication",
      prompt: "When disagreement arises, what approach do you prefer?",
      options: [
        { id: "direct", label: "Speak directly and listen without rushing to win", tags: ["communication"] },
        { id: "cool", label: "Take a short pause, then return to the conversation", tags: ["patience", "communication"] },
        { id: "elder", label: "Involve a trusted elder only if we both agree", tags: ["family-support"] },
        { id: "learn", label: "I am still learning what works for me", tags: ["growth"] }
      ]
    },
    {
      id: "faith",
      theme: "Religious lifestyle preferences",
      priority: "Voluntary clarity about religious lifestyle",
      prompt: "Would you like to share anything about religious lifestyle preferences?",
      help: "This question is voluntary. Skipping is completely fine. Answers are never scored as more or less devout.",
      skippable: true,
      options: [
        { id: "practice_together", label: "I hope we grow in practice together, at a shared pace", tags: ["faith-shared"] },
        { id: "personal", label: "Practice is personal; mutual respect matters most", tags: ["faith-respect"] },
        { id: "discuss_later", label: "I prefer to discuss this privately with the right person", tags: ["privacy"] },
        { id: "skip", label: "Skip this question", tags: [], skip: true }
      ]
    },
    {
      id: "introduction",
      theme: "Expectations for the first family introduction",
      priority: "A careful first introduction",
      prompt: "What should a first family introduction include?",
      options: [
        { id: "values", label: "A short conversation about values and intentions", tags: ["clarity"], next: "Plan a values-first introduction" },
        { id: "brief", label: "A brief meeting, then time for both sides to reflect", tags: ["pace"], next: "Keep the first meeting brief" },
        { id: "questions", label: "Room for practical questions without pressure", tags: ["transparency"], next: "Allow practical questions early" },
        { id: "online", label: "A video call first, if distance requires it", tags: ["distance"], next: "Start with a video introduction" }
      ]
    }
  ];

  var DISCUSS = {
    timeline: "What does “ready for marriage” mean to each of you?",
    wedding: "What would make a celebration feel meaningful rather than competitive?",
    finance: "How will mahr, wedding costs, and family gifts be discussed before any commitment?",
    family: "When should parents or a wali join the conversation?",
    location: "Where could you both imagine living in the first two years?",
    career: "Which work or study goals need support after nikah?",
    household: "How will daily responsibilities be decided and revisited?",
    communication: "How will you pause a difficult conversation and return to it?",
    faith: "Which parts of religious life do you want to share, and which stay personal?",
    introduction: "What would make a first family meeting feel respectful for both sides?"
  };

  function track(name, props) {
    var event = { name: name, ts: new Date().toISOString(), props: props || {} };
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE.analytics) || "[]");
      if (!Array.isArray(list)) list = [];
      list.push(event);
      if (list.length > 200) list = list.slice(-200);
      localStorage.setItem(STORAGE.analytics, JSON.stringify(list));
    } catch (err) {}
    try {
      document.dispatchEvent(new CustomEvent("amanikah:analytics", { detail: event }));
    } catch (err2) {}
    // First-party funnel (no private profile text). Marketing beacons stay consent-gated.
    var funnel = { quiz_started: 1, quiz_completed: 1, quiz_to_signup: 1 };
    if (funnel[name]) {
      var safe = {};
      Object.keys(event.props || {}).forEach(function (k) {
        if (["note", "intentions", "message", "profile", "answers", "password"].indexOf(k) === -1) safe[k] = event.props[k];
      });
      try {
        fetch("/api/amanikah/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: name, props: safe }),
          credentials: "same-origin",
          keepalive: true,
        }).catch(function () {});
      } catch (errFunnel) {}
    }
    var endpoint = window.AMANIKAH_ANALYTICS_ENDPOINT;
    var consent = false;
    try { consent = localStorage.getItem("amanikah.analytics.consent") === "1"; } catch (errConsent) {}
    if (consent && endpoint && typeof navigator.sendBeacon === "function") {
      try {
        navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], { type: "application/json" }));
      } catch (err3) {}
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "q-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    var bytes = new TextEncoder().encode(json);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodePayload(raw) {
    if (!raw) return null;
    try {
      var b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64);
      var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      return null;
    }
  }

  function findOption(question, optionId) {
    for (var i = 0; i < question.options.length; i++) {
      if (question.options[i].id === optionId) return question.options[i];
    }
    return null;
  }

  function buildProfile(answers, meta) {
    var tagCount = {};
    var wedding = null;
    var family = null;
    var relocate = null;
    var next = null;
    var strongest = [];
    var discuss = [];

    QUESTIONS.forEach(function (q) {
      var chosen = answers[q.id];
      if (!chosen) return;
      var opt = findOption(q, chosen);
      if (!opt || opt.skip) {
        discuss.push(DISCUSS[q.id]);
        return;
      }
      (opt.tags || []).forEach(function (tag) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
      if (opt.wedding) wedding = opt.wedding;
      if (opt.family) family = opt.family;
      if (opt.relocate) relocate = opt.relocate;
      if (opt.next) next = opt.next;
      strongest.push({ theme: q.theme, priority: q.priority, label: opt.label, weight: (opt.tags || []).length + 1 });
      discuss.push(DISCUSS[q.id]);
    });

    strongest.sort(function (a, b) { return b.weight - a.weight; });
    var top3 = strongest.slice(0, 3).map(function (item) {
      return { priority: item.priority, choice: item.label, theme: item.theme };
    });

    // Prefer distinct discussion prompts: keep first 4 unanswered-tension style by rotating themes with softer choices
    var soft = ["open", "unsure", "later", "case", "flex", "discuss", "figure", "learn", "skip", "discuss_later"];
    var tension = [];
    QUESTIONS.forEach(function (q) {
      var chosen = answers[q.id];
      if (!chosen) return;
      if (soft.indexOf(chosen) !== -1) tension.push(DISCUSS[q.id]);
    });
    var discussion = (tension.length ? tension : discuss).slice(0, 4);

    return {
      v: 1,
      id: (meta && meta.id) || uuid(),
      created: new Date().toISOString(),
      top3: top3,
      wedding: wedding || "Not specified",
      family: family || "Not specified",
      relocate: relocate || "Not specified",
      next: next || "Review your priorities together",
      discussion: discussion,
      tags: tagCount,
      sanitized: true
    };
  }

  function copyText(text, statusEl, button) {
    var done = function () {
      if (statusEl) statusEl.textContent = "Copied.";
      if (!button) return;
      var prev = button.textContent;
      button.textContent = "Copied";
      setTimeout(function () {
        button.textContent = prev;
        if (statusEl) statusEl.textContent = "";
      }, 1400);
    };
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(area);
      if (ok) done();
      else if (statusEl) statusEl.textContent = "Copy was blocked. Select the text manually.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
  }

  function paintCard(canvas, profile) {
    var ctx = canvas.getContext("2d");
    var width = 1200;
    var height = 630;
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#123F35";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#B59A60";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.fillStyle = "#E4D7B8";
    ctx.font = "600 34px Inter, system-ui, sans-serif";
    ctx.fillText("Amanikah", 72, 100);
    ctx.fillStyle = "#B59A60";
    ctx.font = "600 20px Inter, system-ui, sans-serif";
    ctx.fillText("NIKAH PRIORITIES PROFILE", 72, 140);
    ctx.fillStyle = "#F7F3EA";
    ctx.font = "500 42px 'Playfair Display', Georgia, serif";
    var title = "What matters most in the nikah I want";
    ctx.fillText(title, 72, 210);
    var y = 270;
    ctx.font = "500 26px Inter, system-ui, sans-serif";
    (profile.top3 || []).forEach(function (item, index) {
      ctx.fillStyle = "#B59A60";
      ctx.fillText("0" + (index + 1), 72, y);
      ctx.fillStyle = "#F7F3EA";
      ctx.fillText(item.priority, 130, y);
      y += 44;
    });
    ctx.fillStyle = "#E4D7B8";
    ctx.font = "400 20px Inter, system-ui, sans-serif";
    ctx.fillText("Wedding: " + profile.wedding, 72, 470);
    ctx.fillText("Family: " + profile.family, 72, 504);
    ctx.fillText("Relocation: " + profile.relocate, 72, 538);
    ctx.fillStyle = "#B59A60";
    ctx.fillText("Private summary · not a compatibility score · amanikah.com/nikah-readiness", 72, 580);
  }

  function downloadCanvas(canvas, filename) {
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) {
        var a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = filename;
        a.click();
        resolve();
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) return reject(new Error("export failed"));
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
        resolve();
      }, "image/png");
    });
  }

  function profileShareText(profile) {
    var lines = [
      "Amanikah · Nikah Priorities Profile",
      "My strongest priorities:"
    ];
    (profile.top3 || []).forEach(function (item, i) {
      lines.push((i + 1) + ". " + item.priority + " — " + item.choice);
    });
    lines.push("Wedding style: " + profile.wedding);
    lines.push("Family involvement: " + profile.family);
    lines.push("Relocation: " + profile.relocate);
    lines.push("Next step: " + profile.next);
    lines.push("This is a private preference summary, not a prediction of marriage success.");
    lines.push("https://amanikah.com/nikah-readiness/");
    return lines.join("\n");
  }

  function compareProfiles(a, b) {
    var shared = [];
    var unresolved = [];
    var fields = [
      { key: "wedding", label: "Wedding style" },
      { key: "family", label: "Family involvement" },
      { key: "relocate", label: "Relocation" },
      { key: "next", label: "Preferred next step" }
    ];
    fields.forEach(function (field) {
      if (a[field.key] && b[field.key] && a[field.key] === b[field.key]) {
        shared.push(field.label + ": " + a[field.key]);
      } else {
        unresolved.push(field.label + " — discuss: you said “" + (a[field.key] || "—") + "”; they shared “" + (b[field.key] || "—") + "”.");
      }
    });
    var aPriorities = (a.top3 || []).map(function (x) { return x.priority; });
    var bPriorities = (b.top3 || []).map(function (x) { return x.priority; });
    aPriorities.forEach(function (p) {
      if (bPriorities.indexOf(p) !== -1) shared.push("Shared priority: " + p);
    });
    var discuss = [];
    (a.discussion || []).forEach(function (q) {
      if ((b.discussion || []).indexOf(q) !== -1) discuss.push(q);
    });
    if (!discuss.length) discuss = (a.discussion || []).slice(0, 2).concat((b.discussion || []).slice(0, 2));
    return { shared: unique(shared), unresolved: unresolved, discussion: unique(discuss).slice(0, 5) };
  }

  function unique(list) {
    var seen = {};
    return list.filter(function (item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }

  function bindQuiz() {
    var root = document.getElementById("nr-app");
    if (!root) return;

    var state = {
      index: 0,
      answers: {},
      id: uuid(),
      started: false,
      reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    };

    var params = new URLSearchParams(window.location.search);
    var invitePayload = decodePayload(params.get("invite"));
    if (invitePayload && invitePayload.sanitized) {
      track("quiz_referral_opened", { from: invitePayload.id || "unknown" });
      var inviteBanner = document.getElementById("nr-invite-banner");
      if (inviteBanner) {
        inviteBanner.hidden = false;
        inviteBanner.querySelector("[data-invite-note]").textContent =
          "Someone invited you to complete your own Nikah Priorities quiz. Their answers stay private until you both opt into a comparison.";
      }
      try { sessionStorage.setItem("amanikah.nikahReadiness.invite", JSON.stringify(invitePayload)); } catch (err) {}
    }

    var recoveredAnswers = null;
    var recoveredProfile = null;
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE.answers) || "null");
      var savedProfile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (saved && saved.answers && params.get("fresh") !== "1") {
        recoveredAnswers = saved;
        recoveredProfile = savedProfile;
        var recoverEl = document.getElementById("nr-recover");
        if (recoverEl) recoverEl.hidden = false;
      }
    } catch (err2) {}

    var progressFill = document.getElementById("nr-progress-fill");
    var progressText = document.getElementById("nr-progress-text");
    var themeEl = document.getElementById("nr-theme");
    var promptEl = document.getElementById("nr-prompt");
    var helpEl = document.getElementById("nr-help");
    var noteEl = document.getElementById("nr-note");
    var optionsEl = document.getElementById("nr-options");
    var statusEl = document.getElementById("nr-status");
    var canvas = document.getElementById("nr-canvas");
    var live = document.getElementById("nr-live");

    function setStatus(msg) {
      var resultsStatus = document.getElementById("nr-result-status");
      var target = (!document.getElementById("nr-results").hidden && resultsStatus) ? resultsStatus : statusEl;
      if (target) target.textContent = msg || "";
    }

    function announce(msg) {
      if (live) live.textContent = msg;
    }

    function updateProgress() {
      var total = QUESTIONS.length;
      var current = Math.min(state.index + 1, total);
      var pct = Math.round((state.index / total) * 100);
      if (progressFill) {
        progressFill.style.width = (state.started ? Math.max(pct, state.index === 0 ? 8 : pct) : 0) + "%";
        if (state.index >= total) progressFill.style.width = "100%";
      }
      if (progressText) {
        progressText.textContent = state.index >= total ? "Results" : "Question " + current + " of " + total;
      }
    }

    function renderQuestion() {
      document.getElementById("nr-intro").hidden = true;
      document.getElementById("nr-quiz").hidden = false;
      document.getElementById("nr-results").hidden = true;
      var q = QUESTIONS[state.index];
      themeEl.textContent = q.theme;
      promptEl.textContent = q.prompt;
      helpEl.hidden = !q.help;
      helpEl.textContent = q.help || "";
      noteEl.hidden = !q.note;
      noteEl.textContent = q.note || "";
      optionsEl.replaceChildren();
      q.options.forEach(function (opt) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nr-choice";
        btn.textContent = opt.label;
        btn.setAttribute("aria-pressed", state.answers[q.id] === opt.id ? "true" : "false");
        btn.addEventListener("click", function () { selectOption(q, opt); });
        optionsEl.appendChild(btn);
      });
      document.getElementById("nr-back").disabled = state.index === 0;
      updateProgress();
      announce(q.theme + ". " + q.prompt);
      if (!state.reducedMotion) {
        var panel = document.getElementById("nr-question-panel");
        panel.classList.remove("nr-enter");
        void panel.offsetWidth;
        panel.classList.add("nr-enter");
      }
    }

    function selectOption(question, option) {
      state.answers[question.id] = option.id;
      track("quiz_question_completed", { question: question.id, option: option.id, index: state.index });
      try {
        localStorage.setItem(STORAGE.answers, JSON.stringify({ id: state.id, answers: state.answers, updated: new Date().toISOString() }));
      } catch (err) {}
      Array.prototype.forEach.call(optionsEl.querySelectorAll(".nr-choice"), function (btn) {
        btn.setAttribute("aria-pressed", btn.textContent === option.label ? "true" : "false");
      });
      setTimeout(function () { goNext(); }, state.reducedMotion ? 0 : 180);
    }

    function goNext() {
      var q = QUESTIONS[state.index];
      if (!state.answers[q.id]) {
        setStatus("Choose an option to continue, or go back.");
        return;
      }
      setStatus("");
      if (state.index >= QUESTIONS.length - 1) {
        finish();
        return;
      }
      state.index += 1;
      renderQuestion();
    }

    function goBack() {
      if (state.index === 0) return;
      state.index -= 1;
      renderQuestion();
    }

    function finish() {
      var profile = buildProfile(state.answers, { id: state.id });
      try {
        localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
        localStorage.setItem(STORAGE.answers, JSON.stringify({ id: state.id, answers: state.answers, updated: new Date().toISOString() }));
      } catch (err) {
        setStatus("This browser could not save your profile on this device. You can still view and download your card.");
      }
      track("quiz_completed", { id: state.id, top: (profile.top3[0] && profile.top3[0].priority) || "" });
      showResults(profile, true);
    }

    function showResults(profile, animate) {
      document.getElementById("nr-intro").hidden = true;
      document.getElementById("nr-quiz").hidden = true;
      document.getElementById("nr-results").hidden = false;
      state.index = QUESTIONS.length;
      updateProgress();

      var top = document.getElementById("nr-top3");
      top.replaceChildren();
      (profile.top3 || []).forEach(function (item, i) {
        var li = document.createElement("li");
        li.innerHTML = "<strong>" + (i + 1) + ". " + escapeHtml(item.priority) + "</strong><span>" + escapeHtml(item.choice) + "</span>";
        top.appendChild(li);
      });
      document.getElementById("nr-wedding").textContent = profile.wedding;
      document.getElementById("nr-family").textContent = profile.family;
      document.getElementById("nr-relocate").textContent = profile.relocate;
      document.getElementById("nr-nextstep").textContent = profile.next;
      var discuss = document.getElementById("nr-discuss");
      discuss.replaceChildren();
      (profile.discussion || []).forEach(function (q) {
        var li = document.createElement("li");
        li.textContent = q;
        discuss.appendChild(li);
      });

      paintCard(canvas, profile);
      var preview = document.getElementById("nr-card-preview");
      preview.replaceChildren();
      var img = document.createElement("img");
      img.alt = "Nikah Priorities Profile card";
      img.width = 1200;
      img.height = 630;
      img.src = canvas.toDataURL("image/png");
      preview.appendChild(img);

      maybeShowInviteCompare(profile);
      announce("Your Nikah Priorities Profile is ready.");
      if (animate && !state.reducedMotion) {
        document.getElementById("nr-results").classList.add("nr-enter");
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function (ch) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
      });
    }

    function maybeShowInviteCompare(profile) {
      var panel = document.getElementById("nr-compare-invite");
      var invite = null;
      try { invite = JSON.parse(sessionStorage.getItem("amanikah.nikahReadiness.invite") || "null"); } catch (err) { invite = null; }
      if (!invite || !invite.sanitized || invite.id === profile.id) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      var optIn = document.getElementById("nr-compare-optin");
      var run = document.getElementById("nr-run-compare");
      run.onclick = function () {
        if (!optIn.checked) {
          setStatus("Both people must opt in. Tick the box to compare sanitized summaries only.");
          return;
        }
        renderCompare(profile, invite);
      };
    }

    function renderCompare(mine, theirs) {
      var box = document.getElementById("nr-compare-result");
      var result = compareProfiles(mine, theirs);
      box.hidden = false;
      box.innerHTML =
        "<h3>Shared priorities</h3><ul>" + result.shared.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ul>" +
        "<h3>Unresolved questions</h3><ul>" + result.unresolved.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ul>" +
        "<h3>Worth discussing</h3><ul>" + result.discussion.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ul>" +
        "<p class='quiet'>This comparison uses sanitized summaries only. It does not predict marriage success or psychological compatibility.</p>";
      track("quiz_result_shared", { channel: "compare_optin" });
    }

    document.getElementById("nr-start").addEventListener("click", function () {
      state.started = true;
      state.index = 0;
      state.answers = {};
      state.id = uuid();
      track("quiz_started", { id: state.id });
      var recoverEl = document.getElementById("nr-recover");
      if (recoverEl) recoverEl.hidden = true;
      renderQuestion();
    });

    var resumeBtn = document.getElementById("nr-resume");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", function () {
        if (!recoveredAnswers || !recoveredAnswers.answers) return;
        state.answers = recoveredAnswers.answers;
        state.id = recoveredAnswers.id || state.id;
        state.started = true;
        var answered = Object.keys(state.answers).length;
        state.index = Math.min(answered, QUESTIONS.length - 1);
        if (answered >= QUESTIONS.length && recoveredProfile) {
          showResults(recoveredProfile, false);
          return;
        }
        track("quiz_started", { id: state.id, resumed: true });
        renderQuestion();
      });
    }
    var openSavedBtn = document.getElementById("nr-open-saved");
    if (openSavedBtn) {
      openSavedBtn.addEventListener("click", function () {
        if (recoveredProfile) showResults(recoveredProfile, false);
        else if (resumeBtn) resumeBtn.click();
      });
    }

    document.getElementById("nr-back").addEventListener("click", goBack);
    document.getElementById("nr-next").addEventListener("click", goNext);

    document.getElementById("nr-retake").addEventListener("click", function () {
      try {
        localStorage.removeItem(STORAGE.answers);
        localStorage.removeItem(STORAGE.profile);
      } catch (err) {}
      state.answers = {};
      state.index = 0;
      state.id = uuid();
      state.started = true;
      track("quiz_started", { id: state.id, retake: true });
      renderQuestion();
    });

    document.getElementById("nr-download").addEventListener("click", function () {
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (!profile) return;
      paintCard(canvas, profile);
      track("quiz_result_shared", { channel: "download_image" });
      downloadCanvas(canvas, "amanikah-nikah-priorities.png").catch(function () {
        setStatus("Could not export the image in this browser.");
      });
    });

    document.getElementById("nr-copy").addEventListener("click", function () {
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (!profile) return;
      track("quiz_result_shared", { channel: "copy_text" });
      copyText(profileShareText(profile), statusEl, this);
    });

    document.getElementById("nr-wa").addEventListener("click", function () {
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (!profile) return;
      track("quiz_result_shared", { channel: "whatsapp" });
      window.open("https://wa.me/?text=" + encodeURIComponent(profileShareText(profile)), "_blank", "noopener,noreferrer");
    });

    document.getElementById("nr-invite").addEventListener("click", function () {
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (!profile) return;
      var consent = document.getElementById("nr-share-consent");
      if (!consent.checked) {
        setStatus("Tick the privacy box to create an invite. The invite shares a sanitized summary only, not every answer.");
        return;
      }
      try { localStorage.setItem(STORAGE.consent, "1"); } catch (err) {}
      var sanitized = {
        v: 1,
        id: profile.id,
        sanitized: true,
        top3: profile.top3,
        wedding: profile.wedding,
        family: profile.family,
        relocate: profile.relocate,
        next: profile.next,
        discussion: profile.discussion
      };
      var url = window.location.origin + "/nikah-readiness/?invite=" + encodePayload(sanitized);
      track("quiz_result_shared", { channel: "invite_link" });
      copyText(url + "\n\nI finished Amanikah’s Nikah Priorities quiz. You’re invited to complete your own — adults 21+ only. We can compare only if we both opt in.", statusEl, this);
      var out = document.getElementById("nr-invite-link");
      out.hidden = false;
      out.textContent = url;
    });

    document.getElementById("nr-native").addEventListener("click", function () {
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      if (!profile || !navigator.share) {
        setStatus("Native share is not available here. Copy the text or download the image.");
        return;
      }
      track("quiz_result_shared", { channel: "native" });
      navigator.share({ title: "My Nikah Priorities — Amanikah", text: profileShareText(profile) }).catch(function () {
        setStatus("Sharing was cancelled or blocked.");
      });
    });
    if (!navigator.share) document.getElementById("nr-native").hidden = true;

    document.getElementById("nr-to-signup").addEventListener("click", function () {
      var consent = document.getElementById("nr-signup-consent");
      if (!consent.checked) {
        setStatus("Consent is required before your priorities can travel with a signup request on this device.");
        return;
      }
      var profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
      try {
        localStorage.setItem("amanikah.signup.pref.nikahReadiness", JSON.stringify({
          consent: true,
          top3: profile && profile.top3,
          wedding: profile && profile.wedding,
          family: profile && profile.family,
          relocate: profile && profile.relocate,
          next: profile && profile.next
        }));
      } catch (err) {}
      track("quiz_to_signup", { consented: true });
      window.location.href = "/signup.html?from=nikah-readiness";
    });

    document.getElementById("nr-to-paid").addEventListener("click", function () {
      track("quiz_to_paid_service", { target: "contact-proofpass" });
      window.location.href = "/contact.html?topic=introduction";
    });

    // Keyboard + swipe
    document.addEventListener("keydown", function (event) {
      if (document.getElementById("nr-quiz").hidden) return;
      if (event.key === "ArrowRight") { event.preventDefault(); goNext(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); goBack(); }
    });

    var touchStartX = null;
    var panel = document.getElementById("nr-question-panel");
    panel.addEventListener("touchstart", function (event) {
      if (!event.changedTouches || !event.changedTouches[0]) return;
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    panel.addEventListener("touchend", function (event) {
      if (touchStartX == null || !event.changedTouches || !event.changedTouches[0]) return;
      var dx = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 60) return;
      if (dx < 0) goNext();
      else goBack();
    }, { passive: true });
  }

  function enhanceSignup() {
    if (!/signup\.html/.test(window.location.pathname)) return;
    var note = document.getElementById("note");
    try {
      var pref = JSON.parse(localStorage.getItem("amanikah.signup.pref.nikahReadiness") || "null");
      if (!pref || !pref.consent) return;
      if (note && !note.value) {
        var tops = (pref.top3 || []).map(function (t) { return t.priority; }).join("; ");
        note.value = "Nikah Priorities (with consent): " + tops +
          ". Wedding: " + (pref.wedding || "") +
          ". Family: " + (pref.family || "") +
          ". Relocation: " + (pref.relocate || "") + ".";
      }
      var form = document.getElementById("signup");
      if (form && form.parentElement) {
        var banner = document.createElement("div");
        banner.className = "banner ok";
        banner.innerHTML = "<strong>Nikah Priorities loaded with your consent.</strong><p>Your full quiz answers stay on the quiz page. Only this sanitized summary was copied into the request.</p>";
        form.parentElement.insertBefore(banner, form);
      }
      track("quiz_to_signup", { stage: "signup_prefill" });
    } catch (err) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindQuiz();
    enhanceSignup();
  });

  window.AmanikahNikahReadiness = {
    QUESTIONS: QUESTIONS,
    buildProfile: buildProfile,
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    compareProfiles: compareProfiles,
    paintCard: paintCard,
    track: track
  };
})();
