document.addEventListener("DOMContentLoaded", function () {
  const formulario = document.getElementById("calc-form");
  const nomeInput = document.getElementById("nome");
  const nomeError = document.getElementById("nome-error");
  const datasolicitacaoInput = document.getElementById("datasolicitacao");
  const datasolicitacaoError = document.getElementById("datasolicitacao-error");

  // Flag para controlar envios múltiplos
  let isSubmitting = false;

  // Preencher a data de solicitação automaticamente com a data atual
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString("pt-BR");
  if (datasolicitacaoInput) {
    datasolicitacaoInput.value = dataFormatada;
  }

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

    // Encontrar o botão correspondente à aba e ativá-lo
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach((button) => {
      if (button.getAttribute("onclick").includes(tabName)) {
        button.classList.add("active");
      }
    });

    // Se a aba for de consulta, mostrar mensagem pedindo CPF
    if (tabName === "consulta-tab") {
      const ocorrenciasContainer = document.getElementById(
        "ocorrencias-container"
      );
      const searchInput = document.getElementById("search-input");

      // Limpar o resultado anterior
      if (ocorrenciasContainer) {
        ocorrenciasContainer.innerHTML =
          '<div class="security-message"><i class="fas fa-lock"></i><p>Por motivos de segurança, você precisa digitar o CPF para visualizar as ocorrências.</p></div>';
      }

      // Focar no campo de busca
      if (searchInput) {
        searchInput.focus();
      }
    }
  };

  // Form submission handling
  if (formulario) {
    formulario.addEventListener("submit", async function (event) {
      event.preventDefault();

      // Previne múltiplos envios
      if (isSubmitting) {
        console.log(
          "Envio de formulário já em andamento. Aguarde a conclusão..."
        );
        return;
      }

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

      // Ativa flag de envio
      isSubmitting = true;

      // Mostrar indicador de carregamento
      const submitButton = formulario.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      submitButton.disabled = true;

      // Adicionar indicador visual de processamento
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "processing-indicator";
      loadingIndicator.innerHTML = `
        <div class="processing-message">
          <i class="fas fa-sync fa-spin"></i>
          <p>Processando sua solicitação. Por favor, aguarde e não feche esta página...</p>
          <div class="progress-bar"><div class="progress-fill"></div></div>
        </div>
      `;

      // Adicionar estilo para o indicador
      const style = document.createElement("style");
      style.textContent = `
        .processing-indicator {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 5px;
          border: 1px solid #dee2e6;
        }
        .processing-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #3498db;
        }
        .processing-message i {
          font-size: 2rem;
          margin-bottom: 10px;
          color: #3498db;
        }
        .progress-bar {
          width: 100%;
          height: 10px;
          background-color: #e9ecef;
          border-radius: 5px;
          margin-top: 15px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          width: 0%;
          background-color: #3498db;
          animation: progress 2s infinite ease-in-out;
        }
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 0%; }
        }
      `;
      document.head.appendChild(style);
      formulario.appendChild(loadingIndicator);

      try {
        // Preparar dados do formulário
        const formData = {
          datasolicitacao: datasolicitacaoInput.value,
          nome: nomeInput.value,
          cpf: document.getElementById("cpf").value,
          rg: document.getElementById("rg").value,
          dataNascimento: document.getElementById("dataNascimento").value,
          enderecoSolicitante: document.getElementById("enderecoSolicitante")
            .value,
          email: document.getElementById("email").value,
          telefone: document.getElementById("telefone").value,
          dataOcorrencia: document.getElementById("dataOcorrencia").value,
          horaOcorrencia: document.getElementById("horaOcorrencia").value,
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

        // Exibir mensagem de sucesso com alerta mais amigável
        showSuccessMessage(
          `${formData.nome}, sua solicitação foi recebida com sucesso!`,
          `Seu número de ocorrência é: <strong>${occurrenceNumber}</strong>. Em breve entraremos em contato pelo e-mail ou telefone informados.`
        );

        // Limpar o formulário após envio bem-sucedido
        formulario.reset();

        // Restaurar a data atual após reset
        datasolicitacaoInput.value = dataFormatada;
      } catch (error) {
        console.error("Erro:", error);
        showErrorMessage(
          "Erro ao enviar formulário",
          "Houve um erro ao enviar o formulário. Por favor, tente novamente mais tarde."
        );
      } finally {
        // Restaurar o botão
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;

        // Remover indicador de carregamento
        if (loadingIndicator && loadingIndicator.parentNode) {
          loadingIndicator.parentNode.removeChild(loadingIndicator);
        }

        // Desativar flag de envio
        isSubmitting = false;
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

  // Funções de notificação
  function showSuccessMessage(title, message) {
    // Criar modal de sucesso
    const modalHTML = `
      <div class="success-modal-overlay">
        <div class="success-modal">
          <div class="success-modal-header">
            <i class="fas fa-check-circle"></i>
            <h3>${title}</h3>
          </div>
          <div class="success-modal-body">
            <p>${message}</p>
          </div>
          <div class="success-modal-footer">
            <button class="close-success-btn">OK</button>
          </div>
        </div>
      </div>
    `;

    // Adicionar estilos se necessário
    const style = document.createElement("style");
    style.textContent = `
      .success-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 0.3s;
      }
      .success-modal {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        width: 90%;
        max-width: 500px;
        animation: slideUp 0.3s;
      }
      .success-modal-header {
        background-color: #10b981;
        color: white;
        padding: 20px;
        border-radius: 8px 8px 0 0;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .success-modal-header i {
        font-size: 2rem;
      }
      .success-modal-header h3 {
        margin: 0;
      }
      .success-modal-body {
        padding: 20px;
      }
      .success-modal-footer {
        padding: 15px 20px;
        text-align: right;
        border-top: 1px solid #e5e7eb;
      }
      .close-success-btn {
        background-color: #10b981;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
      }
      .close-success-btn:hover {
        background-color: #0d9668;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Adicionar modal ao DOM
    const modalElement = document.createElement("div");
    modalElement.innerHTML = modalHTML;
    document.body.appendChild(modalElement);

    // Adicionar evento ao botão de fechar
    const closeBtn = modalElement.querySelector(".close-success-btn");
    closeBtn.addEventListener("click", function () {
      document.body.removeChild(modalElement);
    });
  }

  function showErrorMessage(title, message) {
    // Criar modal de erro
    const modalHTML = `
      <div class="error-modal-overlay">
        <div class="error-modal">
          <div class="error-modal-header">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>${title}</h3>
          </div>
          <div class="error-modal-body">
            <p>${message}</p>
          </div>
          <div class="error-modal-footer">
            <button class="close-error-btn">OK</button>
          </div>
        </div>
      </div>
    `;

    // Adicionar estilos se necessário
    const style = document.createElement("style");
    style.textContent = `
      .error-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 0.3s;
      }
      .error-modal {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        width: 90%;
        max-width: 500px;
        animation: slideUp 0.3s;
      }
      .error-modal-header {
        background-color: #ef4444;
        color: white;
        padding: 20px;
        border-radius: 8px 8px 0 0;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .error-modal-header i {
        font-size: 2rem;
      }
      .error-modal-header h3 {
        margin: 0;
      }
      .error-modal-body {
        padding: 20px;
      }
      .error-modal-footer {
        padding: 15px 20px;
        text-align: right;
        border-top: 1px solid #e5e7eb;
      }
      .close-error-btn {
        background-color: #ef4444;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
      }
      .close-error-btn:hover {
        background-color: #dc2626;
      }
    `;
    document.head.appendChild(style);

    // Adicionar modal ao DOM
    const modalElement = document.createElement("div");
    modalElement.innerHTML = modalHTML;
    document.body.appendChild(modalElement);

    // Adicionar evento ao botão de fechar
    const closeBtn = modalElement.querySelector(".close-error-btn");
    closeBtn.addEventListener("click", function () {
      document.body.removeChild(modalElement);
    });
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
      const searchInput = document.getElementById("search-input").value.trim();
      if (searchInput) {
        searchOcorrencias();
      }
    });
  }

  // Evento para busca ao pressionar Enter no campo de busca
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("keyup", function (e) {
      if (e.key === "Enter") {
        searchOcorrencias();
      }
    });
  }

  // Function to load occurrences - modified for security
  function loadOcorrencias() {
    const statusFilter = document.getElementById("status-filter").value;
    const searchInput = document.getElementById("search-input").value.trim();
    const ocorrenciasContainer = document.getElementById(
      "ocorrencias-container"
    );

    // Limpar qualquer formatação do CPF para busca
    let searchValue = searchInput.replace(/\D/g, "");

    // Se não tiver CPF preenchido, mostrar mensagem para digitar o CPF
    if (!searchValue) {
      ocorrenciasContainer.innerHTML =
        '<div class="security-message"><i class="fas fa-lock"></i><p>Por motivos de segurança, você precisa digitar o CPF para visualizar as ocorrências.</p></div>';
      return;
    }

    // Validar tamanho do CPF
    if (searchValue.length !== 11) {
      ocorrenciasContainer.innerHTML =
        '<div class="no-results"><i class="fas fa-exclamation-circle"></i><p>CPF inválido. Certifique-se de digitar os 11 dígitos.</p></div>';
      return;
    }

    ocorrenciasContainer.innerHTML =
      '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Buscando ocorrências...</p></div>';

    let query = database.ref("ocorrencias");

    query
      .once("value")
      .then((snapshot) => {
        ocorrenciasContainer.innerHTML = "";

        if (!snapshot.exists()) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results"><i class="fas fa-search"></i><p>Nenhuma ocorrência encontrada.</p></div>';
          return;
        }

        const ocorrencias = [];
        snapshot.forEach((childSnapshot) => {
          const ocorrencia = childSnapshot.val();
          ocorrencias.push(ocorrencia);
        });

        // Filter by CPF and status
        let filteredOcorrencias = ocorrencias.filter((ocorrencia) => {
          // Remover formatação do CPF para comparação
          let cpfForComparison = ocorrencia.cpf
            ? ocorrencia.cpf.replace(/\D/g, "")
            : "";

          // Mostrar apenas ocorrências do CPF digitado com o status selecionado
          return (
            cpfForComparison === searchValue &&
            ocorrencia.status === statusFilter
          );
        });

        if (filteredOcorrencias.length === 0) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results"><i class="fas fa-search"></i><p>Nenhuma ocorrência encontrada para o CPF informado com o status selecionado.</p></div>';
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
          '<div class="error"><i class="fas fa-exclamation-triangle"></i><p>Erro ao buscar ocorrências. Por favor, tente novamente.</p></div>';
      });
  }

  // Function to search for specific occurrences
  function searchOcorrencias() {
    const searchInput = document.getElementById("search-input").value.trim();
    const statusFilter = document.getElementById("status-filter").value;
    const ocorrenciasContainer = document.getElementById(
      "ocorrencias-container"
    );

    // Limpar qualquer formatação do CPF para busca (remover pontos e traços)
    let searchValue = searchInput.replace(/\D/g, "");

    if (!searchValue) {
      ocorrenciasContainer.innerHTML =
        '<div class="no-results"><i class="fas fa-exclamation-circle"></i><p>Por favor, digite um CPF válido.</p></div>';
      return;
    }

    // Validar tamanho do CPF
    if (searchValue.length !== 11) {
      ocorrenciasContainer.innerHTML =
        '<div class="no-results"><i class="fas fa-exclamation-circle"></i><p>CPF inválido. Certifique-se de digitar os 11 dígitos.</p></div>';
      return;
    }

    ocorrenciasContainer.innerHTML =
      '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Buscando ocorrências...</p></div>';

    let query = database.ref("ocorrencias");

    query
      .once("value")
      .then((snapshot) => {
        ocorrenciasContainer.innerHTML = "";

        if (!snapshot.exists()) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results"><i class="fas fa-search"></i><p>Nenhuma ocorrência encontrada.</p></div>';
          return;
        }

        const ocorrencias = [];
        snapshot.forEach((childSnapshot) => {
          const ocorrencia = childSnapshot.val();
          ocorrencias.push(ocorrencia);
        });

        // Filter by CPF and status
        let filteredOcorrencias = ocorrencias.filter((ocorrencia) => {
          // Remover formatação do CPF para comparação
          let cpfForComparison = ocorrencia.cpf
            ? ocorrencia.cpf.replace(/\D/g, "")
            : "";

          const matchesCPF = cpfForComparison === searchValue;

          // Mostrar ocorrências pelo CPF e status selecionado
          return matchesCPF && ocorrencia.status === statusFilter;
        });

        if (filteredOcorrencias.length === 0) {
          ocorrenciasContainer.innerHTML =
            '<div class="no-results"><i class="fas fa-search"></i><p>Nenhuma ocorrência encontrada para o CPF informado com o status selecionado.</p></div>';
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
          '<div class="error"><i class="fas fa-exclamation-triangle"></i><p>Erro ao buscar ocorrências. Por favor, tente novamente.</p></div>';
      });
  }

  // Function to create a card for each occurrence
  function createOcorrenciaCard(ocorrencia) {
    const card = document.createElement("div");
    card.className = "ocorrencia-card";
    card.setAttribute("data-id", ocorrencia.occurrenceNumber);

    // Set different color based on status
    card.classList.add(
      `status-${ocorrencia.status
        .toLowerCase()
        .replace(" ", "-")
        .replace("í", "i")}`
    );

    // Formatar data e hora
    const timestamp = ocorrencia.timestamp
      ? new Date(ocorrencia.timestamp)
      : null;
    const dataFormatada = timestamp
      ? timestamp.toLocaleDateString("pt-BR")
      : "Data não disponível";
    const horaFormatada = timestamp
      ? timestamp.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const dataHoraFormatada = `${dataFormatada} ${horaFormatada}`;

    // Verificar se o CPF no campo de busca corresponde ao CPF da ocorrência
    const searchInput = document.getElementById("search-input");
    const isCPFMatch =
      searchInput &&
      ocorrencia.cpf &&
      searchInput.value.replace(/\D/g, "") ===
        ocorrencia.cpf.replace(/\D/g, "");

    // Só mostrar o link da certidão se for o próprio CPF buscando
    const showCertidaoLink = ocorrencia.certidao && isCPFMatch;

    card.innerHTML = `
        <div class="card-header">
          <h3>${ocorrencia.occurrenceNumber}</h3>
          <span class="status-badge ${ocorrencia.status
            .toLowerCase()
            .replace(" ", "-")
            .replace("í", "i")}">${ocorrencia.status}</span>
        </div>
        <div class="card-body">
          <p><strong><i class="fas fa-user"></i> Nome:</strong> ${
            ocorrencia.nome
          }</p>
          <p><strong><i class="fas fa-id-card"></i> CPF:</strong> ${
            ocorrencia.cpf
          }</p>
          <p><strong><i class="fas fa-calendar"></i> Data:</strong> ${dataHoraFormatada}</p>
          <p><strong><i class="fas fa-map-marker-alt"></i> Local:</strong> ${
            ocorrencia.enderecoOcorrencia
          }</p>
          ${
            ocorrencia.certidao
              ? showCertidaoLink
                ? `<p><strong><i class="fas fa-file-pdf"></i> Certidão:</strong> <a href="${ocorrencia.certidao.url}" target="_blank" class="certidao-link"><i class="fas fa-download"></i> Baixar Certidão</a></p>`
                : `<p><strong><i class="fas fa-file-pdf"></i> Certidão:</strong> <span class="certidao-restricted"><i class="fas fa-lock"></i> Disponível apenas para o titular do CPF</span></p>`
              : ""
          }
          <button class="view-details-btn" onclick="viewOcorrenciaDetails('${
            ocorrencia.occurrenceNumber
          }')"><i class="fas fa-eye"></i> Ver Detalhes</button>
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
          showErrorMessage(
            "Ocorrência não encontrada",
            "Não foi possível encontrar os detalhes desta ocorrência."
          );
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar detalhes:", error);
        showErrorMessage(
          "Erro ao carregar detalhes",
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

    const timestamp = ocorrencia.timestamp
      ? new Date(ocorrencia.timestamp)
      : null;
    const dataSolicitacaoFormatada = timestamp
      ? timestamp.toLocaleDateString("pt-BR") +
        " " +
        timestamp.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Data não disponível";

    // Get hora ocorrencia if available
    const horaOcorrencia = ocorrencia.horaOcorrencia || "Não informado";

    // Verificar se o CPF no campo de busca corresponde ao CPF da ocorrência
    const searchInput = document.getElementById("search-input");
    const isCPFMatch =
      searchInput &&
      ocorrencia.cpf &&
      searchInput.value.replace(/\D/g, "") ===
        ocorrencia.cpf.replace(/\D/g, "");

    // Só mostrar o link da certidão se for o próprio CPF buscando
    const showCertidaoLink = ocorrencia.certidao && isCPFMatch;

    modalContent.innerHTML = `
    <div class="modal-header">
      <h2>Detalhes da Ocorrência ${ocorrencia.occurrenceNumber}</h2>
      <span class="close-modal">&times;</span>
    </div>
    <div class="modal-body">
      <div class="status-section">
        <h3>Status: <span class="status-badge ${ocorrencia.status
          .toLowerCase()
          .replace(" ", "-")
          .replace("í", "i")}">${ocorrencia.status}</span></h3>
        ${
          ocorrencia.certidao
            ? showCertidaoLink
              ? `<p><strong>Certidão:</strong> <a href="${ocorrencia.certidao.url}" target="_blank" class="certidao-link"><i class="fas fa-download"></i> Baixar Certidão</a></p>`
              : `<p><strong>Certidão:</strong> <span class="certidao-restricted"><i class="fas fa-lock"></i> Disponível apenas para o titular do CPF</span></p>`
            : "<p><i class='fas fa-info-circle'></i> A certidão será disponibilizada quando o processo for concluído.</p>"
        }
      </div>
      
      <div class="info-section">
        <h3><i class="fas fa-user-circle"></i> Informações do Solicitante</h3>
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
            <label>Endereço:</label>
            <p>${ocorrencia.enderecoSolicitante || "Não informado"}</p>
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
        <h3><i class="fas fa-exclamation-triangle"></i> Informações da Ocorrência</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Data da Ocorrência:</label>
            <p>${dataOcorrenciaFormatada}</p>
          </div>
          <div class="info-item">
            <label>Hora da Ocorrência:</label>
            <p>${horaOcorrencia}</p>
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
        <h3><i class="fas fa-file-alt"></i> Documentos</h3>
        <div class="documents-list">
          ${getDocumentLinks(ocorrencia.documentos, isCPFMatch)}
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
  function getDocumentLinks(documentos, isCPFMatch) {
    if (!documentos)
      return "<p class='no-docs'>Nenhum documento disponível</p>";

    // Se não for o próprio CPF, não mostrar links para documentos
    if (!isCPFMatch) {
      return "<p class='security-message'><i class='fas fa-lock'></i> Os documentos estão disponíveis apenas para o titular do CPF.</p>";
    }

    let html = "";

    if (documentos.documentoIdentidade) {
      html += `<div class="document-item">
      <span><i class="fas fa-id-card"></i> Documento de Identidade:</span>
      <a href="${documentos.documentoIdentidade.url}" target="_blank"><i class="fas fa-download"></i> ${documentos.documentoIdentidade.nome}</a>
    </div>`;
    }

    if (documentos.comprovanteResidencia) {
      html += `<div class="document-item">
      <span><i class="fas fa-home"></i> Comprovante de Residência:</span>
      <a href="${documentos.comprovanteResidencia.url}" target="_blank"><i class="fas fa-download"></i> ${documentos.comprovanteResidencia.nome}</a>
    </div>`;
    }

    if (documentos.documentoCarro) {
      html += `<div class="document-item">
      <span><i class="fas fa-car"></i> Documento do Carro:</span>
      <a href="${documentos.documentoCarro.url}" target="_blank"><i class="fas fa-download"></i> ${documentos.documentoCarro.nome}</a>
    </div>`;
    }

    if (documentos.outrosDocumentos && documentos.outrosDocumentos.length > 0) {
      html += `<div class="document-item">
      <span><i class="fas fa-file-alt"></i> Outros Documentos:</span>
      <ul class="other-docs-list">`;

      documentos.outrosDocumentos.forEach((doc) => {
        html += `<li><a href="${doc.url}" target="_blank"><i class="fas fa-download"></i> ${doc.nome}</a></li>`;
      });

      html += `</ul>
    </div>`;
    }

    return html || "<p class='no-docs'>Nenhum documento disponível</p>";
  }

  // Formatação de campos de formulário
  const cpfInput = document.getElementById("cpf");
  if (cpfInput) {
    cpfInput.addEventListener("input", function (e) {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length > 11) value = value.slice(0, 11);

      // Formata o CPF (xxx.xxx.xxx-xx)
      if (value.length > 9) {
        value = value.replace(
          /^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/,
          "$1.$2.$3-$4"
        );
      } else if (value.length > 6) {
        value = value.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, "$1.$2.$3");
      } else if (value.length > 3) {
        value = value.replace(/^(\d{3})(\d{1,3}).*/, "$1.$2");
      }

      e.target.value = value;
    });
  }

  // Formatação de telefone
  const telefoneInput = document.getElementById("telefone");
  if (telefoneInput) {
    telefoneInput.addEventListener("input", function (e) {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length > 11) value = value.slice(0, 11);

      // Formata telefone ((xx) xxxxx-xxxx)
      if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{5})(\d{1,4}).*/, "($1) $2-$3");
      } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{1,5}).*/, "($1) $2");
      }

      e.target.value = value;
    });
  }

  // Formatação de CPF na busca
  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length > 11) value = value.slice(0, 11);

      // Formata o CPF na busca
      if (value.length > 9) {
        value = value.replace(
          /^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/,
          "$1.$2.$3-$4"
        );
      } else if (value.length > 6) {
        value = value.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, "$1.$2.$3");
      } else if (value.length > 3) {
        value = value.replace(/^(\d{3})(\d{1,3}).*/, "$1.$2");
      }

      e.target.value = value;
    });
  }

  // Melhorar a experiência do upload de arquivos
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach((input) => {
    const fileUploadArea = input.closest(".file-upload-area");
    if (fileUploadArea) {
      const fileText = fileUploadArea.querySelector("p");
      const originalText = fileText.textContent;

      input.addEventListener("change", function () {
        if (this.files.length > 0) {
          if (this.multiple && this.files.length > 1) {
            fileText.textContent = `${this.files.length} arquivos selecionados`;
          } else {
            fileText.textContent = this.files[0].name;
          }
          fileUploadArea.classList.add("file-selected");
        } else {
          fileText.textContent = originalText;
          fileUploadArea.classList.remove("file-selected");
        }
      });

      // Visual feedback ao arrastar arquivos
      fileUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileUploadArea.classList.add("drag-over");
      });

      fileUploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove("drag-over");
      });

      fileUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove("drag-over");

        if (e.dataTransfer.files.length > 0) {
          input.files = e.dataTransfer.files;

          // Trigger change event
          const event = new Event("change", { bubbles: true });
          input.dispatchEvent(event);
        }
      });
    }
  });

  // Inicializar a aba de consulta se estiver ativa
  if (
    document.getElementById("consulta-tab") &&
    window.location.hash === "#consulta"
  ) {
    openTab("consulta-tab");
  }
});
