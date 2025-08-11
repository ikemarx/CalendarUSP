/**
 * @file content.js
 * @description Script injetado na página de grade horária do JúpiterWeb (USP) para
 * extrair as informações das disciplinas e seus respectivos horários.
 * Esta versão modificada clica em cada disciplina para extrair detalhes adicionais.
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
 * que é carregado dinamicamente (via AJAX, etc.).
 * @param {string} selector - O seletor CSS do elemento a ser aguardado.
 * @param {number} timeout - O tempo máximo de espera em milissegundos.
 * @returns {Promise<Element|null>} Uma promessa que resolve com o elemento ou null se o tempo esgotar.
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise(resolve => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            // Adicionamos uma verificação extra para garantir que o painel não só existe, mas está visível.
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                clearInterval(interval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.warn(`CalendarUSP: Tempo esgotado esperando por "${selector}".`);
                resolve(null);
            }
        }, 100); // Verifica a cada 100ms
    });
}

/**
 * Extrai os dados da tabela de grade horária, clicando em cada disciplina
 * para obter detalhes adicionais de um painel dinâmico.
 * @returns {Promise<{success: boolean, data: Array<Object>}>} Um objeto contendo o status
 * da operação e um array de objetos, onde cada objeto representa uma aula.
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

    const events = [];
    const processedDisciplines = new Set(); // Para não processar a mesma disciplina múltiplas vezes

    // Itera sobre cada linha da tabela para encontrar as aulas
    for (const row of dataRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const startTime = cells[0].innerText.trim();
        const endTime = cells[1].innerText.trim();

        for (let i = 2; i < cells.length; i++) {
            const cell = cells[i];
            const classSpan = cell.querySelector('span[data-disciplina]');

            if (classSpan) {
                // Usamos o 'data-disciplina' que é um código limpo (ex: "PTC3314")
                const disciplineCode = classSpan.getAttribute('data-disciplina');
                
                // Se já processamos esta disciplina, apenas adicionamos o novo horário
                const existingEvent = events.find(e => e.title === disciplineCode);
                if (existingEvent) {
                    // Evita adicionar horários duplicados se a lógica passar aqui mais de uma vez
                    if (!existingEvent.schedule.some(s => s.day === daysOfWeek[i - 2] && s.startTime === startTime)) {
                         existingEvent.schedule.push({
                            day: daysOfWeek[i - 2],
                            startTime: startTime,
                            endTime: endTime
                        });
                    }
                    continue;
                }

                // Se for uma nova disciplina, marcamos para processar e extrair os detalhes
                processedDisciplines.add(disciplineCode);

                // 1. Simula o clique para abrir o painel de detalhes
                classSpan.click();

                // 2. Aguarda o painel de detalhes aparecer
                const detailsPanel = await waitForElement('#tab_detalhes');

                let fullDisciplineName = disciplineCode; // Fallback
                let professors = "Não encontrado";
                let location = "Verificar no JúpiterWeb"; // Localização não está disponível neste painel

                if (detailsPanel) {
                    // 3. Extrai os dados do painel com os seletores corretos
                    const nameElement = detailsPanel.querySelector('.nomdis');
                    if (nameElement) fullDisciplineName = nameElement.innerText.trim();

                    const professorElements = detailsPanel.querySelectorAll('.docenteResponsavel');
                    if (professorElements.length > 0) {
                        professors = Array.from(professorElements)
                            .map(p => p.innerText.trim().replace(/^\d+\s*-\s*/, '')) // Remove o número e o hífen do início
                            .join(', ');
                    }
                }

                const classInfo = {
                    title: disciplineCode,
                    fullTitle: fullDisciplineName,
                    professors: professors,
                    location: location,
                    description: `Disciplina: ${fullDisciplineName}\nProfessor(es): ${professors}`,
                    schedule: [{
                        day: daysOfWeek[i - 2],
                        startTime: startTime,
                        endTime: endTime
                    }]
                };
                events.push(classInfo);
            }
        }
    }

    // Expande os eventos para que cada horário seja um evento separado no final
    const finalEvents = [];
    events.forEach(event => {
        event.schedule.forEach(slot => {
            finalEvents.push({
                title: `${event.title} - ${event.fullTitle}`,
                day: slot.day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                location: event.location,
                description: event.description
            });
        });
    });

    return { success: true, data: finalEvents };
}

/**
 * Adiciona um listener para receber e responder a mensagens do popup da extensão.
 */
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === "extract") {
        // Retorna a promessa diretamente, pois a função de extração agora é assíncrona.
        return extractSchedule();
    }
});
