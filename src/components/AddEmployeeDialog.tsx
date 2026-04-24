// Manager-only dialog to create employee or manager accounts via the admin-create-employee edge function.
import { useState } from "react";
import { X, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const AddEmployeeDialog = ({ onClose, onCreated }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-employee", {
        body: { email, password, full_name: fullName, phone: phone || undefined, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${role === "manager" ? "Manager" : "Employee"} account created`);
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><UserPlus className="w-4 h-4 text-primary" /></div>
            <h3 className="text-lg font-bold text-on-surface">Add Staff Account</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">The new staff member can sign in immediately with the email and password you set below.</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Full Name">
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rohan Sharma"
              className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
          </Field>
          <Field label="Email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} placeholder="rohan.sharma@autoserve.in"
              className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 lowercase" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone (optional)">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 90000 00000"
                className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20">
                <option value="employee">Technician</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
          </div>
          <Field label="Temporary Password (min 6)">
            <input required type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="autoserve@123"
              className="w-full p-2.5 text-sm bg-surface-container-low border border-border/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
          </Field>
          <p className="text-[11px] text-muted-foreground">Share these credentials with the staff member privately. They can change the password after first login.</p>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border/30 rounded-lg text-sm font-bold hover:bg-surface-container">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">{label}</span>
    {children}
  </label>
);

export default AddEmployeeDialog;
