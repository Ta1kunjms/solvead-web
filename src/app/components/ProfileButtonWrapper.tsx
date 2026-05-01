"use client";

import dynamic from "next/dynamic";

const ProfileButton = dynamic(() => import("./ProfileButton"), { ssr: false });

export function ProfileButtonWrapper() {
  return <ProfileButton />;
}