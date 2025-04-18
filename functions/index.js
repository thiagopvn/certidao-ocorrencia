// Importações atualizadas para Firebase Functions v2
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Importações específicas da v2
const { onCall } = require('firebase-functions/v2/https');
const { onValueCreated, onValueUpdated, onValueWritten } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineString, defineSecret } = require('firebase-functions/params');

// Inicializar app do Firebase Admin
initializeApp();

// Configurações para email via environment
const emailUser = defineString('EMAIL_USER', { default: 'gocg.certidao@gmail.com' });
const emailPass = defineSecret('EMAIL_PASS');

// Configurar o transporte de e-mail
const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser.value(),
      pass: process.env.EMAIL_PASS || "fbuc rjst fqwq hbnh", // Fallback para desenvolvimento local
    },
  });
};

// Função para enviar e-mail chamável via HTTPS
exports.enviarEmailCertidaoV2 = onCall({
  secrets: [emailPass]
}, async (request) => {
  // Extrair dados da requisição
  const { data } = request;
  const { destinatario, nome, numeroOcorrencia, certidaoURL } = data;

  if (!destinatario || !nome || !numeroOcorrencia || !certidaoURL) {
    throw new Error(
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
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
        </div>
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
        <p><strong>Grupamento Operacional do Comando Geral</strong></p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
          <p>Este é um e-mail automático.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: 'bolachaGOCG.png',
        path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
        cid: 'bolachaGOCG' // ID referenciado no src da imagem
      }
    ]
  };

  try {
    // Enviar o e-mail
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);

    // Registrar o envio no banco de dados
    await getDatabase()
      .ref(`ocorrencias/${numeroOcorrencia}/emailEnviado`)
      .set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: true,
      });

    return { success: true, message: "E-mail enviado com sucesso" };
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);

    // Registrar a falha no banco de dados
    await getDatabase()
      .ref(`ocorrencias/${numeroOcorrencia}/emailEnviado`)
      .set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: false,
        error: error.message,
      });

    throw new Error(`Erro ao enviar e-mail: ${error.message}`);
  }
});

