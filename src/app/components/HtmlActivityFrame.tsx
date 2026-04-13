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
  onGameResult?: (result: ActivityGameResult) => void;
};

const HTML_HINT = /<\s*(?:!doctype|html|head|body)\b/i;

const looksLikeHtml = (value: string) => HTML_HINT.test(value);

const getBaseHref = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/[^/]*$/, "");
    return url.toString();
  } catch {
    return null;
  }
};

const injectBaseTag = (html: string, baseHref: string | null) => {
  if (!baseHref || /<base\s/i.test(html)) {
    return html;
  }

  const baseTag = `<base href="${baseHref}">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
  }

  return `${baseTag}${html}`;
};

const GAME_RESULT_TYPES = new Set(["solvead:activity-result", "solvead.activity.result"]);

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseGameResult = (raw: unknown): ActivityGameResult | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const typeValue = toOptionalString(payload.type);

  if (!typeValue || !GAME_RESULT_TYPES.has(typeValue)) {
    return null;
  }

  const activityId =
    toOptionalString(payload.activity_id) ??
    toOptionalString(payload.activityId) ??
    toOptionalString(payload.activity);
  if (!activityId) {
    return null;
  }

  const score = toFiniteNumber(payload.score);
  const maxScore = toFiniteNumber(payload.max_score ?? payload.maxScore);
  const points = toFiniteNumber(payload.points ?? score);

  if (score === null || maxScore === null || points === null) {
    return null;
  }

  const stars = toFiniteNumber(payload.stars) ?? 0;
  const passedValue = payload.passed;
  const passed = typeof passedValue === "boolean" ? passedValue : maxScore > 0 && score >= maxScore * 0.7;
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
  sandbox = "allow-scripts",
  expectedActivityId,
  onGameResult,
}: Props) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [useSrcDoc, setUseSrcDoc] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const trimmed = htmlUrl.trim();

    setUseSrcDoc(false);
    setSrcDoc(null);

    if (!trimmed) {
      return () => {
        cancelled = true;
      };
    }

    if (looksLikeHtml(trimmed)) {
      setUseSrcDoc(true);
      setSrcDoc(trimmed);
      return () => {
        cancelled = true;
      };
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return () => {
        cancelled = true;
      };
    }

    const baseHref = getBaseHref(trimmed);

    const loadHtml = async () => {
      try {
        const response = await fetch(trimmed, { credentials: "omit" });
        if (!response.ok) {
          return;
        }

        const text = await response.text();
        if (cancelled || !looksLikeHtml(text)) {
          return;
        }

        setSrcDoc(injectBaseTag(text, baseHref));
        setUseSrcDoc(true);
      } catch {
        // Fallback to iframe src if fetch fails.
      }
    };

    loadHtml();

    return () => {
      cancelled = true;
    };
  }, [htmlUrl]);

  useEffect(() => {
    if (!onGameResult) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) {
        return;
      }

      const parsed = parseGameResult(event.data);
      if (!parsed) {
        return;
      }

      if (expectedActivityId && parsed.activityId !== expectedActivityId) {
        return;
      }

      onGameResult(parsed);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [expectedActivityId, onGameResult]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={useSrcDoc ? undefined : htmlUrl}
      srcDoc={useSrcDoc ? srcDoc ?? undefined : undefined}
      className={className}
      sandbox={sandbox}
    />
  );
}
