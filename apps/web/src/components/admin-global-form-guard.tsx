"use client";

import { useEffect } from "react";

function isMutationForm(form: HTMLFormElement): boolean {
  if (form.querySelector("[data-admin-dirty-guard]")) return false;
  return form.method.toLowerCase() !== "get";
}

export function AdminGlobalFormGuard() {
  useEffect(() => {
    const dirtyForms = new Set<HTMLFormElement>();

    function cleanDetachedForms() {
      for (const form of dirtyForms) {
        if (!form.isConnected) dirtyForms.delete(form);
      }
    }

    function hasDirtyForms(): boolean {
      cleanDetachedForms();
      return dirtyForms.size > 0;
    }

    function clearAll() {
      for (const form of dirtyForms) {
        form.dataset.adminDirty = "false";
      }
      dirtyForms.clear();
    }

    function findMutationForm(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      const form = target.closest("form");
      if (!(form instanceof HTMLFormElement)) return null;
      return isMutationForm(form) ? form : null;
    }

    function markDirty(event: Event) {
      const form = findMutationForm(event.target);
      if (!form) return;

      form.dataset.adminDirty = "true";
      dirtyForms.add(form);
    }

    function markSubmitting(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !isMutationForm(form)) {
        return;
      }

      form.dataset.adminDirty = "false";
      dirtyForms.delete(form);
    }

    function beforeUnload(event: BeforeUnloadEvent) {
      if (!hasDirtyForms()) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function documentClick(event: MouseEvent) {
      if (!hasDirtyForms() || event.defaultPrevented) return;

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
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
        return;
      }

      clearAll();
    }

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markSubmitting, true);
    document.addEventListener("click", documentClick, true);
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markSubmitting, true);
      document.removeEventListener("click", documentClick, true);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  return null;
}
