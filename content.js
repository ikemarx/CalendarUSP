/**
 * @file content.js
 * @description Este script é injetado na página da grade horária do JúpiterWeb
 * para extrair as informações das disciplinas e seus respectivos horários.
 */

/**
 * Extrai os dados da tabela de grade horária presente na página.
 * @returns {{success: boolean, data: Array<Object>}} Um objeto contendo o status da operação
 * e um array de eventos (aulas) extraídos.
 */
function extractSchedule() {
    // Seleciona os elementos essenciais da página: a tabela de horários e o cabeçalho dos dias.
    const scheduleTable = document.querySelector('table#tableGradeHoraria');
    const headerContainer = document.querySelector('.ui-jqgrid-hdiv .jqg-third-row-header');

    // Validação para garantir que os elementos necessários foram encontrados.
    if (!scheduleTable || !headerContainer) {
        console.error("CalendarUSP: Tabela de grade horária (#tableGradeHoraria) ou seu cabeçalho não foram encontrados.");
        return { success: false, data: [] };
    }
    
    // Mapeia as abreviações dos dias da semana para os nomes completos.
    const dayMap = {
        'Seg': 'Segunda-feira', 'Ter': 'Terça-feira', 'Qua': 'Quarta-feira',
        'Qui': 'Quinta-feira', 'Sex': 'Sexta-feira', 'Sab': 'Sábado', 'Dom': 'Domingo'
    };

    // Extrai os dias da semana do cabeçalho da tabela.
    const headerCells = headerContainer.querySelectorAll('th');
    const daysOfWeek = Array.from(headerCells).slice(2).map(th => {
        const dayAbbreviation = th.querySelector('div').innerText.trim();
        return dayMap[dayAbbreviation] || dayAbbreviation;
    });

    // Seleciona todas as linhas de dados da tabela.
    const dataRows = scheduleTable.querySelectorAll('.ui-jqgrid-bdiv tbody tr.jqgrow');

    // Validação para garantir que a tabela contém dados.
    if (dataRows.length === 0) {
        console.error("CalendarUSP: Tabela encontrada, mas sem linhas de dados (tr.jqgrow).");
        return { success: false, data: [] };
    }

    const events = [];
    
    // Itera sobre cada linha da tabela para extrair as informações das aulas.
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return; // Pula linhas malformadas.

        const startTime = cells[0].innerText.trim();
        const endTime = cells[1].innerText.trim();

        // Itera sobre as células correspondentes aos dias da semana.
        for (let i = 2; i < cells.length; i++) {
            const cell = cells[i];
            const classSpan = cell.querySelector('span[data-disciplina]');

            // Se uma disciplina for encontrada na célula, extrai suas informações.
            if (classSpan) {
                const disciplineCode = classSpan.innerText.trim();
                const fullDisciplineCode = classSpan.getAttribute('data-disciplina');

                const classInfo = {
                    title: disciplineCode,
                    day: daysOfWeek[i - 2], 
                    startTime: startTime,
                    endTime: endTime,
                    location: 'Verificar no JúpiterWeb', // Localização padrão
                    description: `Disciplina: ${fullDisciplineCode}\nTurma: ${disciplineCode}`
                };
                events.push(classInfo);
            }
        }
    });

    return { success: true, data: events };
}

/**
 * Adiciona um listener para receber mensagens do popup.js.
 * Quando uma mensagem com a ação "extract" é recebida, a função extractSchedule é chamada
 * e os dados são retornados para o popup.
 */
browser.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action === "extract") {
        const scheduleData = extractSchedule();
        // Em uma função async, o retorno de um valor o envolve em uma Promise,
        // que é a forma correta de responder a uma mensagem.
        return scheduleData;
    }
});
