/**
 * @file content.js
 * @description Script injetado na página de grade horária do JúpiterWeb (USP) para
 * extrair as informações das disciplinas e seus respectivos horários.
 * Esta versão corrigida evita condições de corrida ao extrair os detalhes das disciplinas.
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
                console.warn(`CalendarUSP: Tempo esgotado esperando por "${selector}".`);
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

    // 1ª Etapa: Coletar todos os horários e disciplinas únicas da grade
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
                    disciplineSpans[disciplineCode] = classSpan; // Guarda a primeira referência ao span para clicar depois
                }
                disciplineSlots[disciplineCode].push({
                    day: daysOfWeek[i - 2],
                    startTime: startTime,
                    endTime: endTime
                });
            }
        }
    }

    const events = [];

    // 2ª Etapa: Iterar sobre as disciplinas únicas, clicar e extrair os detalhes
    for (const disciplineCode in disciplineSpans) {
        const classSpan = disciplineSpans[disciplineCode];
        classSpan.click();

        const detailsPanel = await waitForElement('#tab_detalhes');
        // Adiciona uma pequena pausa para garantir que o conteúdo do painel foi carregado
        await new Promise(resolve => setTimeout(resolve, 300));

        let fullDisciplineName = disciplineCode; // Nome de fallback
        let professors = "Não encontrado";
        let location = "Verificar no JúpiterWeb";

        if (detailsPanel) {
            const nameElement = detailsPanel.querySelector('.nomdis');
            if (nameElement) {
                fullDisciplineName = nameElement.innerText.trim();
            }

            const professorElements = detailsPanel.querySelectorAll('.docenteResponsavel');
            if (professorElements.length > 0) {
                professors = Array.from(professorElements)
                    .map(p => p.innerText.trim().replace(/^\d+\s*-\s*/, ''))
                    .join(', ');
            }
        }

        events.push({
            title: disciplineCode,
            fullTitle: fullDisciplineName,
            professors: professors,
            location: location,
            description: `Disciplina: ${fullDisciplineName}\nProfessor(es): ${professors}`,
            schedule: disciplineSlots[disciplineCode]
        });
    }

    // Formata a saída final, criando um evento para cada horário
    const finalEvents = [];
    events.forEach(event => {
        event.schedule.forEach(slot => {
            // Garante que não haja duplicatas de horários para a mesma disciplina
            if (!finalEvents.some(e => e.title.startsWith(event.title) && e.day === slot.day && e.startTime === slot.startTime)) {
                finalEvents.push({
                    title: `${event.title} - ${event.fullTitle}`,
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    location: event.location,
                    description: event.description
                });
            }
        });
    });

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