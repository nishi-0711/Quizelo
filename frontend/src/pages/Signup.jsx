import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(email, password, username);
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-70px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8 border-slate-200 shadow-xl dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in zoom-in duration-500">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
            ✨
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Create Account</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Join Quizelo and start mastering your PDFs
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Username
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              placeholder="johndoe"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" size="lg" className="w-full py-4 shadow-lg shadow-indigo-100 dark:shadow-none" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-slate-500 dark:text-slate-400">Already have an account? </span>
          <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
            Log In
          </Link>
        </div>
      </Card>
    </div>
  );
}
