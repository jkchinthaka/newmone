/**
 * MaintainPro entity autocomplete — debounce, stale-response ignore, keyboard nav.
 */
(function () {
  function initSelector(root) {
    if (!(root instanceof HTMLElement) || root.dataset.mpReady === "1") {
      return;
    }
    root.dataset.mpReady = "1";

    const input = root.querySelector("[data-mp-input]");
    const hidden = root.querySelector("[data-mp-id]");
    const listbox = root.querySelector("[data-mp-listbox]");
    const status = root.querySelector("[data-mp-status]");
    const loading = root.querySelector("[data-mp-loading]");
    if (
      !(input instanceof HTMLInputElement) ||
      !(hidden instanceof HTMLInputElement) ||
      !(listbox instanceof HTMLElement)
    ) {
      return;
    }

    const searchUrl = root.getAttribute("data-search-url") || "";
    const orgId = root.getAttribute("data-organization-id") || "";
    const debounceMs = Number(root.getAttribute("data-debounce-ms") || "250");
    let timer = null;
    let seq = 0;
    let activeIndex = -1;
    let abortController = null;

    const setStatus = (text) => {
      if (status) {
        status.textContent = text || "";
      }
    };

    const setLoading = (on) => {
      if (loading instanceof HTMLElement) {
        loading.hidden = !on;
      }
      input.setAttribute("aria-busy", on ? "true" : "false");
    };

    const close = () => {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    };

    const open = () => {
      listbox.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };

    const options = () =>
      Array.from(listbox.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));

    const highlight = (index) => {
      const opts = options();
      opts.forEach((el, i) => {
        el.classList.toggle("is-active", i === index);
        if (i === index) {
          el.setAttribute("aria-selected", "true");
          input.setAttribute("aria-activedescendant", el.id || "");
        } else {
          el.removeAttribute("aria-selected");
        }
      });
      activeIndex = index;
    };

    const selectOption = (el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      hidden.value = el.getAttribute("data-id") || "";
      input.value = el.getAttribute("data-label") || el.textContent?.trim() || "";
      setStatus("Selected from MaintainPro");
      close();
    };

    const renderResults = (payload) => {
      listbox.innerHTML = "";
      const rows = payload.results || [];
      if (payload.success === false) {
        const li = document.createElement("li");
        li.className = "mp-selector__empty";
        li.setAttribute("role", "option");
        li.setAttribute("aria-disabled", "true");
        li.textContent = payload.message || "Lookup failed";
        listbox.appendChild(li);
        open();
        setStatus(payload.message || "Error");
        return;
      }
      if (!rows.length) {
        const li = document.createElement("li");
        li.className = "mp-selector__empty";
        li.setAttribute("role", "option");
        li.setAttribute("aria-disabled", "true");
        li.textContent = "No matching vehicles";
        listbox.appendChild(li);
        open();
        setStatus("No results");
        return;
      }
      rows.forEach((row, i) => {
        const li = document.createElement("li");
        li.className = "mp-selector__option";
        li.setAttribute("role", "option");
        li.id = `mp-opt-${seq}-${i}`;
        li.tabIndex = -1;
        li.setAttribute("data-id", row.id || "");
        const label =
          row.label ||
          [row.registrationNo, [row.make, row.vehicleModel].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(" — ");
        li.setAttribute("data-label", label);
        li.setAttribute("data-status", row.status || "");
        li.innerHTML =
          `<span class="mp-selector__primary">${escapeHtml(row.registrationNo || label)}</span>` +
          `<span class="mp-selector__secondary">${escapeHtml(
            [row.make, row.vehicleModel].filter(Boolean).join(" ") +
              (row.status ? ` · ${row.status}` : ""),
          )}</span>`;
        li.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          selectOption(li);
        });
        listbox.appendChild(li);
      });
      open();
      setStatus(`${rows.length} result${rows.length === 1 ? "" : "s"}`);
      highlight(0);
    };

    const runSearch = async (query) => {
      const mySeq = ++seq;
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      if (!query.trim()) {
        hidden.value = "";
        close();
        setStatus("");
        setLoading(false);
        return;
      }
      // Typing without a fresh selection clears prior id.
      hidden.value = "";
      setLoading(true);
      setStatus("Searching…");
      try {
        const url = new URL(searchUrl, window.location.origin);
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("request_id", String(mySeq));
        if (orgId) {
          url.searchParams.set("organization_id", orgId);
        }
        const csrf = document.querySelector('meta[name="csrf-token"]');
        const headers = { Accept: "application/json" };
        if (csrf instanceof HTMLMetaElement && csrf.content) {
          headers["X-CSRFToken"] = csrf.content;
        }
        const res = await fetch(url.toString(), {
          method: "GET",
          credentials: "same-origin",
          headers,
          signal: abortController.signal,
        });
        const data = await res.json().catch(() => ({
          success: false,
          message: "Lookup failed",
          results: [],
        }));
        if (mySeq !== seq) {
          return; // stale
        }
        if (!res.ok && data.success !== false) {
          data.success = false;
          data.message = data.message || "Lookup failed";
        }
        renderResults(data);
      } catch (err) {
        if (err && err.name === "AbortError") {
          return;
        }
        if (mySeq !== seq) {
          return;
        }
        renderResults({
          success: false,
          message: "Vehicle lookup failed. Try again.",
          results: [],
        });
      } finally {
        if (mySeq === seq) {
          setLoading(false);
        }
      }
    };

    input.addEventListener("input", () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => runSearch(input.value), debounceMs);
    });

    input.addEventListener("keydown", (event) => {
      const opts = options();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (listbox.hidden) {
          runSearch(input.value);
          return;
        }
        highlight(Math.min(activeIndex + 1, opts.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlight(Math.max(activeIndex - 1, 0));
      } else if (event.key === "Enter") {
        if (!listbox.hidden && activeIndex >= 0 && opts[activeIndex]) {
          event.preventDefault();
          selectOption(opts[activeIndex]);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(close, 150);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function boot() {
    document.querySelectorAll("[data-mp-selector]").forEach(initSelector);
  }

  document.addEventListener("DOMContentLoaded", boot);
  document.body?.addEventListener("htmx:afterSettle", boot);
})();
