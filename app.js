// =================================================================
// INÍCIO DA CONFIGURAÇÃO - COLE SUAS CHAVES DO FIREBASE AQUI
// =================================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
// =================================================================
// FIM DA CONFIGURAÇÃO
// =================================================================

// Inicialização do Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Estado da Aplicação
let currentUser = null;
let currentUserData = null;
let currentAuditId = null;
let auditDraft = { entries: [] };
let entryCounter = 0;

// Constantes
const REGISTRATION_SECRET = "@PolarAud@";
const LOCATION_MAP = {
    "ZONA 1": ["Local Z1 A", "Local Z1 B", "Estacionamento Diretoria"],
    "ZONA 2": ["Local Z2 A", "Local Z2 B", "Pátio Contêineres"],
    "ZONA 3": ["Local Z3 A", "Local Z3 B"],
    "ZONA 4": ["Local Z4 A", "Local Z4 B"]
};
const AUDITED_ENTITIES = ["RFB", "APPA", "MAPA", "MINISTÉRIOS DO TRABALHO", "CONPORTOS"];

// Referências do DOM
const views = {
    login: document.getElementById('login-view'),
    registerSecret: document.getElementById('register-secret-view'),
    register: document.getElementById('register-view'),
    home: document.getElementById('home-view'),
    auditForm: document.getElementById('audit-form-view'),
    history: document.getElementById('history-view'),
};
const userInfo = document.getElementById('user-info');
const userGreeting = document.getElementById('user-greeting');
const userSector = document.getElementById('user-sector');
const loader = document.getElementById('loader');
const loaderMessage = document.getElementById('loader-message');

// =================================================================
// Funções Utilitárias
// =================================================================
function showView(viewName) {
    Object.values(views).forEach(view => view.classList.add('hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }
}

function showLoader(message = 'Carregando...') {
    loaderMessage.textContent = message;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// =================================================================
// Lógica de Autenticação
// =================================================================
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            currentUserData = userDoc.data();
            userGreeting.textContent = `Olá, ${currentUserData.fullName}`;
            userSector.textContent = `Setor: ${currentUserData.sector}`;
            userInfo.classList.remove('hidden');
            showView('home');
        } else {
            // Caso raro: usuário autenticado mas sem dados no Firestore
            auth.signOut();
        }
    } else {
        currentUser = null;
        currentUserData = null;
        userInfo.classList.add('hidden');
        showView('login');
    }
    hideLoader();
});

document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    showLoader('Entrando...');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            alert(`Erro no login: ${error.message}`);
            hideLoader();
        });
});

document.getElementById('logout-button').addEventListener('click', () => {
    auth.signOut();
});

document.getElementById('show-register-link').addEventListener('click', (e) => {
    e.preventDefault();
    showView('registerSecret');
});

document.getElementById('back-to-login-link').addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
});

document.getElementById('secret-form').addEventListener('submit', e => {
    e.preventDefault();
    const secret = document.getElementById('register-secret').value;
    if (secret === REGISTRATION_SECRET) {
        showView('register');
    } else {
        alert('Segredo incorreto!');
    }
});

document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    showLoader('Registrando...');
    const username = document.getElementById('register-username').value;
    const fullName = document.getElementById('register-fullname').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const sector = document.getElementById('register-sector').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username,
            fullName,
            email,
            sector,
            role: 'auditor' // Todos os novos usuários são auditores por padrão
        });
        
        // Login automático após registro
    } catch (error) {
        alert(`Erro no registro: ${error.message}`);
        hideLoader();
    }
});


// =================================================================
// Lógica do IndexedDB (Rascunho Offline)
// =================================================================
let idb;
const dbName = 'PolarAUD_DB';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onerror = event => reject('Erro ao abrir IndexedDB');
        request.onsuccess = event => {
            idb = event.target.result;
            resolve(idb);
        };
        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('auditDraft', { keyPath: 'userId' });
        };
    });
}

