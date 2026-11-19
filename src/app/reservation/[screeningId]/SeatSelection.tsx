
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Seat = {
  id: number | string;
  row_label: string;
  seat_number: number;
};

type SeatSelectionProps = {
  seats: Seat[];
  ticketPrice: number;
  occupiedSeatIds: string[];
  screeningId: string;
};

export default function SeatSelection({
  seats,
  ticketPrice,
  occupiedSeatIds,
  screeningId,
}: SeatSelectionProps) {
  const router = useRouter();

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const occupied = new Set(occupiedSeatIds.map(String));

  const rows = [
    ...new Set(seats.map((seat) => seat.row_label)),
  ].sort();

  const total = selectedSeats.length * ticketPrice;

  function toggleSeat(seatId: string) {
    if (occupied.has(seatId) || submitting) return;

    setError(null);

    setSelectedSeats((current) =>
      current.includes(seatId)
        ? current.filter((id) => id !== seatId)
        : current.length < 10
          ? [...current, seatId]
          : current
    );
  }

  async function handleReservation() {
    if (submitting || selectedSeats.length === 0) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError(
          "Connectez-vous pour confirmer votre réservation."
        );
        return;
      }

      const { data: reservationId, error: reservationError } =
        await supabase.rpc("create_seat_reservation", {
          p_screening_id: screeningId,
          p_seat_ids: selectedSeats.map(Number),
        });

      if (reservationError) {
        const message = reservationError.message;

        if (
          message.includes("déjà réservées") ||
          message.includes("already")
        ) {
          setError(
            "Une ou plusieurs places viennent d'être réservées. Actualisez la page et choisissez d'autres sièges."
          );
        } else {
          setError(`Réservation impossible : ${message}`);
        }

        return;
      }

      if (!reservationId) {
        setError("La réservation n'a pas pu être créée.");
        return;
      }

      
        setSelectedSeats([]);
        router.push(`/reservation/confirmation/${reservationId}`);

    } catch {
      setError(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-6 text-2xl font-semibold">
        Choisissez vos places
      </h2>

      <div className="rounded-xl bg-zinc-900 p-6">
        <div className="mx-auto mb-10 max-w-lg">
          <div className="h-2 rounded bg-zinc-300" />
          <p className="mt-2 text-center text-sm text-zinc-400">
            ÉCRAN
          </p>
        </div>

        <div className="space-y-4 overflow-x-auto">
          {rows.map((row) => (
            <div
              key={row}
              className="flex min-w-max items-center justify-center gap-3"
            >
              <span className="w-6 text-zinc-400">
                {row}
              </span>

              {seats
                .filter((seat) => seat.row_label === row)
                .sort((a, b) => a.seat_number - b.seat_number)
                .map((seat) => {
                  const seatId = String(seat.id);
                  const isOccupied = occupied.has(seatId);
                  const isSelected =
                    selectedSeats.includes(seatId);

                  return (
                    <button
                      key={seatId}
                      type="button"
                      disabled={isOccupied || submitting}
                      onClick={() => toggleSeat(seatId)}
                      aria-pressed={isSelected}
                      aria-label={`Place ${seat.row_label}${seat.seat_number}${
                        isOccupied ? " occupée" : ""
                      }`}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
                        isOccupied
                          ? "cursor-not-allowed bg-red-800"
                          : isSelected
                            ? "bg-green-600"
                            : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                    >
                      {seat.row_label}
                      {seat.seat_number}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-zinc-700" />
            Disponible
          </span>

          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-green-600" />
            Sélectionnée
          </span>

          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-red-800" />
            Occupée
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 p-6">
        <h3 className="text-xl font-semibold">
          Récapitulatif
        </h3>

        <p className="mt-4 text-zinc-300">
          Nombre de places : {selectedSeats.length}
        </p>

        <p className="mt-2 text-zinc-300">
          Prix unitaire :{" "}
          {ticketPrice.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
          })}
        </p>

        <p className="mt-4 text-2xl font-bold">
          Total :{" "}
          {total.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
          })}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-red-400">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="mt-4 text-green-400">
            {success}
          </p>
        )}

        <button
          type="button"
          onClick={handleReservation}
          disabled={
            submitting ||
            selectedSeats.length === 0
          }
          className="mt-6 rounded-lg bg-red-700 px-6 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Enregistrement..."
            : "Continuer la réservation"}
        </button>

        <p className="mt-3 text-sm text-zinc-400">
          La réservation sera enregistrée avec le statut
          « en attente ». Aucun paiement n'est effectué.
        </p>
      </div>
    </section>
  );
}
