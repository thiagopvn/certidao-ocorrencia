/**
 * Sistema de Certidões de Ocorrência - Painel Administrativo
 * Versão simplificada e otimizada
 */

// Cache e variáveis globais
let ocorrenciasCache = null;
let ultimaAtualizacaoCache = 0;
const TEMPO_EXPIRACAO_CACHE = 5 * 60 * 1000; // 5 minutos
let currentOccurrence = null;
let isSubmitting = false;

document.addEventListener("DOMContentLoaded", function () {
  // Elementos DOM principais
  const loginContainer = document.getElementById("login-container");
  const adminDashboard = document.getElementById("admin-dashboard");
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginError = document.getElementById("login-error");
  const userEmail = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const searchInput = document.getElementById("admin-search");
  const searchButton = document.getElementById("admin-search-btn");
  const dateFilter = document.getElementById("date-filter");
  const refreshButton = document.getElementById("refresh-btn");
  const detailModal = document.getElementById("detail-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const statusSelect = document.getElementById("status-select");
  const updateStatusBtn = document.getElementById("update-status-btn");
  const certidaoFileInput = document.getElementById("certidao-file");
  const notificationsBtn = document.getElementById("notifications-btn");
  const notificationsContainer = document.getElementById(
    "notifications-container"
  );

  // Inicialização de contadores
  const pendingCount = document.getElementById("pending-count");
  const completedCount = document.getElementById("completed-count");
  const statsTotal = document.getElementById("stats-total");
  const statsMonth = document.getElementById("stats-month");
  const statsPending = document.getElementById("stats-pending");
  const statsCompleted = document.getElementById("stats-completed");

  // ===== FUNÇÕES DE UTILIDADE =====

  /**
   * Registra uma mensagem no console com timestamp
   */
  function log(mensagem, tipo = "log", dados = null) {
    const timestamp = new Date().toISOString();
    const prefixo = `[${timestamp}] ADMIN:`;

    if (dados) {
      console[tipo || "log"](prefixo, mensagem, dados);
    } else {
      console[tipo || "log"](prefixo, mensagem);
    }
  }

  /**
   * Formata uma data para exibição
   */
  function formatarData(timestamp, incluirHora = false) {
    if (!timestamp) return "N/A";

    const data = new Date(timestamp);
    return incluirHora
      ? data.toLocaleString("pt-BR")
      : data.toLocaleDateString("pt-BR");
  }

  /**
   * Formata um CPF para exibição
   */
  function formatarCPF(cpf) {
    if (!cpf) return "";

    // Remove caracteres não numéricos
    cpf = cpf.replace(/\D/g, "");

    // Aplica a formatação
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Trunca texto para exibição
   */
  function truncarTexto(texto, tamanho = 100) {
    if (!texto) return "";

    if (texto.length <= tamanho) {
      return texto;
    }

    return texto.substring(0, tamanho) + "...";
  }

  /**
   * Mostra uma mensagem de alerta personalizada
   */
  function mostrarAlerta(mensagem, tipo = "info") {
    // Remover alerta existente
    const alertaExistente = document.querySelector(".alerta");
    if (alertaExistente) {
      alertaExistente.remove();
    }

    // Criar o alerta
    const alerta = document.createElement("div");
    alerta.className = `alerta ${tipo}`;

    // Ícone baseado no tipo
    const icone =
      tipo === "success"
        ? "check-circle"
        : tipo === "error"
        ? "exclamation-circle"
        : tipo === "warning"
        ? "exclamation-triangle"
        : "info-circle";

    alerta.innerHTML = `
      <i class="fas fa-${icone}"></i>
      <span>${mensagem}</span>
      <button class="fechar-alerta"><i class="fas fa-times"></i></button>
    `;

    // Adicionar ao DOM
    document.body.appendChild(alerta);

    // Configurar fechamento
    const btnFechar = alerta.querySelector(".fechar-alerta");
    btnFechar.addEventListener("click", () => {
      alerta.classList.add("fechando");
      setTimeout(() => alerta.remove(), 300);
    });

    // Auto-remover após 5 segundos
    setTimeout(() => {
      if (document.body.contains(alerta)) {
        alerta.classList.add("fechando");
        setTimeout(() => alerta.remove(), 300);
      }
    }, 5000);
  }

  /**
   * Mostra um indicador de loading em um container
   */
  function mostrarLoading(container, mensagem = "Carregando...") {
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>${mensagem}</p>
      </div>
    `;
  }

  /**
   * Mostra uma mensagem de erro em um container
   */
  function mostrarErro(
    container,
    mensagem = "Ocorreu um erro. Tente novamente."
  ) {
    container.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${mensagem}</p>
      </div>
    `;
  }

  /**
   * Mostra uma mensagem quando não há dados
   */
  function mostrarVazio(container, mensagem = "Nenhum dado encontrado.") {
    container.innerHTML = `
      <div class="no-data">
        <i class="fas fa-search"></i>
        <p>${mensagem}</p>
      </div>
    `;
  }

  // ===== FUNÇÕES DE AUTENTICAÇÃO =====

  /**
   * Tenta fazer login com Firebase Auth
   */
  async function fazerLogin(email, password) {
    try {
      // Validar entradas
      if (!email || !password) {
        throw new Error("Por favor, preencha todos os campos.");
      }

      // Mostrar estado de loading
      loginButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Entrando...';
      loginButton.disabled = true;
      loginError.textContent = "";

      // Tentar autenticar
      log(`Tentando login para: ${email}`);
      const userCredential = await firebase
        .auth()
        .signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      log(`Login bem-sucedido para: ${user.email}`);

      // Verificar se o usuário tem acesso administrativo
      const isAdmin = await verificarPerfilAdmin(user.uid);

      if (!isAdmin) {
        await firebase.auth().signOut();
        throw new Error("Este usuário não tem permissão de administrador.");
      }

      return user;
    } catch (error) {
      log(`Erro de login: ${error.message}`, "error", error);

      // Traduzir mensagens de erro comuns
      let mensagemErro = "Erro ao fazer login. Tente novamente.";

      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        mensagemErro = "E-mail ou senha incorretos.";
      } else if (error.code === "auth/invalid-email") {
        mensagemErro = "E-mail inválido.";
      } else if (error.code === "auth/user-disabled") {
        mensagemErro = "Esta conta foi desativada.";
      } else if (error.code === "auth/too-many-requests") {
        mensagemErro =
          "Muitas tentativas de login. Tente novamente mais tarde.";
      } else if (error.message) {
        mensagemErro = error.message;
      }

      throw new Error(mensagemErro);
    } finally {
      // Restaurar estado do botão
      loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
      loginButton.disabled = false;
    }
  }

  /**
   * Verifica se um usuário tem perfil de administrador
   */
  async function verificarPerfilAdmin(uid) {
    try {
      const snapshot = await firebase
        .database()
        .ref(`admin_users/${uid}`)
        .once("value");
      return snapshot.exists() && snapshot.val() === true;
    } catch (error) {
      log(`Erro ao verificar perfil admin: ${error.message}`, "error", error);
      return false;
    }
  }

  /**
   * Faz logout do usuário
   */
  async function fazerLogout() {
    try {
      log("Iniciando logout");
      await firebase.auth().signOut();
      log("Logout realizado com sucesso");

      // Limpar cache
      ocorrenciasCache = null;

      return true;
    } catch (error) {
      log(`Erro ao fazer logout: ${error.message}`, "error", error);
      mostrarAlerta(`Erro ao fazer logout: ${error.message}`, "error");
      throw error;
    }
  }

  // ===== FUNÇÕES DE GERENCIAMENTO DE DADOS =====

  /**
   * Carrega dados das ocorrências do Firebase
   */
  async function carregarOcorrencias(forcarAtualizacao = false) {
    try {
      // Verificar se podemos usar o cache
      const agora = Date.now();
      if (
        !forcarAtualizacao &&
        ocorrenciasCache &&
        agora - ultimaAtualizacaoCache < TEMPO_EXPIRACAO_CACHE
      ) {
        log("Usando dados em cache");
        return ocorrenciasCache;
      }

      log("Buscando ocorrências do Firebase");
      const snapshot = await firebase
        .database()
        .ref("ocorrencias")
        .once("value");

      if (!snapshot.exists()) {
        log("Nenhuma ocorrência encontrada");
        return [];
      }

      const ocorrencias = [];

      snapshot.forEach((childSnapshot) => {
        ocorrencias.push({
          id: childSnapshot.key,
          ...childSnapshot.val(),
        });
      });

      log(`${ocorrencias.length} ocorrências carregadas`);

      // Atualizar cache
      ocorrenciasCache = ocorrencias;
      ultimaAtualizacaoCache = agora;

      return ocorrencias;
    } catch (error) {
      log(`Erro ao carregar ocorrências: ${error.message}`, "error", error);
      throw new Error(
        "Erro ao carregar dados. Por favor, recarregue a página."
      );
    }
  }

  /**
   * Carrega dados de uma ocorrência específica
   */
  async function carregarOcorrencia(occurrenceNumber) {
    try {
      log(`Carregando detalhes da ocorrência: ${occurrenceNumber}`);
      const snapshot = await firebase
        .database()
        .ref(`ocorrencias/${occurrenceNumber}`)
        .once("value");

      if (!snapshot.exists()) {
        throw new Error("Ocorrência não encontrada!");
      }

      return {
        id: snapshot.key,
        ...snapshot.val(),
      };
    } catch (error) {
      log(
        `Erro ao carregar ocorrência ${occurrenceNumber}: ${error.message}`,
        "error",
        error
      );
      throw new Error(
        `Erro ao carregar detalhes da ocorrência: ${error.message}`
      );
    }
  }

  /**
   * Atualiza o status de uma ocorrência
   */
  async function atualizarStatusOcorrencia(occurrenceNumber, newStatus) {
    try {
      log(
        `Atualizando status da ocorrência ${occurrenceNumber} para ${newStatus}`
      );

      await firebase.database().ref(`ocorrencias/${occurrenceNumber}`).update({
        status: newStatus,
        dataAtualizacao: Date.now(),
      });

      log("Status atualizado com sucesso");

      // Atualizar cache se existir
      if (ocorrenciasCache) {
        const index = ocorrenciasCache.findIndex(
          (o) => o.id === occurrenceNumber
        );
        if (index !== -1) {
          ocorrenciasCache[index].status = newStatus;
          ocorrenciasCache[index].dataAtualizacao = Date.now();
        }
      }

      return true;
    } catch (error) {
      log(`Erro ao atualizar status: ${error.message}`, "error", error);
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
  }

  /**
   * Faz upload de um arquivo de certidão
   */
  async function uploadCertidao(occurrenceNumber, certidaoFile) {
    try {
      if (!certidaoFile) {
        throw new Error("Nenhum arquivo selecionado");
      }

      // Validar tipo de arquivo
      const tiposPermitidos = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!tiposPermitidos.includes(certidaoFile.type)) {
        throw new Error("Tipo de arquivo não permitido. Use PDF, JPG ou PNG.");
      }

      // Validar tamanho (máximo 10MB)
      const tamanhoMaximo = 10 * 1024 * 1024;
      if (certidaoFile.size > tamanhoMaximo) {
        throw new Error(
          `Arquivo muito grande (${(certidaoFile.size / 1024 / 1024).toFixed(
            2
          )}MB). O limite é 10MB.`
        );
      }

      log(
        `Iniciando upload para ocorrência ${occurrenceNumber}: ${certidaoFile.name}`
      );

      // Mostrar indicador de progresso
      const progressContainer = document.createElement("div");
      progressContainer.className = "upload-progress";
      progressContainer.innerHTML = `
        <div class="progress-label">Enviando: <span>0%</span></div>
        <div class="progress-bar"><div class="progress-fill"></div></div>
      `;

      // Adicionar ao DOM
      const uploadSection =
        document.querySelector(".upload-section") ||
        document.getElementById("certidao-upload-container");
      if (uploadSection) {
        uploadSection.appendChild(progressContainer);
      }

      // Referência do storage
      const filename = `${Date.now()}_${certidaoFile.name.replace(
        /[^\w.-]/g,
        "_"
      )}`;
      const storagePath = `ocorrencias/${occurrenceNumber}/certidao/${filename}`;
      const storageRef = firebase.storage().ref(storagePath);

      // Upload com monitoramento de progresso
      const uploadTask = storageRef.put(certidaoFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Progresso
          const progresso = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          const progressLabel = progressContainer.querySelector(
            ".progress-label span"
          );
          const progressFill =
            progressContainer.querySelector(".progress-fill");

          if (progressLabel && progressFill) {
            progressLabel.textContent = `${progresso}%`;
            progressFill.style.width = `${progresso}%`;
          }
        },
        (error) => {
          // Erro
          log("Erro no upload", "error", error);
          if (progressContainer) {
            progressContainer.innerHTML = `
              <div class="upload-error">
                <i class="fas fa-exclamation-circle"></i>
                Erro: ${error.message || "Falha no upload"}
              </div>
            `;
          }
          throw error;
        }
      );

      // Aguardar conclusão do upload
      await uploadTask;

      // Obter URL do arquivo
      const downloadURL = await storageRef.getDownloadURL();

      // Atualizar UI após upload completo
      if (progressContainer) {
        progressContainer.innerHTML = `
          <div class="upload-complete">
            <i class="fas fa-check-circle"></i>
            Upload completo!
          </div>
        `;
      }

      log("Upload concluído com sucesso", "info", downloadURL);

      // Retornar dados do arquivo
      return {
        nome: certidaoFile.name,
        url: downloadURL,
        dataUpload: Date.now(),
        tamanho: certidaoFile.size,
        tipo: certidaoFile.type,
      };
    } catch (error) {
      log("Erro detalhado do upload:", "error", error);
      mostrarAlerta(`Erro ao fazer upload: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Envia e-mail com a certidão
   */
  async function enviarEmailCertidao(
    email,
    nome,
    occurrenceNumber,
    certidaoURL
  ) {
    try {
      log(
        `Enviando e-mail para ${email} referente à ocorrência ${occurrenceNumber}`
      );

      // Verificar se o módulo functions está disponível
      if (!firebase.functions) {
        throw new Error("Firebase Functions não está disponível");
      }

      // Chamar a função Cloud Function
      const enviarEmailFunction = firebase
        .functions()
        .httpsCallable("enviarEmailCertidao");
      const resultado = await enviarEmailFunction({
        destinatario: email,
        nome: nome,
        numeroOcorrencia: occurrenceNumber,
        certidaoURL: certidaoURL,
      });

      log("Resultado do envio de e-mail:", "info", resultado.data);

      if (!resultado.data.success) {
        throw new Error(resultado.data.message || "Falha ao enviar e-mail");
      }

      return resultado.data;
    } catch (error) {
      log(`Erro ao enviar e-mail: ${error.message}`, "error", error);
      throw new Error(`Erro ao enviar e-mail: ${error.message}`);
    }
  }

  /**
   * Envia e-mail manualmente
   */
  async function enviarEmailManualmente(occurrenceNumber) {
    try {
      // Mostrar feedback visual
      const sendEmailBtn = document.querySelector(".send-email-btn");
      if (sendEmailBtn) {
        sendEmailBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        sendEmailBtn.disabled = true;
      }

      // Obter dados da ocorrência
      const ocorrencia = await carregarOcorrencia(occurrenceNumber);

      if (!ocorrencia || !ocorrencia.certidao || !ocorrencia.certidao.url) {
        throw new Error(
          "Não é possível enviar o e-mail porque não há certidão anexada."
        );
      }

      // Enviar e-mail
      const resultado = await enviarEmailCertidao(
        ocorrencia.email,
        ocorrencia.nome,
        occurrenceNumber,
        ocorrencia.certidao.url
      );

      // Atualizar UI
      mostrarAlerta(
        `E-mail enviado com sucesso para ${ocorrencia.email}`,
        "success"
      );

      // Recarregar detalhes para atualizar a seção de e-mail
      viewOcorrenciaDetails(occurrenceNumber);

      return resultado;
    } catch (error) {
      log("Erro ao enviar e-mail manualmente:", "error", error);
      mostrarAlerta(`Erro ao enviar e-mail: ${error.message}`, "error");
      throw error;
    } finally {
      // Restaurar o botão
      const sendEmailBtn = document.querySelector(".send-email-btn");
      if (sendEmailBtn) {
        sendEmailBtn.innerHTML =
          '<i class="fas fa-envelope"></i> Reenviar E-mail';
        sendEmailBtn.disabled = false;
      }
    }
  }

  // ===== FUNÇÕES DE INTERFACE =====

  /**
   * Atualiza as estatísticas do dashboard
   */
  function atualizarEstatisticas(ocorrencias) {
    const agora = new Date();
    const inicioMes = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1
    ).getTime();

    const stats = {
      pendentes: 0,
      concluidas: 0,
      canceladas: 0,
      emAnalise: 0,
      total: ocorrencias.length,
      mes: 0,
    };

    ocorrencias.forEach((ocorrencia) => {
      if (ocorrencia.status === "Pendente") {
        stats.pendentes++;
      } else if (ocorrencia.status === "Concluído") {
        stats.concluidas++;
      } else if (ocorrencia.status === "Cancelado") {
        stats.canceladas++;
      } else if (ocorrencia.status === "Em Análise") {
        stats.emAnalise++;
      }

      // Contar ocorrências do mês atual
      if (ocorrencia.timestamp >= inicioMes) {
        stats.mes++;
      }
    });

    // Atualizar contadores na UI
    if (pendingCount) pendingCount.textContent = stats.pendentes;
    if (completedCount) completedCount.textContent = stats.concluidas;

    // Atualizar estatísticas detalhadas
    if (statsTotal) statsTotal.textContent = stats.total;
    if (statsMonth) statsMonth.textContent = stats.mes;
    if (statsPending) statsPending.textContent = stats.pendentes;
    if (statsCompleted) statsCompleted.textContent = stats.concluidas;

    // Calcular percentual de concluídas (para mostrar tendência)
    const percentConcluidas =
      stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0;

    const statsCompletedPercent = document.getElementById(
      "stats-completed-percent"
    );
    if (statsCompletedPercent) {
      statsCompletedPercent.textContent = `${percentConcluidas}%`;
    }

    return stats;
  }

  /**
   * Filtra ocorrências baseado nos critérios selecionados
   */
  function filtrarOcorrencias(ocorrencias, abaAtiva, termoBusca, filtroData) {
    // Filtrar por aba
    let resultado = ocorrencias;

    if (abaAtiva === "pending") {
      resultado = ocorrencias.filter((o) => o.status === "Pendente");
    } else if (abaAtiva === "completed") {
      resultado = ocorrencias.filter((o) => o.status === "Concluído");
    } else if (abaAtiva === "in-analysis") {
      resultado = ocorrencias.filter((o) => o.status === "Em Análise");
    } else if (abaAtiva === "canceled") {
      resultado = ocorrencias.filter((o) => o.status === "Cancelado");
    }

    // Filtrar por texto de busca
    if (termoBusca) {
      const termoLowerCase = termoBusca.toLowerCase();
      resultado = resultado.filter(
        (o) =>
          (o.occurrenceNumber &&
            o.occurrenceNumber.toLowerCase().includes(termoLowerCase)) ||
          (o.nome && o.nome.toLowerCase().includes(termoLowerCase)) ||
          (o.cpf && o.cpf.includes(termoLowerCase))
      );
    }

    // Filtrar por data
    if (filtroData && filtroData !== "all") {
      const agora = new Date();
      const hoje = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate()
      ).getTime();

      if (filtroData === "today") {
        resultado = resultado.filter((o) => o.timestamp >= hoje);
      } else if (filtroData === "week") {
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        inicioSemana.setHours(0, 0, 0, 0);
        resultado = resultado.filter(
          (o) => o.timestamp >= inicioSemana.getTime()
        );
      } else if (filtroData === "month") {
        const inicioMes = new Date(
          agora.getFullYear(),
          agora.getMonth(),
          1
        ).getTime();
        resultado = resultado.filter((o) => o.timestamp >= inicioMes);
      }
    }

    // Ordenar por data (mais recentes primeiro)
    resultado.sort((a, b) => b.timestamp - a.timestamp);

    return resultado;
  }

  /**
   * Renderiza ocorrências em um container
   */
  function renderizarOcorrencias(containerId, ocorrencias) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Limpar container
    container.innerHTML = "";

    if (ocorrencias.length === 0) {
      mostrarVazio(
        container,
        "Nenhuma ocorrência encontrada com os filtros aplicados."
      );
      return;
    }

    // Criar card para cada ocorrência
    ocorrencias.forEach((ocorrencia) => {
      const card = criarCardOcorrencia(ocorrencia);
      container.appendChild(card);
    });
  }

  /**
   * Cria o HTML para um card de ocorrência
   */
  function criarCardOcorrencia(ocorrencia) {
    const card = document.createElement("div");
    card.className = `ocorrencia-card status-${ocorrencia.status
      .toLowerCase()
      .replace(" ", "-")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")}`;
    card.setAttribute("data-id", ocorrencia.occurrenceNumber);

    const dataOcorrencia = formatarData(ocorrencia.timestamp, true);

    card.innerHTML = `
      <div class="card-header">
        <div class="ocorrencia-number">${ocorrencia.occurrenceNumber}</div>
        <div class="ocorrencia-status ${ocorrencia.status
          .toLowerCase()
          .replace(" ", "-")}">${ocorrencia.status}</div>
      </div>
      <div class="card-body">
        <div class="ocorrencia-info">
          <div class="info-row">
            <i class="fas fa-user"></i>
            <span class="info-label">Nome:</span>
            <span class="info-value">${ocorrencia.nome}</span>
          </div>
          <div class="info-row">
            <i class="fas fa-id-card"></i>
            <span class="info-label">CPF:</span>
            <span class="info-value">${formatarCPF(ocorrencia.cpf)}</span>
          </div>
          <div class="info-row">
            <i class="fas fa-calendar"></i>
            <span class="info-label">Data:</span>
            <span class="info-value">${dataOcorrencia}</span>
          </div>
          <div class="info-row">
            <i class="fas fa-map-marker-alt"></i>
            <span class="info-label">Local:</span>
            <span class="info-value">${truncarTexto(
              ocorrencia.enderecoOcorrencia,
              40
            )}</span>
          </div>
          ${
            ocorrencia.certidao
              ? `<div class="info-row certidao-row">
              <i class="fas fa-file-pdf"></i>
              <span class="info-label">Certidão:</span>
              <a href="${ocorrencia.certidao.url}" target="_blank" class="visualizar-link">
                Visualizar <i class="fas fa-external-link-alt"></i>
              </a>
            </div>`
              : ""
          }
        </div>
      </div>
      <div class="card-footer">
        <button class="view-btn" data-id="${ocorrencia.occurrenceNumber}">
          <i class="fas fa-eye"></i> Ver Detalhes
        </button>
      </div>
    `;

    // Adicionar evento de clique ao botão
    const viewBtn = card.querySelector(".view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        viewOcorrenciaDetails(ocorrencia.occurrenceNumber);
      });
    }

    return card;
  }

  /**
   * Exibe os detalhes de uma ocorrência no modal
   */
  async function viewOcorrenciaDetails(occurrenceNumber) {
    try {
      // Abrir modal com loading
      detailModal.style.display = "flex";
      modalTitle.textContent = `Detalhes da Ocorrência: ${occurrenceNumber}`;
      mostrarLoading(modalBody, "Carregando detalhes...");

      // Definir ocorrência atual
      currentOccurrence = occurrenceNumber;

      // Carregar dados da ocorrência
      const ocorrencia = await carregarOcorrencia(occurrenceNumber);

      // Atualizar select de status
      if (statusSelect) {
        statusSelect.value = ocorrencia.status;
      }

      // Verificar se a certidão já foi anexada
      let certidaoSection = "";
      if (ocorrencia.certidao && ocorrencia.certidao.url) {
        // Se já existe certidão, mostrar os detalhes
        certidaoSection = `
          <div class="modal-section">
            <div class="section-title"><i class="fas fa-file-pdf"></i> Certidão Anexada</div>
            <div class="certidao-info">
              <p><strong>Nome do arquivo:</strong> ${
                ocorrencia.certidao.nome
              }</p>
              <p><strong>Data de upload:</strong> ${formatarData(
                ocorrencia.certidao.dataUpload,
                true
              )}</p>
              <p><a href="${
                ocorrencia.certidao.url
              }" target="_blank" class="download-btn"><i class="fas fa-download"></i> Visualizar/Baixar Certidão</a></p>
            </div>
          </div>
        `;

        // Se já existe certidão e o status é "Concluído", ocultar o campo de upload
        if (ocorrencia.status === "Concluído") {
          const uploadContainer = document.getElementById(
            "certidao-upload-container"
          );
          if (uploadContainer) {
            uploadContainer.style.display = "none";
          }
        } else {
          const uploadContainer = document.getElementById(
            "certidao-upload-container"
          );
          if (uploadContainer) {
            uploadContainer.style.display = "block";
          }
        }
      } else {
        // Se não existe certidão, mostrar o campo de upload
        const uploadContainer = document.getElementById(
          "certidao-upload-container"
        );
        if (uploadContainer) {
          uploadContainer.style.display = "block";
        }
      }

      // Verificar se o e-mail foi enviado
      let emailSection = "";
      if (ocorrencia.emailEnviado) {
        const emailStatus = ocorrencia.emailEnviado.success
          ? '<span class="status-badge concluido">Enviado com sucesso</span>'
          : '<span class="status-badge cancelado">Falha no envio</span>';

        const dataEnvio = formatarData(ocorrencia.emailEnviado.timestamp, true);

        // Botão de reenvio, só aparece se a certidão estiver anexada
        const reenvioBtn =
          ocorrencia.certidao && ocorrencia.certidao.url
            ? `<button onclick="enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn"><i class="fas fa-paper-plane"></i> Reenviar E-mail</button>`
            : "";

        emailSection = `
          <div class="modal-section">
            <div class="section-title"><i class="fas fa-envelope"></i> Status do E-mail</div>
            <div class="email-info">
              <p><strong>Status:</strong> ${emailStatus}</p>
              <p><strong>Data/Hora:</strong> ${dataEnvio}</p>
              ${
                ocorrencia.emailEnviado.error
                  ? `<p><strong>Erro:</strong> ${ocorrencia.emailEnviado.error}</p>`
                  : ""
              }
              ${reenvioBtn}
            </div>
          </div>
        `;
      } else if (ocorrencia.certidao && ocorrencia.certidao.url) {
        // Se há certidão mas não há tentativa de envio de e-mail, mostrar botão para enviar
        emailSection = `
          <div class="modal-section">
            <div class="section-title"><i class="fas fa-envelope"></i> Status do E-mail</div>
            <div class="email-info">
              <p>Nenhum e-mail foi enviado ainda.</p>
              <button onclick="enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn"><i class="fas fa-paper-plane"></i> Enviar E-mail</button>
            </div>
          </div>
        `;
      }

      // Formatar datas
      const dataOcorrencia = formatarData(ocorrencia.dataOcorrencia);
      const dataNascimento = formatarData(ocorrencia.dataNascimento);
      const dataTimestamp = formatarData(ocorrencia.timestamp, true);

      // Construir conteúdo do modal
      const content = `
        <div class="modal-section">
          <div class="status-header">
            <h3>Status Atual:</h3>
            <span class="status-badge ${ocorrencia.status
              .toLowerCase()
              .replace(" ", "-")}">${ocorrencia.status}</span>
          </div>
          <p><i class="fas fa-clock"></i> Solicitação criada em: ${dataTimestamp}</p>
          ${
            ocorrencia.dataAtualizacao
              ? `<p><i class="fas fa-sync-alt"></i> Última atualização: ${formatarData(
                  ocorrencia.dataAtualizacao,
                  true
                )}</p>`
              : ""
          }
        </div>
        
        ${certidaoSection}
        ${emailSection}
        
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-user-circle"></i> Informações do Solicitante</div>
          <div class="info-grid">
            <div class="info-item">
              <label>Nome Completo:</label>
              <p>${ocorrencia.nome}</p>
            </div>
            <div class="info-item">
              <label>CPF:</label>
              <p>${formatarCPF(ocorrencia.cpf)}</p>
            </div>
            <div class="info-item">
              <label>RG:</label>
              <p>${ocorrencia.rg}</p>
            </div>
            <div class="info-item">
              <label>Data de Nascimento:</label>
              <p>${dataNascimento}</p>
            </div>
            <div class="info-item">
              <label>E-mail:</label>
              <p>${ocorrencia.email}</p>
            </div>
            <div class="info-item">
              <label>Telefone:</label>
              <p>${ocorrencia.telefone || "Não informado"}</p>
            </div>
          </div>
        </div>
        
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-exclamation-circle"></i> Detalhes da Ocorrência</div>
          <div class="info-grid">
            <div class="info-item">
              <label>Data da Ocorrência:</label>
              <p>${dataOcorrencia}</p>
            </div>
            <div class="info-item">
              <label>Endereço da Ocorrência:</label>
              <p>${ocorrencia.enderecoOcorrencia}</p>
            </div>
            <div class="info-item full-width">
              <label>Descrição:</label>
              <p class="description-text">${ocorrencia.descricao}</p>
            </div>
          </div>
        </div>
        
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-file-alt"></i> Documentos Anexados</div>
          ${getDocumentosHTML(ocorrencia.documentos)}
        </div>
      `;

      // Atualizar corpo do modal
      modalBody.innerHTML = content;
    } catch (error) {
      log(
        `Erro ao carregar detalhes da ocorrência ${occurrenceNumber}: ${error.message}`,
        "error",
        error
      );
      mostrarErro(modalBody, `Erro ao carregar detalhes: ${error.message}`);
    }
  }

  /**
   * Formata HTML para exibição de documentos
   */
  function getDocumentosHTML(documentos) {
    if (!documentos) return "<p>Nenhum documento anexado.</p>";

    let html = '<div class="documentos-list">';

    if (documentos.documentoIdentidade) {
      html += `
        <div class="documento-item">
          <div class="documento-icon"><i class="fas fa-id-card"></i></div>
          <div class="documento-info">
            <p class="documento-name">Documento de Identidade</p>
            <p class="documento-type">${documentos.documentoIdentidade.nome}</p>
          </div>
          <div class="documento-actions">
            <a href="${documentos.documentoIdentidade.url}" target="_blank" title="Visualizar"><i class="fas fa-eye"></i></a>
            <a href="${documentos.documentoIdentidade.url}" download title="Baixar"><i class="fas fa-download"></i></a>
          </div>
        </div>
      `;
    }

    if (documentos.comprovanteResidencia) {
      html += `
        <div class="documento-item">
          <div class="documento-icon"><i class="fas fa-home"></i></div>
          <div class="documento-info">
            <p class="documento-name">Comprovante de Residência</p>
            <p class="documento-type">${documentos.comprovanteResidencia.nome}</p>
          </div>
          <div class="documento-actions">
            <a href="${documentos.comprovanteResidencia.url}" target="_blank" title="Visualizar"><i class="fas fa-eye"></i></a>
            <a href="${documentos.comprovanteResidencia.url}" download title="Baixar"><i class="fas fa-download"></i></a>
          </div>
        </div>
      `;
    }

    if (documentos.documentoCarro) {
      html += `
        <div class="documento-item">
          <div class="documento-icon"><i class="fas fa-car"></i></div>
          <div class="documento-info">
            <p class="documento-name">Documento do Carro</p>
            <p class="documento-type">${documentos.documentoCarro.nome}</p>
          </div>
          <div class="documento-actions">
            <a href="${documentos.documentoCarro.url}" target="_blank" title="Visualizar"><i class="fas fa-eye"></i></a>
            <a href="${documentos.documentoCarro.url}" download title="Baixar"><i class="fas fa-download"></i></a>
          </div>
        </div>
      `;
    }

    if (documentos.outrosDocumentos && documentos.outrosDocumentos.length > 0) {
      documentos.outrosDocumentos.forEach((doc) => {
        html += `
          <div class="documento-item">
            <div class="documento-icon"><i class="fas fa-file-alt"></i></div>
            <div class="documento-info">
              <p class="documento-name">Documento Adicional</p>
              <p class="documento-type">${doc.nome}</p>
            </div>
            <div class="documento-actions">
              <a href="${doc.url}" target="_blank" title="Visualizar"><i class="fas fa-eye"></i></a>
              <a href="${doc.url}" download title="Baixar"><i class="fas fa-download"></i></a>
            </div>
          </div>
        `;
      });
    }

    html += "</div>";

    return html;
  }

  /**
   * Carrega dados para a aba ativa
   */
  async function carregarDadosAba(abaAtiva) {
    try {
      // Mapear nomes de abas para IDs de containers
      const containerIds = {
        pending: "pending-ocorrencias",
        completed: "completed-ocorrencias",
        "in-analysis": "analysis-ocorrencias",
        all: "all-ocorrencias",
      };

      const containerId = containerIds[abaAtiva];
      const container = document.getElementById(containerId);

      if (!container) return;

      // Mostrar loading
      mostrarLoading(container, "Carregando ocorrências...");

      // Carregar ocorrências (podem vir do cache)
      const ocorrencias = await carregarOcorrencias();

      // Filtrar e renderizar
      const termoBusca = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";
      const filtroDataAtual = dateFilter ? dateFilter.value : "all";

      const ocorrenciasFiltradas = filtrarOcorrencias(
        ocorrencias,
        abaAtiva,
        termoBusca,
        filtroDataAtual
      );
      renderizarOcorrencias(containerId, ocorrenciasFiltradas);

      return ocorrenciasFiltradas;
    } catch (error) {
      log(
        `Erro ao carregar dados da aba ${abaAtiva}: ${error.message}`,
        "error",
        error
      );
      const container = document.getElementById(containerIds[abaAtiva]);
      if (container) {
        mostrarErro(container, `Erro ao carregar dados: ${error.message}`);
      }
    }
  }

  /**
   * Carrega todos os dados do dashboard
   */
  async function loadDashboardData() {
    try {
      // Mostrar indicador de carregamento
      const containers = [
        "pending-ocorrencias",
        "completed-ocorrencias",
        "all-ocorrencias",
      ];
      containers.forEach((id) => {
        const container = document.getElementById(id);
        if (container) {
          mostrarLoading(container, "Carregando...");
        }
      });

      // Carregar ocorrências do Firebase
      const ocorrencias = await carregarOcorrencias(true);

      // Atualizar estatísticas
      atualizarEstatisticas(ocorrencias);

      // Carregar dados para a aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"));
      }

      // Verificar notificações
      verificarNotificacoesNaoLidas();

      return ocorrencias;
    } catch (error) {
      log(
        `Erro ao carregar dados do dashboard: ${error.message}`,
        "error",
        error
      );
      mostrarAlerta(
        `Erro ao carregar dados. Por favor, recarregue a página.`,
        "error"
      );
    }
  }

  // ===== GERENCIAMENTO DE NOTIFICAÇÕES =====

  /**
   * Carrega notificações não lidas
   */
  async function carregarNotificacoesNaoLidas() {
    try {
      // Obter usuário atual
      const user = firebase.auth().currentUser;
      if (!user) return [];

      // Obter notificações não lidas
      const snapshot = await firebase
        .database()
        .ref("notificacoes")
        .orderByChild("lida")
        .equalTo(false)
        .once("value");

      if (!snapshot.exists()) {
        return [];
      }

      const notificacoes = [];

      snapshot.forEach((childSnapshot) => {
        const notificacao = childSnapshot.val();

        // Verificar se a notificação é para todos ou para este usuário
        if (
          notificacao.destinatario === "todos" ||
          notificacao.destinatario === user.email
        ) {
          notificacoes.push({
            id: childSnapshot.key,
            ...notificacao,
          });
        }
      });

      // Ordenar por timestamp (mais recentes primeiro)
      notificacoes.sort((a, b) => b.timestamp - a.timestamp);

      return notificacoes;
    } catch (error) {
      log(`Erro ao carregar notificações: ${error.message}`, "error", error);
      return [];
    }
  }

  /**
   * Marcar uma notificação como lida
   */
  async function marcarNotificacaoLida(notificacaoId) {
    try {
      // Verificar se o usuário está autenticado
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("Usuário não autenticado");

      // Usar Cloud Function se disponível
      if (firebase.functions) {
        const marcarLidaFunction = firebase
          .functions()
          .httpsCallable("marcarNotificacaoLida");
        await marcarLidaFunction({ notificacaoId });
      } else {
        // Fallback para atualização direta
        await firebase.database().ref(`notificacoes/${notificacaoId}`).update({
          lida: true,
        });
      }

      return true;
    } catch (error) {
      log(
        `Erro ao marcar notificação como lida: ${error.message}`,
        "error",
        error
      );
      throw error;
    }
  }

  /**
   * Atualiza indicador de notificações
   */
  function atualizarIndicadorNotificacoes(count) {
    const notificationCount = document.getElementById("notification-count");

    if (notificationCount) {
      if (count > 0) {
        notificationCount.textContent = count > 99 ? "99+" : count;
        notificationCount.style.display = "flex";
      } else {
        notificationCount.style.display = "none";
      }
    }
  }

  /**
   * Renderiza notificações na interface
   */
  function renderizarNotificacoes(notificacoes) {
    const notificationsBody = document.getElementById("notifications-body");
    if (!notificationsBody) return;

    // Limpar conteúdo atual
    notificationsBody.innerHTML = "";

    if (notificacoes.length === 0) {
      notificationsBody.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>Não há notificações novas.</p>
        </div>
      `;
      return;
    }

    // Renderizar cada notificação
    notificacoes.forEach((notificacao) => {
      const notificacaoElement = document.createElement("div");
      notificacaoElement.className = `notification-item ${
        notificacao.lida ? "" : "unread"
      }`;
      notificacaoElement.setAttribute("data-id", notificacao.id);

      // Formatar data
      const dataNotificacao = formatarData(notificacao.timestamp, true);

      // Conteúdo baseado no tipo de notificação
      let conteudo = "";
      let icone = "bell";

      if (notificacao.tipo === "atualizacao_status") {
        conteudo = `
          <strong>${notificacao.nomeCliente}</strong> teve o status da ocorrência 
          <strong>${notificacao.occurrenceId}</strong> alterado de 
          <strong>${notificacao.statusAnterior}</strong> para 
          <strong>${notificacao.novoStatus}</strong>.
        `;

        // Ícones diferentes baseados no status
        if (notificacao.novoStatus === "Concluído") {
          icone = "check-circle";
        } else if (notificacao.novoStatus === "Pendente") {
          icone = "clock";
        } else if (notificacao.novoStatus === "Em Análise") {
          icone = "search";
        } else if (notificacao.novoStatus === "Cancelado") {
          icone = "times-circle";
        }
      } else {
        conteudo = notificacao.mensagem || "Nova notificação recebida.";
      }

      notificacaoElement.innerHTML = `
        <div class="notification-icon ${notificacao.tipo}">
          <i class="fas fa-${icone}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-message">${conteudo}</div>
          <div class="notification-time">${dataNotificacao}</div>
        </div>
        <button class="notification-mark-read" title="Marcar como lida">
          <i class="fas fa-check"></i>
        </button>
      `;

      // Adicionar à lista
      notificationsBody.appendChild(notificacaoElement);

      // Evento para marcar como lida
      const markReadBtn = notificacaoElement.querySelector(
        ".notification-mark-read"
      );
      if (markReadBtn) {
        markReadBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await marcarNotificacaoLida(notificacao.id);
            notificacaoElement.classList.remove("unread");
            verificarNotificacoesNaoLidas();
          } catch (error) {
            mostrarAlerta("Erro ao marcar notificação como lida", "error");
          }
        });
      }

      // Evento para abrir detalhes da ocorrência
      if (notificacao.occurrenceId) {
        notificacaoElement.addEventListener("click", () => {
          viewOcorrenciaDetails(notificacao.occurrenceId);

          // Fechar painel de notificações
          if (notificationsContainer) {
            notificationsContainer.style.display = "none";
          }
        });
      }
    });
  }

  /**
   * Verifica notificações não lidas e atualiza UI
   */
  async function verificarNotificacoesNaoLidas() {
    try {
      const notificacoes = await carregarNotificacoesNaoLidas();
      atualizarIndicadorNotificacoes(notificacoes.length);

      // Renderizar notificações se o painel estiver aberto
      if (
        notificationsContainer &&
        notificationsContainer.style.display === "block"
      ) {
        renderizarNotificacoes(notificacoes);
      }

      return notificacoes.length;
    } catch (error) {
      log(`Erro ao verificar notificações: ${error.message}`, "error", error);
      return 0;
    }
  }

  // ===== EVENT LISTENERS =====

  // Tratamento de login
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      try {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        // Validar entradas
        if (!email || !password) {
          if (loginError)
            loginError.textContent = "Por favor, preencha todos os campos.";
          return;
        }

        // Tentar login
        const user = await fazerLogin(email, password);

        // Atualizar UI após login bem-sucedido
        if (loginContainer) loginContainer.style.display = "none";
        if (adminDashboard) adminDashboard.style.display = "block";

        // Exibir e-mail do usuário
        if (userEmail) {
          userEmail.textContent = user.email;
        }

        // Carregar dados do dashboard
        loadDashboardData();
      } catch (error) {
        // Exibir erro
        if (loginError) loginError.textContent = error.message;
      }
    });
  }

  // Tratamento de logout
  if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
      try {
        await fazerLogout();

        // Atualizar UI após logout
        if (adminDashboard) adminDashboard.style.display = "none";
        if (loginContainer) loginContainer.style.display = "block";
      } catch (error) {
        mostrarAlerta(error.message, "error");
      }
    });
  }

  // Navegação entre abas
  navItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remover classe active de todos os items
      navItems.forEach((nav) => nav.classList.remove("active"));

      // Adicionar classe active ao item clicado
      this.classList.add("active");

      // Atualizar título da aba
      const currentTabTitle = document.getElementById("current-tab-title");
      if (currentTabTitle) {
        let tabTitle = this.textContent.trim();
        let tabIcon = "clock";

        // Definir ícone baseado na aba
        if (this.getAttribute("data-tab") === "pending") {
          tabIcon = "clock";
          tabTitle = "Solicitações Pendentes";
        } else if (this.getAttribute("data-tab") === "completed") {
          tabIcon = "check-circle";
          tabTitle = "Solicitações Concluídas";
        } else if (this.getAttribute("data-tab") === "all") {
          tabIcon = "list";
          tabTitle = "Todas as Solicitações";
        }

        currentTabTitle.innerHTML = `<i class="fas fa-${tabIcon}"></i> ${tabTitle}`;
      }

      // Esconder todos os conteúdos de abas
      tabContents.forEach((tab) => (tab.style.display = "none"));

      // Mostrar conteúdo da aba selecionada
      const tabId = this.getAttribute("data-tab") + "-tab";
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.style.display = "block";
      }

      // Carregar dados para a aba
      carregarDadosAba(this.getAttribute("data-tab"));
    });
  });

  // Busca
  if (searchButton) {
    searchButton.addEventListener("click", function () {
      // Obter aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"));
      }
    });
  }

  // Permitir busca com Enter
  if (searchInput) {
    searchInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        if (searchButton) searchButton.click();
      }
    });
  }

  // Filtro de data
  if (dateFilter) {
    dateFilter.addEventListener("change", function () {
      // Obter aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"));
      }
    });
  }

  // Atualização de status
  if (updateStatusBtn) {
    updateStatusBtn.addEventListener("click", async function () {
      if (!currentOccurrence) return;

      // Prevenir multiplos envios
      if (isSubmitting) return;
      isSubmitting = true;

      // Obter novo status
      const newStatus = statusSelect.value;

      // Mostrar estado de carregamento
      const originalText = updateStatusBtn.innerHTML;
      updateStatusBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
      updateStatusBtn.disabled = true;

      try {
        // Verificar se está mudando para "Concluído"
        if (newStatus === "Concluído") {
          // Verificar se há arquivo de certidão
          if (
            certidaoFileInput &&
            certidaoFileInput.files &&
            certidaoFileInput.files.length > 0
          ) {
            // Fazer upload do arquivo
            const certidaoFile = certidaoFileInput.files[0];
            const certidaoData = await uploadCertidao(
              currentOccurrence,
              certidaoFile
            );

            // Atualizar status com certidão
            await firebase
              .database()
              .ref(`ocorrencias/${currentOccurrence}`)
              .update({
                status: newStatus,
                certidao: certidaoData,
                dataAtualizacao: Date.now(),
              });

            // Enviar e-mail com a certidão
            try {
              // Obter dados da ocorrência
              const ocorrencia = await carregarOcorrencia(currentOccurrence);

              await enviarEmailCertidao(
                ocorrencia.email,
                ocorrencia.nome,
                currentOccurrence,
                certidaoData.url
              );

              mostrarAlerta(
                "Status atualizado e e-mail enviado com sucesso!",
                "success"
              );
            } catch (emailError) {
              log(
                "Erro ao enviar e-mail, mas status foi atualizado",
                "error",
                emailError
              );
              mostrarAlerta(
                `Status atualizado, mas ocorreu um erro ao enviar o e-mail: ${emailError.message}`,
                "warning"
              );
            }
          } else {
            // Verificar se já existe uma certidão anexada
            const ocorrencia = await carregarOcorrencia(currentOccurrence);

            if (!ocorrencia.certidao || !ocorrencia.certidao.url) {
              mostrarAlerta(
                "Por favor, anexe a certidão antes de concluir a solicitação.",
                "error"
              );
              throw new Error("Certidão não anexada");
            } else {
              // Apenas atualizar o status
              await atualizarStatusOcorrencia(currentOccurrence, newStatus);

              // Enviar o e-mail automaticamente
              try {
                await enviarEmailCertidao(
                  ocorrencia.email,
                  ocorrencia.nome,
                  currentOccurrence,
                  ocorrencia.certidao.url
                );

                mostrarAlerta(
                  "Status atualizado e e-mail enviado com sucesso!",
                  "success"
                );
              } catch (emailError) {
                log(
                  "Erro ao enviar e-mail, mas status foi atualizado",
                  "error",
                  emailError
                );
                mostrarAlerta(
                  `Status atualizado, mas ocorreu um erro ao enviar o e-mail: ${emailError.message}`,
                  "warning"
                );
              }
            }
          }
        } else {
          // Para outros status, apenas atualizar
          await atualizarStatusOcorrencia(currentOccurrence, newStatus);
          mostrarAlerta("Status atualizado com sucesso!", "success");
        }

        // Fechar modal
        detailModal.style.display = "none";

        // Recarregar dados
        loadDashboardData();
      } catch (error) {
        log("Erro ao atualizar status:", "error", error);
        mostrarAlerta(`Erro ao atualizar status: ${error.message}`, "error");
      } finally {
        // Restaurar estado do botão
        updateStatusBtn.innerHTML = originalText;
        updateStatusBtn.disabled = false;
        isSubmitting = false;
      }
    });
  }

  // Botão de atualização de dados
  if (refreshButton) {
    refreshButton.addEventListener("click", function () {
      loadDashboardData();
    });
  }

  // Modal - Fechar
  const modalClose = document.querySelector(".modal-close");
  const closeBtn = document.querySelector(".close-btn");

  if (modalClose) {
    modalClose.addEventListener("click", function () {
      if (detailModal) detailModal.style.display = "none";
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      if (detailModal) detailModal.style.display = "none";
    });
  }

  // Fechar modal ao clicar fora
  window.addEventListener("click", function (event) {
    if (event.target === detailModal) {
      detailModal.style.display = "none";
    }
  });

  // Select de status - Mostrar/ocultar campo de upload
  if (statusSelect) {
    statusSelect.addEventListener("change", function () {
      const newStatus = this.value;
      const certidaoUploadContainer = document.getElementById(
        "certidao-upload-container"
      );

      if (certidaoUploadContainer) {
        // Se o novo status for "Concluído", mostrar o campo de upload
        if (newStatus === "Concluído") {
          certidaoUploadContainer.style.display = "block";

          // Verificar se já existe certidão
          if (currentOccurrence) {
            firebase
              .database()
              .ref(`ocorrencias/${currentOccurrence}/certidao`)
              .once("value")
              .then((snapshot) => {
                if (snapshot.exists()) {
                  const certidao = snapshot.val();
                  mostrarAlerta(
                    `Já existe uma certidão anexada (${certidao.nome}). Você pode manter a atual ou fazer upload de uma nova.`,
                    "info"
                  );
                }
              });
          }
        } else {
          // Se não for "Concluído", não é necessário mostrar o campo de upload
          certidaoUploadContainer.style.display = "none";
        }
      }
    });
  }

  // Visualizar arquivo de certidão antes do upload
  if (certidaoFileInput) {
    certidaoFileInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];

        // Validar arquivo
        const tiposPermitidos = [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
        ];
        if (!tiposPermitidos.includes(file.type)) {
          mostrarAlerta(
            "Tipo de arquivo não permitido. Por favor, use PDF, JPG ou PNG.",
            "error"
          );
          this.value = ""; // Limpar seleção
          return;
        }

        // Validar tamanho (máximo 10MB)
        const tamanhoMaximo = 10 * 1024 * 1024;
        if (file.size > tamanhoMaximo) {
          mostrarAlerta(
            `O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(
              2
            )}MB). O tamanho máximo permitido é 10MB.`,
            "error"
          );
          this.value = ""; // Limpar seleção
          return;
        }

        // Formatar tamanho
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // em MB

        // Mostrar informações do arquivo
        const fileInfoContainer = document.createElement("div");
        fileInfoContainer.className = "file-info";
        fileInfoContainer.innerHTML = `
        <div class="file-preview">
          <i class="fas fa-${
            file.type.includes("pdf") ? "file-pdf" : "file-image"
          } file-icon"></i>
          <div class="file-details">
            <p class="file-name">${file.name}</p>
            <p class="file-meta">${fileSize} MB • ${file.type
          .split("/")[1]
          .toUpperCase()}</p>
          </div>
        </div>
      `;

        // Remover informações anteriores se existirem
        const existingInfo = document.querySelector(".file-info");
        if (existingInfo) {
          existingInfo.remove();
        }

        // Adicionar as informações após o input
        this.parentNode.appendChild(fileInfoContainer);
      }
    });
  }

  // Notificações - Abrir/fechar painel
  if (notificationsBtn) {
    notificationsBtn.addEventListener("click", async function () {
      if (notificationsContainer) {
        // Alternar visibilidade
        if (notificationsContainer.style.display === "block") {
          notificationsContainer.style.display = "none";
        } else {
          notificationsContainer.style.display = "block";

          // Carregar notificações
          const notificacoes = await carregarNotificacoesNaoLidas();
          renderizarNotificacoes(notificacoes);
        }
      }
    });
  }

  // Fechar painel de notificações
  const closeNotifications = document.getElementById("close-notifications");
  if (closeNotifications) {
    closeNotifications.addEventListener("click", function () {
      if (notificationsContainer) {
        notificationsContainer.style.display = "none";
      }
    });
  }

  // Marcar todas notificações como lidas
  const markAllRead = document.getElementById("mark-all-read");
  if (markAllRead) {
    markAllRead.addEventListener("click", async function () {
      try {
        const notificacoes = await carregarNotificacoesNaoLidas();

        if (notificacoes.length === 0) return;

        // Mostrar loading
        this.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Processando...';
        this.disabled = true;

        // Marcar cada notificação como lida
        const promises = notificacoes.map((n) => marcarNotificacaoLida(n.id));
        await Promise.all(promises);

        // Atualizar UI
        atualizarIndicadorNotificacoes(0);
        if (notificationsContainer) {
          renderizarNotificacoes([]);
        }

        mostrarAlerta(
          "Todas as notificações foram marcadas como lidas",
          "success"
        );
      } catch (error) {
        mostrarAlerta("Erro ao marcar notificações como lidas", "error");
      } finally {
        // Restaurar botão
        if (markAllRead) {
          markAllRead.innerHTML = "Marcar tudo como lido";
          markAllRead.disabled = false;
        }
      }
    });
  }

  // Verificar estado de autenticação ao carregar a página
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // Usuário autenticado
      if (loginContainer) loginContainer.style.display = "none";
      if (adminDashboard) adminDashboard.style.display = "block";

      // Exibir e-mail do usuário
      if (userEmail) {
        userEmail.textContent = user.email;
      }

      // Carregar dados do dashboard
      loadDashboardData();
    } else {
      // Usuário não autenticado
      if (loginContainer) loginContainer.style.display = "block";
      if (adminDashboard) adminDashboard.style.display = "none";
    }
  });

  // Disponibilizar funções globalmente para serem acessadas pelo HTML
  window.enviarEmailManualmente = enviarEmailManualmente;
  window.viewOcorrenciaDetails = viewOcorrenciaDetails;

  // Verificar notificações periodicamente
  setInterval(() => {
    const user = firebase.auth().currentUser;
    if (user) {
      verificarNotificacoesNaoLidas();
    }
  }, 2 * 60 * 1000); // A cada 2 minutos

  // Log de inicialização
  log("Painel administrativo inicializado", "info");
});
