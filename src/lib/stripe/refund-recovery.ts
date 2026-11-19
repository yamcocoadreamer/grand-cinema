
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { refundCinemaPayment } from "@/lib/stripe/refunds";

export async function recoverPendingStripeRefunds() {
  const admin = createAdminClient();

  // 1. Identifier les traitements interrompus.
  const { data: stuck, error: stuckError } =
    await admin.rpc("get_stuck_stripe_refunds");

  if (stuckError) {
    throw new Error(
      `Recherche des remboursements interrompus impossible : ${stuckError.message}`
    );
  }

  type StuckRefund = {
  payment_id: string;
};

const stuckIds = new Set(
  ((stuck ?? []) as StuckRefund[]).map(
    (item: StuckRefund) => item.payment_id
  )
);

  // 2. Récupérer les remboursements à traiter.
  const { data: payments, error } = await admin.rpc(
    "get_pending_stripe_refunds"
  );

  if (error) {
    throw new Error(
      `Recherche des remboursements impossible : ${error.message}`
    );
  }

  const results = [];

  for (const payment of payments ?? []) {
    // Un traitement interrompu doit d'abord
    // être vérifié auprès de Stripe.
    if (stuckIds.has(payment.payment_id)) {
      results.push({
        paymentId: payment.payment_id,
        status: "manual_review_required",
        message:
          "Traitement interrompu : vérification Stripe nécessaire.",
      });

      continue;
    }

    try {
      const result = await refundCinemaPayment(
        payment.payment_id
      );

      results.push({
        paymentId: payment.payment_id,
        status: "processed",
        result,
      });
    } catch (error) {
      results.push({
        paymentId: payment.payment_id,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      });
    }
  }

  return results;
}
