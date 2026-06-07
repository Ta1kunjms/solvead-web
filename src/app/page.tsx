"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCopy } from "@/lib/i18n";
import { useResponsiveScale } from "@/lib/useResponsiveScale";
import {
  clampLevel,
  DEFAULT_PREFERENCES,
  getBaseFontSizeClass,
  getBrightnessMultiplier,
  normalizePreferencesRow,
  type UserPreferences,
} from "@/lib/preferences";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stage = "auth" | "role" | "gender" | "profile" | "confirm" | "home";
type AuthMode = "login" | "register";
type AccountRole = "student" | "teacher";
type ProfileGender = "male" | "female";

type PlayerProfile = {
  first_name: string;
  last_name: string;
  lrn: string | null;
  profile_icon: string | null;
  onboarding_complete: boolean;
};

type ProgressRecord = {
  level_number: number;
  unlocked: boolean;
  completed: boolean;
  approval_status: string | null;
};

type ResearcherProfile = {
  id: string;
  name: string;
  role: string;
  school: string;
  email: string;
  description: string;
  image: string;
};

type LeaderboardEntry = {
  rank: number;
  student_id: string;
  student_name: string;
  profile_icon: string | null;
  total_points: number;
  total_stars: number;
  levels_completed: number;
  average_score: number;
  total_time_seconds: number;
};

const LEVEL_POSITIONS = [
  { level: 1, left: "22%", top: "44%" },
  { level: 2, left: "20%", top: "56%" },
  { level: 3, left: "26%", top: "66%" },
  { level: 4, left: "35%", top: "65%" },
  { level: 5, left: "44%", top: "65%" },
  { level: 6, left: "50%", top: "76%" },
  { level: 7, left: "56%", top: "68%" },
  { level: 8, left: "62%", top: "60%" },
  { level: 9, left: "67%", top: "58%" },
  { level: 10, left: "73%", top: "52%" },
  { level: 11, left: "79%", top: "43%" },
  { level: 12, left: "86%", top: "38%" },
  { level: 13, left: "80%", top: "26%" },
  { level: 14, left: "71%", top: "21%" },
  { level: 15, left: "60%", top: "12%" },
];

const PROFILE_ICONS = [
  { id: 1, src: "/assets/profiles/female-1.png", gender: "female" },
  { id: 2, src: "/assets/profiles/male-2.png", gender: "male" },
  { id: 3, src: "/assets/profiles/male-3.png", gender: "male" },
  { id: 4, src: "/assets/profiles/female-4.png", gender: "female" },
  { id: 5, src: "/assets/profiles/female-5.png", gender: "female" },
  { id: 6, src: "/assets/profiles/female-6.png", gender: "female" },
  { id: 7, src: "/assets/profiles/male-7.png", gender: "male" },
  { id: 8, src: "/assets/profiles/male-8.png", gender: "male" },
  { id: 9, src: "/assets/profiles/male-9.png", gender: "male" },
  { id: 10, src: "/assets/profiles/male-10.png", gender: "male" },
  { id: 11, src: "/assets/profiles/female-11.png", gender: "female" },
  { id: 12, src: "/assets/profiles/male-12.png", gender: "male" },
  { id: 13, src: "/assets/profiles/female-13.png", gender: "female" },
  { id: 14, src: "/assets/profiles/female-14.png", gender: "female" },
  { id: 15, src: "/assets/profiles/female-15.png", gender: "female" },
] as const;

const DEFAULT_PROFILE_ICON = PROFILE_ICONS[0].src;

const RESEARCHER_PROFILES: ResearcherProfile[] = [
  {
    id: "researcher-1",
    name: "Trisha Krisbiene M. Batiancila",
    role: "BSEd Mathematics",
    school: "Mindanao State University General Santos",
    email: "trishakrisbiene.batiancila@msugensan.edu.ph",
    description: "Focuses on game-integrated classroom learning designs for better student engagement.",
    image: "/assets/researchers/researcher-1.jpg",
  },
  {
    id: "researcher-2",
    name: "Irene Mae B. Lastrella",
    role: "BSEd Mathematics",
    school: "Mindanao State University General Santos",
    email: "irenemae.lastrella@msugensan.edu.ph",
    description: "Handles assessment flow and learner analytics alignment for level progression.",
    image: "/assets/researchers/researcher-3.png",
  },
  {
    id: "researcher-3",
    name: "Windl Chris Sam C. Perocho",
    role: "BSEd Mathematics",
    school: "Mindanao State University General Santos",
    email: "windlchrissam.perocho@msugensan.edu.ph",
    description: "Builds gameplay and reward systems with accessibility and clear learner feedback.",
    image: "/assets/researchers/researcher-2.jpg",
  },
];

const GENDER_BUTTONS: Record<ProfileGender, string> = {
  male: "/assets/misc-buttons/male-button.png",
  female: "/assets/misc-buttons/female-button.png",
};

const LEADERBOARD_MEDALS: Record<number, string> = {
  1: "/assets/misc-buttons/Medal 1 Button.png",
  2: "/assets/misc-buttons/Medal 2 Button.png",
  3: "/assets/misc-buttons/Medal 3 Button.png",
};

const CLICK_SOUND_SRC = "/assets/soundtrack/mixkit-classic-click-1117.wav";

function resolveAuthIdentifier(identifier: string): { email: string; lrn: string | null } | null {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      return null;
    }

    return { email: trimmed, lrn: null };
  }

  return { email: `${trimmed}@solvead.local`, lrn: trimmed };
}

function normalizeRole(value: unknown): AccountRole | null {
  if (value === "teacher" || value === "student") {
    return value;
  }

  return null;
}

function extractRoleFromUser(activeUser: User): AccountRole | null {
  return normalizeRole(
    activeUser.user_metadata?.role ??
      activeUser.user_metadata?.account_role ??
      activeUser.user_metadata?.user_role ??
      activeUser.app_metadata?.role ??
      activeUser.app_metadata?.account_role ??
      activeUser.app_metadata?.user_role,
  );
}

