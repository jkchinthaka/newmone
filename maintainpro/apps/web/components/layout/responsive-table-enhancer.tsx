"use client";

import { useEffect } from "react";

/**
 * Gives every table cell a data-label (its column header) so that on phones the CSS in
 * globals.css can show each row as a card ("Label  Value" lines) instead of a sideways-scrolling
 * grid. A table opts out with `data-no-cards`. Purely additive: it only sets data attributes,
 * so React rendering is unaffected and desktop layout is unchanged.
 */
function headerLabels(table: HTMLTableElement): string[] {
  const row = table.tHead?.rows[table.tHead.rows.length - 1] ?? table.querySelector("tr");
  const labels: string[] = [];
  if (!row) return labels;
  for (const cell of Array.from(row.cells)) {
    const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
    const span = Math.max(1, cell.colSpan || 1);
    for (let i = 0; i < span; i += 1) labels.push(text);
  }
  return labels;
}

function enhance(root: ParentNode) {
  const tables = root.querySelectorAll<HTMLTableElement>("table:not([data-no-cards])");
  tables.forEach((table) => {
    const labels = headerLabels(table);
    if (labels.length === 0) return;
    table.setAttribute("data-cards", "");
    const bodies = Array.from(table.tBodies);
    bodies.forEach((body) => {
      Array.from(body.rows).forEach((row) => {
        if (row.hasAttribute("data-labeled")) return;
        let col = 0;
        Array.from(row.cells).forEach((cell) => {
          const label = labels[col];
          if (label && !cell.hasAttribute("data-label")) cell.setAttribute("data-label", label);
          col += Math.max(1, cell.colSpan || 1);
        });
        row.setAttribute("data-labeled", "");
      });
    });
  });
}

export function ResponsiveTableEnhancer() {
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhance(main);
      });
    };
    enhance(main);
    const observer = new MutationObserver(schedule);
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
