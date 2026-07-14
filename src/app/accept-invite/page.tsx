import { Suspense } from "react";
import { AcceptInviteClient } from "@/components/AcceptInviteClient";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteClient />
    </Suspense>
  );
}
