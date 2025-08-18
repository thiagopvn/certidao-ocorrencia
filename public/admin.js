/**
 * Sistema de Certidões GOCG - Painel Administrativo
 * Arquitetura de Componentes em Vanilla JavaScript
 */

// ============================================
// CONFIGURAÇÃO E ESTADO GLOBAL
// ============================================

const AppState = {
    currentUser: null,
    currentPage: 'dashboard',
    currentOccurrence: null,
    occurrencesCache: null,
    feedbacksCache: null,
    lastCacheUpdate: 0,
    charts: {},
    isLoading: false,
    realtimeListeners: {}
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Estado global do filtro
let currentFilterState = {
    date: 'all',
    search: ''
};

// ============================================
// COMPONENTES DE UI - ARQUITETURA MODULAR
// ============================================

/**
 * Componente: Card de Métrica para Dashboard
 */
function createStatCardComponent(icon, label, value, trend = null, type = 'primary') {
    const card = document.createElement('div');
    card.className = `metric-card ${type}`;
    
    const trendHtml = trend ? `
        <div class="metric-trend ${trend.direction}">
            <i class="fas fa-arrow-${trend.direction === 'up' ? 'up' : 'down'}"></i>
            <span>${trend.value}%</span>
        </div>
    ` : '';
    
    card.innerHTML = `
        <div class="metric-icon">
            <i class="${icon}"></i>
        </div>
        <div class="metric-content">
            <div class="metric-label">${label}</div>
            <div class="metric-value">${value}</div>
        </div>
        ${trendHtml}
    `;
    
    return card;
}

/**
 * Componente: Container para Gráfico
 */
function createChartContainerComponent(id, title) {
    const container = document.createElement('div');
    container.className = 'chart-card';
    
    container.innerHTML = `
        <div class="chart-header">
            <h3 class="chart-title">${title}</h3>
            <button class="btn-icon-sm">
                <i class="fas fa-ellipsis-h"></i>
            </button>
        </div>
        <div class="chart-body">
            <canvas id="${id}"></canvas>
        </div>
    `;
    
    return container;
}

/**
 * Função Helper: Renderizar Estrelas para Avaliação
 */
function renderStars(rating) {
    const maxStars = 5;
    let starsHtml = '';
    
    for (let i = 1; i <= maxStars; i++) {
        const isFilled = i <= rating;
        const starClass = isFilled ? 'star-filled' : 'star-empty';
        const starColor = isFilled ? '#FFC107' : '#E0E0E0';
        
        starsHtml += `<i class="fas fa-star ${starClass}" style="color: ${starColor};"></i>`;
    }
    
    return starsHtml;
}

/**
 * Função Helper: Criar Badge de Tempo de Resposta
 */
function createTempoBadge(tempoKey) {
    const tempoConfig = {
        'muito_rapido': {
            text: 'Muito Rápido',
            color: 'var(--success-color)',
            bgColor: 'var(--success-bg)',
            icon: '<i class="fas fa-rocket"></i>'
        },
        'adequado': {
            text: 'Tempo Adequado',
            color: 'var(--info-color)',
            bgColor: 'var(--info-bg)',
            icon: '<i class="fas fa-thumbs-up"></i>'
        },
        'demorado': {
            text: 'Demorado',
            color: 'var(--warning-color)',
            bgColor: 'var(--warning-bg)',
            icon: '<i class="fas fa-hourglass-half"></i>'
        },
        'muito_demorado': {
            text: 'Muito Demorado',
            color: 'var(--danger-color)',
            bgColor: 'var(--danger-bg)',
            icon: '<i class="fas fa-exclamation-triangle"></i>'
        }
    };
    
    const config = tempoConfig[tempoKey] || tempoConfig['adequado'];
    
    return `
        <div class="tempo-badge" style="
            background: ${config.bgColor};
            color: ${config.color};
            border: 1px solid ${config.color};
        ">
            ${config.icon}
            <span>${config.text}</span>
        </div>
    `;
}

/**
 * Componente: Card de Feedback - Redesign Completo
 */
function createFeedbackCardComponent(feedbackData) {
    const card = document.createElement('div');
    card.className = 'feedback-card-modern';
    
    // Preparar dados
    const date = new Date(feedbackData.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const starsHtml = renderStars(feedbackData.atendimento || feedbackData.rating || 5);
    const tempoBadge = createTempoBadge(feedbackData.tempo || 'adequado');
    
    // Tratar comentário vazio
    const comentario = feedbackData.comentario || feedbackData.comment;
    const comentarioDisplay = comentario && comentario.trim() ? 
        comentario : 
        '<em class="no-comment">Nenhum comentário adicional fornecido</em>';
    
    card.innerHTML = `
        <div class="feedback-card-header">
            <div class="feedback-rating-stars">
                ${starsHtml}
            </div>
            <div class="feedback-date-display">
                <i class="fas fa-calendar-alt"></i>
                <span>${date}</span>
            </div>
        </div>
        
        <div class="feedback-card-body">
            <div class="feedback-comment-content">
                ${comentarioDisplay}
            </div>
        </div>
        
        <div class="feedback-card-footer">
            ${tempoBadge}
        </div>
    `;
    
    return card;
}

/**
 * Componente: Linha da Tabela de Ocorrências
 */
function createOccurrenceTableRowComponent(occurrence, showCancelReason = false) {
    const tr = document.createElement('tr');
    
    const statusClass = occurrence.status.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[áàâã]/g, 'a')
        .replace(/[éèê]/g, 'e')
        .replace(/[íì]/g, 'i')
        .replace(/[óòôõ]/g, 'o')
        .replace(/[úù]/g, 'u');
    
    const date = new Date(occurrence.timestamp).toLocaleDateString('pt-BR');
    
    // Coluna de motivo de cancelamento se necessário
    const cancelReasonColumn = showCancelReason ? `
        <td>
            ${occurrence.status === 'Cancelado' && occurrence.motivoCancelamento ? `
                <div class="cancel-reason-tooltip" data-tooltip="${occurrence.motivoCancelamento.motivo}">
                    <span class="cancel-reason">${occurrence.motivoCancelamento.motivo}</span>
                </div>
            ` : '-'}
        </td>
    ` : '';
    
    tr.innerHTML = `
        <td>${occurrence.occurrenceNumber || occurrence.id}</td>
        <td>${occurrence.nome}</td>
        <td>${formatCPF(occurrence.cpf)}</td>
        <td>${date}</td>
        <td>
            <span class="status-badge ${statusClass}">
                <i class="fas ${getStatusIcon(occurrence.status)}"></i>
                ${occurrence.status}
            </span>
        </td>
        ${cancelReasonColumn}
        <td>
            <div class="table-actions">
                <button class="btn-table" onclick="openOccurrenceDetails('${occurrence.id}')">
                    <i class="fas fa-eye"></i>
                    Ver
                </button>
                ${occurrence.status === 'Concluído' && occurrence.certidao ? `
                    <a href="${occurrence.certidao.url}" target="_blank" class="btn-table success">
                        <i class="fas fa-certificate"></i>
                        Certidão
                    </a>
                ` : ''}
            </div>
        </td>
    `;
    
    return tr;
}

/**
 * Componente: Tabela de Ocorrências
 */
function createOccurrenceTableComponent(occurrences, filter = null) {
    const container = document.createElement('div');
    container.className = 'occurrence-table-container';
    
    if (!occurrences || occurrences.length === 0) {
        container.innerHTML = createEmptyStateComponent('Nenhuma ocorrência encontrada');
        return container;
    }
    
    const table = document.createElement('table');
    table.className = 'occurrence-table';
    
    // Header da tabela com coluna condicional para motivo de cancelamento
    const showCancelReason = filter === 'canceled';
    const cancelReasonHeader = showCancelReason ? '<th>Motivo do Cancelamento</th>' : '';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>Número</th>
                <th>Nome</th>
                <th>CPF</th>
                <th>Data</th>
                <th>Status</th>
                ${cancelReasonHeader}
                <th>Ações</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    occurrences.forEach(occurrence => {
        tbody.appendChild(createOccurrenceTableRowComponent(occurrence, showCancelReason));
    });
    
    container.appendChild(table);
    return container;
}

/**
 * Componente: Modal de Detalhes - Seção
 */
function createModalSectionComponent(title, icon, content) {
    const section = document.createElement('div');
    section.className = 'modal-section';
    
    section.innerHTML = `
        <h3 class="modal-section-title">
            <i class="${icon}"></i>
            ${title}
        </h3>
        <div class="section-content"></div>
    `;
    
    const contentDiv = section.querySelector('.section-content');
    if (typeof content === 'string') {
        contentDiv.innerHTML = content;
    } else {
        contentDiv.appendChild(content);
    }
    
    return section;
}

/**
 * Componente: Par de Informação (Label/Valor)
 */
function createInfoPairComponent(label, value) {
    const div = document.createElement('div');
    div.className = 'info-item';
    
    div.innerHTML = `
        <div class="info-label">${label}</div>
        <div class="info-value">${value || 'N/A'}</div>
    `;
    
    return div;
}

/**
 * Componente: Modal de Detalhes Completo
 */
function createDetailModalComponent(occurrence) {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = '';
    
    // Criar abas do modal
    const tabs = document.createElement('div');
    tabs.className = 'modal-tabs';
    tabs.innerHTML = `
        <button class="modal-tab active" data-tab="summary">
            <i class="fas fa-chart-line"></i>
            Resumo
        </button>
        <button class="modal-tab" data-tab="requester">
            <i class="fas fa-user"></i>
            Dados do Solicitante
        </button>
        <button class="modal-tab" data-tab="details">
            <i class="fas fa-info-circle"></i>
            Detalhes da Ocorrência
        </button>
        <button class="modal-tab" data-tab="documents">
            <i class="fas fa-folder"></i>
            Documentos
        </button>
    `;
    
    modalBody.appendChild(tabs);
    
    // Container de conteúdo das abas
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    
    // Aba Resumo
    const summaryTab = document.createElement('div');
    summaryTab.id = 'tab-summary';
    summaryTab.className = 'tab-pane active';
    
    const statusBadge = createStatusBadgeComponent(occurrence.status);
    const date = new Date(occurrence.timestamp).toLocaleString('pt-BR');
    
    // Campos condicionais para cancelamento
    const cancelInfoHtml = occurrence.status === 'Cancelado' && occurrence.motivoCancelamento ? `
        ${createInfoPairComponent('<i class="fas fa-ban"></i> Motivo do Cancelamento', occurrence.motivoCancelamento.motivo).outerHTML}
        ${createInfoPairComponent('<i class="fas fa-user-times"></i> Cancelado por', occurrence.motivoCancelamento.canceladoPor).outerHTML}
        ${createInfoPairComponent('<i class="fas fa-calendar-times"></i> Data do Cancelamento', 
            new Date(occurrence.motivoCancelamento.dataCancelamento).toLocaleString('pt-BR')
        ).outerHTML}
    ` : '';

    summaryTab.innerHTML = `
        <div class="info-grid">
            ${createInfoPairComponent('<i class="fas fa-hashtag"></i> Número', occurrence.occurrenceNumber || occurrence.id).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-info-circle"></i> Status', statusBadge).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-calendar-alt"></i> Data de Solicitação', date).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-clock"></i> Última Atualização', 
                occurrence.dataAtualizacao ? new Date(occurrence.dataAtualizacao).toLocaleString('pt-BR') : 'N/A'
            ).outerHTML}
            ${cancelInfoHtml}
        </div>
    `;
    
    // Aba Solicitante
    const requesterTab = document.createElement('div');
    requesterTab.id = 'tab-requester';
    requesterTab.className = 'tab-pane';
    requesterTab.innerHTML = `
        <div class="info-grid">
            ${createInfoPairComponent('<i class="fas fa-user"></i> Nome Completo', occurrence.nome).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-users"></i> Relação com a Vítima', occurrence.relacaoSolicitante || 'N/A').outerHTML}
            ${createInfoPairComponent('<i class="fas fa-id-card"></i> CPF', formatCPF(occurrence.cpf)).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-address-card"></i> RG', occurrence.rg).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-envelope"></i> E-mail', occurrence.email).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-phone"></i> Telefone', formatPhone(occurrence.telefone)).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-home"></i> Endereço', occurrence.enderecoSolicitante).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-building"></i> Bairro', occurrence.bairro).outerHTML}
        </div>
    `;
    
    // Aba Detalhes
    const detailsTab = document.createElement('div');
    detailsTab.id = 'tab-details';
    detailsTab.className = 'tab-pane';
    detailsTab.innerHTML = `
        <div class="info-grid">
            ${createInfoPairComponent('<i class="fas fa-calendar-day"></i> Data da Ocorrência', 
                occurrence.dataOcorrencia ? new Date(occurrence.dataOcorrencia).toLocaleDateString('pt-BR') : 'N/A'
            ).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-clock"></i> Hora', occurrence.horaOcorrencia).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-sun"></i> Turno', occurrence.turno).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-map-marker-alt"></i> Endereço da Ocorrência', occurrence.enderecoOcorrencia).outerHTML}
            ${createInfoPairComponent('<i class="fas fa-align-left"></i> Descrição', occurrence.descricao).outerHTML}
        </div>
    `;
    
    // Aba Documentos
    const documentsTab = document.createElement('div');
    documentsTab.id = 'tab-documents';
    documentsTab.className = 'tab-pane';
    documentsTab.appendChild(createDocumentsListComponent(occurrence.documentos));
    
    tabContent.appendChild(summaryTab);
    tabContent.appendChild(requesterTab);
    tabContent.appendChild(detailsTab);
    tabContent.appendChild(documentsTab);
    
    modalBody.appendChild(tabContent);
    
    // Adicionar event listeners para as abas
    tabs.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tabContent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const pane = tabContent.querySelector(`#tab-${tab.dataset.tab}`);
            if (pane) pane.classList.add('active');
        });
    });
    
    // Atualizar status no select
    const statusSelect = document.getElementById('status-select');
    if (statusSelect) {
        statusSelect.value = occurrence.status;
        
        // Adicionar event listener para mudanças de status
        statusSelect.addEventListener('change', () => {
            updateUploadSectionVisibility(occurrence, false); // Não limpar arquivo no change
        });
    }
    
    // Controlar visibilidade da área de upload
    updateUploadSectionVisibility(occurrence, false); // Não limpar arquivo na inicialização
}

