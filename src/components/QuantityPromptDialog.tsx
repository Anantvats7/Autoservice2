/**
 * Tiny modal that asks the operator for an integer quantity.
 * Shared between manager-restock and employee-consume flows.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  confirmLabel?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  busy?: boolean;
  tone?: "primary" | "destructive";
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}

const QuantityPromptDialog = ({
  open,
  title,
  description,
  label,
  confirmLabel = "Confirm",
  defaultValue = 1,
  min = 1,
  max,
  busy = false,
  tone = "primary",
  onConfirm,
  onCancel,
}: Props) => {
  const [val, setVal] = useState<string>(String(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVal(String(defaultValue));
      // Defer focus until after the dialog is on screen
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < min) return;
    if (max !== undefined && n > max) return;
    onConfirm(n);
  };

  const confirmClasses =
    tone === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qty-dialog-title"
    >
      <form
        onSubmit={submit}
        className="bg-card w-full max-w-sm rounded-xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="qty-dialog-title" className="font-bold text-on-surface">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onCancel} className="p-1 hover:bg-surface-container rounded -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1.5">{label}</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full p-3 text-base bg-surface-container-low border border-border/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            required
          />
          {max !== undefined && (
            <span className="text-[10px] text-muted-foreground mt-1 inline-block">Maximum: {max}</span>
          )}
        </label>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-bold border border-border/30 rounded-lg hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors ${confirmClasses}`}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuantityPromptDialog;
