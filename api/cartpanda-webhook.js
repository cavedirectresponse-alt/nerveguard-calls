export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // Log de segurança
  console.log('Webhook recebido da CartPanda:', data);

  // Se quiser integrar com Retell AI:
  try {
    const retellResponse = await fetch('https://api.retellai.com/v1/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`
      },
      body: JSON.stringify({
        agent_id: process.env.RETELL_AGENT_ID,
        phone_number: data.phone || null,
        metadata: {
          name: data.name,
          checkout_link: data.checkout_url
        }
      })
    });

    const retellData = await retellResponse.json();
    console.log('Retell AI resposta:', retellData);

    res.status(200).json({ success: true, message: 'Webhook enviado à Retell AI com sucesso', retellData });
  } catch (err) {
    console.error('Erro ao enviar para Retell AI:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
