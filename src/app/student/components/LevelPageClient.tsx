"use client";

import Link from "next/link";
import { LevelEntryCards } from "./ActivityPlayer";
import { useResponsiveScale } from "@/lib/useResponsiveScale";

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
  const { scale, isMobileViewport } = useResponsiveScale();

  return (
    <main className={`relative min-h-screen overflow-hidden text-white ${baseFontSizeClass}`}>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={backgroundStyle} />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45"
        aria-hidden="true"
      />

      {isMobileViewport ? (
        <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[10px] text-white/80">
          Rotate to landscape for best experience
        </div>
      ) : null}

      <div
        className="relative z-10 flex min-h-screen flex-col items-center px-4 py-6 md:px-10"
        style={isMobileViewport ? {
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        } : undefined}
      >
        <div className="flex w-full max-w-6xl flex-col gap-2 md:flex-row md:items-start md:justify-between mb-4">
          <div>
            <p className="uppercase tracking-[0.4em] text-white/80 text-xs">
              Level {levelNumber}
            </p>
            <h1 className="mt-1 font-extrabold text-white drop-shadow text-3xl md:text-4xl">
              {levelTitle}
            </h1>
          </div>
          <Link
            href="/"
            className="control-button inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-[0.2em] text-amber-950 px-4 py-2 text-xs md:text-sm"
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
        {announcement ? (
          <div className="pointer-events-none fixed left-3 bottom-3 z-30 max-w-xs md:left-6 md:bottom-6 md:max-w-sm">
            <div className="bg-slate-900/80 text-white rounded-lg shadow-lg p-4">
              <p className="text-amber-100 text-sm">{announcement}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
