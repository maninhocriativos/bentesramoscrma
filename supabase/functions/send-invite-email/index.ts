const serve = Deno.serve;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  role: string;
  inviteLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, inviteLink }: InviteEmailRequest = await req.json();

    console.log(`Sending invite email to ${email} with role ${role}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Bentes & Ramos <noreply@bentesramoscrm.com.br>",
        to: [email],
        subject: "Você foi convidado para o Sistema Bentes & Ramos",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; margin-top: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a365d; margin: 0; font-size: 28px;">Bentes & Ramos</h1>
                <p style="color: #718096; margin: 5px 0 0 0;">Sistema Jurídico</p>
              </div>
              
              <h2 style="color: #2d3748; font-size: 22px; margin-bottom: 20px;">Você foi convidado!</h2>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                Você recebeu um convite para se juntar ao sistema jurídico Bentes & Ramos como <strong style="color: #1a365d;">${role}</strong>.
              </p>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar sua conta e começar a usar o sistema:
              </p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${inviteLink}" style="background-color: #1a365d; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Criar Minha Conta
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; line-height: 1.6;">
                Se o botão não funcionar, copie e cole o seguinte link no seu navegador:
              </p>
              <p style="color: #4299e1; font-size: 14px; word-break: break-all;">
                ${inviteLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              
              <p style="color: #a0aec0; font-size: 12px; text-align: center;">
                Este é um email automático. Por favor, não responda a esta mensagem.
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();
    console.log("Email API response:", data);

    if (!res.ok) {
      console.error("Error from Resend API:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Failed to send email" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
