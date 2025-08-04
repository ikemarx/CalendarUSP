// Este script é injetado na página do JúpiterWeb para extrair os dados.

function extractSchedule() {
    const scheduleTable = document.querySelector('table#tableGradeHoraria');
    const headerContainer = document.querySelector('.ui-jqgrid-hdiv .jqg-third-row-header');

    if (!scheduleTable || !headerContainer) {
        console.error("Tabela de grade horária (#tableGradeHoraria) ou seu cabeçalho não foram encontrados.");
        return { success: false, data: [] };
    }
    
    const dayMap = {
        'Seg': 'Segunda-feira', 'Ter': 'Terça-feira', 'Qua': 'Quarta-feira',
        'Qui': 'Quinta-feira', 'Sex': 'Sexta-feira', 'Sab': 'Sábado', 'Dom': 'Domingo'
    };
    const headerCells = headerContainer.querySelectorAll('th');
    const daysOfWeek = Array.from(headerCells).slice(2).map(th => {
        const dayAbbreviation = th.querySelector('div').innerText.trim();
        return dayMap[dayAbbreviation] || dayAbbreviation;
    });

    const dataRows = scheduleTable.querySelectorAll('.ui-jqgrid-bdiv tbody tr.jqgrow');

    if (dataRows.length === 0) {
        console.error("Tabela encontrada, mas sem linhas de dados (tr.jqgrow).");
        return { success: false, data: [] };
    }

    const events = [];
    
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;

        const startTime = cells[0].innerText.trim();
        const endTime = cells[1].innerText.trim();

        for (let i = 2; i < cells.length; i++) {
            const cell = cells[i];
            const classSpan = cell.querySelector('span[data-disciplina]');

            if (classSpan) {
                const disciplineCode = classSpan.innerText.trim();
                const fullDisciplineCode = classSpan.getAttribute('data-disciplina');

                const classInfo = {
                    title: disciplineCode,
                    day: daysOfWeek[i - 2], 
                    startTime: startTime,
                    endTime: endTime,
                    location: 'Verificar no JúpiterWeb',
                    description: `Disciplina: ${fullDisciplineCode}\nTurma: ${disciplineCode}`
                };
                events.push(classInfo);
            }
        }
    });

    return { success: true, data: events };
}

// Adiciona um listener para receber mensagens do popup.js usando uma função async.
// Esta é a forma mais robusta de garantir que a resposta seja enviada corretamente.
browser.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action === "extract") {
        const scheduleData = extractSchedule();
        return scheduleData; // Em uma função async, isso retorna uma Promise com os dados.
    }
});