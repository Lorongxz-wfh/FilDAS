import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type LoginPageProps = {
  onLoginSuccess: (token: string, user: any) => void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/login", { email, password });
      const { token, user } = res.data;

      onLoginSuccess(token, user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Invalid credentials or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex justify-center items-center px-4"
      style={{
        background:
          "radial-gradient(circle at top, #1a215a 50%, #0e1134 80%, #050614 125%)",
      }}
    >
      {/* Card */}
      <div className="relative flex w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#d0d6e2]">
        {/* Left: brand / text */}
        <div className="hidden md:flex md:w-1/2 flex-col justify-center px-10 pb-12 bg-white">
          {/* LOGO AREA */}
          <div className="mb-1 flex justify-center">
            {/* Replace src with your actual logo path */}
            <img
              src="/assets/FCU Logo.png"
              alt="Filamer Christian University logo"
              className="h-60 w-auto"
            />
          </div>

          <h2
            className="text-3xl font-bold tracking-wide mb-3"
            style={{ color: "#0e1134" }}
          >
            Filamer Christian University
          </h2>
          <p className="text-sm leading-relaxed text-[#0e1134] opacity-80 max-w-md">
            FilDAS – Filamer Digital Archiving System helps departments store,
            organize, and access documents securely in one place.
          </p>
        </div>

        {/* Right: login form */}
        <div className="w-full md:w-1/2 px-8 py-10 bg-white">
          <div className="mb-6 text-center md:text-left">
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ color: "#0e1134" }}
            >
              Sign in to FilDAS
            </h1>
            <p className="mt-1 text-sm text-[#0e1134] opacity-70">
              Use your FCU account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
                {error}
              </p>
            )}

            <div className="space-y-1 text-sm">
              <label className="block font-medium text-[#0e1134]">
                Email address
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-[#e7eaef] bg-[#f5f7fb] px-3 py-2 text-sm text-[#0e1134] focus:outline-none focus:ring-2 focus:ring-[#0e1134]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.edu"
              />
            </div>

            <div className="space-y-1 text-sm">
              <label className="block font-medium text-[#0e1134]">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-[#e7eaef] bg-[#f5f7fb] px-3 py-2 text-sm text-[#0e1134] focus:outline-none focus:ring-2 focus:ring-[#0e1134]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full py-2 text-sm font-semibold tracking-wide disabled:opacity-60 transition-colors"
              style={{
                backgroundColor: "#0e1134",
                color: "#ffffff",
              }}
            >
              {loading ? "Signing in…" : "Login"}
            </button>

            <div className="mt-3 text-center md:text-left">
              <button
                type="button"
                className="text-xs text-[#0e1134] opacity-70 hover:opacity-100"
              >
                Forgot password
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-[11px] text-[#0e1134] opacity-60">
            © {new Date().getFullYear()} Filamer Christian University, Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
