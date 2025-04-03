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

// Função para enviar e-mail de confirmação quando a solicitação é criada
exports.enviarEmailConfirmacao = functions.https.onCall(
  async (data, context) => {
    // Verificar se o usuário está autenticado (opcional, pode ser removido se a função for chamada publicamente)
    if (!context.auth && !data.publicRequest) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "O usuário deve estar autenticado para enviar e-mails."
      );
    }

    const { destinatario, nome, numeroOcorrencia } = data;

    if (!destinatario || !nome || !numeroOcorrencia) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Faltam parâmetros obrigatórios para o envio do e-mail."
      );
    }

    // Construir o conteúdo do e-mail
    const mailOptions = {
      from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
      to: destinatario,
      subject: `Confirmação de Solicitação - Protocolo ${numeroOcorrencia}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3b82f6; text-align: center;">Solicitação Recebida com Sucesso</h2>
        
        <p>Olá, <strong>${nome}</strong>!</p>
        
        <p>Confirmamos o recebimento da sua solicitação de certidão de ocorrência. Seu pedido foi registrado em nosso sistema e está aguardando análise.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px;">Número de Protocolo</p>
          <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #2563eb;">${numeroOcorrencia}</p>
        </div>
        
        <p><strong>O que acontece agora?</strong></p>
        <ul style="padding-left: 20px; line-height: 1.6;">
          <li>Nossa equipe irá analisar sua solicitação;</li>
          <li>Você será notificado por e-mail quando houver atualizações sobre o seu processo;</li>
          <li>Quando sua certidão estiver pronta, você receberá outro e-mail com um link para acessá-la.</li>
        </ul>
        
        <p>Você pode acompanhar o status da sua solicitação a qualquer momento em nosso site, utilizando seu CPF e o número de protocolo informado acima.</p>
        
        <p>Caso tenha alguma dúvida, responda a este e-mail ou entre em contato com nosso suporte.</p>
        
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
        .ref(`ocorrencias/${numeroOcorrencia}/emailConfirmacao`)
        .set({
          timestamp: admin.database.ServerValue.TIMESTAMP,
          success: true,
        });

      return {
        success: true,
        message: "E-mail de confirmação enviado com sucesso",
      };
    } catch (error) {
      console.error("Erro ao enviar e-mail de confirmação:", error);

      // Registrar a falha no banco de dados
      await admin
        .database()
        .ref(`ocorrencias/${numeroOcorrencia}/emailConfirmacao`)
        .set({
          timestamp: admin.database.ServerValue.TIMESTAMP,
          success: false,
          error: error.message,
        });

      throw new functions.https.HttpsError(
        "internal",
        `Erro ao enviar e-mail de confirmação: ${error.message}`
      );
    }
  }
);

// Trigger automático para enviar e-mail quando uma nova ocorrência é criada
exports.enviarEmailNovaOcorrencia = functions.database
  .ref("/ocorrencias/{occurrenceId}")
  .onCreate(async (snapshot, context) => {
    const occurrenceId = context.params.occurrenceId;
    const ocorrenciaData = snapshot.val();

    if (ocorrenciaData && ocorrenciaData.email && ocorrenciaData.nome) {
      try {
        const mailOptions = {
          from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
          to: ocorrenciaData.email,
          subject: `Confirmação de Solicitação - Protocolo ${occurrenceId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #3b82f6; text-align: center;">Solicitação Recebida com Sucesso</h2>
              
              <p>Olá, <strong>${ocorrenciaData.nome}</strong>!</p>
              
              <p>Confirmamos o recebimento da sua solicitação de certidão de ocorrência. Seu pedido foi registrado em nosso sistema e temos o prazo de 15 dias úteis para confeccioná-la.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px;">Número de Protocolo</p>
                <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #2563eb;">${occurrenceId}</p>
              </div>
              
              <p><strong>O que acontece agora?</strong></p>
              <ul style="padding-left: 20px; line-height: 1.6;">
                <li>Nós iremos analisar sua solicitação;</li>
                <li>Você pode tirar dúvidas através desse e-mail sempre que precisar;</li>
                <li>Quando sua certidão estiver pronta, você receberá outro e-mail com um link para acessá-la.</li>
              </ul>
              
              <p>Você pode acompanhar o status da sua solicitação a qualquer momento em nosso site, utilizando seu CPF na aba "Consultar Solicitações".</p>
              
              <p>Caso tenha alguma dúvida, não deixe de perguntar.</p>
              
              <p>Atenciosamente,</p>
              <p><strong>Grupamento Operacional do Comando Geral/strong></p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                <p>Este é um e-mail automático. </p>
              </div>
            </div>
          `,
        };

        // Enviar o e-mail
        await transporter.sendMail(mailOptions);

        // Registrar o envio no banco de dados
        await admin
          .database()
          .ref(`ocorrencias/${occurrenceId}/emailConfirmacao`)
          .set({
            timestamp: admin.database.ServerValue.TIMESTAMP,
            success: true,
          });

        console.log(
          `E-mail de confirmação enviado automaticamente para ${ocorrenciaData.email}`
        );
        return { success: true };
      } catch (error) {
        console.error(
          "Erro ao enviar e-mail de confirmação automático:",
          error
        );

        // Registrar a falha no banco de dados
        await admin
          .database()
          .ref(`ocorrencias/${occurrenceId}/emailConfirmacao`)
          .set({
            timestamp: admin.database.ServerValue.TIMESTAMP,
            success: false,
            error: error.message,
          });

        return { success: false, error: error.message };
      }
    }

    return null;
  });

// Função para notificar mudanças de status ao solicitante via e-mail
exports.notificarMudancaStatusEmail = functions.database
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

    if (!ocorrencia || !ocorrencia.email || !ocorrencia.nome) {
      console.error(
        `Ocorrência ${occurrenceId} não encontrada ou sem dados de contato`
      );
      return null;
    }

    // Se o status mudou para "Concluído" e há uma função específica para isso, ignorar
    if (novoStatus === "Concluído" && ocorrencia.certidao) {
      // Já existe uma função específica para notificar quando concluído com certidão
      return null;
    }

    // Obter texto específico para o status
    let statusDescricao = "";
    let corStatus = "#3b82f6"; // Cor padrão (azul)

    switch (novoStatus) {
      case "Em Análise":
        statusDescricao =
          "Sua solicitação está sendo analisada por nossa equipe técnica. Em breve você receberá mais informações.";
        break;
      case "Pendente":
        statusDescricao = "Sua solicitação está pendente de análise.";
        break;
      case "Cancelado":
        statusDescricao =
          "Sua solicitação foi cancelada. Se você acredita que isso está incorreto, entre em contato com nosso suporte.";
        corStatus = "#ef4444"; // Vermelho
        break;
      default:
        statusDescricao = `Sua solicitação teve seu status atualizado para "${novoStatus}".`;
    }

    try {
      const mailOptions = {
        from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
        to: ocorrencia.email,
        subject: `Atualização de Status - Solicitação ${occurrenceId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: ${corStatus}; text-align: center;">Atualização de Status da Solicitação</h2>
            
            <p>Olá, <strong>${ocorrencia.nome}</strong>!</p>
            
            <p>Informamos que sua solicitação de certidão de ocorrência <strong>${occurrenceId}</strong> teve uma atualização de status.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-size: 14px;">Status Atual</p>
              <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: ${corStatus};">${novoStatus}</p>
              <p style="margin: 10px 0 0 0; font-size: 15px;">${statusDescricao}</p>
            </div>
            
            <p>Você pode acompanhar sua solicitação a qualquer momento em nosso site, utilizando seu CPF.</p>
            
            <p>Caso tenha alguma dúvida, responda a este e-mail ou entre em contato com nosso suporte.</p>
            
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
        .ref(`ocorrencias/${occurrenceId}/emailStatusAtualizado`)
        .push({
          timestamp: admin.database.ServerValue.TIMESTAMP,
          statusAnterior: statusAnterior,
          novoStatus: novoStatus,
          success: true,
        });

      console.log(
        `E-mail de atualização de status enviado para ${ocorrencia.email}`
      );
      return { success: true };
    } catch (error) {
      console.error("Erro ao enviar e-mail de atualização de status:", error);

      // Registrar a falha no banco de dados
      await admin
        .database()
        .ref(`ocorrencias/${occurrenceId}/emailStatusAtualizado`)
        .push({
          timestamp: admin.database.ServerValue.TIMESTAMP,
          statusAnterior: statusAnterior,
          novoStatus: novoStatus,
          success: false,
          error: error.message,
        });

      return { success: false, error: error.message };
    }
  });

