"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ActivityGameResult = {
  activityId: string;
  score: number;
  maxScore: number;
  points: number;
  stars: number;
  passed: boolean;
  sessionId?: string;
};

export type HtmlActivityFrameHandle = {
  requestLatestResult: () => void;
};

type Props = {
  htmlUrl?: string;
  activityId?: string;
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
  // H5P often uses scaled scores (0-1) with implicit max of 100
  if (scaled !== null) {
    const impliedMax = 100;
    return { score: Math.round(scaled * impliedMax), maxScore: impliedMax };
  }
  return null;
};

const findContextActivityId = (statement: Record<string, unknown>) => {
  const context = statement.context as Record<string, unknown> | undefined;
  if (context) {
    const contextActivities = context.contextActivities as Record<string, unknown> | undefined;
    if (contextActivities) {
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
    }
  }
  // Fallback: use statement object id if available
  const objectId = toOptionalString((statement.object as Record<string, unknown> | undefined)?.id);
  if (objectId) return objectId;
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

type H5PExternalDispatcher = {
  on: (event: string, handler: (event: unknown) => void) => void;
  off?: (event: string, handler: (event: unknown) => void) => void;
};

type H5PFrameWindow = Window & {
  H5P?: {
    externalDispatcher?: H5PExternalDispatcher;
    instances?: Array<{ getXAPIData?: () => unknown }>;
  };
};

export const HtmlActivityFrame = forwardRef<HtmlActivityFrameHandle, Props>(function HtmlActivityFrame({
  htmlUrl,
  activityId,
  title,
  className,
  sandbox = "allow-scripts allow-same-origin",
  expectedActivityId,
  sessionId,
  resultRequestToken,
  onGameResult,
}, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolvedActivityId = expectedActivityId ?? activityId;
  const onGameResultRef = useRef(onGameResult);
  const sessionIdRef = useRef(sessionId);
  const resolvedActivityIdRef = useRef(resolvedActivityId);

  useEffect(() => {
    onGameResultRef.current = onGameResult;
  }, [onGameResult]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    resolvedActivityIdRef.current = resolvedActivityId;
  }, [resolvedActivityId]);

  const getIframeSrc = () => {
    if (activityId) {
      return `/api/activities/${activityId}/html?v=${Date.now()}`;
    }
    if (!htmlUrl) return "";
    const separator = htmlUrl.includes("?") ? "&" : "?";
    return `${htmlUrl}${separator}v=${Date.now()}`;
  };

  const [cacheBustedUrl] = useState(() => getIframeSrc());

  useEffect(() => {
    if (!onGameResult) return;

    const handleXapiEvent = (event: unknown) => {
      // H5P xAPI events arrive as { data: { statement: {...} } } or raw statement
      const candidate =
        event && typeof event === "object" && "data" in (event as Record<string, unknown>)
          ? (event as { data?: { statement?: unknown } }).data?.statement ?? event
          : event;

      const xapi = parseXapiStatement(candidate);
      if (!xapi) return;

      const currentResolved = resolvedActivityIdRef.current;
      // For xAPI/H5P events, the statement's object.id is the H5P content ID,
      // not the database activity UUID. Trust the parent context, not the
      // statement's activity id.
      onGameResultRef.current?.({
        activityId: currentResolved ?? xapi.activityId ?? "",
        score: xapi.score,
        maxScore: xapi.maxScore,
        points: xapi.score,
        stars: xapi.passed ? 3 : 1,
        passed: xapi.passed,
        sessionId: sessionIdRef.current,
      });
    };

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let attachedDispatcher: H5PExternalDispatcher | null = null;

    const tryAttachH5P = (): boolean => {
      const frameWindow = iframeRef.current?.contentWindow as H5PFrameWindow | null;
      if (!frameWindow) return false;

      try {
        const dispatcher = frameWindow.H5P?.externalDispatcher;
        if (!dispatcher || dispatcher === attachedDispatcher) return Boolean(attachedDispatcher);

        dispatcher.on("xAPI", handleXapiEvent);
        attachedDispatcher = dispatcher;
        return true;
      } catch {
        // Cross-origin access blocked (shouldn't happen with allow-same-origin
        // for same-origin content, but bail out gracefully if it does).
        return false;
      }
    };

    pollInterval = setInterval(() => {
      if (tryAttachH5P() && attachedDispatcher && pollInterval) {
        // Keep polling lightly in case H5P re-initializes (e.g. content reset),
        // but slow down dramatically once attached.
        clearInterval(pollInterval);
        pollInterval = setInterval(tryAttachH5P, 2000);
      }
    }, 250);

    const onMessage = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;

      const data = event.data as unknown;

      // H5P handshake: H5P asks the parent to confirm it's ready so that
      // xAPI events and resize messages can flow. Without this handshake,
      // H5P may suppress event delivery to the parent.
      if (data && typeof data === "object" && (data as Record<string, unknown>).context === "h5p") {
        frameWindow.postMessage({ context: "h5p", action: "ready" }, "*");
        return;
      }

      const solveadResult = parseSolveadResult(data);
      if (solveadResult) {
        if (!solveadResult.activityId && resolvedActivityIdRef.current) {
          solveadResult.activityId = resolvedActivityIdRef.current;
        }
        if (
          resolvedActivityIdRef.current &&
          solveadResult.activityId !== resolvedActivityIdRef.current
        ) {
          return;
        }
        onGameResultRef.current?.(solveadResult);
        return;
      }

      const xapi = parseXapiStatement(data);
      if (xapi) {
        // For xAPI/H5P events, the statement's object.id is the H5P content ID,
        // not the database activity UUID. Trust the parent context, not the
        // statement's activity id.
        onGameResultRef.current?.({
          activityId: resolvedActivityIdRef.current ?? xapi.activityId ?? "",
          score: xapi.score,
          maxScore: xapi.maxScore,
          points: xapi.score,
          stars: xapi.passed ? 3 : 1,
          passed: xapi.passed,
          sessionId: sessionIdRef.current,
        });
        return;
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (pollInterval) clearInterval(pollInterval);
      if (attachedDispatcher?.off) {
        try {
          attachedDispatcher.off("xAPI", handleXapiEvent);
        } catch {
          // ignore
        }
      }
    };
  }, [onGameResult]);

  useEffect(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !resolvedActivityId) return;
    frameWindow.postMessage(
      {
        type: "solvead:session",
        activityId: resolvedActivityId,
        sessionId,
      },
      "*",
    );
  }, [resolvedActivityId, sessionId]);

  const handleFrameLoad = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !resolvedActivityId) return;
    frameWindow.postMessage(
      {
        type: "solvead:session",
        activityId: resolvedActivityId,
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

  useImperativeHandle(
    ref,
    () => ({
      requestLatestResult: () => {
        const frameWindow = iframeRef.current?.contentWindow as H5PFrameWindow | null;
        if (!frameWindow) return;

        // Try the solvead:request-result postMessage protocol first.
        try {
          frameWindow.postMessage({ type: "solvead:request-result" }, "*");
        } catch {
          // ignore
        }

        // As a fallback, query every H5P instance for its current xAPI state.
        // This catches results that fired before the dispatcher was attached
        // and any state H5P keeps internally after the game finishes.
        try {
          const instances = frameWindow.H5P?.instances ?? [];
          for (const instance of instances) {
            const data = instance?.getXAPIData?.();
            if (!data) continue;
            const xapi = parseXapiStatement(data);
            if (!xapi) continue;
            const currentResolved = resolvedActivityIdRef.current;
            onGameResultRef.current?.({
              activityId: currentResolved ?? xapi.activityId ?? "",
              score: xapi.score,
              maxScore: xapi.maxScore,
              points: xapi.score,
              stars: xapi.passed ? 3 : 1,
              passed: xapi.passed,
              sessionId: sessionIdRef.current,
            });
          }
        } catch {
          // Cross-origin or H5P not yet initialized - silently ignore.
        }
      },
    }),
    [],
  );

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
});
