(function () {
  "use strict";

  var api = window.AmanikahAPI;
  var root = document.getElementById("app");
  var statusTimer;

  var ROUTES = [
    "/register", "/login", "/onboarding", "/dashboard", "/matches",
    "/introductions", "/messages", "/family", "/family-assistant", "/voice", "/verification", "/settings", "/safety"
  ];

  function path() {
    var p = location.pathname.replace(/\/$/, "") || "/";
    if (p === "/app") return "/dashboard";
    return p;
  }

  function go(to) {
    history.pushState({}, "", to);
    render();
  }

  function qs(sel, el) { return (el || document).querySelector(sel); }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function flash(msg, kind) {
    var el = qs("#flash");
    if (!el) return;
    el.hidden = !msg;
    el.className = "banner " + (kind || "");
    el.textContent = msg || "";
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(function () { el.hidden = true; }, 5000);
  }

  function shell(content, active) {
    var mode = api.mode();
    return (
      '<div class="demo-banner"><strong>' + escapeHtml(mode.label) + '</strong> — <span>' + escapeHtml(mode.notice) + '</span></div>' +
      '<header class="app-header"><div class="app-bar">' +
      '<a class="logo" href="/">Amani<span>kah</span></a>' +
      '<button class="menu-btn" type="button" id="menuBtn" aria-label="Open menu">☰</button>' +
      '<nav class="app-nav" id="appNav">' +
      navLink("/dashboard", "Dashboard", active) +
      navLink("/matches", "Matches", active) +
      navLink("/introductions", "Introductions", active) +
      navLink("/messages", "Messages", active) +
      navLink("/voice", "Voice", active) +
      navLink("/family", "Family", active) +
      navLink("/family-assistant", "Assistant", active) +
      navLink("/verification", "Verification", active) +
      navLink("/settings", "Settings", active) +
      navLink("/safety", "Safety", active) +
      '<a href="/" data-nav>Marketing site</a>' +
      '<a href="#logout" id="logoutLink">Sign out</a>' +
      "</nav></div></header>" +
      '<main class="wrap"><div id="flash" class="banner" hidden></div>' + content + "</main>"
    );
  }

  function navLink(href, label, active) {
    return '<a href="' + href + '" data-nav class="' + (active === href || (active || "").indexOf(href + "/") === 0 ? "active" : "") + '">' + label + "</a>";
  }

  function authShell(content) {
    var mode = api.mode();
    return (
      '<div class="demo-banner"><strong>' + escapeHtml(mode.label) + '</strong> — <span>' + escapeHtml(mode.notice) + '</span></div>' +
      '<header class="app-header"><div class="app-bar"><a class="logo" href="/">Amani<span>kah</span></a></div></header>' +
      '<main class="wrap narrow"><div id="flash" class="banner" hidden></div>' + content + "</main>"
    );
  }

  function requireSession(next) {
    return api.me().then(function (res) {
      if (!res.data.user.onboardingComplete && path() !== "/onboarding") {
        go("/onboarding");
        return null;
      }
      return res.data;
    }).catch(function () {
      go("/login?next=" + encodeURIComponent(path()));
      return null;
    });
  }

  function renderRegister() {
    root.innerHTML = authShell(
      '<div class="panel">' +
      '<p class="kicker">Register</p><h1>Create a private demo membership</h1>' +
      '<p class="quiet">This creates a fictional account in this browser only. No email is sent.</p>' +
      '<form id="regForm">' +
      field("displayName", "Display name") +
      field("email", "Email", "email") +
      field("password", "Password", "password") +
      field("age", "Age", "number") +
      '<div class="field"><label for="jurisdiction">Jurisdiction</label><select id="jurisdiction" name="jurisdiction" required>' +
      '<option value="">Choose</option><option value="IN">India</option><option value="AE">UAE</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="OTHER">Other</option>' +
      "</select></div>" +
      '<div class="check"><input id="consentTerms" type="checkbox" required><label for="consentTerms">I agree to the <a href="/terms.html" target="_blank">Terms</a></label></div>' +
      '<div class="check"><input id="consentPrivacy" type="checkbox" required><label for="consentPrivacy">I agree to the <a href="/privacy.html" target="_blank">Privacy Policy</a></label></div>' +
      '<button class="btn btn-emerald" type="submit">Create demo account</button>' +
      '<p class="err" id="formErr" hidden></p></form>' +
      '<p class="quiet" style="margin-top:16px">Already registered? <a href="/login" data-nav>Sign in</a>. Try demo login <code>you@amanikah.demo</code> / <code>DemoPass21!</code></p>' +
      "</div>"
    );
    qs("#regForm").onsubmit = function (e) {
      e.preventDefault();
      api.register({
        displayName: val("displayName"),
        email: val("email"),
        password: val("password"),
        age: Number(val("age")),
        jurisdiction: val("jurisdiction"),
        consentTerms: qs("#consentTerms").checked,
        consentPrivacy: qs("#consentPrivacy").checked
      }).then(function (res) {
        fetch("/api/billing/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "qualified_signup" })
        }).catch(function () {});
        go(res.data.next || "/onboarding");
      }).catch(showErr);
    };
  }

  function renderLogin() {
    root.innerHTML = authShell(
      '<div class="panel">' +
      '<p class="kicker">Login</p><h1>Sign in to your demo membership</h1>' +
      '<p class="quiet">Demo account: you@amanikah.demo / DemoPass21!</p>' +
      '<form id="loginForm">' +
      field("email", "Email", "email") +
      field("password", "Password", "password") +
      '<button class="btn btn-emerald" type="submit">Sign in</button>' +
      '<p class="err" id="formErr" hidden></p></form>' +
      '<div class="actions"><button class="btn btn-ghost" type="button" id="resetDemo">Reset demo data</button></div>' +
      '<p class="quiet" style="margin-top:16px"><a href="/register" data-nav>Create a demo account</a></p></div>'
    );
    qs("#loginForm").onsubmit = function (e) {
      e.preventDefault();
      api.login({ email: val("email"), password: val("password") }).then(function (res) {
        var next = new URLSearchParams(location.search).get("next") || res.data.next || "/dashboard";
        go(next);
      }).catch(showErr);
    };
    qs("#resetDemo").onclick = function () {
      api.resetDemo().then(function () { flash("Demo data reset.", "ok"); });
    };
  }

  function renderOnboarding() {
    requireSession().then(function (session) {
      if (!session) return;
      var step = 0;
      var draft = Object.assign({
        displayName: session.profile.displayName,
        age: session.profile.age || 21,
        jurisdiction: session.profile.jurisdiction || "IN",
        intentions: session.profile.intentions || "",
        city: session.profile.city || "",
        educationLevel: session.profile.educationLevel || "",
        workSummary: session.profile.workSummary || "",
        relocation: session.profile.relocation || "Flexible by mutual agreement",
        weddingStyle: session.profile.weddingStyle || "Intimate gathering",
        familyInvolvement: session.profile.familyInvolvement || "After both people wish to continue",
        simpleNikah: !!session.profile.simpleNikah,
        familyInvolvementOptIn: !!session.profile.familyInvolvementOptIn,
        visibility: session.profile.visibility || "private",
        nikahReadiness: session.profile.nikahReadiness || null
      }, {});

      function paint() {
        root.innerHTML = shell(
          '<div class="panel narrow" style="max-width:720px;margin:0 auto">' +
          '<p class="kicker">Onboarding</p><h1>Set up your private profile</h1>' +
          '<div class="steps">' +
          ["Eligibility", "Verification", "Intentions", "Details", "Preferences", "Privacy"].map(function (label, i) {
            return '<span class="' + (i === step ? "on" : "") + '">' + (i + 1) + ". " + label + "</span>";
          }).join("") +
          '</div><div id="onboardBody"></div>' +
          '<div class="actions">' +
          (step > 0 ? '<button class="btn btn-ghost" type="button" id="backStep">Back</button>' : "") +
          '<button class="btn btn-emerald" type="button" id="nextStep">' + (step === 5 ? "Finish onboarding" : "Continue") + "</button></div>" +
          '<p class="err" id="formErr" hidden></p></div>',
          "/onboarding"
        );
        var body = qs("#onboardBody");
        if (step === 0) {
          body.innerHTML = '<p class="quiet">Confirm you are an adult and eligible in your jurisdiction.</p>' +
            fieldValue("age", "Age", draft.age, "number") +
            '<div class="field"><label for="jurisdiction">Jurisdiction</label><select id="jurisdiction">' +
            opt("IN", "India", draft.jurisdiction) + opt("AE", "UAE", draft.jurisdiction) + opt("US", "United States", draft.jurisdiction) + opt("GB", "United Kingdom", draft.jurisdiction) + opt("OTHER", "Other", draft.jurisdiction) +
            "</select></div>";
        } else if (step === 1) {
          body.innerHTML = '<div class="banner demo">Demo verification does not send email or SMS. Use the buttons to mark verification complete.</div>' +
            '<p>Email verified: <strong>' + (session.user.emailVerified ? "yes" : "no") + "</strong></p>" +
            '<p>Phone verified: <strong>' + (session.user.phoneVerified ? "yes" : "no") + "</strong></p>" +
            '<div class="actions">' +
            '<button class="btn btn-gold" type="button" id="verifyEmail">Mark email verified (demo)</button>' +
            '<button class="btn btn-ghost" type="button" id="verifyPhone">Mark phone verified (demo)</button></div>';
          qs("#verifyEmail").onclick = function () {
            api.verifyContact("email").then(function () { return api.me(); }).then(function (res) { session = res.data; paint(); });
          };
          qs("#verifyPhone").onclick = function () {
            api.verifyContact("phone").then(function () { return api.me(); }).then(function (res) { session = res.data; paint(); });
          };
        } else if (step === 2) {
          body.innerHTML = fieldValue("displayName", "Display name", draft.displayName) +
            '<div class="field"><label for="intentions">Marriage intentions</label><textarea id="intentions">' + escapeHtml(draft.intentions) + "</textarea></div>";
        } else if (step === 3) {
          body.innerHTML = fieldValue("city", "City", draft.city) +
            fieldValue("educationLevel", "Education", draft.educationLevel) +
            fieldValue("workSummary", "Work summary", draft.workSummary);
        } else if (step === 4) {
          body.innerHTML =
            '<div class="field"><label for="relocation">Relocation</label><select id="relocation">' +
            opt("Prefer same city", "Prefer same city", draft.relocation) +
            opt("Open within India", "Open within India", draft.relocation) +
            opt("Open to life abroad", "Open to life abroad", draft.relocation) +
            opt("Flexible by mutual agreement", "Flexible by mutual agreement", draft.relocation) +
            "</select></div>" +
            '<div class="field"><label for="weddingStyle">Wedding style</label><select id="weddingStyle">' +
            opt("Intimate gathering", "Intimate gathering", draft.weddingStyle) +
            opt("Moderate family celebration", "Moderate family celebration", draft.weddingStyle) +
            opt("Larger celebration", "Larger celebration", draft.weddingStyle) +
            "</select></div>" +
            '<div class="field"><label for="familyInvolvement">Family involvement</label><select id="familyInvolvement">' +
            opt("Early family involvement", "Early family involvement", draft.familyInvolvement) +
            opt("After both people wish to continue", "After both people wish to continue", draft.familyInvolvement) +
            opt("Supportive without deciding for us", "Supportive without deciding for us", draft.familyInvolvement) +
            "</select></div>" +
            '<div class="check"><input id="simpleNikah" type="checkbox"' + (draft.simpleNikah ? " checked" : "") + '><label for="simpleNikah">I prefer #SimpleNikah values</label></div>' +
            '<div class="check"><input id="familyInvolvementOptIn" type="checkbox"' + (draft.familyInvolvementOptIn ? " checked" : "") + '><label for="familyInvolvementOptIn">Optional family involvement tools</label></div>' +
            '<p class="quiet">You can import Nikah Readiness later from the quiz. Preferences here are not a character score.</p>';
        } else {
          body.innerHTML =
            '<div class="field"><label for="visibility">Profile visibility</label><select id="visibility">' +
            opt("private", "Private (default)", draft.visibility) +
            opt("unlisted", "Unlisted to accepted introductions only", draft.visibility) +
            "</select></div>" +
            '<p class="quiet">Profiles default to private. Authorization is enforced in the membership API, not only in the UI.</p>';
        }
        bindShell();
        if (qs("#backStep")) qs("#backStep").onclick = function () { readDraft(); step -= 1; paint(); };
        qs("#nextStep").onclick = function () {
          readDraft();
          if (step < 5) { step += 1; paint(); return; }
          api.saveOnboarding(draft).then(function () { go("/dashboard"); }).catch(showErr);
        };
      }

      function readDraft() {
        ["age", "jurisdiction", "displayName", "intentions", "city", "educationLevel", "workSummary", "relocation", "weddingStyle", "familyInvolvement", "visibility"].forEach(function (k) {
          var el = qs("#" + k);
          if (el) draft[k] = el.type === "number" ? Number(el.value) : el.value;
        });
        if (qs("#simpleNikah")) draft.simpleNikah = qs("#simpleNikah").checked;
        if (qs("#familyInvolvementOptIn")) draft.familyInvolvementOptIn = qs("#familyInvolvementOptIn").checked;
        try {
          var nr = JSON.parse(localStorage.getItem("amanikah.nikahReadiness.profile") || "null");
          if (nr && nr.top3) draft.nikahReadiness = { top3: nr.top3.map(function (t) { return t.priority; }), relocate: nr.relocate };
        } catch (err) {}
      }

      paint();
    });
  }

  function renderDashboard() {
    requireSession().then(function (session) {
      if (!session) return;
      api.dashboard().then(function (res) {
        var d = res.data;
        root.innerHTML = shell(
          '<p class="kicker">Dashboard</p><h1>Welcome, ' + escapeHtml(d.profile.displayName) + '</h1>' +
          '<div class="banner demo">Fictional demo membership. Suggested introductions are not real people.</div>' +
          '<p class="quiet"><a data-nav href="/voice">Voice Rishta</a> is optional. People can express interest from the written profile alone.</p>' +
          '<div class="grid-3">' +
          metric("Profile completion", d.profile.completion + "%") +
          metric("Privacy", d.privacy.visibility) +
          metric("Membership", d.membership.label) +
          "</div>" +
          '<div class="grid-2" style="margin-top:16px">' +
          '<section class="panel"><h2>Suggested introductions</h2><ul class="list">' +
          d.suggestedIntroductions.map(function (s) {
            return "<li><strong>" + escapeHtml(s.candidate.displayName) + '</strong><div class="quiet">' + escapeHtml((s.reasons || []).slice(0, 2).join(" · ")) + '</div><a data-nav href="/matches/' + s.matchId + '">View</a></li>';
          }).join("") +
          '</ul><a class="btn btn-ghost" data-nav href="/matches">All matches</a></section>' +
          '<section class="panel"><h2>Pending requests</h2><ul class="list">' +
          (d.pendingRequests.length ? d.pendingRequests.map(function (p) {
            return "<li><span class=\"status-pending\">" + escapeHtml(p.status) + "</span> introduction · " + escapeHtml(p.id) + "</li>";
          }).join("") : "<li class=\"quiet\">None</li>") +
          '</ul><a data-nav href="/introductions">Manage introductions</a></section>' +
          "</div>" +
          '<div class="grid-2" style="margin-top:16px">' +
          '<section class="panel"><h2>Recent activity</h2><ul class="list">' +
          d.recentActivity.map(function (a) { return "<li>" + escapeHtml(a.text) + "</li>"; }).join("") +
          "</ul></section>" +
          '<section class="panel"><h2>Shortcuts</h2><div class="actions">' +
          '<a class="btn btn-emerald" data-nav href="/verification">Verification</a>' +
          '<a class="btn btn-ghost" data-nav href="/family">Family invites</a>' +
          '<a class="btn btn-ghost" data-nav href="/settings">Privacy settings</a>' +
          "</div></section></div>",
          "/dashboard"
        );
        bindShell();
      }).catch(function (err) { root.innerHTML = authShell("<p class='err'>" + escapeHtml(err.message) + "</p>"); });
    });
  }

  function renderMatches() {
    requireSession().then(function (session) {
      if (!session) return;
      var parts = path().split("/");
      var matchId = parts[1] === "matches" && parts[2] ? parts[2] : null;
      if (matchId) return renderMatchDetail(matchId);
      api.listMatches().then(function (res) {
        var matches = res.data.matches || [];
        var body;
        if (!matches.length) {
          body =
            '<p class="kicker">Matches</p><h1>No compatible members right now</h1>' +
            '<div class="empty-state">' +
            "<h2>Your queue is clear — that is honest, not a failure</h2>" +
            "<p>When no one fits the expectations you saved, Amanikah shows an empty state instead of inventing people. Complete your profile, refine priorities, or join the waitlist while matchmaking stays offline in production.</p>" +
            '<div class="actions" style="justify-content:center">' +
            '<a class="btn btn-emerald" data-nav href="/onboarding">Review expectations</a>' +
            '<a class="btn btn-ghost" href="/nikah-readiness/">Discover Nikah Priorities</a>' +
            '<a class="btn btn-ghost" href="/signup.html">Join the waitlist</a>' +
            "</div></div>";
        } else {
          body =
            '<p class="kicker">Matches</p><h1>This week’s curated introductions</h1>' +
            '<p class="quiet">' + escapeHtml(res.data.note) + "</p>" +
            '<div class="grid-3">' +
            matches.map(function (m) {
              return '<article class="card"><span class="pill">DEMO</span><h3>' + escapeHtml(m.candidate.displayName) + "</h3>" +
                '<p class="quiet">' + escapeHtml(m.candidate.city) + " · " + escapeHtml(String(m.candidate.age)) + "</p>" +
                "<p>" + escapeHtml((m.reasons || [])[0] || "") + "</p>" +
                '<p class="quiet">Intro: ' + escapeHtml(m.introductionStatus) + "</p>" +
                '<a class="btn btn-emerald" data-nav href="/matches/' + m.id + '">Open</a></article>';
            }).join("") +
            "</div>";
        }
        root.innerHTML = shell(body, "/matches");
        bindShell();
      });
    });
  }

  function renderMatchDetail(matchId) {
    api.getMatch(matchId).then(function (res) {
      var d = res.data;
      root.innerHTML = shell(
        '<p class="kicker">Match detail</p><h1>' + escapeHtml(d.candidate.displayName) + ' <span class="pill">DEMO</span></h1>' +
        '<div class="grid-2">' +
        '<section class="panel"><h2>Why suggested</h2><ul class="list">' +
        d.reasons.map(function (r) { return "<li>" + escapeHtml(r) + "</li>"; }).join("") +
        "</ul><h3>Aligned</h3><ul class=\"list\">" +
        (d.aligned.length ? d.aligned.map(function (r) { return "<li>" + escapeHtml(r) + "</li>"; }).join("") : "<li class=\"quiet\">None listed</li>") +
        "</ul><h3>Possible differences</h3><ul class=\"list\">" +
        (d.differences.length ? d.differences.map(function (r) { return "<li>" + escapeHtml(r) + "</li>"; }).join("") : "<li class=\"quiet\">None listed</li>") +
        "</ul></section>" +
        '<section class="panel"><h2>Introduction</h2>' +
        "<p>Status: <strong class=\"status-" + escapeHtml((d.introduction && d.introduction.status) || "none") + "\">" +
        escapeHtml((d.introduction && d.introduction.status) || "none") + "</strong></p>" +
        '<p class="quiet">Both adults must accept before conversations open. Payment never unlocks contact details by itself.</p>' +
        '<div class="actions" id="introActions"></div>' +
        '<p class="quiet">Listening to a voice introduction is optional. You can request an introduction from the written profile alone.</p>' +
        '<div id="voiceShare"></div>' +
        "<h3>Contact details</h3>" +
        (d.contact
          ? "<p>" + escapeHtml(d.contact.email || "") + "<br>" + escapeHtml(d.contact.phone || "") + "</p>"
          : "<p class=\"quiet\">" + escapeHtml((d.contactDenied && d.contactDenied.message) || "Not shared") + "</p>") +
        '<div class="actions"><button class="btn btn-danger" type="button" id="blockBtn">Block</button>' +
        '<button class="btn btn-ghost" type="button" id="reportBtn">Report</button></div></section></div>',
        "/matches"
      );
      var actions = qs("#introActions");
      if (!d.introduction) {
        actions.innerHTML = '<button class="btn btn-emerald" type="button" id="requestIntro">Request introduction</button>';
        qs("#requestIntro").onclick = function () {
          api.requestIntroduction(d.candidate.userId).then(function () { renderMatchDetail(matchId); flash("Introduction requested.", "ok"); });
        };
      } else if (d.introduction.status === "pending") {
        actions.innerHTML =
          '<button class="btn btn-emerald" type="button" id="acceptIntro">Accept</button>' +
          '<button class="btn btn-ghost" type="button" id="declineIntro">Decline</button>' +
          '<button class="btn btn-ghost" type="button" id="demoPeerAccept">Demo: peer accepts</button>';
        qs("#acceptIntro").onclick = function () { api.respondIntroduction(d.introduction.id, "accept").then(function () { renderMatchDetail(matchId); }); };
        qs("#declineIntro").onclick = function () { api.respondIntroduction(d.introduction.id, "decline").then(function () { renderMatchDetail(matchId); }); };
        qs("#demoPeerAccept").onclick = function () {
          var peer = d.introduction.to === "demo-user-self" ? d.introduction.from : d.introduction.to;
          // If current user is from, peer is to
          peer = d.introduction.from === res._userId ? d.introduction.to : d.introduction.to;
          api.me().then(function (me) {
            var peerId = d.introduction.from === me.data.user.id ? d.introduction.to : d.introduction.from;
            return api.demoAcceptAsPeer(d.introduction.id, peerId);
          }).then(function () { renderMatchDetail(matchId); flash("Peer accepted (demo helper).", "ok"); });
        };
      } else if (d.introduction.status === "accepted") {
        actions.innerHTML = '<a class="btn btn-emerald" data-nav href="/messages?peer=' + encodeURIComponent(d.candidate.userId) + '">Open messages</a>';
      }
      qs("#blockBtn").onclick = function () {
        api.blockUser(d.candidate.userId).then(function () { flash("Blocked.", "ok"); go("/matches"); });
      };
      api.voiceSharedFrom(d.candidate.userId).then(function (voiceRes) {
        var box = qs("#voiceShare");
        if (!box) return;
        var rows = voiceRes.data.recordings || [];
        if (!rows.length) {
          box.innerHTML = '<p class="quiet">No voice introduction has been shared with you.</p>';
          return;
        }
        box.innerHTML = rows.map(function (rec) {
          return '<article class="card"><h3>Optional introduction</h3><p>' + escapeHtml(rec.textAlternative || "") + "</p>" +
            (rec.kind === "audio" ? '<button class="btn btn-ghost" type="button" data-play-voice="' + escapeHtml(rec.id) + '">Play voice</button><audio data-audio="' + escapeHtml(rec.id) + '" controls hidden></audio>' : '<p class="quiet">Text introduction. No listening required.</p>') +
            '<button class="btn btn-ghost" type="button" data-report-voice="' + escapeHtml(rec.id) + '">Report introduction</button></article>';
        }).join("");
        box.querySelectorAll("[data-play-voice]").forEach(function (btn) {
          btn.onclick = function () { playAuthorized(btn.getAttribute("data-play-voice"), box.querySelector('[data-audio="' + btn.getAttribute("data-play-voice") + '"]')); };
        });
        box.querySelectorAll("[data-report-voice]").forEach(function (btn) {
          btn.onclick = function () {
            var reason = prompt("What should a moderator review? This stays in demo storage.");
            if (!reason) return;
            api.voiceReport(btn.getAttribute("data-report-voice"), reason).then(function () { flash("Report saved for moderation.", "ok"); });
          };
        });
      }).catch(function () {});
      qs("#reportBtn").onclick = function () {
        var reason = prompt("Describe the concern (stored in demo storage only)");
        if (!reason) return;
        api.reportUser(d.candidate.userId, reason).then(function () { flash("Report saved in demo storage.", "ok"); });
      };
      bindShell();
    }).catch(function (err) {
      root.innerHTML = shell('<p class="err">' + escapeHtml(err.message) + "</p>", "/matches");
      bindShell();
    });
  }

  function renderIntroductions() {
    requireSession().then(function (session) {
      if (!session) return;
      api.listIntroductions().then(function (res) {
        var rows = res.data.introductions || [];
        var listHtml = rows.length
          ? '<ul class="list">' + rows.map(function (row) {
            var i = row.introduction;
            return "<li><strong>" + escapeHtml((row.peer && row.peer.displayName) || "Member") + '</strong> — <span class="status-' + escapeHtml(i.status) + '">' + escapeHtml(i.status) + "</span>" +
              '<div class="actions">' +
              (i.status === "pending" ? '<button class="btn btn-emerald btn-sm" data-accept="' + i.id + '">Accept</button><button class="btn btn-ghost" data-decline="' + i.id + '">Decline</button>' : "") +
              (i.status === "pending" && i.from === session.user.id ? '<button class="btn btn-ghost" data-withdraw="' + i.id + '">Withdraw</button>' : "") +
              "</div></li>";
          }).join("") + "</ul>"
          : '<div class="empty-state"><h2>No introductions yet</h2><p>When someone requests or accepts an introduction, it appears here. Until then, refine your expectations or explore the free priorities quiz.</p><div class="actions" style="justify-content:center"><a class="btn btn-emerald" data-nav href="/matches">Browse matches</a><a class="btn btn-ghost" data-nav href="/settings">Privacy settings</a></div></div>';
        root.innerHTML = shell(
          '<p class="kicker">Introductions</p><h1>Pending, accepted, declined, expired</h1>' + listHtml,
          "/introductions"
        );
        root.querySelectorAll("[data-accept]").forEach(function (btn) {
          btn.onclick = function () { api.respondIntroduction(btn.getAttribute("data-accept"), "accept").then(renderIntroductions); };
        });
        root.querySelectorAll("[data-decline]").forEach(function (btn) {
          btn.onclick = function () { api.respondIntroduction(btn.getAttribute("data-decline"), "decline").then(renderIntroductions); };
        });
        root.querySelectorAll("[data-withdraw]").forEach(function (btn) {
          btn.onclick = function () { api.respondIntroduction(btn.getAttribute("data-withdraw"), "withdraw").then(renderIntroductions); };
        });
        bindShell();
      });
    });
  }

  function renderMessages() {
    requireSession().then(function (session) {
      if (!session) return;
      var peer = new URLSearchParams(location.search).get("peer");
      api.listThreads().then(function (res) {
        if (!peer && res.data.threads[0]) peer = res.data.threads[0].peerId;
        var html = '<p class="kicker">Messages</p><h1>Conversations</h1><p class="quiet">Messages unlock only after mutual acceptance.</p><div class="grid-2">';
        html += '<section class="panel"><h2>Threads</h2><ul class="list">' +
          (res.data.threads.length ? res.data.threads.map(function (t) {
            return "<li><a data-nav href=\"/messages?peer=" + encodeURIComponent(t.peerId) + "\">" + escapeHtml(t.peer.displayName) + "</a>" +
              (t.canMessage ? "" : ' <span class="quiet">(' + escapeHtml(t.reason) + ")</span>") + "</li>";
          }).join("") : "<li class=\"quiet\">No accepted introductions yet</li>") +
          "</ul></section>";
        html += '<section class="panel" id="threadPanel"><h2>Thread</h2><p class="quiet">Select a conversation.</p></section></div>';
        root.innerHTML = shell(html, "/messages");
        bindShell();
        if (!peer) return;
        api.listMessages(peer).then(function (msgRes) {
          var panel = qs("#threadPanel");
          panel.innerHTML = "<h2>Thread</h2><div class=\"chat\" id=\"chat\">" +
            msgRes.data.messages.map(function (m) {
              return '<div class="bubble' + (m.from === session.user.id ? " mine" : "") + '">' + escapeHtml(m.body) + "</div>";
            }).join("") +
            '</div><form id="msgForm" class="actions" style="margin-top:12px">' +
            '<input id="msgBody" style="flex:1;min-height:44px;padding:10px;border:1px solid var(--line)" placeholder="Write a message">' +
            '<button class="btn btn-emerald" type="submit">Send</button></form><p class="err" id="formErr" hidden></p>';
          qs("#msgForm").onsubmit = function (e) {
            e.preventDefault();
            api.sendMessage(peer, qs("#msgBody").value).then(function () { renderMessages(); }).catch(showErr);
          };
        }).catch(function (err) {
          qs("#threadPanel").innerHTML = "<h2>Thread</h2><p class=\"err\">" + escapeHtml(err.message) + "</p>";
        });
      });
    });
  }

  function renderFamilyAssistant() {
    requireSession().then(function (session) {
      if (!session) return;
      api.familyAssistantState().then(function (res) {
        var enabled = res.data.enabled;
        var admin = session.user.role === "admin";
        var access = res.data.access || {};
        var draft = access.workspace && access.workspace.drafts && access.workspace.drafts.latest;
        root.innerHTML = shell(
          '<p class="kicker">Aman Family Assistant</p><h1>Help a family talk. Do not decide a match.</h1>' +
          '<div class="banner demo">This assistant does not judge suitability. No live model is connected unless an administrator configures one. Rules drafts use only fields you permit.</div>' +
          (admin ? '<div class="panel"><h2>Administrator flag</h2><p class="quiet">The assistant stays off until an administrator enables it.</p><button class="btn btn-gold" type="button" id="flagBtn">' + (enabled ? "Turn assistant off" : "Turn assistant on") + "</button></div>" : "") +
          (!enabled ? '<p class="quiet">Family Assistant is off.</p>' :
          '<div class="panel" id="assistantPanel"><h2>Permitted information</h2>' +
          '<p class="quiet">Relatives see only the boxes you tick. Unknown topics stay unknown.</p>' +
          ["displayName", "city", "education", "work", "relocation", "weddingStyle", "intentions"].map(function (field) {
            return '<div class="check"><input type="checkbox" class="permit" value="' + field + '" id="p-' + field + '"><label for="p-' + field + '">' + field + "</label></div>";
          }).join("") +
          '<div class="field"><label for="note">Discussion note</label><textarea id="note"></textarea></div>' +
          '<div class="field"><label for="lang">Language</label><select id="lang"><option value="en">English</option><option value="hi">Hindi</option><option value="ur">Urdu</option></select></div>' +
          '<div class="actions"><button class="btn btn-emerald" type="button" id="grantBtn">Save permissions</button>' +
          '<button class="btn btn-gold" type="button" id="draftBtn">Build checklist from permitted details</button>' +
          '<button class="btn btn-ghost" type="button" id="aiBtn">Ask connected AI</button></div>' +
          '<p class="err" id="formErr" hidden></p><div id="assistantOut"></div></div>' +
          '<div class="panel" style="margin-top:16px"><h2>Family access</h2>' +
          '<div class="actions"><button class="btn btn-ghost" type="button" id="inviteBtn">Invite a relative</button>' +
          '<button class="btn btn-ghost" type="button" id="revokeConsentBtn">Withdraw assistant consent</button>' +
          '<button class="btn btn-danger" type="button" id="deleteWsBtn">Delete workspace</button></div></div>') +
          (draft ? "" : ""),
          "/family-assistant"
        );
        bindShell();
        if (qs("#flagBtn")) qs("#flagBtn").onclick = function () {
          api.setFamilyAssistantFlag(!enabled).then(function () { renderFamilyAssistant(); });
        };
        if (!enabled) return;
        function paintDraft(body) {
          var d = body.draft;
          var dir = d.language === "ur" ? "rtl" : "ltr";
          qs("#assistantOut").innerHTML =
            '<p class="ai-label">' + escapeHtml(d.aiGenerated ? "AI-generated" : "Not AI-generated") + "</p>" +
            '<p class="quiet">' + escapeHtml(d.label) + "</p>" +
            '<div dir="' + dir + '"><h3>Summary</h3><ul class="list">' +
            (d.summary.length ? d.summary.map(function (row) {
              return "<li><strong>" + escapeHtml(row.field) + "</strong> — " + escapeHtml(row.value) + ' <span class="pill">' + escapeHtml(row.source) + "</span></li>";
            }).join("") : "<li class=\"quiet\">No permitted details yet.</li>") +
            "</ul><h3>Still unknown</h3><ul class=\"list\">" +
            d.unanswered.map(function (row) { return "<li>" + escapeHtml(row.field) + " — " + escapeHtml(row.note) + "</li>"; }).join("") +
            "</ul><h3>Meeting questions</h3><ul class=\"list\">" +
            d.meetingQuestions.map(function (q) { return "<li>" + escapeHtml(q) + "</li>"; }).join("") +
            '</ul><div class="field"><label for="edited">Editable draft</label><textarea id="edited">' +
            escapeHtml(d.acceptTemplate + "\n\n" + d.declineTemplate) + "</textarea></div>" +
            '<div class="actions"><button class="btn btn-ghost" type="button" id="saveDraftBtn">Save draft</button>' +
            '<button class="btn btn-danger" type="button" id="reportAiBtn">Report unsafe output</button></div></div>';
          qs("#saveDraftBtn").onclick = function () {
            api.familyAssistantSaveDraft(qs("#edited").value).then(function () { flash("Draft saved.", "ok"); });
          };
          qs("#reportAiBtn").onclick = function () {
            api.familyAssistantReport("unsafe or inaccurate assistant output").then(function () { flash("Report stored in the workspace audit.", "ok"); });
          };
        }
        qs("#grantBtn").onclick = function () {
          var fields = Array.prototype.map.call(document.querySelectorAll(".permit:checked"), function (el) { return el.value; });
          api.familyAssistantGrant(fields).then(function () { flash("Permissions saved.", "ok"); }).catch(showErr);
        };
        qs("#draftBtn").onclick = function () {
          api.familyAssistantAsk({ allowRulesDraft: true, lang: val("lang"), note: val("note") }).then(function (res) { paintDraft(res.data); }).catch(showErr);
        };
        qs("#aiBtn").onclick = function () {
          api.familyAssistantAsk({ lang: val("lang"), note: val("note") }).then(function (res) { paintDraft(res.data); }).catch(showErr);
        };
        qs("#inviteBtn").onclick = function () {
          api.familyAssistantInvite({ label: "Parent", relativeUserId: "demo-user-yusuf" }).then(function (res) {
            flash("Invite " + res.data.invite.id + " created. Revoke it from this workspace if needed.", "ok");
          }).catch(showErr);
        };
        qs("#revokeConsentBtn").onclick = function () {
          api.familyAssistantRevokeConsent().then(function () { flash("Consent withdrawn. Relatives lose access.", "ok"); renderFamilyAssistant(); });
        };
        qs("#deleteWsBtn").onclick = function () {
          api.familyAssistantDelete().then(function () { flash("Workspace deleted.", "ok"); renderFamilyAssistant(); });
        };
      }).catch(function (err) {
        root.innerHTML = shell('<p class="err">' + escapeHtml(err.message) + "</p>", "/family-assistant");
        bindShell();
      });
    });
  }

  function renderFamily() {
    requireSession().then(function (session) {
      if (!session) return;
      api.listFamily().then(function (res) {
        root.innerHTML = shell(
          '<p class="kicker">Family</p><h1>Optional family invitations</h1>' +
          '<p class="quiet">Relatives cannot upload your biodata. An invite asks them to create their own account.</p>' +
          '<form id="famForm" class="panel">' +
          field("relativeLabel", "Relationship label") +
          '<button class="btn btn-emerald" type="submit">Create invite</button></form>' +
          '<ul class="list">' + res.data.invites.map(function (i) {
            return "<li><strong>" + escapeHtml(i.relativeLabel) + "</strong> — " + escapeHtml(i.status) +
              '<div class="quiet">' + escapeHtml(i.note) + "</div></li>";
          }).join("") + "</ul>",
          "/family"
        );
        qs("#famForm").onsubmit = function (e) {
          e.preventDefault();
          api.createFamilyInvite({ relativeLabel: val("relativeLabel") }).then(function () {
            flash("Family invite created (demo).", "ok");
            renderFamily();
          });
        };
        bindShell();
      });
    });
  }

  function renderVerification() {
    requireSession().then(function (session) {
      if (!session) return;
      api.listVerification().then(function (res) {
        root.innerHTML = shell(
          '<p class="kicker">Verification</p><h1>Scoped ProofPass requests</h1>' +
          '<div class="banner demo">Checks are not processed online. A fee would be confirmed before work. Payment does not reveal contact details.</div>' +
          '<form id="verForm" class="panel">' +
          '<div class="field"><label for="scope">Scope</label><select id="scope" name="scope">' +
          '<option value="education">Education</option><option value="employment">Employment</option>' +
          '<option value="property">A property claim</option><option value="nri">NRI document consistency</option>' +
          "</select></div>" +
          '<button class="btn btn-emerald" type="submit">Request quote (demo)</button></form>' +
          '<ul class="list">' + res.data.requests.map(function (r) {
            return "<li><strong>" + escapeHtml(r.scope) + "</strong> — " + escapeHtml(r.status) +
              '<div class="quiet">' + escapeHtml(r.note) + "</div></li>";
          }).join("") + "</ul>",
          "/verification"
        );
        qs("#verForm").onsubmit = function (e) {
          e.preventDefault();
          api.requestVerification({ scope: val("scope") }).then(function () {
            flash("Verification quote recorded in demo mode.", "ok");
            renderVerification();
          });
        };
        bindShell();
      });
    });
  }

  function renderSettings() {
    requireSession().then(function (session) {
      if (!session) return;
      root.innerHTML = shell(
        '<p class="kicker">Settings</p><h1>Privacy and account</h1>' +
        '<form id="setForm" class="panel">' +
        '<div class="field"><label for="visibility">Visibility</label><select id="visibility">' +
        opt("private", "Private", session.profile.visibility) +
        opt("unlisted", "Unlisted", session.profile.visibility) +
        "</select></div>" +
        '<div class="check"><input id="shareContactAfterMutual" type="checkbox"' + (session.profile.shareContactAfterMutual ? " checked" : "") + ">" +
        '<label for="shareContactAfterMutual">After mutual acceptance, allow contact details to be shared</label></div>' +
        '<div class="check"><input id="familyInvolvementOptIn" type="checkbox"' + (session.profile.familyInvolvementOptIn ? " checked" : "") + ">" +
        '<label for="familyInvolvementOptIn">Enable optional family tools</label></div>' +
        '<button class="btn btn-emerald" type="submit">Save</button></form>' +
        (session.user.role === "admin" ? '<p class="quiet">Family Assistant flag is managed on the <a data-nav href="/family-assistant">assistant page</a>.</p>' : "") +
        '<div class="panel" style="margin-top:16px">' +
        '<h2>Data rights</h2><div class="actions">' +
        '<button class="btn btn-ghost" type="button" id="exportBtn">Export my data</button>' +
        '<button class="btn btn-ghost" type="button" id="withdrawBtn">Withdraw consent</button>' +
        '<button class="btn btn-danger" type="button" id="deleteBtn">Delete account</button></div>' +
        '<pre id="exportOut" class="quiet" style="white-space:pre-wrap"></pre></div>',
        "/settings"
      );
      qs("#setForm").onsubmit = function (e) {
        e.preventDefault();
        api.updateSettings({
          visibility: val("visibility"),
          shareContactAfterMutual: qs("#shareContactAfterMutual").checked,
          familyInvolvementOptIn: qs("#familyInvolvementOptIn").checked
        }).then(function () { flash("Settings saved.", "ok"); });
      };
      qs("#exportBtn").onclick = function () {
        api.exportData().then(function (res) {
          qs("#exportOut").textContent = JSON.stringify(res.data, null, 2);
        });
      };
      qs("#withdrawBtn").onclick = function () {
        api.withdrawConsent().then(function () { flash("Consent withdrawn; profile forced private.", "ok"); });
      };
      qs("#deleteBtn").onclick = function () {
        if (!confirm("Delete this demo account from browser storage?")) return;
        api.deleteAccount().then(function (res) {
          var keys = (res.data && res.data.voiceKeys) || [];
          return Promise.all(keys.map(function (id) { return window.AmanikahVoiceRishta.deleteBlob(id); }));
        }).then(function () { go("/login"); });
      };
      bindShell();
    });
  }

  function renderSafety() {
    requireSession().then(function (session) {
      if (!session) return;
      root.innerHTML = shell(
        '<p class="kicker">Safety</p><h1>Block, report, and careful introductions</h1>' +
        '<div class="panel">' +
        "<p>Amanikah does not claim every member is safe. Use block and report when needed. Reports in demo mode stay in this browser.</p>" +
        '<form id="safetyForm">' +
        field("targetUserId", "Demo member user id to block/report") +
        field("reason", "Report reason") +
        '<div class="actions">' +
        '<button class="btn btn-danger" name="act" value="block" type="submit">Block</button>' +
        '<button class="btn btn-ghost" name="act" value="report" type="submit">Report</button></div>' +
        '<p class="quiet">Example ids: demo-user-amina, demo-user-yusuf, demo-user-sara</p>' +
        '<p class="err" id="formErr" hidden></p></form></div>',
        "/safety"
      );
      qs("#safetyForm").onsubmit = function (e) {
        e.preventDefault();
        var act = e.submitter ? e.submitter.value : "report";
        var id = val("targetUserId");
        var p = act === "block" ? api.blockUser(id) : api.reportUser(id, val("reason"));
        p.then(function () { flash(act === "block" ? "Blocked." : "Reported (demo storage).", "ok"); }).catch(showErr);
      };
      bindShell();
    });
  }

  function field(name, label, type) {
    return '<div class="field"><label for="' + name + '">' + label + '</label><input id="' + name + '" name="' + name + '" type="' + (type || "text") + '" required></div>';
  }
  function fieldValue(name, label, value, type) {
    return '<div class="field"><label for="' + name + '">' + label + '</label><input id="' + name + '" type="' + (type || "text") + '" value="' + escapeHtml(value == null ? "" : value) + '"></div>';
  }
  function opt(value, label, selected) {
    return '<option value="' + escapeHtml(value) + '"' + (selected === value ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
  }
  function metric(label, value) {
    return '<article class="card"><div class="quiet">' + escapeHtml(label) + "</div><h3>" + escapeHtml(String(value)) + "</h3></article>";
  }
  function val(id) { return qs("#" + id).value; }
  function showErr(err) {
    var el = qs("#formErr");
    if (el) { el.hidden = false; el.textContent = err.message || String(err); }
    else flash(err.message || String(err), "bad");
  }

  var previewUrl = null;

  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function attachPlayer(audio, blob) {
    revokePreview();
    previewUrl = URL.createObjectURL(blob);
    audio.src = previewUrl;
    audio.hidden = false;
    audio.controls = true;
    audio.controlsList = "nodownload";
    audio.setAttribute("controlslist", "nodownload");
    audio.onended = revokePreview;
  }

  function playAuthorized(id, audio) {
    api.voiceAccess(id).then(function (res) {
      if (res.data.allowDownload !== false || res.data.recording.kind !== "audio") return;
      return window.AmanikahVoiceRishta.getBlob(id).then(function (blob) {
        if (!blob) throw new Error("The recording is not in this browser’s private store.");
        attachPlayer(audio, blob);
        return audio.play();
      });
    }).catch(showErr);
  }

  function renderVoice() {
    requireSession().then(function (session) {
      if (!session) return;
      api.listMatches().then(function (matchRes) {
        return Promise.all([api.voiceMine(), api.voiceReports()]).then(function (pair) {
          var mine = pair[0];
          var reports = pair[1].data.reports || [];
          var people = (matchRes.data.matches || []).map(function (m) {
            return { id: m.candidate.userId, name: m.candidate.displayName };
          });
          var existing = (mine.data.recordings || []).filter(function (r) { return r.status !== "deleted"; });
          root.innerHTML = shell(
            '<p class="kicker">Voice Rishta</p><h1>A short introduction, only if you want one</h1>' +
            '<p class="quiet">Record 30–60 seconds, or write the same introduction. Nothing is published until you confirm. Other members cannot download the file. Listening is not required to express interest.</p>' +
            '<section class="panel studio" aria-label="Recording studio">' +
            '<canvas class="wave" id="wave" width="640" height="96" aria-hidden="true"></canvas>' +
            '<p class="timer" id="voiceClock" aria-live="polite">0:00</p>' +
            '<p class="quiet">Minimum 0:30. The recording stops at 0:60.</p>' +
            '<div class="actions">' +
            '<button class="btn btn-emerald" type="button" id="micBtn">Allow microphone</button>' +
            '<button class="btn btn-gold" type="button" id="recBtn" disabled>Record</button>' +
            '<button class="btn btn-ghost" type="button" id="stopBtn" disabled>Stop</button>' +
            '<button class="btn btn-ghost" type="button" id="playBtn" disabled>Play preview</button>' +
            '<button class="btn btn-ghost" type="button" id="retryBtn" disabled>Record again</button>' +
            '<button class="btn btn-danger" type="button" id="delBtn" disabled>Delete</button>' +
            "</div>" +
            '<progress id="voiceProgress" max="1" value="0" hidden></progress>' +
            '<p class="status" id="voiceState" role="status">The microphone is used only after you allow it.</p>' +
            '<audio id="voicePreview" controls hidden></audio>' +
            "</section>" +
            '<form class="panel" id="publishForm" style="margin-top:16px">' +
            '<h2>Review before publishing</h2>' +
            '<div class="field"><label for="textAlt">Written introduction</label><textarea id="textAlt" required minlength="20" placeholder="The same introduction, in text, for anyone who will not listen."></textarea></div>' +
            '<div class="field"><label for="transcript">Optional transcript</label><textarea id="transcript" placeholder="If you add a transcript, you must review it before publishing."></textarea></div>' +
            '<div class="check"><input id="reviewed" type="checkbox"><label for="reviewed">I reviewed the transcript</label></div>' +
            '<fieldset><legend>Who can hear this</legend>' +
            '<div class="check"><input type="radio" name="vis" id="visPrivate" value="private" checked><label for="visPrivate">Private. Only me.</label></div>' +
            '<div class="check"><input type="radio" name="vis" id="visSelected" value="selected"><label for="visSelected">Selected people, for a limited time</label></div>' +
            people.map(function (p) {
              return '<div class="check"><input type="checkbox" class="recipient" value="' + escapeHtml(p.id) + '" id="to-' + escapeHtml(p.id) + '"><label for="to-' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + "</label></div>";
            }).join("") +
            '<div class="field"><label for="shareDays">Share expires after (days, max 30)</label><input id="shareDays" type="number" min="1" max="30" value="7"></div></fieldset>' +
            '<div class="actions"><button class="btn btn-emerald" type="button" id="publishAudio" disabled>Publish recording</button>' +
            '<button class="btn btn-ghost" type="button" id="publishText">Publish written introduction only</button></div>' +
            '<p class="err" id="formErr" hidden></p></form>' +
            '<section class="panel" style="margin-top:16px"><h2>Your introductions</h2><ul class="list" id="voiceList">' +
            (existing.length ? existing.map(voiceRow).join("") : '<li class="quiet">Nothing published yet.</li>') +
            "</ul></section>" +
            (session.user.role === "admin" ? '<section class="panel" style="margin-top:16px"><h2>Moderation</h2>' +
              (reports.length ? reports.map(function (rep) {
                return '<article class="card"><p>' + escapeHtml(rep.reason) + '</p><button class="btn btn-danger" type="button" data-moderate="' + escapeHtml(rep.recordingId) + '">Remove introduction</button></article>';
              }).join("") : '<p class="quiet">No open reports.</p>') + "</section>" : ""),
            "/voice"
          );
          bindShell();
          wireStudio(existing);
          wireVoiceList();
        });
      }).catch(showErr);
    });
  }

  function voiceRow(rec) {
    var who = rec.visibility === "private" ? "Private" : ("Shared until " + (rec.grants[0] ? rec.grants[0].expiresAt.slice(0, 10) : "—"));
    return "<li><strong>" + escapeHtml(rec.kind) + "</strong> · " + escapeHtml(rec.status) + " · " + escapeHtml(who) +
      "<div>" + escapeHtml(rec.textAlternative || "No written text yet") + "</div>" +
      '<div class="actions"><button class="btn btn-danger btn-sm" type="button" data-voice-del="' + escapeHtml(rec.id) + '">Delete</button>' +
      (rec.visibility === "selected" ? rec.grants.filter(function (g) { return !g.revokedAt; }).map(function (g) {
        return '<button class="btn btn-ghost btn-sm" type="button" data-voice-revoke="' + escapeHtml(rec.id) + '" data-who="' + escapeHtml(g.recipientId) + '">Revoke</button>';
      }).join("") : "") +
      "</div></li>";
  }

  function wireVoiceList() {
    root.querySelectorAll("[data-voice-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-voice-del");
        api.voiceDelete(id).then(function () {
          return window.AmanikahVoiceRishta.deleteBlob(id);
        }).then(function () { revokePreview(); renderVoice(); });
      };
    });
    root.querySelectorAll("[data-voice-revoke]").forEach(function (btn) {
      btn.onclick = function () {
        api.voiceRevoke(btn.getAttribute("data-voice-revoke"), btn.getAttribute("data-who")).then(function () { renderVoice(); });
      };
    });
    root.querySelectorAll("[data-moderate]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-moderate");
        api.voiceModerate(id).then(function () { return window.AmanikahVoiceRishta.deleteBlob(id); }).then(function () { renderVoice(); });
      };
    });
  }

  function paintClock(ms) {
    var total = Math.min(60, Math.max(0, Math.round(ms / 1000)));
    var el = qs("#voiceClock");
    if (el) el.textContent = "0:" + String(total).padStart(2, "0");
  }

  function wireStudio() {
    var Voice = window.AmanikahVoiceRishta;
    if (window.__voiceStudio) window.__voiceStudio.destroy();
    var studio = Voice.createStudio({
      canvas: qs("#wave"),
      onState: onStudio
    });
    window.__voiceStudio = studio;
    var pending = null;
    var draftId = null;
    qs("#micBtn").onclick = function () { studio.requestMic(); };
    qs("#recBtn").onclick = function () { studio.start(); };
    qs("#stopBtn").onclick = function () { studio.stop(); };
    qs("#playBtn").onclick = function () {
      if (!pending) return;
      attachPlayer(qs("#voicePreview"), pending.blob);
    };
    qs("#retryBtn").onclick = function () {
      pending = null;
      draftId = null;
      revokePreview();
      qs("#voicePreview").hidden = true;
      qs("#publishAudio").disabled = true;
      qs("#playBtn").disabled = true;
      qs("#delBtn").disabled = true;
      qs("#voiceState").textContent = "Ready to record again. Nothing was published.";
      paintClock(0);
    };
    qs("#delBtn").onclick = function () {
      var drop = draftId;
      pending = null;
      draftId = null;
      revokePreview();
      qs("#voicePreview").hidden = true;
      qs("#publishAudio").disabled = true;
      var done = drop ? api.voiceDelete(drop).then(function () { return Voice.deleteBlob(drop); }) : Promise.resolve();
      done.then(function () {
        qs("#voiceState").textContent = "Deleted. Nothing is published.";
        paintClock(0);
      });
    };
    qs("#publishAudio").onclick = function () {
      if (!draftId) return;
      api.voicePublish(draftId, publishInput()).then(function () {
        qs("#voiceState").textContent = "Published. It stays private unless you selected people. No file link was created.";
        qs("#publishAudio").disabled = true;
        renderVoice();
      }).catch(showErr);
    };
    qs("#publishText").onclick = function () {
      api.voiceSaveText(val("textAlt")).then(function (res) {
        return api.voicePublish(res.data.recording.id, publishInput());
      }).then(function () {
        qs("#voiceState").textContent = "Written introduction published. Listening is not required.";
        renderVoice();
      }).catch(showErr);
    };
    window.addEventListener("pagehide", function () { studio.destroy(); revokePreview(); }, { once: true });

    function publishInput() {
      var selected = qs("#visSelected").checked;
      return {
        textAlternative: val("textAlt"),
        transcript: val("transcript"),
        transcriptReviewed: qs("#reviewed").checked,
        visibility: selected ? "selected" : "private",
        recipients: selected ? Array.prototype.map.call(document.querySelectorAll(".recipient:checked"), function (el) { return el.value; }) : [],
        shareDays: Number(val("shareDays"))
      };
    }

    function onStudio(name, detail) {
      var status = qs("#voiceState");
      if (name === "requesting") status.textContent = "Asking for the microphone.";
      if (name === "ready") {
        status.textContent = "Microphone ready. Press Record when you want to begin.";
        qs("#recBtn").disabled = false;
      }
      if (name === "recording") {
        paintClock(detail.durationMs);
        status.textContent = "Recording. Stop after 30 seconds, or it will stop at 60.";
        qs("#recBtn").disabled = true;
        qs("#stopBtn").disabled = false;
      }
      if (name === "error") status.textContent = detail.message;
      if (name === "recorded") {
        qs("#stopBtn").disabled = true;
        var checked = Voice.validateAudio(detail);
        pending = detail;
        qs("#playBtn").disabled = false;
        qs("#retryBtn").disabled = false;
        qs("#delBtn").disabled = false;
        paintClock(detail.durationMs);
        if (!checked.ok) {
          status.textContent = checked.message + " You can play it back, then record again. It was not published.";
          qs("#publishAudio").disabled = true;
          return;
        }
        status.textContent = "Checking the recording.";
        var bar = qs("#voiceProgress");
        bar.hidden = false;
        bar.value = 0.1;
        api.voiceSaveDraft({
          durationMs: detail.durationMs,
          byteLength: detail.byteLength,
          mime: detail.mime,
          header: detail.header
        }).then(function (res) {
          draftId = res.data.recording.id;
          bar.value = 0.45;
          status.textContent = "Saving privately on this device.";
          return Voice.putBlob(draftId, detail.blob, function (p) { bar.value = 0.45 + p * 0.5; }).then(function () {
            return api.voiceMarkSaved(draftId);
          }).catch(function () {
            return api.voiceMarkSaveFailed(draftId).then(function () {
              throw new Error("The save failed. Nothing was published. You can try again.");
            });
          });
        }).then(function () {
          bar.value = 1;
          status.textContent = "Preview is ready. It is not published. Add the written introduction, then publish if you want to.";
          qs("#publishAudio").disabled = false;
        }).catch(function (err) {
          status.textContent = err.message || "The save failed. Nothing was published.";
          qs("#publishAudio").disabled = true;
        });
      }
    }
  }

  function bindShell() {
    var nav = qs("#appNav");
    var btn = qs("#menuBtn");
    if (btn && nav) btn.onclick = function () { nav.classList.toggle("open"); };
    root.querySelectorAll("[data-nav]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (!href || href.indexOf("http") === 0) return;
        e.preventDefault();
        go(href);
      });
    });
    var logout = qs("#logoutLink");
    if (logout) logout.onclick = function (e) { e.preventDefault(); api.logout().then(function () { go("/login"); }); };
  }

  function render() {
    var p = path();
    if (p.indexOf("/matches/") === 0) return renderMatches();
    switch (p) {
      case "/register": return renderRegister();
      case "/login": return renderLogin();
      case "/onboarding": return renderOnboarding();
      case "/dashboard": return renderDashboard();
      case "/matches": return renderMatches();
      case "/introductions": return renderIntroductions();
      case "/messages": return renderMessages();
      case "/family": return renderFamily();
      case "/family-assistant": return renderFamilyAssistant();
      case "/voice": return renderVoice();
      case "/verification": return renderVerification();
      case "/settings": return renderSettings();
      case "/safety": return renderSafety();
      default:
        go("/dashboard");
    }
  }

  window.addEventListener("popstate", render);
  document.addEventListener("DOMContentLoaded", function () {
    // Import Nikah readiness / simple nikah prefs if present for onboarding convenience
    render();
  });
})();
