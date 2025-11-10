import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📞 Retell callback recebido:", body);

    const reason = body.end_reason;
    const phone = body.to_number;
    const name = body.variables?.name;
    const checkoutUrl = body.variables?.checkout_url;

    const RETRY_REASONS = ["voicemail_reached", "dial_no_answer", "user_declined"];
    const IGNORE_REASONS = ["agent_hangup", "user_hangup"];

    if (RETRY_REASONS.includes(reason)) {
      const filePath = path.resolve("./calls-to-retry.json");
      const oldData = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, "utf8"))
        : [];

      oldData.push({
        name,
        phone,
        checkoutUrl,
        attempt: 1,
        time: Date.now(),
      });

      fs.writeFileSync(filePath, JSON.stringify(oldData, null, 2));
      console.log(`🔁 Ligação malsucedida (${reason}) salva para retry.`);
    }

    if (IGNORE_REASONS.includes(reason)) {
      console.log(`✅ Ligação finalizada normalmente (${reason}). Nenhum retry necessário.`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erro no callback Retell:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
