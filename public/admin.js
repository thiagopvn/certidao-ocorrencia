/**
 * Sistema de Certidões de Ocorrência - Painel Administrativo
 * Versão corrigida com suporte a upload direto
 */

// Cache e variáveis globais
let ocorrenciasCache = null;
let ultimaAtualizacaoCache = 0;
const TEMPO_EXPIRACAO_CACHE = 5 * 60 * 1000; // 5 minutos
let currentOccurrence = null;
let isSubmitting = false;
let isUploadingAdditionalDoc = false; // Nova flag para controlar upload de documentos adicionais

document.addEventListener("DOMContentLoaded", function () {
  // Melhorar interatividade da área de upload
  const uploadAreas = document.querySelectorAll(".upload-area");
  if (uploadAreas.length) {
    uploadAreas.forEach((area) => {
      area.addEventListener("click", function (e) {
        // Encontrar o input file dentro da área
        const fileInput = this.querySelector('input[type="file"]');
        if (fileInput && e.target !== fileInput) {
          log("Clicando no input file manualmente");
          fileInput.click();
        }
      });

      // Adicionar indicadores visuais
      area.addEventListener("dragover", function (e) {
        e.preventDefault();
        this.style.borderColor = "var(--primary)";
        this.style.backgroundColor = "rgba(59, 130, 246, 0.05)";
        this.classList.add("drag-over");
      });

      area.addEventListener("dragleave", function (e) {
        e.preventDefault();
        this.style.borderColor = "";
        this.style.backgroundColor = "";
        this.classList.remove("drag-over");
      });

      area.addEventListener("drop", function (e) {
        e.preventDefault();
        log("Arquivo solto na área de upload");
        this.style.borderColor = "";
        this.style.backgroundColor = "";
        this.classList.remove("drag-over");

        const fileInput = this.querySelector('input[type="file"]');
        if (fileInput && e.dataTransfer.files.length) {
          // Atribuir os arquivos ao input
          fileInput.files = e.dataTransfer.files;
          log(`Arquivo atribuído ao input: ${e.dataTransfer.files[0].name}`);
          
          // Disparar evento de change manualmente
          const event = new Event("change", { bubbles: true });
          fileInput.dispatchEvent(event);
          log("Evento change disparado");
        }
      });
    });
  }

  // Verificar se o Firebase está disponível
  try {
    log("Verificando conexão com Firebase...");
    if (!firebase.apps.length) {
      // Este é um backup caso o firebase-config.js não tenha inicializado corretamente
      const firebaseConfig = {
        apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
        authDomain: "certidao-gocg.firebaseapp.com",
        databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
        projectId: "certidao-gocg",
        storageBucket: "certidao-gocg.firebasestorage.app",
        messagingSenderId: "684546571684",
        appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
        measurementId: "G-YZHFGW74Y7",
      };

      firebase.initializeApp(firebaseConfig);
      log("Firebase inicializado pelo admin.js");
    }

    // Garantir que as referências aos serviços do Firebase estão disponíveis
    window.database = firebase.database();
    window.storage = firebase.storage();
    window.auth = firebase.auth();
    window.functions = firebase.functions(); // IMPORTANTE: Adicionado explicitamente aqui!

    log("Conexão com Firebase estabelecida com sucesso");
  } catch (error) {
    log("Erro ao inicializar Firebase:", "error", error);
    mostrarAlerta(
      "Erro ao conectar com o Firebase. Verifique o console para mais detalhes.",
      "error"
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
    
    // Corrigido: Usar apenas tipos de console válidos
    const tipoValido = ["log", "error", "warn", "info"].includes(tipo) ? tipo : "log";
    
    if (dados) {
      console[tipoValido](prefixo, mensagem, dados);
    } else {
      console[tipoValido](prefixo, mensagem);
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
   * Atualiza o status e anexa certidão a uma ocorrência - VERSÃO CORRIGIDA
   */
  async function atualizarStatusComCertidao(occurrenceNumber, novoStatus, certidaoFile = null) {
    try {
      log(`Atualizando ocorrência ${occurrenceNumber} para ${novoStatus}, arquivo: ${certidaoFile ? certidaoFile.name : "nenhum"}`);
      
      // Garantir que a database ref está disponível
      if (!firebase.database) {
        log("Firebase Database não está disponível", "error");
        throw new Error("Serviço de Database não está disponível");
      }
      
      if (novoStatus === "Concluído" && certidaoFile) {
        // Fazer upload da certidão
        log("Status concluído com arquivo: iniciando upload...");
        const certidaoData = await uploadCertidaoComFallback(occurrenceNumber, certidaoFile);
        log("Upload bem-sucedido, dados da certidão:", "log", certidaoData);
        
        // Atualizar registro com certidão e status
        await firebase.database().ref(`ocorrencias/${occurrenceNumber}`).update({
          status: novoStatus,
          certidao: certidaoData,
          dataAtualizacao: Date.now(),
        });
        
        // Tenta enviar e-mail de notificação, se possível
        try {
          if (typeof firebase.functions === "function") {
            // Buscar dados da ocorrência para enviar e-mail
            const snapshot = await firebase.database().ref(`ocorrencias/${occurrenceNumber}`).once("value");
            const ocorrenciaData = snapshot.val();
            
            if (ocorrenciaData && ocorrenciaData.email) {
              const enviarEmailFunction = firebase.functions().httpsCallable("enviarEmailCertidaoV2");
              
              // Preparar dados para o e-mail
              const emailData = {
                destinatario: ocorrenciaData.email,
                nome: ocorrenciaData.nome || "Cliente",
                numeroOcorrencia: occurrenceNumber,
                certidaoURL: certidaoData.url
              };
              
              log("Tentando enviar e-mail de notificação...");
              const result = await enviarEmailFunction(emailData);
              log("Resultado do envio de e-mail:", "log", result);
            }
          }
        } catch (emailError) {
          // Apenas log o erro, não interrompe o fluxo principal
          log("Erro ao enviar e-mail de confirmação:", "error", emailError);
        }
        
        return {
          success: true,
          message: "Status atualizado e certidão anexada com sucesso!",
          certidao: certidaoData
        };
      } else {
        // Apenas atualizar status
        log("Atualizando apenas o status para: " + novoStatus);
        await firebase.database().ref(`ocorrencias/${occurrenceNumber}`).update({
          status: novoStatus,
          dataAtualizacao: Date.now(),
        });
        
        return {
          success: true,
          message: "Status atualizado com sucesso!"
        };
      }
    } catch (error) {
      log(`Erro ao atualizar: ${error.message}`, "error", error);
      throw error;
    }
  }

  /**
   * Estratégia de upload com fallback direto para o Storage - VERSÃO CORRIGIDA
   */
  async function uploadCertidaoComFallback(occurrenceNumber, certidaoFile) {
    try {
      // Validar arquivo
      if (!certidaoFile) {
        throw new Error("Nenhum arquivo selecionado");
      }

      log(`Iniciando upload de arquivo: ${certidaoFile.name}, tamanho: ${certidaoFile.size} bytes`);

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

      log(`Tentando upload direto para o Storage: ${occurrenceNumber}`);
      
      // Mostrar progresso
      const progressContainer = document.createElement("div");
      progressContainer.className = "upload-progress";
      progressContainer.innerHTML = `
        <div class="progress-label">Preparando upload: <span>0%</span></div>
        <div class="progress-bar"><div class="progress-fill"></div></div>
      `;

      const uploadSection = document.getElementById("file-info-container");
      if (uploadSection) {
        // Limpar conteúdo anterior se existir
        uploadSection.innerHTML = '';
        uploadSection.appendChild(progressContainer);
      }

      // Verificar se o Firebase Storage está disponível
      if (!firebase.storage) {
        log("Firebase Storage não está disponível", "error");
        throw new Error("Serviço de Storage não está disponível");
      }

      // Configurar storage com referência correta
      const storageRef = firebase.storage().ref();
      const filename = `${Date.now()}_${certidaoFile.name.replace(/[^\w.-]/g, "_")}`;
      const fileRef = storageRef.child(`ocorrencias/${occurrenceNumber}/certidao/${filename}`);

      // Criar metadados customizados
      const metadata = {
        contentType: certidaoFile.type,
        customMetadata: {
          occurrenceNumber: occurrenceNumber,
          uploadDate: new Date().toISOString(),
          uploadedBy: firebase.auth().currentUser?.email || "anonymous",
        },
      };

      // Upload com controle de progresso
      const uploadTask = fileRef.put(certidaoFile, metadata);

      // Monitoramento de progresso e completude
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          // Progresso
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            log(`Upload progresso: ${progress}%`);

            // Atualizar UI com progresso
            const progressLabel = progressContainer.querySelector(
              ".progress-label span"
            );
            const progressFill =
              progressContainer.querySelector(".progress-fill");

            if (progressLabel && progressFill) {
              progressLabel.textContent = `${progress}%`;
              progressFill.style.width = `${progress}%`;
            }
          },
          // Erro
          (error) => {
            log("Erro no upload direto:", "error", error);

            if (progressContainer) {
              progressContainer.innerHTML = `
                <div class="upload-error">
                  <i class="fas fa-exclamation-circle"></i>
                  Erro: ${error.message || "Falha no upload"}
                </div>
              `;
            }

            reject(error);
          },
          // Sucesso
          async () => {
            try {
              // Obter URL de download
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              log("Upload concluído, URL obtida: " + downloadURL);

              if (progressContainer) {
                progressContainer.innerHTML = `
                  <div class="upload-complete">
                    <i class="fas fa-check-circle"></i>
                    Upload completo!
                  </div>
                `;
              }

              const certidaoData = {
                nome: certidaoFile.name,
                url: downloadURL,
                dataUpload: Date.now(),
                tamanho: certidaoFile.size,
                tipo: certidaoFile.type,
                path: fileRef.fullPath,
              };

              log("Upload concluído com sucesso!");
              resolve(certidaoData);
            } catch (error) {
              log("Erro ao obter URL:", "error", error);

              if (progressContainer) {
                progressContainer.innerHTML = `
                  <div class="upload-error">
                    <i class="fas fa-exclamation-circle"></i>
                    Erro: ${error.message || "Falha ao finalizar upload"}
                  </div>
                `;
              }

              reject(error);
            }
          }
        );
      });
    } catch (error) {
      log(`Erro no upload: ${error.message}`, "error", error);
      throw error;
    }
  }

  // ===== FUNÇÕES PARA UPLOAD DE DOCUMENTOS ADICIONAIS =====

  /**
   * Faz upload de um documento adicional
   */
  async function uploadAdditionalDocument(occurrenceNumber, documentFile, documentType) {
    try {
      // Validar arquivo
      if (!documentFile) {
        throw new Error("Nenhum arquivo selecionado");
      }

      log(`Iniciando upload de documento adicional: ${documentFile.name}, tipo: ${documentType}`);

      // Validar tipo de arquivo
      const tiposPermitidos = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      
      if (!tiposPermitidos.includes(documentFile.type)) {
        throw new Error("Tipo de arquivo não permitido. Use PDF, JPG, PNG, DOC ou DOCX.");
      }

      // Validar tamanho (máximo 10MB)
      const tamanhoMaximo = 10 * 1024 * 1024;
      if (documentFile.size > tamanhoMaximo) {
        throw new Error(
          `Arquivo muito grande (${(documentFile.size / 1024 / 1024).toFixed(2)}MB). O limite é 10MB.`
        );
      }

      // Mostrar progresso
      const progressContainer = document.createElement("div");
      progressContainer.className = "upload-progress";
      progressContainer.innerHTML = `
        <div class="progress-label">Preparando upload: <span>0%</span></div>
        <div class="progress-bar"><div class="progress-fill"></div></div>
      `;

      const uploadSection = document.getElementById("additional-docs-progress");
      if (uploadSection) {
        // Limpar conteúdo anterior se existir
        uploadSection.innerHTML = '';
        uploadSection.appendChild(progressContainer);
      }

      // Verificar se o Firebase Storage está disponível
      if (!firebase.storage) {
        log("Firebase Storage não está disponível", "error");
        throw new Error("Serviço de Storage não está disponível");
      }

      // Configurar storage com referência correta
      const storageRef = firebase.storage().ref();
      const filename = `${Date.now()}_${documentFile.name.replace(/[^\w.-]/g, "_")}`;
      const fileRef = storageRef.child(`ocorrencias/${occurrenceNumber}/documentos_adicionais/${documentType}/${filename}`);

      // Criar metadados customizados
      const metadata = {
        contentType: documentFile.type,
        customMetadata: {
          occurrenceNumber: occurrenceNumber,
          uploadDate: new Date().toISOString(),
          uploadedBy: firebase.auth().currentUser?.email || "admin",
          documentType: documentType
        },
      };

      // Upload com controle de progresso
      const uploadTask = fileRef.put(documentFile, metadata);

      // Monitoramento de progresso e completude
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          // Progresso
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            log(`Upload progresso: ${progress}%`);

            // Atualizar UI com progresso
            const progressLabel = progressContainer.querySelector(
              ".progress-label span"
            );
            const progressFill =
              progressContainer.querySelector(".progress-fill");

            if (progressLabel && progressFill) {
              progressLabel.textContent = `${progress}%`;
              progressFill.style.width = `${progress}%`;
            }
          },
          // Erro
          (error) => {
            log("Erro no upload do documento adicional:", "error", error);

            if (progressContainer) {
              progressContainer.innerHTML = `
                <div class="upload-error">
                  <i class="fas fa-exclamation-circle"></i>
                  Erro: ${error.message || "Falha no upload"}
                </div>
              `;
            }

            reject(error);
          },
          // Sucesso
          async () => {
            try {
              // Obter URL de download
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              log("Upload concluído, URL obtida: " + downloadURL);

              if (progressContainer) {
                progressContainer.innerHTML = `
                  <div class="upload-complete">
                    <i class="fas fa-check-circle"></i>
                    Upload completo!
                  </div>
                `;
              }

              const documentData = {
                nome: documentFile.name,
                url: downloadURL,
                dataUpload: Date.now(),
                tamanho: documentFile.size,
                tipo: documentFile.type,
                path: fileRef.fullPath,
                tipoDocumento: documentType,
                uploadedBy: firebase.auth().currentUser?.email || "admin"
              };

              log("Upload de documento adicional concluído com sucesso!");
              resolve(documentData);
            } catch (error) {
              log("Erro ao obter URL:", "error", error);

              if (progressContainer) {
                progressContainer.innerHTML = `
                  <div class="upload-error">
                    <i class="fas fa-exclamation-circle"></i>
                    Erro: ${error.message || "Falha ao finalizar upload"}
                  </div>
                `;
              }

              reject(error);
            }
          }
        );
      });
    } catch (error) {
      log(`Erro no upload: ${error.message}`, "error", error);
      throw error;
    }
  }

  /**
   * Salva um documento adicional no banco de dados
   */
  async function saveAdditionalDocument(occurrenceNumber, documentData) {
    try {
      log(`Salvando documento adicional no banco de dados para ${occurrenceNumber}`);
      
      // Referência para o nó de documentos adicionais desta ocorrência
      const dbRef = firebase.database().ref(`ocorrencias/${occurrenceNumber}/documentos_adicionais`);
      
      // Gerar uma chave única para o documento
      const newDocRef = dbRef.push();
      
      // Salvar os dados do documento
      await newDocRef.set({
        ...documentData,
        id: newDocRef.key,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      
      log("Documento adicional salvo com sucesso no banco de dados");
      
      // Atualizar o campo de data de atualização da ocorrência
      await firebase.database().ref(`ocorrencias/${occurrenceNumber}`).update({
        dataAtualizacao: Date.now()
      });
      
      return {
        success: true,
        documentId: newDocRef.key,
        message: "Documento adicional anexado com sucesso!"
      };
    } catch (error) {
      log(`Erro ao salvar documento adicional: ${error.message}`, "error", error);
      throw error;
    }
  }

  /**
   * Carrega os documentos adicionais de uma ocorrência
   */
  async function loadAdditionalDocuments(occurrenceNumber) {
    try {
      log(`Carregando documentos adicionais para ${occurrenceNumber}`);
      
      const snapshot = await firebase.database().ref(`ocorrencias/${occurrenceNumber}/documentos_adicionais`).once("value");
      
      if (!snapshot.exists()) {
        log("Nenhum documento adicional encontrado");
        return [];
      }
      
      const documentos = [];
      snapshot.forEach(childSnapshot => {
        documentos.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      // Ordenar por data de upload, mais recentes primeiro
      documentos.sort((a, b) => b.dataUpload - a.dataUpload);
      
      log(`${documentos.length} documentos adicionais carregados`);
      return documentos;
    } catch (error) {
      log(`Erro ao carregar documentos adicionais: ${error.message}`, "error", error);
      throw error;
    }
  }

  /**
   * Remove um documento adicional
   */
  async function removeAdditionalDocument(occurrenceNumber, documentId, storagePath) {
    try {
      log(`Removendo documento adicional ID: ${documentId}`);
      
      // Primeiro remover do Storage
      if (storagePath) {
        const storageRef = firebase.storage().ref(storagePath);
        await storageRef.delete();
        log("Arquivo removido do Storage");
      }
      
      // Depois remover do Database
      await firebase.database().ref(`ocorrencias/${occurrenceNumber}/documentos_adicionais/${documentId}`).remove();
      log("Documento removido do banco de dados");
      
      return {
        success: true,
        message: "Documento removido com sucesso!"
      };
    } catch (error) {
      log(`Erro ao remover documento: ${error.message}`, "error", error);
      throw error;
    }
  }

  // ===== FUNÇÕES DE INTERFACE PARA DOCUMENTOS ADICIONAIS =====

  /**
   * Inicializa a interface de documentos adicionais
   */
  function initializeAdditionalDocumentsUI() {
    // Referência para os elementos da UI
    const additionalDocFile = document.getElementById("additional-document-file");
    const uploadAdditionalDocBtn = document.getElementById("upload-additional-doc-btn");
    const uploadArea = document.querySelector(".upload-area-additional");
    
    // Adicionar feedback visual para área de upload
    if (uploadArea) {
      // Efeito visual ao arrastar arquivo
      uploadArea.addEventListener("dragover", function(e) {
        e.preventDefault();
        this.classList.add("drag-over");
      });
      
      uploadArea.addEventListener("dragleave", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
      });
      
      uploadArea.addEventListener("drop", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
        
        if (e.dataTransfer.files.length > 0) {
          additionalDocFile.files = e.dataTransfer.files;
          // Mostrar informações do arquivo selecionado
          updateAdditionalDocFileInfo();
        }
      });
      
      // Ao clicar na área, acionar o input file
      uploadArea.addEventListener("click", function(e) {
        if (e.target !== additionalDocFile) {
          additionalDocFile.click();
        }
      });
    }
    
    // Mostrar informações do arquivo quando selecionado
    if (additionalDocFile) {
      additionalDocFile.addEventListener("change", updateAdditionalDocFileInfo);
    }
    
    // Evento de upload do documento adicional
    if (uploadAdditionalDocBtn) {
      uploadAdditionalDocBtn.addEventListener("click", handleAdditionalDocUpload);
    }
  }

  /**
   * Atualiza as informações do arquivo adicional selecionado
   */
  function updateAdditionalDocFileInfo() {
    const fileInput = document.getElementById("additional-document-file");
    const uploadArea = document.querySelector(".upload-area-additional");
    const progressSection = document.getElementById("additional-docs-progress");
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return;
    }
    
    const file = fileInput.files[0];
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    // Determinar o ícone com base no tipo de arquivo
    let fileIcon = "file-alt";
    if (file.type.includes("pdf")) {
      fileIcon = "file-pdf";
    } else if (file.type.includes("image")) {
      fileIcon = "file-image";
    } else if (file.type.includes("word")) {
      fileIcon = "file-word";
    }
    
    // Atualizar a interface da área de upload
    if (uploadArea) {
      const iconElement = uploadArea.querySelector("i");
      const textElement = uploadArea.querySelector("p");
      
      if (iconElement) iconElement.className = `fas fa-${fileIcon}`;
      if (textElement) textElement.textContent = `${file.name} (${fileSize} MB)`;
    }
    
    // Mostrar informações do arquivo na seção de progresso
    if (progressSection) {
      progressSection.innerHTML = `
        <div class="file-info">
          <div class="file-preview">
            <i class="fas fa-${fileIcon} file-icon"></i>
            <div class="file-details">
              <p class="file-name">${file.name}</p>
              <p class="file-meta">${fileSize} MB</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Manipula o upload de um documento adicional
   */
  async function handleAdditionalDocUpload() {
    if (!currentOccurrence || isUploadingAdditionalDoc) {
      return;
    }
    
    const fileInput = document.getElementById("additional-document-file");
    const documentTypeSelect = document.getElementById("document-type");
    const uploadButton = document.getElementById("upload-additional-doc-btn");
    
    // Verificar se um arquivo foi selecionado
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      mostrarAlerta("Por favor, selecione um arquivo para upload.", "error");
      return;
    }
    
    // Obter o tipo de documento selecionado
    const documentType = documentTypeSelect ? documentTypeSelect.value : "outros";
    const file = fileInput.files[0];
    
    // Ativar flag para prevenir múltiplos uploads
    isUploadingAdditionalDoc = true;
    
    // Atualizar UI para indicar processamento
    const originalButtonText = uploadButton.innerHTML;
    uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    uploadButton.disabled = true;
    
    try {
      // Fazer upload do arquivo
      const documentData = await uploadAdditionalDocument(currentOccurrence, file, documentType);
      
      // Salvar referência no banco de dados
      const result = await saveAdditionalDocument(currentOccurrence, documentData);
      
      // Recarregar a lista de documentos adicionais
      await refreshAdditionalDocumentsList();
      
      // Limpar o formulário
      fileInput.value = "";
      const uploadArea = document.querySelector(".upload-area-additional");
      if (uploadArea) {
        const iconElement = uploadArea.querySelector("i");
        const textElement = uploadArea.querySelector("p");
        
        if (iconElement) iconElement.className = "fas fa-cloud-upload-alt";
        if (textElement) textElement.textContent = "Clique para selecionar ou arraste o arquivo aqui";
      }
      
      // Mostrar mensagem de sucesso
      mostrarAlerta("Documento adicional anexado com sucesso!", "success");
      
    } catch (error) {
      log(`Erro ao anexar documento adicional: ${error.message}`, "error", error);
      mostrarAlerta(`Erro ao anexar documento: ${error.message}`, "error");
    } finally {
      // Restaurar estado do botão
      uploadButton.innerHTML = originalButtonText;
      uploadButton.disabled = false;
      
      // Desativar flag de upload
      isUploadingAdditionalDoc = false;
    }
  }

  /**
   * Atualiza a lista de documentos adicionais
   */
  async function refreshAdditionalDocumentsList() {
    if (!currentOccurrence) return;
    
    const documentsList = document.getElementById("additional-documents-list");
    if (!documentsList) return;
    
    try {
      // Mostrar loading
      documentsList.innerHTML = '<p class="loading-docs"><i class="fas fa-spinner fa-spin"></i> Carregando documentos...</p>';
      
      // Carregar documentos adicionais
      const documentos = await loadAdditionalDocuments(currentOccurrence);
      
      // Se não houver documentos, mostrar mensagem
      if (documentos.length === 0) {
        documentsList.innerHTML = '<p class="no-docs">Nenhum documento adicional anexado.</p>';
        return;
      }
      
      // Criar HTML para cada documento
      let html = '';
      
      documentos.forEach(doc => {
        // Determinar ícone com base no tipo de arquivo
        let fileIcon = "file-alt";
        if (doc.tipo.includes("pdf")) {
          fileIcon = "file-pdf";
        } else if (doc.tipo.includes("image")) {
          fileIcon = "file-image";
        } else if (doc.tipo.includes("word")) {
          fileIcon = "file-word";
        }
        
        // Formatar a data de upload
        const dataUpload = new Date(doc.dataUpload);
        const dataFormatada = dataUpload.toLocaleDateString() + ' ' + 
                             dataUpload.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Obter o nome legível do tipo de documento
        const tipoDocumentoNome = getTipoDocumentoNome(doc.tipoDocumento);
        
        html += `
          <div class="additional-document-item" data-id="${doc.id}" data-path="${doc.path || ''}">
            <div class="additional-document-icon">
              <i class="fas fa-${fileIcon}"></i>
            </div>
            <div class="additional-document-info">
              <p class="additional-document-name">${doc.nome}</p>
              <p class="additional-document-type">Tipo: ${tipoDocumentoNome}</p>
              <p class="additional-document-date">Anexado em: ${dataFormatada}</p>
            </div>
            <div class="additional-document-actions">
              <a href="${doc.url}" target="_blank" class="document-action-btn view-btn" title="Visualizar">
                <i class="fas fa-eye"></i>
              </a>
              <button class="document-action-btn remove-btn" title="Remover" data-id="${doc.id}" data-path="${doc.path || ''}">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;
      });
      
      // Atualizar a lista
      documentsList.innerHTML = html;
      
      // Adicionar eventos para os botões de remover
      const removeButtons = documentsList.querySelectorAll('.remove-btn');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', handleRemoveAdditionalDocument);
      });
      
    } catch (error) {
      log(`Erro ao carregar documentos adicionais: ${error.message}`, "error", error);
      documentsList.innerHTML = `<p class="error-docs"><i class="fas fa-exclamation-triangle"></i> Erro ao carregar documentos: ${error.message}</p>`;
    }
  }

  /**
   * Converte tipo de documento para nome legível
   */
  function getTipoDocumentoNome(tipo) {
    const tipos = {
      'identidade': 'Documento de Identidade',
      'residencia': 'Comprovante de Residência',
      'veiculo': 'Documento do Veículo',
      'boletim': 'Boletim de Ocorrência',
      'outros': 'Outros Documentos'
    };
    
    return tipos[tipo] || 'Documento Adicional';
  }

  /**
   * Manipula a remoção de um documento adicional
   */
  async function handleRemoveAdditionalDocument(event) {
    if (!currentOccurrence) return;
    
    const button = event.currentTarget;
    const documentId = button.getAttribute('data-id');
    const storagePath = button.getAttribute('data-path');
    
    if (!documentId) {
      mostrarAlerta("ID do documento não encontrado", "error");
      return;
    }
    
    // Pedir confirmação ao usuário
    if (!confirm("Tem certeza que deseja remover este documento?")) {
      return;
    }
    
    try {
      // Desabilitar o botão durante o processo
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      
      // Remover o documento
      await removeAdditionalDocument(currentOccurrence, documentId, storagePath);
      
      // Atualizar a lista
      await refreshAdditionalDocumentsList();
      
      // Mostrar mensagem de sucesso
      mostrarAlerta("Documento removido com sucesso!", "success");
      
    } catch (error) {
      log(`Erro ao remover documento: ${error.message}`, "error", error);
      mostrarAlerta(`Erro ao remover documento: ${error.message}`, "error");
      
      // Restaurar o botão em caso de erro
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-trash-alt"></i>';
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
    emAndamento: 0, // Renomeado de emAnalise para emAndamento
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
    } else if (ocorrencia.status === "Em andamento") { // Alterado de "Em Análise" para "Em andamento"
      stats.emAndamento++;
    }

    // Contar ocorrências do mês atual
    if (ocorrencia.timestamp >= inicioMes) {
      stats.mes++;
    }
  });

  return stats;
}
  /**
   /**
 * Atualiza a UI com as estatísticas
 */