// Função para enviar lembretes para ocorrências pendentes há mais de 7 dias
exports.enviarLembretesOcorrenciasPendentes = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    try {
      // Calcular a data de 7 dias atrás
      const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Buscar ocorrências pendentes criadas há mais de 7 dias
      const snapshot = await admin
        .database()
        .ref("/ocorrencias")
        .orderByChild("timestamp")
        .endAt(seteDiasAtras)
        .once("value");

      if (!snapshot.exists()) {
        console.log("Nenhuma ocorrência pendente antiga encontrada");
        return null;
      }

      const ocorrenciasPendentes = [];

      // Filtrar ocorrências pendentes
      snapshot.forEach((childSnapshot) => {
        const ocorrencia = childSnapshot.val();
        // Verificar se a ocorrência está pendente e não recebeu um lembrete recentemente
        if (
          (ocorrencia.status === "Pendente" ||
            ocorrencia.status === "Em Análise") &&
          ocorrencia.email &&
          (!ocorrencia.lembretes ||
            !ocorrencia.lembretes.ultimoEnvio ||
            Date.now() - ocorrencia.lembretes.ultimoEnvio >
              7 * 24 * 60 * 60 * 1000)
        ) {
          ocorrenciasPendentes.push({
            id: childSnapshot.key,
            ...ocorrencia,
          });
        }
      });

      console.log(
        `Encontradas ${ocorrenciasPendentes.length} ocorrências pendentes para enviar lembretes`
      );

      // Enviar e-mails de lembrete
      const envioPromises = ocorrenciasPendentes.map(async (ocorrencia) => {
        try {
          const mailOptions = {
            from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
            to: ocorrencia.email,
            subject: `Lembrete: Solicitação ${ocorrencia.id} em Andamento`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #3b82f6; text-align: center;">Lembrete: Sua Solicitação Está em Andamento</h2>
                
                <p>Olá, <strong>${ocorrencia.nome}</strong>!</p>
                
                <p>Gostaríamos de informar que sua solicitação de certidão de ocorrência <strong>${ocorrencia.id}</strong> ainda está em processamento com o status <strong>${ocorrencia.status}</strong>.</p>
                
                <p>Estamos trabalhando para concluir sua solicitação o mais rápido possível. Você será notificado por e-mail assim que houver qualquer atualização.</p>
                
                <p>Você pode acompanhar o status da sua solicitação a qualquer momento em nosso site, utilizando seu CPF.</p>
                
                <p>Caso tenha alguma dúvida, por favor, entre em contato com nosso suporte.</p>
                
                <p>Agradecemos sua paciência e compreensão.</p>
                
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

          // Registrar o envio do lembrete
          await admin
            .database()
            .ref(`ocorrencias/${ocorrencia.id}/lembretes`)
            .set({
              ultimoEnvio: admin.database.ServerValue.TIMESTAMP,
              contador: (ocorrencia.lembretes?.contador || 0) + 1,
              success: true,
            });

          console.log(
            `Lembrete enviado para ocorrência ${ocorrencia.id} - e-mail: ${ocorrencia.email}`
          );
          return { id: ocorrencia.id, success: true };
        } catch (error) {
          console.error(
            `Erro ao enviar lembrete para ocorrência ${ocorrencia.id}:`,
            error
          );

          // Registrar a falha
          await admin
            .database()
            .ref(`ocorrencias/${ocorrencia.id}/lembretes/falhas`)
            .push({
              timestamp: admin.database.ServerValue.TIMESTAMP,
              error: error.message,
            });

          return { id: ocorrencia.id, success: false, error: error.message };
        }
      });

      // Aguardar todos os envios
      const resultados = await Promise.all(envioPromises);

      // Contar sucessos e falhas
      const sucessos = resultados.filter((r) => r.success).length;
      const falhas = resultados.length - sucessos;

      console.log(
        `Lembretes enviados: ${sucessos} com sucesso, ${falhas} falhas`
      );

      return {
        success: true,
        total: resultados.length,
        sucessos,
        falhas,
      };
    } catch (error) {
      console.error("Erro ao processar lembretes:", error);
      return { success: false, error: error.message };
    }
  });

