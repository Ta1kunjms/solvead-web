"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";

const BACKGROUND_MUSIC_SRC = "/assets/soundtrack/Aylex - Innovating Care (freetouse.com).mp3";

function isStudentPortalPath(pathname: string, stage: string | null): boolean {
  if (pathname.startsWith("/student")) {
    return true;
  }

  return pathname === "/" && stage !== "auth";
}

export function StudentPortalMusic() {
  const pathname = usePathname();
  const hasBoundInteractionRef = useRef(false);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const handleStageChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail === "string") {
        setStage(customEvent.detail);
      }
    };

    const stageFromDom = document.documentElement.dataset.solveadStage;
    if (stageFromDom) {
      setStage(stageFromDom);
    }

    window.addEventListener("solvead:stage-change", handleStageChange as EventListener);

    return () => {
      window.removeEventListener("solvead:stage-change", handleStageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const audio = document.getElementById("student-portal-bgm") as HTMLAudioElement | null;
    if (!audio) {
      return;
    }

    if (!isStudentPortalPath(pathname, stage)) {
      audio.pause();
      return;
    }

    if (audio.volume > 0 && audio.paused) {
      void audio.play().catch(() => {
        // Autoplay can be blocked if the browser has not received user interaction.
      });
    }

    if (hasBoundInteractionRef.current) {
      return;
    }

    const resume = () => {
      const currentAudio = document.getElementById("student-portal-bgm") as HTMLAudioElement | null;
      const currentStage = document.documentElement.dataset.solveadStage ?? stage;
      if (!currentAudio || currentAudio.volume <= 0 || !isStudentPortalPath(window.location.pathname, currentStage)) {
        return;
      }

      if (currentAudio.paused) {
        void currentAudio.play().catch(() => {
          // Autoplay can still fail on some browsers.
        });
      }
    };

    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    hasBoundInteractionRef.current = true;

    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      hasBoundInteractionRef.current = false;
    };
  }, [pathname, stage]);

  return (
    <audio
      id="student-portal-bgm"
      src={BACKGROUND_MUSIC_SRC}
      preload="auto"
      loop
      autoPlay
      playsInline
      className="hidden"
      aria-hidden="true"
    />
  );
}
