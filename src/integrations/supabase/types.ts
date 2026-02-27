export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          accessed_at: string
          id: string
          page_path: string
          page_title: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          accessed_at?: string
          id?: string
          page_path: string
          page_title?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          accessed_at?: string
          id?: string
          page_path?: string
          page_title?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          content: string
          created_at: string
          greeting_message: string | null
          id: string
          name: string
          strict_mode: boolean | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          greeting_message?: string | null
          id?: string
          name: string
          strict_mode?: boolean | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          greeting_message?: string | null
          id?: string
          name?: string
          strict_mode?: boolean | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chat_tags: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          is_system: boolean | null
          name: string
          requires_reason: boolean | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
          requires_reason?: boolean | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
          requires_reason?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      cnj_assuntos: {
        Row: {
          codigo: string
          created_at: string | null
          nome: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          nome: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          nome?: string
        }
        Relationships: []
      }
      cnj_classes: {
        Row: {
          codigo: string
          created_at: string | null
          nome: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          nome: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          nome?: string
        }
        Relationships: []
      }
      cnj_movimentos: {
        Row: {
          codigo: string
          created_at: string | null
          descricao_padrao: string | null
          titulo: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao_padrao?: string | null
          titulo: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao_padrao?: string | null
          titulo?: string
        }
        Relationships: []
      }
      compromissos: {
        Row: {
          confirmacao_resposta: string | null
          confirmacao_status: string | null
          confirmado_em: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          external_id: string | null
          id: string
          lead_id: string | null
          origem: string | null
          processo_id: string | null
          responsavel_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          confirmacao_resposta?: string | null
          confirmacao_status?: string | null
          confirmado_em?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          origem?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          confirmacao_resposta?: string | null
          confirmacao_status?: string | null
          confirmado_em?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          origem?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromissos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_reminders: {
        Row: {
          contract_created_at: string
          contract_link: string | null
          created_at: string
          document_key: string
          document_name: string | null
          id: string
          last_reminder_at: string | null
          lead_id: string | null
          linked_at: string | null
          linked_by: string | null
          next_reminder_at: string | null
          reminder_stage: number
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          signer_phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contract_created_at?: string
          contract_link?: string | null
          created_at?: string
          document_key: string
          document_name?: string | null
          id?: string
          last_reminder_at?: string | null
          lead_id?: string | null
          linked_at?: string | null
          linked_by?: string | null
          next_reminder_at?: string | null
          reminder_stage?: number
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contract_created_at?: string
          contract_link?: string | null
          created_at?: string
          document_key?: string
          document_name?: string | null
          id?: string
          last_reminder_at?: string | null
          lead_id?: string | null
          linked_at?: string | null
          linked_by?: string | null
          next_reminder_at?: string | null
          reminder_stage?: number
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversations: {
        Row: {
          created_at: string
          id: string
          lead_ref_id: string
          lead_type: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_ref_id: string
          lead_type?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_ref_id?: string
          lead_type?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_messages: {
        Row: {
          channel: string
          conversation_id: string
          created_at: string
          id: string
          message: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          channel?: string
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          sender_name?: string | null
          sender_type?: string
        }
        Update: {
          channel?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "manychat_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          cliente_id: string | null
          comprovante_url: string | null
          created_at: string
          data_despesa: string | null
          data_pagamento: string | null
          descricao: string
          id: string
          processo_id: string | null
          responsavel_pagamento: string | null
          status: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_despesa?: string | null
          data_pagamento?: string | null
          descricao: string
          id?: string
          processo_id?: string | null
          responsavel_pagamento?: string | null
          status?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_despesa?: string | null
          data_pagamento?: string | null
          descricao?: string
          id?: string
          processo_id?: string | null
          responsavel_pagamento?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          arquivo_url: string
          cliente_id: string | null
          created_at: string
          descricao: string | null
          drive_file_id: string | null
          drive_synced_at: string | null
          id: string
          nome: string
          processo_id: string | null
          sync_last_attempt_at: string | null
          sync_last_error: string | null
          sync_retry_count: number
          sync_status: string | null
          tipo: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          arquivo_url: string
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          drive_file_id?: string | null
          drive_synced_at?: string | null
          id?: string
          nome: string
          processo_id?: string | null
          sync_last_attempt_at?: string | null
          sync_last_error?: string | null
          sync_retry_count?: number
          sync_status?: string | null
          tipo: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          arquivo_url?: string
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          drive_file_id?: string | null
          drive_synced_at?: string | null
          id?: string
          nome?: string
          processo_id?: string | null
          sync_last_attempt_at?: string | null
          sync_last_error?: string | null
          sync_retry_count?: number
          sync_status?: string | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_sync_config: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string
          id: string
          last_auto_sync_at: string | null
          sync_interval_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          last_auto_sync_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          last_auto_sync_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drive_sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          direction: string
          document_id: string | null
          drive_file_id: string | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          max_attempts: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          direction: string
          document_id?: string | null
          drive_file_id?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          max_attempts?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          direction?: string
          document_id?: string | null
          drive_file_id?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          max_attempts?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_sync_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      honorarios: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_contrato: string | null
          forma_pagamento: string | null
          id: string
          num_parcelas: number | null
          observacoes: string | null
          percentual_exito: number | null
          processo_id: string | null
          status: string | null
          tipo: string
          updated_at: string
          valor_entrada: number | null
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_contrato?: string | null
          forma_pagamento?: string | null
          id?: string
          num_parcelas?: number | null
          observacoes?: string | null
          percentual_exito?: number | null
          processo_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_contrato?: string | null
          forma_pagamento?: string | null
          id?: string
          num_parcelas?: number | null
          observacoes?: string | null
          percentual_exito?: number | null
          processo_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          direction: string
          duration_ms: number | null
          endpoint: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          payload_json: Json | null
          provider: string
          response_json: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          duration_ms?: number | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload_json?: Json | null
          provider: string
          response_json?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          duration_ms?: number | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload_json?: Json | null
          provider?: string
          response_json?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_config: {
        Row: {
          config_json: Json
          created_at: string
          id: string
          is_active: boolean | null
          last_test_at: string | null
          last_test_status: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      interacoes: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_interacao: string
          detalhes: string | null
          direcao: string | null
          id: string
          processo_id: string | null
          responsavel_id: string | null
          resumo: string
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_interacao?: string
          detalhes?: string | null
          direcao?: string | null
          id?: string
          processo_id?: string | null
          responsavel_id?: string | null
          resumo: string
          tipo: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_interacao?: string
          detalhes?: string | null
          direcao?: string | null
          id?: string
          processo_id?: string | null
          responsavel_id?: string | null
          resumo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_classifications: {
        Row: {
          case_type: string
          classified_by: string | null
          confidence_score: number | null
          created_at: string
          id: string
          lead_id: string
          recommended_docs: string[] | null
          sub_type: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          case_type: string
          classified_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          lead_id: string
          recommended_docs?: string[] | null
          sub_type?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          case_type?: string
          classified_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          lead_id?: string
          recommended_docs?: string[] | null
          sub_type?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_classifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contract_data: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          dados_extras: Json | null
          data_nascimento: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          lead_id: string
          nacionalidade: string | null
          nome_mae: string | null
          profissao: string | null
          rg: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          dados_extras?: Json | null
          data_nascimento?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          lead_id: string
          nacionalidade?: string | null
          nome_mae?: string | null
          profissao?: string | null
          rg?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          dados_extras?: Json | null
          data_nascimento?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          lead_id?: string
          nacionalidade?: string | null
          nome_mae?: string | null
          profissao?: string | null
          rg?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contract_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_docs_checklist: {
        Row: {
          created_at: string
          doc_label: string
          doc_type: string
          file_id: string | null
          id: string
          is_required: boolean | null
          lead_id: string
          notes: string | null
          received: boolean | null
          received_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_label: string
          doc_type: string
          file_id?: string | null
          id?: string
          is_required?: boolean | null
          lead_id: string
          notes?: string | null
          received?: boolean | null
          received_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_label?: string
          doc_type?: string
          file_id?: string | null
          id?: string
          is_required?: boolean | null
          lead_id?: string
          notes?: string | null
          received?: boolean | null
          received_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_docs_checklist_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_docs_checklist_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          canal: string | null
          created_at: string
          followup_1_enviado: boolean | null
          followup_1_enviado_em: string | null
          followup_2_enviado: boolean | null
          followup_2_enviado_em: string | null
          followup_3_enviado: boolean | null
          followup_3_enviado_em: string | null
          followup_lock_reason: string | null
          followup_stage_fast: number | null
          followup_stage_slow: number | null
          id: string
          last_inbound_at: string | null
          last_isa_outbound_at: string | null
          last_outbound_at: string | null
          lead_id: string
          next_followup_at: string | null
          next_followup_type: string | null
          primeiro_contato_em: string
          respondido: boolean | null
          respondido_em: string | null
          retomada_1_enviado: boolean | null
          retomada_1_enviado_em: string | null
          retomada_2_enviado: boolean | null
          retomada_2_enviado_em: string | null
          retomada_3_enviado: boolean | null
          retomada_3_enviado_em: string | null
          status: string | null
          subscriber_id: string | null
          updated_at: string
          waiting_reply: boolean | null
        }
        Insert: {
          canal?: string | null
          created_at?: string
          followup_1_enviado?: boolean | null
          followup_1_enviado_em?: string | null
          followup_2_enviado?: boolean | null
          followup_2_enviado_em?: string | null
          followup_3_enviado?: boolean | null
          followup_3_enviado_em?: string | null
          followup_lock_reason?: string | null
          followup_stage_fast?: number | null
          followup_stage_slow?: number | null
          id?: string
          last_inbound_at?: string | null
          last_isa_outbound_at?: string | null
          last_outbound_at?: string | null
          lead_id: string
          next_followup_at?: string | null
          next_followup_type?: string | null
          primeiro_contato_em?: string
          respondido?: boolean | null
          respondido_em?: string | null
          retomada_1_enviado?: boolean | null
          retomada_1_enviado_em?: string | null
          retomada_2_enviado?: boolean | null
          retomada_2_enviado_em?: string | null
          retomada_3_enviado?: boolean | null
          retomada_3_enviado_em?: string | null
          status?: string | null
          subscriber_id?: string | null
          updated_at?: string
          waiting_reply?: boolean | null
        }
        Update: {
          canal?: string | null
          created_at?: string
          followup_1_enviado?: boolean | null
          followup_1_enviado_em?: string | null
          followup_2_enviado?: boolean | null
          followup_2_enviado_em?: string | null
          followup_3_enviado?: boolean | null
          followup_3_enviado_em?: string | null
          followup_lock_reason?: string | null
          followup_stage_fast?: number | null
          followup_stage_slow?: number | null
          id?: string
          last_inbound_at?: string | null
          last_isa_outbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string
          next_followup_at?: string | null
          next_followup_type?: string | null
          primeiro_contato_em?: string
          respondido?: boolean | null
          respondido_em?: string | null
          retomada_1_enviado?: boolean | null
          retomada_1_enviado_em?: string | null
          retomada_2_enviado?: boolean | null
          retomada_2_enviado_em?: string | null
          retomada_3_enviado?: boolean | null
          retomada_3_enviado_em?: string | null
          status?: string | null
          subscriber_id?: string | null
          updated_at?: string
          waiting_reply?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_state_history: {
        Row: {
          changed_by: string
          created_at: string
          from_state: string | null
          id: string
          lead_id: string
          reason: string | null
          to_state: string
        }
        Insert: {
          changed_by?: string
          created_at?: string
          from_state?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_state: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_state?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_state_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_juridicos: {
        Row: {
          bairro: string | null
          canal_origem: string | null
          cep: string | null
          cidade: string | null
          contract_key: string | null
          contract_sent_at: string | null
          contract_signed_at: string | null
          contratos_adicionais: number | null
          cpf: string | null
          created_at: string
          email: string | null
          empresa_tag: string | null
          endereco: string | null
          estado_civil: string | null
          facebook_lead_id: string | null
          fonte_trafego: string | null
          id: string
          is_lost: boolean | null
          isa_ativa: boolean | null
          last_contact_at: string | null
          lead_state: string | null
          linha_whatsapp: string | null
          link_contrato: string | null
          lost_at: string | null
          lost_reason: string | null
          nacionalidade: string | null
          nome: string | null
          numero: string | null
          origem: string | null
          owner_tipo: string | null
          profissao: string | null
          resumo_ia: string | null
          rg: string | null
          state_updated_at: string | null
          status: string | null
          telefone: string | null
          tipo_acao: string | null
          tipo_origem: string | null
          triage_started_at: string | null
          uf: string | null
          updated_at: string | null
          valor_causa: number | null
          whatsapp_numero_destino: string | null
        }
        Insert: {
          bairro?: string | null
          canal_origem?: string | null
          cep?: string | null
          cidade?: string | null
          contract_key?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contratos_adicionais?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_tag?: string | null
          endereco?: string | null
          estado_civil?: string | null
          facebook_lead_id?: string | null
          fonte_trafego?: string | null
          id?: string
          is_lost?: boolean | null
          isa_ativa?: boolean | null
          last_contact_at?: string | null
          lead_state?: string | null
          linha_whatsapp?: string | null
          link_contrato?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          nacionalidade?: string | null
          nome?: string | null
          numero?: string | null
          origem?: string | null
          owner_tipo?: string | null
          profissao?: string | null
          resumo_ia?: string | null
          rg?: string | null
          state_updated_at?: string | null
          status?: string | null
          telefone?: string | null
          tipo_acao?: string | null
          tipo_origem?: string | null
          triage_started_at?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          whatsapp_numero_destino?: string | null
        }
        Update: {
          bairro?: string | null
          canal_origem?: string | null
          cep?: string | null
          cidade?: string | null
          contract_key?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contratos_adicionais?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_tag?: string | null
          endereco?: string | null
          estado_civil?: string | null
          facebook_lead_id?: string | null
          fonte_trafego?: string | null
          id?: string
          is_lost?: boolean | null
          isa_ativa?: boolean | null
          last_contact_at?: string | null
          lead_state?: string | null
          linha_whatsapp?: string | null
          link_contrato?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          nacionalidade?: string | null
          nome?: string | null
          numero?: string | null
          origem?: string | null
          owner_tipo?: string | null
          profissao?: string | null
          resumo_ia?: string | null
          rg?: string | null
          state_updated_at?: string | null
          status?: string | null
          telefone?: string | null
          tipo_acao?: string | null
          tipo_origem?: string | null
          triage_started_at?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          whatsapp_numero_destino?: string | null
        }
        Relationships: []
      }
      manychat_mensagens: {
        Row: {
          canal: string | null
          conteudo: string
          created_at: string
          deleted_for_all: boolean | null
          direcao: string
          id: string
          lead_id: string | null
          metadata: Json | null
          subscriber_foto: string | null
          subscriber_id: string
          subscriber_nome: string | null
          tipo: string | null
        }
        Insert: {
          canal?: string | null
          conteudo: string
          created_at?: string
          deleted_for_all?: boolean | null
          direcao?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          subscriber_foto?: string | null
          subscriber_id: string
          subscriber_nome?: string | null
          tipo?: string | null
        }
        Update: {
          canal?: string | null
          conteudo?: string
          created_at?: string
          deleted_for_all?: boolean | null
          direcao?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          subscriber_foto?: string | null
          subscriber_id?: string
          subscriber_nome?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manychat_mensagens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      manychat_subscribers: {
        Row: {
          atendimento_humano: boolean | null
          atendimento_humano_desde: string | null
          canal: string | null
          created_at: string
          email: string | null
          empresa_tag: string | null
          foto: string | null
          id: string
          instance_name: string | null
          lead_id: string | null
          linha_whatsapp: string | null
          nome: string | null
          subscriber_id: string
          telefone: string | null
          telefone_normalizado: string | null
          ultima_interacao: string | null
          updated_at: string
        }
        Insert: {
          atendimento_humano?: boolean | null
          atendimento_humano_desde?: string | null
          canal?: string | null
          created_at?: string
          email?: string | null
          empresa_tag?: string | null
          foto?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          linha_whatsapp?: string | null
          nome?: string | null
          subscriber_id: string
          telefone?: string | null
          telefone_normalizado?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Update: {
          atendimento_humano?: boolean | null
          atendimento_humano_desde?: string | null
          canal?: string | null
          created_at?: string
          email?: string | null
          empresa_tag?: string | null
          foto?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          linha_whatsapp?: string | null
          nome?: string | null
          subscriber_id?: string
          telefone?: string | null
          telefone_normalizado?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manychat_subscribers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_at: string
          created_time: string | null
          email: string | null
          form_fields: Json | null
          form_id: string | null
          id: string
          last_contact_at: string | null
          linked_lead_id: string | null
          meta_lead_id: string
          nome: string | null
          raw: Json | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_time?: string | null
          email?: string | null
          form_fields?: Json | null
          form_id?: string | null
          id?: string
          last_contact_at?: string | null
          linked_lead_id?: string | null
          meta_lead_id: string
          nome?: string | null
          raw?: Json | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_time?: string | null
          email?: string | null
          form_fields?: Json | null
          form_id?: string | null
          id?: string
          last_contact_at?: string | null
          linked_lead_id?: string | null
          meta_lead_id?: string
          nome?: string | null
          raw?: Json | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_form_leads_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      model_chunks: {
        Row: {
          chunk_type: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          model_id: string | null
          petition_type_slug: string | null
        }
        Insert: {
          chunk_type?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          model_id?: string | null
          petition_type_slug?: string | null
        }
        Update: {
          chunk_type?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          model_id?: string | null
          petition_type_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_chunks_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "petition_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_chunks_petition_type_slug_fkey"
            columns: ["petition_type_slug"]
            isOneToOne: false
            referencedRelation: "petition_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      modelos_contratos: {
        Row: {
          arquivo_nome: string
          arquivo_url: string
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_url: string
          categoria: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_url?: string
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes_prazos: {
        Row: {
          canal: string | null
          compromisso_id: string | null
          created_at: string
          data_prazo: string
          destinatario_id: string | null
          dias_antecedencia: number | null
          id: string
          notificado: boolean | null
          notificado_em: string | null
          processo_id: string | null
          tarefa_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          canal?: string | null
          compromisso_id?: string | null
          created_at?: string
          data_prazo: string
          destinatario_id?: string | null
          dias_antecedencia?: number | null
          id?: string
          notificado?: boolean | null
          notificado_em?: string | null
          processo_id?: string | null
          tarefa_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          canal?: string | null
          compromisso_id?: string | null
          created_at?: string
          data_prazo?: string
          destinatario_id?: string | null
          dias_antecedencia?: number | null
          id?: string
          notificado?: boolean | null
          notificado_em?: string | null
          processo_id?: string | null
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_prazos_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromissos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_prazos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          address: string | null
          address_main: string | null
          address_secondary: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          lawyer_name: string | null
          logo_url: string | null
          oab_main: string | null
          oab_number: string | null
          oab_secondary: string | null
          oab_state: string | null
          office_name: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_main?: string | null
          address_secondary?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          lawyer_name?: string | null
          logo_url?: string | null
          oab_main?: string | null
          oab_number?: string | null
          oab_secondary?: string | null
          oab_state?: string | null
          office_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_main?: string | null
          address_secondary?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          lawyer_name?: string | null
          logo_url?: string | null
          oab_main?: string | null
          oab_number?: string | null
          oab_secondary?: string | null
          oab_state?: string | null
          office_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          honorario_id: string | null
          id: string
          numero: number
          status: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          honorario_id?: string | null
          id?: string
          numero: number
          status?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          honorario_id?: string | null
          id?: string
          numero?: number
          status?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      perfis: {
        Row: {
          aprovado: boolean | null
          cargo: string | null
          email: string | null
          id: string
          nome: string | null
          sobrenome: string | null
          telefone: string | null
        }
        Insert: {
          aprovado?: boolean | null
          cargo?: string | null
          email?: string | null
          id: string
          nome?: string | null
          sobrenome?: string | null
          telefone?: string | null
        }
        Update: {
          aprovado?: boolean | null
          cargo?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          sobrenome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      petition_audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          meta: Json | null
          petition_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          petition_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          petition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petition_audit_log_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          },
        ]
      }
      petition_documents: {
        Row: {
          created_at: string
          docx_url: string | null
          generated_by: string | null
          html_content: string | null
          id: string
          notes: string | null
          pdf_url: string | null
          petition_id: string
          version: number | null
        }
        Insert: {
          created_at?: string
          docx_url?: string | null
          generated_by?: string | null
          html_content?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          petition_id: string
          version?: number | null
        }
        Update: {
          created_at?: string
          docx_url?: string | null
          generated_by?: string | null
          html_content?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          petition_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "petition_documents_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          },
        ]
      }
      petition_models: {
        Row: {
          created_at: string
          created_by: string | null
          extracted_sections: Json | null
          extracted_text: string | null
          file_type: string | null
          file_url: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          petition_type_slug: string | null
          tags: string | null
          title: string
          updated_at: string
          variables_map: Json | null
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extracted_sections?: Json | null
          extracted_text?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          petition_type_slug?: string | null
          tags?: string | null
          title: string
          updated_at?: string
          variables_map?: Json | null
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extracted_sections?: Json | null
          extracted_text?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          petition_type_slug?: string | null
          tags?: string | null
          title?: string
          updated_at?: string
          variables_map?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petition_models_petition_type_slug_fkey"
            columns: ["petition_type_slug"]
            isOneToOne: false
            referencedRelation: "petition_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      petition_types: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean | null
          icon: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          icon?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          icon?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      petitions: {
        Row: {
          client_cpf: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          model_id: string | null
          payload: Json | null
          petition_type_slug: string | null
          status: string | null
          step_current: number | null
          summary_isa: string | null
          updated_at: string
          updated_by: string | null
          validation_isa: Json | null
        }
        Insert: {
          client_cpf?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          model_id?: string | null
          payload?: Json | null
          petition_type_slug?: string | null
          status?: string | null
          step_current?: number | null
          summary_isa?: string | null
          updated_at?: string
          updated_by?: string | null
          validation_isa?: Json | null
        }
        Update: {
          client_cpf?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          model_id?: string | null
          payload?: Json | null
          petition_type_slug?: string | null
          status?: string | null
          step_current?: number | null
          summary_isa?: string | null
          updated_at?: string
          updated_by?: string | null
          validation_isa?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "petitions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petitions_petition_type_slug_fkey"
            columns: ["petition_type_slug"]
            isOneToOne: false
            referencedRelation: "petition_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      processo_assuntos: {
        Row: {
          assunto_cnj_codigo: string | null
          assunto_nome: string
          created_at: string | null
          id: string
          processo_id: string
        }
        Insert: {
          assunto_cnj_codigo?: string | null
          assunto_nome: string
          created_at?: string | null
          id?: string
          processo_id: string
        }
        Update: {
          assunto_cnj_codigo?: string | null
          assunto_nome?: string
          created_at?: string | null
          id?: string
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_assuntos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_movimentacoes: {
        Row: {
          created_at: string | null
          data_movimento: string | null
          hash_unico: string | null
          id: string
          movimento_cnj_codigo: string | null
          movimento_descricao: string | null
          movimento_titulo: string
          ordem: number | null
          origem: string | null
          processo_id: string
        }
        Insert: {
          created_at?: string | null
          data_movimento?: string | null
          hash_unico?: string | null
          id?: string
          movimento_cnj_codigo?: string | null
          movimento_descricao?: string | null
          movimento_titulo: string
          ordem?: number | null
          origem?: string | null
          processo_id: string
        }
        Update: {
          created_at?: string | null
          data_movimento?: string | null
          hash_unico?: string | null
          id?: string
          movimento_cnj_codigo?: string | null
          movimento_descricao?: string | null
          movimento_titulo?: string
          ordem?: number | null
          origem?: string | null
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_partes: {
        Row: {
          advogados: Json | null
          created_at: string
          documento: string | null
          hash_unico: string | null
          id: string
          nome: string
          polo: string | null
          processo_id: string
          tipo: string
          tipo_pessoa: string | null
        }
        Insert: {
          advogados?: Json | null
          created_at?: string
          documento?: string | null
          hash_unico?: string | null
          id?: string
          nome: string
          polo?: string | null
          processo_id: string
          tipo: string
          tipo_pessoa?: string | null
        }
        Update: {
          advogados?: Json | null
          created_at?: string
          documento?: string | null
          hash_unico?: string | null
          id?: string
          nome?: string
          polo?: string | null
          processo_id?: string
          tipo?: string
          tipo_pessoa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processo_partes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_sync_log: {
        Row: {
          cnj: string | null
          created_at: string
          duracao_ms: number | null
          http_code: number | null
          id: string
          mensagem: string | null
          movimentacoes_novas: number | null
          origem_tentada: string
          processo_id: string | null
          status: string
        }
        Insert: {
          cnj?: string | null
          created_at?: string
          duracao_ms?: number | null
          http_code?: number | null
          id?: string
          mensagem?: string | null
          movimentacoes_novas?: number | null
          origem_tentada: string
          processo_id?: string | null
          status: string
        }
        Update: {
          cnj?: string | null
          created_at?: string
          duracao_ms?: number | null
          http_code?: number | null
          id?: string
          mensagem?: string | null
          movimentacoes_novas?: number | null
          origem_tentada?: string
          processo_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_sync_log_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          advogado_responsavel: string | null
          ajuizado_em: string | null
          assunto: string | null
          cache_valid_until: string | null
          classe_cnj: string | null
          classe_cnj_codigo: string | null
          classe_cnj_nome: string | null
          cliente_id: string | null
          cnj_normalizado: string | null
          created_at: string | null
          dados_datajud: Json | null
          data_ajuizamento: string | null
          data_ultima_atualizacao: string | null
          fonte_preferida: string | null
          fonte_raw: Json | null
          frequencia_notificacao_dias: number | null
          grau: string | null
          grau_formato: string | null
          id: string
          movimentos_json: Json | null
          notificacao_ativa: boolean | null
          numero_processo: string | null
          orgao_julgador: string | null
          partes_json: Json | null
          sigilo: string | null
          sistema: string | null
          status: string | null
          status_detalhado: string | null
          titulo_acao: string | null
          tribunal: string | null
          ultima_atualizacao: string | null
          ultima_consulta_api_at: string | null
          ultima_notificacao_at: string | null
          updated_at: string | null
          valor_causa: number | null
          vara_comarca: string | null
        }
        Insert: {
          advogado_responsavel?: string | null
          ajuizado_em?: string | null
          assunto?: string | null
          cache_valid_until?: string | null
          classe_cnj?: string | null
          classe_cnj_codigo?: string | null
          classe_cnj_nome?: string | null
          cliente_id?: string | null
          cnj_normalizado?: string | null
          created_at?: string | null
          dados_datajud?: Json | null
          data_ajuizamento?: string | null
          data_ultima_atualizacao?: string | null
          fonte_preferida?: string | null
          fonte_raw?: Json | null
          frequencia_notificacao_dias?: number | null
          grau?: string | null
          grau_formato?: string | null
          id?: string
          movimentos_json?: Json | null
          notificacao_ativa?: boolean | null
          numero_processo?: string | null
          orgao_julgador?: string | null
          partes_json?: Json | null
          sigilo?: string | null
          sistema?: string | null
          status?: string | null
          status_detalhado?: string | null
          titulo_acao?: string | null
          tribunal?: string | null
          ultima_atualizacao?: string | null
          ultima_consulta_api_at?: string | null
          ultima_notificacao_at?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          vara_comarca?: string | null
        }
        Update: {
          advogado_responsavel?: string | null
          ajuizado_em?: string | null
          assunto?: string | null
          cache_valid_until?: string | null
          classe_cnj?: string | null
          classe_cnj_codigo?: string | null
          classe_cnj_nome?: string | null
          cliente_id?: string | null
          cnj_normalizado?: string | null
          created_at?: string | null
          dados_datajud?: Json | null
          data_ajuizamento?: string | null
          data_ultima_atualizacao?: string | null
          fonte_preferida?: string | null
          fonte_raw?: Json | null
          frequencia_notificacao_dias?: number | null
          grau?: string | null
          grau_formato?: string | null
          id?: string
          movimentos_json?: Json | null
          notificacao_ativa?: boolean | null
          numero_processo?: string | null
          orgao_julgador?: string | null
          partes_json?: Json | null
          sigilo?: string | null
          sistema?: string | null
          status?: string | null
          status_detalhado?: string | null
          titulo_acao?: string | null
          tribunal?: string | null
          ultima_atualizacao?: string | null
          ultima_consulta_api_at?: string | null
          ultima_notificacao_at?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          vara_comarca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      procuracoes: {
        Row: {
          created_at: string
          created_by: string | null
          html_content: string
          id: string
          lead_id: string | null
          objetivo: string | null
          pdf_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html_content: string
          id?: string
          lead_id?: string | null
          objetivo?: string | null
          pdf_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html_content?: string
          id?: string
          lead_id?: string | null
          objetivo?: string | null
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procuracoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "manychat_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_tags: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          reason: string | null
          subscriber_id: string
          tag_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          subscriber_id: string
          tag_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          subscriber_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "chat_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          acao: string
          created_at: string
          dados: Json | null
          entidade_id: string | null
          entidade_tipo: string | null
          erro: string | null
          fonte: string
          id: string
          ip_origem: string | null
          lead_id: string | null
          metadata: Json | null
          processado: boolean | null
          tipo: string
          user_agent: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          fonte: string
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          metadata?: Json | null
          processado?: boolean | null
          tipo: string
          user_agent?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          fonte?: string
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          metadata?: Json | null
          processado?: boolean | null
          tipo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          aprovacao_feedback: string | null
          aprovacao_nota: number | null
          aprovacao_status: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          cliente_id: string | null
          created_at: string
          data_conclusao: string | null
          data_limite: string | null
          descricao: string | null
          entrega_anexo_url: string | null
          entrega_texto: string | null
          entregue_em: string | null
          id: string
          prioridade: string | null
          processo_id: string | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          aprovacao_feedback?: string | null
          aprovacao_nota?: number | null
          aprovacao_status?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_limite?: string | null
          descricao?: string | null
          entrega_anexo_url?: string | null
          entrega_texto?: string | null
          entregue_em?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          aprovacao_feedback?: string | null
          aprovacao_nota?: number | null
          aprovacao_status?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_limite?: string | null
          descricao?: string | null
          entrega_anexo_url?: string | null
          entrega_texto?: string | null
          entregue_em?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_atividade: string
          descricao: string
          duracao_minutos: number
          faturavel: boolean | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          processo_id: string | null
          tarefa_id: string | null
          tipo_atividade: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_atividade?: string
          descricao: string
          duracao_minutos?: number
          faturavel?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          processo_id?: string | null
          tarefa_id?: string | null
          tipo_atividade?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_atividade?: string
          descricao?: string
          duracao_minutos?: number
          faturavel?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          processo_id?: string | null
          tarefa_id?: string | null
          tipo_atividade?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_followups: {
        Row: {
          automation_active: boolean | null
          created_at: string
          current_stage: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          lead_id: string
          next_message_at: string | null
          pause_reason: string | null
          stages_sent: Json | null
          status: string | null
          subscriber_id: string | null
          telefone: string
          total_messages_sent: number | null
          updated_at: string
        }
        Insert: {
          automation_active?: boolean | null
          created_at?: string
          current_stage?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id: string
          next_message_at?: string | null
          pause_reason?: string | null
          stages_sent?: Json | null
          status?: string | null
          subscriber_id?: string | null
          telefone: string
          total_messages_sent?: number | null
          updated_at?: string
        }
        Update: {
          automation_active?: boolean | null
          created_at?: string
          current_stage?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id?: string
          next_message_at?: string | null
          pause_reason?: string | null
          stages_sent?: Json | null
          status?: string | null
          subscriber_id?: string | null
          telefone?: string
          total_messages_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zapi_followups: {
        Row: {
          created_at: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_id: string
          lock_reason: string | null
          next_followup_at: string | null
          primeiro_contato_em: string
          respondido: boolean | null
          respondido_em: string | null
          stage_fast: number | null
          stage_slow: number | null
          status: string | null
          subscriber_id: string
          telefone: string
          total_followups_enviados: number | null
          ultimo_tipo_enviado: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id: string
          lock_reason?: string | null
          next_followup_at?: string | null
          primeiro_contato_em?: string
          respondido?: boolean | null
          respondido_em?: string | null
          stage_fast?: number | null
          stage_slow?: number | null
          status?: string | null
          subscriber_id: string
          telefone: string
          total_followups_enviados?: number | null
          ultimo_tipo_enviado?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string
          lock_reason?: string | null
          next_followup_at?: string | null
          primeiro_contato_em?: string
          respondido?: boolean | null
          respondido_em?: string | null
          stage_fast?: number | null
          stage_slow?: number | null
          status?: string | null
          subscriber_id?: string
          telefone?: string
          total_followups_enviados?: number | null
          ultimo_tipo_enviado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_juridicos"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_instances: {
        Row: {
          client_token: string | null
          created_at: string
          id: string
          instance_id: string
          is_active: boolean | null
          is_default: boolean | null
          last_test_at: string | null
          last_test_status: string | null
          name: string
          phone_number: string | null
          token: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          name: string
          phone_number?: string | null
          token: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          name?: string
          phone_number?: string | null
          token?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checar_cargo_usuario: { Args: never; Returns: string }
      gerar_hash_movimentacao: {
        Args: {
          p_cnj: string
          p_data: string
          p_descricao: string
          p_titulo: string
        }
        Returns: string
      }
      gerar_hash_parte: {
        Args: {
          p_documento: string
          p_nome: string
          p_processo_id: string
          p_tipo: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_inactive_leads_as_lost: { Args: never; Returns: number }
      match_chunks: {
        Args: {
          filter_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_type: string
          content: string
          id: string
          model_id: string
          similarity: number
        }[]
      }
      normalize_phone_number: { Args: { phone: string }; Returns: string }
      update_lead_state: {
        Args: {
          p_changed_by?: string
          p_lead_id: string
          p_reason?: string
          p_to_state: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "Administrador" | "Advogado" | "Secretaria" | "Gerente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["Administrador", "Advogado", "Secretaria", "Gerente"],
    },
  },
} as const
