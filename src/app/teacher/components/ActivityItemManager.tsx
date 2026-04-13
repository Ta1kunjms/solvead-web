'use client'

import { useMemo, useState } from "react"

type ActivityItem = {
  id: string
  prompt: string
  item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection"
  max_points: number
  answer_key: string | null
  explanation: string | null
  scenario_tag: string | null
  is_required: boolean
  options_json: { choices?: string[] } | null
  sort_order: number
}

type Props = {
  activityId: string
  initialItems: ActivityItem[]
}

type DraftState = {
  id: string | null
  prompt: string
  item_type: ActivityItem["item_type"]
  max_points: number
  answer_key: string
  explanation: string
  scenario_tag: string
  is_required: boolean
  options_text: string
  sort_order: number
}

const emptyDraft = (sortOrder: number): DraftState => ({
  id: null,
  prompt: "",
  item_type: "multiple_choice",
  max_points: 1,
  answer_key: "",
  explanation: "",
  scenario_tag: "",
  is_required: true,
  options_text: "",
  sort_order: sortOrder,
})

export function ActivityItemManager({ activityId, initialItems }: Props) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems)
  const [draft, setDraft] = useState<DraftState>(emptyDraft(initialItems.length + 1))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items])

  const resetDraft = () => setDraft(emptyDraft(sortedItems.length + 1))

  const saveItem = async () => {
    setSaving(true)
    setError(null)

    try {
      const options =
        draft.item_type === "multiple_choice"
          ? { choices: draft.options_text.split("\n").map((choice) => choice.trim()).filter(Boolean) }
          : null

      const payload = {
        prompt: draft.prompt,
        item_type: draft.item_type,
        max_points: draft.max_points,
        answer_key: draft.answer_key.trim() || null,
        explanation: draft.explanation.trim() || null,
        scenario_tag: draft.scenario_tag.trim() || null,
        is_required: draft.is_required,
        options_json: options,
        sort_order: draft.sort_order,
      }

      const response = await fetch(`/api/teacher/activities/${activityId}/items`, {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.id ? { ...payload, itemId: draft.id } : payload),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to save item")
        return
      }

      const body = await response.json()
      const savedItem: ActivityItem = body.item

      setItems((current) => {
        const withoutSaved = current.filter((item) => item.id !== savedItem.id)
        return [...withoutSaved, savedItem]
      })
      resetDraft()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const editItem = (item: ActivityItem) => {
    setDraft({
      id: item.id,
      prompt: item.prompt,
      item_type: item.item_type,
      max_points: item.max_points,
      answer_key: item.answer_key ?? "",
      explanation: item.explanation ?? "",
      scenario_tag: item.scenario_tag ?? "",
      is_required: item.is_required,
      options_text: item.options_json?.choices?.join("\n") ?? "",
      sort_order: item.sort_order,
    })
  }

  const deleteItem = async (itemId: string) => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/teacher/activities/${activityId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to delete item")
        return
      }

      setItems((current) => current.filter((item) => item.id !== itemId))
      if (draft.id === itemId) {
        resetDraft()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <article className="teacher-panel p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{draft.id ? "Edit Activity Item" : "Add Activity Item"}</h2>
            <p className="text-xs text-slate-500">Use line breaks to separate multiple-choice options.</p>
          </div>
          {draft.id && (
            <button onClick={resetDraft} className="teacher-button-ghost">
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid gap-3">
          <div>
            <label className="teacher-label">Prompt</label>
            <textarea
              value={draft.prompt}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              className="teacher-textarea"
              rows={3}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="teacher-label">Type</label>
              <select
                value={draft.item_type}
                onChange={(e) => setDraft({ ...draft, item_type: e.target.value as DraftState["item_type"] })}
                className="teacher-select"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
                <option value="reflection">Reflection</option>
              </select>
            </div>
            <div>
              <label className="teacher-label">Points</label>
              <input
                type="number"
                min="1"
                value={draft.max_points}
                onChange={(e) => setDraft({ ...draft, max_points: Number(e.target.value) })}
                className="teacher-input"
              />
            </div>
            <div>
              <label className="teacher-label">Sort Order</label>
              <input
                type="number"
                min="1"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                className="teacher-input"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="teacher-chip">
                <input
                  type="checkbox"
                  checked={draft.is_required}
                  onChange={(e) => setDraft({ ...draft, is_required: e.target.checked })}
                />
                Required
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Answer Key</label>
              <input
                type="text"
                value={draft.answer_key}
                onChange={(e) => setDraft({ ...draft, answer_key: e.target.value })}
                className="teacher-input"
              />
            </div>
            <div>
              <label className="teacher-label">Scenario Tag</label>
              <input
                type="text"
                value={draft.scenario_tag}
                onChange={(e) => setDraft({ ...draft, scenario_tag: e.target.value })}
                className="teacher-input"
              />
            </div>
          </div>

          <div>
            <label className="teacher-label">Explanation</label>
            <textarea
              value={draft.explanation}
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              className="teacher-textarea"
              rows={2}
            />
          </div>

          {draft.item_type === "multiple_choice" && (
            <div>
              <label className="teacher-label">Options</label>
              <textarea
                value={draft.options_text}
                onChange={(e) => setDraft({ ...draft, options_text: e.target.value })}
                placeholder="One choice per line"
                className="teacher-textarea"
                rows={4}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={saveItem} disabled={saving || !draft.prompt.trim()} className="teacher-button disabled:opacity-50">
            {saving ? "Saving..." : draft.id ? "Update Item" : "Add Item"}
          </button>
          <button onClick={resetDraft} className="teacher-button-ghost">
            Clear
          </button>
        </div>
      </article>

      <article className="teacher-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Current Items ({sortedItems.length})</h2>
          <p className="text-xs text-slate-500">Click Edit to load an item into the form above.</p>
        </div>

        {sortedItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No items yet. Create the first item to make this activity playable.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedItems.map((item) => (
              <div key={item.id} className="teacher-row p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.prompt}</p>
                    <p className="text-xs text-slate-500">
                      {item.item_type}, {item.max_points} points, {item.is_required ? "Required" : "Optional"}
                    </p>
                    {item.options_json?.choices?.length ? (
                      <p className="text-xs text-slate-500">Options: {item.options_json.choices.join(" | ")}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editItem(item)} className="teacher-button-secondary">
                      Edit
                    </button>
                    <button onClick={() => deleteItem(item.id)} disabled={saving} className="teacher-button-danger disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
