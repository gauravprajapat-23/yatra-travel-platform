"use client";

import { useEffect, useRef } from "react";

export function AdminFormDirtyGuard() {
  const markerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    const form = marker?.closest("form");
    if (!form) return;

    let dirty = false;
    let submitted = false;

    const markDirty = () => {
      if (!submitted) dirty = true;
    };

    const markSubmitted = () => {
      submitted = true;
      dirty = false;
    };

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || submitted) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const documentClick = (event: MouseEvent) => {
      if (!dirty || submitted || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const current =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      const next =
        destination.pathname +
        destination.search +
        destination.hash;

      if (current === next) return;

      const shouldLeave = window.confirm(
        "You have unsaved changes. Leave this page without saving?",
      );

      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        dirty = false;
      }
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", markSubmitted);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", documentClick, true);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", markSubmitted);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", documentClick, true);
    };
  }, []);

  return (
    <span
      ref={markerRef}
      hidden
      aria-hidden="true"
      data-admin-dirty-guard=""
    />
  );
}
