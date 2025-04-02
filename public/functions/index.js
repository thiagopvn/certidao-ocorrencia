const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Configuração do transporter para envio de e-mails usando Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "certidao.gocg@gmail.com",
    pass: "qojx cpvo gogo dzek", // Senha de app atualizada
  },
});

// Função Cloud HTTP para enviar e-mail quando a certidão estiver pronta
exports.sendCertidaoEmail = functions.https.onRequest(async (req, res) => {
  // Configurar CORS
  res.set("Access-Control-Allow-Origin", "*");

  // Responder para requisições de preflight OPTIONS
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

  try {
    // Verificar método da requisição
    if (req.method !== "POST") {
      return res.status(405).send("Método não permitido");
    }

    // Obter dados do request
    const { to, subject, occurrenceNumber, userName, certidaoUrl } = req.body;

    // Validar parâmetros obrigatórios
    if (!to || !occurrenceNumber || !certidaoUrl) {
      return res.status(400).json({
        success: false,
        message:
          "Parâmetros obrigatórios não fornecidos (to, occurrenceNumber, certidaoUrl)",
      });
    }

    // Verificar formato do e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: "Formato de e-mail inválido",
      });
    }

    // Criar conteúdo do e-mail com template HTML
    const mailOptions = {
      from: "Certidões de Ocorrência <certidao.gocg@gmail.com>",
      to: to,
      subject:
        subject || `Certidão de Ocorrência ${occurrenceNumber} está pronta`,
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Sua Certidão de Ocorrência está pronta!</h1>
            </div>
            
            <div style="padding: 20px;">
              <p>Olá, ${userName || "Solicitante"}!</p>
              
              <p>Temos o prazer de informar que sua Certidão de Ocorrência <strong>${occurrenceNumber}</strong> foi emitida e já está disponível para você.</p>
              
              <p>Você pode acessar sua certidão através do link abaixo ou entrando no nosso sistema e consultando com seu CPF.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${certidaoUrl}" 
                  style="background-color: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                  Visualizar Certidão
                </a>
              </div>
              
              <p>Se você tiver qualquer dúvida, por favor, entre em contato conosco.</p>
              
              <p>Atenciosamente,<br>
              Equipe de Certidões de Ocorrência</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center;">
              <p>Este é um e-mail automático. Por favor, não responda esta mensagem.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    // Enviar e-mail
    await transporter.sendMail(mailOptions);

    // Registrar o envio no Firebase para referência futura
    await admin
      .database()
      .ref(`ocorrencias/${occurrenceNumber}/notifications`)
      .push({
        type: "email",
        status: "sent",
        to: to,
        timestamp: admin.database.ServerValue.TIMESTAMP,
      });

    // Retornar resposta de sucesso
    return res.status(200).json({
      success: true,
      message: "E-mail enviado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao enviar e-mail",
      error: error.message,
    });
  }
});

// Função Cloud alternativa que envia e-mail automaticamente quando uma certidão for anexada
// Esta função é ativada por evento de banco de dados
exports.sendEmailOnCertidaoUpload = functions.database
  .ref("/ocorrencias/{occurrenceNumber}/certidao")
  .onWrite(async (change, context) => {
    try {
      // Não fazer nada se a certidão foi removida
      if (!change.after.exists()) {
        return null;
      }

      // Não fazer nada se isto não é uma criação nova (é apenas uma atualização)
      if (
        change.before.exists() &&
        change.before.val().url === change.after.val().url
      ) {
        return null;
      }

      const occurrenceNumber = context.params.occurrenceNumber;

      // Obter dados da ocorrência
      const occurrenceSnapshot = await admin
        .database()
        .ref(`/ocorrencias/${occurrenceNumber}`)
        .once("value");

      const occurrenceData = occurrenceSnapshot.val();

      // Verificar se temos os dados necessários
      if (
        !occurrenceData ||
        !occurrenceData.email ||
        !occurrenceData.certidao
      ) {
        console.log("Dados insuficientes para envio de e-mail");
        return null;
      }

      // Status deve ser concluído para enviar e-mail
      if (occurrenceData.status !== "Concluído") {
        console.log("Status não é Concluído, e-mail não será enviado");
        return null;
      }

      // Conteúdo do e-mail
      const mailOptions = {
        from: "Certidões de Ocorrência <certidao.gocg@gmail.com>",
        to: occurrenceData.email,
        subject: `Certidão de Ocorrência ${occurrenceNumber} está pronta`,
        html: `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Sua Certidão de Ocorrência está pronta!</h1>
              </div>
              
              <div style="padding: 20px;">
                <p>Olá, ${occurrenceData.nome || "Solicitante"}!</p>
                
                <p>Temos o prazer de informar que sua Certidão de Ocorrência <strong>${occurrenceNumber}</strong> foi emitida e já está disponível para você.</p>
                
                <p>Você pode acessar sua certidão através do link abaixo ou entrando no nosso sistema e consultando com seu CPF.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${occurrenceData.certidao.url}" 
                    style="background-color: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                    Visualizar Certidão
                  </a>
                </div>
                
                <p>Se você tiver qualquer dúvida, por favor, entre em contato conosco.</p>
                
                <p>Atenciosamente,<br>
                Equipe de Certidões de Ocorrência</p>
              </div>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center;">
                <p>Este é um e-mail automático. Por favor, não responda esta mensagem.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      // Enviar e-mail
      await transporter.sendMail(mailOptions);

      // Registrar o envio no Firebase
      return admin
        .database()
        .ref(`ocorrencias/${occurrenceNumber}/notifications`)
        .push({
          type: "email",
          status: "sent",
          to: occurrenceData.email,
          timestamp: admin.database.ServerValue.TIMESTAMP,
        });
    } catch (error) {
      console.error("Erro ao enviar e-mail automático:", error);
      return null;
    }
  });
