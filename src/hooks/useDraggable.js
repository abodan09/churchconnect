import { useState, useRef, useCallback, useEffect } from 'react';

// Drag-to-reposition for a fixed, bottom-right-anchored floating element.
// Tracks an { right, bottom } offset (px from the viewport's bottom-right corner —
// stable across window resizes), persists it, and clamps so the element stays fully
// on-screen. Distinguishes a click from a drag via a small movement threshold, so a
// plain tap still fires the element's onClick.
//
// `getSizeEl` returns the element whose SIZE governs clamping — which may differ
// from the drag handle (e.g. an expanded panel dragged by its short header). All
// clamping (drag, resize, reclamp) measures that element, so neither the button nor
// the panel can be pushed off-screen regardless of what you grab to move it.
export function useDraggable(storageKey, defaultOffset = { right: 20, bottom: 20 }, getSizeEl) {
  const read = () => {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (s && Number.isFinite(s.right) && Number.isFinite(s.bottom)) return s;
    } catch { /* ignore */ }
    return defaultOffset;
  };

  const [offset, setOffset] = useState(read);
  const offsetRef = useRef(offset);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Keep the latest size-getter without re-creating the clamp callback.
  const sizeElRef = useRef(getSizeEl);
  sizeElRef.current = getSizeEl;

  const drag = useRef(null);            // active gesture: { startX, startY, startRight, startBottom, moved, el }
  const suppressClick = useRef(false);  // true right after a drag so the trailing click is ignored
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((right, bottom) => {
    const el = sizeElRef.current?.();
    const w = el?.offsetWidth || 56;
    const h = el?.offsetHeight || 56;
    const maxRight = Math.max(0, window.innerWidth - w);
    const maxBottom = Math.max(0, window.innerHeight - h);
    return {
      right: Math.min(Math.max(0, right), maxRight),
      bottom: Math.min(Math.max(0, bottom), maxBottom),
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return; // below threshold -> still a click
    d.moved = true;
    if (!dragging) setDragging(true);
    // Right/bottom anchored: dragging right (dx>0) shrinks the right offset.
    setOffset(clamp(d.startRight - dx, d.startBottom - dy));
  }, [clamp, dragging]);

  const endDrag = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    try { if (e?.pointerId != null) d.el.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (d.moved) {
      suppressClick.current = true;
      try { localStorage.setItem(storageKey, JSON.stringify(offsetRef.current)); } catch { /* ignore */ }
      // Safety net: if no click follows (pointer released off-target), clear the flag.
      setTimeout(() => { suppressClick.current = false; }, 300);
    }
    drag.current = null;
    setDragging(false);
  }, [storageKey]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return; // primary button only
    const el = e.currentTarget;
    drag.current = { startX: e.clientX, startY: e.clientY, startRight: offsetRef.current.right, startBottom: offsetRef.current.bottom, moved: false, el };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  }, []);

  // Re-clamp on window resize so the element can't end up off-screen.
  useEffect(() => {
    const onResize = () => setOffset((o) => clamp(o.right, o.bottom));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const wasDrag = useCallback(() => {
    if (suppressClick.current) { suppressClick.current = false; return true; }
    return false;
  }, []);

  // Re-clamp against the current size element — call when what's rendered changes
  // size (e.g. the panel opens/closes) so the shared offset stays fully on-screen.
  const reclamp = useCallback(() => setOffset((o) => clamp(o.right, o.bottom)), [clamp]);

  return {
    style: { right: offset.right, bottom: offset.bottom },
    dragging,
    wasDrag,
    reclamp,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
}