function atualizarEstatisticasUI(stats) {
  // Atualizar contadores na UI
  if (pendingCount) pendingCount.textContent = stats.pendentes;
  if (completedCount) completedCount.textContent = stats.concluidas;
  
  // Novo: referência ao contador de "Em andamento" (se existir no HTML)
  const inProgressCount = document.getElementById("inprogress-count");
  if (inProgressCount) inProgressCount.textContent = stats.emAndamento;
  
  // Novo: referência ao contador de "Cancelado" (se existir no HTML)
  const canceledCount = document.getElementById("canceled-count");
  if (canceledCount) canceledCount.textContent = stats.canceladas;

  // Atualizar estatísticas detalhadas
  if (statsTotal) statsTotal.textContent = stats.total;
  if (statsMonth) statsMonth.textContent = stats.mes;
  if (statsPending) statsPending.textContent = stats.pendentes;
  if (statsCompleted) statsCompleted.textContent = stats.concluidas;
  
  // Novo: estatísticas detalhadas para "Em andamento" e "Cancelado"
  const statsInProgress = document.getElementById("stats-inprogress");
  if (statsInProgress) statsInProgress.textContent = stats.emAndamento;
  
  const statsCanceled = document.getElementById("stats-canceled");
  if (statsCanceled) statsCanceled.textContent = stats.canceladas;

  // Calcular percentual de concluídas (para mostrar tendência)
  const percentConcluidas =
    stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0;

  const statsCompletedPercent = document.getElementById(
    "stats-completed-percent"
  );
  if (statsCompletedPercent) {
    statsCompletedPercent.textContent = `${percentConcluidas}%`;
  }
  
  // Novo: Opcionalmente calcular percentuais para outros status
  // Percentual de "Em andamento"
  const percentEmAndamento = 
    stats.total > 0 ? Math.round((stats.emAndamento / stats.total) * 100) : 0;
    
  const statsInProgressPercent = document.getElementById("stats-inprogress-percent");
  if (statsInProgressPercent) {
    statsInProgressPercent.textContent = `${percentEmAndamento}%`;
  }
  
  // Percentual de "Cancelado"
  const percentCanceladas = 
    stats.total > 0 ? Math.round((stats.canceladas / stats.total) * 100) : 0;
    
  const statsCanceledPercent = document.getElementById("stats-canceled-percent");
  if (statsCanceledPercent) {
    statsCanceledPercent.textContent = `${percentCanceladas}%`;
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

      // Limpar container de upload
      const fileInfoContainer = document.getElementById("file-info-container");
      if (fileInfoContainer) {
        fileInfoContainer.innerHTML = "";
      }

      // Limpar input de arquivo
      if (certidaoFileInput) {
        certidaoFileInput.value = "";
      }

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

      <!-- Seção de Documentos Adicionais -->
      <div class="modal-section" id="additional-documents-section">
        <div class="section-title"><i class="fas fa-paperclip"></i> Documentos Adicionais</div>
        
        <!-- Lista de documentos adicionais já anexados -->
        <div id="additional-documents-list" class="documents-list">
          <!-- Será preenchido dinamicamente -->
          <p class="no-docs">Nenhum documento adicional anexado.</p>
        </div>
        
        <!-- Seção para anexar novo documento -->
        <div class="add-document-section">
          <h4>Anexar Documento Adicional</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="document-type">Tipo de Documento:</label>
              <select id="document-type" class="document-type-select">
                <option value="identidade">Documento de Identidade</option>
                <option value="residencia">Comprovante de Residência</option>
                <option value="veiculo">Documento do Veículo</option>
                <option value="boletim">Boletim de Ocorrência</option>
                <option value="outros">Outros Documentos</option>
              </select>
            </div>
          </div>
          
          <div class="upload-area-additional">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Clique para selecionar ou arraste o arquivo aqui</p>
            <input type="file" id="additional-document-file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          </div>
          <small>Formatos aceitos: PDF, JPG, PNG, DOC, DOCX (máx. 10MB)</small>
          
          <!-- Container para informações do arquivo e progresso -->
          <div id="additional-docs-progress"></div>
          
          <button id="upload-additional-doc-btn" class="btn btn-primary mt-3">
            <i class="fas fa-upload"></i> Anexar Documento
          </button>
        </div>
      </div>
    `;

      // Atualizar conteúdo do modal
      if (modalBody) {
        modalBody.innerHTML = html;
      }

      // Inicializar interface de documentos adicionais
      initializeAdditionalDocumentsUI();
      
      // Carregar documentos adicionais
      await refreshAdditionalDocumentsList();

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
      updateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
      updateStatusBtn.disabled = true;

      try {
        const newStatus = statusSelect.value;
        
        // Verificação segura para o input de arquivo
        const certidaoFileInput = document.getElementById("certidao-file");
        let certidaoFile = null;
        
        // Adicionar log para debug
        log("Verificando arquivo de certidão...");
        
        if (certidaoFileInput && certidaoFileInput.files && certidaoFileInput.files.length > 0) {
          certidaoFile = certidaoFileInput.files[0];
          log(`Arquivo encontrado: ${certidaoFile.name}, tipo: ${certidaoFile.type}, tamanho: ${certidaoFile.size} bytes`);
        } else {
          log("Nenhum arquivo encontrado no input");
        }

        // Se o status é "Concluído", verificar se há certidão
        if (newStatus === "Concluído") {
          // Verificar se já existe uma certidão anexada
          const ocorrencia = await carregarOcorrencia(currentOccurrence);

          const temCertidao = 
            ocorrencia && ocorrencia.certidao && ocorrencia.certidao.url;
          
          log(`Status concluído selecionado. Tem certidão existente: ${temCertidao}, Novo arquivo: ${certidaoFile ? 'Sim' : 'Não'}`);
          
          if (!temCertidao && !certidaoFile) {
            throw new Error(
              "É necessário anexar uma certidão antes de concluir a solicitação."
            );
          }
        }

        // Atualizar status e certidão se existir
        const resultado = await atualizarStatusComCertidao(
          currentOccurrence, 
          newStatus, 
          certidaoFile
        );

        // Mostrar mensagem de sucesso
        mostrarAlerta(resultado.message, "success");

        // Fechar modal e recarregar dados
        if (detailModal) {
          detailModal.style.display = "none";
        }

        // Recarregar dados
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
      log("Evento change do input de arquivo acionado");
      
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        log(`Arquivo selecionado: ${file.name}, tipo: ${file.type}, tamanho: ${file.size} bytes`);
        
        const fileSize = (file.size / 1024 / 1024).toFixed(2);

        // Determinar o ícone do arquivo baseado no tipo
        const fileIcon = file.type.includes("pdf") ? "file-pdf" : "file-image";

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
          // Atualizar apenas os elementos internos sem remover o input
          const iconElement = uploadArea.querySelector("i");
          const textElement = uploadArea.querySelector("p");
          
          if (iconElement) iconElement.className = `fas fa-${fileIcon}`;
          if (textElement) textElement.textContent = `${file.name} (${fileSize} MB)`;
          
          // Adicionar classe visual para indicar que um arquivo foi selecionado
          uploadArea.classList.add("file-selected");
        }

        // Adicionar ao container de informações do arquivo
        const fileInfoContainer = document.getElementById("file-info-container");
        if (fileInfoContainer) {
          fileInfoContainer.innerHTML = `
            <div class="file-info">
              <div class="file-preview">
                <i class="fas fa-${fileIcon} file-icon"></i>
                <div class="file-details">
                  <p class="file-name">${file.name}</p>
                  <p class="file-meta">${fileSize} MB</p>
                </div>
              </div>
            </div>
          `;
        }
      } else {
        log("Nenhum arquivo selecionado no evento change");
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
