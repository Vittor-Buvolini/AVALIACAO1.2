const API = 'https://swapi.dev/api/';
const API_LOG = 'https://www.piway.com.br/unoesc/api';
const MATRICULA = '441095';

const config = {
    people: {
        title: 'Personagens',
        description: 'Conheça os habitantes da galáxia.',
        endpoint: 'people',
        icon: '♙',
        fields: ['height', 'mass', 'gender'],
        labels: ['Altura (cm)', 'Peso (kg)', 'Gênero']
    },
    planets: {
        title: 'Planetas',
        description: 'Explore mundos e sistemas da galáxia.',
        endpoint: 'planets',
        icon: '◉',
        fields: ['climate', 'terrain', 'population'],
        labels: ['Clima', 'Terreno', 'População']
    },
    films: {
        title: 'Filmes',
        description: 'Reviva os capítulos da saga.',
        endpoint: 'films',
        icon: '▣',
        fields: ['episode_id', 'director', 'release_date'],
        labels: ['Episódio', 'Direção', 'Lançamento']
    }
};

let kind = 'people';
let page = 1;
let searchTerm = '';
let nextUrl = null;
let prevUrl = null;
let lastResults = [];

let logs = [];
let logsVisible = false;

const $ = id => document.getElementById(id);

function clean(value) {
    if (
        value === undefined ||
        value === null ||
        value === '' ||
        value === 'unknown' ||
        value === 'n/a'
    ) {
        return 'Não informado';
    }
    return String(value);
}

