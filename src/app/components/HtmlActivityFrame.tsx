"use client";

import { useEffect, useRef, useState } from "react";

export type ActivityGameResult = {
  activityId: string;
  score: number;
  maxScore: number;
  points: number;
  stars: number;
  passed: boolean;
  sessionId?: string;
};

type Props = {
  htmlUrl: string;
  title: string;
  className?: string;
  sandbox?: string;
  expectedActivityId?: string;
  sessionId?: string;
  resultRequestToken?: number;
  onGameResult?: (result: ActivityGameResult) => void;
};

const SOLVEAD_RESULT_TYPES = new Set(["solvead:activity-result", "solvead.activity.result"]);

const H5P_XAPI_VERB_PASSED = "http://adlnet.gov/expapi/verbs/passed";
const H5P_XAPI_VERB_FAILED = "http://adlnet.gov/expapi/verbs/failed";
const H5P_XAPI_VERB_COMPLETED = "http://adlnet.gov/expapi/verbs/completed";
const H5P_XAPI_VERB_ANSWERED = "http://adlnet.gov/expapi/verbs/answered";

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractXapiScore = (statement: Record<string, unknown>) => {
  const result = (statement.result as Record<string, unknown> | undefined) ?? undefined;
  if (!result) return null;

  const score = result.score as Record<string, unknown> | undefined;
  const raw = score ? toFiniteNumber(score.raw) : null;
  const max = score ? toFiniteNumber(score.max) : null;
  const scaled = score ? toFiniteNumber(score.scaled) : null;

  if (raw !== null && max !== null && max > 0) {
    return { score: raw, maxScore: max };
  }
  if (scaled !== null) {
    const impliedMax = 1;
    return { score: Math.round(scaled * impliedMax), maxScore: impliedMax };
  }
  return null;
};

const findContextActivityId = (statement: Record<string, unknown>) => {
  const context = statement.context as Record<string, unknown> | undefined;
  if (!context) return null;
  const contextActivities = context.contextActivities as Record<string, unknown> | undefined;
  if (!contextActivities) return null;
  const groups = [
    contextActivities.parent,
    contextActivities.grouping,
    contextActivities.category,
    contextActivities.other,
  ];
  for (const group of groups) {
    if (!Array.isArray(group) || group.length === 0) continue;
    const first = group[0] as Record<string, unknown> | undefined;
    const id = first ? toOptionalString(first.id) : null;
    if (id) return id;
  }
  return null;
};

const parseXapiStatement = (
  payload: unknown,
): { activityId: string | null; score: number; maxScore: number; passed: boolean; terminal: boolean } | null => {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const statement = (obj.statement as Record<string, unknown> | undefined) ?? obj;
  if (!statement || typeof statement !== "object") return null;
  if (!statement.verb || typeof statement.verb !== "object") return null;

  const verb = statement.verb as Record<string, unknown>;
  const verbId = toOptionalString(verb.id) ?? "";
  if (!verbId) return null;

  const isTerminal = [
    H5P_XAPI_VERB_PASSED,
    H5P_XAPI_VERB_FAILED,
    H5P_XAPI_VERB_COMPLETED,
    H5P_XAPI_VERB_ANSWERED,
  ].some((candidate) => verbId === candidate);

  const scored = extractXapiScore(statement);
  if (!scored) return null;

  const result = statement.result as Record<string, unknown> | undefined;
  const success = result ? result.success : undefined;
  const completion = result ? result.completion : undefined;

  const passed =
    typeof success === "boolean"
      ? success
      : verbId === H5P_XAPI_VERB_PASSED ||
        verbId === H5P_XAPI_VERB_COMPLETED ||
        (typeof completion === "boolean" && completion);

  return {
    activityId: findContextActivityId(statement),
    score: scored.score,
    maxScore: scored.maxScore,
    passed,
    terminal: isTerminal,
  };
};

const parseSolveadResult = (raw: unknown): ActivityGameResult | null => {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const typeValue = toOptionalString(payload.type);
  if (!typeValue || !SOLVEAD_RESULT_TYPES.has(typeValue)) return null;

  const activityId =
    toOptionalString(payload.activity_id) ??
    toOptionalString(payload.activityId) ??
    toOptionalString(payload.activity);
  if (!activityId) return null;

  const score = toFiniteNumber(payload.score);
  const maxScore = toFiniteNumber(payload.max_score ?? payload.maxScore);
  const points = toFiniteNumber(payload.points ?? score);
  if (score === null || maxScore === null || points === null) return null;

  const stars = toFiniteNumber(payload.stars) ?? 0;
  const passedValue = payload.passed;
  const passed =
    typeof passedValue === "boolean"
      ? passedValue
      : maxScore > 0 && score >= maxScore * 0.7;
  const sessionId = toOptionalString(payload.session_id ?? payload.sessionId) ?? undefined;

  return {
    activityId,
    score,
    maxScore,
    points,
    stars,
    passed,
    sessionId,
  };
};

export function HtmlActivityFrame({
  htmlUrl,
  title,
  className,
  sandbox = "allow-scripts allow-same-origin",
  expectedActivityId,
  sessionId,
  resultRequestToken,
  onGameResult,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [cacheBustedUrl] = useState(() => {
    const separator = htmlUrl.includes("?") ? "&" : "?";
    return `${htmlUrl}${separator}v=${Date.now()}`;
  });

  useEffect(() => {
    if (!onGameResult) return;

    const onMessage = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;

      const data = event.data as unknown;

      const solveadResult = parseSolveadResult(data);
      if (solveadResult) {
        if (!solveadResult.activityId && expectedActivityId) {
          solveadResult.activityId = expectedActivityId;
        }
        if (expectedActivityId && solveadResult.activityId !== expectedActivityId) return;
        onGameResult(solveadResult);
        return;
      }

      const xapi = parseXapiStatement(data);
      if (!xapi || !xapi.terminal) return;
      if (expectedActivityId && xapi.activityId && xapi.activityId !== expectedActivityId) return;

      onGameResult({
        activityId: expectedActivityId ?? xapi.activityId ?? "",
        score: xapi.score,
        maxScore: xapi.maxScore,
        points: xapi.score,
        stars: xapi.passed ? 3 : 1,
        passed: xapi.passed,
        sessionId,
      });
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [expectedActivityId, sessionId, onGameResult]);

  useEffect(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !expectedActivityId) return;
    frameWindow.postMessage(
      {
        type: "solvead:session",
        activityId: expectedActivityId,
        sessionId,
      },
      "*",
    );
  }, [expectedActivityId, sessionId]);

  const handleFrameLoad = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !expectedActivityId) return;
    frameWindow.postMessage(
      {
        type: "solvead:session",
        activityId: expectedActivityId,
        sessionId,
      },
      "*",
    );
    frameWindow.postMessage({ type: "solvead:request-result" }, "*");
  };

  useEffect(() => {
    if (!resultRequestToken) return;
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.postMessage({ type: "solvead:request-result" }, "*");
  }, [resultRequestToken]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={cacheBustedUrl}
      className={className}
      sandbox={sandbox}
      onLoad={handleFrameLoad}
    />
  );
}
