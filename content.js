/**
 * @file content.js
 * @description Script injetado na página de grade horária do JúpiterWeb (USP) para
 * extrair as informações das disciplinas e seus respectivos horários.
 * Este script é executado no contexto da página para acessar o DOM.
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
 * Extrai os dados da tabela de grade horária presente na página do JúpiterWeb.
 * @returns {{success: boolean, data: Array<Object>}} Um objeto contendo o status
 * da operação e um array de objetos, onde cada objeto representa uma aula.
 */
function extractSchedule() {
    // Seleciona os elementos-chave da página: a tabela de horários e o cabeçalho dos dias.
    const scheduleTable = document.querySelector('table#tableGradeHoraria');
    const headerContainer = document.querySelector('.ui-jqgrid-hdiv .jqg-third-row-header');

    // Valida se os elementos necessários para a extração foram encontrados.
    if (!scheduleTable || !headerContainer) {
        console.error("CalendarUSP: Tabela de grade horária (#tableGradeHoraria) ou seu cabeçalho não foram encontrados.");
        return { success: false, data: [] };
    }

    // Extrai os dias da semana a partir do cabeçalho da tabela.
    const headerCells = headerContainer.querySelectorAll('th');
    const daysOfWeek = Array.from(headerCells)
        .slice(2) // As duas primeiras colunas são de horário.
        .map(th => {
            const dayAbbreviation = th.querySelector('div').innerText.trim();
            return dayMap[dayAbbreviation] || dayAbbreviation;
        });

    // Seleciona todas as linhas de dados da tabela.
    const dataRows = scheduleTable.querySelectorAll('.ui-jqgrid-bdiv tbody tr.jqgrow');

    // Valida se a tabela contém linhas de dados.
    if (dataRows.length === 0) {
        console.error("CalendarUSP: Tabela encontrada, mas sem linhas de dados (tr.jqgrow).");
        return { success: false, data: [] };
    }

    const events = [];
    
    // Itera sobre cada linha da tabela para extrair as informações das aulas.
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return; // Pula linhas que não contêm dados de horário.

        const startTime = cells[0].innerText.trim();
        const endTime = cells[1].innerText.trim();

        // Itera sobre as células correspondentes aos dias da semana.
        for (let i = 2; i < cells.length; i++) {
            const cell = cells[i];
            const classSpan = cell.querySelector('span[data-disciplina]');

            // Se uma disciplina for encontrada na célula, extrai suas informações.
            if (classSpan) {
                const disciplineCode = classSpan.innerText.trim();
                const fullDisciplineName = classSpan.getAttribute('data-disciplina');

                const classInfo = {
                    title: disciplineCode,
                    day: daysOfWeek[i - 2], 
                    startTime: startTime,
                    endTime: endTime,
                    location: 'Verificar no JúpiterWeb', // Localização padrão.
                    description: `Disciplina: ${fullDisciplineName}\nTurma: ${disciplineCode}`
                };
                events.push(classInfo);
            }
        }
    });

    return { success: true, data: events };
}

/**
 * Adiciona um listener para receber e responder a mensagens do popup da extensão.
 * Quando uma mensagem com a ação "extract" é recebida, a função `extractSchedule`
 * é chamada e os dados extraídos são retornados ao popup.
 */
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === "extract") {
        const scheduleData = extractSchedule();
        // O retorno de uma função listener de mensagem assíncrona envia uma resposta.
        return Promise.resolve(scheduleData);
    }
});
