
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Seat = {
  id: number;
  row_label: string;
  seat_number: number;
};

function getRelatedName(value: unknown): string | null {
  if (Array.isArray(value)) {
    return getRelatedName(value[0]);
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  ) {
    return value.name;
  }

  return null;
}

function getMovieTitle(value: unknown): string | null {
  if (Array.isArray(value)) {
    return getMovieTitle(value[0]);
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "title" in value &&
    typeof value.title === "string"
  ) {
    return value.title;
  }

  return null;
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  const supabase = await createClient();

  // Vérifier la connexion
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <h1 className="text-2xl font-bold">
          Connexion requise
        </h1>

        <Link
          href="/connexion"
          className="mt-6 inline-block text-red-400"
        >
          Se connecter
        </Link>
      </main>
    );
  }

  // Récupérer uniquement la réservation du client
  const { data: reservation, error: reservationError } =
    await supabase
      .from("reservations")
      .select("id, status, created_at, screening_id, room_id")
      .eq("id", reservationId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (reservationError || !reservation) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <h1 className="text-2xl font-bold">
          Réservation introuvable
        </h1>

        <Link
          href="/mon-compte"
          className="mt-6 inline-block text-red-400"
        >
          Retour à mon compte
        </Link>
      </main>
    );
  }

  // Récupérer la séance, le film et la salle
  const { data: screening, error: screeningError } =
    await supabase
      .from("screenings")
      .select(`
        starts_at,
        ticket_price,
        movies (
          title
        ),
        rooms (
          name
        )
      `)
      .eq("id", reservation.screening_id)
      .maybeSingle();

  // Récupérer les sièges associés à la réservation
  const { data: reservationSeats, error: reservationSeatsError } =
    await supabase
      .from("reservation_seats")
      .select("seat_id")
      .eq("reservation_id", reservation.id);

  if (
    screeningError ||
    !screening ||
    reservationSeatsError ||
    !reservationSeats
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <h1 className="text-2xl font-bold">
          Impossible de charger les détails
        </h1>

        <p className="mt-4 text-zinc-300">
          Votre réservation existe, mais ses détails
          ne sont pas disponibles pour le moment.
        </p>
      </main>
    );
  }

  // Récupérer les numéros des sièges
  const seatIds = reservationSeats.map(
    (item: { seat_id: number }) => item.seat_id
  );

  let seats: Seat[] = [];

  if (seatIds.length > 0) {
    const { data: seatData, error: seatError } =
      await supabase
        .from("seats")
        .select("id, row_label, seat_number")
        .eq("room_id", reservation.room_id)
        .in("id", seatIds)
        .order("row_label", { ascending: true })
        .order("seat_number", { ascending: true });

    if (seatError || !seatData) {
      return (
        <main className="min-h-screen bg-zinc-950 p-10 text-white">
          <p className="text-red-400">
            Impossible de charger les places réservées.
          </p>
        </main>
      );
    }

    seats = seatData as Seat[];
  }

  const movieTitle =
    getMovieTitle(screening.movies) ?? "Film indisponible";

  const roomName =
    getRelatedName(screening.rooms) ?? "Salle indisponible";

  const formattedDate = new Date(
    screening.starts_at
  ).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  const seatLabels = seats.map(
    (seat) => `${seat.row_label}${seat.seat_number}`
  );

  const ticketPrice = Number(screening.ticket_price);
  const total = seats.length * ticketPrice;

  const formatPrice = (value: number) =>
    value.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
    });

  const statusLabel =
    reservation.status === "pending"
      ? "En attente"
      : reservation.status === "confirmed"
        ? "Confirmée"
        : "Annulée";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/films"
          className="text-red-400 hover:underline"
        >
          ← Retour aux films
        </Link>

        <h1 className="mt-8 text-3xl font-bold">
          Réservation enregistrée
        </h1>

        <p className="mt-4 text-zinc-300">
          Retrouvez ci-dessous le récapitulatif
          de votre réservation.
        </p>

        <div className="mt-8 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-sm text-zinc-400">
              Référence de réservation
            </p>

            <p className="mt-1 break-all font-mono text-sm">
              {reservation.id}
            </p>
          </div>

          <div>
            <p className="text-sm text-zinc-400">
              Statut
            </p>

            <p
              className={`mt-1 font-semibold ${
                reservation.status === "confirmed"
                  ? "text-green-400"
                  : reservation.status === "cancelled"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              {statusLabel}
            </p>
          </div>

          <div className="border-t border-zinc-700 pt-5">
            <h2 className="text-2xl font-bold">
              {movieTitle}
            </h2>

            <p className="mt-3 text-zinc-300">
              {formattedDate}
            </p>

            <p className="mt-2 text-zinc-300">
              {roomName}
            </p>
          </div>

          <div className="border-t border-zinc-700 pt-5">
            <h3 className="text-lg font-semibold">
              Places réservées
            </h3>

            <p className="mt-2 text-zinc-300">
              {seatLabels.length > 0
                ? seatLabels.join(", ")
                : "Aucune place trouvée"}
            </p>

            <p className="mt-3 text-zinc-300">
              Nombre de places : {seats.length}
            </p>
          </div>

          <div className="border-t border-zinc-700 pt-5">
            <p className="text-zinc-300">
              Prix unitaire : {formatPrice(ticketPrice)}
            </p>

            <p className="mt-3 text-2xl font-bold">
              Total : {formatPrice(total)}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-zinc-400">
          Aucun paiement n'a encore été effectué.
          Cette réservation ne constitue pas un billet
          de cinéma définitif.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/mon-compte"
            className="rounded-lg bg-red-700 px-5 py-3 font-semibold hover:bg-red-600"
          >
            Mon compte
          </Link>

          <Link
            href="/films"
            className="rounded-lg border border-zinc-700 px-5 py-3 hover:bg-zinc-800"
          >
            Voir les films
          </Link>
        </div>
      </div>
    </main>
  );
}
