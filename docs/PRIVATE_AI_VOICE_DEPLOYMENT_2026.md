# Amanikah family and voice integration (November 2026)

## Implemented in the draft branch
- Authenticated backend routes for Family Studio and Voice Rishta, scoped to verified, consenting production accounts.
- Two-sided family invitations: owners grant a narrowly selected scope; recipients must accept; owners can revoke immediately.
- Optional AI Wali/Family Assistant API using OpenAI Responses, `store: false`, per-request user consent, limited topics, and no automatic profile or document transmission. Without provider configuration the endpoint gives a truthful guided-checklist response, not fake AI.
- Voice Rishta uploads one private recording per member; WebM/M4A/Ogg headers are checked, ffprobe validates audio-only duration (1–60 sec), maximum 2 MB, storage outside web root with 0600 files and 0700 directory, bearer token required for playback, explicit deletion, and purge on account deletion or consent withdrawal.
- Private `/account/family.html` workspace, reached from production `/account/`. Existing /app demo not promoted to production.
- No matchmaking or public voice discovery has been enabled. Members may share recorded voice with specifically invited, accepting registered relatives who have been granted voice permission. Exposing voice to a match requires a separate real mutual-acceptance model and moderation.

## Config and deployment, NOT yet applied to amanikah.com
1. Merge only after staging and privacy review; back up the production database before changing code.
2. Copy `api/server.py` and `api/private_features.py` to `/root/amanikah-api/`, alongside the current deployment path.
3. Update Docker Compose to bind-mount both files, rebuild with `api/Dockerfile` (ffmpeg/ffprobe), and restart only the API container.
4. Set `VOICE_PRIVATE_DIR=/data/private_voice` on persistent private storage. Do not serve this directory via nginx, CDN, static web server or public URL.
5. OPTIONAL: `AMANIKAH_AI_ENABLED=1`, `OPENAI_API_KEY` and `AMANIKAH_AI_MODEL`. The AI model is OFF by default and must remain off until data-protection review and current provider terms are checked. No secret values should be committed.
6. Deploy the `site/account/family.html`, `site/js/account-family-studio.js`, account link and homepage/CSS changes together.
7. Keep `MATCHMAKING_LIVE=0` and billing in sandbox until human fulfillment and safety operations are ready.

## User-generated content and moderation
Before making Voice Rishta available to prospective matches, implement server-backed block/report review, abuse escalation, consent-based share revocation, media moderation, retention schedules, content reporting, operator response procedures and test bilateral introduction states. Current backend supports private family sharing only.

## Film deliverable
An original 30-second AI-actor montage was created separately as `Amanikah_Original_AI_Actor_30s_Film.mp4` because the available connected GitHub text-file API does not upload a generated binary from the local workspace. It is not committed to the repository. Upload the MP4 to `site/images/film/`, verify content and mobile performance, and only then update the homepage source with the new path. Always label it *fictional AI actors / illustrative dramatization*, not real members or testimonials. Avoid autoplay and repeated loops.

## Tests before release
```bash
python -m compileall -q api
python -m unittest discover -s api/tests -v
node --check site/js/account-family-studio.js
node --check site/js/interactive-film.js
```
Then staging E2E:
- Register two verified test accounts; member B accepts an invited scope, then owner revokes; API must return 403 immediately.
- AI consent unchecked → guided checklist; checked without configured key → truthful 503.
- AI consent checked and staging provider configured → generated text; verify no private profile payload sent automatically.
- Upload valid 30–45 sec audio; verify private playback on owner device; unauthorized third account gets 403; delete removes file.
- Attempt malformed audio, a video stream disguised as audio, audio over 2MB and over 60s.
- Delete account/withdraw consent and verify files/grants are purged.
- Verify sign-in, account revocation, accessibility, video poster-first, keyboard interaction and responsive mobile layouts.
- Inspect all API/log responses for exposure of sensitive information. Perform independent security review.

No automated CI or live/staging tests have been claimed in this conversation. Code review and manual tests are required before deployment.
