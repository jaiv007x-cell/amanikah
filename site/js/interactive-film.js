/**
 * Amanikah InteractiveHeroFilm + BranchingStoryDialog
 * Progressive enhancement: homepage text/CTAs work without video.
 */
(function () {
  "use strict";

  var by = function (id) { return document.getElementById(id); };
  var hero = by("storyHeroVideo");
  var heroPause = by("storyHeroPause");
  var scene = by("storySceneVideo");
  var scenePause = by("storyScenePause");
  var modal = by("amanikahStory");
  if (!hero || !modal || !scene) return;

  var title = by("storyTitle");
  var desc = by("storyDescription");
  var opts = by("storyOptions");
  var actions = by("storyActions");
  var result = by("storyResult");
  var stepText = by("storyStep");

  var reduced = false;
  var saveData = false;
  try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e1) {}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch (e2) {}

  var movieActor = "/images/film/amanikah-actor.mp4";
  var movieCouple = "/images/film/amanikah-couple.mp4";
  var step = 0;
  var persona = "";
  var priority = "";
  var originalFocus = null;

  var personas = {
    member: {
      label: "I am exploring marriage",
      title: "For a marriage-minded adult",
      sub: "A private start built around your own choices and expectations.",
    },
    family: {
      label: "I am supporting a loved one",
      title: "For a supportive family",
      sub: "Support with care—without taking away either adult’s voice.",
    },
    nri: {
      label: "I live abroad / NRI",
      title: "For an NRI journey",
      sub: "Start with shared expectations across locations, timing and family involvement.",
    },
  };

  var priorities = {
    simple: {
      label: "A simple, meaningful nikah",
      title: "Start with values, not display",
      sub: "Explore your wedding and financial expectations early. #SimpleNikah is a voluntary personal pledge, not a character certificate.",
    },
    trust: {
      label: "Privacy and clear information",
      title: "Make trust specific",
      sub: "Keep private details private. If optional checks are available later, each should state exactly what was reviewed.",
    },
    family: {
      label: "Respectful family involvement",
      title: "Make room for both voices",
      sub: "Invite relatives when you choose and agree how to communicate respectfully before any introduction.",
    },
  };

  function track(name, props) {
    try {
      fetch("/api/amanikah/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: name, props: props || {} }),
        credentials: "same-origin",
        keepalive: true,
      }).catch(function () {});
    } catch (err) {}
    try {
      document.dispatchEvent(new CustomEvent("amanikah:film-stage", { detail: { name: name, props: props || {} } }));
    } catch (err2) {}
  }

  function handleVideo(v, btn, pausedLabel, playingLabel) {
    pausedLabel = pausedLabel || "▶ Play video";
    playingLabel = playingLabel || "❚❚ Pause video";
    if (v.paused) {
      if (v.ended) v.currentTime = 0;
      var p = v.play();
      if (p) {
        p.then(function () {
          btn.textContent = playingLabel;
          btn.setAttribute("aria-pressed", "true");
          btn.setAttribute("aria-label", playingLabel.replace(/^❚❚\s*/, "Pause "));
        }).catch(function () {
          btn.textContent = pausedLabel;
          btn.setAttribute("aria-pressed", "false");
          btn.setAttribute("aria-label", pausedLabel.replace(/^▶\s*/, "Play "));
        });
      }
    } else {
      v.pause();
      btn.textContent = pausedLabel;
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", pausedLabel.replace(/^▶\s*/, "Play "));
    }
  }

  // Silent, 42-second film plays by default at natural speed when visible.
  // User pause, reduced-motion and data-saving preferences always take priority.
  var userPausedHero = false;
  var heroVisible = true;
  var autoAllowed = !reduced && !saveData;
  try { userPausedHero = localStorage.getItem("amanikah.film.pausePref") === "1"; } catch (ePref) {}
  hero.muted = true;
  hero.defaultPlaybackRate = 1;
  hero.playbackRate = 1;
  hero.loop = true;
  // Defer the autoplay decision until reduced-motion and Data Saver are checked.
  hero.autoplay = autoAllowed && !userPausedHero;
  if (!autoAllowed || userPausedHero) {
    hero.autoplay = false;
    hero.removeAttribute("autoplay");
  }

  function syncHeroButton() {
    if (!heroPause) return;
    var playing = !hero.paused;
    heroPause.textContent = playing ? "❚❚ Pause film" : "▶ Play film";
    heroPause.setAttribute("aria-label", playing ? "Pause film" : "Play film");
    heroPause.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  function playHero(automatically) {
    if (automatically && (!autoAllowed || userPausedHero || !heroVisible || document.hidden || !modal.hidden)) return;
    hero.muted = true;
    hero.playbackRate = 1;
    if (hero.ended) hero.currentTime = 0;
    try {
      var promise = hero.play();
      if (promise && promise.then) {
        promise.then(syncHeroButton).catch(syncHeroButton);
      }
    } catch (e) { syncHeroButton(); }
  }

  if (heroPause) {
    heroPause.addEventListener("click", function () {
      if (hero.paused) {
        userPausedHero = false;
        try { localStorage.removeItem("amanikah.film.pausePref"); } catch (err) {}
        playHero(false);
      } else {
        userPausedHero = true;
        try { localStorage.setItem("amanikah.film.pausePref", "1"); } catch (err2) {}
        hero.pause();
      }
      syncHeroButton();
    });
  }
  hero.addEventListener("playing", syncHeroButton);
  hero.addEventListener("pause", syncHeroButton);
  hero.addEventListener("loadedmetadata", function () {
    hero.playbackRate = 1;
    syncHeroButton();
    playHero(true);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) hero.pause();
    else playHero(true);
  });
  if ("IntersectionObserver" in window) {
    var heroObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        heroVisible = entry.isIntersecting && entry.intersectionRatio > 0.05;
        if (heroVisible) playHero(true);
        else hero.pause();
      });
    }, { threshold: [0, 0.05, 0.25] });
    heroObserver.observe(hero);
  } else {
    playHero(true);
  }
  syncHeroButton();

  function setMovie(src) {
    var current = scene.querySelector("source");
    if (!current) return;
    if (current.getAttribute("src") === src) return;
    current.setAttribute("src", src);
    scene.pause();
    scene.load();
    if (scenePause) { scenePause.textContent = "▶ Play video"; scenePause.setAttribute("aria-pressed", "false"); }
  }

  function addOption(label, cb, i) {
    var b = document.createElement("button");
    b.className = "story-option";
    b.type = "button";
    var n = document.createElement("b");
    n.textContent = String(i + 1).padStart(2, "0");
    var txt = document.createElement("span");
    txt.textContent = label;
    b.append(n, txt);
    b.addEventListener("click", cb);
    opts.appendChild(b);
  }

  function clearResultActions() {
    actions.querySelectorAll("a,[data-result]").forEach(function (n) { n.remove(); });
  }

  function render() {
    opts.replaceChildren();
    result.hidden = true;
    by("storyBack").hidden = step === 0;
    clearResultActions();

    if (step === 0) {
      stepText.textContent = "Part 1 of 3 · Your perspective";
      title.textContent = "Where does your story begin?";
      desc.textContent = "Every story deserves space to unfold. Choose your point of view whenever you are ready.";
      setMovie(movieActor);
      Object.keys(personas).forEach(function (k, i) {
        addOption(personas[k].label, function () {
          persona = k;
          step = 1;
          track("film_perspective_chosen", { perspective: k });
          render();
        }, i);
      });
    }

    if (step === 1) {
      stepText.textContent = "Part 2 of 3 · What matters most";
      title.textContent = "What would give you the most confidence?";
      desc.textContent = personas[persona].sub;
      setMovie(movieCouple);
      Object.keys(priorities).forEach(function (k, i) {
        addOption(priorities[k].label, function () {
          priority = k;
          step = 2;
          track("film_priority_chosen", { priority: k, perspective: persona });
          render();
        }, i);
      });
    }

    if (step === 2) {
      stepText.textContent = "Part 3 of 3 · Your next step";
      title.textContent = priorities[priority].title + ".";
      desc.textContent = priorities[priority].sub;
      setMovie(movieCouple);
      result.hidden = false;
      result.textContent =
        personas[persona].title +
        " · " +
        priorities[priority].label +
        ". You choose what to share and when to involve others.";

      var a = document.createElement("a");
      a.className = "story-cta";
      a.href = "/account/register.html?from=film";
      a.textContent = "Create my private profile ↗";
      a.addEventListener("click", function () {
        track("film_cta_clicked", { cta: "register", perspective: persona, priority: priority });
      });
      actions.prepend(a);

      var quiz = document.createElement("a");
      quiz.className = "story-restart";
      quiz.href = "/nikah-readiness/?from=film";
      quiz.dataset.result = "quiz";
      quiz.textContent = "Explore my Nikah priorities";
      quiz.addEventListener("click", function () {
        track("film_cta_clicked", { cta: "quiz", perspective: persona, priority: priority });
        close();
      });
      actions.insertBefore(quiz, by("storyRestart"));
    }
  }

  function open() {
    originalFocus = document.activeElement;
    step = 0;
    persona = "";
    priority = "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    hero.pause();
    scene.muted = true;
    if (scenePause) {
      scenePause.textContent = "▶ Play scene";
      scenePause.setAttribute("aria-pressed", "false");
    }
    render();
    by("storyClose").focus();
    track("film_open", {});
    try { document.dispatchEvent(new CustomEvent("amanikah:film-open")); } catch (e3) {}
  }

  function close() {
    modal.hidden = true;
    scene.pause();
    document.body.style.overflow = "";
    if (originalFocus && originalFocus.focus) originalFocus.focus();
    // Resume silent autoplay only if the visitor hasn't paused it.
    playHero(true);
  }

  document.querySelectorAll("[data-open-film]").forEach(function (n) {
    n.addEventListener("click", open);
  });
  by("storyClose").addEventListener("click", close);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) close();
  });
  by("storyRestart").addEventListener("click", function () {
    step = 0;
    persona = "";
    priority = "";
    render();
  });
  by("storyBack").addEventListener("click", function () {
    step = Math.max(0, step - 1);
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;
    var list = Array.prototype.slice.call(
      modal.querySelectorAll("button:not([hidden]),a[href]")
    ).filter(function (el) {
      return el.offsetParent !== null && !el.disabled;
    });
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });


  // Interactive story clips remain manual, with a replay button.
  scene.loop = false;
  scene.muted = true;
  scene.playbackRate = 1;
  scene.addEventListener("ended", function () {
    if (scenePause) {
      scenePause.textContent = "↺ Replay scene";
      scenePause.setAttribute("aria-label", "Replay scene");
      scenePause.setAttribute("aria-pressed", "false");
    }
  });
  var replay = by("storyReplay");
  if (replay) {
    replay.addEventListener("click", function () {
      scene.currentTime = 0;
      var p = scene.play();
      if (p && p.catch) p.catch(function () {});
      if (scenePause) {
        scenePause.textContent = "❚❚ Pause scene";
        scenePause.setAttribute("aria-label", "Pause scene");
        scenePause.setAttribute("aria-pressed", "true");
      }
    });
  }

  window.AmanikahFilm = { open: open, close: close };
})();
