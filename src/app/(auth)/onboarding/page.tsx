import { redirect } from "next/navigation";
import { getOnboardingSession } from "@/lib/auth/session";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const session = await getOnboardingSession();

  if (!session) {
    redirect("/login");
  }

  return <OnboardingForm email={session.email} />;
}
