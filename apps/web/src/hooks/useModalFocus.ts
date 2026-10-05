import { useEffect, useRef } from "react";

/** Keep keyboard navigation inside an open host dialog and restore its trigger. */
export function useModalFocus(open: boolean, close: () => void) {
  const dialog = useRef<HTMLElement | null>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () =>
      [
        ...element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length > 0);
    (controls()[0] || element).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose.current();
      } else if (event.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          element.focus();
          return;
        }
        if (
          !element.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last! : first).focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return dialog;
}
