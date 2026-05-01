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

const SOLVEAD_RESULT_BRIDGE = `<script id="solvead-result-bridge">(function(){
  if (window.__solveadBridgeInstalled) return;
  window.__solveadBridgeInstalled = true;

  var state = { activityId: null, sessionId: null };
  var lastSent = null;
  var timer = null;

  function parseFraction(text) {
    if (!text) return null;
    var match = text.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    if (!match) return null;
    var score = Number(match[1]);
    var maxScore = Number(match[2]);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { score: score, maxScore: maxScore };
  }

  function parseCorrectCount(text) {
    if (!text) return null;

    var patterns = [
      /(\\d+)\\s*of\\s*(\\d+)\\s*(?:answered\\s*)?correct(?:ly)?/ig,
      /(\\d+)\\s*\\/\\s*(\\d+)\\s*(?:answered\\s*)?correct(?:ly)?/ig,
    ];

    var best = null;
    for (var p = 0; p < patterns.length; p += 1) {
      var regex = patterns[p];
      regex.lastIndex = 0;
      var match;
      while ((match = regex.exec(text)) !== null) {
        var score = Number(match[1]);
        var maxScore = Number(match[2]);
        if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
          continue;
        }

        best = { score: score, maxScore: maxScore, at: match.index };
      }
    }

    if (!best) {
      return null;
    }

    return { score: best.score, maxScore: best.maxScore };
  }

  function parseStars(text) {
    if (!text) return 0;
    var starsWord = text.match(/(\\d+)\\s*(?:star|stars)\\b/i);
    if (starsWord) {
      var parsed = Number(starsWord[1]);
      if (Number.isFinite(parsed)) return parsed;
    }

    var starGlyphs = (text.match(/⭐|\\u2b50/g) || []).length;
    return starGlyphs;
  }

  function extractResult() {
    if (!document || !document.body) return null;

    var fullText = document.body.innerText || '';
    var correctCount = parseCorrectCount(fullText);
    if (correctCount) {
      return {
        score: correctCount.score,
        maxScore: correctCount.maxScore,
        stars: parseStars(fullText),
      };
    }

    var candidates = [];
    var scoreNodes = document.querySelectorAll('[id*=\\"score\\" i], [class*=\\"score\\" i], [aria-label*=\\"score\\" i], [data-score]');
    for (var i = 0; i < scoreNodes.length; i += 1) {
      var node = scoreNodes[i];
      var nodeText = node.textContent || '';
      candidates.push(nodeText);

      var nodeCorrectCount = parseCorrectCount(nodeText);
      if (nodeCorrectCount) {
        return {
          score: nodeCorrectCount.score,
          maxScore: nodeCorrectCount.maxScore,
          stars: parseStars(fullText),
        };
      }

      var dataScore = node.getAttribute('data-score');
      var dataMax = node.getAttribute('data-max-score');
      if (dataScore && dataMax) {
        var score = Number(dataScore);
        var maxScore = Number(dataMax);
        if (Number.isFinite(score) && Number.isFinite(maxScore) && maxScore > 0) {
          return {
            score: score,
            maxScore: maxScore,
            stars: parseStars(fullText),
          };
        }
      }
    }

    candidates.push(fullText);

    for (var j = 0; j < candidates.length; j += 1) {
      var fraction = parseFraction(candidates[j]);
      if (fraction) {
        return {
          score: fraction.score,
          maxScore: fraction.maxScore,
          stars: parseStars(candidates[j] + ' ' + (document.body.innerText || '')),
        };
      }
    }

    return null;
  }

  function sendResult() {
    if (!state.activityId) return;
    var snapshot = extractResult();
    if (!snapshot) return;

    var payload = {
      type: 'solvead:activity-result',
      activity_id: state.activityId,
      session_id: state.sessionId,
      score: Math.round(snapshot.score),
      max_score: Math.round(snapshot.maxScore),
      points: Math.round(snapshot.score),
      stars: Math.max(0, Math.min(5, Math.round(snapshot.stars || 0))),
      passed: snapshot.maxScore > 0 && snapshot.score >= snapshot.maxScore * 0.7,
    };

    var serialized = JSON.stringify(payload);
    if (serialized === lastSent) return;
    lastSent = serialized;
    window.parent.postMessage(payload, '*');
  }

  function scheduleSend() {
    if (timer) return;
    timer = window.setTimeout(function() {
      timer = null;
      sendResult();
    }, 450);
  }

  window.addEventListener('message', function(event) {
    var data = event && event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'solvead:session') {
      if (typeof data.activityId === 'string' && data.activityId.trim()) state.activityId = data.activityId.trim();
      if (typeof data.sessionId === 'string' && data.sessionId.trim()) state.sessionId = data.sessionId.trim();
      scheduleSend();
    }
    if (data.type === 'solvead:request-result') {
      scheduleSend();
    }
  });

  var observer = new MutationObserver(function() {
    scheduleSend();
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }

  window.addEventListener('beforeunload', sendResult);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') sendResult();
  });
})();</script>`;

const injectSolveadBridge = (html: string) => {
  if (html.includes("solvead-result-bridge")) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${SOLVEAD_RESULT_BRIDGE}`);
  }

  return `${SOLVEAD_RESULT_BRIDGE}${html}`;
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
  sessionId,
  resultRequestToken,
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
      setSrcDoc(injectSolveadBridge(trimmed));
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

        setSrcDoc(injectSolveadBridge(injectBaseTag(text, baseHref)));
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

      if (!parsed.activityId && expectedActivityId) {
        parsed.activityId = expectedActivityId;
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

  useEffect(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !expectedActivityId) {
      return;
    }

    frameWindow.postMessage(
      {
        type: "solvead:session",
        activityId: expectedActivityId,
        sessionId,
      },
      "*",
    );
  }, [expectedActivityId, sessionId, srcDoc, useSrcDoc]);

  const handleFrameLoad = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !expectedActivityId) {
      return;
    }

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
    if (!resultRequestToken) {
      return;
    }

    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      return;
    }

    frameWindow.postMessage({ type: "solvead:request-result" }, "*");
  }, [resultRequestToken]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={useSrcDoc ? undefined : htmlUrl}
      srcDoc={useSrcDoc ? srcDoc ?? undefined : undefined}
      className={className}
      sandbox={sandbox}
      onLoad={handleFrameLoad}
    />
  );
}
