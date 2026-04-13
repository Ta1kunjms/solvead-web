'use client'

interface RewardAnnouncement {
  points?: number
  stars?: number
  badges?: string[]
}

interface RewardAnnouncementProps {
  rewards: RewardAnnouncement | null
}

export default function RewardAnnouncement({
  rewards,
}: RewardAnnouncementProps) {
  if (!rewards) {
    return null
  }

  const { points = 0, stars = 0, badges = [] } = rewards

  if (points === 0 && stars === 0 && badges.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {points > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300/40 bg-yellow-400/10 px-4 py-3">
          <span className="text-2xl">💛</span>
          <div>
            <div className="font-bold text-yellow-100">+{points} Activity Points!</div>
            <div className="text-xs text-yellow-200">Keep it up!</div>
          </div>
        </div>
      )}

      {stars > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-3">
          <span className="text-2xl">⭐</span>
          <div>
            <div className="font-bold text-amber-100">Level Complete!</div>
            <div className="text-xs text-amber-200">+{stars} star earned</div>
          </div>
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-300/40 bg-purple-400/10 px-4 py-3">
          <span className="text-2xl">🎖️</span>
          <div>
            <div className="font-bold text-purple-100">
              Badge Earned: {badges[0]}
            </div>
            <div className="text-xs text-purple-200">Achievement unlocked!</div>
          </div>
        </div>
      )}
    </div>
  )
}
