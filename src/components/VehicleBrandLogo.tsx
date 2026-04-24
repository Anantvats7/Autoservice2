// Renders a brand logo for an Indian car make. Falls back to a Lucide Car icon if not found / image fails.
import { useState } from "react";
import { Car } from "lucide-react";
import { brandLogoUrl } from "@/lib/brandLogos";

interface Props {
  make: string | null | undefined;
  className?: string;
  size?: number;
}

const VehicleBrandLogo = ({ make, className = "", size = 28 }: Props) => {
  const url = brandLogoUrl(make);
  const [errored, setErrored] = useState(false);
  if (!url || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-primary/10 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <Car className="text-primary" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-white rounded-lg p-1 border border-border/30 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={`${make} logo`}
        onError={() => setErrored(true)}
        className="max-w-full max-h-full object-contain"
        loading="lazy"
      />
    </div>
  );
};

export default VehicleBrandLogo;
