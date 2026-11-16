import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({
  collegeShortName,
  isSuperAdmin,
}: {
  collegeShortName?: string;
  isSuperAdmin?: boolean;
}) {
  return (
    <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
        <Link href="/home" className="text-lg font-bold tracking-tight">
          CampusPool
          {collegeShortName ? (
            <span className="text-muted-foreground ml-2 text-sm font-medium">
              {collegeShortName}
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-1">
          {isSuperAdmin ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">
                <ShieldCheck aria-hidden />
                Admin
              </Link>
            </Button>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
