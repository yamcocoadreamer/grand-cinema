
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SeatSelection from "./SeatSelection";

export const instant = false;

type Seat = {
  id: string;
  row_label: string;
  seat_number: number;
};

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ screeningId: string }>;
}) {
  const { screeningId } = await params;
  const supabase = await createClient();

  const { data: screening, error: screeningError } =
    await supabase
      .from("screenings")
      .select(`
        id,
        starts_at,
        ticket_price,
        room_id
      `)
      .eq("id", screeningId)
      .eq("status", "scheduled")
      .maybeSingle();

  if (screeningError || !screening) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <h1 className="text-2xl font-bold">
          Séance introuvable
        </h1>

        <Link
          href="/films"
          className="mt-6 inline-block text-red-400"
        >
          Retour aux films
        </Link>
      </main>
    );
  }

  
  // Récupérer tous les sièges de la salle
  const { data: seats, error: seatsError } =
    await supabase
      .from("seats")
      .select("id, row_label, seat_number")
      .eq("room_id", screening.room_id)
      .order("row_label", { ascending: true })
      .order("seat_number", { ascending: true });

  
  // Récupérer les sièges occupés sans exposer les réservations
  const { data: reservedSeats, error: reservedSeatsError } =
    await supabase.rpc("get_occupied_seats", {
      p_screening_id: screeningId,
    });

  if (reservedSeatsError) {
    console.error(
      "Erreur de chargement des places occupées :",
      reservedSeatsError.message
    );
  }

type OccupiedSeat = {
  seat_id: number;
};

const occupiedSeatIds: string[] = reservedSeatsError
  ? []
  : ((reservedSeats ?? []) as OccupiedSeat[]).map(
      (item: OccupiedSeat) => String(item.seat_id)
    );



  // Formater la date de la séance
  const formattedDate = new Date(
    screening.starts_at
  ).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });


  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/films"
          className="text-red-400 hover:underline"
        >
          ← Retour aux films
        </Link>

        <h1 className="mt-8 text-3xl font-bold">
          Réservation des places
        </h1>

        <p className="mt-4 text-zinc-300">
          Séance du {formattedDate}
        </p>

        

{reservedSeatsError ? (
  <p role="alert" className="mt-8 text-red-400">
    Impossible de vérifier les places disponibles.
    Veuillez réessayer.
  </p>
) : (
  
<SeatSelection
  seats={seats as Seat[]}
  ticketPrice={Number(screening.ticket_price)}
  occupiedSeatIds={occupiedSeatIds}
  screeningId={screeningId}
/>

)}

      </div>
    </main>
  );
}