/**
 * Função: Controlar Visibilidade da Seção de Upload
 */
function updateUploadSectionVisibility(occurrence, clearFile = false) {
    const uploadSection = document.getElementById('upload-section');
    const statusSelect = document.getElementById('status-select');
    
    if (!uploadSection || !statusSelect) return;
    
    const currentStatus = statusSelect.value;
    
    // Mostrar seção de upload quando:
    // 1. Status atual é "Concluído" 
    // 2. Status está "Pendente" (para permitir anexar certidão)
    // Nota: Sempre mostrar para estes status, independente de ter certidão ou não
    
    const shouldShowUpload = 
        currentStatus === 'Concluído' || 
        currentStatus === 'Pendente';
    
    if (shouldShowUpload) {
        uploadSection.style.display = 'block';
        
        // Só limpar arquivo se explicitamente solicitado (por exemplo, após update status)
        if (clearFile && currentStatus === 'Pendente') {
            const fileInput = document.getElementById('certidao-file');
            const fileInfo = document.getElementById('file-info');
            
            if (fileInput) {
                fileInput.value = '';
            }
            if (fileInfo) {
                fileInfo.style.display = 'none';
                fileInfo.classList.remove('active');
            }
        }
    } else {
        uploadSection.style.display = 'none';
    }
}

/**
 * Componente: Badge de Status
 */
function createStatusBadgeComponent(status) {
    const statusClass = status.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[áàâã]/g, 'a')
        .replace(/[éèê]/g, 'e')
        .replace(/[íì]/g, 'i')
        .replace(/[óòôõ]/g, 'o')
        .replace(/[úù]/g, 'u');
    
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

