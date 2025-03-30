document.addEventListener("DOMContentLoaded", function () {
  const formulario = document.getElementById("calc-form");
  const nomeInput = document.getElementById("nome");
  const nomeError = document.getElementById("nome-error");
  const datasolicitacaoInput = document.getElementById("datasolicitacao");
  const datasolicitacaoError = document.getElementById("datasolicitacao-error");

  // Preencher a data de solicitação automaticamente com a data atual
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString("pt-BR");
  datasolicitacaoInput.value = dataFormatada;

  // Tab functionality
  window.openTab = function (tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
      tabContents[i].style.display = "none";
    }

    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.remove("active");
    }

    document.getElementById(tabName).style.display = "block";
    event.currentTarget.classList.add("active");
  };

  // Form submission handling
  if (formulario) {
    formulario.addEventListener("submit", async function (event) {
      event.preventDefault();

      // Validação do NOME
      if (!nomeInput.value) {
        nomeError.style.display = "block";
        return;
      } else {
        nomeError.style.display = "none";
      }

      // Validação da data de solicitação
      if (!datasolicitacaoInput.value) {
        datasolicitacaoError.style.display = "block";
        return;
      } else {
        datasolicitacaoError.style.display = "none";
      }

      // Mostrar indicador de carregamento
      const submitButton = formulario.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.textContent = "Enviando...";
      submitButton.disabled = true;

      try {
        // Preparar dados do formulário
        const formData = {
          datasolicitacao: datasolicitacaoInput.value,
          nome: nomeInput.value,
          cpf: document.getElementById("cpf").value,
          rg: document.getElementById("rg").value,
          dataNascimento: document.getElementById("dataNascimento").value,
          email: document.getElementById("email").value,
          telefone: document.getElementById("telefone").value,
          dataOcorrencia: document.getElementById("dataOcorrencia").value,
          enderecoOcorrencia:
            document.getElementById("enderecoOcorrencia").value,
          descricao: document.getElementById("descricao").value,
          timestamp: Date.now(),
          status: "Pendente", // Status inicial da solicitação
        };

        // Gerar um ID único para a ocorrência
        const occurrenceNumber = "OCR-" + Date.now().toString().slice(-6);
        formData.occurrenceNumber = occurrenceNumber;

        // Salvar arquivos no Firebase Storage e obter URLs
        const fileUrls = await uploadFilesToFirebase(occurrenceNumber);
        formData.documentos = fileUrls;

        // Salvar dados no Firebase Realtime Database
        await database.ref("ocorrencias/" + occurrenceNumber).set(formData);

        // Exibir mensagem de sucesso
        alert(
          `${formData.nome}, sua solicitação foi recebida com sucesso! Seu número de ocorrência é: ${occurrenceNumber}. Em breve entraremos em contato pelo e-mail ou telefone informados.`
        );

        // Limpar o formulário após envio bem-sucedido
        formulario.reset();

        // Restaurar a data atual após reset
        datasolicitacaoInput.value = dataFormatada;
      } catch (error) {
        console.error("Erro:", error);
        alert(
          "Houve um erro ao enviar o formulário. Por favor, tente novamente mais tarde."
        );
      } finally {
        // Restaurar o botão
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
      }
    });
  }

  // Função para fazer upload de arquivos para o Firebase Storage
  async function uploadFilesToFirebase(occurrenceNumber) {
    const fileUrls = {};

    // Função auxiliar para fazer upload de um arquivo
    const uploadFile = async (fileInput, fileType) => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const storageRef = storage.ref(
          `ocorrencias/${occurrenceNumber}/${fileType}/${file.name}`
        );
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();
        return {
          nome: file.name,
          url: downloadURL,
        };
      }
      return null;
    };

    // Upload do documento de identidade
    const docIdentidade = await uploadFile(
      document.getElementById("documentoIdentidade"),
      "identidade"
    );
    if (docIdentidade) fileUrls.documentoIdentidade = docIdentidade;

    // Upload do comprovante de residência
    const comprovanteResidencia = await uploadFile(
      document.getElementById("comprovanteResidencia"),
      "residencia"
    );
    if (comprovanteResidencia)
      fileUrls.comprovanteResidencia = comprovanteResidencia;

    // Upload do documento do carro
    const documentoCarro = await uploadFile(
      document.getElementById("documentoCarro"),
      "carro"
    );
    if (documentoCarro) fileUrls.documentoCarro = documentoCarro;

    // Upload de outros documentos (múltiplos)
    const outrosDocumentosInput = document.getElementById("outrosDocumentos");
    if (outrosDocumentosInput.files.length > 0) {
      fileUrls.outrosDocumentos = [];

      for (let i = 0; i < outrosDocumentosInput.files.length; i++) {
        const file = outrosDocumentosInput.files[i];
        const storageRef = storage.ref(
          `ocorrencias/${occurrenceNumber}/outros/${file.name}`
        );
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();

        fileUrls.outrosDocumentos.push({
          nome: file.name,
          url: downloadURL,
        });
      }
    }

    return fileUrls;
  }

  // Consulta tab functionality
  const searchButton = document.getElementById("search-button");
  const statusFilter = document.getElementById("status-filter");

  if (searchButton) {
    searchButton.addEventListener("click", function () {
      searchOcorrencias();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", function () {
      loadOcorrencias();
    });
  }

  // Function to load all occurrences or filtered ones
  function loadOcorrencias() {
    const statusFilter = document.getElementById("status-filter").value;
    const ocorrenciasContainer = document.getElementById(
      "ocorrencias-container"
    );

    ocorrenciasContainer.innerHTML =
      '<div class="loading">Carregando ocorrências...</div>';

    let query = database.ref("ocorrencias");

    query
      .once("value")
      .then((snapshot) => {
        ocorrenciasContainer.innerHTML = "";

        if (!snapshot.exists()) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results">Nenhuma ocorrência encontrada.</div>';
          return;
        }

        const ocorrencias = [];
        snapshot.forEach((childSnapshot) => {
          const ocorrencia = childSnapshot.val();
          ocorrencias.push(ocorrencia);
        });

        // Filter by status if needed
        const filteredOcorrencias =
          statusFilter === "todos"
            ? ocorrencias
            : ocorrencias.filter((o) => o.status === statusFilter);

        if (filteredOcorrencias.length === 0) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results">Nenhuma ocorrência encontrada com os filtros selecionados.</div>';
          return;
        }

        // Sort by timestamp (newest first)
        filteredOcorrencias.sort((a, b) => b.timestamp - a.timestamp);

        // Create cards for each occurrence
        filteredOcorrencias.forEach((ocorrencia) => {
          const card = createOcorrenciaCard(ocorrencia);
          ocorrenciasContainer.appendChild(card);
        });
      })
      .catch((error) => {
        console.error("Erro ao carregar ocorrências:", error);
        ocorrenciasContainer.innerHTML =
          '<div class="error">Erro ao carregar ocorrências. Por favor, tente novamente.</div>';
      });
  }

  // Function to search for specific occurrences
  function searchOcorrencias() {
    const searchInput = document.getElementById("search-input").value.trim();
    const searchFilter = document.getElementById("search-filter").value;
    const statusFilter = document.getElementById("status-filter").value;
    const ocorrenciasContainer = document.getElementById(
      "ocorrencias-container"
    );

    if (!searchInput) {
      loadOcorrencias();
      return;
    }

    ocorrenciasContainer.innerHTML =
      '<div class="loading">Buscando ocorrências...</div>';

    let query = database.ref("ocorrencias");

    query
      .once("value")
      .then((snapshot) => {
        ocorrenciasContainer.innerHTML = "";

        if (!snapshot.exists()) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results">Nenhuma ocorrência encontrada.</div>';
          return;
        }

        const ocorrencias = [];
        snapshot.forEach((childSnapshot) => {
          const ocorrencia = childSnapshot.val();
          ocorrencias.push(ocorrencia);
        });

        // Filter by search criteria and status
        let filteredOcorrencias = ocorrencias.filter((ocorrencia) => {
          const matchesSearch =
            searchFilter === "occurrenceNumber"
              ? ocorrencia.occurrenceNumber
                  .toLowerCase()
                  .includes(searchInput.toLowerCase())
              : ocorrencia.cpf.includes(searchInput);

          const matchesStatus =
            statusFilter === "todos" || ocorrencia.status === statusFilter;

          return matchesSearch && matchesStatus;
        });

        if (filteredOcorrencias.length === 0) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results">Nenhuma ocorrência encontrada com os critérios de busca selecionados.</div>';
          return;
        }

        // Sort by timestamp (newest first)
        filteredOcorrencias.sort((a, b) => b.timestamp - a.timestamp);

        // Create cards for each occurrence
        filteredOcorrencias.forEach((ocorrencia) => {
          const card = createOcorrenciaCard(ocorrencia);
          ocorrenciasContainer.appendChild(card);
        });
      })
      .catch((error) => {
        console.error("Erro ao buscar ocorrências:", error);
        ocorrenciasContainer.innerHTML =
          '<div class="error">Erro ao buscar ocorrências. Por favor, tente novamente.</div>';
      });
  }

  // Function to create a card for each occurrence
  function createOcorrenciaCard(ocorrencia) {
    const card = document.createElement("div");
    card.className = "ocorrencia-card";
    card.setAttribute("data-id", ocorrencia.occurrenceNumber);

    // Set different color based on status
    card.classList.add(
      `status-${ocorrencia.status.toLowerCase().replace(" ", "-")}`
    );

    const dataOcorrencia = new Date(ocorrencia.timestamp).toLocaleDateString(
      "pt-BR"
    );

    card.innerHTML = `
        <div class="card-header">
          <h3>${ocorrencia.occurrenceNumber}</h3>
          <span class="status-badge ${ocorrencia.status
            .toLowerCase()
            .replace(" ", "-")}">${ocorrencia.status}</span>
        </div>
        <div class="card-body">
          <p><strong>Solicitante:</strong> ${ocorrencia.nome}</p>
          <p><strong>CPF:</strong> ${ocorrencia.cpf}</p>
          <p><strong>Data da Solicitação:</strong> ${
            ocorrencia.datasolicitacao
          }</p>
          <p><strong>Data da Ocorrência:</strong> ${
            ocorrencia.dataOcorrencia
          }</p>
          <p><strong>Local:</strong> ${ocorrencia.enderecoOcorrencia}</p>
          <button class="view-details-btn" onclick="viewOcorrenciaDetails('${
            ocorrencia.occurrenceNumber
          }')">Ver Detalhes</button>
        </div>
      `;

    return card;
  }

  // Make view details function available globally
  window.viewOcorrenciaDetails = function (occurrenceNumber) {
    database
      .ref("ocorrencias/" + occurrenceNumber)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          const ocorrencia = snapshot.val();
          showDetailsModal(ocorrencia);
        } else {
          alert("Ocorrência não encontrada!");
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar detalhes:", error);
        alert(
          "Erro ao carregar detalhes da ocorrência. Por favor, tente novamente."
        );
      });
  };

  // Function to display details modal
  function showDetailsModal(ocorrencia) {
    // Create modal container
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";

    // Format dates for display
    const dataOcorrenciaFormatada = new Date(
      ocorrencia.dataOcorrencia
    ).toLocaleDateString("pt-BR");
    const dataNascimentoFormatada = new Date(
      ocorrencia.dataNascimento
    ).toLocaleDateString("pt-BR");

    modalContent.innerHTML = `
        <div class="modal-header">
          <h2>Detalhes da Ocorrência ${ocorrencia.occurrenceNumber}</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="status-section">
            <h3>Status: <span class="status-badge ${ocorrencia.status
              .toLowerCase()
              .replace(" ", "-")}">${ocorrencia.status}</span></h3>
          </div>
          
          <div class="info-section">
            <h3>Informações do Solicitante</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Nome:</label>
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
                <p>${dataNascimentoFormatada}</p>
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
          
          <div class="ocorrencia-section">
            <h3>Informações da Ocorrência</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Data da Ocorrência:</label>
                <p>${dataOcorrenciaFormatada}</p>
              </div>
              <div class="info-item">
                <label>Local:</label>
                <p>${ocorrencia.enderecoOcorrencia}</p>
              </div>
              <div class="info-item full-width">
                <label>Descrição:</label>
                <p class="description-text">${ocorrencia.descricao}</p>
              </div>
            </div>
          </div>
          
          <div class="documents-section">
            <h3>Documentos</h3>
            <div class="documents-list">
              ${getDocumentLinks(ocorrencia.documentos)}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="close-btn">Fechar</button>
        </div>
      `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Add event listeners for closing modal
    const closeButton = modalContent.querySelector(".close-btn");
    const closeX = modalContent.querySelector(".close-modal");

    closeButton.addEventListener("click", function () {
      document.body.removeChild(modalOverlay);
    });

    closeX.addEventListener("click", function () {
      document.body.removeChild(modalOverlay);
    });

    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });
  }

  // Helper function to generate document links
  function getDocumentLinks(documentos) {
    if (!documentos) return "<p>Nenhum documento disponível</p>";

    let html = "";

    if (documentos.documentoIdentidade) {
      html += `<div class="document-item">
          <span>Documento de Identidade:</span>
          <a href="${documentos.documentoIdentidade.url}" target="_blank">${documentos.documentoIdentidade.nome}</a>
        </div>`;
    }

    if (documentos.comprovanteResidencia) {
      html += `<div class="document-item">
          <span>Comprovante de Residência:</span>
          <a href="${documentos.comprovanteResidencia.url}" target="_blank">${documentos.comprovanteResidencia.nome}</a>
        </div>`;
    }

    if (documentos.documentoCarro) {
      html += `<div class="document-item">
          <span>Documento do Carro:</span>
          <a href="${documentos.documentoCarro.url}" target="_blank">${documentos.documentoCarro.nome}</a>
        </div>`;
    }

    if (documentos.outrosDocumentos && documentos.outrosDocumentos.length > 0) {
      html += `<div class="document-item">
          <span>Outros Documentos:</span>
          <ul class="other-docs-list">`;

      documentos.outrosDocumentos.forEach((doc) => {
        html += `<li><a href="${doc.url}" target="_blank">${doc.nome}</a></li>`;
      });

      html += `</ul>
        </div>`;
    }

    return html || "<p>Nenhum documento disponível</p>";
  }
});
