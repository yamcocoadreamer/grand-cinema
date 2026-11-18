
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";


type Reservation = {
  id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

export default function MesReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);


useEffect(() => {
  const updateTime = () => {
    setNow(Date.now());
  };

  updateTime();

  const interval = setInterval(updateTime, 10000);

  return () => clearInterval(interval);
}, []);


  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Connectez-vous pour voir vos réservations.");
      setLoading(false);
      return;
    }

    const { data, error: reservationsError } = await supabase
      .from("reservations")
      .select("id, status, created_at, expires_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (reservationsError) {
      setError("Impossible de charger vos réservations.");
    } else {
      setReservations(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  async function cancelReservation(reservationId: string) {
    if (cancellingId) return;

    setCancellingId(reservationId);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();

      const { data, error: cancelError } = await supabase.rpc(
        "cancel_my_reservation",
        {
          p_reservation_id: reservationId,
        }
      );

      if (cancelError) {
        setError(`Annulation impossible : ${cancelError.message}`);
        return;
      }

      if (data === false) {
        setMessage("Cette réservation était déjà annulée.");
      } else {
        setMessage("Votre réservation a été annulée.");
      }

      setConfirmId(null);
      await loadReservations();
    } catch {
      setError("Une erreur est survenue pendant l'annulation.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-6 text-2xl font-bold">
        Mes réservations
      </h2>

      {loading && (
        <p className="text-zinc-400">
          Chargement des réservations...
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 text-red-400">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mb-4 text-green-400">
          {message}
        </p>
      )}

      {!loading && !error && reservations.length === 0 && (
        <p className="text-zinc-400">
          Vous n'avez pas encore de réservation.
        </p>
      )}

      {!loading && (
        <div className="space-y-4">
          {reservations.map((reservation) => {
            
const isExpired =
  reservation.status === "pending" &&
  reservation.expires_at !== null &&
  new Date(reservation.expires_at).getTime() <= now;

const statusLabel =
  reservation.status === "cancelled"
    ? "Annulée"
    : reservation.status === "confirmed"
      ? "Confirmée"
      : isExpired
        ? "Expirée"
        : "En attente de paiement";

const canCancel =
  reservation.status === "pending" && !isExpired;


            const isConfirming = confirmId === reservation.id;
            const isCancelling = cancellingId === reservation.id;

            return (
              <article
                key={reservation.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <p className="text-sm text-zinc-400">
                  Réservation du{" "}
                  {new Date(reservation.created_at).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/Paris",
                    }
                  )}
                </p>

                <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                  {reservation.id}
                </p>

                <p
                  className={`mt-3 font-semibold ${
                    
reservation.status === "confirmed"
  ? "text-green-400"
  : reservation.status === "cancelled" || isExpired
    ? "text-red-400"
    : "text-yellow-400"

                  }`}
                >
                  {statusLabel}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/reservation/confirmation/${reservation.id}`}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    Voir les détails
                  </Link>

                  {canCancel && !isConfirming && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(reservation.id);
                        setError(null);
                        setMessage(null);
                      }}
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950"
                    >
                      Annuler ma réservation
                    </button>
                  )}
                </div>

                {canCancel && isConfirming && (
                  <div className="mt-5 rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                    <p className="font-medium">
                      Voulez-vous vraiment annuler cette réservation ?
                    </p>

                    <p className="mt-2 text-sm text-zinc-400">
                      Les places seront libérées et pourront être
                      réservées par d'autres utilisateurs.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => void cancelReservation(reservation.id)}
                        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {isCancelling
                          ? "Annulation..."
                          : "Confirmer l'annulation"}
                      </button>

                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        Conserver ma réservation
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