/**
 * Componente: Lista de Documentos
 */
function createDocumentsListComponent(documents) {
    const container = document.createElement('div');
    container.className = 'documents-list';
    
    if (!documents) {
        container.innerHTML = '<p>Nenhum documento anexado</p>';
        return container;
    }
    
    const docList = [];
    
    if (documents.documentoIdentidade) {
        docList.push({
            name: 'Documento de Identidade',
            icon: 'fa-id-card',
            url: documents.documentoIdentidade.url
        });
    }
    
    if (documents.comprovanteResidencia) {
        docList.push({
            name: 'Comprovante de Residência',
            icon: 'fa-home',
            url: documents.comprovanteResidencia.url
        });
    }
    
    if (documents.documentoCarro) {
        docList.push({
            name: 'Documento do Veículo',
            icon: 'fa-car',
            url: documents.documentoCarro.url
        });
    }
    
    docList.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.innerHTML = `
            <i class="fas ${doc.icon}"></i>
            <span>${doc.name}</span>
            <a href="${doc.url}" target="_blank" class="btn-table secondary">
                <i class="fas fa-download"></i>
                Baixar
            </a>
        `;
        container.appendChild(item);
    });
    
    if (docList.length === 0) {
        container.innerHTML = '<p>Nenhum documento anexado</p>';
    }
    
    return container;
}

/**
 * Componente: Estado Vazio
 */
function createEmptyStateComponent(message) {
    return `
        <div class="empty-state">
            <i class="fas fa-inbox empty-icon"></i>
            <h3 class="empty-title">Nada aqui</h3>
            <p class="empty-message">${message}</p>
        </div>
    `;
}

/**
 * Componente: Loading
 */
function createLoadingComponent() {
    return `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
}

/**
 * Componente: Barra de Progresso Estilizada
 */
function createProgressBarComponent() {
    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'progress-overlay';
    progressOverlay.id = 'progress-overlay';
    
    progressOverlay.innerHTML = `
        <div class="progress-container">
            <div class="progress-header">
                <div class="progress-icon">
                    <i class="fas fa-sync-alt fa-spin"></i>
                </div>
                <h3 class="progress-title">Atualizando Status</h3>
                <p class="progress-subtitle">Processando sua solicitação...</p>
            </div>
            
            <div class="progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-bar-fill" id="progress-bar-fill"></div>
                    <div class="progress-bar-glow" id="progress-bar-glow"></div>
                </div>
                <div class="progress-percentage" id="progress-percentage">0%</div>
            </div>
            
            <div class="progress-steps">
                <div class="progress-step active" id="step-1">
                    <div class="step-icon">
                        <i class="fas fa-check"></i>
                    </div>
                    <span class="step-text">Validando dados</span>
                </div>
                <div class="progress-step" id="step-2">
                    <div class="step-icon">
                        <i class="fas fa-upload"></i>
                    </div>
                    <span class="step-text">Processando arquivos</span>
                </div>
                <div class="progress-step" id="step-3">
                    <div class="step-icon">
                        <i class="fas fa-database"></i>
                    </div>
                    <span class="step-text">Salvando alterações</span>
                </div>
                <div class="progress-step" id="step-4">
                    <div class="step-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <span class="step-text">Concluído</span>
                </div>
            </div>
            
            <div class="progress-message" id="progress-message">
                Iniciando processo...
            </div>
        </div>
    `;
    
    return progressOverlay;
}

/**
 * Controle da Barra de Progresso
 */
class ProgressController {
    constructor() {
        this.overlay = null;
        this.currentStep = 0;
        this.progress = 0;
        this.messages = [
            'Validando informações...',
            'Processando arquivos...',
            'Salvando alterações e enviando emails...',
            'Finalizando processo...'
        ];
    }
    
    show() {
        // Remover overlay existente se houver
        this.hide();
        
        this.overlay = createProgressBarComponent();
        document.body.appendChild(this.overlay);
        
        // Trigger animação de entrada
        setTimeout(() => {
            this.overlay.classList.add('active');
        }, 50);
        
        // Iniciar primeiro step
        this.nextStep();
    }
    
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                if (this.overlay && document.body.contains(this.overlay)) {
                    document.body.removeChild(this.overlay);
                }
                this.overlay = null;
            }, 300);
        }
        this.reset();
    }
    
    nextStep() {
        if (this.currentStep < 4) {
            this.currentStep++;
            this.updateProgress();
        }
    }
    
    updateProgress() {
        if (!this.overlay) return;
        
        const targetProgress = (this.currentStep / 4) * 100;
        const progressFill = this.overlay.querySelector('#progress-bar-fill');
        const progressGlow = this.overlay.querySelector('#progress-bar-glow');
        const progressPercentage = this.overlay.querySelector('#progress-percentage');
        const progressMessage = this.overlay.querySelector('#progress-message');
        
        // Animar progresso
        this.animateProgress(this.progress, targetProgress, (value) => {
            progressFill.style.width = value + '%';
            progressGlow.style.width = value + '%';
            progressPercentage.textContent = Math.round(value) + '%';
        });
        
        this.progress = targetProgress;
        
        // Atualizar steps
        for (let i = 1; i <= 4; i++) {
            const step = this.overlay.querySelector(`#step-${i}`);
            if (i <= this.currentStep) {
                step.classList.add('active');
                if (i < this.currentStep) {
                    step.classList.add('completed');
                }
            }
        }
        
        // Atualizar mensagem
        if (this.currentStep <= this.messages.length) {
            progressMessage.textContent = this.messages[this.currentStep - 1];
        }
    }
    
    animateProgress(start, end, callback) {
        const duration = 800;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const value = start + (end - start) * easeOut;
            
            callback(value);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    setError(message) {
        if (!this.overlay) return;
        
        const progressMessage = this.overlay.querySelector('#progress-message');
        const progressIcon = this.overlay.querySelector('.progress-icon i');
        const progressTitle = this.overlay.querySelector('.progress-title');
        
        progressIcon.className = 'fas fa-exclamation-triangle';
        progressIcon.style.color = 'var(--danger-color)';
        progressTitle.textContent = 'Erro na Atualização';
        progressMessage.textContent = message;
        progressMessage.style.color = 'var(--danger-color)';
        
        // Auto-close após 3 segundos
        setTimeout(() => this.hide(), 3000);
    }
    
    setSuccess() {
        if (!this.overlay) return;
        
        const progressMessage = this.overlay.querySelector('#progress-message');
        const progressIcon = this.overlay.querySelector('.progress-icon i');
        const progressTitle = this.overlay.querySelector('.progress-title');
        
        progressIcon.className = 'fas fa-check-circle';
        progressIcon.style.color = 'var(--success-color)';
        progressTitle.textContent = 'Status Atualizado!';
        progressMessage.textContent = 'Processo concluído com sucesso.';
        progressMessage.style.color = 'var(--success-color)';
        
        // Auto-close após 2 segundos
        setTimeout(() => this.hide(), 2000);
    }
    
    reset() {
        this.currentStep = 0;
        this.progress = 0;
    }
}

// Instância global do controlador de progresso
const progressController = new ProgressController();

/**
 * Componente: Toast de Notificação
 */
function createToastComponent(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    // Auto-remover após 5 segundos
    setTimeout(() => toast.remove(), 5000);
    
    return toast;
}

/**
 * Componente: Filtro de Data Universal
 */
