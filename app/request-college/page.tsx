import Link from "next/link";

import { RequestCollegeForm } from "@/app/request-college/request-college-form";
import { emailSchema } from "@/lib/validation/auth";

export default async function RequestCollegePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: rawEmail } = await searchParams;
  const email = emailSchema.safeParse(rawEmail ?? "");
  const value = email.success ? email.data : undefined;
  const domain = value?.split("@")[1];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 pb-12">
      <div className="flex flex-col gap-2 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">Request your college</h1>
        <p className="text-muted-foreground">
          CampusPool only works with college email addresses. Tell us about your college and an
          admin will check it before adding it.
        </p>
      </div>
      <RequestCollegeForm email={value} domain={domain} />
      <Link href="/" className="text-muted-foreground text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </main>
  );
}
