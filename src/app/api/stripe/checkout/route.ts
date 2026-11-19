
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier l'utilisateur connecté
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Connexion requise." },
        { status: 401 }
      );
    }

    // 2. Vérifier l'identifiant de réservation
    const body = await request.json().catch(() => null);
    const reservationId = body?.reservationId;

    if (
      typeof reservationId !== "string" ||
      !uuidRegex.test(reservationId)
    ) {
      return NextResponse.json(
        { error: "Identifiant de réservation invalide." },
        { status: 400 }
      );
    }

    // 3. Vérifier la réservation
    const { data: reservation, error: reservationError } =
      await supabase
        .from("reservations")
        .select("id, user_id, screening_id, status, expires_at")
        .eq("id", reservationId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: "Réservation introuvable." },
        { status: 404 }
      );
    }

    if (
      reservation.status !== "pending" ||
      !reservation.expires_at ||
      new Date(reservation.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Réservation expirée ou non payable." },
        { status: 409 }
      );
    }

    // 4. Préparer le paiement côté Supabase
    const { data: paymentId, error: prepareError } =
      await supabase.rpc("prepare_reservation_payment", {
        p_reservation_id: reservation.id,
      });

    if (prepareError || !paymentId) {
      console.error("Préparation du paiement :", prepareError);

      return NextResponse.json(
        { error: "Impossible de préparer le paiement." },
        { status: 409 }
      );
    }

    // 5. Réserver le droit de créer une session Stripe
    const { data: claims, error: claimError } =
      await supabase.rpc("claim_stripe_checkout", {
        p_reservation_id: reservation.id,
      });

    if (claimError || !claims?.length) {
      console.error("Verrouillage Checkout :", claimError);

      return NextResponse.json(
        {
          error:
            "Une création de paiement est déjà en cours ou la réservation n'est plus disponible.",
        },
        { status: 409 }
      );
    }

    const claim = claims[0];

    // 6. Réutiliser une session existante
    if (claim.checkout_session_id) {
      const existingSession =
        await stripe.checkout.sessions.retrieve(
          claim.checkout_session_id
        );

      if (
        existingSession.status === "open" &&
        existingSession.url
      ) {
        return NextResponse.json({
          url: existingSession.url,
        });
      }

      return NextResponse.json(
        {
          error:
            "La session de paiement existante n'est plus utilisable.",
        },
        { status: 409 }
      );
    }

    if (!claim.creation_token) {
      return NextResponse.json(
        { error: "Jeton de création manquant." },
        { status: 409 }
      );
    }

    // 7. Lire le montant préparé en base
    const admin = createAdminClient();

    const { data: payment, error: paymentError } =
      await admin
        .from("payments")
        .select("id, amount, currency, status")
        .eq("id", claim.payment_id)
        .eq("reservation_id", reservation.id)
        .maybeSingle();

    if (
      paymentError ||
      !payment ||
      payment.status !== "pending" ||
      payment.currency !== "eur"
    ) {
      return NextResponse.json(
        { error: "Paiement indisponible." },
        { status: 409 }
      );
    }

    const amountCents = Math.round(
      Number(payment.amount) * 100
    );

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents < 50
    ) {
      return NextResponse.json(
        { error: "Montant invalide." },
        { status: 409 }
      );
    }

    // 8. Utiliser une URL de site configurée
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      throw new Error("NEXT_PUBLIC_SITE_URL manquante.");
    }

    const origin = new URL(siteUrl).origin;

    // 9. Créer la session Stripe
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: amountCents,
              product_data: {
                name: "Réservation Le Grand Cinéma",
                description: `Réservation ${reservation.id}`,
              },
            },
            quantity: 1,
          },
        ],

        client_reference_id: reservation.id,

        metadata: {
          reservation_id: reservation.id,
          payment_id: payment.id,
          user_id: user.id,
          checkout_creation_token: claim.creation_token,
        },

        success_url:
          `${origin}/reservation/confirmation/${reservation.id}` +
          "?checkout=success",

        cancel_url:
          `${origin}/reservation/confirmation/${reservation.id}` +
          "?checkout=cancel",
      },
      {
        idempotencyKey:
          `cinema-checkout-${payment.id}-v1`,
      }
    );

    if (!session.id || !session.url) {
      throw new Error("Session Stripe invalide.");
    }


if (
  session.client_reference_id !== reservation.id ||
  session.metadata?.payment_id !== payment.id ||
  session.metadata?.reservation_id !== reservation.id ||
  session.metadata?.checkout_creation_token !==
    claim.creation_token ||
  session.mode !== "payment" ||
  session.amount_total !== amountCents ||
  session.currency !== "eur"
) {
  throw new Error(
    "La session Stripe ne correspond pas au paiement attendu."
  );
}


    // 10. Enregistrer la session dans Supabase
    const { data: saved, error: saveError } =
      await admin.rpc("save_stripe_checkout_session", {
        p_payment_id: payment.id,
        p_creation_token: claim.creation_token,
        p_session_id: session.id,
      });

    if (saveError || saved !== true) {
      console.error(
        "Enregistrement session Stripe :",
        saveError
      );

      // Ne pas retourner l'URL d'une session
      // qui n'est pas enregistrée dans Supabase.
      return NextResponse.json(
        {
          error:
            "Session Stripe créée mais non enregistrée. Paiement temporairement indisponible.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Erreur Stripe Checkout :", error);

    return NextResponse.json(
      { error: "Impossible de préparer le paiement." },
      { status: 500 }
    );
  }
}
