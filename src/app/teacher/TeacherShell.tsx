"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  {
    href: "/teacher",
    label: "Overview",
    description: "Metrics, queues, and snapshots",
  },
  {
    href: "/teacher/student-management",
    label: "Student Management",
    description: "Rosters, progress, and enrollment",
  },
  {
    href: "/teacher/content",
    label: "Content Studio",
    description: "Lessons, activities, and publishing",
  },
  {
    href: "/teacher/reflections",
    label: "Reflections",
    description: "Review student responses",
  },
];

export function TeacherShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/teacher" ? pathname === href : pathname.startsWith(href));

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
  };

  return (
    <div className="teacher-shell">
      <div className="flex w-full flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="teacher-sidebar w-full lg:sticky lg:top-6 lg:w-[280px] lg:self-start">
          <div className="teacher-sidebar-scroll flex h-full flex-col gap-5 p-5">
            <div className="teacher-user-card">
              <div>
                <p className="teacher-eyebrow">Teacher Console</p>
                <h1 className="teacher-brand-title mt-1 text-lg">SolveAd Admin</h1>
                <p className="teacher-user-meta mt-1">
                  Manage classes, content publishing, and student feedback with a clear workflow.
                </p>
              </div>
            </div>

            <div>
              <input type="search" placeholder="Search" className="teacher-search" aria-label="Search teacher portal" />
            </div>

            <nav className="flex flex-col gap-2" aria-label="Teacher navigation">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} className="teacher-nav-link" aria-current={active ? "page" : undefined}>
                    <span className="teacher-nav-label">{item.label}</span>
                    <span className="teacher-nav-desc">{item.description}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
