import { ArrowLeft, CalendarClock, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

type ShellSession = {
  profile: { college?: { short_name: string } | null };
  isSuperAdmin: boolean;
};

/** Header + page container used by every signed-in page. */
export function AppShell({
  session,
  title,
  back,
  children,
}: {
  session: ShellSession;
  title?: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="bg-background/95 sticky top-0 z-[1000] border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-1 px-4">
          <Link href="/home" className="text-lg font-bold tracking-tight">
            CampusPool
            {session.profile.college ? (
              <span className="text-muted-foreground ml-2 text-sm font-medium">
                {session.profile.college.short_name}
              </span>
            ) : null}
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            <Button asChild variant="ghost" size="sm">
              <Link href="/rides">
                <CalendarClock aria-hidden />
                My rides
              </Link>
            </Button>
            {session.isSuperAdmin ? (
              <Button asChild variant="ghost" size="icon" aria-label="Admin">
                <Link href="/admin">
                  <ShieldCheck aria-hidden />
                </Link>
              </Button>
            ) : null}
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut aria-hidden />
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-16">
        {title ? (
          <div className="flex items-center gap-2 pt-2">
            {back ? (
              <Button asChild variant="ghost" size="icon" aria-label="Back">
                <Link href={back}>
                  <ArrowLeft aria-hidden />
                </Link>
              </Button>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          </div>
        ) : null}
        {children}
      </main>
    </>
  );
}
