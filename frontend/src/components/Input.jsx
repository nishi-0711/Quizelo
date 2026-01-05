export function Input({ label, error, className = "", ...props }) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-slate-700">{label}</div> : null}
      <input
        className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900 ${className}`}
        {...props}
      />
      {error ? <div className="mt-1 text-sm text-rose-600">{error}</div> : null}
    </label>
  );
}

