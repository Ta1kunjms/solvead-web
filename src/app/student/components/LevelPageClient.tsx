"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LevelEntryCards } from "./ActivityPlayer";

type ActivitySummary = {
  id: string;
  title: string | null;
  instructions: string | null;
  html_url: string | null;
  activity_type: string | null;
};

type Copy = {
  levelLesson: string;
  levelActivities: string;
  levelLessonCardTitle: string;
  levelActivityCardEmptyTitle: string;
  activityModalClose: string;
  activityModalNoHtml: string;
  activityModalOpenList: string;
  activityModalOpenNewTab: string;
  backToMap?: string;
};

type LevelPageClientProps = {
  levelNumber: number;
  levelTitle: string;
  lessonCount: number;
  lessonResourceUrl: string | null;
  activityList: ActivitySummary[];
  copy: Copy;
  backgroundStyle: React.CSSProperties;
  baseFontSizeClass: string;
  announcement?: string | null;
};

export function LevelPageClient({
  levelNumber,
  levelTitle,
  lessonCount,
  lessonResourceUrl,
  activityList,
  copy,
  backgroundStyle,
  baseFontSizeClass,
  announcement,
}: LevelPageClientProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const mobileViewport = window.innerWidth < 768;
      const mobilePortrait = mobileViewport && window.innerHeight > window.innerWidth;
      setIsMobileViewport(mobileViewport);
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
      <main className={`relative min-h-screen overflow-hidden text-white ${baseFontSizeClass}`}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={backgroundStyle} />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45"
          aria-hidden="true"
        />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-6">
          <div className="text-center">
            <p className="text-sm font-bold text-white drop-shadow mb-2">Level {levelNumber}</p>
            <h1 className="text-2xl font-extrabold text-white drop-shadow mb-4">{levelTitle}</h1>
            <p className="text-white/80 text-sm mb-6">Please rotate your device to landscape mode</p>
            <Link
              href="/"
              className="control-button inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-950"
            >
              {copy.backToMap || "Back to Map"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`relative min-h-screen overflow-hidden text-white ${baseFontSizeClass}`}>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={backgroundStyle} />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45"
        aria-hidden="true"
      />
      <div className={`relative z-10 flex min-h-screen flex-col items-center ${isMobileViewport ? "px-2 py-3" : "px-4 py-6"} md:px-10`}>
        <div className={`flex w-full ${isMobileViewport ? "max-w-full" : "max-w-6xl"} flex-col gap-2 md:flex-row md:items-start md:justify-between ${isMobileViewport ? "mb-2" : "mb-4"}`}>
          <div>
            <p className={`uppercase tracking-[0.4em] text-white/80 ${isMobileViewport ? "text-[10px]" : "text-xs"}`}>
              Level {levelNumber}
            </p>
            <h1 className={`mt-1 font-extrabold text-white drop-shadow ${isMobileViewport ? "text-xl" : "text-3xl md:text-4xl"}`}>
              {levelTitle}
            </h1>
          </div>
          <Link
            href="/"
            className={`control-button inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-[0.2em] text-amber-950 ${isMobileViewport ? "px-2 py-1 text-[10px]" : "px-4 py-2 text-xs md:text-sm"}`}
          >
            {copy.backToMap || "Back to Map"}
          </Link>
        </div>

        <LevelEntryCards
          levelNumber={levelNumber}
          lessonCount={lessonCount}
          lessonResourceUrl={lessonResourceUrl}
          activityList={activityList}
          copy={copy}
        />
        {/* Bottom-left announcement only */}
        {announcement ? (
          <div className="pointer-events-none fixed left-3 bottom-3 z-30 max-w-xs md:left-6 md:bottom-6 md:max-w-sm">
            <div className={`bg-slate-900/80 text-white rounded-lg shadow-lg ${isMobileViewport ? "p-2" : "p-4"}`}>
              <p className={`text-amber-100 ${isMobileViewport ? "text-[11px]" : "text-sm"}`}>{announcement}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
