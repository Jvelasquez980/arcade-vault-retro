import Link from "next/link";

export function FinalCta() {
  return (
    <section className="home-final reveal">
      <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
      <Link className="btn xl pulse final-cta" href="/games">INSERTAR MONEDA →</Link>
      <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
    </section>
  );
}
