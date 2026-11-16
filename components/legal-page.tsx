import Link from "next/link";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-16">
      <div className="flex flex-col gap-1 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">Last updated {updated}</p>
      </div>
      <div className="[&_h2]:text-foreground text-muted-foreground flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to CampusPool
      </Link>
    </main>
  );
}