// Função para backup automático dos dados (uma vez por semana)
exports.backupDadosSemanais = functions.pubsub
  .schedule("every monday 03:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    try {
      // Obter data atual formatada para o nome do arquivo
      const dataAtual = new Date();
      const dataFormatada = `${dataAtual.getFullYear()}-${String(
        dataAtual.getMonth() + 1
      ).padStart(2, "0")}-${String(dataAtual.getDate()).padStart(2, "0")}`;

      // Referência para o local onde serão armazenados os backups
      const backupRef = admin.database().ref("/backups");

      // Obter todos os dados das ocorrências
      const ocorrenciasSnapshot = await admin
        .database()
        .ref("/ocorrencias")
        .once("value");
      const ocorrencias = ocorrenciasSnapshot.val();

      if (!ocorrencias) {
        console.log("Nenhum dado de ocorrências para backup");
        return null;
      }

      // Criar um nó de backup com a data atual
      await backupRef.child(`backup-${dataFormatada}`).set({
        dadosBackup: ocorrencias,
        dataBackup: admin.database.ServerValue.TIMESTAMP,
        totalOcorrencias: Object.keys(ocorrencias).length,
      });

      console.log(
        `Backup realizado com sucesso em ${dataFormatada} com ${
          Object.keys(ocorrencias).length
        } ocorrências`
      );

      // Remover backups antigos (manter apenas os últimos 4)
      const backupsSnapshot = await backupRef.orderByKey().once("value");
      const backups = [];

      backupsSnapshot.forEach((backupSnapshot) => {
        backups.push({
          key: backupSnapshot.key,
          data: backupSnapshot.val().dataBackup,
        });
      });

      // Ordenar do mais recente para o mais antigo
      backups.sort((a, b) => b.data - a.data);

      // Se tiver mais de 4 backups, remover os mais antigos
      if (backups.length > 4) {
        const backupsParaRemover = backups.slice(4);

        for (const backup of backupsParaRemover) {
          await backupRef.child(backup.key).remove();
          console.log(`Backup antigo removido: ${backup.key}`);
        }
      }

      return {
        success: true,
        message: `Backup realizado com sucesso: backup-${dataFormatada}`,
      };
    } catch (error) {
      console.error("Erro ao realizar backup:", error);
      return { success: false, error: error.message };
    }
  });

