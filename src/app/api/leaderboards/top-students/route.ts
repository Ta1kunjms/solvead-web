import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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

export async function GET() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("leaderboard_top_students", { limit_count: 10 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as Omit<LeaderboardRow, "rank">[]).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  return NextResponse.json({ rows });
}
