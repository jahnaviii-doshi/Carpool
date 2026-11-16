import { SignInForm } from "@/app/sign-in-form";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">CampusPool</h1>
        <p className="text-muted-foreground text-lg">
          Share rides with verified students and staff from your own college.
        </p>
      </div>
      <SignInForm />
      <p className="text-muted-foreground text-sm">
        We&apos;ll email you a 6-digit code. Only college email addresses work. Personal addresses
        like Gmail or Outlook are not accepted.
      </p>
    </main>
  );
}
