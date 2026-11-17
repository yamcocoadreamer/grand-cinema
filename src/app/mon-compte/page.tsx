"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MonComptePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function verifierUtilisateur() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/connexion");
        return;
      }

      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    verifierUtilisateur();
  }, [router]);

  async function deconnexion() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (!error) {
      router.replace("/connexion");
      router.refresh();
    }
  }

  if (loading) {
    return <p className="p-8">Chargement du compte...</p>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">
        Mon espace personnel
      </h1>

      <p className="mt-5">
        Connecté avec : <strong>{email}</strong>
      </p>

      <p className="mt-3">
        Bienvenue sur La Grande Cinéma !
      </p>

      <button
        onClick={deconnexion}
        className="mt-8 rounded bg-red-700 px-5 py-3 text-white"
      >
        Se déconnecter
      </button>
    </main>
  );
}