# Amanikah: typography, film pacing and family-guide recovery

## Source audit (16 November 2026)
The repository currently has FIVE homepage CSS layers (site.css, design-system.css, premium-home.css, interactive-film.css and cosmopolitan-v4.css), which creates conflicting heading, gold text and mobile rules. The hero video was configured to automatically replay on intersection visibility, and the dialog started its clip immediately. The family assistant and voice modules under site/js/membership are demo-browser modules; they are not production AI/voice services.

## Implemented on this branch
- Added a final scoped typography and contrast CSS layer for homepage only.
- Restyled hero and content text, higher legibility and better mobile hierarchy.
- User-initiated film playback; no autoplay on scroll or after closing; no forced 0.75x synthetic slow-motion.
- Scene choices still work with existing branching logic. A film remains an illustrative AI clip.
- Free multilingual browser-only family discussion guide at /family-guide/ (English, Hindi, Urdu).
- Homepage links to existing #SimpleNikah and readiness tools and new family guide.
- Sitemap includes the new guide.
- Kept real /account and existing server routes intact. No production database or billing changes.

## Not yet enabled (critical honesty)
- A live AI-backed Wali service is **not** configured. Existing /app family assistant has rules-only demo and an optional model-output verification layer, not actual backend inference or safe production data integration. This branch does NOT expose personal profile data to an AI provider.
- Voice Rishta currently lives in a local/demo membership layer; a secure, authenticated upload/media API and consent controls are needed for production.
- Matchmaking remains disabled, billing sandbox. Do not imply either is live.
- Existing AI-generated human clips are short and visibly synthetic; professional acting/direction/consented footage is the next creative step.

## QA to run before merging
1. Browser screenshot comparisons (1440, 768, 390, 320px) including CSS cascade.
2. Video: poster first, manual play/pause, end hold, replay, scroll-out/in, close/reopen dialog, reduced-motion.
3. #SimpleNikah and readiness regression.
4. Family guide: select each topic in all 3 languages, copy, keyboard navigation, mobile layout.
5. API-side registration and consent checks separately. Do not claim live AI or Voice Rishta integration.
6. Check main site accessibility and performance; measure LCP, INP, CLS. No scores claimed without measurement.

## Go/no-go
Suitable for review and staging visual QA, not automatic production merge. New public guide is independent of protected data. Keep AI/voice production feature flags off pending authentication, data-protection review, provider configuration, and adversarial testing.
