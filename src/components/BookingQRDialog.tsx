// Customer-facing QR for a booking. Dropoff and pickup codes from the bookings table.
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Car, MapPin, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  bookingId: string;
  type: "dropoff" | "pickup";
  onClose: () => void;
}

interface Booking {
  id: string;
  dropoff_code: string | null;
  pickup_code: string | null;
  status: string;
  scheduled_at: string;
}

const BookingQRDialog = ({ bookingId, type, onClose }: Props) => {
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    supabase
      .from("bookings")
      .select("id, dropoff_code, pickup_code, status, scheduled_at")
      .eq("id", bookingId)
      .maybeSingle()
      .then(({ data }) => setBooking(data as Booking | null));
  }, [bookingId]);

  const code = type === "dropoff" ? booking?.dropoff_code : booking?.pickup_code;
  const title = type === "dropoff" ? "Drop-off Pass" : "Vehicle Pick-up Pass";
  const desc =
    type === "dropoff"
      ? "Show this QR at the AutoServe garage. Our technician will scan it to check your vehicle in."
      : "Your vehicle is ready! Show this QR at the counter. The technician will scan it to release your vehicle.";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-container">
          <X className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${type === "dropoff" ? "bg-primary/10 text-primary" : "bg-emerald-50 text-emerald-600"}`}>
            {type === "dropoff" ? <Car className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {title}
          </div>
          <h3 className="text-lg font-bold text-on-surface">Booking #{bookingId.slice(0, 6).toUpperCase()}</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-5">{desc}</p>

          {code ? (
            <div className="bg-white p-5 rounded-xl border-2 border-border/30 inline-block">
              <QRCodeSVG value={code} size={208} level="M" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-12">Generating code…</div>
          )}

          {code && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                {code}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code);
                }}
                className="text-[10px] font-bold text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                title="Copy code"
              >
                Copy
              </button>
            </div>
          )}

          <div className="mt-5 p-3 bg-surface-container-low rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            AutoServe Gurugram • Sector 14, MG Road
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingQRDialog;
