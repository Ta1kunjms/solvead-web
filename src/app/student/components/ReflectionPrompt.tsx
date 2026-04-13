'use client'

import { useState } from 'react'

interface ReflectionPromptProps {
  promptText: string
  onSubmit: (response: string) => Promise<void>
  onSkip?: () => void
  isLoading?: boolean
}

export default function ReflectionPrompt({
  promptText,
  onSubmit,
  onSkip,
  isLoading = false,
}: ReflectionPromptProps) {
  const [response, setResponse] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const characterCount = response.length
  const isValid = characterCount >= 10 && characterCount <= 2000

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Response must be between 10 and 2000 characters')
      return
    }

    try {
      setError(null)
      await onSubmit(response)
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save reflection'
      )
    }
  }

  // Show confirmation after submission
  if (submitted) {
    return (
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-6 text-center">
        <div data-testid="reflection-submitted" className="text-xl font-bold text-cyan-700 mb-2">
          ✨ Thank you for your reflection!
        </div>
        <p className="text-cyan-600 text-sm">
          Your teacher will review your response and provide feedback.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
      <div>
        <h3 className="font-bold text-lg text-blue-900 mb-2">💭 Reflection Prompt</h3>
        <p className="text-blue-800 text-base">{promptText}</p>
      </div>

      <div>
        <textarea
          data-testid="reflection-response-input"
          value={response}
          onChange={(e) => {
            setResponse(e.target.value)
            setError(null)
          }}
          placeholder="Write your thoughts here... (10-2000 characters)"
          className="w-full h-32 p-3 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span
            className={`text-sm ${
              isValid ? 'text-blue-600' : 'text-orange-600'
            }`}
          >
            {characterCount}/2000 characters
          </span>
          {characterCount < 10 && characterCount > 0 && (
            <span className="text-xs text-orange-500">
              Need {10 - characterCount} more characters
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          data-testid="reflection-submit-btn"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Submit Reflection'}
        </button>
      </div>
    </div>
  )
}