// Função para manter a contagem atualizada de ocorrências por status
exports.atualizarContadores = functions.database
  .ref("/ocorrencias/{occurrenceId}/status")
  .onWrite(async (change, context) => {
    try {
      const statusAnterior = change.before.exists()
        ? change.before.val()
        : null;
      const novoStatus = change.after.exists() ? change.after.val() : null;

      // Se não houve mudança no status, não faz nada
      if (statusAnterior === novoStatus) {
        return null;
      }

      // Referência para os contadores
      const contadoresRef = admin.database().ref("/contadores");

      // Transação para garantir atomicidade
      await admin.database().runTransaction(async (transaction) => {
        // Lê os contadores atuais
        const contadoresSnapshot = await transaction.get(contadoresRef);
        let contadores = contadoresSnapshot.val() || {
          Pendente: 0,
          "Em Análise": 0,
          Concluído: 0,
          Cancelado: 0,
          total: 0,
        };

        // Decrementa o contador do status anterior, se existir
        if (statusAnterior && contadores[statusAnterior] !== undefined) {
          contadores[statusAnterior]--;
        }

        // Incrementa o contador do novo status, se existir
        if (novoStatus && contadores[novoStatus] !== undefined) {
          contadores[novoStatus]++;
        }

        // Atualiza o contador total apenas se for uma nova ocorrência ou remoção
        if (!statusAnterior && novoStatus) {
          contadores.total++;
        } else if (statusAnterior && !novoStatus) {
          contadores.total--;
        }

        // Atualiza os contadores
        transaction.update(contadoresRef, contadores);

        return contadores;
      });

      console.log(
        `Contadores atualizados: ${statusAnterior || "novo"} -> ${
          novoStatus || "removido"
        }`
      );
      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar contadores:", error);
      return { success: false, error: error.message };
    }
  });

