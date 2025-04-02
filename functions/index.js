const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Configure o transporte de e-mail com as credenciais específicas
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().email?.user || "gocg.certidao@gmail.com",
    pass: functions.config().email?.pass || "fbuc rjst fqwq hbnh",
  },
});

// Função para enviar e-mail chamável via HTTPS
exports.enviarEmailCertidao = functions.https.onCall(async (data, context) => {
  // Verificar se o usuário está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "O usuário deve estar autenticado para enviar e-mails."
    );
  }

  const { destinatario, nome, numeroOcorrencia, certidaoURL } = data;

  if (!destinatario || !nome || !numeroOcorrencia || !certidaoURL) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Faltam parâmetros obrigatórios para o envio do e-mail."
    );
  }

  // Construir o conteúdo do e-mail
  const mailOptions = {
    from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
    to: destinatario,
    subject: `Certidão de Ocorrência ${numeroOcorrencia} - Concluída`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4caf50; text-align: center;">Certidão de Ocorrência Concluída</h2>
        
        <p>Olá, <strong>${nome}</strong>!</p>
        
        <p>Temos o prazer de informar que sua solicitação de certidão de ocorrência <strong>${numeroOcorrencia}</strong> foi concluída com sucesso.</p>
        
        <p>Você pode acessar sua certidão através do link abaixo:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${certidaoURL}" 
             style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Baixar Certidão
          </a>
        </div>
        
        <p>Se você tiver alguma dúvida ou precisar de assistência adicional, não hesite em nos contatar.</p>
        
        <p>Atenciosamente,</p>
        <p><strong>Equipe de Certidões de Ocorrência</strong></p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
          <p>Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.</p>
        </div>
      </div>
    `,
  };

  try {
    // Enviar o e-mail
    await transporter.sendMail(mailOptions);

    // Registrar o envio no banco de dados
    await admin
      .database()
      .ref(`ocorrencias/${numeroOcorrencia}/emailEnviado`)
      .set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: true,
      });

    return { success: true, message: "E-mail enviado com sucesso" };
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);

    // Registrar a falha no banco de dados
    await admin
      .database()
      .ref(`ocorrencias/${numeroOcorrencia}/emailEnviado`)
      .set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: false,
        error: error.message,
      });

    throw new functions.https.HttpsError(
      "internal",
      `Erro ao enviar e-mail: ${error.message}`
    );
  }
});

// Trigger para enviar e-mail automaticamente quando o status mudar para "Concluído"
exports.enviarEmailAutomatico = functions.database
  .ref("/ocorrencias/{occurrenceId}")
  .onUpdate(async (change, context) => {
    const occurrenceId = context.params.occurrenceId;
    const dadosAntes = change.before.val();
    const dadosDepois = change.after.val();

    // Verificar se o status mudou para "Concluído" e se há uma certidão anexada
    if (
      dadosAntes.status !== "Concluído" &&
      dadosDepois.status === "Concluído" &&
      dadosDepois.certidao &&
      dadosDepois.certidao.url
    ) {
      // Se não houve tentativa anterior de envio de e-mail ou a última falhou
      if (!dadosDepois.emailEnviado || !dadosDepois.emailEnviado.success) {
        try {
          const mailOptions = {
            from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
            to: dadosDepois.email,
            subject: `Certidão de Ocorrência ${occurrenceId} - Concluída`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4caf50; text-align: center;">Certidão de Ocorrência Concluída</h2>
                
                <p>Olá, <strong>${dadosDepois.nome}</strong>!</p>
                
                <p>Temos o prazer de informar que sua solicitação de certidão de ocorrência <strong>${occurrenceId}</strong> foi concluída com sucesso.</p>
                
                <p>Você pode acessar sua certidão através do link abaixo:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${dadosDepois.certidao.url}" 
                     style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Baixar Certidão
                  </a>
                </div>
                
                <p>Se você tiver alguma dúvida ou precisar de assistência adicional, não hesite em nos contatar.</p>
                
                <p>Atenciosamente,</p>
                <p><strong>Equipe de Certidões de Ocorrência</strong></p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                  <p>Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.</p>
                </div>
              </div>
            `,
          };

          // Enviar o e-mail
          await transporter.sendMail(mailOptions);

          // Registrar o envio no banco de dados
          await admin
            .database()
            .ref(`ocorrencias/${occurrenceId}/emailEnviado`)
            .set({
              timestamp: admin.database.ServerValue.TIMESTAMP,
              success: true,
            });

          console.log(
            `E-mail enviado automaticamente para ${dadosDepois.email}`
          );
          return { success: true };
        } catch (error) {
          console.error("Erro ao enviar e-mail automático:", error);

          // Registrar a falha no banco de dados
          await admin
            .database()
            .ref(`ocorrencias/${occurrenceId}/emailEnviado`)
            .set({
              timestamp: admin.database.ServerValue.TIMESTAMP,
              success: false,
              error: error.message,
            });

          return { success: false, error: error.message };
        }
      }
    }

    return null;
  });

