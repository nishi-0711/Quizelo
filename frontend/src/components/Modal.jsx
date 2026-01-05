import { Button } from "./Button";

export function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="text-sm text-slate-700 dark:text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          {actions || (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

