(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./acl.js"),
      require("./demo-data.js")
    );
  } else {
    root.AmanikahAPI = factory(root.AmanikahACL, root.AmanikahDemoData);
  }
})(typeof self !== "undefined" ? self : this, function (ACL, DemoData) {
  "use strict";

  var STORAGE_KEY = "amanikah.membership.demo.v1";
  var SESSION_KEY = "amanikah.membership.session.v1";

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function migrate(state) {
    var changed = false;
    if (!state.featureFlags) {
      state.featureFlags = { familyAssistant: false };
      changed = true;
    }
    if (!state.voiceRecordings) {
      state.voiceRecordings = [];
      changed = true;
    }
    (state.users || []).forEach(function (user) {
      var role = user.id === "demo-user-self" ? "admin" : "member";
      if (!user.role) {
        user.role = role;
        changed = true;
      }
    });
    if (changed) saveState(state);
    return state;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = migrate(JSON.parse(raw));
        if (window.AmanikahVoiceRishta) {
          var purged = window.AmanikahVoiceRishta.purgeExpired(parsed);
          if (purged.changed) saveState(parsed);
        }
        return parsed;
      }
    } catch (err) {}
    var seeded = DemoData.seed();
    saveState(seeded);
    return seeded;
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) {}
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (err) { return null; }
  }

  function setSession(session) {
    if (!session) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function currentUser(state) {
    var session = getSession();
    if (!session || !session.userId) return null;
    var user = (state.users || []).find(function (u) { return u.id === session.userId; });
    return user || null;
  }

  function fail(code, message) {
    var err = new Error(message || code);
    err.code = code;
    return Promise.reject(err);
  }

  function ok(data) {
    return Promise.resolve({ ok: true, mode: DemoData.MODE, data: data });
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: !!user.emailVerified,
      phoneVerified: !!user.phoneVerified,
      onboardingComplete: !!user.onboardingComplete,
      isDemo: !!user.isDemo,
      role: user.role || "member",
      createdAt: user.createdAt
    };
  }

  var api = {
    mode: function () { return DemoData.MODE; },

    resetDemo: function () {
      var seeded = DemoData.seed();
      saveState(seeded);
      setSession(null);
      return ok({ reset: true });
    },

    register: function (input) {
      var state = loadState();
      input = input || {};
      var email = String(input.email || "").trim().toLowerCase();
      var password = String(input.password || "");
      var age = Number(input.age);
      var jurisdiction = String(input.jurisdiction || "").trim().toUpperCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("INVALID_EMAIL", "Enter a valid email.");
      if (password.length < 8) return fail("WEAK_PASSWORD", "Use at least 8 characters.");
      if (!(age >= 21 && age <= 80)) return fail("AGE", "Amanikah is for adults aged 21 to 80.");
      if (!jurisdiction) return fail("JURISDICTION", "Select your jurisdiction.");
      if (!input.consentTerms || !input.consentPrivacy) return fail("CONSENT", "Terms and privacy consent are required.");
      if ((state.users || []).some(function (u) { return u.email === email && !u.deletedAt; })) {
        return fail("EXISTS", "An account with this email already exists in demo storage.");
      }
      var id = uid("user");
      var now = new Date().toISOString();
      var user = {
        id: id,
        email: email,
        phone: String(input.phone || ""),
        password: password,
        createdAt: now,
        emailVerified: false,
        phoneVerified: false,
        onboardingComplete: false,
        deletedAt: null,
        isDemo: true,
        role: "member"
      };
      state.users.push(user);
      state.profiles.push({
        userId: id,
        displayName: String(input.displayName || "New member (Demo)").slice(0, 40),
        isDemo: true,
        age: age,
        jurisdiction: jurisdiction,
        city: "",
        educationLevel: "",
        workSummary: "",
        relocation: "",
        weddingStyle: "",
        familyInvolvement: "",
        intentions: "",
        simpleNikah: false,
        nikahReadiness: null,
        visibility: "private",
        shareContactAfterMutual: false,
        email: email,
        phone: String(input.phone || ""),
        familyInvolvementOptIn: false,
        verificationBadges: [],
        completion: 15,
        matchReasons: []
      });
      state.memberships.push({ userId: id, tier: "introduction", status: "active", label: "Free introduction (demo)" });
      state.consents[id] = { terms: true, privacy: true, withdrawn: false, updatedAt: now };
      state.activity.push({ id: uid("act"), userId: id, text: "Demo account created", at: now });
      saveState(state);
      setSession({ userId: id, at: now });
      return ok({ user: publicUser(user), next: "/onboarding" });
    },

    login: function (input) {
      var state = loadState();
      var email = String((input && input.email) || "").trim().toLowerCase();
      var password = String((input && input.password) || "");
      var user = (state.users || []).find(function (u) { return u.email === email && !u.deletedAt; });
      if (!user || user.password !== password) return fail("AUTH", "Email or password is incorrect.");
      setSession({ userId: user.id, at: new Date().toISOString() });
      return ok({
        user: publicUser(user),
        next: user.onboardingComplete ? "/dashboard" : "/onboarding"
      });
    },

    logout: function () {
      setSession(null);
      return ok({ loggedOut: true });
    },

    me: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var profile = ACL.profileOf(state, user.id);
      var membership = ACL.membershipOf(state, user.id);
      return ok({
        user: publicUser(user),
        profile: profile,
        membership: membership,
        mode: DemoData.MODE,
        consent: (state.consents || {})[user.id] || null
      });
    },

    verifyContact: function (channel) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      if (channel === "email") user.emailVerified = true;
      if (channel === "phone") user.phoneVerified = true;
      state.activity.push({
        id: uid("act"),
        userId: user.id,
        text: "Demo " + channel + " verification marked complete (no real message sent)",
        at: new Date().toISOString()
      });
      saveState(state);
      return ok({ user: publicUser(user), demo: true });
    },

    saveOnboarding: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      input = input || {};
      if (!(Number(input.age) >= 21)) return fail("AGE", "Adult age confirmation required.");
      if (!input.jurisdiction) return fail("JURISDICTION", "Jurisdiction required.");
      if (!user.emailVerified && !user.phoneVerified) {
        return fail("VERIFY", "Verify email or phone before finishing onboarding (demo button available).");
      }
      var profile = ACL.profileOf(state, user.id);
      profile.displayName = String(input.displayName || profile.displayName).slice(0, 40);
      profile.age = Number(input.age);
      profile.jurisdiction = String(input.jurisdiction).toUpperCase();
      profile.intentions = String(input.intentions || "").slice(0, 500);
      profile.city = String(input.city || "").slice(0, 80);
      profile.educationLevel = String(input.educationLevel || "");
      profile.workSummary = String(input.workSummary || "").slice(0, 200);
      profile.relocation = String(input.relocation || "");
      profile.weddingStyle = String(input.weddingStyle || "");
      profile.familyInvolvement = String(input.familyInvolvement || "");
      profile.simpleNikah = !!input.simpleNikah;
      profile.familyInvolvementOptIn = !!input.familyInvolvementOptIn;
      profile.visibility = input.visibility === "unlisted" ? "unlisted" : "private";
      profile.nikahReadiness = input.nikahReadiness || profile.nikahReadiness;
      profile.completion = 100;
      profile.isDemo = true;
      user.onboardingComplete = true;
      state.activity.push({ id: uid("act"), userId: user.id, text: "Onboarding completed (demo)", at: new Date().toISOString() });
      // Give curated demo matches if none
      var hasMatches = (state.matches || []).some(function (m) { return m.userId === user.id; });
      if (!hasMatches) {
        ["demo-user-amina", "demo-user-yusuf", "demo-user-sara"].forEach(function (candidateId, i) {
          if (candidateId === user.id) return;
          state.matches.push({
            id: uid("match"),
            userId: user.id,
            candidateId: candidateId,
            weekOf: "2026-11-10",
            status: "suggested"
          });
        });
      }
      saveState(state);
      return ok({ profile: profile, next: "/dashboard" });
    },

    dashboard: function () {
      var state = loadState();
      var user = currentUser(state);
      var gate = ACL.canViewOwnDashboard(user);
      if (!gate.ok) return fail(gate.code, gate.message);
      var profile = ACL.profileOf(state, user.id);
      var membership = ACL.membershipOf(state, user.id);
      var pending = (state.introductions || []).filter(function (i) {
        return (i.from === user.id || i.to === user.id) && i.status === "pending";
      });
      var suggested = (state.matches || []).filter(function (m) {
        return m.userId === user.id && m.status === "suggested";
      }).slice(0, 3);
      var activity = (state.activity || []).filter(function (a) { return a.userId === user.id; }).slice(-8).reverse();
      var familyInvites = (state.familyInvites || []).filter(function (f) { return f.fromUserId === user.id; });
      var verificationRequests = (state.verificationRequests || []).filter(function (v) { return v.userId === user.id; });
      return ok({
        profile: profile,
        membership: membership,
        privacy: { visibility: profile.visibility, defaultPrivate: true },
        suggestedIntroductions: suggested.map(function (m) {
          var p = ACL.filterProfile(ACL.profileOf(state, m.candidateId), "suggestion");
          return { matchId: m.id, candidate: p, reasons: (p && p.matchReasons) || [] };
        }),
        pendingRequests: pending,
        recentActivity: activity,
        verificationRequests: verificationRequests,
        familyInvites: familyInvites,
        mode: DemoData.MODE
      });
    },

    listMatches: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var list = (state.matches || []).filter(function (m) { return m.userId === user.id; }).map(function (m) {
        var access = ACL.canViewProfile(state, user, m.candidateId, { asMatchSuggestion: true });
        if (!access.ok) return null;
        var candidate = ACL.filterProfile(ACL.profileOf(state, m.candidateId), access.level);
        var intro = ACL.introductionBetween(state, user.id, m.candidateId);
        return {
          id: m.id,
          status: m.status,
          weekOf: m.weekOf,
          candidate: candidate,
          reasons: (candidate && candidate.matchReasons) || [],
          introductionStatus: intro ? intro.status : "none",
          differences: differences(ACL.profileOf(state, user.id), ACL.profileOf(state, m.candidateId))
        };
      }).filter(Boolean);
      return ok({ matches: list, note: "Curated weekly-style list (demo). Not endless swiping." });
    },

    getMatch: function (matchId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var match = (state.matches || []).find(function (m) { return m.id === matchId && m.userId === user.id; });
      if (!match) return fail("NOT_FOUND", "Match not found.");
      var access = ACL.canViewProfile(state, user, match.candidateId, { asMatchSuggestion: true });
      if (!access.ok) return fail(access.code, access.message);
      var mine = ACL.profileOf(state, user.id);
      var theirs = ACL.profileOf(state, match.candidateId);
      var intro = ACL.introductionBetween(state, user.id, match.candidateId);
      var contact = ACL.canSeeContactDetails(state, user, match.candidateId);
      return ok({
        match: match,
        candidate: ACL.filterProfile(theirs, access.level),
        reasons: theirs.matchReasons || [],
        aligned: aligned(mine, theirs),
        differences: differences(mine, theirs),
        introduction: intro || null,
        contact: contact.ok ? { phone: theirs.phone, email: theirs.email } : null,
        contactDenied: contact.ok ? null : contact,
        mode: DemoData.MODE
      });
    },

    requestIntroduction: function (candidateId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      if (ACL.isBlocked(state, user.id, candidateId)) return fail("BLOCKED", "You cannot introduce while blocked.");
      var existing = ACL.introductionBetween(state, user.id, candidateId);
      if (existing && (existing.status === "pending" || existing.status === "accepted")) {
        return fail("EXISTS", "An introduction already exists.");
      }
      var intro = {
        id: uid("intro"),
        from: user.id,
        to: candidateId,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 21 * 864e5).toISOString(),
        fromAccepted: true,
        toAccepted: false
      };
      state.introductions.push(intro);
      state.activity.push({ id: uid("act"), userId: user.id, text: "Introduction requested (demo)", at: intro.createdAt });
      saveState(state);
      return ok({ introduction: intro });
    },

    respondIntroduction: function (introductionId, decision) {
      var state = loadState();
      var user = currentUser(state);
      var gate = ACL.canRespondToIntroduction(state, user, introductionId);
      if (!gate.ok) return fail(gate.code, gate.message);
      var intro = gate.introduction;
      if (decision === "decline") {
        intro.status = "declined";
        intro.toAccepted = false;
      } else if (decision === "withdraw") {
        if (intro.from !== user.id) return fail("FORBIDDEN", "Only the requester can withdraw.");
        intro.status = "withdrawn";
      } else if (decision === "accept") {
        if (intro.to === user.id) intro.toAccepted = true;
        if (intro.from === user.id) intro.fromAccepted = true;
        if (intro.fromAccepted && intro.toAccepted) intro.status = "accepted";
        else intro.status = "pending";
      } else if (decision === "expire") {
        intro.status = "expired";
      } else {
        return fail("INVALID", "Unknown decision.");
      }
      state.activity.push({
        id: uid("act"),
        userId: user.id,
        text: "Introduction " + intro.status + " (demo)",
        at: new Date().toISOString()
      });
      saveState(state);
      return ok({ introduction: intro, mutual: intro.status === "accepted" });
    },

    listIntroductions: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var list = (state.introductions || []).filter(function (i) {
        return i.from === user.id || i.to === user.id;
      }).map(function (i) {
        var peerId = i.from === user.id ? i.to : i.from;
        var peer = ACL.filterProfile(ACL.profileOf(state, peerId), "suggestion");
        return { introduction: i, peer: peer };
      });
      return ok({ introductions: list });
    },

    listThreads: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var peers = {};
      (state.introductions || []).forEach(function (i) {
        if (i.status !== "accepted") return;
        if (i.from !== user.id && i.to !== user.id) return;
        var peerId = i.from === user.id ? i.to : i.from;
        peers[peerId] = true;
      });
      var threads = Object.keys(peers).map(function (peerId) {
        var gate = ACL.canMessage(state, user, peerId);
        return {
          peerId: peerId,
          peer: ACL.filterProfile(ACL.profileOf(state, peerId), gate.ok ? "full" : "suggestion"),
          canMessage: gate.ok,
          reason: gate.ok ? null : gate.message
        };
      });
      return ok({ threads: threads });
    },

    listMessages: function (peerId) {
      var state = loadState();
      var user = currentUser(state);
      var gate = ACL.canMessage(state, user, peerId);
      if (!gate.ok) return fail(gate.code, gate.message);
      var msgs = (state.messages || []).filter(function (m) {
        return (m.from === user.id && m.to === peerId) || (m.from === peerId && m.to === user.id);
      });
      return ok({ messages: msgs });
    },

    sendMessage: function (peerId, body) {
      var state = loadState();
      var user = currentUser(state);
      var gate = ACL.canMessage(state, user, peerId);
      if (!gate.ok) return fail(gate.code, gate.message);
      var text = String(body || "").trim();
      if (text.length < 1) return fail("EMPTY", "Message cannot be empty.");
      var msg = {
        id: uid("msg"),
        from: user.id,
        to: peerId,
        body: text.slice(0, 2000),
        at: new Date().toISOString(),
        isDemo: true
      };
      state.messages.push(msg);
      saveState(state);
      return ok({ message: msg });
    },

    createFamilyInvite: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var invite = {
        id: uid("fam"),
        fromUserId: user.id,
        relativeLabel: String((input && input.relativeLabel) || "Family member").slice(0, 40),
        status: "pending",
        createdAt: new Date().toISOString(),
        note: "Invitee must create their own profile. No biodata upload by relatives.",
        isDemo: true
      };
      state.familyInvites.push(invite);
      saveState(state);
      return ok({ invite: invite, link: "/register?familyInvite=" + invite.id });
    },

    listFamily: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var invites = (state.familyInvites || []).filter(function (f) { return f.fromUserId === user.id; });
      return ok({ invites: invites });
    },

    requestVerification: function (input) {
      var state = loadState();
      var user = currentUser(state);
      var gate = ACL.canRequestVerification(state, user);
      if (!gate.ok) return fail(gate.code, gate.message);
      var req = {
        id: uid("ver"),
        userId: user.id,
        scope: String((input && input.scope) || "education"),
        status: "quoted",
        note: "Demo only. Fee would be confirmed before work. Not processed online.",
        createdAt: new Date().toISOString(),
        isDemo: true
      };
      state.verificationRequests.push(req);
      saveState(state);
      return ok({ request: req });
    },

    listVerification: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      return ok({
        requests: (state.verificationRequests || []).filter(function (v) { return v.userId === user.id; })
      });
    },

    updateSettings: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var profile = ACL.profileOf(state, user.id);
      if (input.visibility) profile.visibility = input.visibility === "unlisted" ? "unlisted" : "private";
      if (typeof input.shareContactAfterMutual === "boolean") {
        profile.shareContactAfterMutual = input.shareContactAfterMutual;
      }
      if (typeof input.familyInvolvementOptIn === "boolean") {
        profile.familyInvolvementOptIn = input.familyInvolvementOptIn;
      }
      saveState(state);
      return ok({ profile: profile });
    },

    exportData: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      return ok({
        exportedAt: new Date().toISOString(),
        user: publicUser(user),
        profile: ACL.profileOf(state, user.id),
        introductions: (state.introductions || []).filter(function (i) { return i.from === user.id || i.to === user.id; }),
        messages: (state.messages || []).filter(function (m) { return m.from === user.id || m.to === user.id; }),
        consents: (state.consents || {})[user.id] || null,
        voice: window.AmanikahVoiceRishta ? window.AmanikahVoiceRishta.mine(state, user) : null,
        notice: "Demo export from this browser only. Audio bytes are not included and no storage URL is issued."
      });
    },

    withdrawConsent: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      state.consents[user.id] = {
        terms: false,
        privacy: false,
        withdrawn: true,
        updatedAt: new Date().toISOString()
      };
      var profile = ACL.profileOf(state, user.id);
      profile.visibility = "private";
      profile.shareContactAfterMutual = false;
      saveState(state);
      return ok({ withdrawn: true });
    },

    deleteAccount: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      user.deletedAt = new Date().toISOString();
      user.email = "deleted-" + user.id + "@amanikah.demo";
      user.password = "";
      var profile = ACL.profileOf(state, user.id);
      if (profile) {
        profile.displayName = "Deleted demo member";
        profile.email = "";
        profile.phone = "";
        profile.visibility = "private";
      }
      state.messages = (state.messages || []).filter(function (m) { return m.from !== user.id && m.to !== user.id; });
      var voiceKeys = window.AmanikahVoiceRishta ? window.AmanikahVoiceRishta.deleteAllForOwner(state, user.id) : [];
      setSession(null);
      saveState(state);
      return ok({ deleted: true, voiceKeys: voiceKeys });
    },

    blockUser: function (targetUserId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      if (user.id === targetUserId) return fail("INVALID", "Cannot block yourself.");
      state.blocks.push({ id: uid("block"), from: user.id, to: targetUserId, at: new Date().toISOString() });
      var intro = ACL.introductionBetween(state, user.id, targetUserId);
      if (intro && intro.status === "accepted") intro.status = "withdrawn";
      saveState(state);
      return ok({ blocked: true });
    },

    setFamilyAssistantFlag: function (enabled) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.setFlag(state, user, enabled);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantState: function (ownerId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var target = ownerId || user.id;
      var gate = window.AmanikahFamilyAssistant.access(state, user, target);
      if (!window.AmanikahFamilyAssistant.flagOn(state) && user.role !== "admin") {
        return fail("FLAG_OFF", "Family Assistant is turned off.");
      }
      if (!gate.ok && gate.code !== "FLAG_OFF" && gate.code !== "CONSENT_REVOKED") return fail(gate.code, gate.message);
      return ok({
        enabled: window.AmanikahFamilyAssistant.flagOn(state),
        role: user.role,
        access: gate,
        audit: (state.audit || []).filter(function (row) { return row.actorId === user.id; }).slice(-20)
      });
    },

    familyAssistantGrant: function (fields) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var profile = ACL.profileOf(state, user.id);
      var result = window.AmanikahFamilyAssistant.grantFields(state, { id: user.id, profile: profile }, fields);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantInvite: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.inviteRelative(state, user, input);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantRevokeInvite: function (inviteId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.revokeInvite(state, user, inviteId);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantAsk: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var ownerId = (input && input.ownerId) || user.id;
      var result = window.AmanikahFamilyAssistant.ask(state, user, ownerId, input || {});
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantSaveDraft: function (text) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.saveDraft(state, user, user.id, text);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantReport: function (reason) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.reportOutput(state, user, user.id, reason);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantRevokeConsent: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.revokeConsent(state, user);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    familyAssistantDelete: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahFamilyAssistant.deleteWorkspace(state, user);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceMine: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      return ok(window.AmanikahVoiceRishta.mine(state, user));
    },

    voiceSaveDraft: function (input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.createAudioDraft(state, user, input || {});
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceMarkSaved: function (id) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.markSaved(state, user, id);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceMarkSaveFailed: function (id) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.markSaveFailed(state, user, id);
      saveState(state);
      return fail(result.code, result.message);
    },

    voicePublish: function (id, input) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.publish(state, user, id, input || {});
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceSaveText: function (text) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.createTextDraft(state, user, text);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceAccess: function (id) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.canAccess(state, user, id);
      if (!result.ok) return fail(result.code, result.message);
      return ok(result);
    },

    voiceDelete: function (id) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.removeLocal(state, user, id);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceRevoke: function (id, recipientId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.revokeGrant(state, user, id, recipientId);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceReport: function (id, reason) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.report(state, user, id, reason);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceModerate: function (id) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var result = window.AmanikahVoiceRishta.moderateRemove(state, user, id);
      if (!result.ok) return fail(result.code, result.message);
      saveState(state);
      return ok(result);
    },

    voiceReports: function () {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      if (user.role !== "admin") return ok({ reports: [] });
      var reports = [];
      (state.voiceRecordings || []).forEach(function (rec) {
        if (rec.status !== "published") return;
        (rec.reports || []).forEach(function (rep) {
          reports.push({ recordingId: rec.id, from: rep.from, reason: rep.reason, at: rep.at });
        });
      });
      return ok({ reports: reports });
    },

    voiceSharedFrom: function (ownerId) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      var rows = (state.voiceRecordings || []).filter(function (rec) { return rec.ownerId === ownerId; });
      var visible = [];
      rows.forEach(function (rec) {
        var gate = window.AmanikahVoiceRishta.canAccess(state, user, rec.id);
        if (gate.ok) visible.push(gate.recording);
      });
      return ok({ recordings: visible, listeningRequired: false });
    },

    reportUser: function (targetUserId, reason) {
      var state = loadState();
      var user = currentUser(state);
      if (!user) return fail("UNAUTHENTICATED", "Sign in required.");
      state.reports.push({
        id: uid("report"),
        from: user.id,
        to: targetUserId,
        reason: String(reason || "unspecified").slice(0, 500),
        at: new Date().toISOString(),
        isDemo: true,
        note: "Stored in demo browser storage only. No safety team receives this yet."
      });
      saveState(state);
      return ok({ reported: true });
    },

    // Test helper: simulate peer accepting
    demoAcceptAsPeer: function (introductionId, peerId) {
      var state = loadState();
      var intro = (state.introductions || []).find(function (i) { return i.id === introductionId; });
      if (!intro) return fail("NOT_FOUND", "Introduction not found.");
      if (intro.to !== peerId && intro.from !== peerId) return fail("FORBIDDEN", "Peer mismatch.");
      if (intro.to === peerId) intro.toAccepted = true;
      if (intro.from === peerId) intro.fromAccepted = true;
      if (intro.fromAccepted && intro.toAccepted) intro.status = "accepted";
      saveState(state);
      return ok({ introduction: intro });
    },

    _test: {
      loadState: loadState,
      saveState: saveState,
      setSession: setSession,
      ACL: ACL
    }
  };

  function aligned(a, b) {
    if (!a || !b) return [];
    var out = [];
    if (a.simpleNikah && b.simpleNikah) out.push("Both marked SimpleNikah interest");
    if (a.weddingStyle && a.weddingStyle === b.weddingStyle) out.push("Wedding style: " + a.weddingStyle);
    if (a.familyInvolvement && a.familyInvolvement === b.familyInvolvement) out.push("Family involvement: " + a.familyInvolvement);
    if (a.relocation && a.relocation === b.relocation) out.push("Relocation: " + a.relocation);
    return out;
  }

  function differences(a, b) {
    if (!a || !b) return [];
    var out = [];
    if (a.weddingStyle && b.weddingStyle && a.weddingStyle !== b.weddingStyle) {
      out.push("Wedding style differs (“" + a.weddingStyle + "” vs “" + b.weddingStyle + "”)");
    }
    if (a.familyInvolvement && b.familyInvolvement && a.familyInvolvement !== b.familyInvolvement) {
      out.push("Family involvement timing differs");
    }
    if (a.relocation && b.relocation && a.relocation !== b.relocation) {
      out.push("Relocation preferences differ");
    }
    if (!!a.simpleNikah !== !!b.simpleNikah) out.push("SimpleNikah preference differs");
    return out;
  }

  return api;
});