function createDateFilterComponent(callback) {
    const container = document.createElement('div');
    container.className = 'date-filter-container';
    
    const filterOptions = [
        { value: 'today', label: 'Hoje', icon: 'fa-calendar-day' },
        { value: 'week', label: 'Esta Semana', icon: 'fa-calendar-week' },
        { value: 'month', label: 'Este Mês', icon: 'fa-calendar-alt' },
        { value: 'year', label: 'Este Ano', icon: 'fa-calendar' },
        { value: 'all', label: 'Todo o Período', icon: 'fa-infinity' }
    ];
    
    const getCurrentLabel = () => {
        const current = filterOptions.find(opt => opt.value === currentFilterState.date);
        return current ? current.label : 'Todo o Período';
    };
    
    const getCurrentIcon = () => {
        const current = filterOptions.find(opt => opt.value === currentFilterState.date);
        return current ? current.icon : 'fa-infinity';
    };
    
    container.innerHTML = `
        <div class="date-filter-dropdown">
            <button class="date-filter-button" type="button">
                <span class="filter-icon">
                    <i class="fas ${getCurrentIcon()}"></i>
                </span>
                <span class="filter-label">${getCurrentLabel()}</span>
                <span class="filter-arrow">
                    <i class="fas fa-chevron-down"></i>
                </span>
            </button>
            <div class="date-filter-menu">
                ${filterOptions.map(option => `
                    <button class="filter-option ${currentFilterState.date === option.value ? 'active' : ''}" 
                            data-value="${option.value}" type="button">
                        <i class="fas ${option.icon}"></i>
                        <span>${option.label}</span>
                        ${currentFilterState.date === option.value ? '<i class="fas fa-check"></i>' : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    const button = container.querySelector('.date-filter-button');
    const menu = container.querySelector('.date-filter-menu');
    const options = container.querySelectorAll('.filter-option');
    
    // Toggle dropdown
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
        button.classList.toggle('active');
        
        // Fechar outros dropdowns abertos
        document.querySelectorAll('.date-filter-menu.show').forEach(m => {
            if (m !== menu) {
                m.classList.remove('show');
                m.parentElement.querySelector('.date-filter-button').classList.remove('active');
            }
        });
    });
    
    // Selecionar opção
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            
            // Atualizar estado
            currentFilterState.date = value;
            
            // Atualizar UI do botão
            const newOption = filterOptions.find(opt => opt.value === value);
            const icon = container.querySelector('.filter-icon i');
            const label = container.querySelector('.filter-label');
            
            icon.className = `fas ${newOption.icon}`;
            label.textContent = newOption.label;
            
            // Atualizar opções ativas
            options.forEach(opt => {
                opt.classList.remove('active');
                const check = opt.querySelector('.fa-check');
                if (check) check.remove();
            });
            
            option.classList.add('active');
            option.insertAdjacentHTML('beforeend', '<i class="fas fa-check"></i>');
            
            // Fechar menu
            menu.classList.remove('show');
            button.classList.remove('active');
            
            // Executar callback
            if (callback) callback(value);
        });
    });
    
    // Fechar ao clicar fora
    document.addEventListener('click', () => {
        menu.classList.remove('show');
        button.classList.remove('active');
    });
    
    return container;
}

// ============================================
// FUNÇÕES DE FILTRAGEM DE DATA
// ============================================

/**
 * Retorna o intervalo de datas baseado no tipo de filtro
 */
function getDateRange(filterType) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
        case 'today':
            return {
                start: today.getTime(),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).getTime()
            };
            
        case 'week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
            endOfWeek.setHours(23, 59, 59, 999);
            
            return {
                start: startOfWeek.getTime(),
                end: endOfWeek.getTime()
            };
            
        case 'month':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            
            return {
                start: startOfMonth.getTime(),
                end: endOfMonth.getTime()
            };
            
        case 'year':
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999);
            
            return {
                start: startOfYear.getTime(),
                end: endOfYear.getTime()
            };
            
        case 'all':
        default:
            return null; // Sem filtro
    }
}

/**
 * Filtra ocorrências por período de data
 */
