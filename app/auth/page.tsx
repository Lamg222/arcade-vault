import type { Metadata } from "next";
import Auth from "../components/Auth";

export const metadata: Metadata = {
  title: "Acceso",
};

/* `searchParams` es Promise en Next 16. `error` lo escribe el callback de auth (enlace expirado, OAuth cancelado — REQ-10/12). */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <Auth callbackError={error} />;
}
