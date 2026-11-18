
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Movie = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  genre: string | null;
  poster_url: string | null;
};

type Screening = {
  id: string;
  starts_at: string;
  ticket_price: number;
  room_name: string;
};

// Composant principal
export default function MovieDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
          <p className="text-zinc-400">
            Chargement du film...
          </p>
        </main>
      }
    >
      <MovieDetailsContent />
    </Suspense>
  );
}

// Composant contenant la logique du film
function MovieDetailsContent() {
  const params = useParams<{ id: string }>();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screeningsError, setScreeningsError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMovie() {
      setLoading(true);
      setError(null);
      setScreeningsError(null);
      setMovie(null);
      setScreenings([]);

      const supabase = createClient();

      try {
        // Récupération du film
        const { data, error: movieError } = await supabase
          .from("movies")
          .select(
            "id, title, description, duration_minutes, genre, poster_url"
          )
          .eq("id", params.id)
          .eq("is_published", true)
          .maybeSingle();

        if (!active) return;

        if (movieError) {
          setError("Impossible de charger ce film.");
          return;
        }

        if (!data) {
          setError("Ce film est introuvable.");
          return;
        }

        setMovie(data);

        // Récupération des séances
        const { data: sessions, error: sessionError } =
          await supabase
            .from("screenings")
            .select(`
              id,
              starts_at,
              ticket_price,
              rooms (
                name
              )
            `)
            .eq("movie_id", params.id)
            .eq("status", "scheduled")
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true });

        if (!active) return;

        if (sessionError) {
          setScreeningsError(
            "Impossible de charger les séances."
          );
        } else {
          const formattedScreenings: Screening[] =
            (sessions ?? []).map((session) => {
              // Normalisation du type retourné par Supabase
              const room: unknown = session.rooms;

              let roomName = "Salle à confirmer";

              if (
                room !== null &&
                typeof room === "object" &&
                !Array.isArray(room) &&
                "name" in room &&
                typeof room.name === "string"
              ) {
                roomName = room.name;
              } else if (Array.isArray(room)) {
                const firstRoom: unknown = room[0];

                if (
                  firstRoom !== null &&
                  typeof firstRoom === "object" &&
                  "name" in firstRoom &&
                  typeof firstRoom.name === "string"
                ) {
                  roomName = firstRoom.name;
                }
              }

              return {
                id: session.id,
                starts_at: session.starts_at,
                ticket_price: Number(session.ticket_price),
                room_name: roomName,
              };
            });

          setScreenings(formattedScreenings);
        }
      } catch {
        if (active) {
          setError(
            "Une erreur est survenue lors du chargement."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (params.id) {
      void loadMovie();
    }

    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/films"
          className="mb-8 inline-block text-red-400 hover:underline"
        >
          ← Retour aux films
        </Link>

        {loading && (
          <p className="text-zinc-400">
            Chargement du film...
          </p>
        )}

        {!loading && error && (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && movie && (
          <div className="grid gap-8 md:grid-cols-[280px_1fr]">
            {/* Affiche du film */}
            <div className="flex min-h-96 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={`Affiche de ${movie.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-zinc-400">
                  Affiche à venir
                </span>
              )}
            </div>

            {/* Informations du film */}
            <div>
              <h1 className="mb-4 text-4xl font-bold">
                {movie.title}
              </h1>

              <p className="mb-6 text-red-400">
                {movie.genre ?? "Genre non renseigné"}
                {" · "}
                {movie.duration_minutes} minutes
              </p>

              <h2 className="mb-3 text-2xl font-semibold">
                Synopsis
              </h2>

              <p className="leading-7 text-zinc-300">
                {movie.description ?? "Synopsis à venir."}
              </p>

              {/* Séances disponibles */}
              <section className="mt-8 rounded-xl border border-zinc-800 p-5">
                <h2 className="mb-5 text-2xl font-semibold">
                  Séances disponibles
                </h2>

                {screeningsError && (
                  <p role="alert" className="text-red-400">
                    {screeningsError}
                  </p>
                )}

                {!screeningsError &&
                  screenings.length === 0 && (
                    <p className="text-zinc-400">
                      Aucune séance disponible pour le moment.
                    </p>
                  )}

                {!screeningsError && (
                  <div className="space-y-4">
                    {screenings.map((screening) => {
                      const date = new Date(
                        screening.starts_at
                      );

                      const formattedDate =
                        date.toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "Europe/Paris",
                        });

                      const formattedTime =
                        date.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Paris",
                        });

                      const formattedPrice =
                        screening.ticket_price.toLocaleString(
                          "fr-FR",
                          {
                            style: "currency",
                            currency: "EUR",
                          }
                        );

                      return (
                        <article
                          key={screening.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-zinc-800 p-4"
                        >
                          <div>
                            <p className="font-semibold capitalize">
                              {formattedDate}
                            </p>

                            <p className="mt-1 text-sm text-zinc-300">
                              {formattedTime}
                              {" · "}
                              {screening.room_name}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="mb-2 text-lg font-bold">
                              {formattedPrice}
                            </p>

                            <span className="inline-block rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white">
                              Réservation à venir
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
