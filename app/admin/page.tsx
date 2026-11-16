import { CircleCheck, Inbox } from "lucide-react";

import { RequestReview } from "@/app/admin/request-review";
import { AppHeader } from "@/components/app-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; rejected?: string }>;
}) {
  const { supabase, profile } = await requireSuperAdmin();
  const { approved, rejected } = await searchParams;

  const [requests, colleges] = await Promise.all([
    supabase
      .from("college_requests")
      .select("id, email, college_name, city, domains, website, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("colleges")
      .select("id, name, short_name, city, college_domains(domain)")
      .order("name"),
  ]);

  return (
    <>
      <AppHeader collegeShortName={profile.college?.short_name} isSuperAdmin />
      <main className="mx-auto flex max-w-md flex-col gap-8 p-4 pb-12">
        <h1 className="pt-2 text-2xl font-bold tracking-tight">Admin</h1>

        {approved || rejected ? (
          <Alert role="status">
            <CircleCheck aria-hidden />
            <AlertDescription>
              {approved ? `${approved} is now on CampusPool.` : "Request rejected."}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            College requests <Badge variant="secondary">{requests.data?.length ?? 0} pending</Badge>
          </h2>
          {requests.error ? (
            <p className="text-destructive">Could not load requests.</p>
          ) : requests.data.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <Inbox className="size-8" aria-hidden />
              <p>No pending requests.</p>
            </div>
          ) : (
            requests.data.map((r) => (
              <RequestReview key={r.id} request={{ ...r, domains: r.domains.map(String) }} />
            ))
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Colleges</h2>
          <ul className="divide-y rounded-lg border">
            {colleges.data?.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 p-3">
                <span className="font-medium">
                  {c.name} <span className="text-muted-foreground">({c.short_name})</span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {c.city} · {c.college_domains.map((d) => d.domain).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
