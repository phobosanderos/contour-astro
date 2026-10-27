/*
 * Contour — Formgong template script.
 * Works without GSAP; with GSAP + ScrollTrigger + SplitText + Lenis it runs the full motion layer.
 */
(function () {
  "use strict";
    function getKey(name) {
    return "ct-a11y-" + name;
  }

  function setState(key, value) {
    localStorage.setItem(getKey(key), value ? "on" : "off");
  }

  function getState(key) {
    return localStorage.getItem(getKey(key)) === "on";
  }

  function clearState(key) {
    localStorage.removeItem(getKey(key));
  }

  function applyAccessibilityState() {
    var root = document.documentElement;
    var contrast = getState("contrast");
    var text = getState("text");
    var motion = getState("motion");

    root.setAttribute("data-a11y-contrast", String(contrast));
    root.setAttribute("data-a11y-text", String(text));
    root.setAttribute("data-a11y-motion", String(motion));

    var trigger = document.querySelector('[data-action="accessibility"]');
    var panel = document.getElementById("accessibility-panel");
    if (trigger && panel) {
      trigger.setAttribute("aria-expanded", String(!panel.hidden));
    }

    document.querySelectorAll("[data-a11y]").forEach(function (button) {
      if (button.dataset.a11y === "reset") return;
      var on = getState(button.dataset.a11y);
      button.setAttribute("aria-pressed", String(on));
    });
  }

  function togglePanel() {
    var panel = document.getElementById("accessibility-panel");
    if (!panel) return;

    var hidden = panel.hidden;
    panel.hidden = !hidden;

    var trigger = document.querySelector('[data-action="accessibility"]');
    if (trigger) {
      trigger.setAttribute("aria-expanded", String(!hidden));
    }
  }

  function toggleAccessibility(type) {
    if (type === "reset") {
      ["contrast", "text", "motion"].forEach(clearState);
      applyAccessibilityState();
      return;
    }

    var next = !getState(type);
    setState(type, next);
    applyAccessibilityState();
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest('[data-action="accessibility"]');
    if (trigger) {
      togglePanel();
      return;
    }

    var option = event.target.closest("[data-a11y]");
    if (option) {
      toggleAccessibility(option.dataset.a11y);
      return;
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      var panel = document.getElementById("accessibility-panel");
      if (panel && !panel.hidden) {
        panel.hidden = true;
        var trigger = document.querySelector('[data-action="accessibility"]');
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      }
    }
  });

  applyAccessibilityState();
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  function applyAccessibility() {
    var contrast = localStorage.getItem("ct-a11y-contrast") === "on";
    var text = localStorage.getItem("ct-a11y-text") === "on";
    var motion = localStorage.getItem("ct-a11y-motion") === "on";

    root.setAttribute("data-a11y-contrast", String(contrast));
    root.setAttribute("data-a11y-text", String(text));
    root.setAttribute("data-a11y-motion", String(motion));

    var panel = $("#accessibility-panel");
    if (panel) {
      var button = $("[data-action='accessibility']", panel.parentElement);
      if (button) button.setAttribute("aria-expanded", String(!panel.hidden));
    }

    ["contrast", "text", "motion"].forEach(function (key) {
      var pressed = localStorage.getItem("ct-a11y-" + key) === "on";
      var op = $("[data-a11y='" + key + "']");
      if (op) op.setAttribute("aria-pressed", String(pressed));
    });
  }

  function openAccessibilityPanel(forceOpen) {
    var panel = document.getElementById("accessibility-panel");
    if (!panel) return;
    var close = typeof forceOpen === "boolean" ? !forceOpen : panel.hidden;
    panel.hidden = close;
    var trigger = document.querySelector('[data-action="accessibility"]');
    if (trigger) trigger.setAttribute("aria-expanded", String(!panel.hidden));
  }

  function toggleAccessibility(type) {
    var key = "ct-a11y-" + type;
    var current = localStorage.getItem(key) === "on";
    var next = String(!current);
    localStorage.setItem(key, next === "true" ? "on" : "off");
    applyAccessibility();
    if (type === "motion") {
      var reduce = next === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (window.__accessibilityMotionState !== reduce) {
        window.__accessibilityMotionState = reduce;
      }
    }
  }

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("ct-a11y-motion") === "on";
  var EMAIL = (($("a[href^='mailto:']") || {}).href || "").replace("mailto:", "");
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var ACCENTS = ["blue", "orange", "lime"];

  /* ---------- theme, accent, grid ---------- */
  function themeColor() { var m = $("meta[name=theme-color]"); if (m) m.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim()); }
  function toggleTheme() { var t = root.dataset.theme === "dark" ? "light" : "dark"; root.dataset.theme = t; store.set("ct-theme", t); themeColor(); }
  function nextAccent() { var a = ACCENTS[(ACCENTS.indexOf(root.dataset.accent || "blue") + 1) % ACCENTS.length]; root.dataset.accent = a; store.set("ct-accent", a); }
  function toggleGrid() { root.dataset.grid = root.dataset.grid === "on" ? "off" : "on"; }
  themeColor();

  doc.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action]"); if (!t) return;
    var a = t.dataset.action;
    if (a === "theme") toggleTheme();
    else if (a === "accent") nextAccent();
    else if (a === "palette") openPalette();
    else if (a === "grid") toggleGrid();
    else if (a === "accessibility") {
      e.preventDefault();
      openAccessibilityPanel();
    }
  });

  doc.addEventListener("click", function (e) {
    var action = e.target.closest("[data-a11y]");
    if (!action) return;
    toggleAccessibility(action.dataset.a11y);
  });

  doc.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (!e.metaKey && !e.ctrlKey && e.code === "KeyG" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") { e.preventDefault(); toggleGrid(); }
    if (e.key === "Escape") {
      var panel = document.getElementById("accessibility-panel");
      if (panel && !panel.hidden) {
        panel.hidden = true;
        var trigger = document.querySelector('[data-action="accessibility"]');
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      }
    }
  });

  applyAccessibility();
  if (document.readyState === "complete") {
    applyAccessibility();
  }

  // add one-time hook to keep the accessibility panel state synced when the page is loaded
  if (document.querySelector('[data-action="accessibility"]')) {
    document.addEventListener("DOMContentLoaded", applyAccessibility);
  }

  /* ---------- rest of site.js below remains unchanged ---------- */
  var pal, palItems = [], palShown = [], palSel = 0;
  function esc(s) { return String(s).replace(/[&<>\"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function go(a) {
    return function () {
      pal.close();
      var same = a.hash && a.pathname === location.pathname, t = same && doc.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!t) { location.href = a.href; return; }
      if (window.__lenis) window.__lenis.scrollTo(t); else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    };
  }
  function buildPalette() {
    pal = doc.createElement("dialog");
    pal.className = "palette"; pal.setAttribute("aria-label", "Command palette");
    pal.innerHTML = '<div class="palette__box"><div class="palette__search"><span class="note" aria-hidden="true">⌘K</span>' +
      '<input type="text" role="combobox" aria-label="Search sections and actions" aria-expanded="true" aria-autocomplete="list" aria-controls="palette-list" placeholder="Search sections, actions…" />' +
      '<button type="button" class="note palette__close" aria-label="Close (Esc)">Esc</button></div>' +
      '<ul class="palette__list" id="palette-list" role="listbox" aria-label="Results"></ul><p class="sr-only" role="status" data-palette-count></p></div>';
    doc.body.appendChild(pal);
    var seen = {};
    $$(".nav a[href], [data-palette-link]").forEach(function (a) {
      if (seen[a.href]) return; seen[a.href] = 1;
      palItems.push({ group: "Go to", label: (a.querySelector(".nav__label, .wp-block-navigation-item__label") || a).textContent.trim(), hint: a.hash || a.pathname, run: go(a) });
    });
    var ct = doc.getElementById("contact");
    if (ct && !$$(".nav a[href]").some(function (a) { return a.hash === "#contact"; })) { var fake = doc.createElement("a"); fake.href = "#contact"; palItems.push({ group: "Go to", label: "Contact", hint: "#contact", run: go(fake) }); }
    palItems.push({ group: "Do", label: "Toggle light / dark", hint: "theme", run: toggleTheme });
    palItems.push({ group: "Do", label: "Next accent colour", hint: "accent", run: nextAccent });
    palItems.push({ group: "Do", label: "Show the grid", hint: "G", run: function () { toggleGrid(); pal.close(); } });
    if (EMAIL) palItems.push({ group: "Do", label: "Copy email address", hint: EMAIL, run: function () { if (navigator.clipboard) navigator.clipboard.writeText(EMAIL); pal.close(); } });
    var input = $("input", pal);
    input.addEventListener("input", function () { palSel = 0; filter(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { palSel = Math.min(palSel + 1, palShown.length - 1); e.preventDefault(); mark(); }
      else if (e.key === "ArrowUp") { palSel = Math.max(palSel - 1, 0); e.preventDefault(); mark(); }
      else if (e.key === "Enter" && palShown[palSel]) palShown[palSel].run();
    });
    $(".palette__close", pal).addEventListener("click", function () { pal.close(); });
    pal.addEventListener("click", function (e) { if (e.target === pal) pal.close(); });
    var list = $(".palette__list", pal);
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    list.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li && palShown[+li.dataset.i]) palShown[+li.dataset.i].run(); });
    pal.addEventListener("close", function () { if (window.__lenis) window.__lenis.start(); });
  }
  function filter(q) {
    q = q.trim().toLowerCase();
    palShown = q ? palItems.filter(function (i) { return (i.label + " " + i.hint + " " + i.group).toLowerCase().indexOf(q) > -1; }) : palItems;
    var g = "", html = palShown.map(function (it, i) {
      var head = it.group === g ? "" : '<li class="note palette__group" role="presentation">' + (g = it.group) + "</li>";
      return head + '<li role="option" id="palette-opt-' + i + '" data-i="' + i + '"><span>' + esc(it.label) + '</span><span class="note">' + esc(it.hint) + "</span></li>";
    }).join("");
    $(".palette__list", pal).innerHTML = html || '<li class="palette__empty note" role="presentation">Nothing found. Try “work” or “theme”.</li>';
    $("[data-palette-count]", pal).textContent = q ? palShown.length + " result" + (palShown.length === 1 ? "" : "s") : "";
    mark();
  }
  function mark() {
    var input = $("input", pal); input.removeAttribute("aria-activedescendant");
    $$("[data-i]", pal).forEach(function (li) { var on = +li.dataset.i === palSel; li.setAttribute("aria-selected", on); if (on) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); } else { li.removeAttribute("aria-selected"); } });
  }
  function openPalette() {
    if (!pal) buildPalette();
    if (pal.open) return pal.close();
    palSel = 0; var input = $("input", pal); input.value = ""; filter("");
    if (window.__lenis) window.__lenis.stop();
    pal.showModal(); input.focus();
  }

  // The rest of the original site.js continues below here as-is from the project file.
})();
