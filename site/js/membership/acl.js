/**
 * Amanikah membership authorization.
 * Enforced in the API layer — UI hiding alone is not enough.
 * Works in browser and Node-compatible environments.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AmanikahACL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function sameId(a, b) {
    return String(a || "") === String(b || "");
  }

  function isBlocked(state, a, b) {
    return (state.blocks || []).some(function (row) {
      return (sameId(row.from, a) && sameId(row.to, b)) || (sameId(row.from, b) && sameId(row.to, a));
    });
  }

  function introductionBetween(state, a, b) {
    return (state.introductions || []).find(function (row) {
      return (
        (sameId(row.from, a) && sameId(row.to, b)) ||
        (sameId(row.from, b) && sameId(row.to, a))
      );
    });
  }

  function isMutualAccepted(state, a, b) {
    var intro = introductionBetween(state, a, b);
    return !!(intro && intro.status === "accepted");
  }

  function membershipOf(state, userId) {
    return (state.memberships || []).find(function (m) { return sameId(m.userId, userId); }) || null;
  }

  function profileOf(state, userId) {
    return (state.profiles || []).find(function (p) { return sameId(p.userId, userId); }) || null;
  }

  function requireAuth(actor) {
    if (!actor || !actor.id) {
      return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    }
    if (actor.deletedAt) {
      return { ok: false, code: "ACCOUNT_DELETED", message: "This account was deleted." };
    }
    return { ok: true };
  }

  function canViewOwnDashboard(actor) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    return { ok: true };
  }

  /**
   * Limited match suggestion fields are visible to the viewer when curated.
   * Full profile only after mutual acceptance (or self).
   */
  function canViewProfile(state, actor, targetUserId, opts) {
    opts = opts || {};
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    if (sameId(actor.id, targetUserId)) return { ok: true, level: "full" };
    if (isBlocked(state, actor.id, targetUserId)) {
      return { ok: false, code: "BLOCKED", message: "You cannot view this profile." };
    }
    var target = profileOf(state, targetUserId);
    if (!target) return { ok: false, code: "NOT_FOUND", message: "Profile not found." };
    if (target.visibility === "private" && !isMutualAccepted(state, actor.id, targetUserId)) {
      if (opts.asMatchSuggestion) return { ok: true, level: "suggestion" };
      return { ok: false, code: "PRIVATE", message: "This profile is private." };
    }
    if (isMutualAccepted(state, actor.id, targetUserId)) return { ok: true, level: "full" };
    if (opts.asMatchSuggestion) return { ok: true, level: "suggestion" };
    return { ok: false, code: "FORBIDDEN", message: "Not authorized to view this profile." };
  }

  function canRespondToIntroduction(state, actor, introductionId) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    var intro = (state.introductions || []).find(function (row) { return sameId(row.id, introductionId); });
    if (!intro) return { ok: false, code: "NOT_FOUND", message: "Introduction not found." };
    if (!(sameId(intro.from, actor.id) || sameId(intro.to, actor.id))) {
      return { ok: false, code: "FORBIDDEN", message: "Not a participant." };
    }
    if (intro.status === "expired" || intro.status === "declined" || intro.status === "withdrawn") {
      return { ok: false, code: "CLOSED", message: "This introduction is closed." };
    }
    return { ok: true, introduction: intro };
  }

  function canMessage(state, actor, peerId) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    if (sameId(actor.id, peerId)) {
      return { ok: false, code: "INVALID", message: "Cannot message yourself." };
    }
    if (isBlocked(state, actor.id, peerId)) {
      return { ok: false, code: "BLOCKED", message: "Messaging is blocked." };
    }
    if (!isMutualAccepted(state, actor.id, peerId)) {
      return {
        ok: false,
        code: "MUTUAL_REQUIRED",
        message: "Both adults must accept before conversations open."
      };
    }
    return { ok: true };
  }

  /**
   * Contact details are never unlocked by payment alone.
   */
  function canSeeContactDetails(state, actor, targetUserId) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    if (sameId(actor.id, targetUserId)) return { ok: true };
    if (!isMutualAccepted(state, actor.id, targetUserId)) {
      return { ok: false, code: "MUTUAL_REQUIRED", message: "Mutual acceptance required." };
    }
    var target = profileOf(state, targetUserId);
    var mem = membershipOf(state, actor.id);
    var paid = !!(mem && (mem.tier === "assisted" || mem.tier === "proofpass"));
    if (paid && !(target && target.shareContactAfterMutual)) {
      return {
        ok: false,
        code: "CONTACT_CONSENT_REQUIRED",
        message: "Payment does not reveal contact details. The other person must consent to share them."
      };
    }
    if (!(target && target.shareContactAfterMutual)) {
      return { ok: false, code: "CONTACT_CONSENT_REQUIRED", message: "Contact details are not shared yet." };
    }
    return { ok: true };
  }

  function canRequestVerification(state, actor) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    return { ok: true };
  }

  function canManageFamilyInvite(state, actor, inviteId) {
    var auth = requireAuth(actor);
    if (!auth.ok) return auth;
    var invite = (state.familyInvites || []).find(function (row) { return sameId(row.id, inviteId); });
    if (!invite) return { ok: false, code: "NOT_FOUND", message: "Invite not found." };
    if (!sameId(invite.fromUserId, actor.id)) {
      return { ok: false, code: "FORBIDDEN", message: "Only the inviting member can manage this invite." };
    }
    return { ok: true, invite: invite };
  }

  function filterProfile(profile, level) {
    if (!profile) return null;
    if (level === "full") {
      var full = Object.assign({}, profile);
      if (!full.shareContactAfterMutual) {
        delete full.phone;
        delete full.email;
      }
      return full;
    }
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      isDemo: profile.isDemo,
      age: profile.age,
      city: profile.city,
      educationLevel: profile.educationLevel,
      workSummary: profile.workSummary,
      relocation: profile.relocation,
      weddingStyle: profile.weddingStyle,
      familyInvolvement: profile.familyInvolvement,
      simpleNikah: profile.simpleNikah,
      visibility: profile.visibility,
      verificationBadges: profile.verificationBadges || [],
      matchReasons: profile.matchReasons || []
    };
  }

  return {
    requireAuth: requireAuth,
    canViewOwnDashboard: canViewOwnDashboard,
    canViewProfile: canViewProfile,
    canRespondToIntroduction: canRespondToIntroduction,
    canMessage: canMessage,
    canSeeContactDetails: canSeeContactDetails,
    canRequestVerification: canRequestVerification,
    canManageFamilyInvite: canManageFamilyInvite,
    isMutualAccepted: isMutualAccepted,
    isBlocked: isBlocked,
    introductionBetween: introductionBetween,
    filterProfile: filterProfile,
    profileOf: profileOf,
    membershipOf: membershipOf
  };
});
