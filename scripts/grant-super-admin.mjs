#!/usr/bin/env node
// Grants (or with --revoke, removes) super-admin rights for an email address.
// Kept out of migrations and seed files so admin emails are never committed.
//
//   pnpm admin:grant someone@aus.edu
//   pnpm admin:grant --revoke someone@aus.edu
//   DATABASE_URL=postgresql://...cloud... pnpm admin:grant someone@aus.edu
import pg from "pg";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args
  .find((a) => !a.startsWith("--"))
  ?.trim()
  .toLowerCase();

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: pnpm admin:grant [--revoke] <email>");
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54342/postgres";
const client = new pg.Client({ connectionString });
await client.connect();
try {
  if (revoke) {
    const { rowCount } = await client.query("delete from public.super_admins where email = $1", [
      email,
    ]);
    console.log(rowCount ? `Revoked super admin: ${email}` : `${email} was not a super admin`);
  } else {
    const { rows } = await client.query("select public.college_for_email($1) as college_id", [
      email,
    ]);
    if (!rows[0].college_id) {
      console.error(`${email} is not at an approved college domain, so it could never sign in.`);
      process.exit(1);
    }
    await client.query(
      "insert into public.super_admins (email) values ($1) on conflict (email) do nothing",
      [email],
    );
    console.log(`Granted super admin: ${email} (takes effect once they verify by email code)`);
  }
} finally {
  await client.end();
}
