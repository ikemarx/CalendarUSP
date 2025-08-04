// Aguarda o carregamento completo do DOM do popup
document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extract-btn');
    const exportIcsBtn = document.getElementById('export-ics-btn');
    const resultsContainer = document.getElementById('results-container');
    const classList = document.getElementById('class-list');
    const statusMessage = document.getElementById('status-message');
    const errorMessage = document.getElementById('error-message');

    let extractedEvents = [];

    // Função para converter nomes de dias da semana para o formato do iCalendar
    const getDayInitial = (day) => {
        const map = {
            'Segunda-feira': 'MO', 'Terça-feira': 'TU', 'Quarta-feira': 'WE',
            'Quinta-feira': 'TH', 'Sexta-feira': 'FR', 'Sábado': 'SA'
        };
        return map[day] || '';
    };

    // Função para formatar data e hora para o padrão do iCalendar e Google Calendar
    const formatDateTime = (date, time) => {
        const [hours, minutes] = time.split(':');
        const d = new Date(date);
        d.setHours(hours);
        d.setMinutes(minutes);
        d.setSeconds(0);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0];
    };

    // Gera o link para o Google Agenda
    const createGoogleCalendarLink = (event, firstDay) => {
        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description);
        const location = encodeURIComponent(event.location);
        
        const startDate = formatDateTime(firstDay, event.startTime);
        const endDate = formatDateTime(firstDay, event.endTime);

        const dayInitial = getDayInitial(event.day);
        const rrule = `FREQ=WEEKLY;BYDAY=${dayInitial};COUNT=18`;

        return `${baseUrl}&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&recur=RRULE:${rrule}`;
    };

    // Lida com o clique no botão de extração de forma assíncrona
    extractBtn.addEventListener('click', async () => {
        // Esconde a mensagem de erro e atualiza o status
        errorMessage.style.display = 'none';
        statusMessage.textContent = 'Procurando a tabela na página...';

        try {
            let [tab] = await browser.tabs.query({ active: true, currentWindow: true });

            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            const response = await browser.tabs.sendMessage(tab.id, { action: "extract" });

            if (response && response.success && response.data.length > 0) {
                extractedEvents = response.data;
                // Esconde a mensagem de status e o botão de extrair
                statusMessage.style.display = 'none';
                extractBtn.style.display = 'none';
                // Mostra o contêiner de resultados
                resultsContainer.style.display = 'block'; 
                displayResults(extractedEvents);
            } else {
                // Mostra a mensagem de erro
                errorMessage.style.display = 'block';
                statusMessage.textContent = 'Não foi possível extrair os dados.';
            }
        } catch (error) {
            console.error("Erro na extensão:", error);
            errorMessage.textContent = `Erro ao executar o script: ${error.message}`;
            // Mostra a mensagem de erro
            errorMessage.style.display = 'block';
            statusMessage.textContent = 'Falha na extração.';
        }
    });

    // Mostra os resultados na interface do popup
    const displayResults = (events) => {
        classList.innerHTML = '';
        const today = new Date();
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
        if (today.getDay() === 1) firstMonday.setDate(today.getDate());

        events.forEach(event => {
            const li = document.createElement('li');
            li.style.padding = '0.75rem';
            li.style.borderBottom = '1px solid #ccc';

            const eventDayIndex = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - 1));

            const googleLink = createGoogleCalendarLink(event, eventDate);

            // Cria os elementos de forma segura
            const titleP = document.createElement('p');
            titleP.style.fontWeight = 'bold';
            titleP.textContent = event.title;

            const timeP = document.createElement('p');
            timeP.textContent = `${event.day}: ${event.startTime} - ${event.endTime}`;

            const locationP = document.createElement('p');
            locationP.textContent = event.location;

            const linkA = document.createElement('a');
            linkA.href = googleLink;
            linkA.target = '_blank';
            linkA.textContent = 'Adicionar ao Google Agenda';
            linkA.style.marginTop = '0.5rem';
            linkA.style.display = 'inline-block';

            li.appendChild(titleP);
            li.appendChild(timeP);
            li.appendChild(locationP);
            li.appendChild(linkA);
            
            classList.appendChild(li);
        });
    };

    // Lida com o clique no botão de exportar .ics
    exportIcsBtn.addEventListener('click', () => {
        if (extractedEvents.length === 0) return;

        const today = new Date();
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
        if (today.getDay() === 1) firstMonday.setDate(today.getDate());

        const semesterEnd = new Date(firstMonday);
        semesterEnd.setDate(firstMonday.getDate() + 18 * 7);
        const untilDate = semesterEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SeuNome//ExportadorGradeHorariaUSP//PT',
        ];

        extractedEvents.forEach(event => {
            const dayInitial = getDayInitial(event.day);
            if (!dayInitial) return;

            const eventDayIndex = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - 1));

            const dtstart = formatDateTime(eventDate, event.startTime);
            const dtend = formatDateTime(eventDate, event.endTime);

            icsContent.push(
                'BEGIN:VEVENT',
                `DTSTART;TZID=America/Sao_Paulo:${dtstart}`,
                `DTEND;TZID=America/Sao_Paulo:${dtend}`,
                `RRULE:FREQ=WEEKLY;BYDAY=${dayInitial};UNTIL=${untilDate}`,
                `SUMMARY:${event.title}`,
                `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
                `LOCATION:${event.location}`,
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');
        
        const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grade_horaria_usp.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
