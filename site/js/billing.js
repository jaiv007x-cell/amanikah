(function () {
  "use strict";

  var KEY = "amanikah.billing.buyer";

  function buyer() {
    var id = localStorage.getItem(KEY);
    if (!id) {
      id = "b" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function money(paise, currency) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    }).format((paise || 0) / 100);
  }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["Content-Type"] = "application/json";
    headers["X-Buyer-Id"] = buyer();
    try {
      var admin = localStorage.getItem("amanikah.billing.admin");
      if (admin) headers["X-Admin-Token"] = admin;
    } catch (err) {}
    return fetch(path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var err = new Error((body && (body.message || body.code)) || "Request failed");
          err.code = body && body.code;
          throw err;
        }
        return body;
      });
    });
  }

  function loadCatalog() {
    return api("/api/billing/catalog").catch(function () {
      return fetch("/config/services.json").then(function (res) { return res.json(); }).then(function (catalog) {
        catalog.offline = true;
        catalog.payment = {
          mode: "sandbox",
          live: false,
          configured: false,
          cardDataAccepted: false,
          message: "The billing service is not reachable. The fee schedule is visible, and checkout is unavailable."
        };
        return catalog;
      });
    });
  }

  function track(name) {
    return api("/api/billing/events", { method: "POST", body: { name: name } }).catch(function () {});
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }

  function notice(catalog) {
    var payment = catalog.payment || {};
    var isLive = payment.mode === "live" && payment.live === true && payment.configured === true;
    var label = isLive ? "" : "Paid services are not being sold yet. ";
    var disclaimer = isLive ? "" : " Example figures are for testing only and are not live charges.";
    return '<p class="notice">' + esc(label + (payment.message || catalog.scheduleNote || "") + disclaimer) + "</p>";
  }

  function list(items) {
    return "<ul>" + (items || []).map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</ul>";
  }

  function serviceBlock(service, currency) {
    return '<article class="card svc" id="' + esc(service.id) + '">' +
      "<h2>" + esc(service.name) + "</h2>" +
      "<p>" + esc(service.summary) + "</p>" +
      '<p class="money">' + esc(money(service.pricePaise, currency)) + ' <span class="quiet">sandbox fee</span></p>' +
      "<h3>Included</h3>" + list(service.included) +
      "<h3>Not included</h3>" + list(service.excluded) +
      "<h3>Duration</h3><p>" + esc(service.duration) + "</p>" +
      "<h3>Delivery</h3><p>" + esc(service.delivery) + "</p>" +
      "<h3>Verification limits</h3><p>" + esc(service.verificationLimits) + "</p>" +
      "<h3>Additional charges</h3>" + list(service.additionalCharges) +
      '<p><a class="btn btn-emerald" href="/checkout/?service=' + encodeURIComponent(service.id) + '">Review sandbox checkout</a> ' +
      '<a class="btn btn-ghost" href="/services/#' + esc(service.id) + '">Full terms</a></p></article>';
  }

  function renderPricing(root) {
    track("pricing_viewed");
    loadCatalog().then(function (catalog) {
      root.innerHTML = notice(catalog) +
        '<div class="prices">' +
        '<article class="price" id="free-membership"><h2>' + esc(catalog.free.name) + '</h2><p class="fee">No fee</p>' + list(catalog.free.includes) +
        '<p><a class="btn btn-emerald" href="/account/register.html">Create a private profile</a></p></article>' +
        catalog.services.map(function (service) {
          return '<article class="price" id="' + esc(service.id) + '"><h2>' + esc(service.name) + '</h2><p class="fee">' + esc(money(service.pricePaise, catalog.currency)) + '</p><p>' + esc(service.summary) + '</p>' +
            '<p><a class="btn btn-ghost" href="/services/#' + esc(service.id) + '">What is and is not included</a></p></article>';
        }).join("") +
        "</div>";
    }).catch(function () {
      // The server-rendered catalog remains available during API or JS failures.
      root.insertAdjacentHTML("afterbegin", '<p class="notice" role="status">The live catalog could not be refreshed. Example prices below are not available for purchase.</p>');
    });
  }

  function renderServices(root) {
    loadCatalog().then(function (catalog) {
      root.innerHTML = notice(catalog) + '<div class="svc-grid">' +
        catalog.services.map(function (service) { return serviceBlock(service, catalog.currency); }).join("") +
        "</div>";
    });
  }

  function renderCheckout(root) {
    var serviceId = new URLSearchParams(location.search).get("service");
    loadCatalog().then(function (catalog) {
      var service = (catalog.services || []).find(function (row) { return row.id === serviceId; }) || catalog.services[0];
      root.innerHTML = notice(catalog) +
        '<article class="panel"><h2>' + esc(service.name) + "</h2>" +
        '<p class="money">' + esc(money(service.pricePaise, catalog.currency)) + "</p>" +
        "<h3>Included</h3>" + list(service.included) +
        "<h3>Not included</h3>" + list(service.excluded) +
        "<p><strong>Duration.</strong> " + esc(service.duration) + "</p>" +
        "<p><strong>Delivery.</strong> " + esc(service.delivery) + "</p>" +
        "<p><strong>Limits.</strong> " + esc(service.verificationLimits) + "</p>" +
        '<form id="checkForm"><div class="field"><label for="referenceName">Name on the sandbox order</label><input id="referenceName" name="referenceName" autocomplete="name"></div>' +
        '<button class="btn btn-emerald" type="submit" id="startBtn">Start sandbox checkout</button></form>' +
        '<p id="checkStatus" role="status"></p><div id="payBox"></div></article>';
      document.getElementById("checkForm").onsubmit = function (event) {
        event.preventDefault();
        if (catalog.offline) {
          document.getElementById("checkStatus").textContent = "Checkout is unavailable until the billing service is reachable.";
          return;
        }
        document.getElementById("startBtn").disabled = true;
        document.getElementById("checkStatus").textContent = "Creating the order.";
        api("/api/billing/orders", {
          method: "POST",
          body: { serviceId: service.id, referenceName: document.getElementById("referenceName").value }
        }).then(function (res) {
          document.getElementById("checkStatus").textContent = "Order " + res.order.id + " is waiting. No card form is shown.";
          document.getElementById("payBox").innerHTML =
            '<div class="actions"><button class="btn btn-gold" type="button" id="payOk">Simulate successful payment</button>' +
            '<button class="btn btn-ghost" type="button" id="payNo">Simulate failed payment</button></div>';
          document.getElementById("payOk").onclick = function () { settle(res.order.id, "captured"); };
          document.getElementById("payNo").onclick = function () { settle(res.order.id, "failed"); };
        }).catch(function (err) {
          document.getElementById("checkStatus").textContent = err.message;
          document.getElementById("startBtn").disabled = false;
        });
      };
    });
  }

  function settle(orderId, outcome) {
    var status = document.getElementById("checkStatus");
    status.textContent = "Sending a signed sandbox webhook.";
    api("/api/billing/sandbox/payments", { method: "POST", body: { orderId: orderId, outcome: outcome } }).then(function (res) {
      var order = res.order;
      status.textContent = order.status === "paid"
        ? "Payment captured in sandbox. Invoice " + (order.invoice ? order.invoice.number : "") + " is ready. Nothing was charged to a card."
        : "Payment failed in sandbox. No invoice was issued.";
      document.getElementById("payBox").innerHTML = '<p><a class="btn btn-emerald" href="/orders/">View orders</a></p>';
    }).catch(function (err) { status.textContent = err.message; });
  }

  function renderOrders(root) {
    api("/api/billing/orders").then(function (res) {
      if (!res.orders.length) {
        root.innerHTML = '<p class="notice">Sandbox orders for this browser. No orders yet.</p><p><a href="/pricing/">See the fee schedule</a></p>';
        return;
      }
      root.innerHTML = '<p class="notice">Sandbox orders for this browser. These are not bank charges.</p>' +
        res.orders.map(function (order) {
          return '<article class="card"><h2>' + esc(order.serviceName) + "</h2>" +
            "<p>" + esc(money(order.amountPaise, order.currency)) + " · " + esc(order.status) + "</p>" +
            (order.invoice ? "<p>Invoice " + esc(order.invoice.number) + "</p>" : "<p>No invoice.</p>") +
            '<div class="actions">' +
            (order.status === "paid" ? '<button class="btn btn-ghost" type="button" data-fulfill="' + esc(order.id) + '">Mark sandbox service fulfilled</button>' : "") +
            (order.status === "paid" || order.status === "fulfilled" ? '<form data-refund="' + esc(order.id) + '"><label for="reason-' + esc(order.id) + '">Refund reason</label><input id="reason-' + esc(order.id) + '" name="reason"><button class="btn btn-ghost" type="submit">Request refund</button></form>' : "") +
            "</div><p class=\"status\" data-status=\"" + esc(order.id) + "\"></p></article>";
        }).join("");
      root.querySelectorAll("[data-fulfill]").forEach(function (btn) {
        btn.onclick = function () {
          api("/api/billing/orders/" + btn.getAttribute("data-fulfill") + "/fulfill", { method: "POST", body: {} }).then(function () {
            location.reload();
          }).catch(function (err) { flash(btn.getAttribute("data-fulfill"), err.message); });
        };
      });
      root.querySelectorAll("[data-refund]").forEach(function (form) {
        form.onsubmit = function (event) {
          event.preventDefault();
          var id = form.getAttribute("data-refund");
          api("/api/billing/orders/" + id + "/refund", { method: "POST", body: { reason: form.reason.value } }).then(function () {
            location.reload();
          }).catch(function (err) { flash(id, err.message); });
        };
      });
    }).catch(function (err) {
      root.innerHTML = '<p class="err">' + esc(err.message) + "</p>";
    });
  }

  function flash(id, message) {
    var el = document.querySelector('[data-status="' + id + '"]');
    if (el) el.textContent = message;
  }

  function renderBilling(root) {
    api("/api/billing/dashboard").then(function (dash) {
      var conversion = dash.conversion
        ? (dash.conversion.purchases + " purchases from " + dash.conversion.checkouts + " checkouts (" + Math.round(dash.conversion.rate * 100) + "%)")
        : "No checkouts recorded yet.";
      root.innerHTML = '<p class="notice">' + esc(dash.label) + "</p>" +
        '<div class="prices">' +
        metric("Revenue", money(dash.revenuePaise, dash.currency), "Captured sandbox payments minus refunds") +
        metric("Fulfillment cost", money(dash.fulfillmentCostPaise, dash.currency), "Catalog cost of fulfilled sandbox orders") +
        metric("Refunds", money(dash.refundsPaise, dash.currency), "Processed sandbox reversals") +
        metric("Contribution margin", money(dash.contributionMarginPaise, dash.currency), "Revenue minus fulfillment cost") +
        "</div>" +
        "<h2>Conversion</h2><p>" + esc(conversion) + "</p>" +
        "<h2>Recorded events</h2><ul>" +
        Object.keys(dash.counts).map(function (name) {
          return "<li>" + esc(name) + ": " + esc(String(dash.counts[name])) + "</li>";
        }).join("") + "</ul>";
    }).catch(function (err) {
      root.innerHTML = '<p class="err">' + esc(err.message) + "</p>";
    });
  }

  function metric(label, value, note) {
    return '<article class="price"><h2>' + esc(label) + '</h2><p class="money">' + esc(value) + "</p><p>" + esc(note) + "</p></article>";
  }

  function renderRefund(root) {
    loadCatalog().then(function (catalog) {
      var policy = catalog.refund;
      root.innerHTML = notice(catalog) +
        "<h2>Before work starts</h2><p>" + esc(policy.beforeWork) + "</p>" +
        "<h2>After work starts</h2><p>" + esc(policy.afterStart) + "</p>" +
        "<h2>If the scope is not delivered</h2><p>" + esc(policy.notDelivered) + "</p>" +
        "<h2>Outside this fee</h2><p>" + esc(policy.excluded) + "</p>" +
        "<p>A request in this sandbox can be sent within " + esc(String(policy.windowDays)) + " days from the orders page. The reversal is recorded only after a signed refund webhook.</p>" +
        catalog.services.map(function (service) {
          return "<h2>" + esc(service.name) + "</h2><p>" + esc(service.duration) + " " + list(service.additionalCharges) + "</p>";
        }).join("") +
        '<p><a class="btn btn-emerald" href="/orders/">Request a refund on an order</a></p>';
    });
  }

  var pages = {
    pricing: renderPricing,
    services: renderServices,
    checkout: renderCheckout,
    orders: renderOrders,
    billing: renderBilling,
    refund: renderRefund
  };

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    var root = document.getElementById("billing");
    if (page && pages[page] && root) pages[page](root);
    var mount = document.getElementById("priceMount");
    if (mount) {
      loadCatalog().then(function (catalog) {
        mount.innerHTML = catalog.services.map(function (service) {
          return "<li>" + esc(service.name) + ": " + esc(money(service.pricePaise, catalog.currency)) + " on the sandbox schedule</li>";
        }).join("");
      }).catch(function () {});
    }
  });

  window.AmanikahBilling = { track: track, buyer: buyer };
})();
