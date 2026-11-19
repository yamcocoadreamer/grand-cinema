
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundCinemaPayment } from "@/lib/stripe/refunds";

function isUuid(value: string | undefined): value is string {
  return !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function handlePaidSession(
  eventId: string,
  eventType:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded",
  session: Stripe.Checkout.Session
) {
  // Ne confirmer que les paiements effectivement réussis.
  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid"
  ) {
    return;
  }

  const reservationId = session.metadata?.reservation_id;
  const paymentId = session.metadata?.payment_id;

  if (!isUuid(reservationId) || !isUuid(paymentId)) {
    // Les événements simulés sans réservation locale
    // ne doivent pas modifier notre base.
    console.info("Session sans réservation locale :", session.id);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (
    !paymentIntentId ||
    session.amount_total === null ||
    !session.currency
  ) {
    throw new Error("Informations de paiement incomplètes.");
  }

  const admin = createAdminClient();

  const { data: result, error } = await admin.rpc(
    "confirm_stripe_payment",
    {
      p_event_id: eventId,
      p_event_type: eventType,
      p_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_amount_total: session.amount_total,
      p_currency: session.currency,
      p_reservation_id: reservationId,
      p_payment_id: paymentId,
    }
  );

  if (error) {
    console.error("Confirmation Supabase :", error);
    throw new Error("Confirmation du paiement impossible.");
  }

  console.info("Résultat du paiement Stripe :", result);

  if (
  result === "refund_required" ||
  result === "already_refund_pending" ||
  result === "already_processed"
) {

  // Vérifier le statut réel du paiement avant
  // de demander un remboursement.
  const { data: currentPayment, error: paymentError } =
    await admin
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .maybeSingle();

  if (paymentError || !currentPayment) {
    throw new Error(
      "Impossible de vérifier le statut du paiement."
    );
  }

  if (currentPayment.status !== "refund_required") {
    return;
  }

  console.warn(
    "Remboursement à traiter :",
    paymentId
  );

  const refundResult = await refundCinemaPayment(paymentId);

  console.info(
    "Résultat du remboursement :",
    refundResult
  );
}
}


async function handleRefundUpdate(
  refund: Stripe.Refund
) {
  const paymentId = refund.metadata?.payment_id;

  if (!isUuid(paymentId)) {
    console.info(
      "Remboursement sans paiement local :",
      refund.id
    );
    return;
  }

  const admin = createAdminClient();

  // Vérifier que le remboursement correspond
  // au paiement enregistré dans Supabase.
  const { data: payment, error: paymentError } =
    await admin
      .from("payments")
      .select(
        "id, status, stripe_refund_id, stripe_payment_intent_id"
      )
      .eq("id", paymentId)
      .maybeSingle();

  if (paymentError || !payment) {
    throw new Error("Paiement local introuvable.");
  }

  if (
    payment.stripe_refund_id &&
    payment.stripe_refund_id !== refund.id
  ) {
    throw new Error("Identifiant de remboursement incompatible.");
  }

  const refundPaymentIntent =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;

  if (
    !refundPaymentIntent ||
    refundPaymentIntent !==
      payment.stripe_payment_intent_id
  ) {
    throw new Error("PaymentIntent incompatible.");
  }

  if (
    payment.status !== "refund_required" &&
    payment.status !== "refunded"
  ) {
    throw new Error("Statut du paiement incompatible.");
  }

  const { error: recordError } = await admin.rpc(
    "record_stripe_refund",
    {
      p_payment_id: payment.id,
      p_refund_id: refund.id,
      p_refund_status: refund.status,
    }
  );

  if (recordError) {
    console.error("Synchronisation remboursement :", recordError);
    throw new Error("Synchronisation du remboursement impossible.");
  }

  console.info("Remboursement synchronisé :", refund.id);
}


async function handleFailedPayment(
  eventId: string,
  session: Stripe.Checkout.Session
) {
  const paymentId = session.metadata?.payment_id;

  // Ignorer les événements de démonstration
  // sans paiement associé à notre application.
  if (!isUuid(paymentId)) {
    console.info(
      "Paiement échoué sans référence locale :",
      session.id
    );
    return;
  }

  // Ne pas marquer comme échoué
  // un paiement que Stripe indique comme payé.
  if (session.payment_status === "paid") {
    throw new Error(
      "Incohérence : Stripe indique un paiement payé."
    );
  }

  const admin = createAdminClient();

  const { data: result, error } = await admin.rpc(
    "fail_stripe_payment",
    {
      p_event_id: eventId,
      p_session_id: session.id,
      p_payment_id: paymentId,
    }
  );

  if (error) {
    console.error(
      "Erreur enregistrement échec Stripe :",
      error
    );

    throw new Error(
      "Impossible d'enregistrer l'échec du paiement."
    );
  }

  console.info(
    "Paiement Stripe échoué traité :",
    result
  );
}


export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Signature ou configuration manquante." },
      { status: 400 }
    );
  }

  try {
    const body = await request.text();

    // Vérification cryptographique de la signature Stripe.
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed":
case "checkout.session.async_payment_succeeded":
  await handlePaidSession(
    event.id,
    event.type,
    event.data.object
  );
  break;

      case "checkout.session.expired":
        console.info(
          "Session Stripe expirée :",
          event.data.object.id
        );
        break;

      
case "checkout.session.async_payment_failed":
  await handleFailedPayment(
    event.id,
    event.data.object
  );
  break;



        case "refund.updated":
        case "refund.failed":
            await handleRefundUpdate(event.data.object);
        break;


      default:
        console.info("Événement ignoré :", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur webhook Stripe :", error);

    // Stripe pourra réessayer l'événement.
    return NextResponse.json(
      { error: "Traitement du webhook impossible." },
      { status: 400 }
    );
  }
}
