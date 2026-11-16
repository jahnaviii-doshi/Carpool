import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Milestone 1 placeholder. The real landing page (email field + server-side
 * college-domain check) arrives in Milestone 2.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">CampusPool</CardTitle>
          <CardDescription>
            Share rides with verified students and staff from your own college.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Sign-in with your college email is coming in the next milestone.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
