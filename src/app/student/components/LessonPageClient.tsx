"use client";

import { useEffect, useState } from "react";

type LessonPageClientProps = {
  levelNumber: number;
  copy: { [key: string]: string };
  baseFontSizeClass: string;
  brightnessMultiplier: number;
  darkMode: boolean;
  children: React.ReactNode;
};

export function LessonPageClient({
  levelNumber,
  copy,
  baseFontSizeClass,
  brightnessMultiplier,
  darkMode,
  children,
}: LessonPageClientProps) {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const mobileViewport = window.innerWidth < 768;
      const mobilePortrait = mobileViewport && window.innerHeight > window.innerWidth;
      setIsMobilePortrait(mobilePortrait);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    window.addEventListener("orientationchange", checkViewport);

    return () => {
      window.removeEventListener("resize", checkViewport);
      window.removeEventListener("orientationchange", checkViewport);
    };
  }, []);

  if (isMobilePortrait) {
    return (
      <main
        className={`min-h-screen px-4 py-6 text-white flex items-center justify-center ${baseFontSizeClass}`}
        style={{
          backgroundColor: darkMode ? "#020617" : "#0f172a",
          filter: `brightness(${brightnessMultiplier})`,
        }}
      >
        <div className="text-center">
          <p className="text-sm font-bold text-cyan-300 mb-2">Level {levelNumber} Lesson</p>
          <p className="text-white/80 text-sm mb-6">Please rotate your device to landscape mode</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen px-6 py-10 text-white ${baseFontSizeClass}`}
      style={{
        backgroundColor: darkMode ? "#020617" : "#0f172a",
        filter: `brightness(${brightnessMultiplier})`,
      }}
    >
      {children}
    </main>
  );
}
