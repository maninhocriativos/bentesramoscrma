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
      compromissos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          lead_id: string | null
          processo_id: string | null
          responsavel_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
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
          id: string
          nome: string
          processo_id: string | null
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
          id?: string
          nome: string
          processo_id?: string | null
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
          id?: string
          nome?: string
          processo_id?: string | null
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
      leads_juridicos: {
        Row: {
          created_at: string
          email: string | null
          id: string
          link_contrato: string | null
          nome: string | null
          origem: string | null
          resumo_ia: string | null
          status: string | null
          telefone: string | null
          tipo_acao: string | null
          updated_at: string | null
          valor_causa: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          link_contrato?: string | null
          nome?: string | null
          origem?: string | null
          resumo_ia?: string | null
          status?: string | null
          telefone?: string | null
          tipo_acao?: string | null
          updated_at?: string | null
          valor_causa?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          link_contrato?: string | null
          nome?: string | null
          origem?: string | null
          resumo_ia?: string | null
          status?: string | null
          telefone?: string | null
          tipo_acao?: string | null
          updated_at?: string | null
          valor_causa?: number | null
        }
        Relationships: []
      }
      manychat_mensagens: {
        Row: {
          canal: string | null
          conteudo: string
          created_at: string
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
          canal: string | null
          created_at: string
          email: string | null
          foto: string | null
          id: string
          lead_id: string | null
          nome: string | null
          subscriber_id: string
          telefone: string | null
          ultima_interacao: string | null
          updated_at: string
        }
        Insert: {
          canal?: string | null
          created_at?: string
          email?: string | null
          foto?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          subscriber_id: string
          telefone?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string | null
          created_at?: string
          email?: string | null
          foto?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          subscriber_id?: string
          telefone?: string | null
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
      processos: {
        Row: {
          advogado_responsavel: string | null
          cliente_id: string | null
          created_at: string | null
          id: string
          numero_processo: string | null
          status: string | null
          titulo_acao: string | null
        }
        Insert: {
          advogado_responsavel?: string | null
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          numero_processo?: string | null
          status?: string | null
          titulo_acao?: string | null
        }
        Update: {
          advogado_responsavel?: string | null
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          numero_processo?: string | null
          status?: string | null
          titulo_acao?: string | null
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
          cliente_id: string | null
          created_at: string
          data_conclusao: string | null
          data_limite: string | null
          descricao: string | null
          id: string
          prioridade: string | null
          processo_id: string | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_limite?: string | null
          descricao?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checar_cargo_usuario: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
