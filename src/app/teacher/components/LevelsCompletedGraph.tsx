'use client'

import { useCallback, useEffect, useState } from 'react'

type LevelCompletionData = {
  level_number: number
  students_completed: number
  students_not_completed: number
}

type ClassItem = {
  id: string
  name: string
}

export function LevelsCompletedGraph({ initialClasses }: { initialClasses?: ClassItem[] }) {
  const [data, setData] = useState<LevelCompletionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedClassId, setSelectedClassId] = useState<string>("")

  const classes = initialClasses || []

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = selectedClassId
        ? `/api/teacher/levels-completed?classId=${selectedClassId}`
        : "/api/teacher/levels-completed"
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch data")
      }
      const body = await response.json()
      setData(body.data || [])
    } catch (err) {
      console.error("Error fetching levels completed:", err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedClassId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Level Completion Overview</h3>
        {classes.length > 0 && (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-500">No completion data available.</p>
      ) : (
        <div className="space-y-2">
          {data.map((item) => {
            const total = item.students_completed + item.students_not_completed
            const completedPercent = total > 0 ? (item.students_completed / total) * 100 : 0
            return (
              <div key={item.level_number} className="flex items-center gap-3">
                <span className="w-12 text-xs font-medium text-slate-600">Lvl {item.level_number}</span>
                <div className={`flex-1 h-8 relative rounded overflow-hidden ${total === 0 ? 'bg-slate-200' : 'bg-slate-100'}`}>
                  {total > 0 && (
                    <div
                      className="absolute left-0 top-0 h-full bg-emerald-500"
                      style={{ width: `${completedPercent}%` }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <span className="text-xs font-bold text-white drop-shadow">
                      {item.students_completed} completed
                    </span>
                    <span className="text-xs font-bold text-white drop-shadow">
                      {item.students_not_completed} not done
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}