import type { Metadata } from "next";
import About from "../components/About";

export const metadata: Metadata = {
  title: "Acerca de nosotros",
};

export default function AcercaPage() {
  return <About />;
}
