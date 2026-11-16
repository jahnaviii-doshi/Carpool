import { CircleCheck, Inbox } from "lucide-react";

import { RequestReview } from "@/app/admin/request-review";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; rejected?: string }>;
}) {
  const session = await requireSuperAdmin();
  const { supabase } = session;
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
    <AppShell session={session} title="Admin">
      <div className="flex flex-col gap-8">
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
      </div>
    </AppShell>
  );
}
