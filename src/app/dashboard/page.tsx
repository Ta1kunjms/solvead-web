import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardEntryPage() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirect("/");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: roleRecord } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRecord?.role === "teacher") {
    redirect("/teacher");
  }

  redirect("/student");
}
