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

  function loadIntroductionInvitations() {
    AmanikahPlatform.api("/me/introductions").then(function(r) {
      var section=document.getElementById("memberIntroductions");
      if (!r.body || !r.body.ok) {
        section.hidden=true; // Stay hidden before a real two-adult matching launch.
        return;
      }
      section.hidden=false;
      var list=document.getElementById("memberIntroList");
      list.replaceChildren();
      var invites=r.body.introductions || [];
      document.getElementById("memberIntroStatus").textContent = invites.length ?
        "You can choose freely. No decision is shared with another member before the coordinator checks both adults." :
        "No invitations yet. There is no rush.";
      invites.forEach(function(item) {
        var card=document.createElement("article");
        card.className="panel";card.style.marginBottom="12px";
        var title=document.createElement("h3");
        title.textContent="Private invitation "+String(item.reference||"");
        var detail=document.createElement("p");
        detail.textContent="Status: "+item.status+(item.myDecision?" · Your choice: "+item.myDecision:"");
        card.append(title,detail);
        if (!item.myDecision && item.status==="open") {
          var row=document.createElement("div");row.className="row";
          ["accept","decline"].forEach(function(choice) {
            var button=document.createElement("button");
            button.type="button";button.className="btn btn-ghost";
            button.textContent=choice==="accept"?"I am open to a conversation":"No, thank you";
            button.addEventListener("click",function() {
              var question = choice==="accept" ?
                "Are you freely choosing to consider this introduction? No private contact details will be released automatically." :
                "Decline this introduction? You do not need to give a reason.";
              if(!window.confirm(question))return;
              button.disabled=true;
              AmanikahPlatform.api("/me/introductions/"+encodeURIComponent(item.id)+"/respond",{
                method:"POST",body:{decision:choice}
              }).then(function(result){
                if(!result.body || !result.body.ok) {
                  document.getElementById("memberIntroStatus").textContent=
                    (result.body && (result.body.message||result.body.code))||"Unable to save your choice.";
                } else {loadIntroductionInvitations();}
              }).catch(function(){
                document.getElementById("memberIntroStatus").textContent="Connection error. Try again.";
              }).finally(function(){button.disabled=false;});
            });
            row.appendChild(button);
          });
          card.appendChild(row);
        }
        list.appendChild(card);
      });
    }).catch(function(){
      document.getElementById("memberIntroductions").hidden=true;
    });
  }

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
    loadIntroductionInvitations();
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
      status.textContent = r.body.ok ?
        "Consent withdrawn. You have been signed out and all active invitations were paused." :
        (r.body.message || "Failed");
      if (r.body.ok) {
        try { sessionStorage.removeItem("amanikah.session"); } catch (err) {}
        panel.hidden=true;
      }
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
    status.textContent = "Signing out securely…";
    AmanikahPlatform.api("/auth/logout", { method: "POST", body: {} }).then(function(r) {
      if (!r.body || !r.body.ok) {
        status.textContent = "Unable to confirm server logout. Please try again.";
        return;
      }
      try { sessionStorage.removeItem("amanikah.session"); } catch (err) {}
      window.location.href = "/account/login.html";
    }).catch(function() {
      status.textContent = "Network error: server logout could not be confirmed. Please try again.";
    });
  });
})();
