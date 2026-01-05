import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./Button";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-950/85 transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 shadow-sm flex items-center justify-center text-white font-black">Q</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quizelo</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">PDF to Quiz</div>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 dark:text-slate-400"
            onClick={toggleTheme}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </Button>
          
          <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-700 pl-4">
            {user ? (
              <>
                <div className="hidden flex-col items-end sm:flex">
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
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[10px] font-bold uppercase tracking-widest"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/login")}>Login</Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
