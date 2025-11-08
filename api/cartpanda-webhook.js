export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook recebido:", body);

    const d = body.data;

    // Extrai dados
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    const rawPhone =
      d?.customer?.phone || d?.customer_info?.phone || d?.phone || null;

    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res.status(400).json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 🔐 Variáveis da Retell
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
    const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

    // ☎️ 1ª tentativa de ligação
    const retellResp = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID,
        from_number: RETELL_FROM_NUMBER,
        to_number: normalizedPhone,
        variables: {
          name,
          checkout_url: checkoutUrl,
        },
      }),
    });

    const retellJson = await retellResp.json();
    console.log("📞 Retell Response:", retellJson);

    // Verifica se a chamada falhou e re-tenta depois de 10 minutos
    if (
      retellJson.status === "error" ||
      retellJson.call_status === "no_answer" ||
      retellJson.call_status === "failed"
    ) {
      console.log("⚠️ Primeira tentativa falhou. Nova tentativa agendada para +10min.");

      // Agenda nova tentativa após 10 minutos
      setTimeout(async () => {
        try {
          const retry = await fetch("https://api.retellai.com/v2/create-phone-call", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RETELL_API_KEY}`,
            },
            body: JSON.stringify({
              agent_id: RETELL_AGENT_ID,
              from_number: RETELL_FROM_NUMBER,
              to_number: normalizedPhone,
              variables: {
                name,
                checkout_url: checkoutUrl,
                retry: true,
              },
            }),
          });
          console.log("🔁 Rechamada feita:", await retry.json());
        } catch (err) {
          console.error("❌ Erro ao tentar novamente:", err);
        }
      }, 10 * 60 * 1000); // 10 minutos
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processado. Ligação enviada à Retell.",
      first_call: retellJson,
    });
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
