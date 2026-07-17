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

  // Styled from globals.css alongside the other header buttons: it sits on navy
  // on a phone and on sky on a desktop, and a style attribute can't hold the
  // media query that tells those apart.
  return (
    <button onClick={handleLogout} className="dash-logout">
      Log out
    </button>
  );
}
