(function () {
  var API = "/api/amanikah/ops";
  var tokenKey = "amanikah.ops.token";
  var statusEl = document.getElementById("opsStatus");

  function token() {
    var input = document.getElementById("opsToken");
    return (input && input.value) || "";
  }

  function saveToken() {
    try { sessionStorage.setItem(tokenKey, token()); } catch (err) {}
  }

  function restoreToken() {
    try {
      var t = sessionStorage.getItem(tokenKey) || "";
      if (t) document.getElementById("opsToken").value = t;
    } catch (err) {}
  }

  function call(path, options) {
    options = options || {};
    return fetch(API + path, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Ops-Token": token(),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (json) {
        return { status: res.status, body: json };
      });
    });
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.firstElementChild || d;
  }

  function table(rows, cols, actions) {
    if (!rows || !rows.length) return "<p class='muted'>None.</p>";
    var head = cols.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + (actions ? "<th></th>" : "");
    var body = rows.map(function (row) {
      var cells = cols.map(function (c) {
        var v = row[c.key];
        if (c.key === "status") v = "<span class='pill'>" + (v || "") + "</span>";
        return "<td>" + (v == null ? "" : String(v)) + "</td>";
      }).join("");
      var act = actions ? "<td>" + actions(row) + "</td>" : "";
      return "<tr data-id='" + row.id + "'>" + cells + act + "</tr>";
    }).join("");
    return "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function leadActions(row) {
    return "<select class='inline' data-lead-status='" + row.id + "'>" +
      ["new", "contacted", "qualified", "converted", "closed"].map(function (s) {
        return "<option value='" + s + "'" + (s === row.status ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select>";
  }

  function ticketActions(row) {
    return "<select class='inline' data-ticket-status='" + row.id + "'>" +
      ["new", "acknowledged", "in_progress", "resolved", "closed"].map(function (s) {
        return "<option value='" + s + "'" + (s === row.status ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select>";
  }

  function caseActions(row) {
    return "<select class='inline' data-case-status='" + row.id + "'>" +
      ["draft", "open", "mutual", "paused", "closed"].map(function (s) {
        return "<option value='" + s + "'" + (s === row.status ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select>";
  }

  function verActions(row) {
    return "<select class='inline' data-ver-status='" + row.id + "'>" +
      ["requested", "in_review", "completed", "unable", "cancelled"].map(function (s) {
        return "<option value='" + s + "'" + (s === row.status ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select>";
  }

  function fulActions(row) {
    return "<select class='inline' data-ful-status='" + row.id + "'>" +
      ["queued", "in_progress", "delivered", "blocked", "cancelled"].map(function (s) {
        return "<option value='" + s + "'" + (s === row.status ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select>";
  }

  function bindStatusSelects(root, attr, path) {
    root.querySelectorAll("[" + attr + "]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute(attr);
        call("/" + path + "/" + id, { method: "PATCH", body: { status: sel.value } }).then(function (r) {
          statusEl.textContent = r.body.ok ? "Updated " + path + " " + id : (r.body.message || r.body.code || "Update failed");
          if (r.body.ok) loadAll();
        });
      });
    });
  }

  function loadAll() {
    if (!token()) {
      statusEl.textContent = "Enter the ops token.";
      return;
    }
    saveToken();
    statusEl.textContent = "Loading…";
    Promise.all([
      call("/dashboard"),
      call("/leads"),
      call("/tickets"),
      call("/cases"),
      call("/verifications"),
      call("/fulfillment"),
      call("/notifications"),
      call("/funnel?days=30"),
    ]).then(function (results) {
      var dash = results[0];
      if (dash.status === 401) {
        statusEl.textContent = "Unauthorized. Check OPS_ADMIN_TOKEN.";
        return;
      }
      if (!dash.body || dash.status >= 400) {
        statusEl.textContent = "Failed to load dashboard.";
        return;
      }
      statusEl.textContent = "Loaded.";
      var d = dash.body;
      var dashEl = document.getElementById("dash");
      dashEl.hidden = false;
      dashEl.innerHTML =
        "<p><span class='pill'>" + (d.mode || "") + "</span> " +
        "matchmakingLive=" + d.matchmakingLive +
        " · mailConfigured=" + d.mailConfigured +
        " · operatorEmailConfigured=" + d.operatorEmailConfigured +
        " · payments=" + d.payments + "</p>" +
        "<p>Leads new/contacted/qualified/converted/closed: " +
        [d.leads.new, d.leads.contacted, d.leads.qualified, d.leads.converted, d.leads.closed].join(" / ") +
        " · tickets open " + d.ticketsOpen + " · safety open " + d.safetyOpen +
        " · members " + d.members + " · cases " + d.casesOpen +
        " · verifications " + d.verificationsOpen +
        " · fulfillment " + d.fulfillmentQueued +
        " · notify queued/failed " + d.notificationsQueued + "/" + d.notificationsFailed +
        " · demoMembers(excluded) " + d.demoMembers + "</p>";

      var funnelPanel = document.getElementById("funnelPanel");
      var funnelRoot = document.getElementById("funnel");
      var funnel = results[7] && results[7].body;
      if (funnelPanel && funnelRoot && funnel && funnel.ok) {
        funnelPanel.hidden = false;
        var t = funnel.totals || {};
        var keys = [
          "landing_view", "quiz_started", "quiz_completed", "pledge_completed",
          "signup_started", "signup_completed", "lead_qualified", "operator_contacted",
          "introduction_requested", "introduction_accepted",
          "checkout_started", "payment_confirmed", "service_fulfilled", "refund_completed",
        ];
        funnelRoot.innerHTML =
          "<p>" + keys.map(function (k) { return k + "=" + (t[k] || 0); }).join(" · ") + "</p>" +
          "<p class='muted'>Production members (period): " + (funnel.membersProduction || 0) +
          ". " + (funnel.note || "") + " paymentsMode=" + (funnel.paymentsMode || "") + "</p>" +
          table(funnel.leadsBySourceStatus || [], [
            { key: "source", label: "Source" },
            { key: "status", label: "Status" },
            { key: "n", label: "Leads" },
          ]) +
          table(funnel.leadsByDay || [], [
            { key: "day", label: "Day" },
            { key: "leads", label: "Leads" },
          ]);
      }

      var leadsRoot = document.getElementById("leads");
      leadsRoot.innerHTML = table(results[1].body.leads, [
        { key: "reference", label: "Ref" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
        { key: "source", label: "Source" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created" },
      ], leadActions);
      bindStatusSelects(leadsRoot, "data-lead-status", "leads");

      var ticketsRoot = document.getElementById("tickets");
      ticketsRoot.innerHTML = table(results[2].body.tickets, [
        { key: "reference", label: "Ref" },
        { key: "kind", label: "Kind" },
        { key: "topic", label: "Topic" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created" },
      ], ticketActions);
      bindStatusSelects(ticketsRoot, "data-ticket-status", "tickets");

      var casesRoot = document.getElementById("cases");
      casesRoot.innerHTML = table(results[3].body.cases, [
        { key: "reference", label: "Ref" },
        { key: "peer_label", label: "Peer" },
        { key: "lead_id", label: "Lead" },
        { key: "status", label: "Status" },
      ], caseActions);
      bindStatusSelects(casesRoot, "data-case-status", "cases");

      var versRoot = document.getElementById("vers");
      versRoot.innerHTML = table(results[4].body.requests, [
        { key: "reference", label: "Ref" },
        { key: "claim", label: "Claim" },
        { key: "member_id", label: "Member" },
        { key: "status", label: "Status" },
      ], verActions);
      bindStatusSelects(versRoot, "data-ver-status", "verifications");

      var fulsRoot = document.getElementById("fuls");
      fulsRoot.innerHTML = table(results[5].body.items, [
        { key: "id", label: "Id" },
        { key: "service_id", label: "Service" },
        { key: "order_ref", label: "Order" },
        { key: "status", label: "Status" },
      ], fulActions);
      bindStatusSelects(fulsRoot, "data-ful-status", "fulfillment");

      var notesRoot = document.getElementById("notes");
      notesRoot.innerHTML = table(results[6].body.notifications, [
        { key: "created_at", label: "When" },
        { key: "subject", label: "Subject" },
        { key: "destination", label: "To" },
        { key: "status", label: "Status" },
        { key: "error", label: "Error" },
      ]);
    }).catch(function () {
      statusEl.textContent = "Network error loading console.";
    });
  }

  document.getElementById("loadBtn").addEventListener("click", loadAll);
  document.getElementById("clearBtn").addEventListener("click", function () {
    try { sessionStorage.removeItem(tokenKey); } catch (err) {}
    document.getElementById("opsToken").value = "";
    statusEl.textContent = "Token cleared.";
  });

  document.getElementById("caseForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    call("/cases", {
      method: "POST",
      body: { leadId: fd.get("leadId") || null, peerLabel: fd.get("peerLabel"), notes: fd.get("notes") },
    }).then(function (r) {
      statusEl.textContent = r.body.ok ? "Case " + r.body.case.reference : (r.body.message || "Case failed");
      if (r.body.ok) loadAll();
    });
  });

  document.getElementById("verForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    call("/verifications", {
      method: "POST",
      body: { memberId: fd.get("memberId") || null, claim: fd.get("claim") },
    }).then(function (r) {
      statusEl.textContent = r.body.ok ? "Verification " + r.body.request.reference : (r.body.message || "Verification failed");
      if (r.body.ok) loadAll();
    });
  });

  document.getElementById("fulForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    call("/fulfillment", {
      method: "POST",
      body: { serviceId: fd.get("serviceId"), orderRef: fd.get("orderRef") || null, leadId: fd.get("leadId") || null },
    }).then(function (r) {
      statusEl.textContent = r.body.ok ? "Fulfillment queued" : (r.body.message || "Fulfillment failed");
      if (r.body.ok) loadAll();
    });
  });

  restoreToken();
  if (token()) loadAll();
})();
