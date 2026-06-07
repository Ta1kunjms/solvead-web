"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type LeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  profile_icon: string | null;
  total_points: number;
  total_stars: number;
  levels_completed: number;
  average_score: number;
  total_time_seconds: number;
};

const MEDALS: Record<number, string> = {
  1: "/assets/misc-buttons/Medal 1 Button.png",
  2: "/assets/misc-buttons/Medal 2 Button.png",
  3: "/assets/misc-buttons/Medal 3 Button.png",
};

export function LeaderboardWidget() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboards/top-students")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load leaderboard");
        return res.json();
      })
      .then((data: { rows: LeaderboardRow[] }) => {
        setRows(data.rows);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <aside className="w-full rounded-2xl border border-[#8a6330]/45 bg-[#f4e1b6]/95 px-4 py-3 shadow-[0_10px_18px_rgba(53,29,7,0.3)]">
      <div className="flex items-center gap-2 mb-2">
        <Image src="/assets/misc-buttons/Trophy Button.png" alt="" width={22} height={22} className="h-5 w-5 object-contain" />
        <h3 className="text-sm font-black text-[#5a3818] sm:text-base">Leaderboard</h3>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#8d6131]/40 bg-[#d9a55f] px-3 py-2">
        <p className="mb-2 text-[11px] font-black text-[#5a3818] sm:text-xs">Top 1-10 Players</p>

        {loading && (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[#f3d29f]/70 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-pulse rounded-full bg-[#c4944a]" />
                  <div className="h-4 w-24 animate-pulse rounded bg-[#c4944a]" />
                </div>
                <div className="h-4 w-10 animate-pulse rounded bg-[#c4944a]" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm font-semibold text-[#6b4827]">{error}</p>}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm font-semibold text-[#6b4827]">No players yet.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-1">
            {rows.slice(0, 10).map((row) => {
              const medalSrc = MEDALS[row.rank];
              return (
                <div
                  key={row.student_id}
                  className="flex items-center justify-between rounded-lg bg-[#f3d29f]/70 px-2 py-1.5 text-sm font-bold text-[#5a3818] sm:text-base"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {medalSrc ? (
                      <Image
                        src={medalSrc}
                        alt={`Medal ${row.rank}`}
                        width={24}
                        height={24}
                        className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                      />
                    ) : (
                      <span className="font-black">#{row.rank}</span>
                    )}
                    <span className="truncate">{row.student_name}</span>
                  </div>
                  <span className="shrink-0">{row.total_points} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
