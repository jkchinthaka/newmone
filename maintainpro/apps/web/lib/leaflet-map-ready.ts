/**
 * Leaflet map helpers — guard fitBounds / invalidateSize until the container has a
 * real size. Calling fitBounds on a 0×0 map throws "_leaflet_pos" / invalid size noise
 * that is a lifecycle race, not a data defect.
 */

export type LeafletSizeLike = {
  x: number;
  y: number;
};

export type LeafletMapLike = {
  getSize?: () => LeafletSizeLike;
  getContainer?: () => { clientWidth: number; clientHeight: number } | null;
  invalidateSize?: (animate?: boolean) => void;
  // Leaflet's fitBounds is contravariant on bounds; keep this loose for adapter use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitBounds: (bounds: any, options?: any) => unknown;
};

export function hasUsableMapContainerSize(map: LeafletMapLike | null | undefined): boolean {
  if (!map) {
    return false;
  }

  if (typeof map.getSize === "function") {
    const size = map.getSize();
    if (size && Number.isFinite(size.x) && Number.isFinite(size.y) && size.x > 0 && size.y > 0) {
      return true;
    }
  }

  if (typeof map.getContainer === "function") {
    const el = map.getContainer();
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Invalidate + fitBounds only when the container has dimensions.
 * Returns false when skipped for zero-size (caller may retry later).
 * Genuine Leaflet errors from fitBounds are rethrown — not swallowed.
 */
export function fitBoundsWhenReady(
  map: LeafletMapLike | null | undefined,
  bounds: unknown,
  options?: unknown
): boolean {
  if (!hasUsableMapContainerSize(map) || !map) {
    return false;
  }

  if (typeof map.invalidateSize === "function") {
    map.invalidateSize(false);
  }

  map.fitBounds(bounds, options);
  return true;
}