function extractTeacherProfile(activeUser: User): { firstName: string; lastName: string } | null {
  const rawFirst = String(activeUser.user_metadata?.first_name ?? "").trim();
  const rawLast = String(activeUser.user_metadata?.last_name ?? "").trim();
  const rawFull = String(activeUser.user_metadata?.full_name ?? "").trim();
  const parts = rawFull ? rawFull.split(" ") : [];
  const resolvedFirst = rawFirst || parts[0] || "";
  const resolvedLast = rawLast || parts.slice(1).join(" ") || "";

  if (!resolvedFirst && !resolvedLast) {
    return null;
  }

  return { firstName: resolvedFirst, lastName: resolvedLast };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Network error while contacting authentication service.";
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://solvead.vercel.app";
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVolumeRef = useRef(DEFAULT_PREFERENCES.volume_level);
  const lastSfxRef = useRef(DEFAULT_PREFERENCES.sfx_level);

  const [stage, setStage] = useState<Stage>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authRole, setAuthRole] = useState<AccountRole>("student");
  const [pendingRole, setPendingRole] = useState<AccountRole>("student");
  const [form, setForm] = useState({ firstName: "", lastName: "", lrn: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Sign in with Gmail, LRN, or email + password.");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [selectedGender, setSelectedGender] = useState<ProfileGender | null>(null);
  const [selectedProfileIcon, setSelectedProfileIcon] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState(1);
  const [levelProgress, setLevelProgress] = useState<Map<number, ProgressRecord>>(new Map());
  const [unlockedCelebration, setUnlockedCelebration] = useState<{ level: number; expiresAt: number } | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showResearchersModal, setShowResearchersModal] = useState(false);
  const [showAboutGame, setShowAboutGame] = useState(false);
  const [lrnInput, setLrnInput] = useState("");
  const [isSavingLrn, setIsSavingLrn] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardFetched, setLeaderboardFetched] = useState(false);
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const { scale, isMobileViewport, isMobilePortrait } = useResponsiveScale();

  const filteredProfileIcons = useMemo(
    () => PROFILE_ICONS.filter((icon) => !selectedGender || icon.gender === selectedGender),
    [selectedGender],
  );

  const syncBackgroundAudio = useCallback((nextPreferences?: UserPreferences) => {
    const audio = document.getElementById("student-portal-bgm") as HTMLAudioElement | null;
    if (!audio) {
      return;
    }

    const resolved = nextPreferences ?? preferences;
    const gain = clampLevel(resolved.volume_level) / 100;
    audio.volume = gain;

    if (gain <= 0) {
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (audio.paused) {
      void audio.play().catch(() => {
        // Autoplay can be blocked if the browser has not received user interaction.
      });
    }
  }, [preferences.sound_enabled, preferences.volume_level]);

  const playClickSound = useCallback(() => {
    syncBackgroundAudio();
    const gain = clampLevel(preferences.sfx_level) / 100;
    if (gain <= 0) {
      return;
    }

    const audio = audioRef.current;
    if (!audio || !audio.src) {
      if (typeof window !== "undefined") {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.type = "triangle";
          oscillator.frequency.value = 880;
          gainNode.gain.value = Math.min(gain, 1) * 0.14;

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.06);

          oscillator.onended = () => {
            void context.close();
          };
        }
      }
      return;
    }

    audio.volume = gain;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay can be blocked if the browser has not received user interaction.
    });
  }, [preferences, syncBackgroundAudio]);

  useEffect(() => {
    if (stage !== "home") {
      return;
    }

    syncBackgroundAudio();
  }, [stage, syncBackgroundAudio]);

  useEffect(() => {
    document.documentElement.dataset.solveadStage = stage;
    window.dispatchEvent(new CustomEvent("solvead:stage-change", { detail: stage }));

    return () => {
      delete document.documentElement.dataset.solveadStage;
      window.dispatchEvent(new CustomEvent("solvead:stage-change", { detail: "auth" }));
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "home") {
      return;
    }

    const handleResume = () => {
      syncBackgroundAudio();
    };

    window.addEventListener("pointerdown", handleResume, { once: true });
    window.addEventListener("keydown", handleResume, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleResume);
      window.removeEventListener("keydown", handleResume);
    };
  }, [stage, syncBackgroundAudio]);

  const fetchPreferences = useCallback(async (userId: string) => {
    if (!supabase) {
      setPreferences(DEFAULT_PREFERENCES);
      return;
    }

    const { data } = await supabase
      .from("user_preferences")
      .select(
        "language, font_size, contrast_mode, dark_mode, sound_enabled, volume_level, brightness_level, sfx_level",
      )
      .eq("user_id", userId)
      .maybeSingle();

    setPreferences(normalizePreferencesRow(data));
  }, [supabase]);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    try {
      const response = await fetch("/api/leaderboards/top-students", { method: "GET" });
      const payload = (await response.json()) as { rows?: LeaderboardEntry[]; error?: string };

      if (!response.ok) {
        setLeaderboardError(payload.error ?? "Could not load leaderboard.");
        return;
      }

      setLeaderboardRows(payload.rows ?? []);
    } catch {
      setLeaderboardError("Could not load leaderboard.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const ensureAuthSession = useCallback(
    async (activeUser: User) => {
      if (!supabase) {
        return null;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setStatus(`Session check failed: ${sessionError.message}`);
        return null;
      }

      if (sessionData.session?.user?.id === activeUser.id) {
        return sessionData.session;
      }

      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        setStatus("Session not ready. Please sign in again.");
        return null;
      }

      if (refreshedData.session?.user?.id === activeUser.id) {
        return refreshedData.session;
      }

      setStatus("Session mismatch. Please sign in again.");
      return null;
    },
    [supabase],
  );

  const ensureUserBootstrap = useCallback(
    async (
      activeUser: User,
      preferredRole?: AccountRole,
      teacherProfile?: { firstName: string; lastName: string },
    ) => {
      if (!supabase) {
        return preferredRole ?? extractRoleFromUser(activeUser) ?? "student";
      }

      const { data: roleRecord } = await supabase
        .from("app_user_roles")
        .select("role")
        .eq("user_id", activeUser.id)
        .maybeSingle();

      const roleFromRecord = normalizeRole(roleRecord?.role);
      const roleFromMetadata = extractRoleFromUser(activeUser);
      let resolvedRole: AccountRole | null = roleFromRecord ?? roleFromMetadata ?? preferredRole ?? null;
      let hasTeacherProfile = false;

      if (!resolvedRole || roleFromRecord === "student") {
        const { data: teacherRow } = await supabase
          .from("teacher_profiles")
          .select("user_id")
          .eq("user_id", activeUser.id)
          .maybeSingle();

        hasTeacherProfile = Boolean(teacherRow);

        if (!resolvedRole && hasTeacherProfile) {
          resolvedRole = "teacher";
        }

        if (roleFromRecord === "student" && (roleFromMetadata === "teacher" || hasTeacherProfile)) {
          resolvedRole = "teacher";
        }
      }

      if (!resolvedRole) {
        return null;
      }

      if (!roleRecord || roleFromRecord !== resolvedRole) {
        await supabase.from("app_user_roles").upsert({ user_id: activeUser.id, role: resolvedRole });
      }

      if (resolvedRole === "teacher") {
        const fallbackProfile = teacherProfile ?? extractTeacherProfile(activeUser);
        if (fallbackProfile) {
          await supabase.from("teacher_profiles").upsert({
            user_id: activeUser.id,
            first_name: fallbackProfile.firstName,
            last_name: fallbackProfile.lastName,
          });
        }

        return resolvedRole;
      }

      const { count } = await supabase
        .from("level_progress")
        .select("level_number", { count: "exact", head: true })
        .eq("user_id", activeUser.id);

      if (!count || count === 0) {
        const levelRows = Array.from({ length: 15 }, (_, index) => ({
          user_id: activeUser.id,
          level_number: index + 1,
          unlocked: index === 0,
          approval_status: index === 0 ? "approved" : "pending",
        }));

        await supabase.from("level_progress").upsert(levelRows, { onConflict: "user_id,level_number" });
      }

      return resolvedRole;
    },
    [supabase],
  );

  const handleSignedInUser = useCallback(async (activeUser: User, preferredRole?: AccountRole) => {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    const session = await ensureAuthSession(activeUser);

    if (!session) {
      return;
    }

    setUser(activeUser);
    const role = await ensureUserBootstrap(activeUser, preferredRole);

    if (!role) {
      setStatus("Choose your role to continue.");
      setPendingRole("student");
      setStage("role");
      return;
    }

    if (role === "teacher") {
      setStatus("Teacher account detected. Opening teacher dashboard...");
      window.location.assign("/teacher");
      return;
    }

    const { data: existingProfile, error } = await supabase
      .from("player_profiles")
      .select("first_name, last_name, lrn, profile_icon, onboarding_complete")
      .eq("user_id", activeUser.id)
      .maybeSingle();

    if (error) {
      setStatus(`Profile lookup failed: ${error.message}`);
      return;
    }

    let profileRecord = existingProfile as PlayerProfile | null;

    if (!profileRecord) {
      const fallbackName = String(activeUser.user_metadata?.full_name ?? "Player One").split(" ");
      const firstName = String(activeUser.user_metadata?.first_name ?? fallbackName[0] ?? "Player");
      const lastName = String(activeUser.user_metadata?.last_name ?? fallbackName.slice(1).join(" ") ?? "User");

      const { data: insertedProfile, error: insertError } = await supabase
        .from("player_profiles")
        .upsert({
          user_id: activeUser.id,
          first_name: firstName,
          last_name: lastName,
          lrn: activeUser.user_metadata?.lrn ?? null,
          profile_icon: null,
          onboarding_complete: false,
        })
        .select("first_name, last_name, lrn, profile_icon, onboarding_complete")
        .single();

      if (insertError) {
        setStatus(`Unable to create profile: ${insertError.message}`);
        return;
      }

      profileRecord = insertedProfile as PlayerProfile;
    }

    const profileGender = profileRecord.profile_icon
      ? PROFILE_ICONS.find((icon) => icon.src === profileRecord.profile_icon)?.gender ?? null
      : null;

    setProfile(profileRecord);
    setSelectedProfileIcon(profileRecord.profile_icon);
    setSelectedGender(profileGender);
    await fetchPreferences(activeUser.id);

    const { data: progressRows } = await supabase
      .from("level_progress")
      .select("level_number, unlocked, completed, approval_status")
      .eq("user_id", activeUser.id)
      .order("level_number", { ascending: true });

    setLevelProgress(new Map(((progressRows ?? []) as ProgressRecord[]).map((row) => [row.level_number, row])));

    if (profileRecord.onboarding_complete) {
      setStage("home");
      setStatus(`Welcome back, ${profileRecord.first_name}!`);
    } else {
      setStage(profileGender ? "profile" : "gender");
      setStatus(profileGender ? "Select your profile icon to continue." : "Choose male or female to continue.");
    }
  }, [ensureAuthSession, ensureUserBootstrap, fetchPreferences, supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus("Sign in with Gmail, LRN, or email + password.");
        setStage("auth");
        return;
      }

      await handleSignedInUser(session.user);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setSelectedProfileIcon(null);
        setSelectedGender(null);
        setStage("auth");
        setStatus("Session ended. Please log in again.");
        return;
      }

      void handleSignedInUser(session.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSignedInUser, supabase]);

  useEffect(() => {
    if (stage === "home" && !leaderboardFetched) {
      setLeaderboardFetched(true);
      void fetchLeaderboard();
    }
  }, [fetchLeaderboard, leaderboardFetched, stage]);

  // Subscribe to level_progress changes for the current student so the level map
  // updates immediately when a teacher clicks Proceed (no manual reload needed).
  useEffect(() => {
    if (!supabase) {
      return;
    }

    if (stage !== "home") {
      return;
    }

    let cancelled = false;
    let cleanupChannel: (() => void) | null = null;

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId || cancelled) {
        return;
      }

      const channel = supabase
        .channel(`student-level-progress-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "level_progress",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = (payload.new ?? {}) as {
              level_number?: number;
              unlocked?: boolean;
              completed?: boolean;
              approval_status?: string | null;
            };
            const levelNumber = typeof row.level_number === "number" ? row.level_number : null;
            if (levelNumber === null) {
              return;
            }

            let didJustUnlock = false;

            setLevelProgress((previous) => {
              const next = new Map(previous);
              const existing = next.get(levelNumber);
              const updated: ProgressRecord = {
                level_number: levelNumber,
                unlocked: typeof row.unlocked === "boolean" ? row.unlocked : existing?.unlocked ?? false,
                completed: typeof row.completed === "boolean" ? row.completed : existing?.completed ?? false,
                approval_status:
                  typeof row.approval_status === "string" || row.approval_status === null
                    ? row.approval_status
                    : existing?.approval_status ?? null,
              };
              const wasUnlocked = existing?.unlocked === true;
              const isUnlockedNow = updated.unlocked === true;
              didJustUnlock = !wasUnlocked && isUnlockedNow;
              next.set(levelNumber, updated);
              return next;
            });

            if (didJustUnlock && levelNumber > 1) {
              const expiresAt = Date.now() + 5000;
              setUnlockedCelebration({ level: levelNumber, expiresAt });
              setStatus(`Level ${levelNumber} is now unlocked! Open it from the map.`);
            }
          },
        )
        .subscribe();

      cleanupChannel = () => {
        void supabase.removeChannel(channel);
      };

      if (cancelled && cleanupChannel) {
        cleanupChannel();
        cleanupChannel = null;
      }
    })();

    return () => {
      cancelled = true;
      if (cleanupChannel) {
        cleanupChannel();
        cleanupChannel = null;
      }
    };
  }, [stage, supabase, setStatus]);

  useEffect(() => {
    if (!unlockedCelebration) {
      return;
    }
    const remaining = unlockedCelebration.expiresAt - Date.now();
    if (remaining <= 0) {
      setUnlockedCelebration(null);
      return;
    }
    const timer = window.setTimeout(() => setUnlockedCelebration(null), remaining);
    return () => window.clearTimeout(timer);
  }, [unlockedCelebration]);

  useEffect(() => {
    if (preferences.volume_level > 0) {
      lastVolumeRef.current = preferences.volume_level;
    }
  }, [preferences.volume_level]);

  useEffect(() => {
    if (preferences.sfx_level > 0) {
      lastSfxRef.current = preferences.sfx_level;
    }
  }, [preferences.sfx_level]);

  useEffect(() => {
    return () => {
      if (sliderSaveTimer.current) {
        clearTimeout(sliderSaveTimer.current);
      }
    };
  }, []);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    if (!form.firstName || !form.lastName || !form.lrn || !form.password) {
      setStatus("Please complete First name, Last name, LRN or Gmail, and Password.");
      return;
    }

    const parsedIdentifier = resolveAuthIdentifier(form.lrn);
    if (!parsedIdentifier) {
      setStatus("Registration failed: Please enter a valid LRN or Gmail address.");
      return;
    }

    if (authRole === "teacher" && parsedIdentifier.lrn !== null) {
      setStatus("Registration failed: Teacher accounts must use a valid Gmail or email address.");
      return;
    }

    setIsLoading(true);

    let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"] | null = null;
    let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"] | null = null;

    try {
      const response = await supabase.auth.signUp({
        email: parsedIdentifier.email,
        password: form.password,
        options: {
          emailRedirectTo: getAppOrigin(),
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            lrn: parsedIdentifier.lrn,
            role: authRole,
          },
        },
      });

      data = response.data;
      error = response.error;
    } catch (caughtError) {
      setStatus(`Registration failed: ${getErrorMessage(caughtError)}`);
      setIsLoading(false);
      return;
    }

    if (error) {
      setStatus(`Registration failed: ${error.message}`);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        const role = await ensureUserBootstrap(data.user, authRole, {
          firstName: form.firstName,
          lastName: form.lastName,
        });

        if (role === "teacher") {
          setStatus("Teacher registration complete. Opening teacher dashboard...");
          window.location.assign("/teacher");
          setIsLoading(false);
          return;
        }

        await supabase.from("player_profiles").upsert({
          user_id: data.user.id,
          first_name: form.firstName,
          last_name: form.lastName,
          lrn: parsedIdentifier.lrn,
          onboarding_complete: false,
        });
      }
    }

    setStatus("Registration complete. You can now log in with LRN or Gmail + password.");
    setAuthMode("login");
    setForm((previous) => ({ ...previous, password: "" }));
    setIsLoading(false);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    if (!form.lrn || !form.password) {
      setStatus("Enter your LRN or Gmail and password.");
      return;
    }

    const parsedIdentifier = resolveAuthIdentifier(form.lrn);
    if (!parsedIdentifier) {
      setStatus("Login failed: Please enter a valid LRN or Gmail address.");
      return;
    }

    if (authRole === "teacher" && parsedIdentifier.lrn !== null) {
      setStatus("Login failed: Teacher accounts must use a valid Gmail or email address.");
      return;
    }

    setIsLoading(true);

    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null = null;

    try {
      const response = await supabase.auth.signInWithPassword({
        email: parsedIdentifier.email,
        password: form.password,
      });

      data = response.data;
      error = response.error;
    } catch (caughtError) {
      setStatus(`Login failed: ${getErrorMessage(caughtError)}`);
      setIsLoading(false);
      return;
    }

    if (error || !data.user) {
      setStatus(`Login failed: ${error?.message ?? "No user returned"}`);
      setIsLoading(false);
      return;
    }

    if (data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    await handleSignedInUser(data.user, authRole);
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    setIsLoading(true);

    let error: Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>["error"] | null = null;

    try {
      const response = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAppOrigin(),
        },
      });

      error = response.error;
    } catch (caughtError) {
      setStatus(`Google sign in failed: ${getErrorMessage(caughtError)}`);
      setIsLoading(false);
      return;
    }

    if (error) {
      setStatus(`Google sign in failed: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleProfileConfirm = async () => {
    if (!supabase || !user || !selectedProfileIcon) {
      setStatus("Please select a profile icon first.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("player_profiles")
      .update({ profile_icon: selectedProfileIcon, onboarding_complete: true })
      .eq("user_id", user.id);

    if (error) {
      setStatus(`Could not save profile icon: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setProfile((previous) =>
      previous
        ? {
            ...previous,
            profile_icon: selectedProfileIcon,
            onboarding_complete: true,
          }
        : previous,
    );
    setStage("home");
    setStatus("Profile saved. Welcome to SolveAd!");
    setIsLoading(false);
  };

  const isGoogleUser = user?.app_metadata?.provider === "google";

  const handleSaveLrn = async () => {
    if (!supabase || !user) {
      return;
    }

    const trimmed = lrnInput.trim();
    if (!trimmed) {
      setStatus(getCopy(preferences.language).enterLrn);
      return;
    }

    setIsSavingLrn(true);

    const { data, error } = await supabase
      .from("player_profiles")
      .update({ lrn: trimmed })
      .eq("user_id", user.id)
      .select("first_name, last_name, lrn, profile_icon, onboarding_complete")
      .single();

    if (error) {
      const copy = getCopy(preferences.language);
      const isDuplicate =
        error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message);
      setStatus(isDuplicate ? copy.lrnAlreadyTaken : `Could not save LRN: ${error.message}`);
      setIsSavingLrn(false);
      return;
    }

    if (data) {
      setProfile(data as PlayerProfile);
    }
    setLrnInput("");
    setStatus(getCopy(preferences.language).lrnSaved);
    setIsSavingLrn(false);
  };

  const handleGenderSelect = (gender: ProfileGender) => {
    playClickSound();
    setSelectedGender(gender);
    setSelectedProfileIcon(null);
    setStage("profile");
    setStatus("Select your profile icon to continue.");
  };

  const handleRoleConfirm = async () => {
    if (!supabase || !user) {
      setStatus("Please sign in again to choose a role.");
      return;
    }

    setIsLoading(true);

    const role = await ensureUserBootstrap(
      user,
      pendingRole,
      pendingRole === "teacher" ? extractTeacherProfile(user) ?? undefined : undefined,
    );

    if (!role) {
      setStatus("Please choose a role to continue.");
      setIsLoading(false);
      return;
    }

    if (role === "teacher") {
      setStatus("Teacher role saved. Opening teacher dashboard...");
      setIsLoading(false);
      window.location.assign("/teacher");
      return;
    }

    setStatus("Student role saved. Loading your profile...");
    await handleSignedInUser(user);
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setStage("auth");
    setUser(null);
    setProfile(null);
    setSelectedProfileIcon(null);
    setSelectedGender(null);
    setLevelProgress(new Map());
    setPendingRole("student");
    setLeaderboardRows([]);
    setLeaderboardError(null);
    setLeaderboardFetched(false);
    setStatus("Signed out.");
  };

  const savePreferences = async (nextPreferences: UserPreferences) => {
    if (!supabase || !user) {
      setPreferences(nextPreferences);
      return;
    }

    setPreferences(nextPreferences);

    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...nextPreferences }, { onConflict: "user_id" });

    if (error) {
      setStatus(`Could not save settings: ${error.message}`);
      return;
    }

    setStatus(getCopy(nextPreferences.language).statusSettingsSaved);
  };

  const savePreferencesDebounced = (nextPreferences: UserPreferences) => {
    setPreferences(nextPreferences);

    if (sliderSaveTimer.current) {
      clearTimeout(sliderSaveTimer.current);
    }

    sliderSaveTimer.current = setTimeout(() => {
      void savePreferences(nextPreferences);
    }, 250);
  };

  const onLevelClick = (level: number) => {
    playClickSound();
    setActiveLevel(level);
    setStatus(`Opening Button ${level}...`);
    router.push(`/student/levels/${level}`);
  };

  const authBackgroundStyle = {
    backgroundImage: "url('/assets/backgrounds/auth-bg.jpeg')",
  };

  const homeBackgroundStyle = {
    backgroundImage: preferences.dark_mode
      ? "url('/assets/backgrounds/background-5.png')"
      : "url('/assets/backgrounds/home-map.jpeg')",
  };

  const baseFontSizeClass = getBaseFontSizeClass(preferences.font_size);

  const brightnessMultiplier = getBrightnessMultiplier(preferences.brightness_level);
  const isVolumeMuted = preferences.volume_level <= 0;
  const isSfxMuted = preferences.sfx_level <= 0;
  const copy = getCopy(preferences.language);
  const levelButtonSizeClass = isMobileViewport
    ? "h-[clamp(56px,9vw,92px)] w-[clamp(56px,9vw,92px)]"
    : "h-[clamp(80px,10.8vw,140px)] w-[clamp(80px,10.8vw,140px)]";

  const renderRotateNotice = () => (
    <div className="relative min-h-screen overflow-hidden bg-[#d9a55d]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ ...homeBackgroundStyle, filter: `brightness(${brightnessMultiplier})` }} />
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative flex min-h-screen items-center justify-center p-6 text-center">
        <div className="panel-card w-full max-w-sm px-6 py-7">
          <h2 className="ribbon-title text-2xl text-[#553819]">Rotate your phone</h2>
          <p className="mt-2 text-sm font-semibold text-[#5f4324]">SolveAd is available on phones in landscape mode only.</p>
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="relative min-h-screen bg-cover bg-center p-4 sm:p-8" style={authBackgroundStyle}>
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6">
        <div className="panel-card w-full max-w-md p-6 sm:p-7">
          <h2 className="ribbon-title text-center text-2xl text-[#553819]">{authMode === "register" ? "Create Account" : "Login"}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-full bg-[#f3e2b9]/70 p-1">
            <button
              type="button"
              onClick={() => setAuthRole("student")}
              className={`rounded-full px-3 py-2 text-xs font-black uppercase ${
                authRole === "student" ? "bg-[#d68c25] text-white" : "bg-[#fff5dd] text-[#5f4220]"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setAuthRole("teacher")}
              className={`rounded-full px-3 py-2 text-xs font-black uppercase ${
                authRole === "teacher" ? "bg-[#d68c25] text-white" : "bg-[#fff5dd] text-[#5f4220]"
              }`}
            >
              Teacher
            </button>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-[#5f4324]">
            {authRole === "teacher"
              ? "Use Gmail with password, or continue with Gmail OAuth."
              : "Use LRN or Gmail with password, or continue with Gmail OAuth."}
          </p>

          <form className="mt-5 space-y-3" onSubmit={authMode === "register" ? handleRegister : handleLogin}>
            {authMode === "register" && (
              <>
                <input
                  type="text"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
                  className="w-full rounded-xl border border-[#9a6f38]/45 bg-[#fff8e7] px-3 py-2 text-sm font-semibold text-[#5f4220] outline-none"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
                  className="w-full rounded-xl border border-[#9a6f38]/45 bg-[#fff8e7] px-3 py-2 text-sm font-semibold text-[#5f4220] outline-none"
                />
              </>
            )}

            <input
              type="text"
              placeholder={authRole === "teacher" ? "Gmail address" : "LRN or Gmail"}
              value={form.lrn}
              onChange={(event) => setForm((previous) => ({ ...previous, lrn: event.target.value }))}
              className="w-full rounded-xl border border-[#9a6f38]/45 bg-[#fff8e7] px-3 py-2 text-sm font-semibold text-[#5f4220] outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              className="w-full rounded-xl border border-[#9a6f38]/45 bg-[#fff8e7] px-3 py-2 text-sm font-semibold text-[#5f4220] outline-none"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="control-button w-full rounded-xl px-4 py-2 text-sm font-black tracking-wide text-[#573914]"
            >
              {isLoading ? "Please wait..." : authMode === "register" ? "Register" : "Login"}
            </button>
          </form>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="mt-3 w-full rounded-xl bg-[#de8b2a] px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-[#cb7b1d] disabled:opacity-70"
          >
            Continue with Gmail
          </button>

          <button
            type="button"
            onClick={() => setAuthMode((previous) => (previous === "login" ? "register" : "login"))}
            className="mt-3 w-full text-xs font-black uppercase tracking-wide text-[#7d5325] underline-offset-2 hover:underline"
          >
            {authMode === "register" ? "Already have an account? Login" : "Need an account? Register"}
          </button>
        </div>

        <p className="mx-auto max-w-2xl rounded-lg bg-[#fdf2d8]/95 px-4 py-2 text-center text-sm font-bold text-[#5d401f] shadow">
          {status}
        </p>
      </div>
    </div>
  );

  const renderRoleSelection = () => (
    <div className="relative min-h-screen bg-cover bg-center p-4 sm:p-8" style={authBackgroundStyle}>
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6">
        <div className="panel-card w-full max-w-md p-6 sm:p-7">
          <h2 className="ribbon-title text-center text-2xl text-[#553819]">Choose Account Role</h2>
          <p className="mt-2 text-center text-sm font-semibold text-[#5f4324]">
            We could not detect your role. Select the portal you want to open.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPendingRole("student")}
              className={`rounded-xl border-2 px-3 py-4 text-sm font-black uppercase transition ${
                pendingRole === "student"
                  ? "border-[#d88e2a] bg-[#fff1d2] text-[#5a3818]"
                  : "border-[#a27a42]/45 bg-[#fff8e2]/85 text-[#5b3c1a]"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setPendingRole("teacher")}
              className={`rounded-xl border-2 px-3 py-4 text-sm font-black uppercase transition ${
                pendingRole === "teacher"
                  ? "border-[#d88e2a] bg-[#fff1d2] text-[#5a3818]"
                  : "border-[#a27a42]/45 bg-[#fff8e2]/85 text-[#5b3c1a]"
              }`}
            >
              Teacher
            </button>
          </div>

          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="control-button rounded-full px-6 py-2 text-sm font-extrabold text-[#5e3d19]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRoleConfirm}
              disabled={isLoading}
              className="rounded-full bg-[#d88e2a] px-6 py-2 text-sm font-extrabold text-white shadow hover:bg-[#c57b18] disabled:opacity-70"
            >
              {isLoading ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-[#fdf2d8]/95 px-4 py-2 text-sm font-bold text-[#5d401f] shadow">
          {status}
        </p>
      </div>
    </div>
  );

  const renderGenderSelection = () => (
    <div className="relative min-h-screen bg-cover bg-center p-4 sm:p-8" style={authBackgroundStyle}>
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6">
        <div className="panel-card w-full max-w-xl p-5 sm:p-7">
          <h2 className="ribbon-title text-center text-2xl text-[#4e3514]">Choose Avatar Style</h2>
          <p className="mt-2 text-center text-sm font-semibold text-[#5c3e1f]">
            First login detected. Select male or female to continue.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4">
            {(["male", "female"] as const).map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => handleGenderSelect(gender)}
                className="group rounded-2xl border-2 border-[#a27a42]/45 bg-[#fff8e2]/85 p-4 transition hover:border-[#d89a49]"
              >
                <Image
                  src={GENDER_BUTTONS[gender]}
                  alt={`${gender} button`}
                  width={180}
                  height={180}
                  className="h-auto w-full"
                />
                <span className="mt-3 block text-sm font-black uppercase tracking-wide text-[#5b3c1a]">
                  {gender}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="control-button rounded-full px-5 py-2 text-sm font-extrabold text-[#5e3d19]"
            >
              Cancel
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-[#fdf1d5]/95 px-4 py-2 text-sm font-bold text-[#5f4220] shadow">{status}</p>
      </div>
    </div>
  );

  const renderProfileSelection = () => (
    <div className="relative min-h-screen bg-cover bg-center p-4 sm:p-8" style={authBackgroundStyle}>
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6">
        <div className="panel-card w-full max-w-xl p-5 sm:p-7">
          <h2 className="ribbon-title text-center text-2xl text-[#4e3514]">Select Profile Icon</h2>
          <p className="mt-2 text-center text-sm font-semibold text-[#5c3e1f]">
            First login detected. Choose your profile to personalize SolveAd.
          </p>

          <div className="mt-4 grid grid-cols-5 gap-3">
            {filteredProfileIcons.map((icon) => {
              const isSelected = selectedProfileIcon === icon.src;
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setSelectedProfileIcon(icon.src);
                  }}
                  className={`rounded-xl border-2 p-1 transition ${
                    isSelected
                      ? "border-[#f09f2d] bg-[#fff2d5] shadow-[0_0_0_2px_rgba(255,179,67,0.5)]"
                      : "border-[#a27a42]/45 bg-[#fff8e2]/85 hover:border-[#d89a49]"
                  }`}
                >
                  <Image src={icon.src} alt={`Profile ${icon.id}`} width={60} height={60} className="h-auto w-full" />
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="control-button rounded-full px-5 py-2 text-sm font-extrabold text-[#5e3d19]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedProfileIcon) {
                  setStatus("Pick one profile icon before pressing OK.");
                  return;
                }
                setStage("confirm");
              }}
              className="rounded-full bg-[#d88e2a] px-6 py-2 text-sm font-extrabold text-white shadow hover:bg-[#c57b18]"
            >
              OK
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-[#fdf1d5]/95 px-4 py-2 text-sm font-bold text-[#5f4220] shadow">{status}</p>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="relative min-h-screen bg-cover bg-center p-4 sm:p-8" style={authBackgroundStyle}>
      <div className="solvead-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6">
        <div className="panel-card w-full max-w-md p-7 text-center">
          <h2 className="ribbon-title text-2xl text-[#553819]">Do you want to proceed?</h2>
          <p className="mt-2 text-sm font-semibold text-[#5f4324]">This will save your selected profile and open the homepage.</p>

          {selectedProfileIcon && (
            <div className="mx-auto mt-4 w-fit rounded-xl border border-[#9e7640]/55 bg-[#fff8e4] p-2">
              <Image src={selectedProfileIcon} alt="Selected profile icon" width={84} height={84} className="h-auto w-[84px]" />
            </div>
          )}

          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              className="control-button rounded-full px-7 py-2 text-sm font-black text-[#634420]"
              onClick={() => setStage("profile")}
            >
              NO
            </button>
            <button
              type="button"
              className="rounded-full bg-[#d98a24] px-7 py-2 text-sm font-black text-white shadow hover:bg-[#c47512]"
              disabled={isLoading}
              onClick={handleProfileConfirm}
            >
              {isLoading ? "Saving..." : "YES"}
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-[#fdf1d5]/95 px-4 py-2 text-sm font-bold text-[#5f4220] shadow">{status}</p>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className={`relative h-[100dvh] overflow-hidden bg-[#d9a55d] ${baseFontSizeClass}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ ...homeBackgroundStyle, filter: `brightness(${brightnessMultiplier})` }}
      />
      <div className="solvead-overlay absolute inset-0" />

      <div
        className="absolute inset-0"
        style={isMobileViewport ? {
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        } : undefined}
      >
        {unlockedCelebration ? (
        <div
          className="pointer-events-none absolute left-1/2 top-6 z-40 -translate-x-1/2 rounded-full border-2 border-amber-300 bg-emerald-500/95 px-5 py-2 text-sm font-black text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          Level {unlockedCelebration.level} is now unlocked!
        </div>
      ) : null}

      <div className="absolute inset-0 z-10">
        {LEVEL_POSITIONS.map((position) => {
          const progress = levelProgress.get(position.level);
          const completed = progress?.completed ?? false;
          const isUnlocked = progress?.unlocked ?? position.level === 1;
          const isApproved = progress?.approval_status !== "pending" && progress?.approval_status !== "denied";
          const unlocked = completed || (isUnlocked && isApproved);
          const pendingApproval = progress?.approval_status === "pending";
          const denied = progress?.approval_status === "denied";

          return (
            <button
              key={position.level}
              type="button"
              style={{ left: position.left, top: position.top }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ${
                unlocked ? (activeLevel === position.level ? "scale-95" : "hover:scale-115 active:scale-95") : "cursor-not-allowed opacity-70"
              }`}
              disabled={!unlocked}
              onClick={() => {
                if (!unlocked) {
                  if (pendingApproval) {
                    setStatus(`Level ${position.level} is awaiting teacher approval.`);
                    return;
                  }
                  if (denied) {
                    setStatus(`Level ${position.level} access was denied. Contact your teacher.`);
                    return;
                  }
                  setStatus(`Level ${position.level} is locked. Finish the required activities to unlock it.`);
                  return;
                }

                onLevelClick(position.level);
              }}
            >
              <Image
                src={`/assets/level-buttons/level-${position.level}.png`}
                alt={`Level ${position.level}`}
                width={70}
                height={70}
                className={`${levelButtonSizeClass} drop-shadow-[0_7px_10px_rgba(39,16,4,0.48)] transition-all duration-150 group-hover:scale-105 ${
                  unlocked ? "group-hover:drop-shadow-[0_12px_20px_rgba(255,180,50,0.5)] group-hover:brightness-110" : "grayscale"
                }`}
              />
<span className="pointer-events-none absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3d220f]/82 px-1.5 py-0.5 text-[10px] font-extrabold text-[#fdeecf] opacity-0 transition-opacity group-hover:opacity-100">
                {position.level}
              </span>
            </button>
          );
        })}
      </div>
      </div>

      <div className="pointer-events-none absolute inset-x-2 top-[7.5rem] z-20 flex flex-wrap items-start gap-2 sm:inset-x-4 sm:top-[8rem] sm:gap-3">
        <div className="pointer-events-auto origin-top-left scale-[0.68] flex flex-col gap-2 sm:scale-[0.75] sm:gap-3">
          {/* Old top-left profile card removed in favor of ProfileButton component */}

          {leaderboardExpanded ? (
            <div className="panel-card w-full min-w-[180px] rounded-2xl border-[#8a6330]/45 bg-[#f4e1b6]/95 px-2.5 py-2 shadow-[0_10px_18px_rgba(53,29,7,0.3)] sm:min-w-[280px] sm:px-4 sm:py-3">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setLeaderboardExpanded(false);
                }}
                className="flex w-full items-center justify-between gap-2"
              >
                <h3 className="ribbon-title text-sm text-[#5a3818] sm:text-base">{copy.leaderboards}</h3>
                <span className="text-[#5a3818]">✕</span>
              </button>
              {isMobileViewport ? null : (
                <div className="mt-2 overflow-hidden rounded-xl border border-[#8d6131]/40 bg-[#d9a55f] px-3 py-2">
                <div className="mb-2 flex items-center gap-2">
                  <Image src="/assets/misc-buttons/Trophy Button.png" alt="Top players" width={22} height={22} className="h-5 w-5 object-contain" />
                  <p className="text-sm font-black text-[#5a3818] sm:text-base">{copy.topPlayers}</p>
                </div>
                {leaderboardLoading ? (
                  <p className="text-sm font-semibold text-[#6b4827]">Loading...</p>
                ) : leaderboardError ? (
                  <p className="text-sm font-semibold text-[#6b4827]">{leaderboardError}</p>
                ) : leaderboardRows.length === 0 ? (
                  <p className="text-sm font-semibold text-[#6b4827]">No players yet.</p>
                ) : (
                  <div className="space-y-1">
                    {leaderboardRows.slice(0, 10).map((row) => {
                      const medalSrc = LEADERBOARD_MEDALS[row.rank];

                      return (
                        <div
                          key={row.student_id}
                          className="flex items-center justify-between rounded-lg bg-[#f3d29f]/70 px-2 py-1.5 text-sm font-bold text-[#5a3818] sm:text-base"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {medalSrc ? (
                              <Image
                                src={medalSrc}
                                alt={`Medal ${row.rank}`}
                                width={24}
                                height={24}
                                className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                              />
                            ) : (
                              <span className="font-black">#{row.rank}</span>
                            )}
                            <span className="truncate">{row.student_name}</span>
                          </div>
                          <span className="shrink-0">{row.total_points} pts</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setLeaderboardExpanded(true);
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_16px_rgba(53,29,7,0.3)] transition-transform hover:scale-110 active:scale-95 sm:h-20 sm:w-20"
            >
              <Image
                src="/assets/misc-buttons/Leaderboards Button.png"
                alt="Leaderboards"
                width={64}
                height={64}
                className="h-full w-full object-contain"
              />
            </button>
          )}
        </div>

        {isMobileViewport && leaderboardExpanded && (
          <div className="pointer-events-auto absolute left-2 top-[7.5rem] z-30 w-[min(86vw,320px)] rounded-2xl border border-[#8d6131]/45 bg-[#f4e1b6]/98 px-3 py-3 shadow-[0_16px_28px_rgba(53,29,7,0.35)] sm:left-4 sm:top-[8rem] sm:w-[min(80vw,360px)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Image src="/assets/misc-buttons/Trophy Button.png" alt="Top players" width={22} height={22} className="h-5 w-5 object-contain" />
                <p className="text-sm font-black text-[#5a3818] sm:text-base">{copy.topPlayers}</p>
              </div>
              <button
                type="button"
                onClick={() => setLeaderboardExpanded(false)}
                className="rounded-full bg-[#e8c07e] px-2 py-1 text-[11px] font-black text-[#5a3818] shadow"
              >
                Close
              </button>
            </div>

            {leaderboardLoading ? (
              <p className="text-sm font-semibold text-[#6b4827]">Loading...</p>
            ) : leaderboardError ? (
              <p className="text-sm font-semibold text-[#6b4827]">{leaderboardError}</p>
            ) : leaderboardRows.length === 0 ? (
              <p className="text-sm font-semibold text-[#6b4827]">No players yet.</p>
            ) : (
              <div className="max-h-[48vh] space-y-1 overflow-auto pr-1">
                {leaderboardRows.slice(0, 10).map((row) => {
                  const medalSrc = LEADERBOARD_MEDALS[row.rank];

                  return (
                    <div
                      key={row.student_id}
                      className="flex items-center justify-between rounded-lg bg-[#f3d29f]/70 px-2 py-1.5 text-sm font-bold text-[#5a3818]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {medalSrc ? (
                          <Image
                            src={medalSrc}
                            alt={`Medal ${row.rank}`}
                            width={24}
                            height={24}
                            className="h-5 w-5 object-contain"
                          />
                        ) : (
                          <span className="font-black">#{row.rank}</span>
                        )}
                        <span className="truncate">{row.student_name}</span>
                      </div>
                      <span className="shrink-0">{row.total_points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-auto fixed right-2 top-2 z-30 flex items-center gap-1.5 sm:right-4 sm:top-4 sm:gap-3">
          <button
            type="button"
            aria-pressed={!isVolumeMuted}
            aria-label={`${copy.volume}: ${isVolumeMuted ? "Off" : "On"}`}
            onClick={() => {
              playClickSound();
              const restoreVolume = lastVolumeRef.current > 0
                ? lastVolumeRef.current
                : DEFAULT_PREFERENCES.volume_level;
              const nextVolume = isVolumeMuted ? restoreVolume : 0;
              const next = {
                ...preferences,
                volume_level: nextVolume,
              };
              savePreferencesDebounced(next);
              syncBackgroundAudio(next);
            }}
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none transition hover:scale-105 sm:h-14 sm:w-14"
          >
            <Image
              src="/assets/misc-buttons/Volume Button.png"
              alt={copy.volume}
              width={56}
              height={56}
              className={`h-full w-full object-contain ${isVolumeMuted ? "grayscale opacity-60" : ""}`}
            />
          </button>

          <button
            type="button"
            aria-pressed={!isSfxMuted}
            aria-label={`${copy.soundEffects}: ${isSfxMuted ? "Off" : "On"}`}
            onClick={() => {
              playClickSound();
              const restoreSfx = lastSfxRef.current > 0
                ? lastSfxRef.current
                : DEFAULT_PREFERENCES.sfx_level;
              const nextSfx = isSfxMuted ? restoreSfx : 0;
              const next = {
                ...preferences,
                sfx_level: nextSfx,
              };
              savePreferencesDebounced(next);
              syncBackgroundAudio(next);
            }}
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none transition hover:scale-105 sm:h-14 sm:w-14"
          >
            <Image
              src="/assets/misc-buttons/Sound Effects Button.png"
              alt={copy.soundEffects}
              width={56}
              height={56}
              className={`h-full w-full object-contain ${isSfxMuted ? "grayscale opacity-60" : ""}`}
            />
          </button>

          <button
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none transition hover:scale-105 sm:h-14 sm:w-14"
            onClick={() => {
              playClickSound();
              setShowSettings((previous) => !previous);
              setShowHelp(false);
            }}
            aria-label="Open menu"
          >
            <Image
              src="/assets/misc-buttons/3%20Horizontal%20Lines%20Button.png"
              alt="Open menu"
              width={56}
              height={56}
              className="h-full w-full object-contain"
            />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center justify-between gap-2 sm:inset-x-4 sm:bottom-3">
        <p className="pointer-events-auto max-w-[72vw] truncate rounded-lg bg-[#f8edcf]/95 px-2.5 py-1.5 text-[11px] font-extrabold text-[#5f4220] shadow sm:px-3 sm:py-2 sm:text-xs">{status}</p>
        <button type="button" onClick={handleSignOut} className="pointer-events-auto control-button rounded-full px-3 py-1.5 text-[11px] font-black text-[#5f3f1f] sm:px-4 sm:py-2 sm:text-xs">
          Sign out
        </button>
      </div>

      {showSettings && (
        <div
          className="panel-card absolute right-4 top-20 z-20 w-[min(94vw,480px)] overflow-hidden border-2 border-[#9e7640]/60 bg-[#e6b17a] p-0 shadow-[0_20px_36px_rgba(77,44,18,0.3)]"
          style={isMobileViewport ? { transform: `scale(${scale})`, transformOrigin: "top right" } : undefined}
        >
          <div className="bg-gradient-to-b from-[#f2c68a] via-[#e6b17a] to-[#dca86c] px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="ribbon-title text-2xl text-[#5a3818]">{copy.settings}</h3>
            </div>
            <div className="mt-3 h-px bg-[#c79459]/60" />

            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-[#8f5f2a]/70 bg-gradient-to-r from-[#f9e3b8] via-[#f3c97d] to-[#e2a85b] px-4 py-3 text-left shadow-[0_10px_18px_rgba(77,44,18,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(77,44,18,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d99c]"
                onClick={() => {
                  playClickSound();
                  setShowSettings(false);
                  setShowResearchersModal(true);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-black text-[#5a3818]">{copy.researchersProfile}</p>
                </div>
                <span className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#7c4f20]/60 bg-[#fbe8c3] text-base font-black text-[#6a4019] shadow-[0_4px_8px_rgba(77,44,18,0.2)]">&gt;</span>
              </button>

              {isGoogleUser && !profile?.lrn ? (
                <div className="rounded-2xl border border-[#a77842]/40 bg-[#f8e3bb]/70 px-4 py-3 shadow-[0_5px_12px_rgba(77,44,18,0.16)]">
                  <p className="text-base font-black text-[#5a3818]">{copy.lrn}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={lrnInput}
                      onChange={(event) => setLrnInput(event.target.value)}
                      placeholder={copy.enterLrn}
                      disabled={isSavingLrn}
                      className="flex-1 rounded-xl border border-[#cda06c]/50 bg-[#fff3d8] px-3 py-2 text-sm font-bold text-[#4c3112] placeholder:text-[#8a6a3f]/60 focus:outline-none focus:ring-2 focus:ring-[#c48c4b]/40"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveLrn()}
                      disabled={isSavingLrn || !lrnInput.trim()}
                      className="rounded-xl border-2 border-[#8f5f2a]/70 bg-gradient-to-r from-[#f9e3b8] via-[#f3c97d] to-[#e2a85b] px-3 py-2 text-sm font-black text-[#5a3818] shadow-[0_4px_8px_rgba(77,44,18,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingLrn ? "..." : copy.saveLrn}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[#a77842]/40 bg-[#f8e3bb]/70 px-3 py-3 shadow-[0_5px_12px_rgba(77,44,18,0.16)]">
                <label className="flex w-full items-center gap-3 text-left">
                  <Image
                    src="/assets/misc-buttons/Brightness Button.png"
                    alt="Brightness"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain drop-shadow-[0_2px_4px_rgba(92,56,23,0.35)]"
                  />
                  <span className="w-28 text-base font-black text-[#5a3818]">{copy.brightness}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={preferences.brightness_level}
                    onChange={(event) => {
                      const next = { ...preferences, brightness_level: Number(event.target.value) };
                      savePreferencesDebounced(next);
                    }}
                    className="h-2.5 flex-1 cursor-pointer accent-[#a86f34]"
                  />
                </label>
              </div>

              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-[#a77842]/40 bg-[#f5dbab]/70 px-3 py-3 text-left shadow-[0_5px_12px_rgba(77,44,18,0.14)] transition hover:opacity-95"
                onClick={() => {
                  playClickSound();
                  setShowHelp(true);
                  setShowSettings(false);
                }}
              >
                <Image
                  src="/assets/misc-buttons/Trophy Button.png"
                  alt="Help"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain drop-shadow-[0_2px_4px_rgba(92,56,23,0.35)]"
                />
                <span className="w-28 text-base font-black text-[#5a3818]">{copy.helpInfo}</span>
              </button>

              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-2xl border border-[#a77842]/40 bg-[#f5dbab]/70 px-3 py-3 text-left shadow-[0_5px_12px_rgba(77,44,18,0.14)] transition hover:opacity-95"
                onClick={() => {
                  playClickSound();
                  setShowAboutGame(true);
                  setShowSettings(false);
                }}
              >
                <Image
                  src="/assets/misc-buttons/Trophy Button.png"
                  alt="About the Game"
                  width={44}
                  height={44}
                  className="mt-0.5 h-11 w-11 object-contain drop-shadow-[0_2px_4px_rgba(92,56,23,0.35)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black text-[#5a3818]">{copy.aboutTheGame}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#6c4828]">{copy.aboutText}</p>
                </div>
              </button>

            </div>

            <div className="mt-5 rounded-2xl border border-[#a77842]/40 bg-[#f8e8c6]/70 px-4 py-4 shadow-[0_5px_12px_rgba(77,44,18,0.12)]">
              <label className="block text-sm font-black text-[#5e401f]">
                {copy.language}
                <select
                  className="mt-2 w-full rounded-xl border border-[#cda06c]/50 bg-[#fff3d8] px-3 py-2.5 text-sm font-bold text-[#4c3112] focus:outline-none focus:ring-2 focus:ring-[#c48c4b]/40"
                  value={preferences.language}
                  onChange={(event) => void savePreferences({ ...preferences, language: event.target.value as UserPreferences["language"] })}
                >
                  <option>English</option>
                  <option>Filipino</option>
                </select>
              </label>

              <label className="mt-4 flex items-center justify-between rounded-xl border border-[#cda06c]/50 bg-[#fff3d8] px-3 py-2.5 text-sm font-black text-[#5f4220]">
                {copy.darkMode}
                <input
                  type="checkbox"
                  checked={preferences.dark_mode}
                  onChange={(event) => void savePreferences({ ...preferences, dark_mode: event.target.checked })}
                  className="h-4 w-4 accent-[#a86f34]"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div
          className="panel-card absolute right-4 top-20 z-20 w-[min(92vw,360px)] p-4"
          style={isMobileViewport ? { transform: `scale(${scale})`, transformOrigin: "top right" } : undefined}
        >
          <h3 className="ribbon-title text-lg text-[#543617]">{copy.helpInfo}</h3>
          <div className="mt-3 space-y-3 text-xs font-semibold text-[#5f4426]">
            <div>
              <p className="font-black text-[#4f3415]">{copy.howToUse}</p>
              <p>Login, choose male or female, pick a profile icon if first-time, and click map levels to start activities.</p>
            </div>
            <div>
              <p className="font-black text-[#4f3415]">{copy.gameMechanics}</p>
              <p>Each numbered map icon is a level. Hover to preview and click to open the level activity.</p>
            </div>
            <div>
              <p className="font-black text-[#4f3415]">{copy.loginGuide}</p>
              <p>Use Gmail for OAuth login, or register using first name, last name, LRN, and password.</p>
            </div>
          </div>
        </div>
      )}

      {showResearchersModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowResearchersModal(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl border-4 border-[#c9a670] bg-gradient-to-b from-[#f7e9c8] via-[#e7c98e] to-[#d7a95f] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Researchers profile"
          >
            <button
              type="button"
              onClick={() => setShowResearchersModal(false)}
              className="absolute right-4 top-4 rounded-full bg-[#f7e2b7] w-10 h-10 flex items-center justify-center text-[#5a3818] font-bold text-lg shadow hover:bg-[#f1d5a0] transition"
              aria-label="Close profile modal"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h2 className="ribbon-title text-2xl text-[#533414]">RESEARCH TEAM</h2>
              <p className="mt-1 text-sm font-semibold text-[#6b4827]">Meet the minds behind SOLVEAD</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {RESEARCHER_PROFILES.map((researcher) => (
                <article
                  key={researcher.id}
                  className="bg-white/70 rounded-xl border-2 border-[#b3894d] p-4 text-center hover:scale-105 transition-transform"
                >
                  <Image
                    src={researcher.image}
                    alt={researcher.name}
                    width={120}
                    height={120}
                    className="mx-auto h-24 w-24 rounded-full border-4 border-[#e6c78a] object-cover shadow-lg"
                  />
                  <p className="mt-3 text-base font-black text-[#5b3717]">{researcher.name}</p>
                  <p className="text-sm font-semibold text-[#6c4827]">{researcher.role}</p>
                  <p className="mt-1 text-xs font-medium text-[#8a6a3d]">{researcher.school}</p>
                  <p className="mt-3 text-xs font-semibold text-[#5a3d16] leading-relaxed">{researcher.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAboutGame && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          onClick={() => setShowAboutGame(false)}
          role="presentation"
        >
          <div
            className="relative w-[90vw] max-w-4xl rounded-2xl border-4 border-[#c9a670] bg-gradient-to-b from-[#f7e9c8] via-[#e7c98e] to-[#d7a95f] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="About the Game"
          >
            <button
              type="button"
              onClick={() => setShowAboutGame(false)}
              className="absolute right-3 top-3 rounded-full bg-[#f7e2b7] w-8 h-8 flex items-center justify-center text-[#5a3818] font-bold shadow hover:bg-[#f1d5a0] transition"
              aria-label="Close about modal"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h2 className="ribbon-title text-2xl text-[#533414]">ABOUT THE GAME</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 rounded-xl border-2 border-[#b3894d] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📐</span>
                  <h3 className="ribbon-title text-lg text-[#4f3313]">Game Overview</h3>
                </div>
                <p className="text-sm font-semibold text-[#5a3d16] leading-relaxed">
                  SOLVEAD is a Peace-Embedded Gamified Learning Tool (PEGLT) developed to facilitate the acquisition of Grade 9 first-quarter Geometry competencies through a structured, interactive, and mastery-driven digital environment. The game comprises fifteen progressively sequenced levels, each integrating discussion, guided activities, and assessment components to ensure coherent knowledge construction and skill reinforcement. Advancement is contingent upon demonstrated mastery.
                </p>
              </div>

              <div className="bg-white/60 rounded-xl border-2 border-[#b3894d] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">💡</span>
                  <h3 className="ribbon-title text-lg text-[#4f3313]">Objectives</h3>
                </div>
                <p className="text-sm font-semibold text-[#5a3d16] leading-relaxed">
                  The primary objective of SOLVEAD is to holistically develop learners by integrating cognitive and socio-emotional dimensions of learning. It aims to deepen students' conceptual understanding of Geometry while cultivating peace awareness, including conflict prevention, resolution, and mediation skills.
                </p>
              </div>

              <div className="bg-white/60 rounded-xl border-2 border-[#b3894d] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📊</span>
                  <h3 className="ribbon-title text-lg text-[#4f3313]">Game Structure</h3>
                </div>
                <p className="text-sm font-semibold text-[#5a3d16] leading-relaxed">
                  SOLVEAD uses a level-based progression system with fifteen stages, each with conceptual discussion, interactive application, and formative assessment. Gamification elements, rewards, point systems, and immediate feedback enhance motivation and support learner autonomy.
                </p>
              </div>

              <div className="bg-white/60 rounded-xl border-2 border-[#b3894d] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🕊️</span>
                  <h3 className="ribbon-title text-lg text-[#4f3313]">Peace Education</h3>
                </div>
                <p className="text-sm font-semibold text-[#5a3d16] leading-relaxed">
                  Aligned with UNESCO IBE framework, SOLVEAD integrates peace education principles through scenario-based narratives that emphasize conflict prevention, resolution, and mediation skills, fostering a respectful and collaborative learning environment.
                </p>
              </div>
            </div>

            <div className="mt-4 text-center text-xs font-semibold text-[#6b4a22]">
              Version {new Date().getFullYear()} Taikun. All rights reserved.
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} src={CLICK_SOUND_SRC} preload="auto" />
    </div>
  );

  if (isMobilePortrait) {
    return renderRotateNotice();
  }

  if (stage === "profile") {
    return renderProfileSelection();
  }

  if (stage === "role") {
    return renderRoleSelection();
  }

  if (stage === "gender") {
    return renderGenderSelection();
  }

  if (stage === "confirm") {
    return renderConfirmation();
  }

  if (stage === "home") {
    return renderHome();
  }

  return renderAuth();
}

