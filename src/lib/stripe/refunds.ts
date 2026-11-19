
import "server-only";

import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function refundCinemaPayment(
  paymentId: string
) {
  const admin = createAdminClient();

  // 1. Vérifier le paiement.
  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, status, stripe_payment_intent_id, stripe_refund_id"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new Error("Paiement introuvable.");
  }

  if (payment.status === "refunded") {
    return "already_refunded";
  }

  if (payment.status !== "refund_required") {
    throw new Error("Remboursement non requis.");
  }

  // 2. Réserver le traitement de façon atomique.
  const { data: token, error: claimError } =
    await admin.rpc("claim_stripe_refund", {
      p_payment_id: payment.id,
    });

  if (claimError || !token) {
    throw new Error(
      claimError?.message ??
        "Impossible de réserver le remboursement."
    );
  }

  // IMPORTANT :
  // Ne pas libérer le jeton automatiquement en cas
  // d'erreur : Stripe peut avoir reçu la demande.
  try {
    if (!payment.stripe_payment_intent_id) {
      throw new Error("PaymentIntent Stripe manquant.");
    }

    let refund;

    // 3. Rechercher le remboursement Stripe.
    if (payment.stripe_refund_id) {
      refund = await stripe.refunds.retrieve(
        payment.stripe_refund_id
      );
    } else {
      const existingRefunds = await stripe.refunds.list({
        payment_intent: payment.stripe_payment_intent_id,
        limit: 100,
      });

      const matchingRefunds = existingRefunds.data.filter(
        (item) => item.metadata?.payment_id === payment.id
      );

      if (matchingRefunds.length > 1) {
        throw new Error(
          "Plusieurs remboursements détectés : contrôle manuel requis."
        );
      }

      if (matchingRefunds.length === 1) {
        refund = matchingRefunds[0];
      } else {
        if (existingRefunds.has_more) {
          throw new Error(
            "Recherche Stripe incomplète : contrôle manuel requis."
          );
        }

        refund = await stripe.refunds.create(
          {
            payment_intent: payment.stripe_payment_intent_id,
            metadata: {
              payment_id: payment.id,
            },
          },
          {
            idempotencyKey:
              `cinema-refund-${payment.id}-v1`,
          }
        );
      }
    }

    // 4. Enregistrer le résultat dans Supabase.
    const { data: result, error: recordError } =
      await admin.rpc("record_stripe_refund", {
        p_payment_id: payment.id,
        p_refund_id: refund.id,
        p_refund_status: refund.status,
      });

    if (recordError) {
      throw new Error(
        `Enregistrement du remboursement impossible : ${recordError.message}`
      );
    }

    // 5. Libérer le traitement seulement après
    // enregistrement du remboursement.
    const { data: released, error: releaseError } =
      await admin.rpc("release_stripe_refund", {
        p_payment_id: payment.id,
        p_token: token,
      });

    if (releaseError || released !== true) {
      throw new Error(
        "Remboursement enregistré, mais verrou non libéré."
      );
    }

    return result;
  } catch (error) {
    console.error(
      "Traitement remboursement interrompu :",
      payment.id,
      error
    );

    throw error;
  }
}
