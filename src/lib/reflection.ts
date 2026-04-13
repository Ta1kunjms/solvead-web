/**
 * Reflection Prompts for different activity types
 * These are sample prompts that can be customized by teachers
 */

export const DEFAULT_REFLECTION_PROMPTS = {
  quiz: [
    'What was the most challenging question in this quiz? Why did you find it difficult?',
    'How did you feel about your performance? What would you like to improve next time?',
    'Which geometry concept from this quiz do you feel most confident about?',
  ],
  problem_solving: [
    'Describe your approach to solving this geometry problem. What worked well?',
    'What would you do differently next time to solve this more efficiently?',
    'How did this problem challenge your understanding of geometry?',
  ],
  reflection: [
    'What did you learn about yourself through this reflection activity?',
    'How can you apply this lesson to handle similar situations in the future?',
    'What support or resources would help you in similar situations?',
  ],
  mixed: [
    'What was the highlight of this activity for you?',
    'What would you like to remember most from this experience?',
    'How has this activity changed your perspective?',
  ],
}

export type ActivityType = keyof typeof DEFAULT_REFLECTION_PROMPTS

/**
 * Get appropriate reflection prompts for an activity type
 */
export function getReflectionPromptsForActivity(
  activityType: ActivityType | string
): string[] {
  const type = activityType as ActivityType
  return (
    DEFAULT_REFLECTION_PROMPTS[type] ?? DEFAULT_REFLECTION_PROMPTS.mixed
  )
}

/**
 * Select a random reflection prompt for an activity
 */
export function selectRandomPrompt(
  activityType: ActivityType | string
): string {
  const prompts = getReflectionPromptsForActivity(activityType)
  return prompts[Math.floor(Math.random() * prompts.length)]
}
