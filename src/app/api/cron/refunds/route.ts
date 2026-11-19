
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Accès non autorisé" },
      { status: 401 }
    );
  }

  const received = authorization.slice(7);

  const expectedBuffer = Buffer.from(secret);
  const receivedBuffer = Buffer.from(received);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return NextResponse.json(
      { error: "Accès non autorisé" },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    const [pendingResult, stuckResult] = await Promise.all([
      admin.rpc("get_pending_stripe_refunds"),
      admin.rpc("get_stuck_stripe_refunds"),
    ]);

    if (pendingResult.error || stuckResult.error) {
      throw new Error(
        pendingResult.error?.message ??
          stuckResult.error?.message ??
          "Erreur Supabase"
      );
    }

    return NextResponse.json({
      mode: "diagnostic",
      pendingCount: pendingResult.data?.length ?? 0,
      stuckCount: stuckResult.data?.length ?? 0,
    });
  } catch (error) {
    console.error("Diagnostic remboursements :", error);

    return NextResponse.json(
      { error: "Erreur du diagnostic des remboursements" },
      { status: 500 }
    );
  }
}