// Função para registrar notificações para administradores
exports.notificarStatusAtualizado = functions.database
  .ref("/ocorrencias/{occurrenceId}/status")
  .onUpdate(async (change, context) => {
    const occurrenceId = context.params.occurrenceId;
    const statusAnterior = change.before.val();
    const novoStatus = change.after.val();

    // Evitar processamento desnecessário se o status não mudou
    if (statusAnterior === novoStatus) {
      return null;
    }

    // Obter informações adicionais da ocorrência
    const snapshot = await admin
      .database()
      .ref(`/ocorrencias/${occurrenceId}`)
      .once("value");
    const ocorrencia = snapshot.val();

    if (!ocorrencia) {
      console.error(`Ocorrência ${occurrenceId} não encontrada`);
      return null;
    }

    // Criar uma notificação no banco de dados
    const notificacaoRef = admin.database().ref("/notificacoes").push();

    await notificacaoRef.set({
      tipo: "atualizacao_status",
      occurrenceId: occurrenceId,
      statusAnterior: statusAnterior,
      novoStatus: novoStatus,
      nomeCliente: ocorrencia.nome,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      lida: false,
      destinatario: "todos", // pode ser 'todos' ou o email de um admin específico
    });

    console.log(
      `Notificação criada para mudança de status da ocorrência ${occurrenceId}`
    );
    return { success: true };
  });

// Função para marcar notificações como lidas
exports.marcarNotificacaoLida = functions.https.onCall(
  async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "O usuário deve estar autenticado para marcar notificações como lidas."
      );
    }

    const { notificacaoId } = data;

    if (!notificacaoId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da notificação não informado."
      );
    }

    try {
      // Marcar a notificação como lida
      await admin.database().ref(`/notificacoes/${notificacaoId}`).update({
        lida: true,
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Erro: ${error.message}`
      );
    }
  }
);

// Função para limpar notificações antigas (opcional, melhora o desempenho)
exports.limparNotificacoesAntigas = functions.pubsub
  .schedule("1 of month 00:00")
  .onRun(async (context) => {
    try {
      // Definir limite de tempo (30 dias atrás)
      const limiteTempo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      // Obter notificações antigas
      const snapshot = await admin
        .database()
        .ref("/notificacoes")
        .orderByChild("timestamp")
        .endAt(limiteTempo)
        .once("value");

      if (!snapshot.exists()) {
        console.log("Nenhuma notificação antiga para remover");
        return null;
      }

      // Array para armazenar as promises de exclusão
      const deletePromises = [];

      // Remover cada notificação antiga
      snapshot.forEach((childSnapshot) => {
        deletePromises.push(
          admin.database().ref(`/notificacoes/${childSnapshot.key}`).remove()
        );
      });

      // Aguardar todas as exclusões
      await Promise.all(deletePromises);

      console.log(`Removidas ${deletePromises.length} notificações antigas`);
      return { success: true, count: deletePromises.length };
    } catch (error) {
      console.error("Erro ao limpar notificações antigas:", error);
      return { success: false, error: error.message };
    }
  });

// Função para gerar relatórios de ocorrências concluídas (opcional)
exports.gerarRelatorioMensal = functions.pubsub
  .schedule("1 of month 00:00")
  .onRun(async (context) => {
    try {
      // Obter data do mês anterior
      const dataAtual = new Date();
      const mesAnterior = new Date(
        dataAtual.getFullYear(),
        dataAtual.getMonth() - 1,
        1
      );
      const inicioMesAnterior = mesAnterior.getTime();
      const fimMesAnterior = new Date(
        dataAtual.getFullYear(),
        dataAtual.getMonth(),
        0,
        23,
        59,
        59
      ).getTime();

      // Obter ocorrências concluídas no mês anterior
      const snapshot = await admin
        .database()
        .ref("/ocorrencias")
        .orderByChild("dataAtualizacao")
        .startAt(inicioMesAnterior)
        .endAt(fimMesAnterior)
        .once("value");

      if (!snapshot.exists()) {
        console.log("Nenhuma ocorrência para incluir no relatório mensal");
        return null;
      }

      // Processar dados para o relatório
      const ocorrencias = [];
      let totalConcluidas = 0;
      let totalPendentes = 0;
      let totalCanceladas = 0;

      snapshot.forEach((childSnapshot) => {
        const ocorrencia = childSnapshot.val();
        ocorrencias.push({
          numero: ocorrencia.occurrenceNumber,
          nome: ocorrencia.nome,
          status: ocorrencia.status,
          dataOcorrencia: ocorrencia.dataOcorrencia,
          dataAtualizacao: ocorrencia.dataAtualizacao,
        });

        // Contagem por status
        if (ocorrencia.status === "Concluído") totalConcluidas++;
        else if (
          ocorrencia.status === "Pendente" ||
          ocorrencia.status === "Em Análise"
        )
          totalPendentes++;
        else if (ocorrencia.status === "Cancelado") totalCanceladas++;
      });

      // Salvar relatório no banco de dados
      const nomeMes = mesAnterior.toLocaleString("pt-BR", { month: "long" });
      const ano = mesAnterior.getFullYear();

      await admin
        .database()
        .ref(`/relatorios/${ano}-${mesAnterior.getMonth() + 1}`)
        .set({
          periodo: `${nomeMes} de ${ano}`,
          totalOcorrencias: ocorrencias.length,
          concluidas: totalConcluidas,
          pendentes: totalPendentes,
          canceladas: totalCanceladas,
          geradoEm: admin.database.ServerValue.TIMESTAMP,
          ocorrencias: ocorrencias,
        });

      console.log(`Relatório mensal gerado para ${nomeMes} de ${ano}`);
      return { success: true };
    } catch (error) {
      console.error("Erro ao gerar relatório mensal:", error);
      return { success: false, error: error.message };
    }
  });
