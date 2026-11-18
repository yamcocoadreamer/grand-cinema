
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Movie = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  genre: string | null;
  poster_url: string | null;
};

export default function FilmsPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadMovies() {
      const { data, error } = await supabase
        .from("movies")
        .select(
          "id, title, description, duration_minutes, genre, poster_url"
        )
        .eq("is_published", true)
        .order("title");

      if (error) {
        setError("Impossible de charger les films.");
      } else {
        setMovies(data ?? []);
      }

      setLoading(false);
    }

    loadMovies();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-3 text-4xl font-bold">
          À l'affiche
        </h1>
        
        <p className="mb-10 text-zinc-400">
          Découvrez les films proposés par La Grande Cinéma.
        </p>

        {loading && <p>Chargement des films...</p>}

        {error && (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && movies.length === 0 && (
          <p>Aucun film disponible pour le moment.</p>
        )}

        {!loading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((movie) => (
              <article
                key={movie.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
              >
                <div className="flex h-64 items-center justify-center bg-zinc-800">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={`Affiche de ${movie.title}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-500">
                      Affiche à venir
                    </span>
                  )}
                </div>

                <div className="p-5">
                  
                    <h2 className="mb-2 text-xl font-semibold">
                        <Link href={`/films/${movie.id}`} className="hover:text-red-400 hover:underline">
                            {movie.title}
                        </Link>
                    </h2>


                  <p className="mb-3 text-sm text-red-400">
                    {movie.genre ?? "Genre non renseigné"}
                    {" · "}
                    {movie.duration_minutes} min
                  </p>

                  <p className="text-sm leading-6 text-zinc-300">
                    {movie.description ?? "Synopsis à venir."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
