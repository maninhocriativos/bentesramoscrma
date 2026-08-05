import { Clock3, ShieldCheck } from "lucide-react";
import logoBentesRamos from "@/assets/logo-bentes-ramos-gold.png";

export function SystemLockScreen() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-6 py-12 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_15%,rgba(194,158,93,0.18),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(37,99,235,0.12),transparent_34%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <section className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.055] px-7 py-10 text-center shadow-2xl shadow-black/30 backdrop-blur-sm sm:px-14 sm:py-14">
        <img
          src={logoBentesRamos}
          alt="Bentes & Ramos Advocacia"
          className="mx-auto mb-10 h-auto w-52 max-w-full object-contain sm:w-60"
        />
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c6a469]/30 bg-[#c6a469]/10 text-[#d8bb87]">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#d8bb87]">
          Acesso temporariamente suspenso
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Estamos realizando ajustes no sistema
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-7 text-slate-300 sm:text-lg">
          O CRM está temporariamente indisponível para garantir a segurança e a
          estabilidade dos seus dados. Nossa equipe já está trabalhando para
          restabelecer o acesso.
        </p>
        <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/15 px-4 py-2 text-sm text-slate-300">
          <Clock3 className="h-4 w-4 text-[#d8bb87]" aria-hidden="true" />
          Tente acessar novamente em alguns instantes
        </div>
        <p className="mt-10 text-xs text-slate-500">
          Bentes &amp; Ramos Advocacia
        </p>
      </section>
    </main>
  );
}
