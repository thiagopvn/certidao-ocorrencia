/**
 * Sistema de Certidões de Ocorrência - Painel Administrativo
 * Versão: 2.0.0
 * Data de atualização: 02/04/2025
 *
 * Este arquivo contém todas as funções do painel administrativo,
 * incluindo autenticação, gerenciamento de ocorrências, uploads de documentos
 * e integração com o Firebase (Database, Storage, Auth e Functions).
 */
function log(mensagem, tipo = "log", dados = null) {
  const timestamp = new Date().toISOString();
  const prefixo = `[${timestamp}] ADMIN:`;

  try {
    if (dados) {
      if (tipo === "log") console.log(prefixo, mensagem, dados);
      else if (tipo === "error") console.error(prefixo, mensagem, dados);
      else if (tipo === "warn") console.warn(prefixo, mensagem, dados);
      else if (tipo === "info") console.info(prefixo, mensagem, dados);
      else console.log(prefixo, mensagem, dados);
    } else {
      if (tipo === "log") console.log(prefixo, mensagem);
      else if (tipo === "error") console.error(prefixo, mensagem);
      else if (tipo === "warn") console.warn(prefixo, mensagem);
      else if (tipo === "info") console.info(prefixo, mensagem);
      else console.log(prefixo, mensagem);
    }
  } catch (e) {
    console.log(prefixo, mensagem, dados);
  }
}

let ocorrenciasCache = null;
let ultimaAtualizacaoCache = 0;
const TEMPO_EXPIRACAO_CACHE = 5 * 60 * 1000; // 5 minutos

