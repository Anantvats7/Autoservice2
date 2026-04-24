import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, UserCircle2, Loader2 } from "lucide-react";
import AutoServeLogo from "@/components/AutoServeLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from && from !== "/login" ? from : `/${role}/dashboard`, { replace: true });
    }
  }, [user, role, loading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) toast.error(error.includes("Invalid login") ? "Invalid email or password" : error);
        else toast.success("Welcome back!");
      } else {
        if (!fullName.trim()) { toast.error("Please enter your full name"); setBusy(false); return; }
        const { error } = await signUp(email, password, fullName);
        if (error) toast.error(error.includes("already") ? "An account with this email already exists" : error);
        else toast.success("Account created! Signing you in...");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center industrial-mesh p-4">
      <main className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-12 bg-card shadow-lg rounded-xl overflow-hidden min-h-[560px] lg:min-h-[640px]">
        <section className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none industrial-mesh" />
          <div className="relative z-10">
            <div className="mb-12">
              <AutoServeLogo subtitle="" size={40} className="[&_h2]:text-white [&_div:first-child]:bg-primary [&_div:first-child]:shadow-primary/25" />
              <span className="text-2xl font-extrabold tracking-tighter uppercase italic ml-[52px] -mt-4 block">AutoServe</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight mb-6">
              Engineering-Grade <br />
              <span className="text-primary">Service Management</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Precision tools for automotive professionals. Monitor fleet status, manage work orders, and optimise shop floor efficiency in real-time.
            </p>
          </div>
          <div className="relative z-10 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-mono">
            © 2026 AutoServe Precision Systems
          </div>
        </section>

        <section className="col-span-1 lg:col-span-7 flex flex-col p-6 sm:p-10 md:p-14 lg:p-16 justify-center bg-card">
          <div className="mb-8 lg:mb-10">
            <h2 className="text-2xl font-bold text-on-surface mb-2 tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {mode === "signin" ? "Sign in to access your AutoServe portal" : "Customers can sign up here. Staff accounts are issued by your manager."}
            </p>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-container rounded-xl border border-border/20">
              <button
                onClick={() => setMode("signin")}
                className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-[0.12em] transition-all ${
                  mode === "signin" ? "bg-card shadow-sm border border-border text-primary" : "text-muted-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-[0.12em] transition-all ${
                  mode === "signup" ? "bg-card shadow-sm border border-border text-primary" : "text-muted-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground px-1">Full Name</label>
                <div className="relative">
                  <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aarav Kapoor"
                    className="w-full bg-surface-container-low border border-border/30 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@autoserve.in"
                  className="w-full bg-surface-container-low border border-border/30 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container-low border border-border/30 rounded-xl py-3.5 pl-11 pr-11 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-muted-foreground"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group transition-all duration-200 active:scale-[0.98]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <span className="text-sm">{mode === "signin" ? "Sign In" : "Create Account"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/10 text-center">
            <Link to="/" className="text-muted-foreground text-xs hover:text-primary transition-colors">
              ← Back to homepage
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
