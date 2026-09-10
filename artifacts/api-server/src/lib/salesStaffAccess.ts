import {
  clerkClient,
  getAuth,
  type User,
} from "@clerk/express";
import {
  db,
  salesStaffAccessTable,
  type SalesStaffAccess,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

const SALES_ROLE = "sales";
const SALES_MANAGER_ROLE = "sales_manager";
const ACTIVE_ACCESS_STATUS = "active";

export type AuthorizedSalesStaff = Pick<
  SalesStaffAccess,
  "id" | "displayName" | "normalizedEmail" | "role"
> & {
  clerkUserId: string;
};

type AuthenticatedStaffIdentity = {
  clerkUserId: string;
  displayName: string;
  normalizedEmail: string;
};

type StaffIdentityProvider = (
  req: Request,
) => Promise<AuthenticatedStaffIdentity | null>;

const requestSalesStaff = new WeakMap<Request, AuthorizedSalesStaff>();

function isSameOriginBrowserRequest(req: Request): boolean {
  if (req.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const origin = req.get("origin");
  if (!origin) {
    return true;
  }

  const requestHost = req.get("x-forwarded-host") ?? req.get("host");
  if (!requestHost) {
    return false;
  }

  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function verifiedPrimaryEmail(user: User): string | null {
  const primary = user.primaryEmailAddress;
  if (primary?.verification?.status !== "verified") {
    return null;
  }
  return primary.emailAddress.trim().toLowerCase();
}

async function clerkStaffIdentity(
  req: Request,
): Promise<AuthenticatedStaffIdentity | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    return null;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const normalizedEmail = verifiedPrimaryEmail(user);
    if (!normalizedEmail || user.banned || user.locked) {
      return null;
    }

    return {
      clerkUserId: user.id,
      displayName: user.fullName?.trim() || normalizedEmail,
      normalizedEmail,
    };
  } catch (error) {
    req.log.warn(
      { err: error, clerkUserId: userId },
      "Could not resolve authenticated sales staff identity",
    );
    return null;
  }
}

let staffIdentityProvider: StaffIdentityProvider = clerkStaffIdentity;

export function setSalesStaffIdentityProviderForTests(
  provider: StaffIdentityProvider,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Sales staff identity overrides are test-only.");
  }
  staffIdentityProvider = provider;
}

export async function authorizeSalesStaffIdentity(
  identity: AuthenticatedStaffIdentity,
): Promise<AuthorizedSalesStaff | null> {
  return db.transaction(async (tx) => {
    const [staff] = await tx
      .select()
      .from(salesStaffAccessTable)
      .where(
        and(
          eq(
            salesStaffAccessTable.normalizedEmail,
            identity.normalizedEmail,
          ),
          inArray(salesStaffAccessTable.role, [
            SALES_ROLE,
            SALES_MANAGER_ROLE,
          ]),
          eq(salesStaffAccessTable.accessStatus, ACTIVE_ACCESS_STATUS),
          isNull(salesStaffAccessTable.revokedAt),
        ),
      )
      .limit(1);

    if (
      !staff ||
      (staff.clerkUserId && staff.clerkUserId !== identity.clerkUserId)
    ) {
      return null;
    }

    let authorized = staff;
    if (!staff.clerkUserId) {
      const [bound] = await tx
        .update(salesStaffAccessTable)
        .set({
          clerkUserId: identity.clerkUserId,
          displayName: identity.displayName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(salesStaffAccessTable.id, staff.id),
            isNull(salesStaffAccessTable.clerkUserId),
          ),
        )
        .returning();
      if (!bound) {
        return null;
      }
      authorized = bound;
    }

    if (!authorized.clerkUserId) {
      return null;
    }

    return {
      id: authorized.id,
      clerkUserId: authorized.clerkUserId,
      displayName: authorized.displayName,
      normalizedEmail: authorized.normalizedEmail,
      role: authorized.role,
    };
  });
}

export async function requireSalesStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  res.set("Cache-Control", "no-store");
  if (!isSameOriginBrowserRequest(req)) {
    res.status(403).json({ error: "Cross-origin staff access is not allowed." });
    return;
  }

  const identity = await staffIdentityProvider(req);
  if (!identity) {
    res.status(401).json({ error: "Staff authentication failed." });
    return;
  }

  const staff = await authorizeSalesStaffIdentity(identity);
  if (!staff) {
    res.status(403).json({ error: "Sales access is not active for this account." });
    return;
  }

  requestSalesStaff.set(req, staff);
  next();
}

export async function requireSalesManager(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireSalesStaff(req, res, () => {
    const staff = requestSalesStaff.get(req);
    if (staff?.role !== SALES_MANAGER_ROLE) {
      res.status(403).json({
        error: "Sales manager access is not active for this account.",
      });
      return;
    }
    next();
  });
}

export function getAuthorizedSalesStaff(req: Request): AuthorizedSalesStaff {
  const staff = requestSalesStaff.get(req);
  if (!staff) {
    throw new Error("Sales staff authorization middleware was not applied.");
  }
  return staff;
}