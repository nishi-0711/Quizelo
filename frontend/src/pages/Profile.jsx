import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </div>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.getProfile();
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleDeleteHistory = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      await api.deleteHistory(sessionId);
      setData(prev => ({
        ...prev,
        history: prev.history.filter(h => h.sessionId !== sessionId && h._id !== sessionId)
      }));
    } catch (err) {
      alert("Failed to delete session: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-70px)] items-center justify-center">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p className="text-rose-500">{error || "Something went wrong"}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { stats, history } = data;

  const ALL_BADGES = [
    { id: "starter", name: "Starter", description: "Earn 100 XP" },
    { id: "grinder", name: "Grinder", description: "Earn 500 XP" },
    { id: "scholar", name: "Scholar", description: "Earn 1500 XP" },
    { id: "ace", name: "Ace", description: "Score 90%+ on a quiz" }
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-3xl shadow-xl shadow-indigo-100 dark:shadow-none text-white font-black">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {user?.username}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user?.email} • Member since {new Date(user?.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/">
            <Button variant="secondary">Back to Home</Button>
          </Link>
          <Button onClick={handleLogout} variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
            Logout
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Day Streak" value={user?.streak || 0} icon="🔥" />
        <Stat label="Total Quizzes" value={stats.totalQuizzesTaken} icon="📝" />
        <Stat label="Highest Score" value={`${stats.highestScore}%`} icon="🏆" />
        <Stat label="Experience" value={stats.xp} icon="✨" />
      </div>

      {/* Badges Section */}
      <div className="mt-12">
        <h2 className="mb-6 text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>🏅</span> Achievements
        </h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {ALL_BADGES.map(badge => {
            const isEarned = stats.badges?.some(b => b.id === badge.id);
            return (
              <div key={badge.id} className={`p-4 rounded-2xl border text-center animate-in fade-in slide-in-from-bottom-2 duration-500 transition-all ${
                isEarned 
                  ? "bg-indigo-50 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30" 
                  : "bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800 opacity-60 grayscale"
              }`}>
                <div className="text-2xl mb-1">{isEarned ? "⭐" : "🔒"}</div>
                <div className={`text-xs font-bold ${isEarned ? "text-indigo-700 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {badge.name}
                </div>
                <div className={`text-[10px] mt-1 ${isEarned ? "text-indigo-600/70 dark:text-indigo-400/50" : "text-slate-400 dark:text-slate-500"}`}>
                  {badge.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="mt-12 p-6 sm:p-8 border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="mb-8 text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>🕒</span> Recent History
        </h2>
        
        <div className="space-y-4">
          {history.length > 0 ? history.map((item) => (
            <div
              key={item._id || item.sessionId}
              className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all group"
            >
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Quiz Session
                </div>
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                  {new Date(item.finishedAt).toLocaleDateString()} • {item.answeredCount} Questions
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-sm font-black ${item.scorePercent >= 80 ? 'text-emerald-600' : item.scorePercent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {item.scorePercent}%
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    +{item.xpEarned} XP
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteHistory(item.sessionId || item._id)}
                  className="p-2 rounded-xl text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 transition-all"
                  title="Delete Session"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          )) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 font-medium">No history found yet.</p>
              <Link to="/" className="text-indigo-600 font-bold text-xs mt-2 block hover:underline">Take your first quiz →</Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
