import Link from "next/link";
import { redirect } from "next/navigation";

import { VerifyForm } from "@/app/verify/verify-form";
import { getPendingEmail } from "@/lib/auth/pending-email";

export default async function VerifyPage() {
  const email = await getPendingEmail();
  if (!email) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>. It
          expires in 10 minutes.
        </p>
        <p className="text-muted-foreground text-sm">
          Not there? Check your junk folder.{" "}
          <Link href="/" className="underline underline-offset-4">
            Use a different email
          </Link>
        </p>
      </div>
      <VerifyForm />
    </main>
  );
}
