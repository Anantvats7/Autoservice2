import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings, AlertTriangle, Info, CheckCircle2, LogOut, User, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, initials } from "@/lib/format";
import { toast } from "sonner";
import { playTing, isSoundEnabled, setSoundEnabled } from "@/lib/notificationSound";

interface DbNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

const typeIcon = (type: string) => {
  switch (type) {
    case "warning": return AlertTriangle;
    case "success": return CheckCircle2;
    case "info":
    default: return Info;
  }
};

const TopBar = () => {
  const navigate = useNavigate();
  const { user, profile, role, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [soundOn, setSoundOnState] = useState<boolean>(() => isSoundEnabled());
  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  // Track the latest notification id we've already seen so we only chime on truly new ones
  const lastSeenIdRef = useRef<string | null>(null);
  const initialisedRef = useRef(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data as DbNotification[]) ?? [];
      setNotifications(rows);
      if (!initialisedRef.current) {
        lastSeenIdRef.current = rows[0]?.id ?? null;
        initialisedRef.current = true;
      }
    };
    load();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as DbNotification;
          if (initialisedRef.current && row.id !== lastSeenIdRef.current) {
            lastSeenIdRef.current = row.id;
            if (isSoundEnabled()) playTing();
            toast.message(row.title, { description: row.message });
          }
          load();
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOnState(next);
    if (next) playTing();
    toast.success(next ? "Notification sound on" : "Notification sound off");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const userRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 ml-auto">
        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="p-2 text-muted-foreground hover:bg-surface-container rounded-full transition-colors"
          aria-label={soundOn ? "Mute notification sound" : "Unmute notification sound"}
          title={soundOn ? "Notification sound on" : "Notification sound muted"}
        >
          {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); setShowProfile(false); }}
            className="p-2 text-muted-foreground hover:bg-surface-container rounded-full transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl shadow-xl border border-border/30 z-50 overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                <h4 className="text-sm font-bold text-on-surface">Notifications</h4>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
                ) : notifications.map((n) => {
                  const Icon = typeIcon(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors border-b border-border/10 last:border-b-0 ${!n.read ? "bg-primary/5" : ""}`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${!n.read ? "bg-primary/10" : "bg-surface-container"}`}>
                        <Icon className={`w-3.5 h-3.5 ${!n.read ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-on-surface">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); setShowProfile(false); }}
            className="p-2 text-muted-foreground hover:bg-surface-container rounded-full transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl shadow-xl border border-border/30 z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border/20">
                <h4 className="text-sm font-bold text-on-surface">Quick Settings</h4>
              </div>
              <div className="p-2">
                {[
                  { label: "Email Notifications", desc: "Receive booking updates", defaultOn: true },
                  { label: "SMS Alerts", desc: "Get urgent alerts via SMS", defaultOn: false },
                  { label: "Marketing Updates", desc: "Latest offers & news", defaultOn: false },
                ].map((s) => <SettingToggle key={s.label} {...s} />)}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative ml-2" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); setShowSettings(false); }}
            className="flex items-center gap-2 hover:bg-surface-container-low rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-on-surface leading-tight">{userName}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">{userRole}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/10 border border-border overflow-hidden flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{initials(userName)}</span>
            </div>
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-xl border border-border/30 z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border/20">
                <p className="text-sm font-bold text-on-surface">{userName}</p>
                <p className="text-[11px] text-muted-foreground">{user?.email}</p>
              </div>
              <div className="p-2">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container-low text-left text-sm text-on-surface">
                  <User className="w-4 h-4 text-muted-foreground" /> My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 text-left text-sm text-destructive"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingToggle = ({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-container-low transition-colors text-left">
      <div>
        <p className="text-xs font-semibold text-on-surface">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <div className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${on ? "bg-primary" : "bg-surface-container-high"}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </button>
  );
};

export default TopBar;
