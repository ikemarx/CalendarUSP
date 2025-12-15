/**
 * @file content.js
 * @description Script injetado na página de grade horária do JúpiterWeb (USP) para
 * extrair as informações das disciplinas e seus respectivos horários.
 */

/**
 * Mapeia as abreviações dos dias da semana para os nomes completos em português.
 * @type {Object<string, string>}
 */
const dayMap = {
    'Seg': 'Segunda-feira', 'Ter': 'Terça-feira', 'Qua': 'Quarta-feira',
    'Qui': 'Quinta-feira', 'Sex': 'Sexta-feira', 'Sab': 'Sábado', 'Dom': 'Domingo'
};

/**
 * Aguarda um elemento aparecer no DOM. Útil para esperar por conteúdo
 * que é carregado dinamicamente.
 * @param {string} selector - O seletor CSS do elemento a ser aguardado.
 * @param {number} timeout - O tempo máximo de espera em milissegundos.
 * @returns {Promise<Element|null>} Uma promessa que resolve com o elemento ou null se o tempo esgotar.
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise(resolve => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                clearInterval(interval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                resolve(null);
            }
        }, 100);
    });
}

/**
 * Extrai os dados da tabela de grade horária de forma robusta, em duas etapas,
 * para evitar erros de condição de corrida.
 * @returns {Promise<{success: boolean, data: Array<Object>}>} Um objeto com o status
 * e os dados das aulas extraídas.
 */
function parsePtDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    }
    return null;
}

function normalizeDayName(dayStr) {
    if (!dayStr) return "";
    const clean = dayStr.trim().toLowerCase().substring(0, 3);
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    return dayMap[capitalized] || capitalized;
}

/**
 * Função auxiliar para buscar texto ignorando elementos vazios (templates ocultos)
 */
function getTextFromSelectors(container, selector) {
    const elements = container.querySelectorAll(selector);
    for (const el of elements) {
        const text = el.innerText.trim();
        if (text) return text; // Retorna o primeiro que tiver conteúdo
    }
    return "";
}

async function extractSchedule() {
    const scheduleTable = document.querySelector('table#tableGradeHoraria');
    const headerContainer = document.querySelector('.ui-jqgrid-hdiv .jqg-third-row-header');

    if (!scheduleTable || !headerContainer) {
        console.error("CalendarUSP: Tabela de grade horária (#tableGradeHoraria) ou seu cabeçalho não foram encontrados.");
        return { success: false, data: [] };
    }

    const headerCells = headerContainer.querySelectorAll('th');
    const daysOfWeek = Array.from(headerCells)
        .slice(2)
        .map(th => {
            const dayAbbreviation = th.querySelector('div').innerText.trim();
            return dayMap[dayAbbreviation] || dayAbbreviation;
        });

    const dataRows = scheduleTable.querySelectorAll('.ui-jqgrid-bdiv tbody tr.jqgrow');
    if (dataRows.length === 0) {
        console.error("CalendarUSP: Tabela encontrada, mas sem linhas de dados (tr.jqgrow).");
        return { success: false, data: [] };
    }

    const disciplineSlots = {};
    const disciplineSpans = {};

    // 1ª Etapa: Coleta inicial da grade visual
    for (const row of dataRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const startTime = cells[0].innerText.trim();
        const endTime = cells[1].innerText.trim();

        for (let i = 2; i < cells.length; i++) {
            const cell = cells[i];
            const classSpan = cell.querySelector('span[data-disciplina]');

            if (classSpan) {
                const disciplineCode = classSpan.getAttribute('data-disciplina');
                if (!disciplineSlots[disciplineCode]) {
                    disciplineSlots[disciplineCode] = [];
                    disciplineSpans[disciplineCode] = classSpan;
                }
                disciplineSlots[disciplineCode].push({
                    day: daysOfWeek[i - 2],
                    startTime: startTime,
                    endTime: endTime
                });
            }
        }
    }

    const finalEvents = [];

    // 2ª Etapa: Abrir detalhes para pegar datas reais e professores
    for (const disciplineCode in disciplineSpans) {
        const classSpan = disciplineSpans[disciplineCode];
        classSpan.click(); 

        const detailsPanel = await waitForElement('#tab_detalhes');
        await new Promise(r => setTimeout(r, 300));

        let fullDisciplineName = disciplineCode;
        let startDate = null;
        let endDate = null;
        let location = "";
        const specificProfMap = {};

        if (detailsPanel) {
            const nameElement = detailsPanel.querySelector('.nomdis');
            if (nameElement) fullDisciplineName = nameElement.innerText.trim();

            // Clica na aba Oferecimento
            const oferTabLink = detailsPanel.querySelector('a[href="#div_oferecimento"]');
            if (oferTabLink) {
                oferTabLink.click();
                await new Promise(r => setTimeout(r, 200));
            }

            const divOferecimento = detailsPanel.querySelector('#div_oferecimento');
            
            if (divOferecimento) {
                // CORREÇÃO AQUI: Usa a função auxiliar para ignorar o template vazio
                const startStr = getTextFromSelectors(divOferecimento, '.dtainitur');
                const endStr = getTextFromSelectors(divOferecimento, '.dtafimtur');
                
                startDate = parsePtDate(startStr);
                endDate = parsePtDate(endStr);

                // Mapeamento de professores
                const rowsHorarios = divOferecimento.querySelectorAll('.horarios tbody tr');
                rowsHorarios.forEach(row => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 4) {
                        const rawDay = cols[0].innerText;
                        const dayFull = normalizeDayName(rawDay);
                        const startTxt = cols[1].innerText.trim();
                        const profName = cols[3].innerText.trim();
                        
                        const key = `${dayFull}-${startTxt}`;
                        specificProfMap[key] = profName;
                    }
                });
            }
        }

        const slots = disciplineSlots[disciplineCode];
        
        slots.forEach(slot => {
            const lookupKey = `${slot.day}-${slot.startTime}`;
            const specificProf = specificProfMap[lookupKey] || "Docente não informado";

            finalEvents.push({
                title: fullDisciplineName,
                code: disciplineCode,
                day: slot.day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                location: location, 
                startDate: startDate ? startDate.toISOString() : null,
                endDate: endDate ? endDate.toISOString() : null,
                professors: specificProf,
                description: `Disciplina: ${disciplineCode}\nProfessor(a): ${specificProf}`
            });
        });
    }

    return { success: true, data: finalEvents };
}

/**
 * Adiciona um listener para receber e responder a mensagens do popup da extensão.
 */
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === "extract") {
        return extractSchedule();
    }
});