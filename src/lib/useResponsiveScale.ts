"use client";

import { useEffect, useState, useCallback } from "react";

export const DESIGN_WIDTH = 1440;
export const MOBILE_BREAKPOINT = 1024;

function getViewportInfo() {
  if (typeof window === "undefined") {
    return { w: 0, h: 0, touchCapable: false };
  }
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    touchCapable: window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
  };
}

function initialScale(): number {
  const { w, touchCapable } = getViewportInfo();
  if (!touchCapable || !w) return 1;
  return w <= MOBILE_BREAKPOINT ? w / DESIGN_WIDTH : 1;
}

function initialMobileViewport(): boolean {
  const { w, touchCapable } = getViewportInfo();
  return touchCapable && w > 0 && w <= MOBILE_BREAKPOINT;
}

function initialMobilePortrait(): boolean {
  const { w, h, touchCapable } = getViewportInfo();
  return touchCapable && w > 0 && w <= MOBILE_BREAKPOINT && h > w;
}

export type ResponsiveScaleResult = {
  scale: number;
  isMobileViewport: boolean;
  isMobilePortrait: boolean;
};

export function useResponsiveScale(): ResponsiveScaleResult {
  const [scale, setScale] = useState(initialScale);
  const [isMobileViewport, setIsMobileViewport] = useState(initialMobileViewport);
  const [isMobilePortrait, setIsMobilePortrait] = useState(initialMobilePortrait);

  const update = useCallback(() => {
    const { w, h, touchCapable } = getViewportInfo();
    const mobile = touchCapable && w <= MOBILE_BREAKPOINT;
    const portrait = mobile && h > w;
    setIsMobileViewport(mobile);
    setIsMobilePortrait(portrait);
    setScale(mobile ? w / DESIGN_WIDTH : 1);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [update]);

  return { scale, isMobileViewport, isMobilePortrait };
}
