import { Link } from "react-router-dom";
import { ArrowRight, Zap, Calendar, History, Shield, CheckCircle, Cpu, Lock, Cloud, Award } from "lucide-react";
import AutoServeLogo from "@/components/AutoServeLogo";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <AutoServeLogo size={32} subtitle="" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-primary">Features</a>
            <a href="#roles" className="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors">Pricing</a>
            <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors">About Us</a>
          </div>
          <Link to="/login" className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
            Book Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                Next-Gen Fleet Management
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 leading-[1.1]">
                Your Automobile Operations,{" "}
                <span className="text-primary">Reimagined.</span>
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mb-8">
                Experience the power of AI-driven service management. Automate scheduling, predict faults before they happen, and provide a world-class customer experience.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/login" className="bg-primary text-primary-foreground px-6 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group">
                  Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#features" className="bg-card border border-border px-6 py-3 rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors text-center">
                  Learn More
                </a>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border/50">
                <img
                  src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=500&fit=crop"
                  alt="Premium automotive service"
                  className="w-full h-64 object-cover"
                />
                <div className="bg-card p-4 border-t border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Cpu className="w-4 h-4 text-primary" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">System Status</p>
                      <p className="text-sm font-semibold text-on-surface">AI Diagnostics Active • 98% Accuracy</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Precision Engineering for Every Workflow</h2>
            <div className="w-12 h-1 bg-primary rounded-full mx-auto" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: Cpu, title: "AI Fault Diagnosis", desc: "Identify complex mechanical issues instantly using neural patterns trained on millions of engine cycles." },
              { icon: Calendar, title: "Smart Scheduling", desc: "Dynamic resource allocation ensures zero double-bookings with 100% digital flow management." },
              { icon: History, title: "Full Service History", desc: "Immutable records for every vehicle in your care. Access technical logs, parts replaced, and notes from any device." },
            ].map((f) => (
              <div key={f.title} className="bg-card p-6 lg:p-8 rounded-xl border border-border/30 hover:shadow-lg transition-shadow">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-on-surface mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">A Unified Platform for Everyone</h2>
          <p className="text-muted-foreground mb-12 max-w-lg">AutoServe bridges the gap between management, technical execution, and customer satisfaction.</p>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 lg:p-8 rounded-xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop" alt="" className="absolute right-0 top-0 w-1/2 h-full object-cover opacity-20" />
              <div className="relative z-10">
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold bg-primary/20 text-primary px-2 py-1 rounded">Manager Role</span>
                <h3 className="text-xl font-bold mt-4 mb-2">Command Center Control</h3>
                <p className="text-slate-400 text-sm mb-6">Monitor real-time revenue tracking, KPI dashboards, and live inventory levels across multiple locations.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Live Revenue</p>
                    <p className="text-lg font-black font-mono">$142,850.00</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Efficiency</p>
                    <p className="text-lg font-black font-mono">94.2%</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-primary text-primary-foreground p-6 lg:p-8 rounded-xl">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold bg-white/20 px-2 py-1 rounded">Technician Role</span>
              <h3 className="text-xl font-bold mt-4 mb-2">Technical Precision</h3>
              <p className="text-primary-foreground/70 text-sm mb-6">Priority-sorted queues and AI service briefs ensure you spend more time fixing and less time diagnosing.</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4" /> Brake System Logic Scan Complete</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4" /> Transmission Fluid Analysis...</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-card p-6 lg:p-8 rounded-xl border border-border/30">
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold bg-surface-container px-2 py-1 rounded text-muted-foreground">Customer Experience</span>
            <div className="flex flex-col md:flex-row md:items-center justify-between mt-4 gap-4">
              <div>
                <h3 className="text-xl font-bold mb-1">Transparency in Every Bolt</h3>
                <p className="text-sm text-muted-foreground max-w-md">Easy self-booking through our mobile-first interface. Get personalized maintenance tips and access your entire vehicle history.</p>
                <Link to="/customer/dashboard" className="text-sm text-primary font-bold mt-2 inline-flex items-center gap-1 hover:underline">Explore Customer Portal <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-1"><Cpu className="w-5 h-5 text-primary" /></div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loyalty Points</p>
                  <p className="text-2xl font-black text-on-surface font-mono">2,450</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-1"><Calendar className="w-5 h-5 text-primary" /></div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Service</p>
                  <p className="text-2xl font-black text-on-surface font-mono">Oct 12</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="py-16 md:py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="max-w-lg">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-primary">Trust & Safety</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Enterprise-Grade Integrity</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We treat your business data like our own. With AES-256 encryption and full PDPA compliance, your operations and customer details are secured by the world's most robust security frameworks.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              {[
                { icon: Lock, label: "AES-256", desc: "Full Encryption" },
                { icon: Shield, label: "PDPA", desc: "Compliant Logic" },
                { icon: Cloud, label: "99.9%", desc: "Uptime SLA" },
                { icon: Award, label: "SOC 2", desc: "Certified Provider" },
              ].map((b) => (
                <div key={b.label} className="bg-card p-4 rounded-xl border border-border/30 text-center min-w-[120px]">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <b.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-lg font-black text-on-surface">{b.label}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <AutoServeLogo size={28} subtitle="" />
              <p className="text-xs text-muted-foreground mt-3 max-w-xs">Empowering automotive professionals with the world's most advanced management platform.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface mb-3">Platform</h4>
              <div className="space-y-2">
                <a className="text-xs text-muted-foreground hover:text-on-surface block cursor-pointer">Privacy Policy</a>
                <a className="text-xs text-muted-foreground hover:text-on-surface block cursor-pointer">Terms of Service</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface mb-3">Support</h4>
              <div className="space-y-2">
                <a className="text-xs text-muted-foreground hover:text-on-surface block cursor-pointer">Contact</a>
                <a className="text-xs text-muted-foreground hover:text-on-surface block cursor-pointer">Support</a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/30 text-center">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">© 2026 AutoServe Precision Systems. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
