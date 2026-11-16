import { BadgeCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { getRegion } from "@/lib/config/region";
import { requireVerified } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const { profile } = await requireVerified();
  if (profile.onboarded_at) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 pb-12">
      <div className="flex flex-col gap-3 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
        <p
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          data-testid="verified-college"
        >
          <BadgeCheck className="text-primary size-5 shrink-0" aria-hidden />
          Verified: {profile.college?.name}
        </p>
      </div>
      <OnboardingForm
        dialCode={getRegion().phoneDialCode}
        defaults={{ fullName: profile.full_name, gender: profile.gender, role: profile.role }}
      />
    </main>
  );
}
