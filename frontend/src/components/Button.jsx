export function Button({ className = "", variant = "primary", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary:
      "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 focus:ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800 dark:focus:ring-slate-600",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-600",
  };
  return <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props} />;
}

