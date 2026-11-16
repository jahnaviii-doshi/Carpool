import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { getRegion } from "@/lib/config/region";

export const metadata: Metadata = { title: "Terms · CampusPool" };

// DRAFT: have this reviewed before launch (by the college and a lawyer).
export default function TermsPage() {
  const region = getRegion();
  return (
    <LegalPage title="Terms of Use" updated="16 November 2026">
      <p>
        CampusPool helps students and staff of the same college share rides. By using it you agree
        to these terms.
      </p>

      <h2>Who can use CampusPool</h2>
      <ul>
        <li>You must be a current student or staff member with a working college email address.</li>
        <li>You must be 18 or older.</li>
        <li>One account per person. Don&apos;t share your account or sign in as someone else.</li>
        <li>
          We ask you to re-confirm your college email every few months. If your college email stops
          working, you lose the ability to post or book rides.
        </li>
      </ul>

      <h2>Rides are arranged between members</h2>
      <p>
        CampusPool is not a transport company and does not employ drivers. Drivers and riders
        arrange rides with each other and are responsible for their own conduct. Drivers must hold a
        valid licence and insurance for their vehicle and follow traffic law.
      </p>

      <h2>No paid rides</h2>
      {region.costSharingEnabled ? (
        <p>
          Drivers may ask riders to share fuel costs only, up to the limit shown in the app. Rides
          for profit are not allowed.
        </p>
      ) : (
        <p>
          Rides on CampusPool are free. Drivers must not ask for or accept payment, because carrying
          passengers for money in a private car is not allowed under local law.
        </p>
      )}

      <h2>Safety and conduct</h2>
      <ul>
        <li>Be respectful. Harassment, discrimination and threats lead to a permanent ban.</li>
        <li>Use phone numbers you receive only to arrange the ride they were shared for.</li>
        <li>
          Report anyone who makes you feel unsafe. In an emergency call {region.emergencyNumber}{" "}
          first.
        </li>
        <li>
          Gender is self-declared. Women-only rides depend on members being honest; misusing them
          leads to a ban.
        </li>
      </ul>

      <h2>Accounts we may suspend</h2>
      <p>
        We may limit or suspend accounts that break these terms or that receive several reports,
        while an admin reviews them.
      </p>

      <h2>No warranty</h2>
      <p>
        CampusPool is provided as is. To the extent allowed by law we are not liable for anything
        that happens during a ride arranged through the app.
      </p>
    </LegalPage>
  );
}
