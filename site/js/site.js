(function () {
  // First-party landing signal (no private fields). Optional marketing beacons remain consent-gated below.
  try {
    if (!sessionStorage.getItem("amanikah.landing_view")) {
      sessionStorage.setItem("amanikah.landing_view", "1");
      fetch("/api/amanikah/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: "landing_view", props: { path: location.pathname } }),
        credentials: "same-origin",
        keepalive: true,
      }).catch(function () {});
    }
  } catch (errLanding) {}

  (function analyticsConsent() {
    var key = "amanikah.analytics.consent";
    var decided = false;
    try { decided = localStorage.getItem(key) === "1" || localStorage.getItem(key) === "0"; } catch (err) {}
    if (decided || !window.AMANIKAH_ANALYTICS_ENDPOINT) return;
    var bar = document.createElement("div");
    bar.className = "consent-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Analytics consent");
    bar.innerHTML = "<p>Optional analytics help us understand which tools people use. They stay off until you allow them. Local form answers never leave this browser through this banner.</p>" +
      "<div class=\"actions\"><button type=\"button\" class=\"btn btn-emerald\" data-consent=\"1\">Allow analytics</button>" +
      "<button type=\"button\" class=\"btn btn-ghost\" data-consent=\"0\">Keep analytics off</button></div>";
    document.body.appendChild(bar);
    bar.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-consent]");
      if (!btn) return;
      try { localStorage.setItem(key, btn.getAttribute("data-consent")); } catch (err2) {}
      bar.remove();
    });
  })();

  var nav = document.getElementById("nav");
  var menu = document.querySelector(".menu");
  if (menu && nav) {
    menu.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
      menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-open", open);
      if (open) {
        var first = nav.querySelector("a");
        if (first) first.focus();
      }
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-label", "Open menu");
        document.body.classList.remove("nav-open");
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-label", "Open menu");
        document.body.classList.remove("nav-open");
        menu.focus();
      }
    });
  }

  function copyText(text, status, button) {
    var finish = function () {
      if (status) status.textContent = "Copied.";
      if (!button) return;
      var previous = button.textContent;
      button.textContent = "Copied";
      setTimeout(function () {
        button.textContent = previous;
        if (status) status.textContent = "";
      }, 1600);
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
      if (ok) finish();
      else if (status) status.textContent = "Copy was blocked by this browser. Select the text and copy it manually.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(fallback);
    } else fallback();
  }
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var source = document.querySelector(button.getAttribute("data-copy"));
      var status = button.parentElement.querySelector(".status");
      copyText(source ? source.textContent.trim() : "", status, button);
    });
  });

  var pledgeBtn = document.getElementById("pledgeBtn");
  var pledgeCard = document.getElementById("pledgeCard");
  if (pledgeBtn && pledgeCard) {
    pledgeBtn.addEventListener("click", function () {
      pledgeBtn.disabled = true;
      pledgeBtn.textContent = "Pledge taken";
      pledgeCard.hidden = false;
      pledgeCard.classList.add("on");
    });
    var copyPledge = document.getElementById("copyPledge");
    if (copyPledge) {
      copyPledge.addEventListener("click", function () {
        copyText(
          "AMANIKAH · #SimpleNikah\nI choose a simple nikah.\nLooking for a marriage, not a spectacle.\namanikah.com",
          document.getElementById("pledgeStatus"),
          copyPledge
        );
      });
    }
  }

  var questions = [
    { key: "celebration", title: "How should the celebration feel?", options: ["An intimate gathering", "A moderate family celebration", "A large celebration", "We are flexible"] },
    { key: "dowry", title: "What is your position on dowry?", note: "Mahr is the bride’s right in the nikah contract. It is not dowry, and it is not a payment demanded from her family.", options: ["We will not ask for dowry", "We will discuss family expectations openly", "I would rather not answer this yet"] },
    { key: "family", title: "How should family take part?", options: ["With us from the beginning", "After we both wish to continue", "Supportive, without deciding for us"] },
    { key: "home", title: "Where do you hope to live?", options: ["In the same city", "Open to moving", "Open to life abroad", "Flexible"] },
    { key: "timing", title: "When do you hope to marry?", options: ["Within a year", "When the right person is clear", "No fixed time"] },
    { key: "checks", title: "When would a scoped document check be useful?", options: ["Before families meet", "After both people wish to continue", "I do not need one"] }
  ];
  var quizChoices = document.getElementById("quizChoices");
  if (quizChoices) {
    var answers = {};
    var step = 0;
    var quizStep = document.getElementById("quizStep");
    var quizQuestion = document.getElementById("quizQuestion");
    var quizNote = document.getElementById("quizNote");
    var quizBack = document.getElementById("quizBack");
    var quizCard = document.getElementById("quizCard");
    function renderStep() {
      var q = questions[step];
      quizStep.hidden = false;
      quizQuestion.hidden = false;
      quizChoices.hidden = false;
      quizStep.textContent = "Question " + (step + 1) + " of " + questions.length;
      quizQuestion.textContent = q.title;
      quizNote.hidden = !q.note;
      quizNote.textContent = q.note || "";
      quizBack.hidden = step === 0;
      quizChoices.replaceChildren();
      q.options.forEach(function (option) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = option;
        button.setAttribute("aria-pressed", answers[q.key] === option ? "true" : "false");
        button.addEventListener("click", function () {
          answers[q.key] = option;
          if (step < questions.length - 1) {
            step += 1;
            renderStep();
          } else showCard();
        });
        quizChoices.appendChild(button);
      });
    }
    function showCard() {
      ["celebration", "dowry", "family", "home", "timing", "checks"].forEach(function (key) {
        var node = document.getElementById("line-" + key);
        if (node) node.textContent = answers[key] || "";
      });
      quizStep.hidden = true;
      quizQuestion.hidden = true;
      quizNote.hidden = true;
      quizChoices.hidden = true;
      quizBack.hidden = true;
      quizCard.hidden = false;
      quizCard.classList.add("on");
      try { localStorage.setItem("amanikah.quiz", JSON.stringify(answers)); } catch (err) {}
      var list = document.getElementById("briefLines");
      if (list) {
        list.hidden = false;
        list.replaceChildren();
        [["Celebration", answers.celebration], ["Dowry", answers.dowry], ["Family", answers.family], ["Home", answers.home]].forEach(function (pair) {
          var item = document.createElement("li");
          item.textContent = pair[0] + " — " + pair[1];
          list.appendChild(item);
        });
      }
    }
    quizBack.addEventListener("click", function () { if (step > 0) { step -= 1; renderStep(); } });
    document.getElementById("reviseQuiz").addEventListener("click", function () {
      step = 0;
      quizCard.hidden = true;
      quizCard.classList.remove("on");
      renderStep();
    });
    document.getElementById("copyQuiz").addEventListener("click", function () {
      copyText(
        "AMANIKAH · Expectations\nCelebration: " + answers.celebration +
        "\nDowry: " + answers.dowry +
        "\nFamily: " + answers.family +
        "\nHome: " + answers.home +
        "\nTiming: " + answers.timing +
        "\nDocument check: " + answers.checks +
        "\nMahr is the bride’s right. It is not dowry.\namanikah.com",
        document.getElementById("quizStatus"),
        this
      );
    });
    renderStep();
  }

  var voiceBtn = document.getElementById("voiceBtn");
  if (voiceBtn) {
    var voiceStatus = document.getElementById("voiceStatus");
    var voiceTimer = document.getElementById("voiceTimer");
    var voiceAudio = document.getElementById("voiceAudio");
    var recorder, chunks, started, tick;
    function paint(ms) {
      var seconds = Math.min(60, Math.floor(ms / 1000));
      voiceTimer.textContent = "0:" + String(seconds).padStart(2, "0");
    }
    voiceBtn.addEventListener("click", function () {
      if (recorder && recorder.state === "recording") { recorder.stop(); return; }
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
        voiceStatus.textContent = "This browser cannot record audio. You can still copy the private note.";
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        chunks = [];
        var type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
        recorder.ondataavailable = function (event) { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = function () {
          stream.getTracks().forEach(function (track) { track.stop(); });
          clearInterval(tick);
          voiceBtn.textContent = "Record again";
          voiceAudio.src = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
          voiceAudio.hidden = false;
          voiceStatus.textContent = "Your introduction is ready. It stays on this device until you share it.";
        };
        recorder.start();
        started = Date.now();
        voiceBtn.textContent = "Stop";
        voiceStatus.textContent = "Recording.";
        tick = setInterval(function () {
          var elapsed = Date.now() - started;
          paint(elapsed);
          if (elapsed >= 60000) recorder.stop();
        }, 200);
      }).catch(function () {
        voiceStatus.textContent = "The microphone was not available. You can still copy the private note.";
      });
    });
    document.getElementById("copyVoice").addEventListener("click", function () {
      copyText(
        "I would like to share a short voice introduction with you, privately.\nThe question I answered: What kind of home do you want to build, and what will you bring to it?\namanikah.com",
        voiceStatus,
        this
      );
    });
  }

  var copyBrief = document.getElementById("copyBrief");
  if (copyBrief) {
    copyBrief.addEventListener("click", function () {
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem("amanikah.quiz") || "{}"); } catch (err) { saved = {}; }
      var extra = saved.celebration
        ? "\n\nCelebration: " + saved.celebration + "\nDowry: " + saved.dowry + "\nFamily: " + saved.family + "\nHome: " + saved.home
        : "";
      copyText(
        "AMANIKAH · Family brief\nIncluded: only what both people have agreed to show.\nStill open: anything not yet answered stays a question.\nNext step: a short introduction with parents or a wali, if both sides wish it." +
        extra + "\n\nMahr is the bride’s right. It is not dowry.\namanikah.com",
        document.getElementById("briefStatus"),
        copyBrief
      );
    });
  }

  function fieldError(input, message) {
    var err = document.getElementById(input.id + "-err");
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (err) {
      err.hidden = !message;
      err.textContent = message || "";
    }
    return !message;
  }
  function validate(form) {
    var ok = true;
    form.querySelectorAll("input, select, textarea").forEach(function (input) {
      if (input.type === "checkbox") {
        var message = input.required && !input.checked ? "Please confirm this before continuing." : "";
        if (!fieldError(input, message)) ok = false;
        return;
      }
      var value = input.value.trim();
      var message = "";
      if (input.required && !value) message = "This field is required.";
      else if (input.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "Enter a valid email address.";
      else if (input.name === "age" && value && (Number(value) < 21 || Number(value) > 80)) message = "Amanikah is for adults aged 21 to 80.";
      else if (input.minLength && value && value.length < input.minLength) message = "Please write at least " + input.minLength + " characters.";
      if (!fieldError(input, message)) ok = false;
    });
    return ok;
  }
  function readForm(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });
    return data;
  }
  document.querySelectorAll("form[data-store]").forEach(function (form) {
    var key = "amanikah." + form.getAttribute("data-store");
    var success = document.getElementById(form.id + "-success");
    var summary = document.getElementById(form.id + "-summary");
    var status = form.querySelector(".form-status");
    function showSaved(data) {
      form.hidden = true;
      if (success) success.hidden = false;
      if (summary) {
        summary.replaceChildren();
        Object.keys(data).forEach(function (name) {
          if (name === "consent") return;
          var item = document.createElement("li");
          item.textContent = name.replace(/_/g, " ") + ": " + data[name];
          summary.appendChild(item);
        });
      }
    }
    try {
      var existing = localStorage.getItem(key);
      if (existing) showSaved(JSON.parse(existing));
    } catch (err) {}
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validate(form)) {
        if (status) status.textContent = "Please correct the highlighted fields.";
        var first = form.querySelector("[aria-invalid='true']");
        if (first) first.focus();
        return;
      }
      var submit = form.querySelector("[type='submit']");
      if (submit) { submit.disabled = true; submit.textContent = "Saving…"; }
      var data = readForm(form);
      setTimeout(function () {
        try {
          localStorage.setItem(key, JSON.stringify(data));
          showSaved(data);
        } catch (err) {
          if (submit) { submit.disabled = false; submit.textContent = "Save my request"; }
          if (status) status.textContent = "This browser could not store the request on this device.";
        }
      }, 280);
    });
    var edit = document.getElementById(form.id + "-edit");
    if (edit) {
      edit.addEventListener("click", function () {
        try { localStorage.removeItem(key); } catch (err) {}
        if (success) success.hidden = true;
        form.hidden = false;
        var submit = form.querySelector("[type='submit']");
        if (submit) { submit.disabled = false; submit.textContent = form.getAttribute("data-label") || "Save my request"; }
      });
    }
    var copy = document.getElementById(form.id + "-copy");
    if (copy) {
      copy.addEventListener("click", function () {
        var raw = "";
        try { raw = localStorage.getItem(key) || ""; } catch (err) { raw = ""; }
        var data = {};
        try { data = JSON.parse(raw); } catch (err) { data = {}; }
        var lines = Object.keys(data).map(function (name) { return name + ": " + data[name]; });
        copyText(lines.join("\n"), document.getElementById(form.id + "-copy-status"), copy);
      });
    }
  });
})();
