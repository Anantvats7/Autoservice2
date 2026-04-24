import { forwardRef } from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtitle?: string;
}

const AutoServeLogo = forwardRef<HTMLDivElement, LogoProps>(
  ({ className = "", size = 40, showText = true, subtitle }, ref) => {
    return (
      <div ref={ref} className={`flex items-center gap-3 ${className}`}>
        <div
          className="bg-gradient-to-br from-slate-900 to-slate-600 rounded-lg flex items-center justify-center shadow-lg"
          style={{ width: size, height: size }}
        >
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        {showText && (
          <div>
            <h2 className="text-on-surface font-extrabold text-sm tracking-tight uppercase">
              AutoServe
            </h2>
            {subtitle && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

AutoServeLogo.displayName = "AutoServeLogo";

export default AutoServeLogo;
