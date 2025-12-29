import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermosServicoPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Termos de Serviço
          </h1>
          <p className="text-slate-400 mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar ou utilizar o sistema de gestão jurídica da Bentes Ramos Advocacia 
                ("Sistema"), você concorda em cumprir estes Termos de Serviço. Se você não 
                concordar com qualquer parte destes termos, não poderá acessar o Sistema.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Descrição do Serviço</h2>
              <p>
                O Sistema é uma plataforma de gestão jurídica que permite o gerenciamento de 
                processos, clientes, documentos, agenda, finanças e comunicações relacionadas 
                à prática advocatícia. O serviço é destinado exclusivamente para uso profissional 
                pelos colaboradores autorizados da Bentes Ramos Advocacia.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Contas de Usuário</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
                <li>Você é responsável por todas as atividades realizadas sob sua conta.</li>
                <li>Você deve notificar imediatamente sobre qualquer uso não autorizado de sua conta.</li>
                <li>O acesso ao Sistema requer aprovação prévia da administração.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Uso Aceitável</h2>
              <p className="mb-3">Ao usar o Sistema, você concorda em:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Usar o Sistema apenas para fins legais e profissionais autorizados</li>
                <li>Não compartilhar suas credenciais de acesso com terceiros</li>
                <li>Não tentar acessar áreas ou dados não autorizados</li>
                <li>Manter a confidencialidade de informações de clientes e processos</li>
                <li>Respeitar as leis aplicáveis e regulamentos profissionais</li>
                <li>Não introduzir vírus, malware ou código malicioso</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Propriedade Intelectual</h2>
              <p>
                O Sistema, incluindo seu design, código, funcionalidades e conteúdo, é protegido 
                por direitos autorais e outras leis de propriedade intelectual. Você não pode 
                copiar, modificar, distribuir ou criar obras derivadas do Sistema sem autorização 
                expressa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Integrações de Terceiros</h2>
              <p>
                O Sistema pode integrar-se com serviços de terceiros (Google Drive, Google Calendar, 
                etc.). O uso dessas integrações está sujeito aos termos de serviço dos respectivos 
                provedores. Não somos responsáveis pelo funcionamento ou políticas desses serviços 
                externos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Confidencialidade</h2>
              <p>
                Todas as informações contidas no Sistema, incluindo dados de clientes, processos, 
                estratégias jurídicas e comunicações, são estritamente confidenciais. O vazamento 
                ou compartilhamento não autorizado dessas informações pode resultar em sanções 
                disciplinares e responsabilização legal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Limitação de Responsabilidade</h2>
              <p>
                O Sistema é fornecido "como está", sem garantias de qualquer tipo. Não nos 
                responsabilizamos por danos diretos, indiretos, incidentais ou consequenciais 
                resultantes do uso ou impossibilidade de uso do Sistema, exceto nos casos 
                previstos em lei.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Disponibilidade</h2>
              <p>
                Embora nos esforcemos para manter o Sistema disponível 24/7, não garantimos 
                disponibilidade ininterrupta. Manutenções programadas e eventos imprevistos 
                podem causar interrupções temporárias.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Encerramento</h2>
              <p>
                Reservamo-nos o direito de suspender ou encerrar seu acesso ao Sistema a 
                qualquer momento, com ou sem aviso prévio, por violação destes termos ou 
                por qualquer outro motivo justificado.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Alterações nos Termos</h2>
              <p>
                Podemos modificar estes Termos de Serviço a qualquer momento. Alterações 
                significativas serão comunicadas através do Sistema. O uso continuado do 
                Sistema após as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Lei Aplicável</h2>
              <p>
                Estes Termos de Serviço são regidos pelas leis da República Federativa do 
                Brasil. Qualquer disputa será resolvida no foro da comarca de Belém/PA, 
                com exclusão de qualquer outro.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">13. Contato</h2>
              <p>
                Para dúvidas sobre estes Termos de Serviço, entre em contato através do 
                e-mail: <a href="mailto:contato@bentesramos.adv.br" className="text-primary hover:underline">contato@bentesramos.adv.br</a>
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

export default TermosServicoPage;
