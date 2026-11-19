
"use client";

import { useState } from "react";


type PayButtonProps = {
  reservationId: string;
  amount: number;
};

export default function PayButton({
  reservationId,
  amount,
}: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePayment() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Impossible de démarrer le paiement."
        );
      }

      if (
        typeof data.url !== "string" ||
        !data.url.startsWith("https://checkout.stripe.com/")
      ) {
        throw new Error("Lien de paiement Stripe invalide.");
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue."
      );
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading}
        className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Redirection vers Stripe..."
          : `Payer ${amount.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}`}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
