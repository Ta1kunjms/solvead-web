"use client";

import { useEffect, useState } from "react";

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

export function LeaderboardWidget() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboards/top-students?all=true")
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
    <aside className="teacher-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Rankings</h2>
        <span className="teacher-chip">{rows.length} players</span>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="h-5 w-6 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="teacher-helper">No players yet.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="max-h-[600px] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div
              key={row.student_id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-center font-black text-slate-400 sm:text-base">
                  #{row.rank}
                </span>
                <span className="truncate font-semibold text-slate-900">{row.student_name}</span>
              </div>
              <span className="shrink-0 font-bold text-slate-700">{row.total_points} pts</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
