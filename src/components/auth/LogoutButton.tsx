"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        background: "rgba(255,255,255,0.12)",
        border: "none",
        borderRadius: 10,
        padding: "8px 14px",
        color: "#A7F3D0",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Log out
    </button>
  );
}
