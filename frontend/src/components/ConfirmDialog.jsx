import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-confirm-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-500/10 text-red-500" : "bg-purple-500/10 text-purple-500"}`}>
            {danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="gate-confirm-title" className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-500 dark:text-zinc-400">{message}</p>
              </div>
              <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-900 dark:hover:text-white">
                <X size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end dark:border-zinc-900 dark:bg-zinc-900/40">
          <button type="button" onClick={onCancel} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
            {cancelText}
          </button>
          <button type="button" autoFocus onClick={onConfirm} className={`min-h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] ${danger ? "bg-red-600 hover:bg-red-500" : "bg-purple-600 hover:bg-purple-500"}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
