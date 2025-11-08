export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    console.log("📩 Webhook recebido:", body);

    const { data } = body;

    if (!data || !data.phone || !data.checkout_url) {
      return res.status(400).json({ success: false, error: "JSON inválido ou incompleto" });
    }

    // 🔐 Coloque aqui sua API KEY da Retell AI
    const RETELL_API_KEY = "key_13b1035bc4e3188c3e7d22c325e4";

    // ☎️ Envia pra Retell AI
    const response = await fetch("https://api.retellai.com/v1/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`
      },
      body: JSON.stringify({
        agent_id: "agent_3809fe889afe03c97c390f3a6f", // substitua pelo ID do agente Laura
        phone_number: data.phone,
        metadata: {
          name: data.name,
          checkout_url: data.checkout_url
        }
      })
    });

    const retellResult = await response.json();

    console.log("📞 Retell AI Response:", retellResult);

    return res.status(200).json({
      success: true,
      message: "Webhook recebido e enviado para Retell AI com sucesso",
      retell: retellResult
    });
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido"
    });
  }
}
