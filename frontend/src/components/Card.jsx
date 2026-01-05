export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/90 dark:ring-slate-700 ${className}`}
      {...props}
    />
  );
}

