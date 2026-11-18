
"use client";

import { useEffect, useState } from "react";
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

export default function MovieDetailsPage() {
  const params = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMovie() {
      setLoading(true);
      setError(null);
      setMovie(null);

      const supabase = createClient();

      const { data, error } = await supabase
        .from("movies")
        .select(
          "id, title, description, duration_minutes, genre, poster_url"
        )
        .eq("id", params.id)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        setError("Impossible de charger ce film.");
      } else if (!data) {
        setError("Ce film est introuvable.");
      } else {
        setMovie(data);
      }

      setLoading(false);
    }

    if (params.id) {
      loadMovie();
    }
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

        {loading && <p>Chargement du film...</p>}

        {error && (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        )}

        {!loading && movie && (
          <div className="grid gap-8 md:grid-cols-[280px_1fr]">
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

              <div className="mt-8 rounded-lg border border-zinc-800 p-5">
                <h2 className="mb-2 text-xl font-semibold">
                  Séances disponibles
                </h2>
                <p className="text-zinc-400">
                  Les séances seront bientôt disponibles.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
