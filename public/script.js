document.addEventListener("DOMContentLoaded", function () {
  const formulario = document.getElementById("calc-form");
  const nomeInput = document.getElementById("nome");
  const nomeError = document.getElementById("nome-error");
  const datasolicitacaoInput = document.getElementById("datasolicitacao");
  const datasolicitacaoError = document.getElementById("datasolicitacao-error");

  // Flag para controlar envios múltiplos
  let isSubmitting = false;

  // Garantir que estamos usando a referência correta ao banco de dados
  // Verifica se window.database existe, caso contrário, tenta window.db ou firebase.database()
  const database = window.database || window.db || firebase.database();

  // Preencher a data de solicitação automaticamente com a data atual
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString("pt-BR");
  if (datasolicitacaoInput) {
    datasolicitacaoInput.value = dataFormatada;
  }

  // Configurar evento para mostrar/ocultar campo "Especifique a relação"
  const relacaoSelect = document.getElementById("relacaoSolicitante");
  const outraRelacaoContainer = document.getElementById("outraRelacaoContainer");
  const outraRelacaoInput = document.getElementById("outraRelacaoInput");

  if (relacaoSelect && outraRelacaoContainer && outraRelacaoInput) {
    relacaoSelect.addEventListener("change", function() {
      if (this.value === "Outros") {
        outraRelacaoContainer.style.display = "block";
        outraRelacaoInput.required = true;
      } else {
        outraRelacaoContainer.style.display = "none";
        outraRelacaoInput.required = false;
        outraRelacaoInput.value = "";
      }
    });
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

  // Função para enviar e-mail de confirmação usando Firebase Functions
  async function enviarEmailConfirmacao(dados) {
    try {
      console.log("Tentando enviar e-mail de confirmação...");
      
      // Certifique-se de que o firebase.functions() esteja inicializado
      if (typeof firebase.functions !== "function") {
        console.error("Firebase Functions não está disponível");
        return false;
      }

      // Nome da função do Firebase que envia o e-mail de confirmação
      const enviarEmailFunction = firebase
        .functions()
        .httpsCallable("enviarEmailConfirmacao");

      // Preparar dados para envio
      const emailData = {
        destinatario: dados.email,
        nome: dados.nome,
        numeroOcorrencia: dados.occurrenceNumber
      };

      // Enviar a solicitação para a função do Firebase
      const result = await enviarEmailFunction(emailData);

      console.log("E-mail de confirmação enviado com sucesso:", result);
      return true;
    } catch (error) {
      console.error("Erro ao enviar e-mail de confirmação:", error);
      // Não interrompe o fluxo principal se houver falha no envio do e-mail
      return false;
    }
  }

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

      // Verificação de campos obrigatórios
      const requiredInputs = formulario.querySelectorAll('[required]');
      let hasEmptyRequired = false;

      // Verificando inputs obrigatórios (exceto document do carro, que não tem mais o required)
      requiredInputs.forEach(input => {
        if (input.type === 'file') {
          // Para inputs de arquivo, verificar se tem arquivos selecionados
          if (!input.files || input.files.length === 0) {
            hasEmptyRequired = true;
            // Destacar visualmente
            const fileArea = input.closest('.file-upload-area');
            if (fileArea) {
              fileArea.style.borderColor = 'var(--danger-color)';
            }
          }
        } else if (!input.value.trim()) {
          hasEmptyRequired = true;
          input.style.borderColor = 'var(--danger-color)';
        }
      });

      if (hasEmptyRequired) {
        showErrorMessage(
          "Campos obrigatórios não preenchidos",
          "Por favor, preencha todos os campos obrigatórios destacados em vermelho."
        );
        return;
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
          <p>Processando sua solicitação. Isso pode demorar um pouco. Por favor, aguarde e não feche esta página...</p>
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
          bairro: document.getElementById("bairro").value,
          enderecoSolicitante: document.getElementById("enderecoSolicitante")
            .value,
          email: document.getElementById("email").value,
          telefone: document.getElementById("telefone").value,
          dataOcorrencia: document.getElementById("dataOcorrencia").value, // Mantendo como string para evitar bug de fuso horário
          horaOcorrencia: document.getElementById("horaOcorrencia").value,
          turno: document.getElementById("turnoOcorrencia").value,
          enderecoOcorrencia:
            document.getElementById("enderecoOcorrencia").value,
          relacaoSolicitante: document.getElementById("relacaoSolicitante").value,
          relacaoEspecifica: document.getElementById("relacaoSolicitante").value === "Outros" ? document.getElementById("outraRelacaoInput").value : "",
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
        console.log("Dados da ocorrência salvos com sucesso!");

        // Enviar e-mail de confirmação para o solicitante - com tratamento de erro aprimorado
        try {
          const emailEnviado = await enviarEmailConfirmacao(formData);
          
          // Registrar o status do envio do e-mail de confirmação
          if (emailEnviado) {
            await database.ref(`ocorrencias/${occurrenceNumber}/emailConfirmacao`).set({
              timestamp: Date.now(),
              success: true,
            });
          } else {
            console.warn("E-mail não enviado, mas o processo continua.");
            await database.ref(`ocorrencias/${occurrenceNumber}/emailConfirmacao`).set({
              timestamp: Date.now(),
              success: false,
              error: "Falha no envio do e-mail de confirmação",
            });
          }
        } catch (emailError) {
          console.error("Erro ao enviar e-mail de confirmação:", emailError);
          // Registrar falha no banco de dados, mas continuar o fluxo
          try {
            await database.ref(`ocorrencias/${occurrenceNumber}/emailConfirmacao`).set({
              timestamp: Date.now(),
              success: false,
              error: "Falha no envio do e-mail de confirmação: " + (emailError.message || "erro desconhecido"),
            });
          } catch (dbError) {
            console.error("Erro ao registrar falha de e-mail:", dbError);
          }
        }

        // Exibir mensagem de sucesso com informações completas
        showSuccessMessage(
          `✅ Solicitação Enviada com Sucesso!`,
          `
            <div class="success-details">
              <p><strong>${formData.nome}</strong>, sua solicitação de certidão de ocorrência foi enviada com sucesso!</p>
              
              <div class="protocolo-info">
                <h4>📋 Seu Número de Protocolo:</h4>
                <div class="protocolo-number">${occurrenceNumber}</div>
                <small>Anote este número para acompanhar sua solicitação</small>
              </div>
              
              <div class="email-info">
                <h4>📧 Confirmação por E-mail:</h4>
                <p>Enviamos um <strong>e-mail de confirmação</strong> para <strong>${formData.email}</strong> contendo:</p>
                <ul>
                  <li>✓ Número do protocolo</li>
                  <li>✓ Dados da solicitação</li>
                  <li>✓ Prazo estimado</li>
                </ul>
              </div>
              
              <div class="spam-warning">
                <h4>⚠️ Importante:</h4>
                <p><strong>Verifique sua caixa de SPAM/LIXO ELETRÔNICO</strong> caso não receba o e-mail em alguns minutos.</p>
                <p>Em breve entraremos em contato novamente quando sua certidão estiver pronta.</p>
              </div>
            </div>
          `
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
    const storage = window.storage || firebase.storage();

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
            ${message}
            <div class="auto-reload-info">
              <i class="fas fa-info-circle"></i>
              <small>Esta página será recarregada automaticamente em <span class="countdown">10</span> segundos ou clique em OK para continuar.</small>
            </div>
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
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
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
      .auto-reload-info {
        margin-top: 15px;
        padding: 10px 15px;
        background-color: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .auto-reload-info i {
        color: #3b82f6;
        font-size: 14px;
      }
      .auto-reload-info small {
        color: #4b5563;
        font-size: 13px;
        line-height: 1.4;
        margin: 0;
      }
      .countdown {
        font-weight: bold;
        color: #3b82f6;
        background-color: rgba(59, 130, 246, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(59, 130, 246, 0.2);
      }
      
      /* Novos estilos para a mensagem de sucesso melhorada */
      .success-details {
        text-align: left;
      }
      .success-details > p {
        font-size: 16px;
        margin-bottom: 20px;
        color: #374151;
      }
      .protocolo-info, .email-info, .spam-warning {
        margin: 20px 0;
        padding: 15px;
        border-radius: 8px;
      }
      .protocolo-info {
        background-color: #f0f9ff;
        border: 2px solid #0284c7;
      }
      .protocolo-info h4 {
        color: #0284c7;
        margin: 0 0 10px 0;
        font-size: 16px;
      }
      .protocolo-number {
        font-family: 'Courier New', monospace;
        font-size: 24px;
        font-weight: bold;
        color: #0284c7;
        background-color: white;
        padding: 10px;
        border-radius: 6px;
        text-align: center;
        margin: 10px 0;
        border: 1px solid #0284c7;
      }
      .email-info {
        background-color: #f0f9f9;
        border: 2px solid #10b981;
      }
      .email-info h4 {
        color: #10b981;
        margin: 0 0 10px 0;
        font-size: 16px;
      }
      .email-info ul {
        margin: 10px 0;
        padding-left: 20px;
      }
      .email-info li {
        margin: 5px 0;
        color: #374151;
      }
      .spam-warning {
        background-color: #fef3c7;
        border: 2px solid #f59e0b;
      }
      .spam-warning h4 {
        color: #f59e0b;
        margin: 0 0 10px 0;
        font-size: 16px;
      }
      .spam-warning p {
        color: #92400e;
        margin: 8px 0;
        font-weight: 500;
      }
      .success-details small {
        color: #6b7280;
        font-style: italic;
        display: block;
        text-align: center;
        margin-top: 5px;
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
      // Recarregar a página para voltar ao estado inicial
      window.location.reload();
    });

    // Contador regressivo e auto-reload
    let countdown = 10;
    const countdownElement = modalElement.querySelector('.countdown');
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (document.body.contains(modalElement)) {
          document.body.removeChild(modalElement);
          window.location.reload();
        }
      }
    }, 1000);

    // Limpar o interval se o modal for fechado manualmente
    const originalCloseFunction = closeBtn.onclick;
    closeBtn.onclick = function() {
      clearInterval(countdownInterval);
      document.body.removeChild(modalElement);
      window.location.reload();
    };

    // Também limpar o interval se clicar fora do modal
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) {
        clearInterval(countdownInterval);
        document.body.removeChild(modalElement);
        window.location.reload();
      }
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

    // Usar a referência correta ao banco de dados
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

    // Usar a referência correta ao banco de dados
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

    // Format dates for display - Corrigindo bug de data
    const dataOcorrenciaFormatada = ocorrencia.dataOcorrencia || "Não informado";
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
    
    // Novos campos
    const turno = ocorrencia.turno || "Não informado";
    const bairro = ocorrencia.bairro || "Não informado";
    const relacaoSolicitante = ocorrencia.relacaoSolicitante || "Não informado";
    const relacaoEspecifica = ocorrencia.relacaoEspecifica || "";

    // Verificar se o CPF no campo de busca corresponde ao CPF da ocorrência
    const searchInput = document.getElementById("search-input");
    const isCPFMatch =
      searchInput &&
      ocorrencia.cpf &&
      searchInput.value.replace(/\D/g, "") ===
        ocorrencia.cpf.replace(/\D/g, "");

    // Só mostrar o link da certidão se for o próprio CPF buscando
    const showCertidaoLink = ocorrencia.certidao && isCPFMatch;

    // Verificar e mostrar o status do e-mail de confirmação, se disponível
    const emailConfirmacaoHTML = ocorrencia.emailConfirmacao
      ? `<p><strong>E-mail de confirmação:</strong> ${
          ocorrencia.emailConfirmacao.success
            ? '<span class="email-status-success">Enviado com sucesso</span>'
            : '<span class="email-status-failed">Falha no envio</span>'
        }</p>`
      : "";
    
    // Verificar se foi cancelado e mostrar motivo
    const motivoCancelamentoHTML = ocorrencia.status === "Cancelado" && ocorrencia.motivoCancelamento
      ? `<p><strong>Motivo do cancelamento:</strong> <span class="motivo-cancelamento">${ocorrencia.motivoCancelamento}</span></p>`
      : "";

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
        ${emailConfirmacaoHTML}
        ${motivoCancelamentoHTML}
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
            <label>Bairro:</label>
            <p>${bairro}</p>
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
            <label>Turno:</label>
            <p>${turno}</p>
          </div>
          <div class="info-item">
            <label>Local:</label>
            <p>${ocorrencia.enderecoOcorrencia}</p>
          </div>
          <div class="info-item">
            <label>Relação com a vítima:</label>
            <p>${relacaoSolicitante}${relacaoEspecifica ? ` - ${relacaoEspecifica}` : ""}</p>
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
      
      // Criar botão de remoção
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "file-clear-btn";
      clearButton.innerHTML = '<i class="fas fa-times"></i>';
      clearButton.title = "Remover arquivo";
      // Inicialmente oculto
      clearButton.style.display = "none";
      
      // Adicionar o botão à área de upload
      fileUploadArea.appendChild(clearButton);
      
      // Função para atualizar a UI quando arquivos forem selecionados/removidos
      const updateFileUI = function() {
        if (input.files.length > 0) {
          if (input.multiple && input.files.length > 1) {
            fileText.textContent = `${input.files.length} arquivos selecionados`;
          } else {
            fileText.textContent = input.files[0].name;
          }
          fileUploadArea.classList.add("file-selected");
          clearButton.style.display = "block"; // Mostrar botão de remoção
        } else {
          fileText.textContent = originalText;
          fileUploadArea.classList.remove("file-selected");
          clearButton.style.display = "none"; // Ocultar botão de remoção
        }
      };

      // Evento quando um arquivo é selecionado
      input.addEventListener("change", updateFileUI);

      // Evento para o botão de remoção
      clearButton.addEventListener("click", function(e) {
        e.stopPropagation(); // Evitar que o clique chegue à área de upload
        
        // Limpar o input de arquivo
        input.value = "";
        
        // Atualizar a UI
        updateFileUI();
        
        // Evitar que o evento de clique se propague
        return false;
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

  // Adicionar estilo para o botão de remoção de arquivos
  const uploadButtonStyles = document.createElement("style");
  uploadButtonStyles.textContent = `
    .file-upload-area {
      position: relative; /* Importante para posicionar o botão corretamente */
    }

    .file-clear-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: rgba(239, 68, 68, 0.15);
      border: none;
      color: var(--danger-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 20;
      font-size: 12px;
      opacity: 0.8;
    }

    .file-clear-btn:hover {
      background-color: var(--danger-color);
      color: white;
      opacity: 1;
    }

    /* Melhorias visuais quando um arquivo é selecionado */
    .file-upload-area.file-selected {
      border-color: var(--primary-color);
      background-color: rgba(59, 130, 246, 0.05);
      border-style: solid;
    }

    .file-upload-area.file-selected i {
      color: var(--primary-color);
    }

    .file-upload-area.file-selected p {
      color: var(--gray-700);
      font-weight: 500;
      max-width: calc(100% - 30px); /* Deixa espaço para o botão de remoção */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    }
  `;
  document.head.appendChild(uploadButtonStyles);

  // Adicionar estilo para exibir o status do e-mail de confirmação
  const emailStatusStyles = document.createElement("style");
  emailStatusStyles.textContent = `
    .email-status-success {
      display: inline-block;
      padding: 2px 8px;
      background-color: rgba(16, 185, 129, 0.1);
      color: #10b981;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .email-status-failed {
      display: inline-block;
      padding: 2px 8px;
      background-color: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
    }
  `;
  document.head.appendChild(emailStatusStyles);

  // Inicializar a aba de consulta se estiver ativa
  if (
    document.getElementById("consulta-tab") &&
    window.location.hash === "#consulta"
  ) {
    openTab("consulta-tab");
  }

  // WIZARD FORM NAVIGATION
  let currentStep = 1;
  const totalSteps = 3;

  // Initialize wizard
  function initializeWizard() {
    showStep(1);
    updateProgressBar();
  }

  // Show specific step
  function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
      step.classList.remove('active');
    });

    // Show current step
    const currentStepElement = document.getElementById(`step-${stepNumber}`);
    if (currentStepElement) {
      currentStepElement.classList.add('active');
    }

    currentStep = stepNumber;
    updateProgressBar();
  }

  // Update progress bar
  function updateProgressBar() {
    document.querySelectorAll('.step').forEach((step, index) => {
      const stepNumber = index + 1;
      step.classList.remove('active', 'completed');
      
      if (stepNumber < currentStep) {
        step.classList.add('completed');
      } else if (stepNumber === currentStep) {
        step.classList.add('active');
      }
    });
  }

  // Validate current step
  function validateStep(stepNumber) {
    const stepElement = document.getElementById(`step-${stepNumber}`);
    if (!stepElement) return false;

    const requiredFields = stepElement.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      const formGroup = field.closest('.form-group');
      
      if (!field.value.trim()) {
        formGroup.classList.add('error');
        formGroup.classList.remove('success');
        isValid = false;
      } else {
        formGroup.classList.remove('error');
        formGroup.classList.add('success');
      }
    });

    return isValid;
  }

  // Navigate to next step
  function nextStep() {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        showStep(currentStep + 1);
      }
    } else {
      // Show validation error message
      showValidationError();
    }
  }

  // Navigate to previous step
  function previousStep() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  // Show validation error
  function showValidationError() {
    const errorModal = document.createElement('div');
    errorModal.className = 'validation-error-modal';
    errorModal.innerHTML = `
      <div class="validation-error-content">
        <div class="validation-error-header">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Campos obrigatórios</h3>
        </div>
        <div class="validation-error-body">
          <p>Por favor, preencha todos os campos obrigatórios antes de continuar.</p>
        </div>
        <div class="validation-error-footer">
          <button class="close-validation-error-btn">OK</button>
        </div>
      </div>
    `;

    // Add styles for validation error modal
    const style = document.createElement('style');
    style.textContent = `
      .validation-error-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        animation: fadeIn 0.3s ease;
      }
      .validation-error-content {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        width: 90%;
        max-width: 400px;
        animation: slideUp 0.3s ease;
      }
      .validation-error-header {
        background-color: #f59e0b;
        color: white;
        padding: 20px;
        border-radius: 8px 8px 0 0;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .validation-error-header i {
        font-size: 1.5rem;
      }
      .validation-error-header h3 {
        margin: 0;
      }
      .validation-error-body {
        padding: 20px;
      }
      .validation-error-footer {
        padding: 15px 20px;
        text-align: right;
        border-top: 1px solid #e5e7eb;
      }
      .close-validation-error-btn {
        background-color: #f59e0b;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
      }
      .close-validation-error-btn:hover {
        background-color: #d97706;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(errorModal);

    // Close modal event
    const closeBtn = errorModal.querySelector('.close-validation-error-btn');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(errorModal);
    });

    // Auto close after 3 seconds
    setTimeout(() => {
      if (document.body.contains(errorModal)) {
        document.body.removeChild(errorModal);
      }
    }, 3000);
  }

  // Add event listeners for navigation buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-next') || e.target.closest('.btn-next')) {
      e.preventDefault();
      nextStep();
    } else if (e.target.classList.contains('btn-prev') || e.target.closest('.btn-prev')) {
      e.preventDefault();
      previousStep();
    }
  });

  // Progress bar step click navigation
  document.querySelectorAll('.step').forEach((step, index) => {
    step.addEventListener('click', () => {
      const targetStep = index + 1;
      
      // Only allow navigation to completed steps or current step
      if (targetStep <= currentStep) {
        showStep(targetStep);
      } else {
        // Validate and navigate forward if valid
        let canNavigate = true;
        for (let i = currentStep; i < targetStep; i++) {
          if (!validateStep(i)) {
            canNavigate = false;
            break;
          }
        }
        
        if (canNavigate) {
          showStep(targetStep);
        } else {
          showValidationError();
        }
      }
    });
  });

  // Real-time validation for better UX
  document.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
    field.addEventListener('blur', () => {
      const formGroup = field.closest('.form-group');
      
      if (field.value.trim()) {
        formGroup.classList.remove('error');
        formGroup.classList.add('success');
      } else {
        formGroup.classList.add('error');
        formGroup.classList.remove('success');
      }
    });

    field.addEventListener('input', () => {
      const formGroup = field.closest('.form-group');
      
      if (field.value.trim()) {
        formGroup.classList.remove('error');
      }
    });
  });

  // Initialize wizard when DOM is ready
  initializeWizard();
});
