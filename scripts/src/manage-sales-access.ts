import { db, salesStaffAccessTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid staff email address.");
  }
  return email;
}

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  pnpm --filter @workspace/scripts sales-access grant-manager <email> <display name>",
      "  pnpm --filter @workspace/scripts sales-access revoke-manager <email>",
      "  pnpm --filter @workspace/scripts sales-access list",
      "",
      "Sales teammate access is managed by an authorized sales manager in the private web workspace.",
    ].join("\n"),
  );
}

async function grantManager(
  emailValue: string | undefined,
  nameParts: string[],
) {
  if (!emailValue || nameParts.length === 0) usage();
  const normalizedEmail = normalizeEmail(emailValue);
  const displayName = nameParts.join(" ").trim();
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("Display name must be between 2 and 120 characters.");
  }

  const staff = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`,
    );
    const [existing] = await tx
      .select({ role: salesStaffAccessTable.role })
      .from(salesStaffAccessTable)
      .where(eq(salesStaffAccessTable.normalizedEmail, normalizedEmail))
      .limit(1)
      .for("update");
    if (existing && existing.role !== "sales_manager") {
      throw new Error(
        "That email already belongs to a non-manager access record.",
      );
    }

    const [saved] = await tx
      .insert(salesStaffAccessTable)
      .values({
        normalizedEmail,
        displayName,
        role: "sales_manager",
        accessStatus: "active",
      })
      .onConflictDoUpdate({
        target: salesStaffAccessTable.normalizedEmail,
        set: {
          displayName,
          role: "sales_manager",
          accessStatus: "active",
          revokedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning({
        email: salesStaffAccessTable.normalizedEmail,
        name: salesStaffAccessTable.displayName,
        status: salesStaffAccessTable.accessStatus,
      });

    return saved;
    });

  process.stdout.write(`${JSON.stringify(staff)}\n`);
}

async function revokeManager(emailValue: string | undefined) {
  if (!emailValue) usage();
  const normalizedEmail = normalizeEmail(emailValue);
  const [staff] = await db
    .update(salesStaffAccessTable)
    .set({
      accessStatus: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(salesStaffAccessTable.normalizedEmail, normalizedEmail),
        eq(salesStaffAccessTable.role, "sales_manager"),
      ),
    )
    .returning({
      email: salesStaffAccessTable.normalizedEmail,
      name: salesStaffAccessTable.displayName,
      status: salesStaffAccessTable.accessStatus,
    });

  if (!staff) {
    throw new Error("No sales-manager access record exists for that email.");
  }
  process.stdout.write(`${JSON.stringify(staff)}\n`);
}

async function list() {
  const staff = await db
    .select({
      email: salesStaffAccessTable.normalizedEmail,
      name: salesStaffAccessTable.displayName,
      role: salesStaffAccessTable.role,
      status: salesStaffAccessTable.accessStatus,
      identityBound: salesStaffAccessTable.clerkUserId,
      revokedAt: salesStaffAccessTable.revokedAt,
    })
    .from(salesStaffAccessTable);

  process.stdout.write(
    `${JSON.stringify(
      staff.map(({ identityBound, ...entry }) => ({
        ...entry,
        identityBound: Boolean(identityBound),
      })),
      null,
      2,
    )}\n`,
  );
}

const [command, email, ...nameParts] = process.argv.slice(2);

switch (command) {
  case "grant-manager":
    await grantManager(email, nameParts);
    break;
  case "revoke-manager":
    await revokeManager(email);
    break;
  case "list":
    await list();
    break;
  default:
    usage();
}