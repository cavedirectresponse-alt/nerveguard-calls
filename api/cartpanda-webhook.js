export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    // Tenta converter o body para JSON se ainda não for um objeto
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    console.log("📩 Webhook recebido:", body);

    // Simples verificação de estrutura
    if (!body.data || !body.data.phone || !body.data.checkout_url) {
      return res.status(400).json({ success: false, error: "JSON inválido ou incompleto" });
    }

    // (Exemplo) Aqui você pode chamar a API da Retell AI:
    // await fetch("https://api.retellai.com/v1/call", { ... })

    return res.status(200).json({
      success: true,
      message: "Webhook recebido com sucesso",
      received: body
    });
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido"
    });
  }
}
