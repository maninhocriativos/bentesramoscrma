import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("rejects empty subscriber_id", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/isa-reply-manychat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ message: "Olá, teste" }),
  });
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, "subscriber_id obrigatório");
});

Deno.test("handles unknown subscriber without crashing", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/isa-reply-manychat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      subscriber_id: "zapi_5500000000000",
      message: "",
      full_name: "Teste",
    }),
  });
  const data = await response.json();
  // Should succeed (skip or process) - not crash
  assertEquals(data.success, true);
});

Deno.test("CORS preflight works", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/isa-reply-manychat`, {
    method: "OPTIONS",
    headers: { "Origin": "https://example.com" },
  });
  assertEquals(response.status, 200);
  await response.body?.cancel();
});
