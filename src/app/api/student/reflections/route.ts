import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get reflection prompts for activities
    const { data: prompts, error: promptsError } = await supabase
      .from("reflection_prompts")
      .select("id, prompt, activity_id, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (promptsError) {
      return NextResponse.json({ error: promptsError.message }, { status: 500 })
    }

    return NextResponse.json({ prompts })
  } catch (error) {
    console.error("Error fetching reflection prompts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { promptId, responseText } = body

    if (!promptId || !responseText) {
      return NextResponse.json(
        { error: "Missing required fields: promptId, responseText" },
        { status: 400 }
      )
    }

    // Validate response length
    if (responseText.length < 10 || responseText.length > 2000) {
      return NextResponse.json(
        { error: "Response must be between 10 and 2000 characters" },
        { status: 400 }
      )
    }

    // Insert or update reflection response (upsert via unique constraint)
    const { data: response, error: insertError } = await supabase
      .from("reflection_responses")
      .upsert(
        {
          prompt_id: promptId,
          student_id: user.id,
          response_text: responseText,
        },
        { onConflict: "prompt_id,student_id" }
      )
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting reflection response:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Notify the student's teacher(s) that a reflection needs review.
    try {
      const { data: promptRow, error: promptLookupError } = await supabase
        .from("reflection_prompts")
        .select("id, prompt, level_id")
        .eq("id", promptId)
        .maybeSingle()

      if (promptLookupError) {
        console.error("Failed to look up reflection prompt for teacher notification", promptLookupError)
      }

      const { data: classRows, error: classLookupError } = await supabase
        .from("class_students")
        .select("classes!inner(teacher_id)")
        .eq("student_id", user.id)
        .eq("is_active", true)

      if (classLookupError) {
        console.error("Failed to look up teacher IDs for reflection notification", classLookupError)
      }

      const teacherIds = new Set<string>()
      for (const row of classRows ?? []) {
        const classInfo = (row as { classes?: { teacher_id?: string } | { teacher_id?: string }[] | null }).classes
        const teacherId = Array.isArray(classInfo) ? classInfo[0]?.teacher_id : classInfo?.teacher_id
        if (teacherId) {
          teacherIds.add(teacherId)
        }
      }

      if (teacherIds.size === 0) {
        console.warn("No teacher found for reflection submission notification", { studentId: user.id, promptId })
      } else {
        const studentProfile = await supabase
          .from("player_profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle()

        const studentName = studentProfile.data
          ? `${studentProfile.data.first_name ?? "Student"} ${studentProfile.data.last_name ?? ""}`.trim()
          : "Student"

        const promptText = typeof promptRow?.prompt === "string" ? promptRow.prompt : "a reflection"
        const shortPrompt = promptText.length > 120 ? `${promptText.slice(0, 117)}...` : promptText
        const levelSuffix = promptRow?.level_id ? " for this level" : ""
        const message = `${studentName} submitted a reflection${levelSuffix}: ${shortPrompt}`

        const notifications = Array.from(teacherIds).map((teacherId) => ({
          teacher_id: teacherId,
          student_id: user.id,
          level_id: promptRow?.level_id ?? null,
          type: "flagged_reflection",
          message,
          is_read: false,
          created_at: new Date().toISOString(),
        }))

        const { error: notificationInsertError } = await supabase.from("teacher_notifications").insert(notifications)

        if (notificationInsertError) {
          console.error("Failed to create teacher reflection notification", {
            error: notificationInsertError,
            studentId: user.id,
            teacherIds: Array.from(teacherIds),
            promptId,
            message,
          })
        }
      }
    } catch (notifError) {
      console.error("Unexpected error while creating reflection notification", {
        error: notifError,
        studentId: user.id,
        promptId,
      })
    }

    return NextResponse.json(
      { message: "Reflection response saved successfully", response },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error submitting reflection response:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