document.addEventListener("DOMContentLoaded", function () {
  // ===== ELEMENTOS DO DOM =====

  // Login elements
  const loginContainer = document.getElementById("login-container");
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginError = document.getElementById("login-error");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  // Dashboard elements
  const adminDashboard = document.getElementById("admin-dashboard");
  const userEmail = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");
  const navItems = document.querySelectorAll(".nav-item");

  // Stats elements
  const pendingCount = document.getElementById("pending-count");
  const analysisCount = document.getElementById("analysis-count");
  const completedCount = document.getElementById("completed-count");
  const canceledCount = document.getElementById("canceled-count");

  // Content tabs
  const tabContents = document.querySelectorAll(".tab-content");

  // Search and filter elements
  const adminSearch = document.getElementById("admin-search");
  const adminSearchBtn = document.getElementById("admin-search-btn");
  const dateFilter = document.getElementById("date-filter");

  // Modal elements
  const detailModal = document.getElementById("detail-modal");
  const modalCloseBtn = document.querySelector(".modal-content.close");
  const modalCloseButton = document.querySelector(".modal-content.close-btn");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const statusSelect = document.getElementById("status-select");
  const updateStatusBtn = document.getElementById("update-status-btn");
  const certidaoFileInput = document.getElementById("certidao-file");

  // Notifications
  const notificationsContainer = document.getElementById(
    "notifications-container"
  );
  const notificationsBody = document.getElementById("notifications-body");
  const closeNotifications = document.querySelector(".close-notifications");

  // Current occurrence being viewed
  let currentOccurrence = null;

  // Cache para dados

  // Estado da UI
  let isLoading = false;
  let isUploading = false;
  let filtroBusca = "";
  let filtroData = "all";

  // ===== FUNÇÕES DE UTILIDADE =====

  /**
   * Formata uma data para exibição
   * @param {number} timestamp - Timestamp em milissegundos
   * @param {boolean} incluirHora - Se deve incluir a hora
   * @returns {string} Data formatada no padrão brasileiro
   */
  function formatarData(timestamp, incluirHora = false) {
    if (!timestamp) return "N/A";

    const data = new Date(timestamp);

    if (incluirHora) {
      return data.toLocaleString("pt-BR");
    } else {
      return data.toLocaleDateString("pt-BR");
    }
  }

  /**
   * Formata um CPF para exibição
   * @param {string} cpf - CPF sem formatação
   * @returns {string} CPF formatado
   */
  function formatarCPF(cpf) {
    if (!cpf) return "";

    // Remove caracteres não numéricos
    cpf = cpf.replace(/\D/g, "");

    // Aplica a formatação
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Formata um número de telefone para exibição
   * @param {string} telefone - Telefone sem formatação
   * @returns {string} Telefone formatado
   */
  function formatarTelefone(telefone) {
    if (!telefone) return "";

    // Remove caracteres não numéricos
    telefone = telefone.replace(/\D/g, "");

    // Aplica a formatação de acordo com o comprimento
    if (telefone.length === 11) {
      return telefone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (telefone.length === 10) {
      return telefone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else {
      return telefone;
    }
  }

  /**
   * Trunca texto para exibição
   * @param {string} texto - Texto a ser truncado
   * @param {number} tamanho - Tamanho máximo
   * @returns {string} Texto truncado
   */
  function truncarTexto(texto, tamanho = 100) {
    if (!texto) return "";

    if (texto.length <= tamanho) {
      return texto;
    }

    return texto.substring(0, tamanho) + "...";
  }

  /**
   * Exibe uma mensagem de alerta personalizada
   * @param {string} mensagem - Mensagem a ser exibida
   * @param {string} tipo - Tipo de alerta (success, error, warning, info)
   */
  function mostrarAlerta(mensagem, tipo = "info") {
    // Verifica se já existe um alerta ativo
    const alertaExistente = document.querySelector(".alerta-personalizado");
    if (alertaExistente) {
      alertaExistente.remove();
    }

    // Cria o elemento de alerta
    const alerta = document.createElement("div");
    alerta.className = `alerta-personalizado ${tipo}`;
    alerta.innerHTML = `
      <span class="alerta-icone">
        ${
          tipo === "success"
            ? "✓"
            : tipo === "error"
            ? "✕"
            : tipo === "warning"
            ? "⚠"
            : "ℹ"
        }
      </span>
      <span class="alerta-mensagem">${mensagem}</span>
      <button class="alerta-fechar">×</button>
    `;

    // Adiciona o alerta ao DOM
    document.body.appendChild(alerta);

    // Configura o botão de fechar
    const botaoFechar = alerta.querySelector(".alerta-fechar");
    botaoFechar.addEventListener("click", () => {
      alerta.classList.add("saindo");
      setTimeout(() => {
        alerta.remove();
      }, 300);
    });

    // Remove o alerta após 5 segundos
    setTimeout(() => {
      if (document.body.contains(alerta)) {
        alerta.classList.add("saindo");
        setTimeout(() => {
          alerta.remove();
        }, 300);
      }
    }, 5000);
  }

  /**
   * Mostra um indicador de loading
   * @param {HTMLElement} container - Elemento que receberá o indicador
   * @param {string} mensagem - Mensagem a ser exibida
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
   * Mostra uma mensagem de erro
   * @param {HTMLElement} container - Elemento que receberá a mensagem
   * @param {string} mensagem - Mensagem a ser exibida
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
   * Mostra uma mensagem de dados vazios
   * @param {HTMLElement} container - Elemento que receberá a mensagem
   * @param {string} mensagem - Mensagem a ser exibida
   */
  function mostrarVazio(container, mensagem = "Nenhum dado encontrado.") {
    container.innerHTML = `
      <div class="no-data">
        <i class="fas fa-search"></i>
        <p>${mensagem}</p>
      </div>
    `;
  }

  /**
   * Verifica se um valor existe (não é null, undefined, NaN ou string vazia)
   * @param {*} valor - Valor a ser verificado
   * @returns {boolean} Se o valor existe
   */
  function valorExiste(valor) {
    return (
      valor !== null &&
      valor !== undefined &&
      valor !== "" &&
      !Number.isNaN(valor)
    );
  }

  /**
   * Registra um log no console com timestamp
   * @param {string} mensagem - Mensagem a ser logada
   * @param {string} tipo - Tipo de log (log, error, warn, info)
   * @param {*} dados - Dados adicionais para logar
   */

  // ===== FUNÇÕES DE AUTENTICAÇÃO =====

  /**
   * Tenta fazer login com Firebase Auth
   * @param {string} email - Email do usuário
   * @param {string} password - Senha do usuário
   * @returns {Promise} Promise resolvida com o usuário
   */
  async function fazerLogin(email, password) {
    try {
      // Validar entradas
      if (!email || !password) {
        throw new Error("Por favor, preencha todos os campos.");
      }

      // Mostrar estado de loading
      loginButton.textContent = "Entrando...";
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

      // Traduzir mensagens de erro
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
      loginButton.textContent = "Entrar";
      loginButton.disabled = false;
    }
  }

  /**
   * Verifica se um usuário tem perfil de administrador
   * @param {string} uid - ID do usuário
   * @returns {Promise<boolean>} Promise resolvida com boolean
   */
  async function verificarPerfilAdmin(uid) {
    try {
      // Verificar nas configurações de usuário
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
   * @returns {Promise} Promise resolvida após logout
   */
  async function fazerLogout() {
    try {
      log("Iniciando logout");
      await firebase.auth().signOut();
      log("Logout realizado com sucesso");

      // Limpar dados do formulário de login
      emailInput.value = "";
      passwordInput.value = "";

      // Limpar cache
      ocorrenciasCache = null;

      return true;
    } catch (error) {
      log(`Erro ao fazer logout: ${error.message}`, "error", error);
      mostrarAlerta(`Erro ao fazer logout: ${error.message}`, "error");
      throw new Error("Erro ao fazer logout. Tente novamente.");
    }
    // Removi o bloco finally que estava relacionado a exportação de certidões
  }

  /**
   * Validar arquivo de certidão antes do upload
   * @param {File} file - Arquivo a ser validado
   * @returns {boolean} Se o arquivo é válido
   */
  function validarArquivoCertidao(file) {
    if (!file) return false;

    // Verificar tipo de arquivo
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
      return false;
    }

    // Verificar tamanho (máximo 10MB)
    const tamanhoMaximo = 10 * 1024 * 1024; // 10MB em bytes
    if (file.size > tamanhoMaximo) {
      mostrarAlerta(
        `O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(
          2
        )}MB). O tamanho máximo permitido é 10MB.`,
        "error"
      );
      return false;
    }

    return true;
  }

  // ===== FUNÇÕES DE GERENCIAMENTO DE NOTIFICAÇÕES =====

  /**
   * Carrega notificações não lidas
   * @returns {Promise<Array>} Promise resolvida com array de notificações
   */
  async function carregarNotificacoesNaoLidas() {
    try {
      // Obter usuário atual
      const user = firebase.auth().currentUser;
      if (!user) return [];

      // Referência para notificações
      const notificacoesRef = firebase.database().ref("notificacoes");

      // Obter todas as notificações não lidas para este usuário
      const snapshot = await notificacoesRef
        .orderByChild("lida")
        .equalTo(false)
        .once("value");

      if (!snapshot.exists()) {
        return [];
      }

      const notificacoes = [];

      snapshot.forEach((childSnapshot) => {
        const notificacao = childSnapshot.val();

        // Verificar se a notificação é para todos ou para este usuário específico
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
   * @param {string} notificacaoId - ID da notificação
   * @returns {Promise} Promise resolvida após atualização
   */
  async function marcarNotificacaoLida(notificacaoId) {
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se o módulo de functions está disponível
      if (firebase.functions) {
        // Usar Cloud Function para marcar como lida
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
   * Atualiza o indicador de notificações na interface
   * @param {number} count - Quantidade de notificações não lidas
   */
  function atualizarIndicadorNotificacoes(count) {
    // Implementar a atualização do indicador visual de notificações
    const notificationIcon = document.querySelector(".notification-icon");
    const notificationBadge = document.querySelector(".notification-badge");

    if (notificationIcon && notificationBadge) {
      if (count > 0) {
        notificationBadge.textContent = count > 99 ? "99+" : count;
        notificationBadge.style.display = "flex";
      } else {
        notificationBadge.style.display = "none";
      }
    }
  }

  /**
   * Renderiza as notificações na interface
   * @param {Array} notificacoes - Array de notificações
   */
  function renderizarNotificacoes(notificacoes) {
    if (!notificationsBody) return;

    // Limpar o conteúdo atual
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

      if (notificacao.tipo === "atualizacao_status") {
        conteudo = `
          <strong>${notificacao.nomeCliente}</strong> teve o status da ocorrência 
          <strong>${notificacao.occurrenceId}</strong> alterado de 
          <strong>${notificacao.statusAnterior}</strong> para 
          <strong>${notificacao.novoStatus}</strong>.
        `;
      } else {
        conteudo = notificacao.mensagem || "Nova notificação recebida.";
      }

      notificacaoElement.innerHTML = `
        <div class="notification-content">${conteudo}</div>
        <div class="notification-date">${dataNotificacao}</div>
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
            verificarNotificacoesLidas();
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
  async function verificarNotificacoesLidas() {
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

  // ===== FUNÇÕES DE INTERFACE DE USUÁRIO =====

  /**
   * Atualiza as estatísticas do dashboard
   * @param {Array} ocorrencias - Array de ocorrências
   */
  function atualizarEstatisticas(ocorrencias) {
    const stats = {
      pendentes: 0,
      analise: 0,
      concluidas: 0,
      canceladas: 0,
    };

    ocorrencias.forEach((ocorrencia) => {
      if (ocorrencia.status === "Pendente") {
        stats.pendentes++;
      } else if (ocorrencia.status === "Em Análise") {
        stats.analise++;
      } else if (ocorrencia.status === "Concluído") {
        stats.concluidas++;
      } else if (ocorrencia.status === "Cancelado") {
        stats.canceladas++;
      }
    });

    // Atualizar contadores na UI
    if (pendingCount) pendingCount.textContent = stats.pendentes;
    if (analysisCount) analysisCount.textContent = stats.analise;
    if (completedCount) completedCount.textContent = stats.concluidas;
    if (canceledCount) canceledCount.textContent = stats.canceladas;

    return stats;
  }

  /**
   * Carrega dados para uma aba específica
   * @param {string} tabName - Nome da aba
   * @param {Array} cachedData - Dados em cache (opcional)
   */
  async function carregarDadosAba(tabName, cachedData = null) {
    // Mapear nomes de abas para IDs de containers
    const containerIds = {
      pending: "pending-ocorrencias",
      "in-analysis": "analysis-ocorrencias",
      completed: "completed-ocorrencias",
      canceled: "canceled-ocorrencias",
      all: "all-ocorrencias",
    };

    const containerId = containerIds[tabName];
    const container = document.getElementById(containerId);

    if (!container) return;

    // Mostrar loading
    mostrarLoading(container, "Carregando ocorrências...");

    try {
      // Usar dados em cache ou carregar do Firebase
      const ocorrencias = cachedData || (await carregarOcorrencias());

      // Aplicar filtros
      let ocorrenciasFiltradas = filtrarOcorrenciasPorAba(ocorrencias, tabName);
      ocorrenciasFiltradas = aplicarFiltroData(
        ocorrenciasFiltradas,
        dateFilter.value
      );
      ocorrenciasFiltradas = aplicarFiltroBusca(
        ocorrenciasFiltradas,
        adminSearch.value.trim().toLowerCase()
      );

      // Ordenar por timestamp (mais recentes primeiro)
      ocorrenciasFiltradas.sort((a, b) => b.timestamp - a.timestamp);

      // Renderizar ocorrências
      renderizarOcorrencias(containerId, ocorrenciasFiltradas);
    } catch (error) {
      log(
        `Erro ao carregar dados da aba ${tabName}: ${error.message}`,
        "error",
        error
      );
      mostrarErro(container, `Erro ao carregar dados: ${error.message}`);
    }
  }

  /**
   * Filtra ocorrências por aba
   * @param {Array} ocorrencias - Lista de ocorrências
   * @param {string} tabName - Nome da aba
   * @returns {Array} Ocorrências filtradas
   */
  function filtrarOcorrenciasPorAba(ocorrencias, tabName) {
    if (tabName === "pending") {
      return ocorrencias.filter((o) => o.status === "Pendente");
    } else if (tabName === "in-analysis") {
      return ocorrencias.filter((o) => o.status === "Em Análise");
    } else if (tabName === "completed") {
      return ocorrencias.filter((o) => o.status === "Concluído");
    } else if (tabName === "canceled") {
      return ocorrencias.filter((o) => o.status === "Cancelado");
    } else {
      return ocorrencias;
    }
  }

  /**
   * Aplica filtro de data às ocorrências
   * @param {Array} ocorrencias - Lista de ocorrências
   * @param {string} filtro - Tipo de filtro (all, today, week, month)
   * @returns {Array} Ocorrências filtradas
   */
  function aplicarFiltroData(ocorrencias, filtro) {
    if (filtro === "all") {
      return ocorrencias;
    }

    const agora = new Date();
    const hoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate()
    ).getTime();

    if (filtro === "today") {
      return ocorrencias.filter((o) => o.timestamp >= hoje);
    } else if (filtro === "week") {
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() - agora.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      return ocorrencias.filter((o) => o.timestamp >= inicioSemana.getTime());
    } else if (filtro === "month") {
      const inicioMes = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1
      ).getTime();
      return ocorrencias.filter((o) => o.timestamp >= inicioMes);
    }

    return ocorrencias;
  }

  /**
   * Aplica filtro de busca às ocorrências
   * @param {Array} ocorrencias - Lista de ocorrências
   * @param {string} termo - Termo de busca
   * @returns {Array} Ocorrências filtradas
   */
  function aplicarFiltroBusca(ocorrencias, termo) {
    if (!termo) {
      return ocorrencias;
    }

    return ocorrencias.filter(
      (o) =>
        o.occurrenceNumber.toLowerCase().includes(termo) ||
        o.nome.toLowerCase().includes(termo) ||
        o.cpf.includes(termo)
    );
  }

  /**
   * Renderiza as ocorrências em um container
   * @param {string} containerId - ID do container
   * @param {Array} ocorrencias - Lista de ocorrências
   */
  function renderizarOcorrencias(containerId, ocorrencias) {
    const container = document.getElementById(containerId);

    if (!container) return;

    // Limpar o container
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
   * Cria um card para uma ocorrência
   * @param {Object} ocorrencia - Dados da ocorrência
   * @returns {HTMLElement} Elemento HTML do card
   */
  function criarCardOcorrencia(ocorrencia) {
    const card = document.createElement("div");
    card.className = `admin-card status-${ocorrencia.status
      .replace(" ", "-")
      .toLowerCase()}`;
    card.setAttribute("data-id", ocorrencia.occurrenceNumber);

    const dataOcorrencia = formatarData(ocorrencia.timestamp, true);

    card.innerHTML = `
      <div class="card-status-indicator"></div>
      <div class="card-header">
        <div class="ocorrencia-number">${ocorrencia.occurrenceNumber}</div>
        <div class="ocorrencia-status ${ocorrencia.status
          .replace(" ", "-")
          .toLowerCase()}">${ocorrencia.status}</div>
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
              ? `
          <div class="info-row certidao-row">
            <i class="fas fa-file-pdf"></i>
            <span class="info-label">Certidão:</span>
            <a href="${ocorrencia.certidao.url}" target="_blank" class="visualizar-link">
              Visualizar <i class="fas fa-external-link-alt"></i>
            </a>
          </div>
          `
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

    // Adicionar evento de clique ao botão de detalhes
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
   * @param {string} occurrenceNumber - Número da ocorrência
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
            <div class="section-title">Certidão Anexada</div>
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
              }" target="_blank" class="download-btn">Visualizar/Baixar Certidão</a></p>
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
          ? '<span class="status-badge concluído">Enviado com sucesso</span>'
          : '<span class="status-badge cancelado">Falha no envio</span>';

        const dataEnvio = formatarData(ocorrencia.emailEnviado.timestamp, true);

        // Botão de reenvio, só aparece se a certidão estiver anexada
        const reenvioBtn =
          ocorrencia.certidao && ocorrencia.certidao.url
            ? `<button onclick="window.enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn">Reenviar E-mail</button>`
            : "";

        emailSection = `
          <div class="modal-section">
            <div class="section-title">Status do E-mail</div>
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
            <div class="section-title">Status do E-mail</div>
            <div class="email-info">
              <p>Nenhum e-mail foi enviado ainda.</p>
              <button onclick="window.enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn">Enviar E-mail</button>
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
          <div class="section-header">
            <h3>Status Atual:</h3>
            <span class="status-badge ${ocorrencia.status
              .replace(" ", "-")
              .toLowerCase()}">${ocorrencia.status}</span>
          </div>
          <p>Solicitação criada em: ${dataTimestamp}</p>
          ${
            ocorrencia.dataAtualizacao
              ? `<p>Última atualização: ${formatarData(
                  ocorrencia.dataAtualizacao,
                  true
                )}</p>`
              : ""
          }
        </div>
        
        ${certidaoSection}
        ${emailSection}
        
        <div class="modal-section">
          <div class="section-title">Informações do Solicitante</div>
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
              <p>${formatarTelefone(ocorrencia.telefone)}</p>
            </div>
          </div>
        </div>
        
        <div class="modal-section">
          <div class="section-title">Detalhes da Ocorrência</div>
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
          <div class="section-title">Documentos Anexados</div>
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
   * @param {Object} documentos - Objeto contendo os documentos
   * @returns {string} HTML formatado
   */
  function getDocumentosHTML(documentos) {
    if (!documentos) return "<p>Nenhum documento anexado.</p>";

    let html = '<div class="documentos-lista">';

    if (documentos.documentoIdentidade) {
      html += `
        <div class="documento-item">
          <label>Documento de Identidade:</label>
          <p><a href="${documentos.documentoIdentidade.url}" target="_blank">${documentos.documentoIdentidade.nome}</a></p>
        </div>
      `;
    }

    if (documentos.comprovanteResidencia) {
      html += `
        <div class="documento-item">
          <label>Comprovante de Residência:</label>
          <p><a href="${documentos.comprovanteResidencia.url}" target="_blank">${documentos.comprovanteResidencia.nome}</a></p>
        </div>
      `;
    }

    if (documentos.documentoCarro) {
      html += `
        <div class="documento-item">
          <label>Documento do Carro:</label>
          <p><a href="${documentos.documentoCarro.url}" target="_blank">${documentos.documentoCarro.nome}</a></p>
        </div>
      `;
    }

    if (documentos.outrosDocumentos && documentos.outrosDocumentos.length > 0) {
      html += `
        <div class="documento-item">
          <label>Outros Documentos:</label>
          <ul class="other-docs-list">
      `;

      documentos.outrosDocumentos.forEach((doc) => {
        html += `<li><a href="${doc.url}" target="_blank">${doc.nome}</a></li>`;
      });

      html += `
          </ul>
        </div>
      `;
    }

    html += "</div>";

    return html;
  }

  /**
   * Carrega todos os dados do dashboard
   */
  async function loadDashboardData() {
    try {
      isLoading = true;

      // Carregar ocorrências do Firebase
      const ocorrencias = await carregarOcorrencias(true);

      // Atualizar estatísticas
      atualizarEstatisticas(ocorrencias);

      // Carregar dados para a aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"), ocorrencias);
      }

      // Verificar notificações
      verificarNotificacoesLidas();

      return ocorrencias;
    } catch (error) {
      log(
        `Erro ao carregar dados do dashboard: ${error.message}`,
        "error",
        error
      );
      mostrarAlerta(
        `Erro ao carregar dados. Por favor, recarregue a página. (${error.message})`,
        "error"
      );
    } finally {
      isLoading = false;
    }
  }

  // ===== EVENT LISTENERS =====

  // Tratamento de login
  if (loginButton) {
    loginButton.addEventListener("click", async function () {
      try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validar entradas
        if (!email || !password) {
          loginError.textContent = "Por favor, preencha todos os campos.";
          return;
        }

        // Tentar login
        const user = await fazerLogin(email, password);

        // Atualizar UI após login bem-sucedido
        loginContainer.style.display = "none";
        adminDashboard.style.display = "block";

        // Exibir e-mail do usuário
        if (userEmail) {
          userEmail.textContent = user.email;
        }

        // Carregar dados do dashboard
        loadDashboardData();
      } catch (error) {
        // Exibir erro
        loginError.textContent = error.message;
      }
    });

    // Permitir login com Enter
    passwordInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        loginButton.click();
      }
    });
  }

  // Tratamento de logout
  if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
      try {
        await fazerLogout();

        // Atualizar UI após logout
        adminDashboard.style.display = "none";
        loginContainer.style.display = "block";
      } catch (error) {
        mostrarAlerta(error.message, "error");
      }
    });
  }

  // Navegação entre abas
  navItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remover classe active de todos os itens
      navItems.forEach((nav) => nav.classList.remove("active"));

      // Adicionar classe active ao item clicado
      this.classList.add("active");

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
  if (adminSearchBtn) {
    adminSearchBtn.addEventListener("click", function () {
      filtroBusca = adminSearch.value.trim().toLowerCase();

      // Obter aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"));
      }
    });

    // Permitir busca com Enter
    adminSearch.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        adminSearchBtn.click();
      }
    });
  }

  // Filtro de data
  if (dateFilter) {
    dateFilter.addEventListener("change", function () {
      filtroData = this.value;

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

      // Obter novo status
      const newStatus = statusSelect.value;

      // Mostrar estado de carregamento
      updateStatusBtn.textContent = "Atualizando...";
      updateStatusBtn.disabled = true;

      try {
        // Se o status for alterado para "Concluído", verificar se há um arquivo de certidão
        if (newStatus === "Concluído") {
          const certidaoFileInput = document.getElementById("certidao-file");

          if (
            !certidaoFileInput ||
            !certidaoFileInput.files ||
            certidaoFileInput.files.length === 0
          ) {
            // Verificar se já existe uma certidão anexada
            const ocorrencia = await carregarOcorrencia(currentOccurrence);

            if (!ocorrencia.certidao || !ocorrencia.certidao.url) {
              mostrarAlerta(
                "Por favor, anexe a certidão antes de concluir a solicitação.",
                "error"
              );
              throw new Error("Certidão não anexada");
            }
          } else {
            // Fazer upload da certidão
            const certidaoFile = certidaoFileInput.files[0];

            // Validar arquivo
            if (!validarArquivoCertidao(certidaoFile)) {
              throw new Error("Arquivo inválido");
            }

            log("Iniciando upload de certidão", "info", {
              nome: certidaoFile.name,
              tamanho: certidaoFile.size,
              tipo: certidaoFile.type,
            });

            const certidaoData = await uploadCertidao(
              currentOccurrence,
              certidaoFile
            );

            // Verificar resultado do upload
            if (!certidaoData || !certidaoData.url) {
              throw new Error("Falha ao fazer upload da certidão");
            }

            // Atualizar o status e incluir os dados da certidão
            await firebase
              .database()
              .ref(`ocorrencias/${currentOccurrence}`)
              .update({
                status: newStatus,
                certidao: certidaoData,
                dataAtualizacao: Date.now(),
              });

            // Obter dados do solicitante para enviar e-mail
            const ocorrencia = await carregarOcorrencia(currentOccurrence);

            // Enviar e-mail com a certidão
            try {
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
          }
        } else {
          // Se não for "Concluído", apenas atualizar o status
          await atualizarStatusOcorrencia(currentOccurrence, newStatus);
          mostrarAlerta("Status atualizado com sucesso!", "success");
        }

        // Fechar modal
        detailModal.style.display = "none";

        // Recarregar dados do dashboard
        loadDashboardData();
      } catch (error) {
        log("Erro ao atualizar status:", "error", error);
        mostrarAlerta(`Erro ao atualizar status: ${error.message}`, "error");
      } finally {
        // Restaurar estado do botão
        updateStatusBtn.textContent = "Atualizar";
        updateStatusBtn.disabled = false;
      }
    });
  }

  // Modal de detalhes - Fechar

  if (modalCloseButton && detailModal) {
    modalCloseButton.addEventListener("click", function () {
      detailModal.style.display = "none";
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", function () {
      detailModal.style.display = "none";
    });
  }

  if (modalCloseButton) {
    modalCloseButton.addEventListener("click", function () {
      detailModal.style.display = "none";
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
        if (!validarArquivoCertidao(file)) {
          // Limpar seleção
          this.value = "";

          // Remover informações de arquivo se existirem
          const existingInfo = document.querySelector(".file-info");
          if (existingInfo) {
            existingInfo.remove();
          }

          return;
        }

        // Formatar tamanho
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // em MB

        // Mostrar informações do arquivo
        const fileInfoContainer = document.createElement("div");
        fileInfoContainer.className = "file-info";
        fileInfoContainer.innerHTML = `
          <p><strong>Arquivo selecionado:</strong> ${file.name}</p>
          <p><strong>Tamanho:</strong> ${fileSize} MB</p>
          <p><strong>Tipo:</strong> ${file.type}</p>
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
  const notificationIcon = document.querySelector(".notification-icon");
  if (notificationIcon) {
    notificationIcon.addEventListener("click", async function () {
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
  if (closeNotifications) {
    closeNotifications.addEventListener("click", function () {
      if (notificationsContainer) {
        notificationsContainer.style.display = "none";
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

  // Exportação de certidões - Disponibilizar globalmente
  window.exportarCertidoesConcluidas = exportarCertidoesConcluidas;

  // Envio manual de e-mail - Disponibilizar globalmente
  window.enviarEmailManualmente = enviarEmailManualmente;

  // Verificar notificações periodicamente
  setInterval(() => {
    const user = firebase.auth().currentUser;
    if (user) {
      verificarNotificacoesLidas();
    }
  }, 2 * 60 * 1000); // A cada 2 minutos

  // Log de inicialização
  console.log("Painel administrativo inicializado", "info");
});

// ===== FUNÇÕES DE GERENCIAMENTO DE DADOS =====

/**
 * Carrega dados das ocorrências do Firebase
 * @param {boolean} forcarAtualizacao - Se deve ignorar o cache
 * @returns {Promise<Array>} Promise resolvida com array de ocorrências
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
    const snapshot = await firebase.database().ref("ocorrencias").once("value");

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
    throw new Error("Erro ao carregar dados. Por favor, recarregue a página.");
  }
}

/**
 * Carrega dados de uma ocorrência específica
 * @param {string} occurrenceNumber - Número da ocorrência
 * @returns {Promise<Object>} Promise resolvida com dados da ocorrência
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
 * @param {string} occurrenceNumber - Número da ocorrência
 * @param {string} newStatus - Novo status
 * @returns {Promise} Promise resolvida após atualização
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
 * Função melhorada para upload de certidão
 * @param {string} occurrenceNumber - Número da ocorrência
 * @param {File} certidaoFile - Arquivo de certidão
 * @returns {Promise<Object>} Promise resolvida com dados do arquivo
 */
async function uploadCertidao(occurrenceNumber, certidaoFile) {
  try {
    // Exibir feedback visual do processo de upload
    isUploading = true;
    const updateStatusBtn = document.getElementById("update-status-btn");
    if (updateStatusBtn) {
      updateStatusBtn.textContent = "Enviando arquivo...";
      updateStatusBtn.disabled = true;
    }

    log(
      `Iniciando upload para ocorrência ${occurrenceNumber}: ${certidaoFile.name}`
    );

    // Garantir que o Firebase Storage esteja disponível
    if (!firebase.storage) {
      throw new Error("Firebase Storage não está disponível");
    }

    // Referência para o storage no Firebase com tratamento de espaços e caracteres especiais
    const filename =
      new Date().getTime() + "_" + certidaoFile.name.replace(/[^\w.-]/g, "_");
    const storagePath = `ocorrencias/${occurrenceNumber}/certidao/${filename}`;
    const storageRef = firebase.storage().ref(storagePath);

    log(`Referência de armazenamento criada: ${storagePath}`);

    // Criar um elemento para mostrar o progresso do upload
    const progressContainer = document.createElement("div");
    progressContainer.className = "upload-progress-container";
    progressContainer.innerHTML = `
        <div class="upload-progress-label">Enviando arquivo: <span>0%</span></div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" style="width: 0%"></div>
        </div>
      `;

    // Adicionar ao DOM na seção de upload
    const uploadContainer = document.getElementById(
      "certidao-upload-container"
    );
    if (uploadContainer) {
      // Remover barra de progresso anterior se existir
      const existingProgress = uploadContainer.querySelector(
        ".upload-progress-container"
      );
      if (existingProgress) {
        existingProgress.remove();
      }

      uploadContainer.appendChild(progressContainer);
    }

    // Upload do arquivo com monitoramento de progresso
    const uploadTask = storageRef.put(certidaoFile);

    // Monitorar progresso do upload
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        const progressPercent = Math.round(progress);
        log(`Progresso do upload: ${progressPercent}%`);

        // Atualizar a UI com o progresso
        const progressFill = progressContainer.querySelector(
          ".upload-progress-fill"
        );
        const progressLabel = progressContainer.querySelector(
          ".upload-progress-label span"
        );

        if (progressFill && progressLabel) {
          progressFill.style.width = `${progressPercent}%`;
          progressLabel.textContent = `${progressPercent}%`;
        }
      },
      (error) => {
        log("Erro durante o upload:", "error", error);
        throw error;
      }
    );

    // Aguardar a conclusão do upload
    await uploadTask;
    log("Upload concluído com sucesso");

    // Atualizar a UI após o upload completo
    if (progressContainer) {
      progressContainer.innerHTML = `
          <div class="upload-complete">
            <i class="fas fa-check-circle"></i>
            Upload completo: ${certidaoFile.name}
          </div>
        `;
    }

    // Obter a URL de download
    const downloadURL = await storageRef.getDownloadURL();
    log("URL de download obtida:", "info", downloadURL);

    // Retornar os dados do arquivo
    return {
      nome: certidaoFile.name,
      url: downloadURL,
      dataUpload: Date.now(),
      tamanho: certidaoFile.size,
      tipo: certidaoFile.type,
    };
  } catch (error) {
    log("Erro detalhado ao fazer upload da certidão:", "error", error);

    // Mostrar erro na UI
    const uploadContainer = document.getElementById(
      "certidao-upload-container"
    );
    if (uploadContainer) {
      const progressContainer = uploadContainer.querySelector(
        ".upload-progress-container"
      );
      if (progressContainer) {
        progressContainer.innerHTML = `
            <div class="upload-error">
              <i class="fas fa-exclamation-circle"></i>
              Erro no upload: ${error.message || "Falha ao enviar arquivo"}
            </div>
          `;
      }
    }

    // Mostrar alerta com detalhes do erro
    let mensagemErro = "Erro ao fazer upload da certidão. ";
    if (error.code) {
      // Erros específicos do Firebase
      switch (error.code) {
        case "storage/unauthorized":
          mensagemErro += "Sem permissão para acessar o Storage.";
          break;
        case "storage/canceled":
          mensagemErro += "Upload cancelado.";
          break;
        case "storage/unknown":
          mensagemErro += "Erro desconhecido no Storage.";
          break;
        default:
          mensagemErro +=
            error.message || "Verifique o console para mais detalhes.";
      }
    } else {
      mensagemErro +=
        error.message || "Verifique o console para mais detalhes.";
    }

    mostrarAlerta(mensagemErro, "error");
    throw error;
  } finally {
    isUploading = false;
  }
}

/**
 * Envia e-mail com certidão usando Firebase Functions
 * @param {string} email - Email do destinatário
 * @param {string} nome - Nome do destinatário
 * @param {string} occurrenceNumber - Número da ocorrência
 * @param {string} certidaoURL - URL da certidão
 * @returns {Promise} Promise resolvida após envio
 */
async function enviarEmailCertidao(email, nome, occurrenceNumber, certidaoURL) {
  try {
    log(
      `Enviando e-mail para ${email} referente à ocorrência ${occurrenceNumber}`
    );

    // Verificar se o módulo de functions está disponível
    if (!firebase.functions) {
      throw new Error("Firebase Functions não está disponível");
    }

    // Chamar a função do Firebase Functions
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
 * @param {string} occurrenceNumber - Número da ocorrência
 * @returns {Promise} Promise resolvida após envio
 */
async function enviarEmailManualmente(occurrenceNumber) {
  try {
    // Mostrar feedback de carregamento
    const sendEmailBtn = document.querySelector(".send-email-btn");
    if (sendEmailBtn) {
      sendEmailBtn.textContent = "Enviando...";
      sendEmailBtn.disabled = true;
    }

    // Obter os dados da ocorrência
    const ocorrencia = await carregarOcorrencia(occurrenceNumber);

    if (!ocorrencia || !ocorrencia.certidao || !ocorrencia.certidao.url) {
      throw new Error(
        "Não é possível enviar o e-mail porque não há certidão anexada."
      );
    }

    // Chamar a função do Firebase Functions para enviar o e-mail
    const resultado = await enviarEmailCertidao(
      ocorrencia.email,
      ocorrencia.nome,
      occurrenceNumber,
      ocorrencia.certidao.url
    );

    // Atualizar a interface
    mostrarAlerta(
      `E-mail enviado com sucesso para ${ocorrencia.email}`,
      "success"
    );

    // Recarregar os detalhes para atualizar a seção de e-mail
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
      sendEmailBtn.textContent = "Reenviar E-mail";
      sendEmailBtn.disabled = false;
    }
  }
}

/**
 * Exporta certidões concluídas para CSV
 * @returns {Promise} Promise resolvida após exportação
 */
async function exportarCertidoesConcluidas() {
  try {
    log("Iniciando exportação de certidões concluídas");

    // Mostrar feedback de carregamento
    const actionBtn = document.querySelector(".action-btn");
    if (actionBtn) {
      actionBtn.textContent = "Exportando...";
      actionBtn.disabled = true;
    }

    // Obter todas as ocorrências concluídas com certidão
    const snapshot = await firebase
      .database()
      .ref("ocorrencias")
      .orderByChild("status")
      .equalTo("Concluído")
      .once("value");

    if (!snapshot.exists()) {
      throw new Error("Não há certidões concluídas para exportar.");
    }

    const certidoesConcluidas = [];

    snapshot.forEach((childSnapshot) => {
      const ocorrencia = childSnapshot.val();

      if (ocorrencia.certidao && ocorrencia.certidao.url) {
        certidoesConcluidas.push({
          numero: ocorrencia.occurrenceNumber,
          solicitante: ocorrencia.nome,
          cpf: ocorrencia.cpf,
          dataOcorrencia: formatarData(ocorrencia.dataOcorrencia),
          dataConclusao: ocorrencia.dataAtualizacao
            ? formatarData(ocorrencia.dataAtualizacao)
            : "N/A",
          urlCertidao: ocorrencia.certidao.url,
        });
      }
    });

    if (certidoesConcluidas.length === 0) {
      throw new Error(
        "Não há certidões concluídas com arquivos anexados para exportar."
      );
    }

    log(`${certidoesConcluidas.length} certidões serão exportadas`);

    // Criar CSV
    let csvContent =
      "Número;Solicitante;CPF;Data da Ocorrência;Data de Conclusão;URL da Certidão\n";

    certidoesConcluidas.forEach((certidao) => {
      // Usar ponto-e-vírgula como separador para melhor compatibilidade com Excel brasileiro
      csvContent += `${certidao.numero};${certidao.solicitante};${certidao.cpf};${certidao.dataOcorrencia};${certidao.dataConclusao};${certidao.urlCertidao}\n`;
    });

    // Criar blob e link de download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `certidoes_concluidas_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    log("Exportação concluída com sucesso");
    mostrarAlerta(
      `${certidoesConcluidas.length} certidões exportadas com sucesso!`,
      "success"
    );

    return true;
  } catch (error) {
    log(`Erro ao exportar certidões: ${error.message}`, "error", error);
    mostrarAlerta(`Erro ao exportar certidões: ${error.message}`, "error");
    throw error;
  } finally {
    // Restaurar o botão
    const actionBtn = document.querySelector(".action-btn");
    if (actionBtn) {
      actionBtn.textContent = "Exportar Certidões";
      actionBtn.disabled = false;
    }
  }
}
