"use client";

import { useRouter } from "next/navigation";
import { ActivityPlayer } from "./ActivityPlayer";

type Props = {
  levelNumber: number;
  items: Array<{
    id: string;
    prompt: string;
    item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection";
    options_json: {
      choices?: string[];
    } | null;
    is_required: boolean;
  }>;
  activityId: string;
};

export function ActivityPlayerWrapper({ levelNumber, items, activityId }: Props) {
  const router = useRouter();

  const handleComplete = (result: {
    score: number;
    passed: boolean;
    total_points: number;
    max_score: number;
  }) => {
    if (result.passed) {
      setTimeout(() => {
        router.push(`/student/levels/${levelNumber}`);
      }, 2000);
    }
  };

  return <ActivityPlayer activityId={activityId} items={items} onSubmitComplete={handleComplete} />;
}
