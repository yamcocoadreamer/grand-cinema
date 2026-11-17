"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InscriptionPage() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: nom }
      }
    });

    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      router.push("/mon-compte");
    } else {
      setMessage(
        "Inscription enregistrée. Vérifie ton e-mail pour confirmer ton compte."
      );
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Créer un compte
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Nom complet"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          className="w-full rounded border p-3"
        />

        <input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border p-3"
        />

        <input
          type="password"
          placeholder="Mot de passe (6 caractères minimum)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          className="w-full rounded border p-3"
        />

        <button
          disabled={loading}
          className="w-full rounded bg-red-700 p-3 text-white"
        >
          {loading ? "Inscription..." : "S'inscrire"}
        </button>
      </form>

      {message && (
        <p role="status" className="mt-4">{message}</p>
      )}

      <p className="mt-6">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}