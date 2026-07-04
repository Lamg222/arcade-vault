import type { Metadata } from "next";
import Library from "../components/Library";

export const metadata: Metadata = {
  title: "Biblioteca",
};

export default function BibliotecaPage() {
  return <Library />;
}
