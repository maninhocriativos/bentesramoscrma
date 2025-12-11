import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data } = await req.json();
    console.log('Isa Action:', action, data);

    let result: any = { success: false, message: 'Ação não reconhecida' };

    switch (action) {
      case 'criar_compromisso': {
        const { titulo, tipo, data_inicio, data_fim, descricao, lead_id, processo_id } = data;
        
        const { data: compromisso, error } = await supabase
          .from('compromissos')
          .insert({
            titulo,
            tipo: tipo || 'Reunião',
            data_inicio,
            data_fim,
            descricao,
            lead_id,
            processo_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar compromisso:', error);
          result = { success: false, message: `Erro ao criar compromisso: ${error.message}` };
        } else {
          result = { success: true, message: `Compromisso "${titulo}" criado com sucesso para ${new Date(data_inicio).toLocaleString('pt-BR')}`, data: compromisso };
        }
        break;
      }

      case 'criar_tarefa': {
        const { titulo, descricao, data_limite, prioridade, cliente_id, processo_id, responsavel_id } = data;
        
        const { data: tarefa, error } = await supabase
          .from('tarefas')
          .insert({
            titulo,
            descricao,
            data_limite,
            prioridade: prioridade || 'Media',
            status: 'Pendente',
            cliente_id,
            processo_id,
            responsavel_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar tarefa:', error);
          result = { success: false, message: `Erro ao criar tarefa: ${error.message}` };
        } else {
          result = { success: true, message: `Tarefa "${titulo}" criada com sucesso`, data: tarefa };
        }
        break;
      }

      case 'buscar_contratos_clicksign': {
        const clicksignApiKey = Deno.env.get('CLICKSIGN_API_KEY');
        if (!clicksignApiKey) {
          result = { success: false, message: 'Chave da API do Clicksign não configurada' };
          break;
        }

        try {
          const response = await fetch(`https://app.clicksign.com/api/v1/documents?access_token=${clicksignApiKey}&page=1`, {
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error('Falha ao buscar documentos do Clicksign');
          }

          const clicksignData = await response.json();
          const documents = clicksignData.documents || [];
          
          // Mapear status
          const mapStatus = (doc: any): string => {
            if (doc.status === 'closed') return 'Finalizado';
            if (doc.status === 'canceled') return 'Cancelado';
            if (doc.status === 'running') {
              const signers = doc.signers || [];
              const allSigned = signers.length > 0 && signers.every((s: any) => s.signed_at);
              const anySigned = signers.some((s: any) => s.signed_at);
              if (allSigned) return 'Assinado';
              if (anySigned) return 'Assinatura Parcial';
              return 'Aguardando Assinatura';
            }
            return 'Documento Enviado';
          };

          const contratos = documents.map((doc: any) => ({
            nome: doc.filename?.replace(/\.[^/.]+$/, '') || 'Documento',
            status: mapStatus(doc),
            signatarios: doc.signers?.map((s: any) => ({
              nome: s.name,
              email: s.email,
              assinou: !!s.signed_at,
              dataAssinatura: s.signed_at
            })) || [],
            dataEnvio: doc.created_at,
            dataAtualizacao: doc.updated_at,
          }));

          const pendentes = contratos.filter((c: any) => ['Aguardando Assinatura', 'Assinatura Parcial'].includes(c.status));
          const finalizados = contratos.filter((c: any) => ['Assinado', 'Finalizado'].includes(c.status));

          result = { 
            success: true, 
            message: `Encontrados ${contratos.length} contratos: ${pendentes.length} pendentes de assinatura, ${finalizados.length} finalizados`,
            data: { total: contratos.length, pendentes, finalizados, todos: contratos }
          };
        } catch (e) {
          console.error('Erro ao buscar contratos:', e);
          result = { success: false, message: 'Erro ao conectar com Clicksign' };
        }
        break;
      }

      case 'buscar_lead': {
        const { nome, email, telefone } = data;
        
        let query = supabase.from('leads_juridicos').select('*');
        
        if (nome) query = query.ilike('nome', `%${nome}%`);
        if (email) query = query.ilike('email', `%${email}%`);
        if (telefone) query = query.ilike('telefone', `%${telefone}%`);
        
        const { data: leads, error } = await query.limit(10);

        if (error) {
          result = { success: false, message: `Erro ao buscar lead: ${error.message}` };
        } else if (leads && leads.length > 0) {
          result = { success: true, message: `Encontrado(s) ${leads.length} lead(s)`, data: leads };
        } else {
          result = { success: true, message: 'Nenhum lead encontrado com esses critérios', data: [] };
        }
        break;
      }

      case 'criar_interacao': {
        const { cliente_id, tipo, resumo, detalhes, direcao } = data;
        
        const { data: interacao, error } = await supabase
          .from('interacoes')
          .insert({
            cliente_id,
            tipo,
            resumo,
            detalhes,
            direcao: direcao || 'Saída',
            data_interacao: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          result = { success: false, message: `Erro ao registrar interação: ${error.message}` };
        } else {
          result = { success: true, message: 'Interação registrada com sucesso', data: interacao };
        }
        break;
      }

      case 'listar_compromissos': {
        const { data_inicio, data_fim } = data;
        
        let query = supabase
          .from('compromissos')
          .select('*, leads_juridicos(nome)')
          .order('data_inicio', { ascending: true });

        if (data_inicio) query = query.gte('data_inicio', data_inicio);
        if (data_fim) query = query.lte('data_inicio', data_fim);

        const { data: compromissos, error } = await query.limit(20);

        if (error) {
          result = { success: false, message: `Erro ao buscar compromissos: ${error.message}` };
        } else {
          result = { success: true, message: `${compromissos?.length || 0} compromisso(s) encontrado(s)`, data: compromissos };
        }
        break;
      }

      case 'listar_tarefas_pendentes': {
        const { data: tarefas, error } = await supabase
          .from('tarefas')
          .select('*, leads_juridicos(nome), processos(titulo_acao)')
          .in('status', ['Pendente', 'Em Andamento'])
          .order('data_limite', { ascending: true })
          .limit(20);

        if (error) {
          result = { success: false, message: `Erro ao buscar tarefas: ${error.message}` };
        } else {
          result = { success: true, message: `${tarefas?.length || 0} tarefa(s) pendente(s)`, data: tarefas };
        }
        break;
      }

      case 'atualizar_tarefa': {
        const { tarefa_id, status, data_conclusao } = data;
        
        const updateData: any = { status };
        if (status === 'Concluída') {
          updateData.data_conclusao = data_conclusao || new Date().toISOString();
        }

        const { data: tarefa, error } = await supabase
          .from('tarefas')
          .update(updateData)
          .eq('id', tarefa_id)
          .select()
          .single();

        if (error) {
          result = { success: false, message: `Erro ao atualizar tarefa: ${error.message}` };
        } else {
          result = { success: true, message: `Tarefa atualizada para "${status}"`, data: tarefa };
        }
        break;
      }
    }

    console.log('Resultado:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro em isa-actions:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
