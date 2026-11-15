(function (global) {
  var API = "/api/amanikah";

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (err) {
      return "";
    }
  }

  function readForm(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = typeof value === "string" ? value.trim() : value;
    });
    if (data.consent === "yes" || data.consent === "on") data.consent = true;
    if (data.age) data.age = Number(data.age);
    return data;
  }

  function setFieldError(form, name, message) {
    var input = form.elements[name];
    var err = document.getElementById(name + "-err") || document.getElementById(form.id + "-" + name + "-err");
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    if (err) {
      err.hidden = !message;
      err.textContent = message || "";
    }
  }

  function validateLead(form) {
    var ok = true;
    var data = readForm(form);
    function need(name, cond, msg) {
      if (!cond) {
        setFieldError(form, name, msg);
        ok = false;
      } else setFieldError(form, name, "");
    }
    need("name", data.name && data.name.length >= 2, "Enter your name.");
    need("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || ""), "Enter a valid email.");
    need("age", data.age >= 21 && data.age <= 80, "Age must be 21 to 80.");
    need("city", data.city && data.city.length >= 2, "Enter your city.");
    need("home", !!data.home, "Choose a home preference.");
    need("note", data.note && data.note.length >= 20, "Write at least 20 characters.");
    need("consent", !!data.consent, "Consent is required.");
    return ok;
  }

  function validateTicket(form) {
    var ok = true;
    var data = readForm(form);
    function need(name, cond, msg) {
      if (!cond) {
        setFieldError(form, name, msg);
        ok = false;
      } else setFieldError(form, name, "");
    }
    need("name", data.name && data.name.length >= 2, "Enter your name.");
    need("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || ""), "Enter a valid email.");
    need("topic", !!data.topic, "Choose a topic.");
    need("message", data.message && data.message.length >= 20, "Write at least 20 characters.");
    return ok;
  }

  function post(path, body) {
    return fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    }).then(function (res) {
      return res.json().then(function (json) {
        return { status: res.status, body: json };
      }).catch(function () {
        return { status: res.status, body: { ok: false, code: "BAD_RESPONSE" } };
      });
    });
  }

  function showResult(form, successEl, summaryEl, payload, labels) {
    form.hidden = true;
    if (successEl) successEl.hidden = false;
    if (!summaryEl) return;
    summaryEl.replaceChildren();
    Object.keys(labels || {}).forEach(function (key) {
      if (payload[key] == null || payload[key] === "") return;
      var li = document.createElement("li");
      li.textContent = labels[key] + ": " + payload[key];
      summaryEl.appendChild(li);
    });
  }

  function wireLeadForm(form) {
    if (!form) return;
    var status = form.querySelector(".form-status");
    var success = document.getElementById(form.id + "-success");
    var summary = document.getElementById(form.id + "-summary");
    var from = qs("from");
    if (from) {
      var sourceInput = form.querySelector("[name='source']");
      if (sourceInput) sourceInput.value = from;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateLead(form)) {
        if (status) status.textContent = "Please correct the highlighted fields.";
        var first = form.querySelector("[aria-invalid='true']");
        if (first) first.focus();
        return;
      }
      var submit = form.querySelector("[type='submit']");
      var label = form.getAttribute("data-label") || "Join the waitlist";
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Submitting…";
      }
      if (status) status.textContent = "";
      var data = readForm(form);
      data.source = data.source || from || "signup";
      data.referral = data.referral || qs("ref") || "";
      post("/analytics/events", { name: "signup_started", props: { source: data.source } }).catch(function () {});
      post("/leads", data)
        .then(function (result) {
          if (!result.body || !result.body.ok) {
            if (submit) {
              submit.disabled = false;
              submit.textContent = label;
            }
            var msg = (result.body && result.body.message) || "The waitlist could not accept this request.";
            if (result.body && result.body.code === "DUPLICATE" && result.body.reference) {
              msg += " Existing reference: " + result.body.reference;
            }
            if (status) status.textContent = msg;
            return;
          }
          try {
            localStorage.setItem(
              "amanikah.signup.last",
              JSON.stringify({
                reference: result.body.reference,
                at: new Date().toISOString(),
                source: data.source,
              })
            );
          } catch (err) {}
          showResult(form, success, summary, {
            reference: result.body.reference,
            status: result.body.status,
            mode: result.body.mode,
            email: data.email,
            name: data.name,
          }, {
            reference: "Request reference",
            status: "Status",
            mode: "Mode",
            email: "Email",
            name: "Name",
          });
          var banner = success && success.querySelector("[data-server-message]");
          if (banner) banner.textContent = result.body.message || "Request accepted.";
        })
        .catch(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = label;
          }
          if (status) status.textContent = "Network error. Nothing was confirmed. Try again.";
        });
    });
    var edit = document.getElementById(form.id + "-edit");
    if (edit) {
      edit.addEventListener("click", function () {
        if (success) success.hidden = true;
        form.hidden = false;
        var submit = form.querySelector("[type='submit']");
        if (submit) {
          submit.disabled = false;
          submit.textContent = form.getAttribute("data-label") || "Join the waitlist";
        }
      });
    }
  }

  function wireTicketForm(form, kind) {
    if (!form) return;
    var status = form.querySelector(".form-status");
    var success = document.getElementById(form.id + "-success");
    var summary = document.getElementById(form.id + "-summary");
    var topicParam = qs("topic");
    if (topicParam && form.elements.topic) {
      Array.prototype.forEach.call(form.elements.topic.options, function (opt) {
        if (opt.value.toLowerCase().indexOf(topicParam.toLowerCase()) >= 0) opt.selected = true;
      });
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateTicket(form)) {
        if (status) status.textContent = "Please correct the highlighted fields.";
        var first = form.querySelector("[aria-invalid='true']");
        if (first) first.focus();
        return;
      }
      var submit = form.querySelector("[type='submit']");
      var label = form.getAttribute("data-label") || "Send message";
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Submitting…";
      }
      if (status) status.textContent = "";
      var data = readForm(form);
      data.kind = kind || data.kind || "support";
      post("/tickets", data)
        .then(function (result) {
          if (!result.body || !result.body.ok) {
            if (submit) {
              submit.disabled = false;
              submit.textContent = label;
            }
            var msg = (result.body && result.body.message) || "The message was not accepted.";
            if (result.body && result.body.reference) msg += " Existing reference: " + result.body.reference;
            if (status) status.textContent = msg;
            return;
          }
          showResult(form, success, summary, {
            reference: result.body.reference,
            kind: result.body.kind,
            status: result.body.status,
            email: data.email,
          }, {
            reference: "Ticket reference",
            kind: "Type",
            status: "Status",
            email: "Email",
          });
          var banner = success && success.querySelector("[data-server-message]");
          if (banner) banner.textContent = result.body.message || "Message accepted.";
          var emergency = success && success.querySelector("[data-emergency]");
          if (emergency) {
            if (result.body.emergency) {
              emergency.hidden = false;
              emergency.textContent = result.body.emergency;
            } else emergency.hidden = true;
          }
        })
        .catch(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = label;
          }
          if (status) status.textContent = "Network error. Nothing was confirmed. Try again.";
        });
    });
    var edit = document.getElementById(form.id + "-edit");
    if (edit) {
      edit.addEventListener("click", function () {
        if (success) success.hidden = true;
        form.hidden = false;
        var submit = form.querySelector("[type='submit']");
        if (submit) {
          submit.disabled = false;
          submit.textContent = form.getAttribute("data-label") || "Send message";
        }
      });
    }
  }

  function authHeaders() {
    var token = "";
    try {
      token = sessionStorage.getItem("amanikah.session") || "";
    } catch (err) {}
    return token ? { Authorization: "Bearer " + token } : {};
  }

  function api(path, options) {
    options = options || {};
    var headers = Object.assign({ Accept: "application/json" }, options.headers || {}, authHeaders());
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
    }).then(function (res) {
      return res.json().then(function (json) {
        return { status: res.status, body: json };
      });
    });
  }

  global.AmanikahPlatform = {
    wireLeadForm: wireLeadForm,
    wireTicketForm: wireTicketForm,
    api: api,
    post: post,
    qs: qs,
  };

  document.addEventListener("DOMContentLoaded", function () {
    wireLeadForm(document.getElementById("signup"));
    wireTicketForm(document.getElementById("contact"), "support");
    wireTicketForm(document.getElementById("safety-report"), "safety");
  });
})(window);