async function saveDraftToDB(draft) {
    if (!idb || !currentUser) return;
    draft.userId = currentUser.uid;
    const transaction = idb.transaction(['auditDraft'], 'readwrite');
    const store = transaction.objectStore('auditDraft');
    store.put(draft);
}

async function getDraftFromDB() {
    if (!idb || !currentUser) return null;
    return new Promise((resolve) => {
        const transaction = idb.transaction(['auditDraft'], 'readonly');
        const store = transaction.objectStore('auditDraft');
        const request = store.get(currentUser.uid);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function clearDraftFromDB() {
    if (!idb || !currentUser) return;
    const transaction = idb.transaction(['auditDraft'], 'readwrite');
    const store = transaction.objectStore('auditDraft');
    store.delete(currentUser.uid);
}


// =================================================================
// Lógica do Formulário de Auditoria
// =================================================================
function createEntryElement(entryData = {}) {
    entryCounter++;
    const entryId = entryData.id || `local_${entryCounter}`;
    const entryNumber = entryData.number || entryCounter;

    const card = document.createElement('div');
    card.className = 'entry-card';
    card.id = `entry-${entryId}`;
    card.dataset.id = entryId;

    card.innerHTML = `
        <h3>Apontamento #${entryNumber}</h3>
        <label>Auditor:</label>
        <input type="text" value="${currentUserData.fullName}" disabled>
        
        <label for="audited-entity-${entryId}">Órgão Anuente Auditado:</label>
        <select id="audited-entity-${entryId}" class="audited-entity" required>
            <option value="">Selecione...</option>
            ${AUDITED_ENTITIES.map(e => `<option value="${e}" ${entryData.auditedEntity === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select>

        <label for="operational-zone-${entryId}">Zona Operacional:</label>
        <select id="operational-zone-${entryId}" class="operational-zone" required>
            <option value="">Selecione...</option>
            ${Object.keys(LOCATION_MAP).map(z => `<option value="${z}" ${entryData.operationalZone === z ? 'selected' : ''}>${z}</option>`).join('')}
        </select>

        <label>Setor Técnico:</label>
        <input type="text" value="${currentUserData.sector}" disabled>

        <label for="location-${entryId}">Local:</label>
        <select id="location-${entryId}" class="location" required>
            <option value="">Selecione uma Zona Operacional primeiro</option>
        </select>
        
        <label for="description-${entryId}">Apontamento (max 500 caracteres):</label>
        <textarea id="description-${entryId}" class="entry-description" maxlength="500" required>${entryData.description || ''}</textarea>
        
        <label for="complement-${entryId}">Complemento:</label>
        <textarea id="complement-${entryId}" required>${entryData.complement || ''}</textarea>

        <label>Adicionar Evidência (até 3 imagens):</label>
        <input type="file" id="evidence-upload-${entryId}" class="evidence-upload" accept="image/*" multiple>
        <div id="evidence-preview-${entryId}" class="evidence-preview"></div>
    `;

    document.getElementById('audit-form').appendChild(card);
    document.getElementById(`save-audit-button`).classList.remove('hidden');

    // Adicionar listeners para os novos elementos
    const zoneSelect = card.querySelector('.operational-zone');
    const locationSelect = card.querySelector('.location');
    zoneSelect.addEventListener('change', () => updateLocationOptions(zoneSelect, locationSelect));
    
    if (entryData.operationalZone) {
        updateLocationOptions(zoneSelect, locationSelect, entryData.location);
    }
    
    card.querySelector('.evidence-upload').addEventListener('change', e => handleEvidenceUpload(e, entryId));
    card.addEventListener('input', () => saveCurrentAuditState());

    if(entryData.evidenceFiles) {
        previewEvidence(entryId, entryData.evidenceFiles);
    }
}

function updateLocationOptions(zoneSelect, locationSelect, selectedLocation = null) {
    const selectedZone = zoneSelect.value;
    locationSelect.innerHTML = '<option value="">Selecione...</option>';
    if (selectedZone && LOCATION_MAP[selectedZone]) {
        LOCATION_MAP[selectedZone].forEach(loc => {
            const option = document.createElement('option');
            option.value = loc;
            option.textContent = loc;
            if (loc === selectedLocation) {
                option.selected = true;
            }
            locationSelect.appendChild(option);
        });
    }
}

function handleEvidenceUpload(event, entryId) {
    const files = Array.from(event.target.files);
    const entry = auditDraft.entries.find(e => e.id === entryId);
    if (!entry) return;

    if (!entry.evidenceFiles) {
        entry.evidenceFiles = [];
    }

    const totalFiles = entry.evidenceFiles.length + files.length;
    if (totalFiles > 3) {
        alert('Você pode adicionar no máximo 3 evidências por apontamento.');
        return;
    }
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            entry.evidenceFiles.push({
                name: file.name,
                type: file.type,
                dataUrl: e.target.result,
                file // Manter o objeto File para upload
            });
            previewEvidence(entryId, entry.evidenceFiles);
            saveCurrentAuditState();
        };
        reader.readAsDataURL(file);
    });
}

function previewEvidence(entryId, files) {
    const previewContainer = document.getElementById(`evidence-preview-${entryId}`);
    previewContainer.innerHTML = '';
    files.forEach((fileData, index) => {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'evidence-thumbnail-container';
        thumbContainer.innerHTML = `
            <img src="${fileData.dataUrl}" class="evidence-thumbnail" alt="${fileData.name}">
            <button type="button" class="remove-evidence-btn" data-index="${index}">&times;</button>
        `;
        previewContainer.appendChild(thumbContainer);
    });

    // Adicionar listener para os botões de remover
    previewContainer.querySelectorAll('.remove-evidence-btn').forEach(btn => {
        btn.onclick = () => {
            const indexToRemove = parseInt(btn.dataset.index);
            const entry = auditDraft.entries.find(e => e.id === entryId);
            if (entry) {
                entry.evidenceFiles.splice(indexToRemove, 1);
                previewEvidence(entryId, entry.evidenceFiles);
                saveCurrentAuditState();
            }
        };
    });
}

function saveCurrentAuditState() {
    const form = document.getElementById('audit-form');
    const entryCards = form.querySelectorAll('.entry-card');
    
    auditDraft.entries = []; // Reset and read from DOM
    entryCards.forEach(card => {
        const entryId = card.dataset.id;
        const existingEntry = auditDraft.entries.find(e => e.id === entryId) || {};
        
        auditDraft.entries.push({
            id: entryId,
            number: parseInt(card.querySelector('h3').textContent.replace('Apontamento #', '')),
            auditedEntity: card.querySelector('.audited-entity').value,
            operationalZone: card.querySelector('.operational-zone').value,
            location: card.querySelector('.location').value,
            description: card.querySelector('.entry-description').value,
            complement: card.querySelector('textarea:not(.entry-description)').value,
            evidenceFiles: existingEntry.evidenceFiles || [] // Keep files from state
        });
    });
    
    saveDraftToDB(auditDraft);
}

document.getElementById('add-entry-button').addEventListener('click', () => {
    const newEntryData = { id: `local_${Date.now()}`, number: auditDraft.entries.length + 1 };
    auditDraft.entries.push(newEntryData);
    createEntryElement(newEntryData);
});

async function compressImage(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: file.type }));
                    } else {
                        reject(new Error('Compressão falhou.'));
                    }
                }, file.type, quality);
            };
        };
        reader.onerror = error => reject(error);
    });
}


// =================================================================
// Lógica de Navegação e Salvamento
// =================================================================
document.getElementById('start-audit-button').addEventListener('click', async () => {
    showLoader('Carregando rascunho...');
    const draft = await getDraftFromDB();
    document.getElementById('audit-form').innerHTML = ''; // Limpa formulário
    document.getElementById('save-audit-button').classList.add('hidden');
    entryCounter = 0;

    if (draft && draft.entries && draft.entries.length > 0) {
        if (confirm('Foi encontrado um rascunho de auditoria. Deseja continuar?')) {
            auditDraft = draft;
            auditDraft.entries.forEach(entry => createEntryElement(entry));
        } else {
            await clearDraftFromDB();
            auditDraft = { entries: [] };
        }
    } else {
        auditDraft = { entries: [] };
    }
    
    showView('auditForm');
    hideLoader();
});

document.getElementById('save-audit-button').addEventListener('click', async () => {
    if (document.getElementById('audit-form').checkValidity() === false) {
        alert('Por favor, preencha todos os campos obrigatórios em todos os apontamentos.');
        return;
    }
    
    showLoader('Salvando auditoria...');
    try {
        // 1. Criar o documento da auditoria para ter um ID
        const auditRef = db.collection('audits').doc();
        currentAuditId = auditRef.id;

        const auditData = {
            auditId: currentAuditId,
            userId: currentUser.uid,
            userFullName: currentUserData.fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed'
        };

        // 2. Fazer upload das imagens e coletar as URLs
        for (const entry of auditDraft.entries) {
            entry.evidenceUrls = {};
            if (entry.evidenceFiles && entry.evidenceFiles.length > 0) {
                for (let i = 0; i < entry.evidenceFiles.length; i++) {
                    const fileData = entry.evidenceFiles[i];
                    showLoader(`Comprimindo e enviando imagem ${i + 1}/${entry.evidenceFiles.length} do apontamento #${entry.number}...`);
                    
                    const compressedFile = await compressImage(fileData.file);
                    const storagePath = `evidences/${currentUser.uid}/${currentAuditId}/${Date.now()}_${compressedFile.name}`;
                    const storageRef = storage.ref(storagePath);
                    const uploadTask = await storageRef.put(compressedFile);
                    const downloadURL = await uploadTask.ref.getDownloadURL();
                    entry.evidenceUrls[`evidence_${i + 1}`] = downloadURL;
                }
            }
        }
        
        // 3. Salvar os apontamentos como subcoleção
        showLoader('Salvando dados dos apontamentos...');
        const batch = db.batch();
        
        auditDraft.entries.forEach((entry, index) => {
            const entryRef = auditRef.collection('entries').doc();
            batch.set(entryRef, {
                entryId: entryRef.id,
                entryNumber: index + 1,
                entryTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                auditedEntity: entry.auditedEntity,
                operationalZone: entry.operationalZone,
                technicalSector: currentUserData.sector,
                location: entry.location,
                description: entry.description,
                complement: entry.complement,
                evidenceUrls: entry.evidenceUrls || {}
            });
        });
        
        await batch.commit();

        // 4. Finalmente, salvar o documento principal da auditoria
        await auditRef.set(auditData);

        // 5. Limpeza
        await clearDraftFromDB();
        auditDraft = { entries: [] };
        entryCounter = 0;

        alert('Auditoria salva com sucesso!');
        showView('home');

    } catch (error) {
        console.error("Erro ao salvar auditoria:", error);
        alert(`Ocorreu um erro: ${error.message}`);
    } finally {
        hideLoader();
    }
});


