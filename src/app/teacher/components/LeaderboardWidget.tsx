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
    fetch("/api/leaderboards/top-students")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load leaderboard`);
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
    <div className="teacher-sidebar-card">
      <p className="teacher-label text-sm">Leaderboard</p>
      <p className="teacher-helper mb-2 text-xs">Top students by points</p>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              <div className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-8 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="teacher-helper text-xs">No student data yet.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-1">
          {rows.map((row) => {
            const initials = row.student_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <div
                key={row.student_id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    row.rank <= 3
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {row.profile_icon ? (
                    <span className="text-sm">{row.profile_icon}</span>
                  ) : (
                    <span className="flex size-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-500">
                      {initials}
                    </span>
                  )}
                  <span className="truncate text-[13px] font-medium text-gray-800">
                    {row.student_name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {row.total_stars > 0 && (
                    <span className="text-amber-600" title="Stars">
                      ⭐{row.total_stars}
                    </span>
                  )}
                  <span className="font-semibold text-yellow-700" title="Points">
                    💛{row.total_points}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
