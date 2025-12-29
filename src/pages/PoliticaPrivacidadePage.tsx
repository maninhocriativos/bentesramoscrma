import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PoliticaPrivacidadePage = () => {
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
            Política de Privacidade
          </h1>
          <p className="text-slate-400 mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Introdução</h2>
              <p>
                A Bentes Ramos Advocacia ("nós", "nosso" ou "empresa") está comprometida em proteger 
                sua privacidade. Esta Política de Privacidade explica como coletamos, usamos, 
                divulgamos e protegemos suas informações quando você utiliza nosso sistema de 
                gestão jurídica ("Sistema").
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Informações que Coletamos</h2>
              <p className="mb-3">Podemos coletar os seguintes tipos de informações:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informações de Cadastro:</strong> nome, e-mail, telefone, CPF/CNPJ e outras informações fornecidas durante o registro.</li>
                <li><strong>Dados de Processos:</strong> informações relacionadas a processos jurídicos, documentos e comunicações.</li>
                <li><strong>Dados de Uso:</strong> informações sobre como você interage com o Sistema.</li>
                <li><strong>Dados de Integração:</strong> quando você conecta serviços de terceiros (como Google Drive ou Google Calendar), podemos acessar informações conforme as permissões concedidas.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Como Usamos suas Informações</h2>
              <p className="mb-3">Utilizamos suas informações para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fornecer, manter e melhorar o Sistema</li>
                <li>Processar e gerenciar casos jurídicos</li>
                <li>Comunicar atualizações, prazos e notificações importantes</li>
                <li>Sincronizar dados com serviços integrados (Google Drive, Google Calendar)</li>
                <li>Garantir a segurança e prevenir fraudes</li>
                <li>Cumprir obrigações legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Compartilhamento de Informações</h2>
              <p className="mb-3">Não vendemos suas informações pessoais. Podemos compartilhar dados com:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Provedores de Serviço:</strong> empresas que nos auxiliam na operação do Sistema (hospedagem, armazenamento, etc.)</li>
                <li><strong>Integrações Autorizadas:</strong> serviços que você conectou (Google, etc.)</li>
                <li><strong>Obrigações Legais:</strong> quando exigido por lei ou ordem judicial</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Segurança dos Dados</h2>
              <p>
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas 
                informações contra acesso não autorizado, alteração, divulgação ou destruição. 
                Isso inclui criptografia de dados, controles de acesso e monitoramento contínuo.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Seus Direitos (LGPD)</h2>
              <p className="mb-3">De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Confirmar a existência de tratamento de dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados</li>
                <li>Solicitar portabilidade dos dados</li>
                <li>Revogar consentimento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Retenção de Dados</h2>
              <p>
                Mantemos suas informações pelo tempo necessário para cumprir as finalidades 
                descritas nesta política, a menos que um período de retenção mais longo seja 
                exigido ou permitido por lei.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos 
                sobre alterações significativas através do Sistema ou por e-mail.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Contato</h2>
              <p>
                Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em 
                contato conosco através do e-mail: <a href="mailto:contato@bentesramos.adv.br" className="text-primary hover:underline">contato@bentesramos.adv.br</a>
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

export default PoliticaPrivacidadePage;
