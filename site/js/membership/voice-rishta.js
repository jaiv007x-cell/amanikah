/**
 * Voice Rishta — optional audio introduction.
 * Audio bytes stay in this browser (IndexedDB). Metadata and grants stay in membership state.
 * Nothing is published until the member confirms. No public file URL is issued.
 * Listening is never required to express interest.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AmanikahVoiceRishta = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MIN_MS = 30000;
  var MAX_MS = 60000;
  var MIN_BYTES = 20000;
  var MAX_BYTES = 1500000;
  var SHARE_MAX_DAYS = 30;
  var DEFAULT_SHARE_DAYS = 7;
  var RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
  var DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  var TEXT_MIN = 20;
  var BITRATE = 24000;
  var DB_NAME = "amanikah.voice.demo.v1";
  var DB_STORE = "audio";

  var MAGIC = {
    webm: [0x1a, 0x45, 0xdf, 0xa3],
    ogg: [0x4f, 0x67, 0x67, 0x53],
    wav: [0x52, 0x49, 0x46, 0x46],
    mp4: [0x66, 0x74, 0x79, 0x70]
  };

  function sniff(header) {
    if (!header || header.length < 12) return null;
    function at(sig, offset) {
      for (var i = 0; i < sig.length; i++) if (header[offset + i] !== sig[i]) return false;
      return true;
    }
    if (at(MAGIC.webm, 0)) return "audio/webm";
    if (at(MAGIC.ogg, 0)) return "audio/ogg";
    if (at(MAGIC.wav, 0)) return "audio/wav";
    if (at(MAGIC.mp4, 4)) return "audio/mp4";
    return null;
  }

  function normalizeMime(declared, sniffedMime) {
    var base = String(declared || "").split(";")[0].trim().toLowerCase();
    if (sniffedMime === "audio/webm" && (base === "audio/webm" || base === "video/webm")) return "audio/webm";
    if (base === sniffedMime) return sniffedMime;
    return null;
  }

  function validateAudio(input) {
    input = input || {};
    var duration = Number(input.durationMs);
    if (!isFinite(duration) || duration < MIN_MS) {
      return { ok: false, code: "DURATION_SHORT", message: "Record between 30 and 60 seconds." };
    }
    if (duration > MAX_MS) {
      return { ok: false, code: "DURATION_LONG", message: "Stop at 60 seconds and try again." };
    }
    var size = Number(input.byteLength);
    if (!isFinite(size) || size < MIN_BYTES) {
      return { ok: false, code: "FILE_TOO_SMALL", message: "The recording is too small to be a 30-second introduction." };
    }
    if (size > MAX_BYTES) {
      return { ok: false, code: "FILE_TOO_LARGE", message: "The recording is over the 1.5 MB limit." };
    }
    var sniffedMime = sniff(input.header);
    var mime = normalizeMime(input.mime, sniffedMime);
    if (!mime) {
      return { ok: false, code: "FORMAT_REJECTED", message: "Use a WebM, MP4, Ogg, or WAV recording." };
    }
    return { ok: true, mime: mime, durationMs: Math.round(duration), byteLength: size };
  }

  function validateText(text) {
    var value = String(text || "").trim();
    if (value.length < TEXT_MIN) {
      return { ok: false, code: "TEXT_REQUIRED", message: "Write a short introduction of at least a sentence. People who do not listen still need it." };
    }
    return { ok: true, text: value };
  }

  function list(state) {
    if (!state.voiceRecordings) state.voiceRecordings = [];
    return state.voiceRecordings;
  }

  function byId(state, id) {
    return list(state).find(function (row) { return row.id === id && row.status !== "deleted"; }) || null;
  }

  function nowIso(now) {
    return new Date(now || Date.now()).toISOString();
  }

  function createAudioDraft(state, actor, input, now) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    var checked = validateAudio(input);
    if (!checked.ok) return checked;
    var rec = {
      id: "voice-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      ownerId: actor.id,
      kind: "audio",
      status: "draft",
      mime: checked.mime,
      byteLength: checked.byteLength,
      durationMs: checked.durationMs,
      textAlternative: "",
      transcript: "",
      transcriptReviewed: false,
      visibility: "private",
      grants: [],
      reports: [],
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      publishedAt: null,
      retentionUntil: null,
      deletedAt: null,
      saveState: "pending"
    };
    list(state).push(rec);
    return { ok: true, recording: publicMeta(rec), blobKey: rec.id };
  }

  function markSaved(state, actor, id) {
    var rec = owned(state, actor, id);
    if (!rec.ok) return rec;
    rec.recording.saveState = "saved";
    rec.recording.updatedAt = nowIso();
    return { ok: true, recording: publicMeta(rec.recording) };
  }

  function markSaveFailed(state, actor, id) {
    var rec = owned(state, actor, id);
    if (!rec.ok) return rec;
    rec.recording.saveState = "failed";
    rec.recording.status = "draft";
    rec.recording.updatedAt = nowIso();
    return { ok: false, code: "SAVE_FAILED", message: "The save failed. Nothing was published. You can try again.", recording: publicMeta(rec.recording) };
  }

  function owned(state, actor, id) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    var rec = byId(state, id);
    if (!rec || rec.ownerId !== actor.id) return { ok: false, code: "FORBIDDEN", message: "You cannot change this introduction." };
    return { ok: true, recording: rec };
  }

  function publish(state, actor, id, input, now) {
    var gate = owned(state, actor, id);
    if (!gate.ok) return gate;
    var rec = gate.recording;
    if (rec.kind === "audio" && rec.saveState !== "saved") {
      return { ok: false, code: "SAVE_FAILED", message: "Wait until the private save finishes before publishing." };
    }
    input = input || {};
    var text = validateText(input.textAlternative);
    if (!text.ok) return text;
    var transcript = String(input.transcript || "").trim();
    if (transcript && !input.transcriptReviewed) {
      return { ok: false, code: "TRANSCRIPT_UNREVIEWED", message: "Review the transcript and confirm it before publishing." };
    }
    var visibility = input.visibility === "selected" ? "selected" : "private";
    var recipients = Array.isArray(input.recipients) ? input.recipients.map(String) : [];
    recipients = recipients.filter(function (rid) { return rid && rid !== actor.id; });
    if (visibility === "selected" && !recipients.length) {
      return { ok: false, code: "RECIPIENT_REQUIRED", message: "Choose who may listen, or keep the introduction private." };
    }
    var days = Number(input.shareDays);
    if (!isFinite(days) || days <= 0) days = DEFAULT_SHARE_DAYS;
    if (days > SHARE_MAX_DAYS) days = SHARE_MAX_DAYS;
    var stamp = now || Date.now();
    rec.textAlternative = text.text;
    rec.transcript = transcript;
    rec.transcriptReviewed = transcript ? true : false;
    rec.visibility = visibility;
    rec.grants = visibility === "selected" ? recipients.map(function (rid) {
      return {
        id: "grant-" + Math.random().toString(36).slice(2, 10),
        recipientId: rid,
        expiresAt: new Date(stamp + days * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null
      };
    }) : [];
    rec.status = "published";
    rec.publishedAt = nowIso(stamp);
    rec.retentionUntil = new Date(stamp + RETENTION_MS).toISOString();
    rec.updatedAt = nowIso(stamp);
    return { ok: true, recording: publicMeta(rec) };
  }

  function createTextDraft(state, actor, text, now) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    var checked = validateText(text);
    if (!checked.ok) return checked;
    var rec = {
      id: "voice-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      ownerId: actor.id,
      kind: "text",
      status: "draft",
      mime: null,
      byteLength: 0,
      durationMs: 0,
      textAlternative: checked.text,
      transcript: "",
      transcriptReviewed: false,
      visibility: "private",
      grants: [],
      reports: [],
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      publishedAt: null,
      retentionUntil: null,
      deletedAt: null,
      saveState: "saved"
    };
    list(state).push(rec);
    return { ok: true, recording: publicMeta(rec) };
  }

  function canAccess(state, actor, recordingId, now) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    var rec = list(state).find(function (row) { return row.id === recordingId; });
    if (!rec || rec.status === "deleted" || rec.deletedAt) {
      return { ok: false, code: "NOT_FOUND", message: "This introduction is not available." };
    }
    var stamp = now || Date.now();
    if (rec.retentionUntil && Date.parse(rec.retentionUntil) <= stamp) {
      return { ok: false, code: "EXPIRED", message: "This introduction has passed its retention date." };
    }
    if (rec.status === "removed") {
      return { ok: false, code: "REMOVED", message: "This introduction was removed after a report." };
    }
    var blocked = (state.blocks || []).some(function (row) {
      return (row.from === actor.id && row.to === rec.ownerId) || (row.from === rec.ownerId && row.to === actor.id);
    });
    if (actor.id !== rec.ownerId && blocked) {
      return { ok: false, code: "BLOCKED", message: "This introduction is not available." };
    }
    if (actor.id === rec.ownerId) {
      return accessOk(rec, "owner");
    }
    if (rec.status !== "published") {
      return { ok: false, code: "NOT_PUBLISHED", message: "This introduction has not been published." };
    }
    if (rec.visibility !== "selected") {
      return { ok: false, code: "FORBIDDEN", message: "This introduction is private." };
    }
    var grant = (rec.grants || []).find(function (row) {
      return row.recipientId === actor.id && !row.revokedAt;
    });
    if (!grant) return { ok: false, code: "FORBIDDEN", message: "This introduction was not shared with you." };
    if (Date.parse(grant.expiresAt) <= stamp) {
      return { ok: false, code: "EXPIRED", message: "This share has expired." };
    }
    var result = accessOk(rec, "recipient");
    result.expiresAt = grant.expiresAt;
    return result;
  }

  function accessOk(rec, role) {
    return {
      ok: true,
      role: role,
      allowDownload: false,
      allowClone: false,
      recording: publicMeta(rec)
    };
  }

  function publicMeta(rec) {
    return {
      id: rec.id,
      ownerId: rec.ownerId,
      kind: rec.kind,
      status: rec.status,
      mime: rec.mime,
      byteLength: rec.byteLength,
      durationMs: rec.durationMs,
      textAlternative: rec.textAlternative,
      transcript: rec.transcript,
      transcriptReviewed: !!rec.transcriptReviewed,
      visibility: rec.visibility,
      grants: (rec.grants || []).map(function (g) {
        return { id: g.id, recipientId: g.recipientId, expiresAt: g.expiresAt, revokedAt: g.revokedAt };
      }),
      createdAt: rec.createdAt,
      publishedAt: rec.publishedAt,
      retentionUntil: rec.retentionUntil,
      saveState: rec.saveState
    };
  }

  function removeLocal(state, actor, id) {
    var gate = owned(state, actor, id);
    if (!gate.ok) return gate;
    gate.recording.status = "deleted";
    gate.recording.deletedAt = nowIso();
    gate.recording.grants = [];
    gate.recording.textAlternative = "";
    gate.recording.transcript = "";
    return { ok: true, blobKey: id };
  }

  function revokeGrant(state, actor, recordingId, recipientId) {
    var gate = owned(state, actor, recordingId);
    if (!gate.ok) return gate;
    (gate.recording.grants || []).forEach(function (g) {
      if (g.recipientId === recipientId) g.revokedAt = nowIso();
    });
    return { ok: true, recording: publicMeta(gate.recording) };
  }

  function report(state, actor, recordingId, reason) {
    var gate = canAccess(state, actor, recordingId);
    if (!gate.ok && gate.code !== "FORBIDDEN") {
      if (!(actor && actor.id)) return gate;
    }
    var rec = byId(state, recordingId);
    if (!rec) return { ok: false, code: "NOT_FOUND", message: "This introduction is not available." };
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    if (actor.id === rec.ownerId) return { ok: false, code: "INVALID", message: "Use delete for your own introduction." };
    var text = String(reason || "").trim();
    if (text.length < 3) return { ok: false, code: "REASON_REQUIRED", message: "Describe the concern." };
    rec.reports.push({ id: "vrep-" + Math.random().toString(36).slice(2, 8), from: actor.id, reason: text, at: nowIso() });
    return { ok: true, reported: true };
  }

  function moderateRemove(state, actor, recordingId) {
    if (!actor || actor.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Only an administrator can remove a reported introduction." };
    var rec = byId(state, recordingId);
    if (!rec) return { ok: false, code: "NOT_FOUND", message: "This introduction is not available." };
    rec.status = "removed";
    rec.deletedAt = nowIso();
    rec.grants = [];
    return { ok: true, blobKey: rec.id };
  }

  function purgeExpired(state, now) {
    var stamp = now || Date.now();
    var changed = false;
    var blobKeys = [];
    list(state).forEach(function (rec) {
      if (rec.status === "deleted" || rec.status === "removed") return;
      var draftOld = rec.status === "draft" && Date.parse(rec.createdAt) + DRAFT_TTL_MS <= stamp;
      var retained = rec.retentionUntil && Date.parse(rec.retentionUntil) <= stamp;
      if (draftOld || retained) {
        rec.status = "deleted";
        rec.deletedAt = nowIso(stamp);
        rec.grants = [];
        blobKeys.push(rec.id);
        changed = true;
      }
    });
    return { changed: changed, blobKeys: blobKeys };
  }

  function deleteAllForOwner(state, ownerId) {
    var keys = [];
    list(state).forEach(function (rec) {
      if (rec.ownerId === ownerId && rec.status !== "deleted") {
        rec.status = "deleted";
        rec.deletedAt = nowIso();
        rec.grants = [];
        rec.textAlternative = "";
        rec.transcript = "";
        keys.push(rec.id);
      }
    });
    return keys;
  }

  function mine(state, actor) {
    if (!actor || !actor.id) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." };
    return {
      ok: true,
      recordings: list(state).filter(function (rec) {
        return rec.ownerId === actor.id && rec.status !== "deleted";
      }).map(publicMeta)
    };
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) {
        reject(new Error("This browser cannot store the recording privately."));
        return;
      }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("SAVE_FAILED")); };
    });
  }

  function putBlob(id, blob, onProgress) {
    if (onProgress) onProgress(0.2);
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, id);
        tx.oncomplete = function () {
          if (onProgress) onProgress(1);
          db.close();
          resolve(true);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error || new Error("SAVE_FAILED"));
        };
      });
    });
  }

  function getBlob(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, "readonly");
        var req = tx.objectStore(DB_STORE).get(id);
        req.onsuccess = function () { db.close(); resolve(req.result || null); };
        req.onerror = function () { db.close(); reject(req.error); };
      });
    });
  }

  function deleteBlob(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = function () { db.close(); resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function preferredMime() {
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
    var types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  function createStudio(options) {
    options = options || {};
    var stream = null;
    var recorder = null;
    var chunks = [];
    var started = 0;
    var timer = null;
    var audioCtx = null;
    var analyser = null;
    var raf = 0;
    var mime = "";

    function emit(name, detail) {
      if (typeof options.onState === "function") options.onState(name, detail || {});
    }

    function draw() {
      if (!analyser || !options.canvas) return;
      var canvas = options.canvas;
      var ctx = canvas.getContext("2d");
      var data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0c2b24";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#b59a60";
      ctx.lineWidth = 2;
      ctx.beginPath();
      var step = canvas.width / data.length;
      for (var i = 0; i < data.length; i++) {
        var y = (data[i] / 255) * canvas.height;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    }

    function stopTracks() {
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
      if (audioCtx) audioCtx.close();
      audioCtx = null;
      cancelAnimationFrame(raf);
    }

    return {
      requestMic: function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
          emit("error", { message: "This browser cannot record. Use the written introduction instead." });
          return Promise.resolve(false);
        }
        emit("requesting", {});
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (live) {
          stream = live;
          mime = preferredMime();
          audioCtx = new AudioContext();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioCtx.createMediaStreamSource(stream).connect(analyser);
          draw();
          emit("ready", {});
          return true;
        }).catch(function () {
          emit("error", { message: "Microphone permission was denied. You can still publish a written introduction." });
          return false;
        });
      },
      start: function () {
        if (!stream) {
          emit("error", { message: "Allow the microphone before recording." });
          return;
        }
        if (recorder && recorder.state === "recording") return;
        chunks = [];
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: BITRATE }) : new MediaRecorder(stream);
        recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = function () {
          clearInterval(timer);
          var durationMs = Date.now() - started;
          var blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
          blob.arrayBuffer().then(function (buf) {
            var header = Array.prototype.slice.call(new Uint8Array(buf.slice(0, 16)));
            emit("recorded", {
              blob: blob,
              durationMs: durationMs,
              byteLength: blob.size,
              mime: (blob.type || "audio/webm").split(";")[0],
              header: header
            });
          });
        };
        recorder.start(250);
        started = Date.now();
        emit("recording", { durationMs: 0 });
        timer = setInterval(function () {
          var elapsed = Date.now() - started;
          emit("recording", { durationMs: elapsed });
          if (elapsed >= MAX_MS) recorder.stop();
        }, 200);
      },
      stop: function () {
        if (recorder && recorder.state === "recording") recorder.stop();
      },
      destroy: function () {
        clearInterval(timer);
        if (recorder && recorder.state === "recording") recorder.stop();
        stopTracks();
      }
    };
  }

  function selfTest() {
    var failures = [];
    function check(cond, msg) { if (!cond) failures.push(msg); }
    var webm = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0];
    var good = { durationMs: 45000, byteLength: 80000, mime: "audio/webm", header: webm };
    check(validateAudio(good).ok, "valid webm");
    check(validateAudio(Object.assign({}, good, { durationMs: 29000 })).code === "DURATION_SHORT", "short");
    check(validateAudio(Object.assign({}, good, { durationMs: 61000 })).code === "DURATION_LONG", "long");
    check(validateAudio(Object.assign({}, good, { byteLength: 1000 })).code === "FILE_TOO_SMALL", "small");
    check(validateAudio(Object.assign({}, good, { byteLength: 2000000 })).code === "FILE_TOO_LARGE", "large");
    check(validateAudio(Object.assign({}, good, { header: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })).code === "FORMAT_REJECTED", "format");
    var state = { voiceRecordings: [], blocks: [], users: [{ id: "adult" }, { id: "amina" }, { id: "stranger" }] };
    var draft = createAudioDraft(state, { id: "adult" }, good, 0);
    check(draft.ok && draft.recording.status === "draft", "draft");
    check(!JSON.stringify(draft).includes("blob:"), "no blob url");
    markSaved(state, { id: "adult" }, draft.recording.id);
    var early = publish(state, { id: "adult" }, draft.recording.id, { textAlternative: "short" });
    check(early.code === "TEXT_REQUIRED", "text required");
    var unread = publish(state, { id: "adult" }, draft.recording.id, {
      textAlternative: "I want a calm partnership and a written introduction for anyone who will not listen.",
      transcript: "hello from the transcript",
      transcriptReviewed: false,
      visibility: "private"
    });
    check(unread.code === "TRANSCRIPT_UNREVIEWED", "transcript review");
    var pub = publish(state, { id: "adult" }, draft.recording.id, {
      textAlternative: "I want a calm partnership and a written introduction for anyone who will not listen.",
      transcript: "hello from the transcript",
      transcriptReviewed: true,
      visibility: "selected",
      recipients: ["amina"],
      shareDays: 7
    }, 1000);
    check(pub.ok && pub.recording.visibility === "selected", "publish");
    check(canAccess(state, { id: "stranger" }, draft.recording.id, 2000).code === "FORBIDDEN", "stranger");
    check(canAccess(state, { id: "amina" }, draft.recording.id, 2000).ok === true, "recipient");
    check(canAccess(state, { id: "amina" }, draft.recording.id, 2000).allowDownload === false, "no download");
    var later = 1000 + 8 * 24 * 60 * 60 * 1000;
    check(canAccess(state, { id: "amina" }, draft.recording.id, later).code === "EXPIRED", "expired");
    state.blocks.push({ from: "adult", to: "amina" });
    var fresh = createAudioDraft(state, { id: "adult" }, good, later);
    markSaved(state, { id: "adult" }, fresh.recording.id);
    publish(state, { id: "adult" }, fresh.recording.id, {
      textAlternative: "I want a calm partnership and a written introduction for anyone who will not listen.",
      visibility: "selected",
      recipients: ["amina"],
      shareDays: 7
    }, later);
    check(canAccess(state, { id: "amina" }, fresh.recording.id, later + 10).code === "BLOCKED", "blocked");
    var removed = removeLocal(state, { id: "adult" }, fresh.recording.id);
    check(removed.ok && canAccess(state, { id: "adult" }, fresh.recording.id, later + 20).code === "NOT_FOUND", "deleted");
    return failures;
  }

  return {
    MIN_MS: MIN_MS,
    MAX_MS: MAX_MS,
    MIN_BYTES: MIN_BYTES,
    MAX_BYTES: MAX_BYTES,
    BITRATE: BITRATE,
    RETENTION_MS: RETENTION_MS,
    validateAudio: validateAudio,
    validateText: validateText,
    createAudioDraft: createAudioDraft,
    createTextDraft: createTextDraft,
    markSaved: markSaved,
    markSaveFailed: markSaveFailed,
    publish: publish,
    canAccess: canAccess,
    removeLocal: removeLocal,
    revokeGrant: revokeGrant,
    report: report,
    moderateRemove: moderateRemove,
    purgeExpired: purgeExpired,
    deleteAllForOwner: deleteAllForOwner,
    mine: mine,
    publicMeta: publicMeta,
    putBlob: putBlob,
    getBlob: getBlob,
    deleteBlob: deleteBlob,
    createStudio: createStudio,
    preferredMime: preferredMime,
    selfTest: selfTest
  };
});