// =================================================================
// Lógica do Histórico e Relatórios
// =================================================================
document.getElementById('history-button').addEventListener('click', async () => {
    showLoader('Carregando histórico...');
    showView('history');
    
    const auditsListDiv = document.getElementById('audits-list');
    const exportButtonsDiv = document.getElementById('export-buttons');
    const adminFiltersDiv = document.getElementById('admin-filters');
    auditsListDiv.innerHTML = 'Carregando...';
    exportButtonsDiv.innerHTML = '';
    
    let auditsQuery;
    
    if (currentUserData.role === 'admin') {
        adminFiltersDiv.classList.remove('hidden');
        auditsQuery = db.collection('audits').orderBy('createdAt', 'desc');
        // Adicionar botão de exportação para admin
        exportButtonsDiv.innerHTML = `<button id="export-admin-csv">Exportar Relatório Completo (CSV)</button>`;
        document.getElementById('export-admin-csv').onclick = () => exportFullReportToCSV();

    } else {
        adminFiltersDiv.classList.add('hidden');
        auditsQuery = db.collection('audits')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc');
        // Adicionar botão de exportação para auditor
        exportButtonsDiv.innerHTML = `<button id="export-auditor-csv">Exportar Concluídas (CSV)</button>`;
        document.getElementById('export-auditor-csv').onclick = () => exportUserAuditsToCSV();
    }
    
    const snapshot = await auditsQuery.get();
    if (snapshot.empty) {
        auditsListDiv.innerHTML = '<p>Nenhuma auditoria encontrada.</p>';
        hideLoader();
        return;
    }
    
    auditsListDiv.innerHTML = '';
    snapshot.forEach(doc => {
        const audit = doc.data();
        const item = document.createElement('div');
        item.className = 'audit-item';
        
        const date = audit.createdAt ? audit.createdAt.toDate().toLocaleString('pt-BR') : 'Data indisponível';
        
        item.innerHTML = `
            <div>
                <p><strong>ID:</strong> ${audit.auditId}</p>
                ${currentUserData.role === 'admin' ? `<p><strong>Auditor:</strong> ${audit.userFullName}</p>` : ''}
                <p><strong>Data:</strong> ${date}</p>
            </div>
            <div class="status-indicator status-${audit.status}"></div>
        `;
        auditsListDiv.appendChild(item);
    });
    
    hideLoader();
});