function filterOcorrenciasByDate(ocorrencias, filterType) {
    if (!ocorrencias || !Array.isArray(ocorrencias)) {
        return [];
    }
    
    if (filterType === 'all') {
        return ocorrencias;
    }
    
    const dateRange = getDateRange(filterType);
    if (!dateRange) {
        return ocorrencias;
    }
    
    return ocorrencias.filter(ocorrencia => {
        const timestamp = ocorrencia.timestamp;
        return timestamp >= dateRange.start && timestamp <= dateRange.end;
    });
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function formatCPF(cpf) {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatPhone(phone) {
    if (!phone) return '';
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

function getStatusIcon(status) {
    if (!status) return 'fa-question-circle';
    
    const statusMap = {
        'Pendente': 'fa-clock',
        'Em andamento': 'fa-spinner',
        'Concluído': 'fa-check-circle',
        'Cancelado': 'fa-ban',
        'Teste': 'fa-flask'
    };
    
    return statusMap[status] || 'fa-question-circle';
}

/**
 * Modal estilizado para solicitar motivo do cancelamento
 */
function showCancelReasonModal(callback) {
    // Criar overlay do modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'cancel-reason-modal-overlay';
    
    // Criar modal
    const modal = document.createElement('div');
    modal.className = 'cancel-reason-modal';
    
    modal.innerHTML = `
        <div class="cancel-reason-header">
            <div class="cancel-reason-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 class="cancel-reason-title">Cancelar Solicitação</h2>
            <p class="cancel-reason-subtitle">Por favor, informe o motivo do cancelamento desta ocorrência</p>
        </div>
        
        <div class="cancel-reason-body">
            <div class="form-group">
                <label for="cancel-reason-select" class="form-label">
                    <i class="fas fa-list"></i>
                    Selecione um motivo
                </label>
                <select id="cancel-reason-select" class="form-select">
                    <option value="">Selecione um motivo...</option>
                    <option value="Documentação incompleta">Documentação incompleta</option>
                    <option value="Solicitação duplicada">Solicitação duplicada</option>
                    <option value="Dados incorretos">Dados incorretos</option>
                    <option value="Falta de competência">Falta de competência</option>
                    <option value="Desistência do solicitante">Desistência do solicitante</option>
                    <option value="Outros">Outros (especificar abaixo)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="cancel-reason-details" class="form-label">
                    <i class="fas fa-edit"></i>
                    Detalhes adicionais
                </label>
                <textarea 
                    id="cancel-reason-details" 
                    class="form-textarea" 
                    placeholder="Descreva detalhadamente o motivo do cancelamento..."
                    rows="4"
                    maxlength="500"
                ></textarea>
                <div class="character-count">
                    <span id="char-count">0</span>/500 caracteres
                </div>
            </div>
            
            <div class="warning-message">
                <i class="fas fa-info-circle"></i>
                <p>Esta ação não pode ser desfeita. O solicitante será notificado sobre o cancelamento por e-mail.</p>
            </div>
        </div>
        
        <div class="cancel-reason-footer">
            <button type="button" class="btn-cancel-action" id="cancel-action-btn">
                <i class="fas fa-times"></i>
                Cancelar
            </button>
            <button type="button" class="btn-confirm-cancel" id="confirm-cancel-btn">
                <i class="fas fa-ban"></i>
                Confirmar Cancelamento
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Adicionar estilos CSS
    const style = document.createElement('style');
    style.textContent = `
        .cancel-reason-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeInOverlay 0.3s ease-out;
        }
        
        .cancel-reason-modal {
            background: white;
            border-radius: 16px;
            box-shadow: 
                0 20px 60px rgba(0, 0, 0, 0.2),
                0 0 0 1px rgba(255, 255, 255, 0.1);
            width: 90%;
            max-width: 540px;
            max-height: 90vh;
            overflow-y: auto;
            animation: slideUpModal 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .cancel-reason-header {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 24px;
            border-radius: 16px 16px 0 0;
            text-align: center;
            position: relative;
        }
        
        .cancel-reason-icon {
            background: rgba(255, 255, 255, 0.2);
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            backdrop-filter: blur(10px);
        }
        
        .cancel-reason-icon i {
            font-size: 28px;
            color: white;
        }
        
        .cancel-reason-title {
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: white;
        }
        
        .cancel-reason-subtitle {
            font-size: 16px;
            margin: 0;
            opacity: 0.9;
            line-height: 1.5;
        }
        
        .cancel-reason-body {
            padding: 24px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .form-label i {
            color: #6b7280;
        }
        
        .form-select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            transition: all 0.2s ease;
            appearance: none;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 12px center;
            background-repeat: no-repeat;
            background-size: 16px;
            padding-right: 40px;
        }
        
        .form-select:focus {
            outline: none;
            border-color: #f59e0b;
            box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }
        
        .form-textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            min-height: 100px;
            transition: all 0.2s ease;
        }
        
        .form-textarea:focus {
            outline: none;
            border-color: #f59e0b;
            box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }
        
        .character-count {
            text-align: right;
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
        }
        
        .warning-message {
            background: #fef3f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 16px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-top: 20px;
        }
        
        .warning-message i {
            color: #ef4444;
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .warning-message p {
            margin: 0;
            color: #7f1d1d;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .cancel-reason-footer {
            padding: 20px 24px;
            border-top: 1px solid #f3f4f6;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        
        .btn-cancel-action {
            background: #f3f4f6;
            color: #374151;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        
        .btn-cancel-action:hover {
            background: #e5e7eb;
            transform: translateY(-1px);
        }
        
        .btn-confirm-cancel {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        
        .btn-confirm-cancel:hover {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }
        
        .btn-confirm-cancel:disabled {
            background: #d1d5db;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        @keyframes fadeInOverlay {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes slideUpModal {
            from {
                opacity: 0;
                transform: translateY(50px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        @media (max-width: 640px) {
            .cancel-reason-modal {
                margin: 20px;
                width: calc(100% - 40px);
            }
            
            .cancel-reason-footer {
                flex-direction: column;
            }
            
            .btn-cancel-action,
            .btn-confirm-cancel {
                width: 100%;
                justify-content: center;
            }
        }
    `;
    
    document.head.appendChild(style);
    
    // Elementos do modal
    const selectElement = modal.querySelector('#cancel-reason-select');
    const textareaElement = modal.querySelector('#cancel-reason-details');
    const charCountElement = modal.querySelector('#char-count');
    const cancelBtn = modal.querySelector('#cancel-action-btn');
    const confirmBtn = modal.querySelector('#confirm-cancel-btn');
    
    // Contador de caracteres
    textareaElement.addEventListener('input', function() {
        const count = this.value.length;
        charCountElement.textContent = count;
        
        if (count > 450) {
            charCountElement.style.color = '#ef4444';
        } else {
            charCountElement.style.color = '#6b7280';
        }
    });
    
    // Validação e habilitação do botão
    function validateForm() {
        const hasReason = selectElement.value.trim() !== '';
        const hasDetails = textareaElement.value.trim() !== '';
        
        if (selectElement.value === 'Outros') {
            confirmBtn.disabled = !hasDetails;
        } else {
            confirmBtn.disabled = !hasReason;
        }
    }
    
    selectElement.addEventListener('change', validateForm);
    textareaElement.addEventListener('input', validateForm);
    
    // Event listeners
    cancelBtn.addEventListener('click', () => {
        closeModal();
        callback(null);
    });
    
    confirmBtn.addEventListener('click', () => {
        const reason = selectElement.value;
        const details = textareaElement.value.trim();
        
        let finalReason = reason;
        if (reason === 'Outros' && details) {
            finalReason = details;
        } else if (reason && details) {
            finalReason = `${reason} - ${details}`;
        }
        
        if (finalReason) {
            closeModal();
            callback(finalReason);
        }
    });
    
    // Fechar modal ao clicar no overlay
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
            callback(null);
        }
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            callback(null);
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    function closeModal() {
        modalOverlay.style.animation = 'fadeInOverlay 0.2s ease-out reverse';
        modal.style.animation = 'slideUpModal 0.2s ease-out reverse';
        
        setTimeout(() => {
            if (document.body.contains(modalOverlay)) {
                document.body.removeChild(modalOverlay);
            }
        }, 200);
    }
    
    // Focar no select
    setTimeout(() => {
        selectElement.focus();
    }, 100);
    
    // Validação inicial
    validateForm();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = createToastComponent(message, type);
    container.appendChild(toast);
}

function showLoading(container) {
    container.innerHTML = createLoadingComponent();
}

// ============================================
// GERENCIAMENTO DE PÁGINAS
// ============================================

function navigateToPage(pageName) {
    // Atualizar estado
    AppState.currentPage = pageName;
    
    // Limpar filtro existente no header para evitar duplicação
    const headerRight = document.querySelector('.header-right');
    const existingFilter = headerRight.querySelector('.date-filter-container');
    if (existingFilter) {
        existingFilter.remove();
    }
    
    // Atualizar navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageName);
    });
    
    // Atualizar páginas
    document.querySelectorAll('.admin-page').forEach(page => {
        page.classList.toggle('active', page.id === `${pageName}-page`);
    });
    
    // Atualizar título
    const titles = {
        'dashboard': 'Dashboard',
        'pending': 'Solicitações Pendentes',
        'in-progress': 'Em Andamento',
        'completed': 'Concluídas',
        'canceled': 'Canceladas',
        'all': 'Todas as Solicitações',
        'feedbacks': 'Feedbacks'
    };
    
    document.getElementById('page-title').textContent = titles[pageName] || 'Dashboard';
    
    // Carregar dados específicos da página
    loadPageData(pageName);
}

async function loadPageData(pageName) {
    switch(pageName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'pending':
        case 'in-progress':
        case 'completed':
        case 'canceled':
        case 'all':
            await loadOccurrences(pageName);
            break;
        case 'feedbacks':
            await loadFeedbacks();
            break;
    }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    try {
        // Adicionar filtro de data ao dashboard
        const headerRight = document.querySelector('.header-right');
        let existingFilter = headerRight.querySelector('.date-filter-container');
        
        if (!existingFilter) {
            const dateFilter = createDateFilterComponent((newFilterType) => {
                currentFilterState.date = newFilterType;
                loadDashboard(); // Recarregar dashboard com novo filtro
            });
            headerRight.appendChild(dateFilter);
        }
        
        // Carregar métricas
        await loadMetrics();
        
        // Carregar gráficos
        await loadCharts();
        
        // Carregar feedbacks recentes
        await loadRecentFeedbacks();
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showToast('Erro ao carregar dashboard', 'error');
    }
}

async function loadMetrics() {
    const metricsContainer = document.getElementById('metrics-container');
    showLoading(metricsContainer);
    
    try {
        const allOccurrences = await fetchOccurrences();
        
        // Aplicar filtro de data
        const filteredOccurrences = filterOcorrenciasByDate(allOccurrences, currentFilterState.date);
        
        const metrics = {
            pending: filteredOccurrences.filter(o => o.status === 'Pendente').length,
            inProgress: filteredOccurrences.filter(o => o.status === 'Em andamento').length,
            completed: filteredOccurrences.filter(o => o.status === 'Concluído').length,
            canceled: filteredOccurrences.filter(o => o.status === 'Cancelado').length,
            total: filteredOccurrences.length
        };
        
        // Calcular métricas do mês atual sempre (para o card "Este Mês")
        const thisMonth = allOccurrences.filter(o => {
            const date = new Date(o.timestamp);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;
        
        // Calcular tendência baseada no período selecionado
        let trend = null;
        if (currentFilterState.date === 'month' || currentFilterState.date === 'all') {
            trend = thisMonth > 0 ? {
                direction: 'up',
                value: Math.round((thisMonth / allOccurrences.length) * 100)
            } : null;
        }
        
        metricsContainer.innerHTML = '';
        
        // Criar cards de métricas
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-clock', 'Pendentes', metrics.pending, null, 'warning')
        );
        
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-spinner', 'Em Andamento', metrics.inProgress, null, 'info')
        );
        
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-check-circle', 'Concluídas', metrics.completed, trend, 'success')
        );
        
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-ban', 'Canceladas', metrics.canceled, null, 'danger')
        );
        
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-calendar-alt', 'Este Mês', thisMonth, null, 'primary')
        );
        
        metricsContainer.appendChild(
            createStatCardComponent('fas fa-list', 'Total', metrics.total, null, 'primary')
        );
        
        // Atualizar badges na navegação
        document.getElementById('pending-count').textContent = metrics.pending;
        document.getElementById('inprogress-count').textContent = metrics.inProgress;
        document.getElementById('completed-count').textContent = metrics.completed;
        document.getElementById('canceled-count').textContent = metrics.canceled;
        
    } catch (error) {
        console.error('Erro ao carregar métricas:', error);
        metricsContainer.innerHTML = createEmptyStateComponent('Erro ao carregar métricas');
    }
}

async function loadCharts() {
    try {
        const allOccurrences = await fetchOccurrences();
        
        // Aplicar filtro de data
        const filteredOccurrences = filterOcorrenciasByDate(allOccurrences, currentFilterState.date);
        
        // Gráfico de Status
        const statusCtx = document.getElementById('statusChart');
        if (statusCtx) {
            const statusCounts = {
                'Pendente': filteredOccurrences.filter(o => o.status === 'Pendente').length,
                'Em andamento': filteredOccurrences.filter(o => o.status === 'Em andamento').length,
                'Concluído': filteredOccurrences.filter(o => o.status === 'Concluído').length,
                'Cancelado': filteredOccurrences.filter(o => o.status === 'Cancelado').length
            };
            
            if (AppState.charts.status) {
                AppState.charts.status.destroy();
            }
            
            AppState.charts.status = new Chart(statusCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(statusCounts),
                    datasets: [{
                        label: 'Quantidade de Solicitações',
                        data: Object.values(statusCounts),
                        backgroundColor: [
                            '#F59E0B',
                            '#06B6D4',
                            '#10B981',
                            '#EF4444'
                        ],
                        borderColor: [
                            '#D97706',
                            '#0891B2',
                            '#059669',
                            '#DC2626'
                        ],
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
        
        // Gráfico de Volume
        const volumeCtx = document.getElementById('volumeChart');
        if (volumeCtx) {
            const last30Days = getLast30DaysData(filteredOccurrences);
            
            if (AppState.charts.volume) {
                AppState.charts.volume.destroy();
            }
            
            AppState.charts.volume = new Chart(volumeCtx, {
                type: 'line',
                data: {
                    labels: last30Days.labels,
                    datasets: [{
                        label: 'Solicitações',
                        data: last30Days.data,
                        borderColor: '#DC2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
    }
}

function getLast30DaysData(occurrences) {
    const days = 30;
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const count = occurrences.filter(o => {
            const occDate = new Date(o.timestamp);
            return occDate >= dayStart && occDate <= dayEnd;
        }).length;
        
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        data.push(count);
    }
    
    return { labels, data };
}

async function loadRecentFeedbacks() {
    const container = document.getElementById('feedbacks-container');
    showLoading(container);
    
    try {
        const feedbacks = await fetchFeedbacks();
        const recentFeedbacks = feedbacks.slice(0, 4);
        
        container.innerHTML = '';
        
        if (recentFeedbacks.length === 0) {
            container.innerHTML = createEmptyStateComponent('Nenhum feedback recente');
        } else {
            recentFeedbacks.forEach(feedback => {
                container.appendChild(createFeedbackCardComponent(feedback));
            });
        }
    } catch (error) {
        console.error('Erro ao carregar feedbacks:', error);
        container.innerHTML = createEmptyStateComponent('Erro ao carregar feedbacks');
    }
}

// ============================================
// OCORRÊNCIAS
// ============================================

async function loadOccurrences(filter) {
    const containerId = filter === 'all' ? 'all-list' : 
                       filter === 'in-progress' ? 'inprogress-list' :
                       `${filter}-list`;
    
    const container = document.getElementById(containerId);
    showLoading(container);
    
    try {
        // Adicionar filtro de data às páginas de listagem
        const headerRight = document.querySelector('.header-right');
        let existingFilter = headerRight.querySelector('.date-filter-container');
        
        if (!existingFilter) {
            const dateFilter = createDateFilterComponent((newFilterType) => {
                currentFilterState.date = newFilterType;
                loadOccurrences(filter); // Recarregar lista com novo filtro
            });
            headerRight.appendChild(dateFilter);
        }
        
        let occurrences = await fetchOccurrences();
        
        // Aplicar filtro de data primeiro
        occurrences = filterOcorrenciasByDate(occurrences, currentFilterState.date);
        
        // Aplicar filtro de status
        if (filter !== 'all') {
            const statusMap = {
                'pending': 'Pendente',
                'in-progress': 'Em andamento',
                'completed': 'Concluído',
                'canceled': 'Cancelado'
            };
            
            occurrences = occurrences.filter(o => o.status === statusMap[filter]);
        }
        
        // Ordenar por data (mais recentes primeiro)
        occurrences.sort((a, b) => b.timestamp - a.timestamp);
        
        // Criar tabela
        const table = createOccurrenceTableComponent(occurrences, filter);
        container.innerHTML = '';
        container.appendChild(table);
        
    } catch (error) {
        console.error('Erro ao carregar ocorrências:', error);
        container.innerHTML = createEmptyStateComponent('Erro ao carregar ocorrências');
    }
}

async function openOccurrenceDetails(occurrenceId) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modalTitle.textContent = `Detalhes - ${occurrenceId}`;
    
    try {
        const occurrence = await fetchOccurrenceById(occurrenceId);
        AppState.currentOccurrence = occurrence;
        
        createDetailModalComponent(occurrence);
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes da ocorrência', 'error');
    }
}

// ============================================
// FEEDBACKS
// ============================================

async function loadFeedbacks() {
    const container = document.getElementById('feedbacks-list');
    showLoading(container);
    
    try {
        // Adicionar filtro de data aos feedbacks
        const headerRight = document.querySelector('.header-right');
        let existingFilter = headerRight.querySelector('.date-filter-container');
        
        if (!existingFilter) {
            const dateFilter = createDateFilterComponent((newFilterType) => {
                currentFilterState.date = newFilterType;
                loadFeedbacks(); // Recarregar feedbacks com novo filtro
            });
            headerRight.appendChild(dateFilter);
        }
        
        let feedbacks = await fetchFeedbacks();
        
        // Aplicar filtro de data aos feedbacks
        feedbacks = filterOcorrenciasByDate(feedbacks, currentFilterState.date);
        
        container.innerHTML = '';
        container.className = 'feedbacks-grid';
        
        if (feedbacks.length === 0) {
            container.innerHTML = createEmptyStateComponent('Nenhum feedback encontrado');
        } else {
            feedbacks.forEach(feedback => {
                container.appendChild(createFeedbackCardComponent(feedback));
            });
        }
    } catch (error) {
        console.error('Erro ao carregar feedbacks:', error);
        container.innerHTML = createEmptyStateComponent('Erro ao carregar feedbacks');
    }
}

// ============================================
// FIREBASE - INTEGRAÇÃO
// ============================================

async function fetchOccurrences(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && AppState.occurrencesCache && 
        (now - AppState.lastCacheUpdate) < CACHE_DURATION) {
        return AppState.occurrencesCache;
    }
    
    try {
        const snapshot = await firebase.database().ref('ocorrencias').once('value');
        const data = snapshot.val() || {};
        
        const occurrences = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        AppState.occurrencesCache = occurrences;
        AppState.lastCacheUpdate = now;
        
        return occurrences;
    } catch (error) {
        console.error('Erro ao buscar ocorrências:', error);
        throw error;
    }
}

// Nova função para configurar listeners em tempo real
function setupRealtimeListeners() {
    // Limpar listeners existentes
    cleanupRealtimeListeners();
    
    // Listener para ocorrências com debounce para evitar atualizações excessivas
    const occurrencesRef = firebase.database().ref('ocorrencias');
    AppState.realtimeListeners.occurrences = occurrencesRef.on('value', debounce((snapshot) => {
        const data = snapshot.val() || {};
        const newOccurrences = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        // Verificar se os dados realmente mudaram
        const hasChanged = !AppState.occurrencesCache || 
                          JSON.stringify(newOccurrences) !== JSON.stringify(AppState.occurrencesCache);
        
        if (hasChanged) {
            AppState.occurrencesCache = newOccurrences;
            AppState.lastCacheUpdate = Date.now();
            
            // Atualizar a página atual automaticamente se não estiver carregando
            if (!AppState.isLoading) {
                if (AppState.currentPage !== 'dashboard') {
                    updateCurrentPageData();
                } else {
                    // Atualizar métricas do dashboard
                    updateDashboardMetrics();
                }
            }
        }
    }, 300));
    
    // Listener para feedbacks
    const feedbacksRef = firebase.database().ref('feedbacks');
    AppState.realtimeListeners.feedbacks = feedbacksRef.on('value', debounce((snapshot) => {
        const data = snapshot.val() || {};
        const newFeedbacks = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        // Verificar se os dados realmente mudaram
        const hasChanged = !AppState.feedbacksCache || 
                          JSON.stringify(newFeedbacks) !== JSON.stringify(AppState.feedbacksCache);
        
        if (hasChanged) {
            AppState.feedbacksCache = newFeedbacks;
            
            // Atualizar feedbacks se estiver na página de feedbacks
            if (AppState.currentPage === 'feedbacks') {
                updateFeedbacksPage();
            }
        }
    }, 300));
}

// Função para limpar listeners
function cleanupRealtimeListeners() {
    if (AppState.realtimeListeners.occurrences) {
        firebase.database().ref('ocorrencias').off('value', AppState.realtimeListeners.occurrences);
    }
    if (AppState.realtimeListeners.feedbacks) {
        firebase.database().ref('feedbacks').off('value', AppState.realtimeListeners.feedbacks);
    }
    AppState.realtimeListeners = {};
}

// Função para atualizar dados da página atual sem recarregamento completo
function updateCurrentPageData() {
    if (AppState.isLoading) return;
    
    switch(AppState.currentPage) {
        case 'pending':
        case 'in-progress':
        case 'completed':
        case 'canceled':
        case 'all':
            updateOccurrencesTable(AppState.currentPage);
            break;
        case 'feedbacks':
            updateFeedbacksPage();
            break;
    }
}

// Função para atualizar apenas a tabela de ocorrências sem loading
function updateOccurrencesTable(filter) {
    const containerId = filter === 'all' ? 'all-list' : 
                       filter === 'in-progress' ? 'inprogress-list' :
                       `${filter}-list`;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    try {
        let occurrences = AppState.occurrencesCache || [];
        
        // Aplicar filtro de data primeiro
        occurrences = filterOcorrenciasByDate(occurrences, currentFilterState.date);
        
        // Aplicar filtro de status
        if (filter !== 'all') {
            const statusMap = {
                'pending': 'Pendente',
                'in-progress': 'Em andamento',
                'completed': 'Concluído',
                'canceled': 'Cancelado'
            };
            
            occurrences = occurrences.filter(o => o.status === statusMap[filter]);
        }
        
        // Ordenar por data (mais recentes primeiro)
        occurrences.sort((a, b) => b.timestamp - a.timestamp);
        
        // Criar tabela
        const table = createOccurrenceTableComponent(occurrences, filter);
        container.innerHTML = '';
        container.appendChild(table);
        
        // Atualizar contadores na sidebar
        updateSidebarCounters();
        
    } catch (error) {
        console.error('Erro ao atualizar tabela de ocorrências:', error);
    }
}

// Função para atualizar métricas do dashboard
function updateDashboardMetrics() {
    if (AppState.currentPage === 'dashboard') {
        loadDashboard();
    }
}

// Função para atualizar página de feedbacks
function updateFeedbacksPage() {
    if (AppState.currentPage === 'feedbacks') {
        const container = document.getElementById('feedbacks-list');
        if (!container) return;
        
        try {
            let feedbacks = AppState.feedbacksCache || [];
            
            // Aplicar filtro de data aos feedbacks
            feedbacks = filterOcorrenciasByDate(feedbacks, currentFilterState.date);
            
            container.innerHTML = '';
            container.className = 'feedbacks-grid';
            
            if (feedbacks.length === 0) {
                container.innerHTML = createEmptyStateComponent('Nenhum feedback encontrado');
            } else {
                feedbacks.forEach(feedback => {
                    container.appendChild(createFeedbackCardComponent(feedback));
                });
            }
        } catch (error) {
            console.error('Erro ao atualizar feedbacks:', error);
            container.innerHTML = createEmptyStateComponent('Erro ao carregar feedbacks');
        }
    }
}

// Função para atualizar contadores da sidebar
function updateSidebarCounters() {
    if (!AppState.occurrencesCache) return;
    
    const counters = {
        pending: 0,
        inprogress: 0,
        completed: 0,
        canceled: 0
    };
    
    AppState.occurrencesCache.forEach(occurrence => {
        switch(occurrence.status) {
            case 'Pendente':
                counters.pending++;
                break;
            case 'Em andamento':
                counters.inprogress++;
                break;
            case 'Concluído':
                counters.completed++;
                break;
            case 'Cancelado':
                counters.canceled++;
                break;
        }
    });
    
    // Atualizar elementos da sidebar
    const pendingBadge = document.getElementById('pending-count');
    const inprogressBadge = document.getElementById('inprogress-count');
    const completedBadge = document.getElementById('completed-count');
    const canceledBadge = document.getElementById('canceled-count');
    
    if (pendingBadge) pendingBadge.textContent = counters.pending;
    if (inprogressBadge) inprogressBadge.textContent = counters.inprogress;
    if (completedBadge) completedBadge.textContent = counters.completed;
    if (canceledBadge) canceledBadge.textContent = counters.canceled;
}

async function fetchOccurrenceById(id) {
    try {
        const snapshot = await firebase.database().ref(`ocorrencias/${id}`).once('value');
        return {
            id,
            ...snapshot.val()
        };
    } catch (error) {
        console.error('Erro ao buscar ocorrência:', error);
        throw error;
    }
}

async function fetchFeedbacks() {
    try {
        const snapshot = await firebase.database().ref('feedbacks').once('value');
        const data = snapshot.val() || {};
        
        const feedbacks = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        // Ordenar por data (mais recentes primeiro)
        feedbacks.sort((a, b) => b.timestamp - a.timestamp);
        
        return feedbacks;
    } catch (error) {
        console.error('Erro ao buscar feedbacks:', error);
        return [];
    }
}

async function updateOccurrenceStatus(occurrenceId, newStatus, certidaoFile = null, cancelReason = null) {
    try {
        AppState.isLoading = true; // Evitar atualizações duplas durante a operação
        
        // Mostrar barra de progresso
        progressController.show();
        
        // Step 1: Validando dados
        await new Promise(resolve => setTimeout(resolve, 500));
        progressController.nextStep();
        
        const updates = {
            status: newStatus,
            dataAtualizacao: Date.now()
        };
        
        // Se o status está voltando para 'Pendente', remover a certidão existente
        // para permitir novo upload
        if (newStatus === 'Pendente') {
            updates.certidao = null;
            
            // Atualizar a visibilidade da seção de upload imediatamente
            setTimeout(() => {
                updateUploadSectionVisibility(AppState.currentOccurrence, false);
            }, 100);
        }
        
        // Step 2: Processando arquivos
        await new Promise(resolve => setTimeout(resolve, 300));
        progressController.nextStep();
        
        if (newStatus === 'Concluído' && certidaoFile) {
            // Upload da certidão com feedback de progresso
            const certidaoData = await uploadCertidao(occurrenceId, certidaoFile);
            updates.certidao = certidaoData;
        }
        
        if (newStatus === 'Cancelado' && cancelReason) {
            updates.motivoCancelamento = {
                motivo: cancelReason,
                dataCancelamento: Date.now(),
                canceladoPor: AppState.currentUser.email
            };
        }
        
        // Step 3: Salvando no banco de dados
        await new Promise(resolve => setTimeout(resolve, 200));
        progressController.nextStep();
        
        // CORREÇÃO: Separar atualizações para garantir que o trigger funcione
        if (newStatus === 'Concluído' && certidaoFile && updates.certidao) {
            // Primeiro, fazer upload da certidão
            await firebase.database().ref(`ocorrencias/${occurrenceId}/certidao`).set(updates.certidao);
            
            // Pequena pausa para garantir que a certidão foi salva
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Depois, atualizar o status (isso vai triggerar o email)
            await firebase.database().ref(`ocorrencias/${occurrenceId}`).update({
                status: newStatus,
                dataAtualizacao: updates.dataAtualizacao
            });
        } else {
            // Para outros casos, fazer update normal
            await firebase.database().ref(`ocorrencias/${occurrenceId}`).update(updates);
        }
        
        // Step 4: Finalizando
        await new Promise(resolve => setTimeout(resolve, 300));
        progressController.nextStep();
        
        // Atualizar a ocorrência atual no AppState
        if (AppState.currentOccurrence) {
            AppState.currentOccurrence.status = newStatus;
            AppState.currentOccurrence.dataAtualizacao = updates.dataAtualizacao;
            
            // Se voltou para Pendente, remover certidão do cache local
            if (newStatus === 'Pendente') {
                AppState.currentOccurrence.certidao = null;
            }
            // Se foi para Concluído com arquivo, atualizar certidão
            else if (newStatus === 'Concluído' && certidaoFile && updates.certidao) {
                AppState.currentOccurrence.certidao = updates.certidao;
            }
            
            // Atualizar visibilidade da seção de upload
            // Limpar arquivo apenas se voltou para Pendente
            updateUploadSectionVisibility(AppState.currentOccurrence, newStatus === 'Pendente');
        }
        
        // Mostrar sucesso
        progressController.setSuccess();
        
        // Fechar modal após o progresso apenas se não voltou para Pendente
        // (para permitir novo upload imediatamente)
        if (newStatus !== 'Pendente') {
            setTimeout(() => {
                document.getElementById('detail-modal').classList.remove('active');
                
                // Se foi concluído com certidão, informar sobre o email automático
                if (newStatus === 'Concluído' && certidaoFile && updates.certidao) {
                    setTimeout(() => {
                        showToast('Status atualizado! O email com a certidão será enviado automaticamente para o solicitante.', 'success');
                    }, 500);
                }
            }, 1500);
        } else {
            // Se voltou para Pendente, atualizar o modal e mostrar mensagem
            setTimeout(() => {
                progressController.hide();
                
                // Recriar o modal com os dados atualizados
                if (AppState.currentOccurrence) {
                    createDetailModalComponent(AppState.currentOccurrence);
                }
                
                showToast('Status alterado para Pendente. Você pode anexar uma nova certidão.', 'info');
            }, 2000);
        }
        
        // Os dados serão atualizados automaticamente via listener em tempo real
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        
        // Mostrar erro na barra de progresso
        progressController.setError('Erro ao atualizar status. Tente novamente.');
        
        // Fallback toast para casos onde o usuário não vê a barra de progresso
        setTimeout(() => {
            showToast('Erro ao atualizar status', 'error');
        }, 3000);
    } finally {
        AppState.isLoading = false;
    }
}

async function uploadCertidao(occurrenceId, file) {
    try {
        const storageRef = firebase.storage().ref();
        const fileName = `${Date.now()}_${file.name}`;
        const fileRef = storageRef.child(`ocorrencias/${occurrenceId}/certidao/${fileName}`);
        
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        return {
            nome: file.name,
            url: downloadURL,
            dataUpload: Date.now(),
            tamanho: file.size,
            tipo: file.type
        };
    } catch (error) {
        console.error('Erro no upload:', error);
        throw error;
    }
}

// ============================================
// AUTENTICAÇÃO
// ============================================

async function login(email, password) {
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        AppState.currentUser = userCredential.user;
        
        // Verificar se é admin
        const isAdmin = await checkAdminStatus(userCredential.user.uid);
        
        if (!isAdmin) {
            await firebase.auth().signOut();
            throw new Error('Usuário não tem permissão de administrador');
        }
        
        return userCredential.user;
    } catch (error) {
        console.error('Erro no login:', error);
        throw error;
    }
}

async function checkAdminStatus(uid) {
    try {
        const snapshot = await firebase.database().ref(`admin_users/${uid}`).once('value');
        return snapshot.exists() && snapshot.val() === true;
    } catch (error) {
        console.error('Erro ao verificar status de admin:', error);
        return false;
    }
}

async function logout() {
    try {
        await firebase.auth().signOut();
        AppState.currentUser = null;
        window.location.reload();
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout', 'error');
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Verificar Firebase
    if (!firebase.apps.length) {
        const firebaseConfig = {
            apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
            authDomain: "certidao-gocg.firebaseapp.com",
            databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
            projectId: "certidao-gocg",
            storageBucket: "certidao-gocg.firebasestorage.app",
            messagingSenderId: "684546571684",
            appId: "1:684546571684:web:c104197a7c6b1c9f7a5531"
        };
        firebase.initializeApp(firebaseConfig);
    }
    
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginButton = document.getElementById('login-button');
            const loginError = document.getElementById('login-error');
            
            loginButton.disabled = true;
            loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            
            try {
                await login(email, password);
                
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-dashboard').style.display = 'flex';
                
                document.getElementById('user-email').textContent = email;
                
                navigateToPage('dashboard');
            } catch (error) {
                loginError.textContent = error.message;
                loginError.style.display = 'block';
            } finally {
                loginButton.disabled = false;
                loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Sistema';
            }
        });
    }
    
    // Navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage(link.dataset.page);
        });
    });
    
    // Botão "Ver Todos" dos Feedbacks no Dashboard
    document.querySelectorAll('button[data-page="feedbacks"]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage('feedbacks');
        });
    });
    
    // Logout
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
    }
    
    // Modal Close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            document.getElementById('detail-modal').classList.remove('active');
        });
    }
    
    // Update Status Button
    const updateStatusBtn = document.getElementById('update-status-btn');
    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', async () => {
            const status = document.getElementById('status-select').value;
            const fileInput = document.getElementById('certidao-file');
            const file = fileInput && fileInput.files ? fileInput.files[0] : null;
            
            if (AppState.currentOccurrence) {
                // Se o status for "Cancelado", solicitar motivo
                if (status === 'Cancelado') {
                    showCancelReasonModal((motivo) => {
                        if (motivo && motivo.trim()) {
                            updateOccurrenceStatus(AppState.currentOccurrence.id, status, file, motivo.trim());
                        } else {
                            // Reset status select if cancelled
                            document.getElementById('status-select').value = AppState.currentOccurrence.status;
                        }
                    });
                } else {
                    await updateOccurrenceStatus(AppState.currentOccurrence.id, status, file);
                }
            }
        });
    }
    
    // Upload Dropzone
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
        const fileInput = document.getElementById('certidao-file');
        
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragging');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragging');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragging');
            
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateFileInfo(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                updateFileInfo(e.target.files[0]);
            }
        });
    }
    
    function updateFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        if (fileInfo) {
            fileInfo.textContent = `Arquivo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            fileInfo.classList.add('active');
        }
    }
    
    // Refresh Button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadPageData(AppState.currentPage);
            showToast('Dados atualizados', 'success');
        });
    }
    
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce((e) => {
            const query = e.target.value.toLowerCase();
            // Implementar busca
            console.log('Buscar:', query);
        }, 500));
    }
    
    
    // Verificar autenticação
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const isAdmin = await checkAdminStatus(user.uid);
            
            if (isAdmin) {
                AppState.currentUser = user;
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-dashboard').style.display = 'flex';
                document.getElementById('user-email').textContent = user.email;
                
                // Configurar listeners em tempo real após login bem-sucedido
                setupRealtimeListeners();
                
                navigateToPage('dashboard');
            } else {
                await firebase.auth().signOut();
            }
        } else {
            // Limpar listeners quando usuário faz logout
            cleanupRealtimeListeners();
            AppState.currentUser = null;
            AppState.occurrencesCache = null;
            AppState.feedbacksCache = null;
            
            document.getElementById('login-container').style.display = 'flex';
            document.getElementById('admin-dashboard').style.display = 'none';
        }
    });
});

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

