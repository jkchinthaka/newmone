/**
 * Minimal foundation JavaScript.
 * Core navigation and authentication must work without JavaScript.
 * Password visibility and submit loading states are progressive enhancements.
 */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("js-enabled");
  initPasswordToggles();
  initAuthSubmitLoading();
  initNavDrawer();
});

function initPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("aria-controls");
      if (!targetId) {
        return;
      }
      const input = document.getElementById(targetId);
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute("aria-pressed", showing ? "false" : "true");
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password",
      );
      const label = button.querySelector("[data-password-toggle-label]");
      if (label) {
        label.textContent = showing ? "Show" : "Hide";
      }
    });
  });
}

function initAuthSubmitLoading() {
  document.querySelectorAll("form[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", () => {
      const submit = form.querySelector("[data-auth-submit]");
      if (!(submit instanceof HTMLButtonElement) || submit.disabled) {
        return;
      }
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      const idle = submit.querySelector("[data-auth-submit-idle]");
      const busy = submit.querySelector("[data-auth-submit-busy]");
      if (idle) {
        idle.hidden = true;
      }
      if (busy) {
        busy.hidden = false;
      }
    });
  });
}

function initNavDrawer() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  if (!(toggle instanceof HTMLButtonElement)) {
    return;
  }
  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (backdrop instanceof HTMLElement) {
      backdrop.hidden = !open;
    }
  };
  toggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("nav-open"));
  });
  if (backdrop instanceof HTMLElement) {
    backdrop.addEventListener("click", () => setOpen(false));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  });
}
