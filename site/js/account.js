(function () {
  var status = document.getElementById("status");
  var panel = document.getElementById("panel");
  var summary = document.getElementById("summary");

  function requireSession() {
    return AmanikahPlatform.api("/me").then(function (r) {
      if (!r.body.ok) {
        status.textContent = "Sign in required.";
        window.location.href = "/account/login.html";
        return null;
      }
      return r.body.member;
    });
  }

  function updateJourney() {
    var fields = ["displayName", "city", "jurisdiction", "intentions"];
    var labels = ["Display name", "City", "Country or region", "Your marriage intentions"];
    var values = fields.map(function(id) { return document.getElementById(id).value.trim(); });
    var completed = values.filter(Boolean).length;
    document.getElementById("journeyCount").textContent =
      completed + " of 4 profile details prepared";
    var progress = document.getElementById("journeyProgress");
    progress.setAttribute("aria-valuenow", String(completed));
    document.getElementById("journeyFill").style.width = completed * 25 + "%";
    var tasks = document.getElementById("journeyChecklist").children;
    fields.forEach(function(_, index) {
      tasks[index].textContent = (values[index] ? "✓ " : "○ ") + labels[index];
    });
    var preview = [];
    if (values[0]) preview.push("My name: " + values[0]);
    if (values[1] || values[2]) preview.push("From: " + [values[1],values[2]].filter(Boolean).join(", "));
    if (values[3]) preview.push("What I hope for: " + values[3]);
    document.getElementById("journeyPreview").textContent = preview.length ?
      preview.join("\n") : "Start with a name and a few words about the home you hope to build. You decide what to share.";
  }
  ["displayName", "city", "jurisdiction", "intentions"].forEach(function(id) {
    document.getElementById(id).addEventListener("input", updateJourney);
  });

  function render(member) {
    status.textContent = "Signed in as " + member.email;
    panel.hidden = false;
    summary.replaceChildren();
    [
      ["Member id", member.id],
      ["Role", member.role],
      ["Email verified", member.emailVerified],
      ["Consent withdrawn", member.consent && member.consent.withdrawn],
    ].forEach(function (pair) {
      var li = document.createElement("li");
      li.textContent = pair[0] + ": " + pair[1];
      summary.appendChild(li);
    });
    var p = member.profile || {};
    document.getElementById("displayName").value = p.display_name || "";
    document.getElementById("city").value = p.city || "";
    document.getElementById("jurisdiction").value = p.jurisdiction || "";
    document.getElementById("intentions").value = p.intentions || "";
    updateJourney();
  }

  requireSession().then(function (member) {
    if (!member) return;
    render(member);
  });

  document.getElementById("profile").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    AmanikahPlatform.api("/me/profile", {
      method: "PATCH",
      body: {
        displayName: fd.get("displayName"),
        city: fd.get("city"),
        jurisdiction: fd.get("jurisdiction"),
        intentions: fd.get("intentions"),
      },
    }).then(function (r) {
      status.textContent = r.body.ok ? "Profile saved." : (r.body.message || r.body.code || "Save failed");
      if (r.body.member) render(r.body.member);
    });
  });

  document.getElementById("withdraw").addEventListener("click", function () {
    if (!confirm("Withdraw consent? Your profile stays private.")) return;
    AmanikahPlatform.api("/me/withdraw-consent", { method: "POST", body: {} }).then(function (r) {
      status.textContent = r.body.ok ? "Consent withdrawn." : (r.body.message || "Failed");
    });
  });

  document.getElementById("delete").addEventListener("click", function () {
    if (!confirm("Delete your production account permanently?")) return;
    AmanikahPlatform.api("/me/delete", { method: "POST", body: {} }).then(function (r) {
      if (!r.body.ok) {
        status.textContent = r.body.message || "Delete failed";
        return;
      }
      try { sessionStorage.removeItem("amanikah.session"); } catch (err) {}
      window.location.href = "/account/login.html";
    });
  });

  document.getElementById("logout").addEventListener("click", function () {
    try { sessionStorage.removeItem("amanikah.session"); } catch (err) {}
    window.location.href = "/account/login.html";
  });
})();
