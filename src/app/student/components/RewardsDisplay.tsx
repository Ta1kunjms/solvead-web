'use client'

interface UserReward {
  points: number
  stars: number
  badges: string[]
}

interface RewardsDisplayProps {
  rewards: UserReward | null
  compact?: boolean
}

const BADGES_INFO: Record<string, { icon: string; name: string; description: string }> = {
  'first-clear': {
    icon: '🏆',
    name: 'First Clear',
    description: 'Completed Level 1 for the first time',
  },
  'geometry-solver': {
    icon: '📐',
    name: 'Geometry Solver',
    description: 'Completed all geometry levels',
  },
  'peace-builder': {
    icon: '☮️',
    name: 'Peace Builder',
    description: 'Successfully resolved conflict scenarios',
  },
}

export default function RewardsDisplay({
  rewards,
  compact = false,
}: RewardsDisplayProps) {
  if (!rewards) {
    return null
  }

  const { points, stars, badges } = rewards

  if (compact) {
    return (
      <div className="flex gap-4 text-sm">
        {stars > 0 && (
          <div className="flex items-center gap-1 text-amber-600">
            <span className="text-lg">⭐</span>
            <span className="font-semibold">{stars}</span>
          </div>
        )}
        {points > 0 && (
          <div className="flex items-center gap-1 text-yellow-600">
            <span className="text-lg">💛</span>
            <span className="font-semibold">{points}</span>
          </div>
        )}
        {badges.length > 0 && (
          <div className="flex items-center gap-1 text-purple-600">
            <span className="text-lg">🎖️</span>
            <span className="font-semibold">{badges.length}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Points & Stars Summary */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-4xl mb-1">⭐</div>
            <div className="text-2xl font-bold text-amber-700">{stars}</div>
            <div className="text-xs text-amber-600">Level Completions</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-1">💛</div>
            <div className="text-2xl font-bold text-yellow-700">{points}</div>
            <div className="text-xs text-yellow-600">Activity Points</div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-2">
            🎖️ Earned Badges ({badges.length})
          </h4>
          <div className="space-y-2">
            {badges.map((badge) => {
              const info = BADGES_INFO[badge] || {
                icon: '🎖️',
                name: badge,
                description: 'Badge earned',
              }
              return (
                <div
                  key={badge}
                  className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded p-3"
                >
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <div className="font-medium text-purple-900">
                      {info.name}
                    </div>
                    <div className="text-xs text-purple-700">
                      {info.description}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stars === 0 && points === 0 && badges.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">Complete activities to earn rewards!</p>
        </div>
      )}
    </div>
  )
}
