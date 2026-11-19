
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold text-red-500"
          >
            LE GRAND CINÉMA
          </Link>

          <nav className="flex flex-wrap gap-4 text-sm">
            <Link href="/films" className="hover:text-red-400">
              Films
            </Link>
            <Link href="/mon-compte" className="hover:text-red-400">
              Mon compte
            </Link>
            <Link href="/connexion" className="hover:text-red-400">
              Connexion
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="mb-4 font-semibold uppercase tracking-widest text-red-500">
          Bienvenue au Grand Cinéma
        </p>

        <h1 className="text-4xl font-extrabold md:text-6xl">
          Vivez le cinéma autrement
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-300">
          Découvrez les films à l'affiche, choisissez votre
          séance et réservez vos places en ligne.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/films"
            className="rounded-lg bg-red-700 px-8 py-4 font-semibold hover:bg-red-600"
          >
            Voir les films
          </Link>

          <Link
            href="/mon-compte"
            className="rounded-lg border border-zinc-600 px-8 py-4 font-semibold hover:bg-zinc-800"
          >
            Mes réservations
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-sm text-zinc-500">
        Le Grand Cinéma — Projet de réservation en ligne
      </footer>
    </main>
  );
}
