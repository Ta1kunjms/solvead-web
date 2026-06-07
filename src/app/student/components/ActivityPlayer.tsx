"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ActivityGameResult, HtmlActivityFrame } from "@/app/components/HtmlActivityFrame";
import { SCREENSHOT_ACCEPT, MAX_SCREENSHOT_SIZE_BYTES, validateScreenshotFile } from "@/lib/screenshot";

type ActivitySummary = {
  id: string;
  title: string | null;
  instructions: string | null;
  html_url: string | null;
  activity_type: string | null;
};

type Copy = {
  levelLesson: string;
  levelActivities: string;
  levelLessonCardTitle: string;
  levelActivityCardEmptyTitle: string;
  activityModalClose: string;
  activityModalNoHtml: string;
  activityModalOpenList: string;
  activityModalOpenNewTab: string;
};

type Props = {
  levelNumber: number;
  lessonCount: number;
  lessonResourceUrl: string | null;
  activityList: ActivitySummary[];
  copy: Copy;
};

type ActivityItem = {
  id: string;
  prompt: string;
  item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection";
  options_json: {
    choices?: string[];
  } | null;
  is_required: boolean;
};

type SubmitResult = {
  score: number;
  passed: boolean;
  total_points: number;
  max_score: number;
  feedback?: string;
};

type ActivityPlayerProps = {
  activityId: string;
  items: ActivityItem[];
  onSubmitComplete: (result: SubmitResult) => void;
};

type ActiveActivity = ActivitySummary & {
  displayTitle: string;
  position: number;
  sessionId: string;
};

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};