async function exportToCSV(auditsSnapshot) {
    showLoader('Gerando CSV...');
    const headers = [
        "Numero_Apontamento", "Auditor", "Data_Hora_Apontamento",
        "Zona_Operacional", "Setor_Tecnico", "Orgao_Anuente_Auditado", "Local",
        "Descricao_Apontamento", "Complemento",
        "Evidencia_1", "Evidencia_2", "Evidencia_3"
    ];

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\r\n';
    
    for (const auditDoc of auditsSnapshot.docs) {
        const auditData = auditDoc.data();
        const entriesSnapshot = await db.collection('audits').doc(auditDoc.id).collection('entries').get();
        
        for (const entryDoc of entriesSnapshot.docs) {
            const entry = entryDoc.data();
            const row = [
                entry.entryNumber,
                `"${auditData.userFullName}"`,
                entry.entryTimestamp ? entry.entryTimestamp.toDate().toISOString() : '',
                `"${entry.operationalZone}"`,
                `"${entry.technicalSector}"`,
                `"${entry.auditedEntity}"`,
                `"${entry.location}"`,
                `"${entry.description.replace(/"/g, '""')}"`, // Escape double quotes
                `"${entry.complement.replace(/"/g, '""')}"`,
                entry.evidenceUrls.evidence_1 || '',
                entry.evidenceUrls.evidence_2 || '',
                entry.evidenceUrls.evidence_3 || ''
            ];
            csvContent += row.join(',') + '\r\n';
        }
    }
    
    hideLoader();
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_polaraud_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function exportUserAuditsToCSV() {
    const auditsQuery = db.collection('audits')
        .where('userId', '==', currentUser.uid)
        .where('status', '==', 'completed');
    const snapshot = await auditsQuery.get();
    if (snapshot.empty) {
        alert('Nenhuma auditoria concluída para exportar.');
        return;
    }
    await exportToCSV(snapshot);
}

async function exportFullReportToCSV() {
    // Aqui, implementar a lógica de filtro se necessário
    const auditsQuery = db.collection('audits'); // Exporta tudo por padrão
    const snapshot = await auditsQuery.get();
    if (snapshot.empty) {
        alert('Nenhuma auditoria no sistema para exportar.');
        return;
    }
    await exportToCSV(snapshot);
}

// =================================================================
// Listeners de Navegação Adicionais
// =================================================================
document.getElementById('back-to-home-button').addEventListener('click', () => showView('home'));


// =================================================================
// Inicialização da Aplicação
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    showLoader('Inicializando...');
    openDB().catch(console.error);
});