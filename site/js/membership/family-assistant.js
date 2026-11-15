(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AmanikahFamilyAssistant = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FACT_FIELDS = ["displayName", "city", "education", "work", "relocation", "weddingStyle", "intentions"];
  var NEVER_INVENT = ["employment", "property", "education", "maritalHistory", "finances", "salary", "honesty", "character"];
  var INJECTION = /ignore (all |any |previous )?instructions|system prompt|you are now|<\s*script|jailbreak|reveal the prompt/i;
  var RATE_LIMIT = 8;
  var DAILY_COST_CAP = 12;

  var COPY = {
    en: {
      dir: "ltr",
      questions: [
        "What does a respectful first family meeting look like for you?",
        "Which practical questions should wait until both adults agree?",
        "How should mahr be discussed without treating it as dowry?"
      ],
      accept: "Thank you for the introduction. We would like to continue the conversation at a calm pace, with only the details both adults have agreed to share.",
      decline: "Thank you for the introduction. We will not continue at this time. We wish you well and ask that shared details stay private.",
      prep: ["Confirm who will attend", "Agree which details may be mentioned", "Leave unknown facts as questions, not assumptions"]
    },
    hi: {
      dir: "ltr",
      questions: [
        "आपके लिए सम्मानजनक पहली पारिवारिक मुलाकात कैसी हो?",
        "कौन से व्यावहारिक प्रश्न दोनों की सहमति तक रुकें?",
        "महर की बात दहेज से अलग कैसे रखें?"
      ],
      accept: "परिचय के लिए धन्यवाद। हम शांत गति से बात आगे बढ़ाना चाहेंगे, केवल उन्हीं विवरणों के साथ जिनकी दोनों वयस्कों ने अनुमति दी है।",
      decline: "परिचय के लिए धन्यवाद। हम इस समय आगे नहीं बढ़ेंगे। साझा विवरण निजी रहें।"
    },
    ur: {
      dir: "rtl",
      questions: [
        "آپ کے لیے باعزت پہلی خاندانی ملاقات کیسی ہو؟",
        "کون سے عملی سوالات دونوں کی رضامندی تک رکے رہیں؟",
        "مہر کی بات جہیز سے الگ کیسے رکھی جائے؟"
      ],
      accept: "تعارف کا شکریہ۔ ہم سکون سے بات آگے بڑھانا چاہیں گے، صرف ان تفصیلات کے ساتھ جن کی دونوں بالغوں نے اجازت دی ہے۔",
      decline: "تعارف کا شکریہ۔ ہم اس وقت آگے نہیں بڑھیں گے۔ شیئر کی گئی تفصیلات نجی رہیں۔"
    }
  };

  function nowIso() { return new Date().toISOString(); }

  function audit(state, entry) {
    state.audit = state.audit || [];
    state.audit.push(Object.assign({ at: nowIso() }, entry));
  }

  function isAdmin(user) { return !!(user && user.role === "admin"); }

  function flagOn(state) {
    return !!(state.featureFlags && state.featureFlags.familyAssistant === true);
  }

  function setFlag(state, actor, enabled) {
    if (!isAdmin(actor)) return { ok: false, code: "FORBIDDEN", message: "Only an administrator can change this feature flag." };
    state.featureFlags = state.featureFlags || {};
    state.featureFlags.familyAssistant = !!enabled;
    audit(state, { action: "feature_flag", actorId: actor.id, enabled: !!enabled });
    return { ok: true, enabled: !!enabled };
  }

  function workspaceFor(state, ownerId) {
    return (state.workspaces || []).find(function (w) { return w.ownerId === ownerId && !w.deletedAt; }) || null;
  }

  function ensureWorkspace(state, owner) {
    var existing = workspaceFor(state, owner.id);
    if (existing) return existing;
    var created = {
      id: "ws-" + owner.id,
      ownerId: owner.id,
      lang: "en",
      permitted: [],
      invites: [],
      history: [],
      drafts: {},
      reports: [],
      consent: true,
      deletedAt: null
    };
    state.workspaces = state.workspaces || [];
    state.workspaces.push(created);
    audit(state, { action: "workspace_created", actorId: owner.id, workspaceId: created.id });
    return created;
  }

  function classifyProfile(profile) {
    if (!profile) return [];
    var rows = [];
    function add(field, value, source) {
      if (value === undefined || value === null || value === "") return;
      rows.push({ field: field, value: String(value), source: source });
    }
    add("displayName", profile.displayName, "self_reported");
    add("city", profile.city, "self_reported");
    add("education", profile.educationLevel, "self_reported");
    add("work", profile.workSummary, "self_reported");
    add("relocation", profile.relocation, "self_reported");
    add("weddingStyle", profile.weddingStyle, "self_reported");
    add("intentions", profile.intentions, "self_reported");
    return rows.filter(function (row) { return FACT_FIELDS.indexOf(row.field) !== -1; });
  }

  function grantFields(state, actor, fields) {
    if (!flagOn(state)) return { ok: false, code: "FLAG_OFF", message: "Family Assistant is turned off." };
    var ws = ensureWorkspace(state, actor);
    if (!ws.consent) return { ok: false, code: "CONSENT_REVOKED", message: "Consent was withdrawn." };
    var available = classifyProfile(actor.profile || {});
    var allowed = {};
    available.forEach(function (row) { allowed[row.field] = row; });
    var permitted = [];
    (fields || []).forEach(function (field) {
      if (allowed[field]) permitted.push(allowed[field]);
    });
    ws.permitted = permitted;
    audit(state, { action: "fields_granted", actorId: actor.id, fields: permitted.map(function (p) { return p.field; }) });
    return { ok: true, permitted: permitted.slice() };
  }

  function inviteRelative(state, actor, input) {
    if (!flagOn(state)) return { ok: false, code: "FLAG_OFF", message: "Family Assistant is turned off." };
    var ws = ensureWorkspace(state, actor);
    var invite = {
      id: "finv-" + Math.random().toString(36).slice(2, 8),
      label: String((input && input.label) || "Family").slice(0, 40),
      relativeUserId: (input && input.relativeUserId) || null,
      status: "active",
      scopes: (ws.permitted || []).map(function (p) { return p.field; })
    };
    ws.invites.push(invite);
    audit(state, { action: "family_invited", actorId: actor.id, inviteId: invite.id });
    return { ok: true, invite: invite };
  }

  function revokeInvite(state, actor, inviteId) {
    var ws = workspaceFor(state, actor.id);
    if (!ws) return { ok: false, code: "NOT_FOUND" };
    var invite = (ws.invites || []).find(function (i) { return i.id === inviteId; });
    if (!invite) return { ok: false, code: "NOT_FOUND" };
    invite.status = "revoked";
    invite.scopes = [];
    audit(state, { action: "invite_revoked", actorId: actor.id, inviteId: inviteId });
    return { ok: true, invite: invite };
  }

  function access(state, actor, ownerId) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED" };
    if (!flagOn(state)) return { ok: false, code: "FLAG_OFF" };
    var ws = workspaceFor(state, ownerId);
    if (!ws) {
      if (actor.id === ownerId) return { ok: true, role: "adult", workspace: null, permitted: [] };
      return { ok: false, code: "FORBIDDEN", message: "This family workspace is not shared with you." };
    }
    if (!ws.consent) return { ok: false, code: "CONSENT_REVOKED", message: "The adult withdrew consent." };
    if (actor.id === ownerId) return { ok: true, role: "adult", workspace: ws, permitted: ws.permitted.slice() };
    var invite = (ws.invites || []).find(function (i) {
      return i.status === "active" && i.relativeUserId === actor.id;
    });
    if (!invite) return { ok: false, code: "FORBIDDEN", message: "This family workspace is not shared with you." };
    var permitted = (ws.permitted || []).filter(function (row) {
      return invite.scopes.indexOf(row.field) !== -1;
    });
    return { ok: true, role: "family", workspace: ws, permitted: permitted };
  }

  function detectInjection(text) {
    return INJECTION.test(String(text || ""));
  }

  function rateOk(state, actorId) {
    var bucket = (state.rate || {})[actorId] || [];
    var cutoff = Date.now() - 3600000;
    bucket = bucket.filter(function (ts) { return ts > cutoff; });
    state.rate = state.rate || {};
    state.rate[actorId] = bucket;
    if (bucket.length >= RATE_LIMIT) return false;
    var spend = (state.cost || {})[actorId] || { day: new Date().toISOString().slice(0, 10), units: 0 };
    if (spend.day !== new Date().toISOString().slice(0, 10)) spend = { day: new Date().toISOString().slice(0, 10), units: 0 };
    state.cost = state.cost || {};
    state.cost[actorId] = spend;
    return spend.units < DAILY_COST_CAP;
  }

  function charge(state, actorId) {
    state.rate[actorId].push(Date.now());
    state.cost[actorId].units += 1;
  }

  function unanswered(permitted) {
    var known = {};
    (permitted || []).forEach(function (row) { known[row.field] = true; });
    var gaps = ["employment", "property", "maritalHistory", "finances"];
    FACT_FIELDS.forEach(function (field) {
      if (!known[field]) gaps.push(field);
    });
    return gaps.map(function (field) {
      return { field: field, source: "unknown", note: "Not shared. Do not assume a value." };
    });
  }

  function rulesDraft(permitted, lang, note) {
    var copy = COPY[lang] || COPY.en;
    return {
      kind: "rules_draft",
      aiGenerated: false,
      label: "Prepared only from permitted details. This is not a live model response and not a suitability judgement.",
      language: lang,
      summary: (permitted || []).map(function (row) {
        return { field: row.field, value: row.value, source: row.source };
      }),
      unanswered: unanswered(permitted),
      meetingQuestions: copy.questions,
      discussionChecklist: [
        "Review only the fields the adult permitted",
        note ? "Adult note: " + String(note).slice(0, 240) : "Add your own discussion points"
      ],
      verificationNotes: [{
        source: "unknown",
        text: "No completed document check is attached. Self-reported lines are not verified facts."
      }],
      acceptTemplate: copy.accept,
      declineTemplate: copy.decline,
      meetingPrep: copy.prep || COPY.en.prep,
      rejectedClaims: []
    };
  }

  function validateModelOutput(raw, permitted) {
    var allowed = {};
    (permitted || []).forEach(function (row) { allowed[row.field] = row; });
    var summary = [];
    var rejected = [];
    ((raw && raw.summary) || []).forEach(function (item) {
      var src = allowed[item.field];
      if (!src || String(item.value) !== String(src.value) || item.source !== src.source) {
        rejected.push(item.field || "unknown");
        return;
      }
      if (NEVER_INVENT.indexOf(item.field) !== -1 && !src) {
        rejected.push(item.field);
        return;
      }
      summary.push({ field: src.field, value: src.value, source: src.source });
    });
    NEVER_INVENT.forEach(function (field) {
      if (!allowed[field] && raw && raw[field]) rejected.push(field);
    });
    return { summary: summary, rejected: rejected };
  }

  function ask(state, actor, ownerId, input) {
    var gate = access(state, actor, ownerId);
    if (!gate.ok) return gate;
    if (!gate.workspace && gate.role === "adult") {
      gate.workspace = ensureWorkspace(state, actor);
      gate.permitted = gate.workspace.permitted.slice();
    }
    input = input || {};
    if (detectInjection(input.note) || detectInjection(input.prompt)) {
      audit(state, { action: "injection_blocked", actorId: actor.id });
      return { ok: false, code: "INJECTION_BLOCKED", message: "That note was blocked because it tried to override the assistant rules." };
    }
    if (!rateOk(state, actor.id)) {
      return { ok: false, code: "RATE_LIMITED", message: "Assistant limit reached for now. Try again later." };
    }
    var lang = COPY[input.lang] ? input.lang : (gate.workspace.lang || "en");
    var draft = rulesDraft(gate.permitted, lang, input.note);
    if (input.modelOutput) {
      var checked = validateModelOutput(input.modelOutput, gate.permitted);
      draft.summary = checked.summary;
      draft.rejectedClaims = checked.rejected;
      draft.kind = "model_validated";
      draft.aiGenerated = true;
      draft.label = "AI-generated. Claims that were not in the permitted records were removed.";
      if (checked.rejected.length && !checked.summary.length && (input.modelOutput.summary || []).length) {
        charge(state, actor.id);
        return { ok: false, code: "HALLUCINATION_REJECTED", message: "The model response was discarded because it added facts that were not permitted.", rejected: checked.rejected };
      }
    } else if (!input.allowRulesDraft) {
      return { ok: false, code: "AI_UNAVAILABLE", message: "No AI service is connected. Nothing was invented. You can still build a checklist from permitted details." };
    }
    charge(state, actor.id);
    var turn = { id: "turn-" + Date.now().toString(36), at: nowIso(), actorId: actor.id, draft: draft };
    gate.workspace.history.push(turn);
    gate.workspace.drafts.latest = draft;
    audit(state, { action: "assistant_draft", actorId: actor.id, kind: draft.kind, rejected: draft.rejectedClaims });
    return { ok: true, draft: draft };
  }

  function saveDraft(state, actor, ownerId, text) {
    var gate = access(state, actor, ownerId);
    if (!gate.ok || gate.role !== "adult") return gate.ok ? { ok: false, code: "FORBIDDEN" } : gate;
    gate.workspace.drafts.edited = String(text || "").slice(0, 2000);
    audit(state, { action: "draft_edited", actorId: actor.id });
    return { ok: true, draft: gate.workspace.drafts.edited };
  }

  function reportOutput(state, actor, ownerId, reason) {
    var gate = access(state, actor, ownerId);
    if (!gate.ok) return gate;
    gate.workspace.reports.push({ at: nowIso(), actorId: actor.id, reason: String(reason || "").slice(0, 500) });
    audit(state, { action: "ai_output_reported", actorId: actor.id });
    return { ok: true };
  }

  function revokeConsent(state, actor) {
    var ws = workspaceFor(state, actor.id);
    if (!ws) return { ok: false, code: "NOT_FOUND" };
    ws.consent = false;
    ws.permitted = [];
    (ws.invites || []).forEach(function (invite) { invite.status = "revoked"; invite.scopes = []; });
    audit(state, { action: "consent_revoked", actorId: actor.id });
    return { ok: true };
  }

  function deleteWorkspace(state, actor) {
    var ws = workspaceFor(state, actor.id);
    if (!ws) return { ok: false, code: "NOT_FOUND" };
    ws.deletedAt = nowIso();
    ws.permitted = [];
    ws.history = [];
    ws.drafts = {};
    audit(state, { action: "workspace_deleted", actorId: actor.id });
    return { ok: true };
  }

  return {
    COPY: COPY,
    setFlag: setFlag,
    flagOn: flagOn,
    classifyProfile: classifyProfile,
    grantFields: grantFields,
    inviteRelative: inviteRelative,
    revokeInvite: revokeInvite,
    access: access,
    detectInjection: detectInjection,
    ask: ask,
    saveDraft: saveDraft,
    reportOutput: reportOutput,
    revokeConsent: revokeConsent,
    deleteWorkspace: deleteWorkspace,
    unanswered: unanswered,
    validateModelOutput: validateModelOutput
  };
});