export function LevelEntryCards({ levelNumber, lessonCount, lessonResourceUrl, activityList, copy }: Props) {
  const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(null);
  const [pendingGameResult, setPendingGameResult] = useState<ActivityGameResult | null>(null);
  const [isClosingFromX, setIsClosingFromX] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activityContentRef = useRef<HTMLDivElement | null>(null);
  const submittedSessions = useRef<Set<string>>(new Set());
  const pendingGameResultRef = useRef<ActivityGameResult | null>(null);
  const submissionResultRef = useRef<ActivityGameResult | null>(null);

  useEffect(() => {
    pendingGameResultRef.current = pendingGameResult;
  }, [pendingGameResult]);

  useEffect(() => {
    if (!activeActivity) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingGameResult(null);
        setActiveActivity(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusTimer);
    };
  }, [activeActivity]);

  const activityCards: ActiveActivity[] = activityList.map((activity, index) => ({
    ...activity,
    displayTitle: activity.title ?? `Activity ${index + 1}`,
    position: index + 1,
    sessionId: "",
  }));

  const activityCount = activityCards.length;

  const closeWithoutFetch = () => {
    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(screenshotPreviewUrl);
    }
    setPendingGameResult(null);
    setActiveActivity(null);
    setAttemptError(null);
    setScreenshotFile(null);
    setScreenshotPreviewUrl(null);
    setShowScreenshotModal(false);
    submissionResultRef.current = null;
  };

  const handleCloseFromButton = async () => {
    if (!activeActivity || isClosingFromX) {
      return;
    }

    const sessionId = activeActivity.sessionId;

    const latestResult = pendingGameResultRef.current;
    submissionResultRef.current = latestResult;
    const hasResultForActivity = latestResult?.activityId === activeActivity.id;
    const alreadySubmitted = submittedSessions.current.has(sessionId);

    if (alreadySubmitted) {
      closeWithoutFetch();
      return;
    }

    setShowScreenshotModal(true);
    setAttemptError(null);
  };

  const handleScreenshotSubmit = async () => {
    if (!activeActivity || !screenshotFile) {
      setAttemptError("Screenshot is required");
      return;
    }

    const screenshotValidation = await validateScreenshotFile(screenshotFile);
    if ("error" in screenshotValidation) {
      setAttemptError(screenshotValidation.error);
      return;
    }

    const sessionId = activeActivity.sessionId;
    const latestResult = submissionResultRef.current;
    setIsClosingFromX(true);

try {
       const formData = new FormData();
       formData.append("activity_id", activeActivity.id);
       formData.append("session_id", sessionId);
       formData.append("score", String(latestResult?.score ?? 0));
       formData.append("max_score", String(latestResult?.maxScore ?? 0));
       formData.append("points", String(latestResult?.points ?? 0));
       formData.append("stars", String(latestResult?.stars ?? 0));
       formData.append("passed", String(latestResult?.passed ? 1 : 0));
       formData.append("screenshot", screenshotFile);

      const response = await fetch("/api/activities/submit-html-result", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        submittedSessions.current.add(sessionId);
        closeWithoutFetch();
        return;
      }

      const body = await response.json().catch(() => ({}));
      setAttemptError(body.error || "Failed to submit activity result");
    } catch {
      setAttemptError("Failed to submit activity result");
    } finally {
      setIsClosingFromX(false);
    }
  };

  const lessonCardContent = (
    <>
      <Image
        src="/assets/lesson-activity/water-border.png"
        alt="Lesson frame"
        width={3508}
        height={2480}
        className="h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_25px_50px_rgba(255,200,100,0.4)]"
        priority
      />
      <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center">
        <span className="text-xs uppercase tracking-[0.5em] text-white/90">{copy.levelLesson}</span>
        <span className="mt-3 text-2xl md:text-3xl tuna-card-title">
          {copy.levelLessonCardTitle}
        </span>
        <span className="mt-2 text-xs text-white/80">
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
        </span>
      </div>
    </>
  );

  const lessonCardClassName =
    "group relative mx-auto w-full max-w-[560px] transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70";

  return (
    <>
      <div className="mt-8 grid w-full max-w-6xl gap-6 pb-10 md:mt-14 md:grid-cols-2">
        {lessonResourceUrl ? (
          <a
            href={lessonResourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open lesson resource"
            className={lessonCardClassName}
          >
            {lessonCardContent}
          </a>
        ) : (
          <Link
            href={`/student/levels/${levelNumber}/lesson`}
            aria-label="Open lesson"
            className={lessonCardClassName}
          >
            {lessonCardContent}
          </Link>
        )}

        {activityCount === 0 ? (
          <Link
            href={`/student/levels/${levelNumber}/activity`}
            aria-label="Open activity"
            className="group relative mx-auto w-full max-w-[560px] transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            <Image
              src="/assets/lesson-activity/wooden-border.png"
              alt="Activity frame"
              width={3508}
              height={2480}
              className="h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_25px_50px_rgba(255,200,100,0.4)]"
            />
            <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center">
              <span className="text-xs uppercase tracking-[0.5em] text-white/90">{copy.levelActivities}</span>
              <span className="mt-3 text-2xl md:text-3xl tuna-card-title">
                {copy.levelActivityCardEmptyTitle}
              </span>
              <span className="mt-2 text-xs text-white/80">0 activities</span>
            </div>
          </Link>
        ) : (
          activityCards.map((activity) => (
            <button
              key={activity.id}
              type="button"
              aria-label={`Open activity ${activity.displayTitle}`}
              aria-haspopup="dialog"
              aria-expanded={activeActivity?.id === activity.id}
              onClick={() => {
                setPendingGameResult(null);
                setActiveActivity({ ...activity, sessionId: createSessionId() });
              }}
              className="group relative mx-auto w-full max-w-[560px] cursor-pointer bg-transparent p-0 text-left transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
            >
              <Image
                src="/assets/lesson-activity/wooden-border.png"
                alt="Activity frame"
                width={3508}
                height={2480}
                className="h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_25px_50px_rgba(255,200,100,0.4)]"
              />
              <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center">
                <span className="text-xs uppercase tracking-[0.5em] text-white/90">{copy.levelActivities}</span>
                <span className="mt-3 text-2xl md:text-3xl tuna-card-title">{activity.displayTitle}</span>
                <span className="mt-2 text-xs text-white/80">
                  Activity {activity.position} of {activityCount}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {activeActivity ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeWithoutFetch}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full flex-col overflow-hidden bg-slate-900/95 text-white"
          >
            <h2 id={titleId} className="sr-only">
              {activeActivity.displayTitle}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                void handleCloseFromButton();
              }}
              aria-label={copy.activityModalClose}
              disabled={isClosingFromX}
              className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-slate-950/80 text-white shadow-lg backdrop-blur transition hover:scale-110 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="sr-only">{copy.activityModalClose}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6l-12 12" />
              </svg>
            </button>

            <div ref={activityContentRef} className="flex-1">
{activeActivity.html_url ? (
                   <HtmlActivityFrame
                     activityId={activeActivity.id}
                     title={`Activity HTML ${activeActivity.displayTitle}`}
                     className="h-full w-full bg-white"
                     sandbox="allow-scripts allow-same-origin"
                     expectedActivityId={activeActivity.id}
                     sessionId={activeActivity.sessionId}
                     onGameResult={(result) => {
                      if (result.sessionId && result.sessionId !== activeActivity.sessionId) {
                        return;
                      }

                      setPendingGameResult({
                        ...result,
                        sessionId: activeActivity.sessionId,
                      });
                    }}
                  />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-white/80">
                  <p>{copy.activityModalNoHtml}</p>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/70 px-4 py-4 sm:px-6">
              <div className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  {pendingGameResult ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-100">
                        Score: {pendingGameResult.score}/{pendingGameResult.maxScore}
                      </p>
                      <p className="text-xs text-white/70">
                        {pendingGameResult.passed ? "Passed!" : "Try again to improve"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-teal-100">Finished the activity?</p>
                      <p className="text-xs text-white/70">
                        Submit when you&apos;re done. Your teacher will review the screenshot.
                      </p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCloseFromButton();
                  }}
                  disabled={isClosingFromX}
                  className="rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-100 transition hover:scale-105 hover:bg-teal-400/30 active:scale-95 disabled:opacity-60"
                >
                  <span className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 6l12 12" />
                      <path d="M18 6l-12 12" />
                    </svg>
                    {isClosingFromX ? "Submitting..." : "Submit Activity"}
                  </span>
                </button>
              </div>
            </div>

            {showScreenshotModal && (
              <div className="absolute inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
                  <h3 className="text-lg font-semibold text-white">Submit Activity Result</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Select a screenshot for your teacher to review.
                  </p>
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-teal-100">
                      Screenshot (JPG, PNG, WEBP)
                    </label>
                    {screenshotPreviewUrl ? (
                      <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshotPreviewUrl}
                          alt="Selected screenshot preview"
                          className="block max-h-56 w-full object-contain"
                        />
                      </div>
                    ) : null}
                    <input
                      type="file"
                      accept={SCREENSHOT_ACCEPT}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setScreenshotFile(file);
                        if (screenshotPreviewUrl) {
                          URL.revokeObjectURL(screenshotPreviewUrl);
                        }
                        setScreenshotPreviewUrl(file ? URL.createObjectURL(file) : null);
                        if (attemptError) {
                          setAttemptError(null);
                        }
                      }}
                      className="mt-2 block w-full rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-teal-400/20 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-100"
                    />
                    <p className="mt-2 text-xs text-white/60">
                      {screenshotFile ? `Selected: ${screenshotFile.name}` : "No screenshot selected"}
                    </p>
                  </div>
                  {attemptError && (
                    <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                      {attemptError}
                    </p>
                  )}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowScreenshotModal(false)
                      }}
                      disabled={isClosingFromX}
                      className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:scale-105 hover:bg-white/10 active:scale-95 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleScreenshotSubmit()
                      }}
                      disabled={isClosingFromX || !screenshotFile}
                      className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105 hover:bg-teal-600 active:scale-95 disabled:opacity-60"
                    >
                      {isClosingFromX ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ActivityPlayer({ activityId, items, onSubmitComplete }: ActivityPlayerProps) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const requiredMissing = items.filter(
    (item) => item.is_required && !(responses[item.id]?.trim()),
  );

  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) {
        URL.revokeObjectURL(screenshotPreviewUrl);
      }
    };
  }, [screenshotPreviewUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (requiredMissing.length > 0) {
      setSubmitError("Complete all required items before submitting.");
      return;
    }

    const responsesPayload = items
      .map((item) => ({
        item_id: item.id,
        response_text: responses[item.id]?.trim() || "",
      }))
      .filter((response) => response.response_text.length > 0);

    if (responsesPayload.length === 0) {
      setSubmitError("Provide at least one response before submitting.");
      return;
    }

    if (!screenshotFile) {
      setSubmitError("Screenshot is required");
      return;
    }

    const screenshotValidation = await validateScreenshotFile(screenshotFile);
    if ("error" in screenshotValidation) {
      setSubmitError(screenshotValidation.error);
      return;
    }
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          activity_id: activityId,
          responses: responsesPayload,
        }),
      );
      formData.append("screenshot", screenshotFile);

      const response = await fetch("/api/activities/submit", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit activity");
      }

      const body = await response.json();
      const nextResult: SubmitResult = {
        score: Number(body.score ?? 0),
        passed: Boolean(body.passed),
        total_points: Number(body.total_points ?? 0),
        max_score: Number(body.max_score ?? 0),
        feedback: typeof body.feedback === "string" ? body.feedback : undefined,
      };

      setResult(nextResult);
      onSubmitComplete(nextResult);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-xl border border-teal-300/30 bg-slate-900/70 p-4"
    >
      <div className="space-y-4">
        {items.map((item, index) => {
          const value = responses[item.id] ?? "";
          const choices = item.options_json?.choices ?? [];

          return (
            <section key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-teal-100">
                  {index + 1}. {item.prompt}
                </h3>
                <span className="text-xs uppercase tracking-[0.2em] text-teal-200">
                  {item.is_required ? "Required" : "Optional"}
                </span>
              </div>

              {item.item_type === "multiple_choice" ? (
                <div className="mt-3 space-y-2">
                  {choices.length === 0 ? (
                    <p className="text-xs text-amber-200">No choices configured for this item.</p>
                  ) : (
                    choices.map((choice) => (
                      <label key={choice} className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="radio"
                          name={`choice-${item.id}`}
                          value={choice}
                          checked={value === choice}
                          onChange={(event) =>
                            setResponses((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="h-4 w-4"
                        />
                        <span>{choice}</span>
                      </label>
                    ))
                  )}
                </div>
              ) : null}

              {item.item_type === "true_false" ? (
                <div className="mt-3 flex gap-4 text-sm text-white">
                  {["true", "false"].map((choice) => (
                    <label key={choice} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`choice-${item.id}`}
                        value={choice}
                        checked={value === choice}
                        onChange={(event) =>
                          setResponses((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="h-4 w-4"
                      />
                      <span>{choice === "true" ? "True" : "False"}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {item.item_type === "short_answer" ? (
                <input
                  type="text"
                  value={value}
                  onChange={(event) =>
                    setResponses((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Type your answer"
                  className="mt-3 w-full rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/50"
                />
              ) : null}

              {item.item_type === "reflection" ? (
                <textarea
                  value={value}
                  onChange={(event) =>
                    setResponses((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Write your response"
                  rows={4}
                  className="mt-3 w-full rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/50"
                />
              ) : null}
            </section>
          );
        })}
      </div>

      {submitError ? (
        <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {submitError}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3">
        <label className="block text-sm font-semibold text-teal-100" htmlFor={`screenshot-${activityId}`}>
          Upload screenshot
        </label>
        <p className="mt-1 text-xs text-white/70">
          Upload a JPG, PNG, or WEBP file up to {Math.round(MAX_SCREENSHOT_SIZE_BYTES / (1024 * 1024))}MB.
        </p>
        {screenshotPreviewUrl ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotPreviewUrl}
              alt="Selected screenshot preview"
              className="block max-h-56 w-full object-contain"
            />
          </div>
        ) : null}
        <input
          id={`screenshot-${activityId}`}
          type="file"
          accept={SCREENSHOT_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setScreenshotFile(file);
            if (screenshotPreviewUrl) {
              URL.revokeObjectURL(screenshotPreviewUrl);
            }
            setScreenshotPreviewUrl(file ? URL.createObjectURL(file) : null);
            if (submitError) {
              setSubmitError(null);
            }
          }}
          className="mt-3 block w-full rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-teal-400/20 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-100"
        />
        {screenshotFile ? (
          <p className="mt-2 text-xs text-teal-100/80">Selected: {screenshotFile.name}</p>
        ) : (
          <p className="mt-2 text-xs text-amber-100/80">No screenshot selected yet.</p>
        )}
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-semibold">Score: {result.score}%</p>
          {result.feedback ? <p className="mt-1 text-xs text-emerald-100/80">{result.feedback}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-100 transition hover:bg-teal-400/20 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit Activity"}
        </button>
        {requiredMissing.length > 0 ? (
          <span className="text-xs text-teal-200">
            {requiredMissing.length} required item{requiredMissing.length === 1 ? "" : "s"} remaining
          </span>
        ) : null}
      </div>
    </form>
  );
}
