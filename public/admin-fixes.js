/**
 * admin-fixes.js
 * Correções e melhorias para o painel administrativo do Sistema de Certidões
 * Versão otimizada: 2.1
 */

document.addEventListener("DOMContentLoaded", function() {
    console.log("[FIXES] Inicializando correções do painel administrativo...");
    
    // Referências aos elementos da UI
    const searchInput = document.getElementById("admin-search");
    const searchButton = document.getElementById("admin-search-btn");
    const dateFilter = document.getElementById("date-filter");
    const notificationBtn = document.getElementById("notifications-btn");
    const notificationsContainer = document.getElementById("notifications-container");
    const refreshBtn = document.getElementById("refresh-btn");
    const currentTabTitle = document.getElementById("current-tab-title");
    
    // Contador global de ocorrências
    let cachedOcorrencias = null;
    let lastFilterValue = 'all';
    let lastSearchTerm = '';
    
    // ===== FUNÇÕES UTILITÁRIAS =====
    
    /**
     * Mostra um indicador de carregamento em um container
     */
    function showLoading(container, message = "Carregando...") {
      if (!container) return;
      
      container.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
    
    /**
     * Mostra uma mensagem de erro em um container
     */
    function showError(container, message = "Ocorreu um erro. Tente novamente.") {
      if (!container) return;
      
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${message}</p>
        </div>
      `;
    }
    
    /**
     * Mostra uma mensagem quando não há dados
     */
    function showEmpty(container, message = "Nenhum dado encontrado.") {
      if (!container) return;
      
      container.innerHTML = `
        <div class="no-data">
          <i class="fas fa-search"></i>
          <p>${message}</p>
        </div>
      `;
    }
    
    /**
     * Carrega dados do Firebase
     */
    async function loadOccurrences(forceReload = false) {
      try {
        console.log("[FIXES] Carregando ocorrências do Firebase...");
        
        // Usar cache se existir e forceReload não estiver ativado
        if (cachedOcorrencias && !forceReload) {
          console.log("[FIXES] Usando dados em cache");
          return cachedOcorrencias;
        }
        
        // Usando acesso direto ao objeto database do Firebase
        const database = window.database || firebase.database();
        
        if (!database) {
          throw new Error("Objeto database não encontrado. Verifique se o Firebase está inicializado.");
        }
        
        // Buscar todas as ocorrências
        const snapshot = await database.ref("ocorrencias").once("value");
        
        if (!snapshot.exists()) {
          console.log("[FIXES] Nenhuma ocorrência encontrada");
          return [];
        }
        
        const occurrences = [];
        
        snapshot.forEach((childSnapshot) => {
          occurrences.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        
        console.log(`[FIXES] ${occurrences.length} ocorrências carregadas com sucesso`);
        
        // Atualizar o cache
        cachedOcorrencias = occurrences;
        
        return occurrences;
      } catch (error) {
        console.error("[FIXES] Erro ao carregar ocorrências:", error);
        throw new Error("Erro ao carregar dados do Firebase: " + error.message);
      }
    }
    
    /**
     * Renderiza ocorrências em um container
     */
    function renderOccurrences(container, occurrences) {
      if (!container || !occurrences) return;
      
      // Limpar container
      container.innerHTML = "";
      
      if (occurrences.length === 0) {
        showEmpty(container);
        return;
      }
      
      // Criar cards para cada ocorrência
      occurrences.forEach(ocorrencia => {
        const card = createOccurrenceCard(ocorrencia);
        container.appendChild(card);
      });
    }
    
    /**
     * Cria um card para uma ocorrência
     */
    function createOccurrenceCard(ocorrencia) {
      const card = document.createElement("div");
      const statusClass = ocorrencia.status
        ? ocorrencia.status
            .toLowerCase()
            .replace(/\s+/g, "-")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : "pendente";
      
      card.className = `ocorrencia-card status-${statusClass}`;
      card.setAttribute("data-id", ocorrencia.id || ocorrencia.occurrenceNumber);
      
      const dataOcorrencia = formatDate(ocorrencia.timestamp, true);
      
      card.innerHTML = `
        <div class="card-header">
          <div class="ocorrencia-number">${ocorrencia.occurrenceNumber || ocorrencia.id}</div>
          <div class="ocorrencia-status ${statusClass}">${ocorrencia.status || "Pendente"}</div>
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
              <span class="info-value">${formatCPF(ocorrencia.cpf) || "N/A"}</span>
            </div>
            <div class="info-row">
              <i class="fas fa-calendar"></i>
              <span class="info-label">Data:</span>
              <span class="info-value">${dataOcorrencia}</span>
            </div>
            <div class="info-row">
              <i class="fas fa-map-marker-alt"></i>
              <span class="info-label">Local:</span>
              <span class="info-value">${truncateText(ocorrencia.enderecoOcorrencia, 40) || "N/A"}</span>
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
          <button class="view-btn" data-id="${ocorrencia.occurrenceNumber || ocorrencia.id}">
            <i class="fas fa-eye"></i> Ver Detalhes
          </button>
        </div>
      `;
      
      // Adicionar evento ao botão de detalhes
      const viewBtn = card.querySelector(".view-btn");
      if (viewBtn) {
        viewBtn.addEventListener("click", function() {
          const occurrenceId = this.getAttribute("data-id");
          if (window.viewOcorrenciaDetails) {
            window.viewOcorrenciaDetails(occurrenceId);
          } else {
            console.warn("[FIXES] Função viewOcorrenciaDetails não encontrada");
            showAlert("Função de visualização não disponível", "warning");
          }
        });
      }
      
      return card;
    }
    
    /**
     * Formata uma data
     */
    function formatDate(timestamp, includeTime = false) {
      if (!timestamp) return "N/A";
      
      try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return "Data inválida";
        
        return includeTime
          ? date.toLocaleDateString("pt-BR") + " " + date.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString("pt-BR");
      } catch (error) {
        console.error("[FIXES] Erro ao formatar data:", error);
        return "Erro na data";
      }
    }
    
    /**
     * Formata um CPF
     */
    function formatCPF(cpf) {
      if (!cpf) return "";
      
      // Remove caracteres não numéricos
      cpf = cpf.toString().replace(/\D/g, "");
      
      // Verifica se tem o tamanho correto
      if (cpf.length !== 11) return cpf;
      
      // Aplica a formatação
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    
    /**
     * Trunca texto para exibição
     */
    function truncateText(text, size = 100) {
      if (!text) return "";
      
      if (text.length <= size) {
        return text;
      }
      
      return text.substring(0, size) + "...";
    }
    
    /**
     * Mostra um alerta customizado
     */
    function showAlert(message, type = "info") {
      const alertId = "custom-alert";
      
      // Remover alerta existente
      let existingAlert = document.getElementById(alertId);
      if (existingAlert) {
        existingAlert.remove();
      }
      
      // Criar novo alerta
      const alert = document.createElement("div");
      alert.id = alertId;
      alert.className = `custom-alert ${type}`;
      
      // Determinar ícone com base no tipo
      let icon = "info-circle";
      if (type === "success") icon = "check-circle";
      if (type === "error") icon = "exclamation-circle";
      if (type === "warning") icon = "exclamation-triangle";
      
      alert.innerHTML = `
        <div class="alert-icon"><i class="fas fa-${icon}"></i></div>
        <div class="alert-message">${message}</div>
        <button class="alert-close"><i class="fas fa-times"></i></button>
      `;
      
      // Adicionar estilos se ainda não foram adicionados
      if (!document.getElementById("custom-alert-styles")) {
        const style = document.createElement("style");
        style.id = "custom-alert-styles";
        style.textContent = `
          .custom-alert {
            position: fixed;
            bottom: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 450px;
            background-color: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-radius: 8px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
          }
          
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          .custom-alert.closing {
            animation: slideOutRight 0.3s ease forwards;
          }
          
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
          
          .alert-icon {
            font-size: 20px;
            flex-shrink: 0;
          }
          
          .alert-message {
            flex: 1;
            font-size: 14px;
          }
          
          .alert-close {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          
          .alert-close:hover {
            opacity: 1;
          }
          
          .custom-alert.info .alert-icon {
            color: #3b82f6;
          }
          
          .custom-alert.success .alert-icon {
            color: #10b981;
          }
          
          .custom-alert.error .alert-icon {
            color: #ef4444;
          }
          
          .custom-alert.warning .alert-icon {
            color: #f59e0b;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Adicionar ao DOM
      document.body.appendChild(alert);
      
      // Configurar fechamento
      const closeBtn = alert.querySelector(".alert-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          alert.classList.add("closing");
          setTimeout(() => {
            if (alert.parentNode) {
              alert.parentNode.removeChild(alert);
            }
          }, 300);
        });
      }
      
      // Auto remover após 5 segundos
      setTimeout(() => {
        if (alert.parentNode) {
          alert.classList.add("closing");
          setTimeout(() => {
            if (alert.parentNode) {
              alert.parentNode.removeChild(alert);
            }
          }, 300);
        }
      }, 5000);
    }
    
    /**
     * Atualiza os contadores de estatísticas baseado nos dados fornecidos
     */
    function updateStatCounters(ocorrencias) {
      if (!ocorrencias) return;
      
      console.log("[FIXES] Atualizando contadores de estatísticas...");
      
      // Referências aos contadores
      const pendingCount = document.getElementById("pending-count");
      const completedCount = document.getElementById("completed-count");
      const statsTotal = document.getElementById("stats-total");
      const statsMonth = document.getElementById("stats-month");
      const statsPending = document.getElementById("stats-pending");
      const statsCompleted = document.getElementById("stats-completed");
      
      // Calcular estatísticas atualizadas
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      
      let countPending = 0;
      let countCompleted = 0;
      let countMonth = 0;
      
      ocorrencias.forEach(ocorrencia => {
        if (ocorrencia.status === "Pendente") {
          countPending++;
        } else if (ocorrencia.status === "Concluído") {
          countCompleted++;
        }
        
        // Contar ocorrências do mês atual
        if (ocorrencia.timestamp && ocorrencia.timestamp >= startOfMonth) {
          countMonth++;
        }
      });
      
      // Atualizar os contadores na UI
      if (pendingCount) pendingCount.textContent = countPending;
      if (completedCount) completedCount.textContent = countCompleted;
      if (statsTotal) statsTotal.textContent = ocorrencias.length;
      if (statsMonth) statsMonth.textContent = countMonth;
      if (statsPending) statsPending.textContent = countPending;
      if (statsCompleted) statsCompleted.textContent = countCompleted;
      
      // Atualizar percentual de concluídas
      const statsCompletedPercent = document.getElementById("stats-completed-percent");
      if (statsCompletedPercent && ocorrencias.length > 0) {
        const percentCompleted = Math.round((countCompleted / ocorrencias.length) * 100);
        statsCompletedPercent.textContent = `${percentCompleted}%`;
      }
      
      console.log("[FIXES] Contadores atualizados com sucesso");
    }
    
    /**
     * Aplica filtro de data em um conjunto de ocorrências
     * @param {Array} ocorrencias - Lista de ocorrências para filtrar
     * @param {string} filterValue - Valor do filtro (today, week, month, all)
     * @returns {Array} Lista de ocorrências filtradas por data
     */
    function applyDateFilter(ocorrencias, filterValue) {
      if (filterValue === 'all') return ocorrencias;
      
      const now = new Date();
      let startDate;
      
      switch (filterValue) {
        case 'today':
          // Hoje - início do dia atual
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          // Esta semana - início da semana atual (domingo)
          const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          break;
        case 'month':
          // Este mês - início do mês atual
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          return ocorrencias;
      }
      
      // Converter para timestamp
      const startTimestamp = startDate.getTime();
      
      // Filtrar por data
      return ocorrencias.filter(ocorrencia => {
        const timestamp = ocorrencia.timestamp || 0;
        return timestamp >= startTimestamp;
      });
    }
  
    // ===== 1. IMPLEMENTAÇÃO DE PESQUISA AVANÇADA =====
    
    function implementAdvancedSearch() {
      if (!searchInput || !searchButton) {
        console.error("[FIXES] Elementos de pesquisa não encontrados");
        return;
      }
      
      console.log("[FIXES] Configurando pesquisa avançada...");
      
      // Função de pesquisa melhorada
      const performAdvancedSearch = async () => {
        try {
          const searchTerm = searchInput.value.trim().toLowerCase();
          lastSearchTerm = searchTerm;
          
          console.log(`[FIXES] Executando pesquisa para: "${searchTerm || 'TODAS AS OCORRÊNCIAS'}"`);
          
          // Mostrar loading nos painéis ativos
          const activeTab = document.querySelector(".nav-item.active");
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showLoading(container, "Pesquisando...");
            }
          }
          
          // Carregar todas as ocorrências para pesquisa local
          const ocorrencias = await loadOccurrences();
          
          if (!ocorrencias || ocorrencias.length === 0) {
            throw new Error("Nenhuma ocorrência encontrada");
          }
          
          let filteredOcorrencias = ocorrencias;
          
          // Aplicar filtro de pesquisa apenas se houver termo
          if (searchTerm) {
            // Filtrar ocorrências com base no termo de pesquisa
            filteredOcorrencias = ocorrencias.filter(ocorrencia => {
              // Buscar por nome
              const matchesName = ocorrencia.nome && 
                ocorrencia.nome.toLowerCase().includes(searchTerm);
              
              // Buscar por número da ocorrência
              const occurrenceId = ocorrencia.id || ocorrencia.occurrenceNumber || "";
              const matchesNumber = occurrenceId.toString().toLowerCase().includes(searchTerm);
              
              // Buscar por CPF (remover formatação para comparação)
              const cpf = ocorrencia.cpf ? ocorrencia.cpf.toString().replace(/\D/g, "") : "";
              const searchTermNumbers = searchTerm.replace(/\D/g, "");
              const matchesCPF = searchTermNumbers.length > 0 && 
                cpf.includes(searchTermNumbers);
              
              return matchesName || matchesNumber || matchesCPF;
            });
          }
          
          // Aplicar filtro de data
          if (dateFilter && dateFilter.value !== 'all') {
            filteredOcorrencias = applyDateFilter(filteredOcorrencias, dateFilter.value);
          }
          
          console.log(`[FIXES] Encontradas ${filteredOcorrencias.length} ocorrências pela pesquisa`);
          
          // Atualizar a exibição com os resultados da pesquisa
          showSearchResults(filteredOcorrencias);
          
        } catch (error) {
          console.error("[FIXES] Erro na pesquisa:", error);
          
          // Mostrar mensagem de erro
          const activeTab = document.querySelector(".nav-item.active");
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showError(container, `Erro ao realizar a pesquisa: ${error.message}`);
            }
          }
          
          showAlert(`Erro ao realizar a pesquisa: ${error.message}`, "error");
        }
      };
      
      // Exibir resultados da pesquisa
      function showSearchResults(results) {
        // Criar título da pesquisa
        const searchTerm = searchInput.value.trim().toLowerCase();
        const searchTitle = searchTerm 
          ? `Resultados da pesquisa: ${results.length} ocorrência(s) encontrada(s)` 
          : `Todas as ocorrências: ${results.length} encontrada(s)`;
        
        // Atualizar título
        if (currentTabTitle) {
          currentTabTitle.innerHTML = `<i class="fas fa-search"></i> ${searchTitle}`;
        }
        
        // Atualizar contadores no topo da página
        updateStatCounters(results);
        
        // Obter container ativo
        const activeTab = document.querySelector(".nav-item.active");
        if (!activeTab) return;
        
        const tabId = activeTab.getAttribute("data-tab");
        const container = document.getElementById(`${tabId}-ocorrencias`);
        
        if (!container) return;
        
        // Filtrar resultados pela aba atual
        let tabFilteredResults = results;
        
        if (tabId === "pending") {
          tabFilteredResults = results.filter(o => o.status === "Pendente");
        } else if (tabId === "completed") {
          tabFilteredResults = results.filter(o => o.status === "Concluído");
        }
        
        // Mostrar resultados
        if (tabFilteredResults.length === 0) {
          showEmpty(container, "Nenhuma ocorrência encontrada para esta pesquisa.");
        } else {
          // Ordenar por data (mais recentes primeiro)
          tabFilteredResults.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          
          // Renderizar ocorrências
          renderOccurrences(container, tabFilteredResults);
        }
      }
      
      // Adicionar evento para a pesquisa no botão
      searchButton.addEventListener("click", performAdvancedSearch);
      
      // Permitir pesquisa ao pressionar Enter
      searchInput.addEventListener("keyup", function(e) {
        if (e.key === "Enter") {
          performAdvancedSearch();
        }
      });
      
      console.log("[FIXES] Pesquisa avançada configurada com sucesso");
    }
    
    // ===== 2. IMPLEMENTAÇÃO DOS FILTROS DE DATA =====
    
    function implementDateFilters() {
      if (!dateFilter) {
        console.error("[FIXES] Elemento de filtro de data não encontrado");
        return;
      }
      
      console.log("[FIXES] Configurando filtros de data...");
      
      // Função para aplicar filtro de data
      const handleDateFilter = async () => {
        try {
          const filterValue = dateFilter.value;
          lastFilterValue = filterValue;
          console.log(`[FIXES] Aplicando filtro de data: ${filterValue}`);
          
          // Mostrar loading nos painéis ativos
          const activeTab = document.querySelector(".nav-item.active");
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showLoading(container, "Filtrando...");
            }
          }
          
          // Carregar ocorrências
          const ocorrencias = await loadOccurrences();
          
          if (!ocorrencias || ocorrencias.length === 0) {
            throw new Error("Nenhuma ocorrência encontrada");
          }
          
          // Aplicar filtro atual (pesquisa e data)
          let filteredOcorrencias = ocorrencias;
          
          // Aplicar filtro de pesquisa se existir termo
          if (lastSearchTerm) {
            filteredOcorrencias = filteredOcorrencias.filter(ocorrencia => {
              const nome = ocorrencia.nome ? ocorrencia.nome.toLowerCase() : "";
              const occurrenceId = (ocorrencia.id || ocorrencia.occurrenceNumber || "").toString().toLowerCase();
              const cpf = ocorrencia.cpf ? ocorrencia.cpf.toString().replace(/\D/g, "") : "";
              const searchTermNumbers = lastSearchTerm.replace(/\D/g, "");
              
              return nome.includes(lastSearchTerm) || 
                     occurrenceId.includes(lastSearchTerm) || 
                     (searchTermNumbers.length > 0 && cpf.includes(searchTermNumbers));
            });
          }
          
          // Aplicar filtro de data
          if (filterValue !== 'all') {
            filteredOcorrencias = applyDateFilter(filteredOcorrencias, filterValue);
          }
          
          console.log(`[FIXES] Encontradas ${filteredOcorrencias.length} ocorrências após filtro de data`);
          
          // Atualizar título mostrando o filtro aplicado
          let filterTitle = "";
          switch (filterValue) {
            case "today":
              filterTitle = "Hoje";
              break;
            case "week":
              filterTitle = "Esta semana";
              break;
            case "month":
              filterTitle = "Este mês";
              break;
            default:
              filterTitle = "Todas as datas";
          }
          
          // Atualizar título
          if (currentTabTitle) {
            const activeTabElement = document.querySelector(".nav-item.active");
            let tabTitle = activeTabElement ? activeTabElement.textContent.trim() : "Ocorrências";
            
            if (filterValue !== 'all') {
              currentTabTitle.innerHTML = `<i class="fas fa-calendar"></i> ${tabTitle} - Filtro: ${filterTitle}`;
            } else {
              // Restaurar título original da aba
              let tabIcon = "list";
              
              if (activeTabElement) {
                const tabId = activeTabElement.getAttribute("data-tab");
                if (tabId === "pending") {
                  tabIcon = "clock";
                  tabTitle = "Solicitações Pendentes";
                } else if (tabId === "completed") {
                  tabIcon = "check-circle";
                  tabTitle = "Solicitações Concluídas";
                } else if (tabId === "all") {
                  tabIcon = "list";
                  tabTitle = "Todas as Solicitações";
                }
              }
              
              currentTabTitle.innerHTML = `<i class="fas fa-${tabIcon}"></i> ${tabTitle}`;
            }
          }
          
          // Atualizar a aba ativa com as ocorrências filtradas
          const activeTabElement = document.querySelector(".nav-item.active");
          if (activeTabElement) {
            const tabId = activeTabElement.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            
            if (container) {
              // Filtrar também pelo tipo da aba
              let finalFilteredOcorrencias = filteredOcorrencias;
              
              if (tabId === "pending") {
                finalFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Pendente");
              } else if (tabId === "completed") {
                finalFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Concluído");
              }
              
              // Renderizar resultados
              if (finalFilteredOcorrencias.length === 0) {
                showEmpty(container, `Nenhuma ocorrência encontrada para o filtro "${filterTitle}".`);
              } else {
                // Ordenar por data (mais recentes primeiro)
                finalFilteredOcorrencias.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                
                // Renderizar ocorrências
                renderOccurrences(container, finalFilteredOcorrencias);
              }
              
              // Atualizar contadores
              updateStatCounters(filteredOcorrencias);
            }
          }
          
          // Mostrar alerta informativo
          showAlert(`Filtro aplicado: ${filterTitle}`, "info");
          
        } catch (error) {
          console.error("[FIXES] Erro ao aplicar filtro de data:", error);
          
          // Mostrar mensagem de erro
          const activeTab = document.querySelector(".nav-item.active");
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showError(container, `Erro ao aplicar filtro: ${error.message}`);
            }
          }
          
          showAlert(`Erro ao aplicar filtro: ${error.message}`, "error");
        }
      };
      
      // Função para aplicar filtro de data em um conjunto de ocorrências
      function applyDateFilter(ocorrencias, filterValue) {
        if (filterValue === 'all') return ocorrencias;
        
        const now = new Date();
        let startDate;
        
        switch (filterValue) {
          case 'today':
            // Hoje - início do dia atual
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            // Esta semana - início da semana atual (domingo)
            const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
            break;
          case 'month':
            // Este mês - início do mês atual
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            return ocorrencias;
        }
        
        // Converter para timestamp
        const startTimestamp = startDate.getTime();
        
        // Filtrar por data
        return ocorrencias.filter(ocorrencia => {
          const timestamp = ocorrencia.timestamp || 0;
          return timestamp >= startTimestamp;
        });
      }
      
      // Adicionar evento para filtro de data
      dateFilter.addEventListener("change", handleDateFilter);
      
      console.log("[FIXES] Filtros de data configurados com sucesso");
    }
    
    // ===== 3. REMOÇÃO DA FUNCIONALIDADE DE NOTIFICAÇÕES =====
    
    function removeNotifications() {
      if (!notificationBtn) {
        console.warn("[FIXES] Botão de notificações não encontrado");
        return;
      }
      
      console.log("[FIXES] Removendo a funcionalidade de notificações...");
      
      // 1. Ocultar o botão de notificações
      const headerActionsRight = notificationBtn.closest('.header-actions-right');
      if (headerActionsRight) {
        notificationBtn.style.display = 'none';
      }
      
      // 2. Remover eventos associados ao botão de notificações
      notificationBtn.replaceWith(notificationBtn.cloneNode(true));
      
      // 3. Remover containers de notificação, se existirem
      if (notificationsContainer) {
        if (notificationsContainer.parentNode) {
          notificationsContainer.parentNode.removeChild(notificationsContainer);
        }
      }
      
      console.log("[FIXES] Funcionalidade de notificações removida com sucesso");
    }
    
    // ===== 4. IMPLEMENTAÇÃO DO BOTÃO DE ATUALIZAÇÃO =====
    
    function implementRefreshButton() {
      if (!refreshBtn) {
        console.warn("[FIXES] Botão de atualização não encontrado");
        return;
      }
      
      console.log("[FIXES] Configurando botão de atualização...");
      
      refreshBtn.addEventListener("click", async () => {
        try {
          console.log("[FIXES] Atualizando dados...");
          
          // Mostrar indicador de carregamento
          const activeTab = document.querySelector(".nav-item.active");
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showLoading(container, "Atualizando...");
            }
          }
          
          // Forçar recarregamento dos dados
          const ocorrencias = await loadOccurrences(true);
          
          // Aplicar filtros existentes
          let filteredOcorrencias = ocorrencias;
          
          // Aplicar filtro de data
          if (dateFilter && dateFilter.value !== 'all') {
            filteredOcorrencias = applyDateFilter(filteredOcorrencias, dateFilter.value);
          }
          
          // Aplicar filtro de pesquisa
          if (lastSearchTerm) {
            filteredOcorrencias = filteredOcorrencias.filter(ocorrencia => {
              const nome = ocorrencia.nome ? ocorrencia.nome.toLowerCase() : "";
              const occurrenceId = (ocorrencia.id || ocorrencia.occurrenceNumber || "").toString().toLowerCase();
              const cpf = ocorrencia.cpf ? ocorrencia.cpf.toString().replace(/\D/g, "") : "";
              const searchTermNumbers = lastSearchTerm.replace(/\D/g, "");
              
              return nome.includes(lastSearchTerm) || 
                     occurrenceId.includes(lastSearchTerm) || 
                     (searchTermNumbers.length > 0 && cpf.includes(searchTermNumbers));
            });
          }
          
          // Atualizar contadores
          updateStatCounters(filteredOcorrencias);
          
          // Atualizar a aba ativa
          if (activeTab) {
            const tabId = activeTab.getAttribute("data-tab");
            const container = document.getElementById(`${tabId}-ocorrencias`);
            
            if (container) {
              // Filtrar pelo tipo da aba
              let tabFilteredOcorrencias = filteredOcorrencias;
              
              if (tabId === "pending") {
                tabFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Pendente");
              } else if (tabId === "completed") {
                tabFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Concluído");
              }
              
              // Ordenar por data (mais recentes primeiro)
              tabFilteredOcorrencias.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              
              // Renderizar ocorrências
              renderOccurrences(container, tabFilteredOcorrencias);
            }
          }
          
          showAlert("Dados atualizados com sucesso!", "success");
          
        } catch (error) {
          console.error("[FIXES] Erro ao atualizar dados:", error);
          showAlert("Erro ao atualizar dados. Tente novamente.", "error");
        }
      });
      
      console.log("[FIXES] Botão de atualização configurado com sucesso");
    }
    
    /**
     * Implementa sincronização entre as abas
     */
    function implementTabSynchronization() {
      console.log("[FIXES] Configurando sincronização entre abas...");
      
      // Obter todas as abas
      const navItems = document.querySelectorAll(".nav-item");
      
      // Adicionar evento para cada aba
      navItems.forEach(item => {
        item.addEventListener("click", async function() {
          // Não fazer nada se a aba já estiver ativa
          if (this.classList.contains("active")) return;
          
          try {
            const tabId = this.getAttribute("data-tab");
            console.log(`[FIXES] Alterando para a aba: ${tabId}`);
            
            const container = document.getElementById(`${tabId}-ocorrencias`);
            if (container) {
              showLoading(container, "Carregando...");
            }
            
            // Carregar ocorrências (usar cache se disponível)
            const ocorrencias = await loadOccurrences();
            
            // Aplicar filtros existentes
            let filteredOcorrencias = ocorrencias;
            
            // Aplicar filtro de data
            if (dateFilter && dateFilter.value !== 'all') {
              filteredOcorrencias = applyDateFilter(filteredOcorrencias, dateFilter.value);
            }
            
            // Aplicar filtro de pesquisa
            if (lastSearchTerm) {
              filteredOcorrencias = filteredOcorrencias.filter(ocorrencia => {
                const nome = ocorrencia.nome ? ocorrencia.nome.toLowerCase() : "";
                const occurrenceId = (ocorrencia.id || ocorrencia.occurrenceNumber || "").toString().toLowerCase();
                const cpf = ocorrencia.cpf ? ocorrencia.cpf.toString().replace(/\D/g, "") : "";
                const searchTermNumbers = lastSearchTerm.replace(/\D/g, "");
                
                return nome.includes(lastSearchTerm) || 
                       occurrenceId.includes(lastSearchTerm) || 
                       (searchTermNumbers.length > 0 && cpf.includes(searchTermNumbers));
              });
            }
            
            // Filtrar pelo status da aba
            let tabFilteredOcorrencias = filteredOcorrencias;
            
            if (tabId === "pending") {
              tabFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Pendente");
            } else if (tabId === "completed") {
              tabFilteredOcorrencias = filteredOcorrencias.filter(o => o.status === "Concluído");
            }
            
            // Ordenar por data (mais recentes primeiro)
            tabFilteredOcorrencias.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            // Renderizar ocorrências
            if (container) {
              renderOccurrences(container, tabFilteredOcorrencias);
            }
            
            // Atualizar título da aba
            if (currentTabTitle) {
              let tabTitle = this.textContent.trim();
              let tabIcon = "list";
              
              if (tabId === "pending") {
                tabIcon = "clock";
                tabTitle = "Solicitações Pendentes";
              } else if (tabId === "completed") {
                tabIcon = "check-circle";
                tabTitle = "Solicitações Concluídas";
              } else if (tabId === "all") {
                tabIcon = "list";
                tabTitle = "Todas as Solicitações";
              }
              
              // Adicionar informações de filtro, se aplicável
              if (dateFilter && dateFilter.value !== 'all') {
                let filterTitle = "";
                switch (dateFilter.value) {
                  case "today": filterTitle = "Hoje"; break;
                  case "week": filterTitle = "Esta semana"; break;
                  case "month": filterTitle = "Este mês"; break;
                }
                
                currentTabTitle.innerHTML = `<i class="fas fa-${tabIcon}"></i> ${tabTitle} - Filtro: ${filterTitle}`;
              } else {
                currentTabTitle.innerHTML = `<i class="fas fa-${tabIcon}"></i> ${tabTitle}`;
              }
            }
            
            // Atualizar contadores
            updateStatCounters(filteredOcorrencias);
            
          } catch (error) {
            console.error("[FIXES] Erro ao sincronizar abas:", error);
            showAlert("Erro ao carregar dados da aba. Tente novamente.", "error");
          }
        });
      });
      
      console.log("[FIXES] Sincronização entre abas configurada com sucesso");
    }
    
    // ===== AJUSTES DE LAYOUT =====
    
    function adjustLayout() {
      console.log("[FIXES] Ajustando layout...");
      
      // Ajustar o título para que "Painel" e "Administrativo" fiquem na mesma linha
      const appTitle = document.querySelector('h1') || document.querySelector('.app-title');
      if (appTitle) {
        appTitle.style.display = 'flex';
        appTitle.style.flexDirection = 'row';
        appTitle.style.alignItems = 'center';
        appTitle.style.gap = '4px';
      }
      
      // Ajustar diretamente os elementos de cabeçalho se existirem
      const painelAdminHeader = document.querySelector('.painel-admin-header');
      if (painelAdminHeader) {
        painelAdminHeader.style.display = 'flex';
        painelAdminHeader.style.flexDirection = 'row';
        painelAdminHeader.style.alignItems = 'center';
        painelAdminHeader.style.gap = '4px';
      }
      
      // Ajustar layout da barra de pesquisa para ficar mais próxima do botão
      const searchForm = document.querySelector('.search-form');
      if (searchForm) {
        searchForm.style.flex = '1';
        searchForm.style.display = 'flex';
        searchForm.style.alignItems = 'center';
        searchForm.style.gap = '4px';
      }
      
      // Apenas adicionar um estilo simples para aproximar o campo de busca e o botão
      const searchStyleOnly = document.createElement("style");
      searchStyleOnly.textContent = `
        /* Estilo muito específico apenas para aproximar a barra de busca do botão */
        input[type="text"][placeholder*="Buscar"], input[type="search"][placeholder*="Buscar"] {
          margin-right: -1px !important;
        }
        
        /* Garantir que não afete outras funcionalidades */
        .search-form, form:has(input[placeholder*="Buscar"]) {
          display: flex;
          align-items: center;
        }
      `;
      document.head.appendChild(searchStyleOnly);
      
      // Centralizar elementos no header
      const headerActions = document.querySelector('.header-actions');
      if (headerActions) {
        headerActions.style.display = 'flex';
        headerActions.style.alignItems = 'center';
        headerActions.style.justifyContent = 'space-between';
        headerActions.style.width = '100%';
      }
      
      // Adicionar estilos para melhorar responsividade e layout geral
      const styleElement = document.createElement("style");
      styleElement.textContent = `
        /* Ajustes para o cabeçalho principal */
        .main-header h1, .app-title, .panel-title {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 4px !important;
          white-space: nowrap !important;
        }
        
        /* Ajustes para a barra de pesquisa */
        .search-form {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
        }
        
        .search-form input {
          margin-right: 4px !important;
        }
        
        .search-form button {
          margin-left: 0 !important;
        }
        
        @media (max-width: 768px) {
          .header-actions {
            flex-direction: column;
            gap: 15px;
          }
          
          .search-form {
            width: 100%;
          }
          
          .search-form input {
            width: 100%;
          }
          
          .filter-dropdown {
            width: 100%;
          }
          
          .filter-dropdown select {
            width: 100%;
          }
        }
        
        /* Melhorias visuais nos cards */
        .ocorrencia-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .ocorrencia-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Melhorias no status */
        .ocorrencia-status {
          border-radius: 4px;
          padding: 4px 8px;
          font-weight: 600;
        }
        
        /* Melhores indicadores visuais */
        .status-pendente, .status-pendente .ocorrencia-status {
          background-color: rgba(251, 191, 36, 0.1);
          color: #d97706;
        }
        
        .status-concluido, .status-concluido .ocorrencia-status {
          background-color: rgba(16, 185, 129, 0.1);
          color: #059669;
        }
        
        /* Melhorar visualização de loading */
        .loading {
          text-align: center;
          padding: 40px 0;
        }
        
        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: #3b82f6;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleElement);
      
      console.log("[FIXES] Layout ajustado com sucesso");
    }
    
    // ===== INICIALIZAÇÃO DAS CORREÇÕES =====
    
    function initFixes() {
      console.log("[FIXES] Iniciando implementação de correções...");
      
      // 1. Implementar pesquisa avançada
      implementAdvancedSearch();
      
      // 2. Implementar filtros de data
      implementDateFilters();
      
      // 3. Remover funcionalidade de notificações
      removeNotifications();
      
      // 4. Implementar botão de atualização
      implementRefreshButton();
      
      // 5. Implementar sincronização entre abas
      implementTabSynchronization();
      
      // 6. Ajustar layout
      adjustLayout();
      
      // 7. Carregar dados iniciais
      loadInitialData();
      
      console.log("[FIXES] Todas as correções foram aplicadas com sucesso!");
    }
    
    /**
     * Carrega dados iniciais para a página
     */
    async function loadInitialData() {
      try {
        console.log("[FIXES] Carregando dados iniciais...");
        
        // Carregar todas as ocorrências
        const ocorrencias = await loadOccurrences(true);
        
        // Atualizar contadores estatísticos
        updateStatCounters(ocorrencias);
        
        // Obter aba ativa
        const activeTab = document.querySelector(".nav-item.active");
        if (activeTab) {
          const tabId = activeTab.getAttribute("data-tab");
          const container = document.getElementById(`${tabId}-ocorrencias`);
          
          if (container) {
            // Filtrar ocorrências conforme a aba
            let filteredOcorrencias = ocorrencias;
            
            if (tabId === "pending") {
              filteredOcorrencias = ocorrencias.filter(o => o.status === "Pendente");
            } else if (tabId === "completed") {
              filteredOcorrencias = ocorrencias.filter(o => o.status === "Concluído");
            }
            
            // Ordenar por data (mais recentes primeiro)
            filteredOcorrencias.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            // Renderizar ocorrências
            renderOccurrences(container, filteredOcorrencias);
          }
        }
        
        console.log("[FIXES] Dados iniciais carregados com sucesso");
        
      } catch (error) {
        console.error("[FIXES] Erro ao carregar dados iniciais:", error);
        showAlert("Erro ao carregar dados iniciais. Tente atualizar a página.", "error");
      }
    }
    
    // Iniciar quando o documento estiver pronto
    // Usar setTimeout para garantir que o código original já tenha sido executado
    // Um pequeno delay para garantir que outros scripts foram carregados
    setTimeout(initFixes, 1000);
  });