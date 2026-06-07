"use client";

import { useResponsiveScale } from "@/lib/useResponsiveScale";

type ActivityPageClientProps = {
  levelNumber: number;
  copy: { [key: string]: string };
  baseFontSizeClass: string;
  brightnessMultiplier: number;
  darkMode: boolean;
  children: React.ReactNode;
};

export function ActivityPageClient({
  baseFontSizeClass,
  brightnessMultiplier,
  darkMode,
  children,
}: ActivityPageClientProps) {
  const { scale, isMobileViewport } = useResponsiveScale();

  return (
    <main
      className={`min-h-screen px-6 py-10 text-white ${baseFontSizeClass}`}
      style={{
        backgroundColor: darkMode ? "#020617" : "#0f172a",
        filter: `brightness(${brightnessMultiplier})`,
      }}
    >
      {isMobileViewport ? (
        <div className="mb-4 rounded-full bg-black/70 px-3 py-1 text-[10px] text-white/80 w-fit mx-auto">
          Rotate to landscape for best experience
        </div>
      ) : null}

      <div
        style={isMobileViewport ? {
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        } : undefined}
      >
        {children}
      </div>
    </main>
  );
}
