document.addEventListener("DOMContentLoaded", function () {
  // Elementos do login
  const loginContainer = document.getElementById("login-container");
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginError = document.getElementById("login-error");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  // Elementos do dashboard
  const adminDashboard = document.getElementById("admin-dashboard");
  const userEmail = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");
  const navItems = document.querySelectorAll(".nav-item");
  const toggleSidebar = document.getElementById("toggle-sidebar");
  const pageTitle = document.getElementById("page-title");

  // Contadores de estatísticas
  const pendingCount = document.getElementById("pending-count");
  const completedCount = document.getElementById("completed-count");

  // Conteúdo das abas
  const tabContents = document.querySelectorAll(".tab-content");

  // Elementos de busca e filtro
  const adminSearch = document.getElementById("admin-search");
  const adminSearchBtn = document.getElementById("admin-search-btn");
  const dateFilter = document.getElementById("date-filter");

  // Elementos do modal
  const detailModal = document.getElementById("detail-modal");
  const modalCloseBtn = document.querySelector(".modal-content .close");
  const modalCloseButton = document.querySelector(".modal-content .close-btn");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const statusSelect = document.getElementById("status-select");
  const updateStatusBtn = document.getElementById("update-status-btn");

  // Elementos de upload da certidão
  const certidaoUploadContainer = document.getElementById(
    "certidao-upload-container"
  );
  const certidaoUploadInput = document.getElementById("certidao-upload");
  const uploadCertidaoBtn = document.getElementById("upload-certidao-btn");
  const uploadDropzone = document.getElementById("upload-dropzone");

  // Ocorrência atual visualizada
  let currentOccurrence = null;

  // Template para card de ocorrência
  const cardTemplate = document.getElementById("ocorrencia-card-template");

  // Função para mostrar mensagem de erro
  function showErrorMessage(message, duration = 5000) {
    // Verificar se já existe uma mensagem de erro
    let errorPopup = document.querySelector(".error-popup");

    if (!errorPopup) {
      // Criar o elemento de popup
      errorPopup = document.createElement("div");
      errorPopup.className = "error-popup";
      document.body.appendChild(errorPopup);
    }

    // Adicionar conteúdo ao popup
    errorPopup.innerHTML = `
      <div class="error-popup-content">
        <div class="error-header">
          <i class="fas fa-exclamation-circle"></i>
          <span>Erro</span>
        </div>
        <div class="error-body">
          <p>${message}</p>
        </div>
        <div class="error-footer">
          <button class="error-ok-btn">OK</button>
        </div>
      </div>
    `;

    // Mostrar o popup
    errorPopup.style.display = "flex";

    // Adicionar evento para fechar o popup
    const okBtn = errorPopup.querySelector(".error-ok-btn");
    okBtn.addEventListener("click", () => {
      errorPopup.style.display = "none";
    });

    // Fechar automaticamente após o tempo especificado
    if (duration > 0) {
      setTimeout(() => {
        errorPopup.style.display = "none";
      }, duration);
    }

    return errorPopup;
  }

  // Estilo CSS para o popup de erro
  const errorStyles = document.createElement("style");
  errorStyles.textContent = `
    .error-popup {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      animation: fadeIn 0.3s;
    }
    
    .error-popup-content {
      background-color: white;
      border-radius: 8px;
      width: 90%;
      max-width: 400px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      animation: slideUp 0.3s;
    }
    
    .error-header {
      background-color: #ef4444;
      color: white;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .error-header i {
      font-size: 1.2rem;
    }
    
    .error-header span {
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .error-body {
      padding: 20px;
    }
    
    .error-body p {
      margin: 0;
      color: #333;
    }
    
    .error-footer {
      padding: 15px 20px;
      border-top: 1px solid #f1f1f1;
      text-align: right;
    }
    
    .error-ok-btn {
      background-color: #3b82f6;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .error-ok-btn:hover {
      background-color: #2563eb;
    }
  `;

  document.head.appendChild(errorStyles);

  // Toggle sidebar
  if (toggleSidebar) {
    toggleSidebar.addEventListener("click", function () {
      adminDashboard.classList.toggle("sidebar-expanded");
    });
  }

  // ----- Funções de Autenticação -----

  // Login
  if (loginButton) {
    loginButton.addEventListener("click", function () {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        loginError.textContent = "Por favor, preencha todos os campos.";
        return;
      }

      // Mostrar carregamento
      loginButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Entrando...';
      loginButton.disabled = true;
      loginError.textContent = "";

      // Autenticar com Firebase
      firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Login bem-sucedido
          const user = userCredential.user;
          console.log("Login bem-sucedido para:", user.email);

          // Mostrar dashboard
          loginContainer.style.display = "none";
          adminDashboard.style.display = "flex";

          // Definir email do usuário
          userEmail.textContent = user.email;

          // Carregar dados do dashboard
          loadDashboardData();
        })
        .catch((error) => {
          // Tratar erros
          console.error("Erro no login:", error.code, error.message);

          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
          ) {
            loginError.textContent = "E-mail ou senha incorretos.";
          } else if (error.code === "auth/invalid-email") {
            loginError.textContent = "E-mail inválido.";
          } else {
            loginError.textContent = "Erro ao fazer login. Tente novamente.";
          }
        })
        .finally(() => {
          // Resetar estado do botão
          loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
          loginButton.disabled = false;
        });
    });
  }

  // Logout
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      firebase
        .auth()
        .signOut()
        .then(() => {
          // Logout bem-sucedido
          adminDashboard.style.display = "none";
          loginContainer.style.display = "flex";

          // Limpar formulário de login
          emailInput.value = "";
          passwordInput.value = "";
        })
        .catch((error) => {
          console.error("Erro ao fazer logout:", error);
          showErrorMessage("Erro ao fazer logout. Tente novamente.");
        });
    });
  }

  // Verificar estado da autenticação ao carregar a página
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // Usuário está logado
      loginContainer.style.display = "none";
      adminDashboard.style.display = "flex";
      userEmail.textContent = user.email;

      // Carregar dados do dashboard
      loadDashboardData();
    } else {
      // Usuário está deslogado
      loginContainer.style.display = "flex";
      adminDashboard.style.display = "none";
    }
  });

  // ----- Funções do Dashboard -----

  // Navegação entre abas
  navItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remover classe ativa de todos os itens
      navItems.forEach((nav) => nav.classList.remove("active"));

      // Adicionar classe ativa ao item clicado
      this.classList.add("active");

      // Ocultar todos os conteúdos das abas
      tabContents.forEach((tab) => (tab.style.display = "none"));

      // Mostrar conteúdo da aba selecionada
      const tabId = this.getAttribute("data-tab") + "-tab";
      const tabElement = document.getElementById(tabId);
      if (tabElement) {
        tabElement.style.display = "block";
      }

      // Atualizar título da página
      updatePageTitle(this.getAttribute("data-tab"));

      // Carregar dados da aba
      if (this.getAttribute("data-tab") !== "settings") {
        loadTabData(this.getAttribute("data-tab"));
      }
    });
  });

  // Atualizar título da página
  function updatePageTitle(tabName) {
    if (tabName === "pending") {
      pageTitle.textContent = "Solicitações Pendentes";
    } else if (tabName === "completed") {
      pageTitle.textContent = "Solicitações Concluídas";
    } else if (tabName === "settings") {
      pageTitle.textContent = "Configurações";
    }
  }

  // Carregar todos os dados do dashboard
  function loadDashboardData() {
    // Buscar ocorrências do Firebase
    database
      .ref("ocorrencias")
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          const ocorrencias = [];

          snapshot.forEach((childSnapshot) => {
            ocorrencias.push({
              id: childSnapshot.key,
              ...childSnapshot.val(),
            });
          });

          // Atualizar contadores de estatísticas
          updateStats(ocorrencias);

          // Carregar dados da aba ativa
          const activeTab = document
            .querySelector(".nav-item.active")
            .getAttribute("data-tab");
          if (activeTab !== "settings") {
            loadTabData(activeTab, ocorrencias);
          }
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar dados:", error);
        showErrorMessage(
          "Erro ao carregar dados. Por favor, recarregue a página."
        );
      });
  }

  // Atualizar estatísticas do dashboard
  function updateStats(ocorrencias) {
    const stats = {
      pending: 0,
      completed: 0,
    };

    ocorrencias.forEach((ocorrencia) => {
      if (ocorrencia.status === "Pendente") {
        stats.pending++;
      } else if (ocorrencia.status === "Concluído") {
        stats.completed++;
      }
    });

    // Atualizar contadores da UI
    pendingCount.textContent = stats.pending;
    completedCount.textContent = stats.completed;
  }

  // Carregar dados de uma aba específica
  function loadTabData(tabName, cachedData = null) {
    const containerIds = {
      pending: "pending-ocorrencias",
      completed: "completed-ocorrencias",
    };

    const containerId = containerIds[tabName];
    const container = document.getElementById(containerId);

    if (!container) return;

    // Mostrar carregamento
    container.innerHTML =
      '<div class="loading">Carregando ocorrências...</div>';

    // Usar dados em cache ou buscar do Firebase
    const dataPromise = cachedData
      ? Promise.resolve(cachedData)
      : database
          .ref("ocorrencias")
          .once("value")
          .then((snapshot) => {
            if (!snapshot.exists()) return [];

            const ocorrencias = [];
            snapshot.forEach((childSnapshot) => {
              ocorrencias.push({
                id: childSnapshot.key,
                ...childSnapshot.val(),
              });
            });

            return ocorrencias;
          });

    dataPromise
      .then((ocorrencias) => {
        // Filtrar por aba
        let filteredOcorrencias;

        if (tabName === "pending") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Pendente"
          );
        } else if (tabName === "completed") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Concluído"
          );
        }

        // Aplicar filtro de data se selecionado
        const dateFilterValue = dateFilter.value;
        if (dateFilterValue !== "all") {
          const now = new Date();
          const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).getTime();

          if (dateFilterValue === "today") {
            filteredOcorrencias = filteredOcorrencias.filter((o) => {
              const timestamp = o.timestamp;
              return timestamp >= today;
            });
          } else if (dateFilterValue === "week") {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);

            filteredOcorrencias = filteredOcorrencias.filter((o) => {
              const timestamp = o.timestamp;
              return timestamp >= weekStart.getTime();
            });
          } else if (dateFilterValue === "month") {
            const monthStart = new Date(
              now.getFullYear(),
              now.getMonth(),
              1
            ).getTime();

            filteredOcorrencias = filteredOcorrencias.filter((o) => {
              const timestamp = o.timestamp;
              return timestamp >= monthStart;
            });
          }
        }

        // Ordenar por timestamp (mais recentes primeiro)
        filteredOcorrencias.sort((a, b) => b.timestamp - a.timestamp);

        // Renderizar ocorrências
        renderOcorrencias(containerId, filteredOcorrencias);
      })
      .catch((error) => {
        console.error("Erro ao carregar dados:", error);
        container.innerHTML =
          '<div class="error-message">Erro ao carregar dados. Por favor, tente novamente.</div>';
        showErrorMessage(
          "Erro ao carregar dados da aba. Por favor, tente novamente."
        );
      });
  }

  // Renderizar ocorrências em um container
  function renderOcorrencias(containerId, ocorrencias) {
    const container = document.getElementById(containerId);

    if (!container) return;

    // Limpar container
    container.innerHTML = "";

    if (ocorrencias.length === 0) {
      container.innerHTML =
        '<div class="no-data">Nenhuma ocorrência encontrada.</div>';
      return;
    }

    // Criar card para cada ocorrência
    ocorrencias.forEach((ocorrencia) => {
      const card = createOcorrenciaCard(ocorrencia);
      container.appendChild(card);
    });
  }

  // Criar elemento de card para uma ocorrência
  function createOcorrenciaCard(ocorrencia) {
    // Clonar template do card
    const template = cardTemplate ? cardTemplate.content.cloneNode(true) : null;

    // Se não houver template, criar card manualmente
    if (!template) {
      const card = document.createElement("div");
      card.className = "ocorrencia-card";
      card.setAttribute("data-status", ocorrencia.status);

      // Formatar data
      const dataOcorrencia =
        new Date(ocorrencia.timestamp).toLocaleDateString("pt-BR") +
        " " +
        new Date(ocorrencia.timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

      card.innerHTML = `
        <div class="card-status-indicator"></div>
        <div class="card-header">
          <div class="ocorrencia-number">${ocorrencia.occurrenceNumber}</div>
          <div class="ocorrencia-status ${ocorrencia.status
            .toLowerCase()
            .replace("í", "i")}">${ocorrencia.status}</div>
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
              <span class="info-value">${ocorrencia.cpf}</span>
            </div>
            <div class="info-row">
              <i class="fas fa-calendar"></i>
              <span class="info-label">Data:</span>
              <span class="info-value">${dataOcorrencia}</span>
            </div>
            <div class="info-row">
              <i class="fas fa-map-marker-alt"></i>
              <span class="info-label">Local:</span>
              <span class="info-value">${ocorrencia.enderecoOcorrencia}</span>
            </div>
            <div class="info-row certidao-row">
              <i class="fas fa-file-alt"></i>
              <span class="info-label">Certidão:</span>
              <span class="info-value">${
                ocorrencia.certidao
                  ? `<a href="${ocorrencia.certidao.url}" target="_blank" class="visualizar-link">
                  <i class="fas fa-eye"></i> Visualizar
                </a>`
                  : "Não disponível"
              }</span>
            </div>
          </div>
        </div>
        <div class="card-footer">
          <button class="view-btn">
            <i class="fas fa-eye"></i> Ver Detalhes
          </button>
        </div>
      `;

      // Adicionar evento de clique no botão de detalhes
      const viewBtn = card.querySelector(".view-btn");
      viewBtn.addEventListener("click", () => {
        viewOcorrenciaDetails(ocorrencia.occurrenceNumber);
      });

      return card;
    }

    // Usar o template para criar o card
    const card = template.querySelector(".ocorrencia-card");

    // Definir status
    card.setAttribute("data-status", ocorrencia.status);

    // Preencher dados
    card.querySelector(".ocorrencia-number").textContent =
      ocorrencia.occurrenceNumber;

    const statusElement = card.querySelector(".ocorrencia-status");
    statusElement.textContent = ocorrencia.status;
    statusElement.classList.add(
      ocorrencia.status.toLowerCase().replace("í", "i")
    );

    card.querySelector(".nome-value").textContent = ocorrencia.nome;
    card.querySelector(".cpf-value").textContent = ocorrencia.cpf;

    // Formatar data
    const dataOcorrencia =
      new Date(ocorrencia.timestamp).toLocaleDateString("pt-BR") +
      " " +
      new Date(ocorrencia.timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    card.querySelector(".data-value").textContent = dataOcorrencia;

    card.querySelector(".local-value").textContent =
      ocorrencia.enderecoOcorrencia;

    // Certidão
    const certidaoRow = card.querySelector(".certidao-row");
    if (ocorrencia.certidao) {
      card.querySelector(
        ".certidao-value"
      ).innerHTML = `<a href="${ocorrencia.certidao.url}" target="_blank" class="visualizar-link">
          <i class="fas fa-eye"></i> Visualizar
        </a>`;
    } else {
      card.querySelector(".certidao-value").textContent = "Não disponível";
    }

    // Adicionar evento de clique no botão de detalhes
    const viewBtn = card.querySelector(".view-btn");
    viewBtn.addEventListener("click", () => {
      viewOcorrenciaDetails(ocorrencia.occurrenceNumber);
    });

    return card;
  }

  // Ver detalhes da ocorrência
  function viewOcorrenciaDetails(occurrenceNumber) {
    // Buscar dados da ocorrência no Firebase
    database
      .ref("ocorrencias/" + occurrenceNumber)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          const ocorrencia = snapshot.val();
          currentOccurrence = occurrenceNumber;

          // Atualizar título do modal
          modalTitle.textContent = `Ocorrência: ${occurrenceNumber}`;

          // Atualizar valor do select de status
          if (statusSelect) {
            statusSelect.value = ocorrencia.status;
          }

          // Mostrar/ocultar upload de certidão com base no status
          if (certidaoUploadContainer) {
            if (ocorrencia.status === "Concluído") {
              certidaoUploadContainer.style.display = "block";
            } else {
              certidaoUploadContainer.style.display = "none";
            }
          }

          // Formatar datas
          const dataOcorrenciaFormatada = new Date(
            ocorrencia.dataOcorrencia
          ).toLocaleDateString("pt-BR");
          const dataNascimentoFormatada = new Date(
            ocorrencia.dataNascimento
          ).toLocaleDateString("pt-BR");
          const dataTimestamp = new Date(ocorrencia.timestamp).toLocaleString(
            "pt-BR"
          );

          // Obter hora da ocorrência se disponível
          const horaOcorrencia = ocorrencia.horaOcorrencia || "Não informado";

          // Construir conteúdo do modal
          const content = `
              <div class="modal-section">
                <div class="section-header">
                  <i class="fas fa-info-circle"></i>
                  <h3>Informações da Solicitação</h3>
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <label>Status</label>
                    <p><span class="status-badge ${ocorrencia.status
                      .toLowerCase()
                      .replace("í", "i")}">${ocorrencia.status}</span></p>
                  </div>
                  <div class="info-item">
                    <label>Data de Solicitação</label>
                    <p>${dataTimestamp}</p>
                  </div>
                  ${
                    ocorrencia.certidao
                      ? `<div class="info-item full-width">
                      <label>Certidão de Ocorrência</label>
                      <p><a href="${ocorrencia.certidao.url}" target="_blank" class="visualizar-link">
                        <i class="fas fa-file-pdf"></i> ${ocorrencia.certidao.nome}
                      </a></p>
                    </div>`
                      : ""
                  }
                </div>
              </div>
              
              <div class="modal-section">
                <div class="section-header">
                  <i class="fas fa-user"></i>
                  <h3>Dados do Solicitante</h3>
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <label>Nome Completo</label>
                    <p>${ocorrencia.nome}</p>
                  </div>
                  <div class="info-item">
                    <label>CPF</label>
                    <p>${ocorrencia.cpf}</p>
                  </div>
                  <div class="info-item">
                    <label>RG</label>
                    <p>${ocorrencia.rg}</p>
                  </div>
                  <div class="info-item">
                    <label>Data de Nascimento</label>
                    <p>${dataNascimentoFormatada}</p>
                  </div>
                  <div class="info-item">
                    <label>Endereço</label>
                    <p>${ocorrencia.enderecoSolicitante || "Não informado"}</p>
                  </div>
                  <div class="info-item">
                    <label>E-mail</label>
                    <p>${ocorrencia.email}</p>
                  </div>
                  <div class="info-item">
                    <label>Telefone</label>
                    <p>${ocorrencia.telefone}</p>
                  </div>
                </div>
              </div>
              
              <div class="modal-section">
                <div class="section-header">
                  <i class="fas fa-map-marked-alt"></i>
                  <h3>Detalhes da Ocorrência</h3>
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <label>Data da Ocorrência</label>
                    <p>${dataOcorrenciaFormatada}</p>
                  </div>
                  <div class="info-item">
                    <label>Hora da Ocorrência</label>
                    <p>${horaOcorrencia}</p>
                  </div>
                  <div class="info-item">
                    <label>Local da Ocorrência</label>
                    <p>${ocorrencia.enderecoOcorrencia}</p>
                  </div>
                  <div class="info-item full-width">
                    <label>Descrição</label>
                    <p class="description-text">${ocorrencia.descricao}</p>
                  </div>
                </div>
              </div>
              
              <div class="modal-section">
                <div class="section-header">
                  <i class="fas fa-file-alt"></i>
                  <h3>Documentos Anexados</h3>
                </div>
                ${getDocumentosHTML(ocorrencia.documentos)}
              </div>
            `;

          // Atualizar corpo do modal
          if (modalBody) {
            modalBody.innerHTML = content;
          }

          // Mostrar modal
          if (detailModal) {
            detailModal.style.display = "flex";
          }
        } else {
          showErrorMessage("Ocorrência não encontrada!");
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar detalhes da ocorrência:", error);
        showErrorMessage("Erro ao carregar detalhes da ocorrência.");
      });
  }

  // Formatar HTML de documentos
  function getDocumentosHTML(documentos) {
    if (!documentos) return "<p>Nenhum documento anexado.</p>";

    let html = '<div class="documentos-lista">';

    if (documentos.documentoIdentidade) {
      html += `
          <div class="documento-item">
            <label>Documento de Identidade</label>
            <a href="${documentos.documentoIdentidade.url}" target="_blank">${documentos.documentoIdentidade.nome}</a>
          </div>
        `;
    }

    if (documentos.comprovanteResidencia) {
      html += `
          <div class="documento-item">
            <label>Comprovante de Residência</label>
            <a href="${documentos.comprovanteResidencia.url}" target="_blank">${documentos.comprovanteResidencia.nome}</a>
          </div>
        `;
    }

    if (documentos.documentoCarro) {
      html += `
          <div class="documento-item">
            <label>Documento do Veículo</label>
            <a href="${documentos.documentoCarro.url}" target="_blank">${documentos.documentoCarro.nome}</a>
          </div>
        `;
    }

    if (documentos.outrosDocumentos && documentos.outrosDocumentos.length > 0) {
      html += `
          <div class="documento-item">
            <label>Outros Documentos</label>
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

    return html || "<p>Nenhum documento disponível</p>";
  }

  // Atualizar status da ocorrência
  if (updateStatusBtn) {
    updateStatusBtn.addEventListener("click", function () {
      if (!currentOccurrence) return;

      const newStatus = statusSelect.value;

      // Mostrar carregamento
      updateStatusBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
      updateStatusBtn.disabled = true;

      // Atualizar no Firebase
      database
        .ref("ocorrencias/" + currentOccurrence)
        .update({
          status: newStatus,
        })
        .then(() => {
          // Mostrar mensagem de sucesso
          showSuccessMessage("Status atualizado com sucesso!");

          // Mostrar/ocultar seção de upload com base no novo status
          if (certidaoUploadContainer) {
            if (newStatus === "Concluído") {
              certidaoUploadContainer.style.display = "block";
            } else {
              certidaoUploadContainer.style.display = "none";
            }
          }

          // Atualizar dados do dashboard
          loadDashboardData();
        })
        .catch((error) => {
          console.error("Erro ao atualizar status:", error);
          showErrorMessage(
            "Erro ao atualizar status. Por favor, tente novamente."
          );
        })
        .finally(() => {
          // Resetar estado do botão
          updateStatusBtn.innerHTML =
            '<i class="fas fa-sync-alt"></i> Atualizar';
          updateStatusBtn.disabled = false;
        });
    });
  }

  // Função para mostrar mensagem de sucesso
  function showSuccessMessage(message, duration = 3000) {
    const successPopup = document.createElement("div");
    successPopup.className = "success-popup";

    successPopup.innerHTML = `
      <div class="success-popup-content">
        <i class="fas fa-check-circle"></i>
        <p>${message}</p>
      </div>
    `;

    document.body.appendChild(successPopup);

    // Adicionar estilos
    const successStyles = document.createElement("style");
    successStyles.textContent = `
      .success-popup {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        animation: slideIn 0.3s, fadeOut 0.5s ${
          duration / 1000 - 0.5
        }s forwards;
      }
      
      .success-popup-content {
        background-color: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .success-popup i {
        font-size: 1.5rem;
      }
      
      .success-popup p {
        margin: 0;
        font-weight: 500;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;

    document.head.appendChild(successStyles);

    // Remover após o tempo especificado
    setTimeout(() => {
      if (successPopup.parentNode) {
        successPopup.parentNode.removeChild(successPopup);
      }
    }, duration);
  }

  // Upload da Certidão de Ocorrência
  if (uploadCertidaoBtn) {
    uploadCertidaoBtn.addEventListener("click", function () {
      if (!currentOccurrence) return;

      const fileInput = certidaoUploadInput;

      if (fileInput.files.length === 0) {
        showErrorMessage("Por favor, selecione um arquivo para upload.");
        return;
      }

      // Mostrar carregamento
      uploadCertidaoBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      uploadCertidaoBtn.disabled = true;

      const file = fileInput.files[0];
      const storageRef = storage.ref(
        `ocorrencias/${currentOccurrence}/certidao/${file.name}`
      );

      // Upload para o Firebase Storage
      storageRef
        .put(file)
        .then(() => storageRef.getDownloadURL())
        .then((downloadURL) => {
          // Atualizar o registro da ocorrência com as informações da certidão
          return database.ref(`ocorrencias/${currentOccurrence}`).update({
            certidao: {
              nome: file.name,
              url: downloadURL,
              uploadDate: Date.now(),
            },
          });
        })
        .then(() => {
          showSuccessMessage("Certidão enviada com sucesso!");
          fileInput.value = ""; // Limpar o input de arquivo

          // Atualizar os detalhes da ocorrência
          viewOcorrenciaDetails(currentOccurrence);

          // Atualizar dados do dashboard
          loadDashboardData();
        })
        .catch((error) => {
          console.error("Erro ao enviar certidão:", error);
          showErrorMessage(
            "Erro ao enviar a certidão. Por favor, tente novamente."
          );
        })
        .finally(() => {
          // Resetar estado do botão
          uploadCertidaoBtn.innerHTML =
            '<i class="fas fa-upload"></i> Enviar Certidão';
          uploadCertidaoBtn.disabled = false;

          // Resetar o texto do dropzone
          if (uploadDropzone) {
            uploadDropzone.querySelector("p").textContent =
              "Arraste um arquivo ou clique para selecionar";
          }
        });
    });
  }

  // Melhorar a experiência do dropzone de upload
  if (uploadDropzone) {
    uploadDropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("dragover");
    });

    uploadDropzone.addEventListener("dragleave", function () {
      this.classList.remove("dragover");
    });

    uploadDropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("dragover");

      if (e.dataTransfer.files.length > 0) {
        certidaoUploadInput.files = e.dataTransfer.files;

        // Atualizar texto com o nome do arquivo
        const fileName = e.dataTransfer.files[0].name;
        this.querySelector("p").textContent = fileName;
      }
    });

    certidaoUploadInput.addEventListener("change", function () {
      if (this.files.length > 0) {
        const fileName = this.files[0].name;
        uploadDropzone.querySelector("p").textContent = fileName;
      } else {
        uploadDropzone.querySelector("p").textContent =
          "Arraste um arquivo ou clique para selecionar";
      }
    });
  }

  // Fechar modal
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

  // Funcionalidade de busca com correções
  if (adminSearchBtn) {
    adminSearchBtn.addEventListener("click", function () {
      try {
        const searchTerm = adminSearch.value.trim();

        if (!searchTerm) {
          loadDashboardData();
          return;
        }

        // Mostrar estado de carregamento no container ativo
        const activeTab = document
          .querySelector(".nav-item.active")
          .getAttribute("data-tab");

        if (activeTab === "settings") {
          // Não fazer busca na aba de configurações
          return;
        }

        const containerId =
          activeTab === "pending"
            ? "pending-ocorrencias"
            : "completed-ocorrencias";
        const container = document.getElementById(containerId);

        if (container) {
          container.innerHTML =
            '<div class="loading">Buscando ocorrências...</div>';
        }

        // Buscar todas as ocorrências
        database
          .ref("ocorrencias")
          .once("value")
          .then((snapshot) => {
            if (!snapshot.exists()) {
              if (container) {
                container.innerHTML =
                  '<div class="no-data">Nenhuma ocorrência encontrada.</div>';
              }
              return;
            }

            const ocorrencias = [];
            snapshot.forEach((childSnapshot) => {
              ocorrencias.push({
                id: childSnapshot.key,
                ...childSnapshot.val(),
              });
            });

            // Filtrar por termo de busca (número, nome ou CPF)
            const searchTermLower = searchTerm.toLowerCase();
            const filteredOcorrencias = ocorrencias.filter((o) => {
              // Verificar se os campos existem antes de tentar acessá-los
              const numberMatch =
                o.occurrenceNumber &&
                o.occurrenceNumber.toLowerCase().includes(searchTermLower);
              const nameMatch =
                o.nome && o.nome.toLowerCase().includes(searchTermLower);
              const cpfMatch = o.cpf && o.cpf.includes(searchTerm);

              return numberMatch || nameMatch || cpfMatch;
            });

            // Atualizar estatísticas
            updateStats(ocorrencias);

            // Filtrar resultados com base na aba ativa
            let tabFilteredOcorrencias = [];

            if (activeTab === "pending") {
              tabFilteredOcorrencias = filteredOcorrencias.filter(
                (o) => o.status === "Pendente"
              );
            } else if (activeTab === "completed") {
              tabFilteredOcorrencias = filteredOcorrencias.filter(
                (o) => o.status === "Concluído"
              );
            }

            // Renderizar os resultados
            if (container) {
              if (tabFilteredOcorrencias.length > 0) {
                renderOcorrencias(containerId, tabFilteredOcorrencias);
              } else {
                container.innerHTML =
                  '<div class="no-data">Nenhuma ocorrência encontrada para o termo "' +
                  searchTerm +
                  '".</div>';
              }
            }
          })
          .catch((error) => {
            console.error("Erro ao buscar ocorrências:", error);
            if (container) {
              container.innerHTML =
                '<div class="error-message">Erro ao buscar ocorrências. Por favor, tente novamente.</div>';
            }

            // Mostrar popup de erro
            showErrorMessage(
              "Erro ao buscar ocorrências. Por favor, tente novamente."
            );
          });
      } catch (error) {
        console.error("Erro ao processar busca:", error);
        showErrorMessage(
          "Ocorreu um erro ao processar sua busca. Por favor, tente novamente."
        );
      }
    });

    // Adicionar evento para buscar ao pressionar Enter
    adminSearch.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        adminSearchBtn.click();
      }
    });
  }

  // Filtro de data
  if (dateFilter) {
    dateFilter.addEventListener("change", function () {
      try {
        const activeTab = document
          .querySelector(".nav-item.active")
          .getAttribute("data-tab");

        if (activeTab !== "settings") {
          loadTabData(activeTab);
        }
      } catch (error) {
        console.error("Erro ao aplicar filtro de data:", error);
        showErrorMessage(
          "Erro ao aplicar filtro de data. Por favor, tente novamente."
        );
      }
    });
  }

  // Se houver configurações salvas, aplicá-las
  const saveSettingsBtn = document.querySelector(".save-settings-btn");
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", function () {
      showSuccessMessage("Configurações salvas com sucesso!");
    });
  }
});
