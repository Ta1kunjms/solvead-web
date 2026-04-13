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

    // Add to teacher notifications (for reflection queue)
    try {
      await supabase.from("teacher_notifications").insert({
        teacher_id: user.id,
        student_id: user.id,
        notification_type: "reflection_submitted",
        reference_id: response.id,
      })
    } catch (notifError) {
      console.warn("Warning: Could not create teacher notification:", notifError)
      // Don't fail the response - reflection was created successfully
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