// Função para enviar pesquisa de satisfação após certidão concluída (24h depois)
exports.enviarPesquisaSatisfacao = functions.pubsub
  .schedule("every hour")
  .onRun(async (context) => {
    try {
      // Buscar ocorrências concluídas há 24 horas (com margem de 1 hora)
      const vinteCincoHorasAtras = Date.now() - 25 * 60 * 60 * 1000;
      const vinteUmaHorasAtras = Date.now() - 21 * 60 * 60 * 1000;

      const snapshot = await admin
        .database()
        .ref("/ocorrencias")
        .orderByChild("dataAtualizacao")
        .startAt(vinteCincoHorasAtras)
        .endAt(vinteUmaHorasAtras)
        .once("value");

      if (!snapshot.exists()) {
        console.log(
          "Nenhuma ocorrência concluída recentemente para enviar pesquisa"
        );
        return null;
      }

      const ocorrenciasConcluidas = [];

      snapshot.forEach((childSnapshot) => {
        const ocorrencia = childSnapshot.val();
        // Verificar se a ocorrência está concluída, tem certidão e não recebeu pesquisa
        if (
          ocorrencia.status === "Concluído" &&
          ocorrencia.certidao &&
          ocorrencia.certidao.url &&
          ocorrencia.email &&
          !ocorrencia.pesquisaSatisfacao
        ) {
          ocorrenciasConcluidas.push({
            id: childSnapshot.key,
            ...ocorrencia,
          });
        }
      });

      console.log(
        `Encontradas ${ocorrenciasConcluidas.length} ocorrências para enviar pesquisa de satisfação`
      );

      // Enviar e-mails de pesquisa
      const envioPromises = ocorrenciasConcluidas.map(async (ocorrencia) => {
        try {
          // URL fictícia para a pesquisa - substitua pela URL real
          const urlPesquisa = `https://suapesquisa.com/feedback?id=${ocorrencia.id}`;

          const mailOptions = {
            from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
            to: ocorrencia.email,
            subject: `Pesquisa de Satisfação - Certidão ${ocorrencia.id}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #3b82f6; text-align: center;">Sua Opinião é Importante para Nós</h2>
                
                <p>Olá, <strong>${ocorrencia.nome}</strong>!</p>
                
                <p>Gostaríamos de agradecer por utilizar nosso sistema de certidões de ocorrência. Esperamos que o processo tenha atendido às suas expectativas.</p>
                
                <p>Para continuarmos melhorando nossos serviços, gostaríamos de convidá-lo a participar de uma breve pesquisa de satisfação.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${urlPesquisa}" 
                     style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Participar da Pesquisa
                  </a>
                </div>
                
                <p>A pesquisa levará menos de 2 minutos para ser preenchida e suas respostas são muito importantes para melhorarmos continuamente.</p>
                
                <p>Agradecemos sua colaboração!</p>
                
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

          // Registrar o envio da pesquisa
          await admin
            .database()
            .ref(`ocorrencias/${ocorrencia.id}/pesquisaSatisfacao`)
            .set({
              enviado: true,
              dataEnvio: admin.database.ServerValue.TIMESTAMP,
              respondido: false,
            });

          console.log(
            `Pesquisa de satisfação enviada para ${ocorrencia.email}`
          );
          return { id: ocorrencia.id, success: true };
        } catch (error) {
          console.error(
            `Erro ao enviar pesquisa para ocorrência ${ocorrencia.id}:`,
            error
          );

          // Registrar falha
          await admin
            .database()
            .ref(`ocorrencias/${ocorrencia.id}/pesquisaSatisfacao`)
            .set({
              enviado: false,
              error: error.message,
              timestamp: admin.database.ServerValue.TIMESTAMP,
            });

          return { id: ocorrencia.id, success: false, error: error.message };
        }
      });

      const resultados = await Promise.all(envioPromises);
      const sucessos = resultados.filter((r) => r.success).length;

      return {
        success: true,
        total: resultados.length,
        sucessos,
        falhas: resultados.length - sucessos,
      };
    } catch (error) {
      console.error("Erro ao processar pesquisas de satisfação:", error);
      return { success: false, error: error.message };
    }
  });
