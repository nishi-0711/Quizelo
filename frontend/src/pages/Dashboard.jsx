import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const TOOLS = [
  {
    to: "/generate",
    icon: "🧠",
    title: "Generate Quiz",
    desc: "Upload PDFs and let AI build a grounded quiz with citations.",
    color: "from-indigo-600 to-violet-600",
  },
  {
    to: "/create-quiz",
    icon: "✍️",
    title: "Create Quiz",
    desc: "Build a quiz by hand — questions, marks, difficulty, reorder.",
    color: "from-emerald-600 to-teal-600",
  },
  {
    to: "/study-notes",
    icon: "📖",
    title: "Study Notes",
    desc: "Turn PDFs into structured chapter-wise study notes.",
    color: "from-violet-600 to-purple-600",
  },
  {
    to: "/flashcards",
    icon: "🃏",
    title: "Flashcards",
    desc: "Generate flip-card study sets from your documents.",
    color: "from-amber-500 to-orange-600",
  },
  {
    to: "/history",
    icon: "🕒",
    title: "History",
    desc: "Review and manage your past quizzes.",
    color: "from-sky-600 to-blue-600",
  },
  {
    to: "/history?tab=notes",
    icon: "📚",
    title: "Generated Notes",
    desc: "Browse, search, export, or delete saved notes.",
    color: "from-rose-500 to-pink-600",
  },
];

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getProfile();
        if (!cancelled) setStats(res.stats);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-4xl shadow-xl shadow-indigo-200 dark:shadow-none text-white font-black">
          {user?.username?.charAt(0).toUpperCase() || "Q"}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back, {user?.username || "studier"} 👋
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Turn any PDF into quizzes, study notes, and flashcards — or build your own from scratch.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <Stat label="Day Streak" value={stats.streak || 0} icon="🔥" />
          <Stat label="Total Quizzes" value={stats.totalQuizzesTaken || 0} icon="📝" />
          <Stat label="Highest Score" value={`${stats.highestScore || 0}%`} icon="🏆" />
          <Stat label="Experience" value={stats.xp || 0} icon="✨" />
        </div>
      )}

      {/* Tool grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link key={tool.to} to={tool.to} className="group">
            <Card className="p-6 h-full border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.color} text-2xl shadow-lg`}>
                {tool.icon}
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{tool.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{tool.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">
                Open <span>→</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}