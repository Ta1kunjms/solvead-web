"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./profile-button.module.css";

type Profile = {
  first_name: string;
  last_name: string;
  lrn: string | null;
  profile_icon: string | null;
};

export default function ProfileButton() {
  const pathname = usePathname();
  const [stage, setStage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateStage = (value: string | null) => {
      setStage(value);
    };

    updateStage(document.documentElement.dataset.solveadStage ?? null);

    const handleStageChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail === "string") {
        updateStage(customEvent.detail);
      }
    };

    window.addEventListener("solvead:stage-change", handleStageChange as EventListener);

    return () => {
      window.removeEventListener("solvead:stage-change", handleStageChange as EventListener);
    };
  }, []);

  // show only when the app is on the home stage, not on the auth/login stage
  const showOnlyOnHome = typeof pathname === "string" && (pathname === "/" || pathname === "") && stage === "home";

  useEffect(() => {
    if (!showOnlyOnHome) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;

    (async () => {
      try {
        const { data: { user } = {} as any } = await supabase.auth.getUser();
        if (!user?.id) return;

        const { data, error } = await supabase
          .from("player_profiles")
          .select("first_name, last_name, lrn, profile_icon")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) return;
        if (mounted) setProfile(data ?? null);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [showOnlyOnHome]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!showOnlyOnHome) return null;

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : "Student";
  const lrn = profile?.lrn ?? "";
  const icon = profile?.profile_icon ?? "/assets/profiles/female-1.png";
  const gender = icon.includes("female") ? "Female" : icon.includes("male") ? "Male" : "Unknown";

  return (
    <div ref={ref} className={styles.container}>
      <button
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open profile"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={styles.avatarBox}>
          <Image src={icon} alt="Profile" width={64} height={64} className={styles.avatarImage} />
        </div>
      </button>

      {open && (
        <div role="dialog" aria-label="Profile details" className={styles.popover}>
          <div className={styles.popoverContent}>
            <div className={styles.popRight}>
              <p className={styles.name}>{displayName}</p>
              {lrn ? <p className={styles.lrn}>{lrn}</p> : null}
              <p className={styles.gender}>{gender}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
