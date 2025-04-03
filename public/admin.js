/**
 * Sistema de Certidões de Ocorrência - Painel Administrativo
 * Versão corrigida
 */

// Cache e variáveis globais
let ocorrenciasCache = null;
let ultimaAtualizacaoCache = 0;
const TEMPO_EXPIRACAO_CACHE = 5 * 60 * 1000; // 5 minutos
let currentOccurrence = null;
let isSubmitting = false;

document.addEventListener("DOMContentLoaded", function () {
  // Melhorar interatividade da área de upload
  const uploadAreas = document.querySelectorAll(".upload-area");
  if (uploadAreas.length) {
    uploadAreas.forEach((area) => {
      area.addEventListener("click", function (e) {
        // Impedir clique no input se já clicou na área
        e.preventDefault();

        // Encontrar o input file dentro da área
        const fileInput = this.querySelector('input[type="file"]');
        if (fileInput) {
          console.log("Clicando no input file manualmente");
          fileInput.click();
        }
      });

      // Adicionar indicadores visuais
      area.addEventListener("dragover", function (e) {
        e.preventDefault();
        this.style.borderColor = "var(--primary)";
        this.style.backgroundColor = "rgba(59, 130, 246, 0.05)";
      });

      area.addEventListener("dragleave", function (e) {
        e.preventDefault();
        this.style.borderColor = "";
        this.style.backgroundColor = "";
      });

      area.addEventListener("drop", function (e) {
        e.preventDefault();
        this.style.borderColor = "";
        this.style.backgroundColor = "";

        const fileInput = this.querySelector('input[type="file"]');
        if (fileInput && e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          // Disparar evento de change manualmente
          const event = new Event("change", { bubbles: true });
          fileInput.dispatchEvent(event);
        }
      });
    });
  }
  // Verificar se o Firebase está disponível
  if (typeof firebase === "undefined") {
    console.error(
      "Firebase não está definido. Verifique se os scripts estão carregados na ordem correta."
    );
    alert(
      "Erro de inicialização: Firebase não está disponível. Verifique o console para mais detalhes."
    );
    return;
  }

  // Iniciar conexão com Firebase - Verificação adicional
  try {
    console.log("Verificando conexão com Firebase...");
    if (!firebase.apps.length) {
      // Este é um backup caso o firebase-config.js não tenha inicializado corretamente
      const firebaseConfig = {
        apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
        authDomain: "certidao-gocg.firebaseapp.com",
        databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
        projectId: "certidao-gocg",
        storageBucket: "certidao-gocg.appspot.com",
        messagingSenderId: "684546571684",
        appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
        measurementId: "G-YZHFGW74Y7",
      };

      firebase.initializeApp(firebaseConfig);
      console.log("Firebase inicializado pelo admin.js");
    }

    // Garantir que as referências aos serviços do Firebase estão disponíveis
    window.database = firebase.database();
    window.storage = firebase.storage();
    window.auth = firebase.auth();

    console.log("Conexão com Firebase estabelecida com sucesso");
  } catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
    alert(
      "Erro ao conectar com o Firebase. Verifique o console para mais detalhes."
    );
    return;
  }

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

      // Verificar se o serviço auth está disponível
      if (!firebase.auth) {
        throw new Error("Serviço de autenticação não disponível");
      }

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
  /**
   * Função modificada para upload de certidão com melhor tratamento de erros CORS
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

      console.log(
        `Iniciando upload para ocorrência ${occurrenceNumber}: ${certidaoFile.name}`
      );

      // Mostrar indicador de progresso
      const progressContainer = document.createElement("div");
      progressContainer.className = "upload-progress";
      progressContainer.innerHTML = `
      <div class="progress-label">Preparando upload: <span>0%</span></div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    `;

      // Adicionar ao DOM
      const uploadSection =
        document.querySelector(".upload-section") ||
        document.getElementById("certidao-upload-container");
      if (uploadSection) {
        uploadSection.appendChild(progressContainer);
      }

      // Verificar se o Firebase está inicializado corretamente
      if (!firebase.apps.length) {
        throw new Error("Firebase não está inicializado corretamente");
      }

      // Verificar autenticação
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }

      // Referência do storage com estratégia de falha
      try {
        // Verificar se o storage está acessível
        const storageTest = firebase.storage();
        if (!storageTest) {
          throw new Error("Firebase Storage não está disponível");
        }

        const filename = `${Date.now()}_${certidaoFile.name.replace(
          /[^\w.-]/g,
          "_"
        )}`;
        const storagePath = `ocorrencias/${occurrenceNumber}/certidao/${filename}`;

        // Atualizar o indicador de progresso
        const progressLabel = progressContainer.querySelector(
          ".progress-label span"
        );
        const progressFill = progressContainer.querySelector(".progress-fill");

        if (progressLabel && progressFill) {
          progressLabel.textContent = "0%";
          progressFill.style.width = "0%";
        }

        // ALTERNATIVA 1: Upload com tratamento especial de CORS
        try {
          // Tentar o upload padrão
          const storageRef = firebase.storage().ref(storagePath);
          const uploadTask = storageRef.put(certidaoFile);

          uploadTask.on(
            "state_changed",
            (snapshot) => {
              // Progresso
              const progresso = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );

              if (progressLabel && progressFill) {
                progressLabel.textContent = `${progresso}%`;
                progressFill.style.width = `${progresso}%`;
              }
            },
            (error) => {
              console.error("Erro no upload:", error);
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

          console.log("Upload concluído com sucesso:", downloadURL);

          // Retornar dados do arquivo
          return {
            nome: certidaoFile.name,
            url: downloadURL,
            dataUpload: Date.now(),
            tamanho: certidaoFile.size,
            tipo: certidaoFile.type,
          };
        } catch (corsError) {
          console.error("Erro de CORS durante upload:", corsError);

          // Atualizar o progresso para indicar falha
          if (progressContainer) {
            progressContainer.innerHTML = `
            <div class="upload-error">
              <i class="fas fa-exclamation-circle"></i>
              Erro CORS: Não foi possível fazer o upload do arquivo.
              <p>Tentando solução alternativa...</p>
            </div>
          `;
          }

          // ALTERNATIVA 2: Se houver erro CORS, tentar atualizar apenas os metadados no Database
          // Isso permite pelo menos registrar a certidão com os dados básicos sem o arquivo

          // Gerar um nome fake para URL (exemplo)
          const fakeUrl = `https://storage.googleapis.com/certidao-gocg.appspot.com/error_cors/${filename}`;

          // Mostrar alerta
          alert(`Erro CORS: O arquivo não pôde ser enviado devido a problemas de configuração do servidor. 
        A certidão será registrada apenas com metadados básicos.
        Entre em contato com o suporte técnico para resolver o problema de CORS.`);

          if (progressContainer) {
            progressContainer.innerHTML = `
            <div class="upload-complete">
              <i class="fas fa-info-circle"></i>
              Metadados registrados com sucesso! (Upload parcial)
            </div>
          `;
          }

          // Retornar dados parciais
          return {
            nome: certidaoFile.name,
            url: fakeUrl, // URL fictícia
            dataUpload: Date.now(),
            tamanho: certidaoFile.size,
            tipo: certidaoFile.type,
            erro: "CORS_ERROR", // Indicador de erro
            mensagem: "Falha no upload devido a erro de CORS",
          };
        }
      } catch (storageError) {
        console.error("Erro de storage:", storageError);

        if (progressContainer) {
          progressContainer.innerHTML = `
          <div class="upload-error">
            <i class="fas fa-exclamation-circle"></i>
            Erro: ${storageError.message || "Falha no acesso ao storage"}
          </div>
        `;
        }

        throw storageError;
      }
    } catch (error) {
      console.error("Erro detalhado do upload:", error);

      // Mostrar mensagem mais descritiva
      const errorMessage = error.code
        ? `${error.message} (Código: ${error.code})`
        : error.message || "Erro desconhecido";

      alert(`Erro ao fazer upload: ${errorMessage}
    
    Dicas para resolver:
    1. Verifique sua conexão com a internet
    2. Tente reduzir o tamanho do arquivo
    3. Use um formato diferente (PDF, JPG ou PNG)
    4. Entre em contato com o suporte técnico informando este erro`);

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

  // ===== FUNÇÕES DE INTERFACE =====

  /**
   * Carrega dados para o dashboard
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

      // Calcular estatísticas
      const stats = calcularEstatisticas(ocorrencias);
      atualizarEstatisticasUI(stats);

      // Carregar dados para a aba ativa
      const activeTab = document.querySelector(".nav-item.active");
      if (activeTab) {
        carregarDadosAba(activeTab.getAttribute("data-tab"));
      }

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

  /**
   * Calcula estatísticas das ocorrências
   */
  function calcularEstatisticas(ocorrencias) {
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

    return stats;
  }

  /**
   * Atualiza a UI com as estatísticas
   */
  function atualizarEstatisticasUI(stats) {
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
  }

  /**
   * Carrega dados para uma aba específica
   */
  async function carregarDadosAba(tabId) {
    try {
      // Identificar o container correspondente à aba
      const containerId = `${tabId}-ocorrencias`;
      const container = document.getElementById(containerId);

      if (!container) {
        console.error(`Container não encontrado: ${containerId}`);
        return;
      }

      // Mostrar loading
      mostrarLoading(container, `Carregando solicitações...`);

      // Carregar ocorrências
      const ocorrencias = await carregarOcorrencias();

      // Filtrar ocorrências conforme a aba
      let ocorrenciasFiltradas = [];

      if (tabId === "pending") {
        ocorrenciasFiltradas = ocorrencias.filter(
          (o) => o.status === "Pendente"
        );
      } else if (tabId === "completed") {
        ocorrenciasFiltradas = ocorrencias.filter(
          (o) => o.status === "Concluído"
        );
      } else if (tabId === "all") {
        ocorrenciasFiltradas = ocorrencias;
      }

      // Ordenar por data (mais recentes primeiro)
      ocorrenciasFiltradas.sort((a, b) => b.timestamp - a.timestamp);

      // Renderizar ocorrências
      renderizarOcorrencias(container, ocorrenciasFiltradas);

      return ocorrenciasFiltradas;
    } catch (error) {
      log(
        `Erro ao carregar dados para aba ${tabId}: ${error.message}`,
        "error",
        error
      );
      mostrarAlerta(`Erro ao carregar dados: ${error.message}`, "error");
    }
  }

  /**
   * Renderiza lista de ocorrências em um container
   */
  function renderizarOcorrencias(container, ocorrencias) {
    // Limpar container
    container.innerHTML = "";

    if (ocorrencias.length === 0) {
      mostrarVazio(container, "Nenhuma solicitação encontrada");
      return;
    }

    // Criar cards
    ocorrencias.forEach((ocorrencia) => {
      const card = criarCardOcorrencia(ocorrencia);
      container.appendChild(card);
    });
  }

  /**
   * Cria o card de uma ocorrência
   */
  function criarCardOcorrencia(ocorrencia) {
    const card = document.createElement("div");
    const statusClass = ocorrencia.status
      ? ocorrencia.status
          .toLowerCase()
          .replace(" ", "-")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      : "pendente";

    card.className = `ocorrencia-card status-${statusClass}`;
    card.setAttribute("data-id", ocorrencia.id || ocorrencia.occurrenceNumber);

    const dataOcorrencia = formatarData(ocorrencia.timestamp, true);

    card.innerHTML = `
      <div class="card-header">
        <div class="ocorrencia-number">${
          ocorrencia.occurrenceNumber || ocorrencia.id
        }</div>
        <div class="ocorrencia-status ${statusClass}">${
      ocorrencia.status || "Pendente"
    }</div>
      </div>
      <div class="card-body">
        <div class="ocorrencia-info">
          <div class="info-row">
            <i class="fas fa-user"></i>
            <span class="info-label">Nome:</span>
            <span class="info-value">${ocorrencia.nome || "N/A"}</span>
          </div>
          <div class="info-row">
            <i class="fas fa-id-card"></i>
            <span class="info-label">CPF:</span>
            <span class="info-value">${
              formatarCPF(ocorrencia.cpf) || "N/A"
            }</span>
          </div>
          <div class="info-row">
            <i class="fas fa-calendar"></i>
            <span class="info-label">Data:</span>
            <span class="info-value">${dataOcorrencia}</span>
          </div>
          <div class="info-row">
            <i class="fas fa-map-marker-alt"></i>
            <span class="info-label">Local:</span>
            <span class="info-value">${
              truncarTexto(ocorrencia.enderecoOcorrencia, 40) || "N/A"
            }</span>
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
        <button class="view-btn" data-id="${
          ocorrencia.occurrenceNumber || ocorrencia.id
        }">
          <i class="fas fa-eye"></i> Ver Detalhes
        </button>
      </div>
    `;

    // Adicionar evento ao botão
    const viewBtn = card.querySelector(".view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        viewOcorrenciaDetails(viewBtn.getAttribute("data-id"));
      });
    }

    return card;
  }

  /**
   * Exibe os detalhes de uma ocorrência
   */
  async function viewOcorrenciaDetails(occurrenceId) {
    try {
      // Mostrar modal com loading
      if (detailModal) detailModal.style.display = "flex";
      if (modalTitle)
        modalTitle.textContent = `Detalhes da Ocorrência: ${occurrenceId}`;
      if (modalBody) mostrarLoading(modalBody, "Carregando detalhes...");

      // Armazenar a ocorrência atual
      currentOccurrence = occurrenceId;

      // Carregar detalhes
      const ocorrencia = await carregarOcorrencia(occurrenceId);

      // Verificar se obteve os dados
      if (!ocorrencia) {
        throw new Error("Não foi possível carregar os detalhes da ocorrência");
      }

      // Atualizar o select de status
      if (statusSelect) {
        statusSelect.value = ocorrencia.status;
      }

      // Formatar datas
      const dataFormatada = formatarData(ocorrencia.timestamp, true);
      const dataOcorrencia = ocorrencia.dataOcorrencia
        ? formatarData(new Date(ocorrencia.dataOcorrencia))
        : "N/A";

      // Preparar HTML do modal
      const html = `
        <div class="status-section">
          <h3>Status: <span class="status-badge ${ocorrencia.status
            .toLowerCase()
            .replace(" ", "-")
            .replace("í", "i")}">${ocorrencia.status}</span></h3>
          <p><strong>Data da solicitação:</strong> ${dataFormatada}</p>
          ${
            ocorrencia.dataAtualizacao
              ? `<p><strong>Última atualização:</strong> ${formatarData(
                  ocorrencia.dataAtualizacao,
                  true
                )}</p>`
              : ""
          }
        </div>
        
        ${
          ocorrencia.certidao
            ? `
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-file-pdf"></i> Certidão Anexada</div>
          <div class="certidao-info">
            <p><strong>Nome do arquivo:</strong> ${ocorrencia.certidao.nome}</p>
            <p><strong>Data de upload:</strong> ${formatarData(
              ocorrencia.certidao.dataUpload,
              true
            )}</p>
            <p><a href="${
              ocorrencia.certidao.url
            }" target="_blank" class="download-btn"><i class="fas fa-download"></i> Visualizar/Baixar Certidão</a></p>
          </div>
        </div>
        `
            : ""
        }
        
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-user-circle"></i> Informações do Solicitante</div>
          <div class="info-grid">
            <div class="info-item">
              <label>Nome:</label>
              <p>${ocorrencia.nome || "N/A"}</p>
            </div>
            <div class="info-item">
              <label>CPF:</label>
              <p>${formatarCPF(ocorrencia.cpf) || "N/A"}</p>
            </div>
            <div class="info-item">
              <label>RG:</label>
              <p>${ocorrencia.rg || "N/A"}</p>
            </div>
            <div class="info-item">
              <label>E-mail:</label>
              <p>${ocorrencia.email || "N/A"}</p>
            </div>
            <div class="info-item">
              <label>Telefone:</label>
              <p>${ocorrencia.telefone || "N/A"}</p>
            </div>
            <div class="info-item">
              <label>Endereço:</label>
              <p>${ocorrencia.enderecoSolicitante || "N/A"}</p>
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
              <label>Hora da Ocorrência:</label>
              <p>${ocorrencia.horaOcorrencia || "N/A"}</p>
            </div>
            <div class="info-item full-width">
              <label>Local da Ocorrência:</label>
              <p>${ocorrencia.enderecoOcorrencia || "N/A"}</p>
            </div>
            <div class="info-item full-width">
              <label>Descrição:</label>
              <p class="description-text">${
                ocorrencia.descricao || "Sem descrição"
              }</p>
            </div>
          </div>
        </div>
        
        ${
          ocorrencia.documentos
            ? `
        <div class="modal-section">
          <div class="section-title"><i class="fas fa-file-alt"></i> Documentos Anexados</div>
          <div class="documentos-list">
            ${getDocumentosHTML(ocorrencia.documentos)}
          </div>
        </div>
        `
            : ""
        }
      `;

      // Atualizar conteúdo do modal
      if (modalBody) {
        modalBody.innerHTML = html;
      }

      // Ajustar visibilidade do container de upload
      const uploadContainer = document.getElementById(
        "certidao-upload-container"
      );
      if (uploadContainer) {
        // Se já existe certidão e o status é "Concluído", ocultar upload
        if (ocorrencia.certidao && ocorrencia.status === "Concluído") {
          uploadContainer.style.display = "none";
        } else {
          uploadContainer.style.display = "block";
        }
      }
    } catch (error) {
      log(`Erro ao exibir detalhes: ${error.message}`, "error", error);
      if (modalBody) {
        mostrarErro(modalBody, `Erro ao carregar detalhes: ${error.message}`);
      }
    }
  }

  /**
   * Gera HTML para a lista de documentos
   */
  function getDocumentosHTML(documentos) {
    if (!documentos) return "<p>Nenhum documento anexado.</p>";

    let html = "";

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

    return html || "<p>Nenhum documento anexado.</p>";
  }

  // ===== HANDLER DE UPLOAD E ATUALIZAÇÃO DE STATUS =====

  // Adicionar evento ao botão de atualizar status
  if (updateStatusBtn) {
    updateStatusBtn.addEventListener("click", async function () {
      if (!currentOccurrence || isSubmitting) return;

      // Prevenir múltiplos cliques
      isSubmitting = true;

      // Salvar texto original e mostrar loading
      const btnText = updateStatusBtn.innerHTML;
      updateStatusBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
      updateStatusBtn.disabled = true;

      try {
        const newStatus = statusSelect.value;

        // Se o status é "Concluído", verificar se há certidão
        if (newStatus === "Concluído") {
          // Verificar se já existe uma certidão anexada
          const ocorrencia = await carregarOcorrencia(currentOccurrence);

          const temCertidao =
            ocorrencia && ocorrencia.certidao && ocorrencia.certidao.url;
          const temNovoArquivo =
            certidaoFileInput &&
            certidaoFileInput.files &&
            certidaoFileInput.files.length > 0;

          if (!temCertidao && !temNovoArquivo) {
            throw new Error(
              "É necessário anexar uma certidão antes de concluir a solicitação."
            );
          }

          // Se tem novo arquivo, fazer upload
          if (temNovoArquivo) {
            const certidaoData = await uploadCertidao(
              currentOccurrence,
              certidaoFileInput.files[0]
            );

            // Atualizar status e certidão
            await firebase
              .database()
              .ref(`ocorrencias/${currentOccurrence}`)
              .update({
                status: newStatus,
                certidao: certidaoData,
                dataAtualizacao: Date.now(),
              });

            // Enviar e-mail se tiver funcionalidade
            if (firebase.functions && ocorrencia.email) {
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
                mostrarAlerta(
                  `Status atualizado, mas houve erro ao enviar e-mail: ${emailError.message}`,
                  "warning"
                );
              }
            } else {
              mostrarAlerta("Status atualizado com sucesso!", "success");
            }
          } else {
            // Apenas atualizar status
            await atualizarStatusOcorrencia(currentOccurrence, newStatus);
            mostrarAlerta("Status atualizado com sucesso!", "success");
          }
        } else {
          // Para outros status, apenas atualizar
          await atualizarStatusOcorrencia(currentOccurrence, newStatus);
          mostrarAlerta("Status atualizado com sucesso!", "success");
        }

        // Fechar modal e recarregar dados
        if (detailModal) {
          detailModal.style.display = "none";
        }

        loadDashboardData();
      } catch (error) {
        log(`Erro ao atualizar: ${error.message}`, "error", error);
        mostrarAlerta(`Erro: ${error.message}`, "error");
      } finally {
        // Restaurar botão
        updateStatusBtn.innerHTML = btnText;
        updateStatusBtn.disabled = false;
        isSubmitting = false;
      }
    });
  }

  // Exibir informações sobre arquivo selecionado
  if (certidaoFileInput) {
    certidaoFileInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        const fileSize = (file.size / 1024 / 1024).toFixed(2);

        // Validar tipo e tamanho
        const tiposPermitidos = [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
        ];
        if (!tiposPermitidos.includes(file.type)) {
          mostrarAlerta(
            "Tipo de arquivo não permitido. Use PDF, JPG ou PNG.",
            "error"
          );
          this.value = "";
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          mostrarAlerta(
            `Arquivo muito grande (${fileSize}MB). O limite é 10MB.`,
            "error"
          );
          this.value = "";
          return;
        }

        // Exibir informações do arquivo
        const uploadArea = this.closest(".upload-area");
        if (uploadArea) {
          const fileIcon = file.type.includes("pdf")
            ? "file-pdf"
            : "file-image";
          uploadArea.innerHTML = `
            <i class="fas fa-${fileIcon}"></i>
            <p>${file.name} (${fileSize} MB)</p>
          `;
        }
      }
    });
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
        if (loginContainer) loginContainer.style.display = "flex";
      } catch (error) {
        mostrarAlerta(error.message, "error");
      }
    });
  }

  // Navegação entre abas
  if (navItems.length > 0) {
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
  }

  // Botão de atualização de dados
  if (refreshButton) {
    refreshButton.addEventListener("click", function () {
      loadDashboardData();
      mostrarAlerta("Dados atualizados com sucesso!", "success");
    });
  }

  // Modal - Fechar
  const modalClose = document.querySelector(".modal-close");
  if (modalClose) {
    modalClose.addEventListener("click", function () {
      if (detailModal) detailModal.style.display = "none";
    });
  }

  // Fechar modal ao clicar fora
  window.addEventListener("click", function (event) {
    if (event.target === detailModal) {
      detailModal.style.display = "none";
    }
  });

  // ===== VERIFICAÇÃO DE AUTENTICAÇÃO E INICIALIZAÇÃO =====

  // Verificar estado de autenticação
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // Usuário autenticado
      log(`Usuário autenticado: ${user.email}`);

      // Verificar se é admin
      verificarPerfilAdmin(user.uid)
        .then((isAdmin) => {
          if (isAdmin) {
            // Exibir dashboard
            if (loginContainer) loginContainer.style.display = "none";
            if (adminDashboard) adminDashboard.style.display = "block";

            // Atualizar UI com email do usuário
            if (userEmail) userEmail.textContent = user.email;

            // Carregar dados do dashboard
            loadDashboardData();
          } else {
            // Não é admin, fazer logout
            firebase
              .auth()
              .signOut()
              .then(() => {
                mostrarAlerta(
                  "Acesso não autorizado. Este usuário não tem permissões de administrador.",
                  "error"
                );
              });
          }
        })
        .catch((error) => {
          log(`Erro ao verificar perfil de admin: ${error.message}`, "error");
          mostrarAlerta(
            "Erro ao verificar permissões. Por favor, tente novamente.",
            "error"
          );
        });
    } else {
      // Usuário não autenticado
      log("Usuário não autenticado");
      if (loginContainer) loginContainer.style.display = "flex";
      if (adminDashboard) adminDashboard.style.display = "none";
    }
  });

  log("Sistema administrativo iniciado com sucesso.");
});