// Trigger para enviar e-mail automaticamente quando o status mudar para "Concluído"
exports.enviarEmailAutomatico = onValueUpdated({
  ref: "/ocorrencias/{occurrenceId}/status",
  region: "us-central1",
  secrets: [emailPass]
}, async (event) => {
  const occurrenceId = event.params.occurrenceId;
  const statusAnterior = event.data.before;
  const novoStatus = event.data.after;

  // Verificar se o status mudou para "Concluído"
  if (statusAnterior !== "Concluído" && novoStatus === "Concluído") {
    console.log(`Status da ocorrência ${occurrenceId} alterado para Concluído, verificando dados para envio de e-mail`);

    // Buscar os dados completos e atualizados da ocorrência para garantir que temos os dados mais recentes
    const snapshot = await getDatabase()
      .ref(`/ocorrencias/${occurrenceId}`)
      .once("value");
    
    const dadosOcorrencia = snapshot.val();

    // Verificar novamente se há certidão e email disponíveis com os dados atualizados
    if (dadosOcorrencia && 
        dadosOcorrencia.email && 
        dadosOcorrencia.certidao && 
        dadosOcorrencia.certidao.url) {
      
      // Verificar se já enviamos um email com sucesso anteriormente
      const naoEnviouEmail = !dadosOcorrencia.emailEnviado || !dadosOcorrencia.emailEnviado.success;
      
      if (naoEnviouEmail) {
        try {
          console.log(`Preparando para enviar e-mail para ${dadosOcorrencia.email} com certificado: ${dadosOcorrencia.certidao.url}`);
          
          const mailOptions = {
            from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
            to: dadosOcorrencia.email,
            subject: `Certidão de Ocorrência ${occurrenceId} - Concluída`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
                </div>
                <h2 style="color: #4caf50; text-align: center;">Certidão de Ocorrência Concluída</h2>
                
                <p>Olá, <strong>${dadosOcorrencia.nome}</strong>!</p>
                
                <p>Temos o prazer de informar que sua solicitação de certidão de ocorrência <strong>${occurrenceId}</strong> foi concluída com sucesso.</p>
                
                <p>Você pode acessar sua certidão através do link abaixo:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${dadosOcorrencia.certidao.url}" 
                     style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Baixar Certidão
                  </a>
                </div>
                
                <p>Se você tiver alguma dúvida ou precisar de assistência adicional, não hesite em nos contatar.</p>
                
                <p>Atenciosamente,</p>
                <p><strong>Grupamento Operacional do Comando Geral</strong></p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                  <p>Este é um e-mail automático.</p>
                </div>
              </div>
            `,
            attachments: [
              {
                filename: 'bolachaGOCG.png',
                path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
                cid: 'bolachaGOCG' // ID referenciado no src da imagem
              }
            ]
          };

          // Enviar o e-mail
          const transporter = getTransporter();
          await transporter.sendMail(mailOptions);

          // Registrar o envio no banco de dados
          await getDatabase()
            .ref(`ocorrencias/${occurrenceId}/emailEnviado`)
            .set({
              timestamp: admin.database.ServerValue.TIMESTAMP,
              success: true,
            });

          console.log(`E-mail enviado automaticamente para ${dadosOcorrencia.email}`);
          return { success: true };
        } catch (error) {
          console.error("Erro ao enviar e-mail automático:", error);

          // Registrar a falha no banco de dados
          await getDatabase()
            .ref(`ocorrencias/${occurrenceId}/emailEnviado`)
            .set({
              timestamp: admin.database.ServerValue.TIMESTAMP,
              success: false,
              error: error.message,
            });

          return { success: false, error: error.message };
        }
      } else {
        console.log(`E-mail já foi enviado anteriormente para ocorrência ${occurrenceId}`);
      }
    } else {
      console.log(`Ocorrência ${occurrenceId} não tem os dados necessários para envio de e-mail: email=${!!dadosOcorrencia?.email}, certidao=${!!dadosOcorrencia?.certidao}, url=${!!dadosOcorrencia?.certidao?.url}`);
    }
  }

  return null;
});

// Função para registrar notificações para administradores
exports.notificarStatusAtualizado = onValueUpdated({
  ref: "/ocorrencias/{occurrenceId}/status",
  region: "us-central1"
}, async (event) => {
  const occurrenceId = event.params.occurrenceId;
  const statusAnterior = event.data.before;
  const novoStatus = event.data.after;

  // Evitar processamento desnecessário se o status não mudou
  if (statusAnterior === novoStatus) {
    return null;
  }

  // Obter informações adicionais da ocorrência
  const snapshot = await getDatabase()
    .ref(`/ocorrencias/${occurrenceId}`)
    .once("value");
  const ocorrencia = snapshot.val();

  if (!ocorrencia) {
    console.error(`Ocorrência ${occurrenceId} não encontrada`);
    return null;
  }

  // Criar uma notificação no banco de dados
  const notificacaoRef = getDatabase().ref("/notificacoes").push();

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
exports.marcarNotificacaoLida = onCall({
  region: "us-central1"
}, async (request) => {
  // Verificar se o usuário está autenticado
  if (!request.auth) {
    throw new Error(
      "O usuário deve estar autenticado para marcar notificações como lidas."
    );
  }

  const { data } = request;
  const { notificacaoId } = data;

  if (!notificacaoId) {
    throw new Error(
      "ID da notificação não informado."
    );
  }

  try {
    // Marcar a notificação como lida
    await getDatabase().ref(`/notificacoes/${notificacaoId}`).update({
      lida: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    throw new Error(`Erro: ${error.message}`);
  }
});

// Função para limpar notificações antigas (melhorar o desempenho)
exports.limparNotificacoesAntigas = onSchedule({
  schedule: "1 of month 00:00",
  timeZone: "America/Sao_Paulo",
  region: "us-central1"
}, async (context) => {
  try {
    // Definir limite de tempo (30 dias atrás)
    const limiteTempo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Obter notificações antigas
    const snapshot = await getDatabase()
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
        getDatabase().ref(`/notificacoes/${childSnapshot.key}`).remove()
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

// Função para gerar relatórios de ocorrências concluídas
exports.gerarRelatorioMensal = onSchedule({
  schedule: "1 of month 00:00",
  timeZone: "America/Sao_Paulo",
  region: "us-central1"
}, async (context) => {
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
    const snapshot = await getDatabase()
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
        numero: ocorrencia.occurrenceNumber || childSnapshot.key,
        nome: ocorrencia.nome,
        status: ocorrencia.status,
        dataOcorrencia: ocorrencia.dataOcorrencia,
        dataAtualizacao: ocorrencia.dataAtualizacao,
      });

      // Contagem por status
      if (ocorrencia.status === "Concluído") totalConcluidas++;
      else if (
        ocorrencia.status === "Pendente"
      )
        totalPendentes++;
      else if (ocorrencia.status === "Cancelado") totalCanceladas++;
    });

    // Salvar relatório no banco de dados
    const nomeMes = mesAnterior.toLocaleString("pt-BR", { month: "long" });
    const ano = mesAnterior.getFullYear();

    await getDatabase()
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
exports.enviarEmailConfirmacao = onCall({
  secrets: [emailPass]
}, async (request) => {
  const { data } = request;
  const { destinatario, nome, numeroOcorrencia } = data;

  if (!destinatario || !nome || !numeroOcorrencia) {
    throw new Error(
      "Faltam parâmetros obrigatórios para o envio do e-mail."
    );
  }

  // Construir o conteúdo do e-mail
  const mailOptions = {
    from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
    subject: `Confirmação de Solicitação - Protocolo ${numeroOcorrencia}`,
    to: destinatario,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #3b82f6; text-align: center;">Solicitação Recebida com Sucesso</h2>
        
        <p>Olá, <strong>${nome}</strong>!</p>
        
        <p>Confirmamos o recebimento da sua solicitação de certidão de ocorrência. Seu pedido foi registrado em nosso sistema e temos o prazo de 15 dias para conclluí-lo.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px;">Número de Protocolo</p>
          <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #2563eb;">${numeroOcorrencia}</p>
        </div>
        
        <p><strong>O que acontece agora?</strong></p>
        <ul style="padding-left: 20px; line-height: 1.6;">
          <li>Nossos militares irão analisar sua solicitação;</li>
          <li>Você será notificado por e-mail caso seja necessário fornecer infromação adicional;</li>
          <li>Quando sua certidão estiver pronta, você receberá outro e-mail com um link para acessá-la.</li>
        </ul>
        
        <p>Você pode acompanhar o status da sua solicitação a qualquer momento em nosso site, utilizando seu CPF e o número de protocolo informado acima.</p>
        
        <p>Caso tenha alguma dúvida, responda a este e-mail ou entre em contato conosco.</p>
        
        <p>Atenciosamente,</p>
        <p><strong>Grupamento Operacional do Comando Geral</strong></p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
          <p>Este é um e-mail automático.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: 'bolachaGOCG.png',
        path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
        cid: 'bolachaGOCG' // ID referenciado no src da imagem
      }
    ]
  };

  try {
    // Enviar o e-mail
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);

    // Registrar o envio no banco de dados
    await getDatabase()
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
    await getDatabase()
      .ref(`ocorrencias/${numeroOcorrencia}/emailConfirmacao`)
      .set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: false,
        error: error.message,
      });

    throw new Error(`Erro ao enviar e-mail de confirmação: ${error.message}`);
  }
});

// Trigger automático para enviar e-mail quando uma nova ocorrência é criada
exports.enviarEmailNovaOcorrencia = onValueCreated({
  ref: "/ocorrencias/{occurrenceId}",
  region: "us-central1",
  secrets: [emailPass]
}, async (event) => {
  const occurrenceId = event.params.occurrenceId;
  const ocorrenciaData = event.data;

  if (ocorrenciaData && ocorrenciaData.email && ocorrenciaData.nome) {
    try {
      const mailOptions = {
        from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
        to: ocorrenciaData.email,
        subject: `Confirmação de Solicitação - Protocolo ${occurrenceId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
            </div>
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
            <p><strong>Grupamento Operacional do Comando Geral</strong></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
              <p>Este é um e-mail automático. </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: 'bolachaGOCG.png',
            path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
            cid: 'bolachaGOCG' // ID referenciado no src da imagem
          }
        ]
      };

      // Enviar o e-mail
      const transporter = getTransporter();
      await transporter.sendMail(mailOptions);

      // Registrar o envio no banco de dados
      await getDatabase()
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
      await getDatabase()
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
// MODIFICADA: Desabilitado o envio de e-mails para atualizações de status
exports.notificarMudancaStatusEmail = onValueUpdated({
  ref: "/ocorrencias/{occurrenceId}/status",
  region: "us-central1",
  secrets: [emailPass]
}, async (event) => {
  const occurrenceId = event.params.occurrenceId;
  const statusAnterior = event.data.before;
  const novoStatus = event.data.after;

  // Registrar apenas em log a mudança de status, sem enviar e-mail
  console.log(`Alteração de status da ocorrência ${occurrenceId} de "${statusAnterior}" para "${novoStatus}"`);
  console.log("Envio de e-mail de notificação de mudança de status desativado conforme solicitado");
  
  // Retornar sem enviar e-mail
  return null;
});

// Função para enviar lembretes para ocorrências pendentes há mais de 7 dias
exports.enviarLembretesOcorrenciasPendentes = onSchedule({
  schedule: "every day 09:00",
  timeZone: "America/Sao_Paulo",
  region: "us-central1",
  secrets: [emailPass]
}, async (context) => {
  try {
    // Calcular a data de 7 dias atrás
    const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Buscar ocorrências pendentes criadas há mais de 7 dias
    const snapshot = await getDatabase()
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
        (ocorrencia.status === "Pendente") &&
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
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
              </div>
              <h2 style="color: #3b82f6; text-align: center;">Lembrete: Sua Solicitação Está em Andamento</h2>
              
              <p>Olá, <strong>${ocorrencia.nome}</strong>!</p>
              
              <p>Gostaríamos de informar que sua solicitação de certidão de ocorrência <strong>${ocorrencia.id}</strong> ainda está em processamento com o status <strong>${ocorrencia.status}</strong>.</p>
              
              <p>Estamos trabalhando para concluir sua solicitação o mais rápido possível. Você será notificado por e-mail assim que houver qualquer atualização.</p>
              
              <p>Você pode acompanhar o status da sua solicitação a qualquer momento em nosso site, utilizando seu CPF.</p>
              
              <p>Caso tenha alguma dúvida, por favor, entre em contato conosco.</p>
              
              <p>Agradecemos sua paciência e compreensão.</p>
              
              <p>Atenciosamente,</p>
              <p><strong>Grupamento Operacional do Comando Geral</strong></p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                <p>Este é um e-mail automático.</p>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: 'bolachaGOCG.png',
              path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
              cid: 'bolachaGOCG' // ID referenciado no src da imagem
            }
          ]
        };

        // Enviar o e-mail
        const transporter = getTransporter();
        await transporter.sendMail(mailOptions);

        // Registrar o envio do lembrete
        await getDatabase()
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
        await getDatabase()
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
exports.backupDadosSemanais = onSchedule({
  schedule: "every monday 03:00",
  timeZone: "America/Sao_Paulo",
  region: "us-central1"
}, async (context) => {
  try {
    // Obter data atual formatada para o nome do arquivo
    const dataAtual = new Date();
    const dataFormatada = `${dataAtual.getFullYear()}-${String(
      dataAtual.getMonth() + 1
    ).padStart(2, "0")}-${String(dataAtual.getDate()).padStart(2, "0")}`;

    // Referência para o local onde serão armazenados os backups
    const backupRef = getDatabase().ref("/backups");

    // Obter todos os dados das ocorrências
    const ocorrenciasSnapshot = await getDatabase()
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
exports.atualizarContadores = onValueWritten({
  ref: "/ocorrencias/{occurrenceId}/status",
  region: "us-central1"
}, async (event) => {
  try {
    const statusAnterior = event.data.before || null;
    const novoStatus = event.data.after || null;

    // Se não houve mudança no status, não faz nada
    if (statusAnterior === novoStatus) {
      return null;
    }

    // Referência para os contadores
    const contadoresRef = getDatabase().ref("/contadores");

    // Transação para garantir atomicidade
    await getDatabase().ref().runTransaction((transaction) => {
      // Lê os contadores atuais
      if (!transaction.contadores) {
        transaction.contadores = {
          Pendente: 0,
          Concluído: 0,
          total: 0,
        };
      }

      // Decrementa o contador do status anterior, se existir
      if (statusAnterior && transaction.contadores[statusAnterior] !== undefined) {
        transaction.contadores[statusAnterior]--;
      }

      // Incrementa o contador do novo status, se existir
      if (novoStatus && transaction.contadores[novoStatus] !== undefined) {
        transaction.contadores[novoStatus]++;
      }

      // Atualiza o contador total apenas se for uma nova ocorrência ou remoção
      if (!statusAnterior && novoStatus) {
        transaction.contadores.total++;
      } else if (statusAnterior && !novoStatus) {
        transaction.contadores.total--;
      }

      return transaction;
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

// Função para enviar pesquisa de satisfação após certidão concluída (5 minutos depois)
exports.enviarPesquisaSatisfacao = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "America/Sao_Paulo",
  region: "us-central1",
  secrets: [emailPass]
}, async (context) => {
  try {
    // Usar um intervalo de tempo mais amplo para garantir que pegue as ocorrências
    const dezMinutosAtras = Date.now() - 10 * 60 * 1000;
    const umMinutoAtras = Date.now() - 1 * 60 * 1000;

    console.log(`Buscando ocorrências concluídas entre ${new Date(umMinutoAtras).toISOString()} e ${new Date(dezMinutosAtras).toISOString()}`);

    // Modificar a consulta para primeiro verificar pelo status
    const snapshot = await getDatabase()
      .ref("/ocorrencias")
      .orderByChild("status")
      .equalTo("Concluído")
      .once("value");

    if (!snapshot.exists()) {
      console.log("Nenhuma ocorrência com status 'Concluído' encontrada");
      return null;
    }

    const ocorrenciasConcluidas = [];

    // Filtrar manualmente pelo intervalo de tempo
    snapshot.forEach((childSnapshot) => {
      const ocorrencia = childSnapshot.val();
      // Verificar se foi atualizada nos últimos 10 minutos e não recebeu pesquisa
      if (
        ocorrencia.dataAtualizacao && 
        ocorrencia.dataAtualizacao >= dezMinutosAtras &&
        ocorrencia.dataAtualizacao <= umMinutoAtras &&
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

    console.log(`Encontradas ${ocorrenciasConcluidas.length} ocorrências para enviar pesquisa de satisfação`);

    // Enviar e-mails de pesquisa
    const envioPromises = ocorrenciasConcluidas.map(async (ocorrencia) => {
      try {
        // URL para a pesquisa - USAR O ID CORRETO
        const urlPesquisa = `https://certidao-gocg.web.app/feedback?id=${ocorrencia.id}`;

        const mailOptions = {
          from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
          to: ocorrencia.email,
          subject: `Pesquisa de Satisfação - Certidão ${ocorrencia.id}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; color: #333333;">
              <div style="background-color: #4caf50; padding: 25px 30px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; text-align: center; font-size: 24px;">Sua Opinião é Importante para Nós</h2>
              </div>
              
              <div style="padding: 30px; background-color: white; border-left: 1px solid #e1e1e1; border-right: 1px solid #e1e1e1;">
                <p style="margin-top: 0; font-size: 16px;">Olá, <strong>${ocorrencia.nome}</strong>!</p>
                
                <p style="font-size: 16px;">Gostaríamos de agradecer por utilizar nosso sistema de certidões de ocorrência. Esperamos que o processo tenha atendido às suas expectativas.</p>
                
                <p style="font-size: 16px;">Para continuarmos melhorando nossos serviços, gostaríamos de convidá-lo a participar de uma breve pesquisa de satisfação.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${urlPesquisa}" 
                     style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                    Participar da Pesquisa
                  </a>
                </div>
                
                <p style="font-size: 16px;">A pesquisa levará menos de 2 minutos para ser preenchida e suas respostas são muito importantes para melhorarmos continuamente.</p>
                
                <p style="font-size: 16px;">Agradecemos sua colaboração!</p>
                
                <p style="margin-bottom: 5px; font-size: 16px;">Atenciosamente,</p>
                <p style="margin-top: 0; font-size: 16px;"><strong>Grupamento Operacional do Comando Geral</strong></p>
              </div>
              
              <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e1e1e1; border-top: none;">
                <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 120px; height: auto; margin-bottom: 15px;" />
                <p style="margin: 0; font-size: 13px; color: #666666;">Este é um e-mail automático. Por favor, não responda.</p>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: 'bolachaGOCG.png',
              path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
              cid: 'bolachaGOCG' // ID referenciado no src da imagem
            }
          ]
        };

        // Enviar o e-mail
        const transporter = getTransporter();
        await transporter.sendMail(mailOptions);

        // Registrar o envio da pesquisa
        await getDatabase()
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
        await getDatabase()
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
      
// Função para upload de certidão
exports.uploadCertidao = onCall({
  cors: true, // Habilita CORS para todas as origens
  maxInstances: 10
}, async (request) => {
  try {
    const { data } = request;
    
    if (!data.file || !data.occurrenceNumber) {
      throw new Error("Arquivo ou número da ocorrência não fornecidos");
    }
    
    // Nome do arquivo com timestamp para evitar duplicatas
    const fileName = `${Date.now()}_${data.file.name.replace(/[^\w.-]/g, "_")}`;
    const filePath = `ocorrencias/${data.occurrenceNumber}/certidao/${fileName}`;
    
    // Referência para o Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    // Criar URL de upload assinada
    const [uploadURL] = await file.getSignedUrl({
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType: data.file.contentType,
    });
    
    return {
      success: true,
      uploadURL,
      fileName,
      filePath,
    };
  } catch (error) {
    console.error("Erro ao processar upload:", error);
    throw new Error(`Erro ao processar upload: ${error.message}`);
  }
});

// Função manual para enviar email de certidão
exports.reenviarEmailCertidao = onCall({
  secrets: [emailPass]
}, async (request) => {
  try {
    const { data } = request;
    const { occurrenceId } = data;
    
    if (!occurrenceId) {
      throw new Error("Número de ocorrência não fornecido.");
    }
    
    // Buscar os dados da ocorrência
    const snapshot = await getDatabase()
      .ref(`/ocorrencias/${occurrenceId}`)
      .once("value");
    
    const ocorrencia = snapshot.val();
    
    if (!ocorrencia) {
      throw new Error("Ocorrência não encontrada.");
    }
    
    if (!ocorrencia.certidao || !ocorrencia.certidao.url) {
      throw new Error("Esta ocorrência não possui certidão anexada.");
    }
    
    if (!ocorrencia.email) {
      throw new Error("Esta ocorrência não possui email cadastrado.");
    }
    
    // Construir o conteúdo do e-mail
    const mailOptions = {
      from: '"Sistema de Certidões" <gocg.certidao@gmail.com>',
      to: ocorrencia.email,
      subject: `Certidão de Ocorrência ${occurrenceId} - Concluída`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="cid:bolachaGOCG" alt="GOCG" style="max-width: 150px; height: auto;" />
          </div>
          <h2 style="color: #4caf50; text-align: center;">Certidão de Ocorrência Concluída</h2>
          
          <p>Olá, <strong>${ocorrencia.nome}</strong>!</p>
          
          <p>Temos o prazer de informar que sua solicitação de certidão de ocorrência <strong>${occurrenceId}</strong> foi concluída com sucesso.</p>
          
          <p>Você pode acessar sua certidão através do link abaixo:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ocorrencia.certidao.url}" 
               style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Baixar Certidão
            </a>
          </div>
          
          <p>Se você tiver alguma dúvida ou precisar de assistência adicional, não hesite em nos contatar.</p>
          
          <p>Atenciosamente,</p>
          <p><strong>Grupamento Operacional do Comando Geral</strong></p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
            <p>Este é um e-mail automático.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'bolachaGOCG.png',
          path: './bolachaGOCG.png', // Caminho relativo ao arquivo na pasta functions
          cid: 'bolachaGOCG' // ID referenciado no src da imagem
        }
      ]
    };
    
    // Enviar o e-mail
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    
    // Registrar o reenvio no banco de dados
    await getDatabase()
      .ref(`ocorrencias/${occurrenceId}/emailReenviado`)
      .push({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        success: true,
      });
    
    return { 
      success: true, 
      message: `E-mail com certidão reenviado com sucesso para ${ocorrencia.email}` 
    };
    
  } catch (error) {
    console.error("Erro ao reenviar e-mail:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});