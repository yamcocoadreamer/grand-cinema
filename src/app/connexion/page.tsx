"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage("Connexion impossible : " + error.message);
    } else {
      router.push("/mon-compte");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Connexion
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded border p-3"
        />

        <button
          disabled={loading}
          className="w-full rounded bg-red-700 p-3 text-white"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      {message && (
        <p role="alert" className="mt-4">{message}</p>
      )}

      <p className="mt-6">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="underline">
          S'inscrire
        </Link>
      </p>
    </main>
  );
}