# Amanikah competitor and retention audit — 17 Nov 2026

**Scope:** official product and support pages available on 17 Nov 2026, not a claim to have audited every matrimonial website. No claims of private competitor analytics, conversion rates, or independently verified success totals. All competitor marriage-count figures are their own marketing claims.

## Competitive landscape, with specific implications

| Platform | Evidence from publicly documented features | Strongest user value | Amanikah response |
|---|---|---|---|
| Muzz | Selfie/ID checks, photo blur, screenshot protection, chaperone, filters; app release notes added 7-day conversation closure prompts | Privacy and serious matching at large scale | Avoid swipe dopamine; prioritize an opt-in, revocable family flow, purposeful next steps and no fake verification |
| Salams | Selfie checks, profile detail, messaging and screenshot controls; also friend/social functions | Low-friction activity | Distinguish Nikah-oriented help from casual social engagement |
| Pure Matrimony | Explicit Wali Chat with member-controlled access to chats/profile; premium conversations, album exchanges, advanced filters | Deep safety settings & guided families | Make privacy permissions plain; separate guidance from account and never auto-share AI transcripts |
| Sunnah Match | Read profiles first; photo policy, Active Wali read-only after linking, broad geography, explicit restrictions | Values-first, cautious introductions | Clear locality/NRI plans, religion-neutral safety, self-reported profile transparency |
| Half Our Deen | Personality/compatibility focus, five dealbreaker questions, optional profile coaching | Conversation preparation | Offer free priorities and family prompts without algorithmic compatibility judgments |
| NikahForever | In-depth preferences, AI compatibility claims, chat, verified profile claims and assisted services | India-focused familiarity and support | Avoid unverifiable "100%" claims; serve people who value guidance regardless of spending |
| Nikah.com | Established portal with paid and free access and privacy policy | Older/family-oriented web audience | Lightweight web experience and offline-assisted community pathways, not app-only |
| MuslimShaadi | Profile ranking, member discovery, identity reviews, security terms | Extensive matrimonial inventory | Do not offer a discovery feed while waitlist-only; differentiate with informed consent |
| Sajida's | Community/masjid partnerships promoted on its site | Institutional partnerships | Masjid Mahfil can be a pilot, but no endorsed badge until real signed permission |

## Amanikah's actual product state, post Al Wali code
- Early access / waitlist: ACTIVE. Production member signup is paused while email remains unavailable.
- Free personal Nikah Priorities questionnaire and #SimpleNikah: ACTIVE.
- Wali Brief + voice: code deployed for previously verified members, strict scoped access; not live open matchmaking.
- Masjid Mahfil: interest-only pilot with no signed partners, identity certification or introductions.
- Community access fund: educational concept only; no donations, waqf legal status or fundraising.
- Al Wali: one subtle accessible floating guide across 16 public/account pages. Guided question replies are server-provided without an AI provider; no account needed. Opt-in Groq uses only the typed prompt and up to six preceding messages. Questions and answers are not persisted to backend; only three boolean journey checkpoints may be stored in local browser storage. Groq key goes only in VPS.
- Member profile: four small, editable fields and private preview; completion means preparation, never worthiness, compatibility or ID verification.

## Why Al Wali is a better differentiator than "AI matching"
1. **Real value before profiles:** a respectful answer and a relevant tool immediately; no signup gate or paywall to ask "What should I discuss before nikah?"
2. **Personal agency:** users control AI choice, guardian visibility, notes and whether they return. No mandatory family surveillance.
3. **Useful return path:** three optional locally saved steps (priorities, family conversation, next step), not endless prompts, leaderboards, rewards, or guilt.
4. **Trust:** clear flags distinguish free guidance, Groq-generated text, verified accounts, community-interest pilots, and genuine matchmaking.
5. **Inclusive language:** English, Hindi and Urdu guided answers, small screen accessibility and short responses. Text/plain interface works on low bandwidth.
6. **Honest future NRI value:** discuss relocation and time zones rather than promising immigration or a verified partner.
7. **No hidden identity in a "wali assistant":** Al Wali explicitly says it is software, not a real person, religious authority, compatibility assessment or a substitute for consent.

## Release / retention scorecard (measure after a privacy review, no fabricated results)

| Metric | Intended interpretation | Privacy condition |
|---|---|---|
| Al Wali open rate | Is its position/help label inviting? | Count only after analytics consent; never send prompt text |
| Guided answer usefulness | Did they find a helpful step? | Optional anonymous feedback; no transcript required |
| Family-guide or quiz clickthrough | Does guidance lead to action? | Aggregate link counts, never private fields |
| Returning users who resume checklist | Does a helpful browser-only progress track work? | Only local boolean flags; no cross-device tracking without consent |
| Consent/revocation success | Do members feel safe participating? | Security audits and aggregate case reviews, never public per-user data |
| Completed introductions / complaint rate | Real societal value, not app session time | Only after matchmaking becomes operational and human review exists |

## Next product improvements, prioritized
**P0 (shipped in this PR):** visible but unobtrusive Al Wali, no paid AI dependency, clear voluntary opt-in, no profile data pulled, production server limits, multilingual prompts, private profile preview, mobile/keyboard tests, current Groq production model.

**P0 (operational, NOT yet complete):** a real on-call safety operator and backup, encrypted off-server restore drill, verified signup/recovery, three-account member test. Keep payments and live matching off.

**P1 (future pilot):** a consent-reviewed Masjid Mahfil coordinator agreement and optional offline-assisted enquiry with safeguarding, plus date-stamped, evidence-scoped community reference (not religious character validation).

**P1 (product):** member-controlled, private partner-preference fields, no visible wealth/rank score, no uploads until data lifecycle/deletion controls exist; optional non-coercive conversation milestones (invite, discuss priorities, choose next step, close respectfully).

**P2:** paid concierge service only after human fulfillment and support exist; community subsidy only after the correct India legal vehicle, FCRA analysis, bank accounting, safeguarding and donor controls.

## Official sources
- Muzz values and safety: https://muzz.com/us/en/help/getting-started/how-is-muzz-halal/
- Muzz App Store features / versions: https://apps.apple.com/us/app/muzz-where-muslims-marry/id969997496
- Salams App Store: https://apps.apple.com/us/app/salams-halal-muslim-marriage/id965359176
- Pure Matrimony: https://purematrimony.com/
- Pure Matrimony wali permissions: https://purematrimony.zendesk.com/hc/en-gb/articles/38645631509009-What-permissions-does-my-Wali-have-on-my-profile-and-chat
- Sunnah Match introduction flow: https://www.sunnahmatch.com/how-it-works
- Half Our Deen: https://halfourdeen.com/
- NikahForever FAQ: https://nikahforever.com/faq
- Nikah.com: https://nikah.com/help/privacy
- MuslimShaadi privacy: https://www.muslimshaadi.in/info/privacy
- Groq production models / key handling: https://console.groq.com/docs/models and https://console.groq.com/docs/production-readiness/security-onboarding
- Groq customer-data processing and controls: https://console.groq.com/docs/your-data
- OWASP LLM Prompt Injection: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

**Important:** Product evidence alone does not establish conversion lift. A/B experiments must compare respectful onboarding and safety outcomes with real user consent; optimizing raw time spent can be counterproductive for people seeking marriage.
