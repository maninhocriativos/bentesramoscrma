import { ArrowLeft, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ExclusaoDadosPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link to="/auth">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 md:p-12">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="h-8 w-8 text-slate-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Exclusão de Dados
            </h1>
          </div>
          <p className="text-slate-400 mb-10">
            Seu direito de solicitar a exclusão dos seus dados pessoais
          </p>

          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Como solicitar a exclusão</h2>
              <p className="leading-relaxed">
                Para solicitar a exclusão dos seus dados, envie uma solicitação para{" "}
                <a
                  href="mailto:bentesramos.adv@gmail.com"
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
                >
                  bentesramos.adv@gmail.com
                </a>{" "}
                informando seu <strong className="text-white">nome</strong>,{" "}
                <strong className="text-white">telefone</strong> e{" "}
                <strong className="text-white">e-mail</strong> utilizados no atendimento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">O que acontece após a solicitação</h2>
              <ul className="list-disc pl-6 space-y-2 leading-relaxed">
                <li>Nossa equipe confirmará o recebimento em até 2 dias úteis.</li>
                <li>A exclusão será processada em até 15 dias úteis após a confirmação de identidade.</li>
                <li>Você receberá um e-mail de confirmação quando os dados forem removidos.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Base legal (LGPD)</h2>
              <p className="leading-relaxed">
                Este serviço está em conformidade com o Art. 18 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018),
                que garante ao titular o direito de solicitar a eliminação dos dados pessoais tratados com base em consentimento.
              </p>
            </section>
          </div>
        </div>

        <p className="text-center text-slate-500 mt-8 text-sm">
          © {new Date().getFullYear()} Bentes Ramos Advocacia. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default ExclusaoDadosPage;