function shorten(value, max = 92) {
    value = clean(value);
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function formatDate(value) {
    if (!value) return value;
    const date = new Date(value + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

// FUNCIONALIDADE 1: Registro de log na API
async function inserirLog(api, metodo, resultado) {
    const log = {
        data: new Date().toLocaleString('pt-BR'),
        api,
        metodo,
        resultado: String(resultado).slice(0, 100),
        id: null,
        enviando: true
    };

    logs.unshift(log);
    renderLogs();

    // Limpa caracteres especiais do resultado para não quebrar a rota REST da API
    const resultadoSanitizado = encodeURIComponent(log.resultado.replace(/[/\\?%#]/g, ' '));
    const apiSanitizada = encodeURIComponent(api);
    const metodoSanitizado = encodeURIComponent(metodo);

    const url = `${API_LOG}/inserir/log/${MATRICULA}/${apiSanitizada}/${metodoSanitizado}/${resultadoSanitizado}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }

        const texto = await response.text();
        let jsonRes;

        try {
            jsonRes = JSON.parse(texto);
        } catch {
            jsonRes = null;
        }

        // Trata todas as possíveis estruturas de retorno da API Piway
        let idExtraido = null;

        if (Array.isArray(jsonRes) && jsonRes.length > 0) {
            const item = jsonRes[0];
            idExtraido = item.idlog || item.IDLOG || item.id || item.id_log;
        } else if (jsonRes && typeof jsonRes === 'object') {
            idExtraido = jsonRes.idlog || jsonRes.IDLOG || jsonRes.id || jsonRes.id_log || jsonRes.data?.idlog || jsonRes.data?.id;
        } else if (texto && /^\d+$/.test(texto.trim())) {
            idExtraido = texto.trim();
        }

        log.id = idExtraido ? String(idExtraido) : null;
        log.enviando = false;

    } catch (erro) {
        log.enviando = false;
        console.error('Erro ao registrar log na API:', erro);
    }

    renderLogs();
}

// FUNCIONALIDADE 2: Visualização de logs
function renderLogs() {
    const logList = $('logList');
    const logCount = $('logCount');

    if (!logList || !logCount) return;

    logCount.textContent = `${logs.length} log(s)`;

    if (logs.length === 0) {
        logList.innerHTML = `
            <p class="notice">
                Nenhum log registrado nesta sessão.
            </p>
        `;
        return;
    }

    logList.innerHTML = logs.map((log, index) => `
        <article class="detail-item">
            <small>
                ${escapeHtml(log.data)} · ${escapeHtml(log.api)} · ${escapeHtml(log.metodo)}
            </small>

            <span>${escapeHtml(log.resultado)}</span>

            <small>
                ${log.enviando
                    ? 'Enviando para a API...'
                    : log.id
                        ? `ID da API: ${escapeHtml(log.id)}`
                        : 'Sem ID gravado (falha de conexão/retorno)'}
            </small>

            <button
                class="button button-secondary delete-log-btn"
                type="button"
                data-index="${index}"
                ${!log.id || log.enviando ? 'disabled' : ''}>
                Excluir log
            </button>
        </article>
    `).join('');

    logList.querySelectorAll('.delete-log-btn').forEach(button => {
        button.addEventListener('click', () => {
            excluirLog(Number(button.dataset.index));
        });
    });
}

function alternarLogs() {
    logsVisible = !logsVisible;

    $('logsPanel').hidden = !logsVisible;
    $('toggleLogs').textContent = logsVisible ? 'Ocultar logs' : 'Mostrar logs';
    $('toggleLogs').setAttribute('aria-expanded', String(logsVisible));

    if (logsVisible) {
        renderLogs();
        $('logsPanel').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// FUNCIONALIDADE 3: Exclusão de log
async function excluirLog(index) {
    const log = logs[index];

    if (!log || !log.id) {
        alert('Este log não possui um ID válido para exclusão.');
        return;
    }

    if (!confirm(`Deseja excluir o log ID ${log.id} da API?`)) {
        return;
    }

    const url = `${API_LOG}/excluir/log/${encodeURIComponent(log.id)}/aluno/${MATRICULA}`;

    try {
        const response = await fetch(url);
        const respostaTexto = await response.text();

        if (!response.ok) {
            throw new Error(`Status ${response.status}: ${respostaTexto}`);
        }

        // Remove do array local após sucesso na API
        logs.splice(index, 1);
        renderLogs();

    } catch (erro) {
        console.error('Erro ao excluir log:', erro);
        alert('Não foi possível excluir o log na API de logs. Verifique a conexão.');
    }
}

function setMessage(text, error = false) {
    $('message').textContent = text;
    $('message').classList.toggle('hidden', !text);$('message').classList.toggle('error', error);
}

function getName(item) {
    return item.title || item.name || 'Sem nome';
}

function makeCard(item, index) {
    const category = config[kind];

    const facts = category.fields.map((field, i) => {
        let value = item[field];
        if (field === 'release_date') {
            value = formatDate(value);
        }

        return `
            <div class="fact">
                <small>${escapeHtml(category.labels[i])}</small>
                <strong>${escapeHtml(shorten(value, 45))}</strong>
            </div>
        `;
    }).join('');

    let description = '';
    if (kind === 'people') {
        description = 'Personagem do universo Star Wars.';
    } else if (kind === 'planets') {
        description = 'Mundo que faz parte da galáxia Star Wars.';
    } else {
        description = `Episódio ${clean(item.episode_id)} da saga.`;
    }

    return `
        <article class="card">
            <div class="card-top">
                <span class="card-icon" aria-hidden="true">${category.icon}</span>
                <span class="card-type">${escapeHtml(category.title)}</span>
            </div>

            <h3>${escapeHtml(getName(item))}</h3>

            <p class="card-description">${escapeHtml(description)}</p>

            <div class="facts">${facts}</div>

            <button
                class="button button-secondary detail-btn"
                type="button"
                data-index="${index}">
                Ver detalhes →
            </button>
        </article>
    `;
}

function showDetail(item) {
    if (!item) return;

    const fieldsToSkip = new Set(['created', 'edited', 'url']);

    const entries = Object.entries(item).filter(([key, value]) => {
        return !fieldsToSkip.has(key) && typeof value !== 'object';
    });

    $('detailTitle').textContent = getName(item);

    $('detailGrid').innerHTML = entries.map(([key, value]) => {
        const label = key.replaceAll('_', ' ');
        return `
            <div class="detail-item">
                <small>${escapeHtml(label)}</small>
                <span>${escapeHtml(clean(value))}</span>
            </div>
        `;
    }).join('');

    $('detail').hidden = false;
    $('detail').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

async function load(url = null) {
    const category = config[kind];

    $('cards').innerHTML = `<div class="loading">Consultando a galáxia...</div>`;
    setMessage('');

    $('resultCount').textContent = 'Carregando...';$('pageLabel').textContent = `Página ${page}`;

    $('prevBtn').disabled = true;
    $('nextBtn').disabled = true;

    const target = url || (
        searchTerm
            ? `${API}${category.endpoint}/?search=${encodeURIComponent(searchTerm)}`
            : `${API}${category.endpoint}/?page=${page}`
    );

    try {
        const response = await fetch(target);

        if (!response.ok) {
            throw new Error(`API respondeu com status ${response.status}`);
        }

        const data = await response.json();

        lastResults = data.results || [];
        nextUrl = data.next;
        prevUrl = data.previous;

        if (lastResults.length > 0) {
            $('cards').innerHTML = lastResults
                .map((item, index) => makeCard(item, index))
                .join('');

            $('cards').querySelectorAll('.detail-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const index = Number(button.dataset.index);
                    showDetail(lastResults[index]);
                });
            });
        } else {
            $('cards').innerHTML = `<div class="notice">Nenhum resultado encontrado.</div>`;
        }

        const count = data.count ?? lastResults.length;
        $('resultCount').textContent = `${count} registro(s) encontrado(s)`;
        $('pageLabel').textContent = searchTerm ? 'Resultados da pesquisa' : `Página ${page}`;

        $('prevBtn').disabled = !prevUrl;
        $('nextBtn').disabled = !nextUrl;

        // Registra log de sucesso
        inserirLog('SWAPI', `GET ${category.endpoint}`, 'sucesso');

    } catch (error) {
        lastResults = [];
        nextUrl = null;
        prevUrl = null;

        $('cards').innerHTML = `<div class="notice">Não foi possível carregar os dados.</div>`;
        setMessage(`Não foi possível consultar a SWAPI (${error.message})`, true);
        $('resultCount').textContent = 'Consulta indisponível';

        $('prevBtn').disabled = true;
        $('nextBtn').disabled = true;

        // Registra log de erro
        inserirLog('SWAPI', `GET ${category.endpoint}`, `erro: ${error.message}`);
    }
}

function selectKind(nextKind) {
    kind = nextKind;
    page = 1;
    searchTerm = '';

    $('searchInput').value = '';$('detail').hidden = true;

    document.querySelectorAll('.tab').forEach(button => {
        const selected = button.dataset.kind === kind;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });

    $('sectionTitle').textContent = config[kind].title;
    $('sectionDescription').textContent = config[kind].description;

    load();
}

function search() {
    searchTerm = $('searchInput').value.trim();
    page = 1;
    $('detail').hidden = true;
    load();
}

document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
        selectKind(button.dataset.kind);
    });
});

$('searchForm').addEventListener('submit', event => {
    event.preventDefault();
    search();
});

$('clearSearch').addEventListener('click', () => {$('searchInput').value = '';
    searchTerm = '';
    page = 1;
    load();
});

$('prevBtn').addEventListener('click', () => {
    if (prevUrl) {
        page = Math.max(1, page - 1);
        load(prevUrl);
    }
});

$('nextBtn').addEventListener('click', () => {
    if (nextUrl) {
        page += 1;
        load(nextUrl);
    }
});

$('closeDetail').addEventListener('click', () => {$('detail').hidden = true;
});

$('toggleLogs').addEventListener('click', alternarLogs);

renderLogs();
load();