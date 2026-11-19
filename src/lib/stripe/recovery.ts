
import "server-only";

import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inspectStripeCheckout(
  paymentId: string
) {
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, status, stripe_checkout_session_id, checkout_creation_token, checkout_creation_started_at"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new Error("Paiement introuvable.");
  }

  // Une session Stripe est déjà enregistrée.
  if (payment.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      payment.stripe_checkout_session_id
    );

    if (session.metadata?.payment_id !== payment.id) {
      throw new Error(
        "La session Stripe ne correspond pas au paiement."
      );
    }

    return {
      paymentId: payment.id,
      status: "session_found",
      sessionId: session.id,
      checkoutStatus: session.status,
      paymentStatus: session.payment_status,
    };
  }

  // Une création a commencé mais n'a pas été finalisée.
  if (payment.checkout_creation_token) {
    return {
      paymentId: payment.id,
      status: "creation_interrupted",
      startedAt: payment.checkout_creation_started_at,
      message:
        "Création interrompue : vérification Stripe nécessaire.",
    };
  }

  return {
    paymentId: payment.id,
    status: "no_session",
    message: "Aucune session Stripe enregistrée.",
  };
}
