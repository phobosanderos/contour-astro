(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  function getKey(name) {
    return "ct-a11y-" + name;
  }

  function setState(key, value) {
    try {
      localStorage.setItem(getKey(key), value ? "on" : "off");
    } catch (e) {}
  }

  function getState(key) {
    try {
      return localStorage.getItem(getKey(key)) === "on";
    } catch (e) {
      return false;
    }
  }

  function clearState(key) {
    try {
      localStorage.removeItem(getKey(key));
    } catch (e) {}
  }

  function setButtonPressedState() {
    var buttons = doc.querySelectorAll("[data-a11y]");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (button.dataset.a11y === "reset") continue;
      button.setAttribute("aria-pressed", String(getState(button.dataset.a11y)));
    }
  }

  function applyAccessibilityState() {
    var contrast = getState("contrast");
    var text = getState("text");
    var motion = getState("motion");

    root.setAttribute("data-a11y-contrast", String(contrast));
    root.setAttribute("data-a11y-text", String(text));
    root.setAttribute("data-a11y-motion", String(motion));

    var trigger = doc.querySelector('[data-action="accessibility"]');
    var panel = doc.getElementById("accessibility-panel");
    if (trigger && panel) {
      trigger.setAttribute("aria-expanded", String(!panel.hidden));
    }

    setButtonPressedState();
  }

  function togglePanel() {
    var panel = doc.getElementById("accessibility-panel");
    if (!panel) return;

    var hidden = panel.hidden;
    panel.hidden = !hidden;

    var trigger = doc.querySelector('[data-action="accessibility"]');
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

  doc.addEventListener("click", function (event) {
    var trigger = event.target.closest('[data-action="accessibility"]');
    if (trigger) {
      togglePanel();
      return;
    }

    var option = event.target.closest("[data-a11y]");
    if (option) {
      toggleAccessibility(option.dataset.a11y);
    }
  });

  doc.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      var panel = doc.getElementById("accessibility-panel");
      if (panel && !panel.hidden) {
        panel.hidden = true;
        var trigger = doc.querySelector('[data-action="accessibility"]');
        if (trigger) {
          trigger.setAttribute("aria-expanded", "false");
        }
      }
    }
  });

  applyAccessibilityState();
})();
