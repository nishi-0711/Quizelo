import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./Button";

const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: "🏠" },
  { to: "/generate", label: "Generate Quiz", icon: "🧠" },
  { to: "/create-quiz", label: "Create Quiz", icon: "✍️" },
  { to: "/study-notes", label: "Study Notes", icon: "📖" },
  { to: "/flashcards", label: "Flashcards", icon: "🃏" },
  { to: "/history", label: "History", icon: "🕒" },
  { to: "/history?tab=notes", label: "Generated Notes", icon: "📚" },
];

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (to) => {
    const path = to.split("?")[0];
    return window.location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-950/85 transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3 flex-shrink-0" onClick={() => setMenuOpen(false)}>
          <div className="h-9 w-9 rounded-xl bg-indigo-600 shadow-sm flex items-center justify-center text-white font-black">Q</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quizelo</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Study smarter</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto min-w-0">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                isActive(link.to)
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 dark:text-slate-400"
            onClick={toggleTheme}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </Button>

          <div className="hidden sm:flex items-center gap-3 border-l border-slate-200 dark:border-slate-700 pl-3">
            {user ? (
              <>
                <div className="hidden flex-col items-end md:flex">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{user.username}</div>
                  <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">🔥 {user.streak || 0} Day Streak</div>
                </div>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg shadow-inner hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => navigate("/profile")}
                  title="Profile Page"
                >
                  👤
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[10px] font-bold uppercase tracking-widest hidden md:inline-flex"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/login")}>Login</Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 animate-in fade-in duration-150">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive(link.to)
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="mr-2">{link.icon}</span>{link.label}
              </Link>
            ))}
            <Link
              to="/profile"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <span className="mr-2">👤</span>Profile / Settings
            </Link>
            {user && (
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="px-3 py-2.5 rounded-xl text-left text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}