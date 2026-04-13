import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { ClassDetailPanel } from "./ClassDetailPanel"

type Params = {
  classId: string
}

export default async function StudentManagementClassPage({ params }: { params: Promise<Params> }) {
  const resolved = await params
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    redirect("/")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { data: roleRecord } = await supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle()

  if (roleRecord?.role !== "teacher") {
    redirect("/student")
  }

  return (
    <section className="space-y-6">
      <ClassDetailPanel classId={resolved.classId} />
    </section>
  )
}
