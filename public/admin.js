document.addEventListener("DOMContentLoaded", function () {
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
  const modalCloseBtn = document.querySelector(".modal-content .close");
  const modalCloseButton = document.querySelector(".modal-content .close-btn");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const statusSelect = document.getElementById("status-select");
  const updateStatusBtn = document.getElementById("update-status-btn");

  // Current occurrence being viewed
  let currentOccurrence = null;

  // ----- Authentication functions -----

  // Handle login attempt
  if (loginButton) {
    loginButton.addEventListener("click", function () {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        loginError.textContent = "Por favor, preencha todos os campos.";
        return;
      }

      // Show loading state
      loginButton.textContent = "Entrando...";
      loginButton.disabled = true;
      loginError.textContent = "";

      // Sign in with Firebase Auth
      firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Login successful
          const user = userCredential.user;
          console.log("Login successful for:", user.email);

          // Switch to dashboard view
          loginContainer.style.display = "none";
          adminDashboard.style.display = "block";

          // Set user email in header
          userEmail.textContent = user.email;

          // Load dashboard data
          loadDashboardData();
        })
        .catch((error) => {
          // Handle errors
          console.error("Login error:", error.code, error.message);

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
          // Reset button state
          loginButton.textContent = "Entrar";
          loginButton.disabled = false;
        });
    });
  }

  // Handle logout
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      firebase
        .auth()
        .signOut()
        .then(() => {
          // Sign-out successful
          adminDashboard.style.display = "none";
          loginContainer.style.display = "block";

          // Clear login form
          emailInput.value = "";
          passwordInput.value = "";
        })
        .catch((error) => {
          console.error("Logout error:", error);
          alert("Erro ao fazer logout. Tente novamente.");
        });
    });
  }

  // Check authentication state on page load
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      loginContainer.style.display = "none";
      adminDashboard.style.display = "block";
      userEmail.textContent = user.email;

      // Load dashboard data
      loadDashboardData();
    } else {
      // User is signed out
      loginContainer.style.display = "block";
      adminDashboard.style.display = "none";
    }
  });

  // ----- Dashboard functions -----

  // Tab navigation
  navItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remove active class from all items
      navItems.forEach((nav) => nav.classList.remove("active"));

      // Add active class to clicked item
      this.classList.add("active");

      // Hide all tab contents
      tabContents.forEach((tab) => (tab.style.display = "none"));

      // Show selected tab content
      const tabId = this.getAttribute("data-tab") + "-tab";
      document.getElementById(tabId).style.display = "block";

      // Refresh data for the tab
      loadTabData(this.getAttribute("data-tab"));
    });
  });

  // Load all dashboard data
  function loadDashboardData() {
    // Get all occurrences from Firebase
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

          // Update stats counters
          updateStats(ocorrencias);

          // Load data for the active tab
          const activeTab = document
            .querySelector(".nav-item.active")
            .getAttribute("data-tab");
          loadTabData(activeTab, ocorrencias);
        }
      })
      .catch((error) => {
        console.error("Error loading dashboard data:", error);
        alert("Erro ao carregar dados. Por favor, recarregue a página.");
      });
  }

  // Update dashboard statistics
  function updateStats(ocorrencias) {
    const stats = {
      pending: 0,
      analysis: 0,
      completed: 0,
      canceled: 0,
    };

    ocorrencias.forEach((ocorrencia) => {
      if (ocorrencia.status === "Pendente") {
        stats.pending++;
      } else if (ocorrencia.status === "Em Análise") {
        stats.analysis++;
      } else if (ocorrencia.status === "Concluído") {
        stats.completed++;
      } else if (ocorrencia.status === "Cancelado") {
        stats.canceled++;
      }
    });

    // Update UI counters
    pendingCount.textContent = stats.pending;
    analysisCount.textContent = stats.analysis;
    completedCount.textContent = stats.completed;
    canceledCount.textContent = stats.canceled;
  }

  // Load data for specific tab
  function loadTabData(tabName, cachedData = null) {
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

    // Show loading
    container.innerHTML =
      '<div class="loading-data">Carregando ocorrências...</div>';

    // Use cached data if provided, otherwise fetch from Firebase
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
        // Filter by tab
        let filteredOcorrencias;

        if (tabName === "pending") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Pendente"
          );
        } else if (tabName === "in-analysis") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Em Análise"
          );
        } else if (tabName === "completed") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Concluído"
          );
        } else if (tabName === "canceled") {
          filteredOcorrencias = ocorrencias.filter(
            (o) => o.status === "Cancelado"
          );
        } else {
          filteredOcorrencias = ocorrencias;
        }

        // Apply date filter if selected
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

        // Sort by timestamp (newest first)
        filteredOcorrencias.sort((a, b) => b.timestamp - a.timestamp);

        // Render occurrences
        renderOcorrencias(containerId, filteredOcorrencias);
      })
      .catch((error) => {
        console.error("Error loading tab data:", error);
        container.innerHTML =
          '<div class="error-message">Erro ao carregar dados. Por favor, tente novamente.</div>';
      });
  }

  // Render occurrences in a container
  function renderOcorrencias(containerId, ocorrencias) {
    const container = document.getElementById(containerId);

    if (!container) return;

    // Clear container
    container.innerHTML = "";

    if (ocorrencias.length === 0) {
      container.innerHTML =
        '<div class="no-data">Nenhuma ocorrência encontrada.</div>';
      return;
    }

    // Create card for each occurrence
    ocorrencias.forEach((ocorrencia) => {
      const card = createOcorrenciaCard(ocorrencia);
      container.appendChild(card);
    });
  }

  // Create a card element for an occurrence
  function createOcorrenciaCard(ocorrencia) {
    const card = document.createElement("div");
    card.className = `admin-card status-${ocorrencia.status.replace(" ", "-")}`;
    card.setAttribute("data-id", ocorrencia.occurrenceNumber);

    const dataOcorrencia = new Date(ocorrencia.timestamp).toLocaleDateString(
      "pt-BR"
    );
    const horaOcorrencia = new Date(ocorrencia.timestamp).toLocaleTimeString(
      "pt-BR"
    );

    card.innerHTML = `
        <div class="card-header">
          <div class="card-number">${ocorrencia.occurrenceNumber}</div>
          <div class="card-status ${ocorrencia.status.replace(" ", "-")}">${
      ocorrencia.status
    }</div>
        </div>
        <div class="card-body">
          <div class="card-info"><span>Nome:</span> ${ocorrencia.nome}</div>
          <div class="card-info"><span>CPF:</span> ${ocorrencia.cpf}</div>
          <div class="card-info"><span>Data:</span> ${dataOcorrencia} ${horaOcorrencia}</div>
          <div class="card-info"><span>Local:</span> ${
            ocorrencia.enderecoOcorrencia
          }</div>
        </div>
        <div class="card-actions">
          <button class="view-btn" data-id="${
            ocorrencia.occurrenceNumber
          }">Ver Detalhes</button>
        </div>
      `;

    // Add click event to view details button
    const viewBtn = card.querySelector(".view-btn");
    viewBtn.addEventListener("click", () => {
      viewOcorrenciaDetails(ocorrencia.occurrenceNumber);
    });

    return card;
  }

  // Function to upload certidão
  async function uploadCertidao(occurrenceNumber, certidaoFile) {
    try {
      // Referência para o storage no Firebase
      const storageRef = firebase
        .storage()
        .ref(`ocorrencias/${occurrenceNumber}/certidao/${certidaoFile.name}`);

      // Upload do arquivo
      await storageRef.put(certidaoFile);

      // Obter a URL de download
      const downloadURL = await storageRef.getDownloadURL();

      // Retornar os dados do arquivo
      return {
        nome: certidaoFile.name,
        url: downloadURL,
        dataUpload: Date.now(),
      };
    } catch (error) {
      console.error("Erro ao fazer upload da certidão:", error);
      throw error;
    }
  }

  // Função para enviar e-mail usando Firebase Functions
  async function enviarEmailCertidao(
    email,
    nome,
    occurrenceNumber,
    certidaoURL
  ) {
    try {
      // Exemplo de integração com Firebase Functions
      const enviarEmailFunction = firebase
        .functions()
        .httpsCallable("enviarEmailCertidao");
      await enviarEmailFunction({
        destinatario: email,
        nome: nome,
        numeroOcorrencia: occurrenceNumber,
        certidaoURL: certidaoURL,
      });

      console.log("E-mail enviado com sucesso para:", email);
      return true;
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      throw error;
    }
  }

  // Função para enviar e-mail manualmente
  async function enviarEmailManualmente(occurrenceNumber) {
    try {
      // Mostrar feedback de carregamento
      const sendEmailBtn = document.querySelector(".send-email-btn");
      if (sendEmailBtn) {
        sendEmailBtn.textContent = "Enviando...";
        sendEmailBtn.disabled = true;
      }

      // Obter os dados da ocorrência
      const ocorrenciaSnapshot = await database
        .ref("ocorrencias/" + occurrenceNumber)
        .once("value");
      const ocorrencia = ocorrenciaSnapshot.val();

      if (!ocorrencia || !ocorrencia.certidao || !ocorrencia.certidao.url) {
        alert("Não é possível enviar o e-mail porque não há certidão anexada.");
        if (sendEmailBtn) {
          sendEmailBtn.textContent = "Reenviar E-mail";
          sendEmailBtn.disabled = false;
        }
        return;
      }

      // Chamar a função do Firebase Functions para enviar o e-mail
      const enviarEmailFunction = firebase
        .functions()
        .httpsCallable("enviarEmailCertidao");
      await enviarEmailFunction({
        destinatario: ocorrencia.email,
        nome: ocorrencia.nome,
        numeroOcorrencia: occurrenceNumber,
        certidaoURL: ocorrencia.certidao.url,
      });

      // Atualizar a interface
      alert("E-mail enviado com sucesso para " + ocorrencia.email);

      // Recarregar os detalhes para atualizar a seção de e-mail
      viewOcorrenciaDetails(occurrenceNumber);
    } catch (error) {
      console.error("Erro ao enviar e-mail manualmente:", error);
      alert("Erro ao enviar e-mail: " + error.message);

      // Restaurar o botão
      const sendEmailBtn = document.querySelector(".send-email-btn");
      if (sendEmailBtn) {
        sendEmailBtn.textContent = "Reenviar E-mail";
        sendEmailBtn.disabled = false;
      }
    }
  }

  // Adicione ao escopo global para que possa ser chamado pelos botões
  window.enviarEmailManualmente = enviarEmailManualmente;

  // View occurrence details
  function viewOcorrenciaDetails(occurrenceNumber) {
    // Get occurrence data from Firebase
    database
      .ref("ocorrencias/" + occurrenceNumber)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          const ocorrencia = snapshot.val();
          currentOccurrence = occurrenceNumber;

          // Update modal title
          modalTitle.textContent = `Detalhes da Ocorrência: ${occurrenceNumber}`;

          // Update status select value
          statusSelect.value = ocorrencia.status;

          // Format dates
          const dataOcorrencia = new Date(
            ocorrencia.dataOcorrencia
          ).toLocaleDateString("pt-BR");
          const dataNascimento = new Date(
            ocorrencia.dataNascimento
          ).toLocaleDateString("pt-BR");
          const dataTimestamp = new Date(ocorrencia.timestamp).toLocaleString(
            "pt-BR"
          );

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
                  <p><strong>Data de upload:</strong> ${new Date(
                    ocorrencia.certidao.dataUpload
                  ).toLocaleString("pt-BR")}</p>
                  <p><a href="${
                    ocorrencia.certidao.url
                  }" target="_blank" class="download-btn">Visualizar/Baixar Certidão</a></p>
                </div>
              </div>
            `;

            // Se já existe certidão e o status é "Concluído", ocultar o campo de upload
            if (ocorrencia.status === "Concluído") {
              document.getElementById(
                "certidao-upload-container"
              ).style.display = "none";
            } else {
              document.getElementById(
                "certidao-upload-container"
              ).style.display = "block";
            }
          } else {
            // Se não existe certidão, mostrar o campo de upload
            document.getElementById("certidao-upload-container").style.display =
              "block";
          }

          // Verificar se o e-mail foi enviado
          let emailSection = "";
          if (ocorrencia.emailEnviado) {
            const emailStatus = ocorrencia.emailEnviado.success
              ? '<span class="status-badge concluído">Enviado com sucesso</span>'
              : '<span class="status-badge cancelado">Falha no envio</span>';

            const dataEnvio = new Date(
              ocorrencia.emailEnviado.timestamp
            ).toLocaleString("pt-BR");

            // Botão de reenvio, só aparece se a certidão estiver anexada
            const reenvioBtn =
              ocorrencia.certidao && ocorrencia.certidao.url
                ? `<button onclick="enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn">Reenviar E-mail</button>`
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
                  <button onclick="enviarEmailManualmente('${occurrenceNumber}')" class="send-email-btn">Enviar E-mail</button>
                </div>
              </div>
            `;
          }

          // Build modal content
          const content = `
              <div class="modal-section">
                <div class="section-title">Status Atual: <span class="card-status ${ocorrencia.status.replace(
                  " ",
                  "-"
                )}">${ocorrencia.status}</span></div>
                <p>Solicitação criada em: ${dataTimestamp}</p>
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
                    <p>${ocorrencia.cpf}</p>
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
                    <p>${ocorrencia.telefone}</p>
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
                    <p>${ocorrencia.descricao}</p>
                  </div>
                </div>
              </div>
              
              <div class="modal-section">
                <div class="section-title">Documentos Anexados</div>
                ${getDocumentosHTML(ocorrencia.documentos)}
              </div>
            `;

          // Update modal body
          modalBody.innerHTML = content;

          // Show modal
          detailModal.style.display = "flex";
        } else {
          alert("Ocorrência não encontrada!");
        }
      })
      .catch((error) => {
        console.error("Error loading occurrence details:", error);
        alert("Erro ao carregar detalhes da ocorrência.");
      });
  }

  // Format documents HTML
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
            <ul>
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

  // Update occurrence status
  if (updateStatusBtn) {
    updateStatusBtn.addEventListener("click", async function () {
      if (!currentOccurrence) return;

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
            alert(
              "Por favor, anexe a certidão antes de concluir a solicitação."
            );
            updateStatusBtn.textContent = "Atualizar";
            updateStatusBtn.disabled = false;
            return;
          }

          // Fazer upload da certidão
          const certidaoFile = certidaoFileInput.files[0];
          const certidaoData = await uploadCertidao(
            currentOccurrence,
            certidaoFile
          );

          // Obter os dados da ocorrência para acessar o e-mail do solicitante
          const ocorrenciaSnapshot = await database
            .ref("ocorrencias/" + currentOccurrence)
            .once("value");
          const ocorrenciaData = ocorrenciaSnapshot.val();

          // Atualizar o status e incluir os dados da certidão
          await database.ref("ocorrencias/" + currentOccurrence).update({
            status: newStatus,
            certidao: certidaoData,
            dataAtualizacao: Date.now(),
          });

          // Enviar e-mail com a certidão para o solicitante
          await enviarEmailCertidao(
            ocorrenciaData.email,
            ocorrenciaData.nome,
            currentOccurrence,
            certidaoData.url
          );

          alert("Status atualizado e e-mail enviado com sucesso!");
        } else {
          // Se não for "Concluído", apenas atualizar o status
          await database.ref("ocorrencias/" + currentOccurrence).update({
            status: newStatus,
            dataAtualizacao: Date.now(),
          });

          alert("Status atualizado com sucesso!");
        }

        // Fechar modal
        detailModal.style.display = "none";

        // Recarregar dados do dashboard
        loadDashboardData();
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Erro ao atualizar status: " + error.message);
      } finally {
        // Restaurar estado do botão
        updateStatusBtn.textContent = "Atualizar";
        updateStatusBtn.disabled = false;
      }
    });
  }

  // Modal close handlers
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

  // Close modal when clicking outside
  window.addEventListener("click", function (event) {
    if (event.target === detailModal) {
      detailModal.style.display = "none";
    }
  });

  // Search functionality
  if (adminSearchBtn) {
    adminSearchBtn.addEventListener("click", function () {
      const searchTerm = adminSearch.value.trim().toLowerCase();

      if (!searchTerm) {
        loadDashboardData();
        return;
      }

      // Get all occurrences and filter by search term
      database
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

          // Filter by search term (number, name, or CPF)
          const filteredOcorrencias = ocorrencias.filter(
            (o) =>
              o.occurrenceNumber.toLowerCase().includes(searchTerm) ||
              o.nome.toLowerCase().includes(searchTerm) ||
              o.cpf.includes(searchTerm)
          );

          // Update stats with filtered data
          updateStats(ocorrencias);

          // Show results in the active tab
          const activeTab = document
            .querySelector(".nav-item.active")
            .getAttribute("data-tab");

          // Override loadTabData to use the filtered results
          loadTabData(activeTab, filteredOcorrencias);
        })
        .catch((error) => {
          console.error("Error searching occurrences:", error);
          alert("Erro ao buscar ocorrências. Por favor, tente novamente.");
        });
    });
  }

  // Date filter change handler
  if (dateFilter) {
    dateFilter.addEventListener("change", function () {
      const activeTab = document
        .querySelector(".nav-item.active")
        .getAttribute("data-tab");
      loadTabData(activeTab);
    });
  }

  // Handler para quando o status for alterado no select
  if (statusSelect) {
    statusSelect.addEventListener("change", function () {
      const newStatus = statusSelect.value;
      const certidaoUploadContainer = document.getElementById(
        "certidao-upload-container"
      );

      // Se o novo status for "Concluído", mostrar o campo de upload da certidão
      if (newStatus === "Concluído") {
        certidaoUploadContainer.style.display = "block";

        // Verificar se já existe certidão
        database
          .ref("ocorrencias/" + currentOccurrence + "/certidao")
          .once("value")
          .then((snapshot) => {
            if (snapshot.exists()) {
              const certificado = snapshot.val();
              alert(
                `Já existe uma certidão anexada (${certificado.nome}). Você pode manter a atual ou fazer upload de uma nova.`
              );
            }
          });
      } else {
        // Se não for "Concluído", não é necessário mostrar o campo de upload
        certidaoUploadContainer.style.display = "none";
      }
    });
  }

  // Adicionar listener para visualizar arquivo de certidão antes do upload
  const certidaoFileInput = document.getElementById("certidao-file");
  if (certidaoFileInput) {
    certidaoFileInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        const fileName = this.files[0].name;
        const fileSize = (this.files[0].size / 1024 / 1024).toFixed(2); // em MB

        // Mostrar informações do arquivo
        const fileInfoContainer = document.createElement("div");
        fileInfoContainer.className = "file-info";
        fileInfoContainer.innerHTML = `
          <p><strong>Arquivo selecionado:</strong> ${fileName}</p>
          <p><strong>Tamanho:</strong> ${fileSize} MB</p>
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

  // Verificar leitura de notificações
  function verificarNotificacoesLidas() {
    // Obter usuário atual
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Referência para notificações
    const notificacoesRef = database.ref("notificacoes");

    // Obter todas as notificações não lidas para este usuário
    notificacoesRef
      .orderByChild("lida")
      .equalTo(false)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          let count = 0;

          snapshot.forEach((childSnapshot) => {
            const notificacao = childSnapshot.val();

            // Verificar se a notificação é para todos ou para este usuário específico
            if (
              notificacao.destinatario === "todos" ||
              notificacao.destinatario === user.email
            ) {
              count++;
            }
          });

          // Atualizar contador na interface, se necessário
          if (count > 0) {
            // Aqui você pode adicionar um indicador visual de notificações não lidas
            console.log(`Você tem ${count} notificações não lidas`);
          }
        }
      })
      .catch((error) => {
        console.error("Erro ao verificar notificações:", error);
      });
  }

  // Executar verificação de notificações após login bem-sucedido
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      verificarNotificacoesLidas();
    }
  });

  // Verificar notificações a cada 5 minutos (opcional)
  setInterval(() => {
    const user = firebase.auth().currentUser;
    if (user) {
      verificarNotificacoesLidas();
    }
  }, 5 * 60 * 1000);

  // Exportar certidões concluídas (opcional)
  function exportarCertidoesConcluidas() {
    // Obter todas as ocorrências concluídas com certidão
    database
      .ref("ocorrencias")
      .orderByChild("status")
      .equalTo("Concluído")
      .once("value")
      .then((snapshot) => {
        if (!snapshot.exists()) {
          alert("Não há certidões concluídas para exportar.");
          return;
        }

        const certidoesConcluidas = [];

        snapshot.forEach((childSnapshot) => {
          const ocorrencia = childSnapshot.val();

          if (ocorrencia.certidao && ocorrencia.certidao.url) {
            certidoesConcluidas.push({
              numero: ocorrencia.occurrenceNumber,
              solicitante: ocorrencia.nome,
              cpf: ocorrencia.cpf,
              dataOcorrencia: new Date(
                ocorrencia.dataOcorrencia
              ).toLocaleDateString("pt-BR"),
              dataConclusao: ocorrencia.dataAtualizacao
                ? new Date(ocorrencia.dataAtualizacao).toLocaleDateString(
                    "pt-BR"
                  )
                : "N/A",
              urlCertidao: ocorrencia.certidao.url,
            });
          }
        });

        if (certidoesConcluidas.length === 0) {
          alert(
            "Não há certidões concluídas com arquivos anexados para exportar."
          );
          return;
        }

        // Criar CSV
        let csvContent =
          "Número,Solicitante,CPF,Data da Ocorrência,Data de Conclusão,URL da Certidão\n";

        certidoesConcluidas.forEach((certidao) => {
          csvContent += `${certidao.numero},${certidao.solicitante},${certidao.cpf},${certidao.dataOcorrencia},${certidao.dataConclusao},${certidao.urlCertidao}\n`;
        });

        // Criar blob e link de download
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
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
      })
      .catch((error) => {
        console.error("Erro ao exportar certidões:", error);
        alert("Erro ao exportar certidões. Por favor, tente novamente.");
      });
  }

  // Adicionar ao escopo global para uso em botões
  window.exportarCertidoesConcluidas = exportarCertidoesConcluidas;

  // Validação de arquivos antes do upload
  function validarArquivoCertidao(file) {
    // Verificar tipo de arquivo
    const tiposPermitidos = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!tiposPermitidos.includes(file.type)) {
      alert("Tipo de arquivo não permitido. Por favor, use PDF, JPG ou PNG.");
      return false;
    }

    // Verificar tamanho (máximo 10MB)
    const tamanhoMaximo = 10 * 1024 * 1024; // 10MB em bytes
    if (file.size > tamanhoMaximo) {
      alert(
        `O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(
          2
        )}MB). O tamanho máximo permitido é 10MB.`
      );
      return false;
    }

    return true;
  }

  // Se o certidão-file existir, adicionar validação
  if (certidaoFileInput) {
    certidaoFileInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];

        if (!validarArquivoCertidao(file)) {
          // Limpar seleção se for inválido
          this.value = "";

          // Remover informações de arquivo se existirem
          const existingInfo = document.querySelector(".file-info");
          if (existingInfo) {
            existingInfo.remove();
          }
        }
      }
    });
  }
});
