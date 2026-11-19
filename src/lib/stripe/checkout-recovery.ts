
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { inspectStripeCheckout } from "@/lib/stripe/recovery";

type StuckCheckout = {
  payment_id: string;
};

export async function inspectStuckStripeCheckouts() {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "get_stuck_stripe_checkouts"
  );

  if (error) {
    throw new Error(
      `Recherche des sessions interrompues impossible : ${error.message}`
    );
  }

  const results = [];

  for (const item of (data ?? []) as StuckCheckout[]) {
    try {
      const result = await inspectStripeCheckout(
        item.payment_id
      );

      results.push(result);
    } catch (error) {
      results.push({
        paymentId: item.payment_id,
        status: "inspection_failed",
        message:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      });
    }
  }

  return results;
}
