import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy · CampusPool" };

// DRAFT: have this reviewed before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="16 November 2026">
      <p>
        CampusPool is built to share as little about you as possible, and only with people from your
        own college.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your college email address, used to sign you in and to confirm your college.</li>
        <li>Your name, mobile number, and optionally gender and year or department.</li>
        <li>Vehicle details if you drive.</li>
        <li>The pickup points, destinations and times of rides you post or book.</li>
        <li>Messages, ratings and reports connected to rides.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>Only verified members of your own college can see you at all.</li>
        <li>
          Before a ride is confirmed they see your first name, rating, vehicle model and colour, and
          an approximate location (moved by a few hundred metres).
        </li>
        <li>
          Your phone number, exact pickup point and number plate are shown only to the other person
          in a confirmed ride.
        </li>
        <li>Your gender is never shown to other members. It is used only for women-only rides.</li>
        <li>Admins can see reports and account details when reviewing a report.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Expired ride requests are deleted after 30 days.</li>
        <li>We keep no location history beyond what each ride needs.</li>
        <li>
          If you delete your account we delete your personal details. Records of past rides are kept
          only in anonymous form.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or show ads.</li>
        <li>We don&apos;t track your location in the background.</li>
      </ul>

      <h2>Services we use</h2>
      <p>
        Supabase (database and sign-in), Vercel (hosting), Resend (email), and a map provider for
        maps and address search. Address searches are sent from our server, not your device.
      </p>
    </LegalPage>
  );
}
