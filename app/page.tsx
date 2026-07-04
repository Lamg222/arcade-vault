import type { Metadata } from "next";
import Home from "./components/Home";

export const metadata: Metadata = {
  title: "Inicio",
};

export default function HomePage() {
  return <Home />;
}
