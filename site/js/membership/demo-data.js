(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AmanikahDemoData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MODE = {
    id: "demo",
    label: "DEMO MODE",
    notice: "Fictional members only. No real accounts, payments, email/SMS verification, or document checks are processed. Not a production matrimonial service."
  };

  function seed() {
    var now = new Date().toISOString();
    var users = [
      {
        id: "demo-user-self",
        email: "you@amanikah.demo",
        phone: "",
        password: "DemoPass21!",
        createdAt: now,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
        deletedAt: null,
        isDemo: true,
        role: "admin"
      },
      {
        id: "demo-user-amina",
        email: "amina.demo@amanikah.demo",
        phone: "",
        password: "DemoPass21!",
        createdAt: now,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
        deletedAt: null,
        isDemo: true
      },
      {
        id: "demo-user-yusuf",
        email: "yusuf.demo@amanikah.demo",
        phone: "",
        password: "DemoPass21!",
        createdAt: now,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
        deletedAt: null,
        isDemo: true
      },
      {
        id: "demo-user-sara",
        email: "sara.demo@amanikah.demo",
        phone: "",
        password: "DemoPass21!",
        createdAt: now,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
        deletedAt: null,
        isDemo: true
      }
    ];

    var profiles = [
      {
        userId: "demo-user-self",
        displayName: "You (Demo)",
        isDemo: true,
        age: 29,
        jurisdiction: "IN",
        city: "Hyderabad",
        educationLevel: "Postgraduate",
        workSummary: "Product design (demo)",
        relocation: "Open within India",
        weddingStyle: "Intimate gathering",
        familyInvolvement: "After both people wish to continue",
        intentions: "Seeking a nikah built on mutual respect",
        simpleNikah: true,
        nikahReadiness: {
          top3: ["Honest financial expectations", "Calm communication", "Fairness at home"],
          relocate: "Open within India"
        },
        visibility: "private",
        shareContactAfterMutual: false,
        email: "you@amanikah.demo",
        phone: "",
        familyInvolvementOptIn: true,
        verificationBadges: [],
        completion: 86,
        matchReasons: []
      },
      {
        userId: "demo-user-amina",
        displayName: "Amina (Demo)",
        isDemo: true,
        age: 27,
        jurisdiction: "IN",
        city: "Bengaluru",
        educationLevel: "Graduate",
        workSummary: "Teacher (demo)",
        relocation: "Flexible by mutual agreement",
        weddingStyle: "Intimate gathering",
        familyInvolvement: "Supportive without deciding for us",
        intentions: "Looking for a simple nikah without dowry demands",
        simpleNikah: true,
        nikahReadiness: {
          top3: ["Honest financial expectations", "Family on clear terms", "Clarity about where life may be built"],
          relocate: "Flexible by mutual agreement"
        },
        visibility: "private",
        shareContactAfterMutual: false,
        email: "amina.demo@amanikah.demo",
        phone: "+91-90000-00001",
        familyInvolvementOptIn: true,
        verificationBadges: [{ type: "education", label: "Education check (demo scope)", date: "2026-01-01" }],
        completion: 92,
        matchReasons: [
          "Aligned SimpleNikah preference",
          "Similar wedding style: intimate gathering",
          "Both open to discussing family after mutual interest"
        ]
      },
      {
        userId: "demo-user-yusuf",
        displayName: "Yusuf (Demo)",
        isDemo: true,
        age: 31,
        jurisdiction: "IN",
        city: "Hyderabad",
        educationLevel: "Postgraduate",
        workSummary: "Software engineer (demo)",
        relocation: "Prefer same city",
        weddingStyle: "Moderate family celebration",
        familyInvolvement: "Early family involvement",
        intentions: "Wants family involved early; open about work goals",
        simpleNikah: false,
        nikahReadiness: {
          top3: ["Respect for work and learning goals", "Clear timeline", "Family involvement on clear terms"],
          relocate: "Prefer same city"
        },
        visibility: "private",
        shareContactAfterMutual: false,
        email: "yusuf.demo@amanikah.demo",
        phone: "+91-90000-00002",
        familyInvolvementOptIn: true,
        verificationBadges: [],
        completion: 80,
        matchReasons: [
          "Same city preference overlap",
          "Career support appears important to both",
          "Difference to discuss: wedding scale and timing of family involvement"
        ]
      },
      {
        userId: "demo-user-sara",
        displayName: "Sara (Demo)",
        isDemo: true,
        age: 28,
        jurisdiction: "AE",
        city: "Dubai (NRI demo)",
        educationLevel: "Graduate",
        workSummary: "Healthcare admin (demo)",
        relocation: "Open to life abroad",
        weddingStyle: "Moderate family celebration",
        familyInvolvement: "After both people wish to continue",
        intentions: "NRI life; careful about document clarity later",
        simpleNikah: true,
        nikahReadiness: {
          top3: ["Clarity about where life may be built", "Honest financial expectations", "A careful first introduction"],
          relocate: "Open to life abroad"
        },
        visibility: "private",
        shareContactAfterMutual: false,
        email: "sara.demo@amanikah.demo",
        phone: "",
        familyInvolvementOptIn: false,
        verificationBadges: [],
        completion: 78,
        matchReasons: [
          "Shared SimpleNikah interest",
          "Aligned on discussing family after both wish to continue",
          "Difference to discuss: relocation abroad"
        ]
      }
    ];

    var matches = [
      { id: "match-amina", userId: "demo-user-self", candidateId: "demo-user-amina", weekOf: "2026-11-10", status: "suggested" },
      { id: "match-yusuf", userId: "demo-user-self", candidateId: "demo-user-yusuf", weekOf: "2026-11-10", status: "suggested" },
      { id: "match-sara", userId: "demo-user-self", candidateId: "demo-user-sara", weekOf: "2026-11-10", status: "suggested" }
    ];

    var introductions = [
      {
        id: "intro-pending-amina",
        from: "demo-user-self",
        to: "demo-user-amina",
        status: "pending",
        createdAt: now,
        expiresAt: "2026-12-01T00:00:00.000Z",
        fromAccepted: true,
        toAccepted: false
      }
    ];

    return {
      mode: MODE,
      users: users,
      profiles: profiles,
      memberships: [
        { userId: "demo-user-self", tier: "introduction", status: "active", label: "Free introduction (demo)" },
        { userId: "demo-user-amina", tier: "introduction", status: "active", label: "Free introduction (demo)" },
        { userId: "demo-user-yusuf", tier: "introduction", status: "active", label: "Free introduction (demo)" },
        { userId: "demo-user-sara", tier: "introduction", status: "active", label: "Free introduction (demo)" }
      ],
      matches: matches,
      introductions: introductions,
      messages: [],
      familyInvites: [],
      verificationRequests: [],
      blocks: [],
      reports: [],
      featureFlags: { familyAssistant: false },
      voiceRecordings: [],
      activity: [
        { id: "act-1", userId: "demo-user-self", text: "Weekly match drop prepared (demo)", at: now },
        { id: "act-2", userId: "demo-user-self", text: "Introduction request sent to Amina (Demo)", at: now }
      ],
      consents: {
        "demo-user-self": { terms: true, privacy: true, withdrawn: false, updatedAt: now }
      }
    };
  }

  return { MODE: MODE, seed: seed };
});
