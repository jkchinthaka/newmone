/**
 * Phase 08C recording editor hardening.
 * - Debounced autosave (server authoritative)
 * - Optimistic concurrency via expected_draft_version
 * - sessionStorage stash for session/network recovery (not IndexedDB / Phase 14)
 * - Dirty beforeunload + first-error focus
 */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var form = document.getElementById("recording-editor-form");
    if (!form || form.getAttribute("data-recording-editor") !== "1") {
      return;
    }

    var autosaveUrl = form.getAttribute("data-autosave-url");
    var recordId = form.getAttribute("data-record-id");
    var versionInput = form.querySelector('[name="expected_draft_version"]');
    var statusEl = document.getElementById("recording-autosave-status");
    var dirty = false;
    var saving = false;
    var timer = null;
    var STORAGE_KEY = "nelna_fg_recording_draft_" + recordId;

    function csrfToken() {
      var el = form.querySelector('[name="csrfmiddlewaretoken"]');
      return el ? el.value : "";
    }

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.hidden = !text;
      statusEl.textContent = text || "";
      statusEl.classList.toggle("recording-autosave-status--error", !!isError);
    }

    function markDirty() {
      dirty = true;
    }

    function stashLocal() {
      try {
        var data = new FormData(form);
        var obj = {};
        data.forEach(function (value, key) {
          obj[key] = value;
        });
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            draft_version: versionInput ? versionInput.value : null,
            fields: obj,
            saved_at: Date.now(),
          })
        );
      } catch (e) {
        /* ignore quota */
      }
    }

    function restoreLocalIfCompatible() {
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw || !versionInput) return;
        var parsed = JSON.parse(raw);
        if (!parsed || String(parsed.draft_version) !== String(versionInput.value)) {
          return;
        }
        var fields = parsed.fields || {};
        Object.keys(fields).forEach(function (key) {
          if (key === "csrfmiddlewaretoken") return;
          var els = form.querySelectorAll('[name="' + key + '"]');
          if (!els.length) return;
          var val = fields[key];
          els.forEach(function (el) {
            if (el.type === "radio" || el.type === "checkbox") {
              el.checked = el.value === val;
            } else {
              el.value = val;
            }
          });
        });
        setStatus("Restored unsaved local edits for this draft version. Review and Save Draft.", false);
        dirty = true;
      } catch (e) {
        /* ignore */
      }
    }

    function focusFirstError() {
      var err = form.querySelector(".form-errors, .errorlist, .alert-error");
      if (err && err.scrollIntoView) {
        err.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      var invalid = form.querySelector("[aria-invalid='true'], .form-field .form-errors");
      if (invalid) {
        var input = invalid.closest(".form-field, .recording-item");
        var focusable = input ? input.querySelector("input, select, textarea") : null;
        if (focusable) focusable.focus();
      }
    }

    function autosave() {
      if (!autosaveUrl || saving || !dirty) return;
      saving = true;
      setStatus("Saving…", false);
      stashLocal();
      var body = new FormData(form);
      fetch(autosaveUrl, {
        method: "POST",
        body: body,
        credentials: "same-origin",
        headers: {
          "X-CSRFToken": csrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then(function (resp) {
          if (resp.status === 401 || resp.status === 403) {
            stashLocal();
            setStatus("Session expired. Sign in again — your local edits were stashed for this browser tab.", true);
            window.location.href =
              "/accounts/login/?next=" + encodeURIComponent(window.location.pathname);
            return null;
          }
          return resp.json().then(function (data) {
            return { status: resp.status, data: data };
          });
        })
        .then(function (payload) {
          if (!payload) return;
          var data = payload.data || {};
          if (payload.status === 409 || data.error === "conflict") {
            dirty = false;
            setStatus(
              "Conflict detected. Reload before continuing (no silent overwrite).",
              true
            );
            var banner = document.getElementById("recording-conflict-banner");
            if (!banner) {
              window.alert(data.message || "Draft conflict — reload required.");
            }
            return;
          }
          if (!data.ok) {
            setStatus("Save failed. Fix highlighted fields, then Save Draft.", true);
            focusFirstError();
            return;
          }
          if (versionInput && data.draft_version) {
            versionInput.value = String(data.draft_version);
            form.setAttribute("data-draft-version", String(data.draft_version));
          }
          dirty = false;
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch (e) {}
          setStatus("Saved. Server version " + data.draft_version + ".", false);
        })
        .catch(function () {
          stashLocal();
          setStatus("Network issue — edits kept locally in this tab. Retrying is safe; server remains source of truth.", true);
        })
        .finally(function () {
          saving = false;
        });
    }

    form.addEventListener("input", markDirty);
    form.addEventListener("change", function () {
      markDirty();
      if (timer) clearTimeout(timer);
      timer = setTimeout(autosave, 2500);
    });

    window.addEventListener("beforeunload", function (event) {
      if (!dirty) return;
      stashLocal();
      event.preventDefault();
      event.returnValue = "";
    });

    var saveNow = form.querySelector("[data-autosave-now]");
    if (saveNow) {
      saveNow.addEventListener("click", function () {
        if (timer) clearTimeout(timer);
        dirty = true;
        autosave();
      });
    }

    restoreLocalIfCompatible();
    focusFirstError();
  });
})();
