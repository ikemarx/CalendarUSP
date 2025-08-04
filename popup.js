/**
 * @file popup.js
 * @description Gerencia a lógica da interface do popup da extensão, incluindo a extração de dados,
 * a exibição dos resultados e a exportação para formatos de calendário.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção de Elementos do DOM ---
    const extractBtn = document.getElementById('extract-btn');
    const exportIcsBtn = document.getElementById('export-ics-btn');
    const resultsContainer = document.getElementById('results-container');
    const classList = document.getElementById('class-list');
    const statusMessage = document.getElementById('status-message');
    const errorMessage = document.getElementById('error-message');

    // Armazena os eventos extraídos da página.
    let extractedEvents = [];

    /**
     * Converte o nome do dia da semana para a sigla padrão do formato iCalendar (ICS).
     * @param {string} day - O nome completo do dia (ex: 'Segunda-feira').
     * @returns {string} A sigla de dois caracteres (ex: 'MO').
     */
    const getDayInitial = (day) => {
        const map = {
            'Segunda-feira': 'MO', 'Terça-feira': 'TU', 'Quarta-feira': 'WE',
            'Quinta-feira': 'TH', 'Sexta-feira': 'FR', 'Sábado': 'SA'
        };
        return map[day] || '';
    };

    /**
     * Formata data e hora para o padrão iCalendar (ICS), removendo hífens e dois-pontos.
     * @param {Date} date - O objeto Date do evento.
     * @param {string} time - A hora no formato "HH:MM".
     * @returns {string} A data e hora formatada (ex: '20250804T100000').
     */
    const formatDateTimeICS = (date, time) => {
        const [hours, minutes] = time.split(':');
        const d = new Date(date);
        d.setHours(hours);
        d.setMinutes(minutes);
        d.setSeconds(0);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0];
    };
    
    /**
     * Formata um objeto Date para uma string de data no formato "YYYY-MM-DD".
     * @param {Date} date - O objeto Date a ser formatado.
     * @returns {string} A data formatada.
     */
    const formatDateForLink = (date) => {
        return date.toISOString().split('T')[0];
    };

    // --- Funções para Criar Links de Calendário ---

    /**
     * Cria um link para adicionar um evento recorrente ao Google Agenda.
     * @param {Object} event - O objeto do evento/aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Google Agenda.
     */
    const createGoogleCalendarLink = (event, firstDay) => {
        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description);
        const location = encodeURIComponent(event.location);
        const startDate = formatDateTimeICS(firstDay, event.startTime);
        const endDate = formatDateTimeICS(firstDay, event.endTime);
        const dayInitial = getDayInitial(event.day);
        // Define uma regra de recorrência semanal por 18 semanas.
        const rrule = `FREQ=WEEKLY;BYDAY=${dayInitial};COUNT=18`;
        return `${baseUrl}&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&recur=RRULE:${rrule}`;
    };

    /**
     * Cria um link para adicionar um evento ao Outlook Calendar.
     * @param {Object} event - O objeto do evento/aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Outlook.
     */
    const createOutlookCalendarLink = (event, firstDay) => {
        const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent';
        const title = encodeURIComponent(event.title);
        // Adiciona uma nota para o usuário configurar a recorrência manualmente.
        const details = encodeURIComponent(`${event.description}\n\nAtenção: configure a recorrência para semanalmente, terminando em aprox. 18 semanas.`);
        const location = encodeURIComponent(event.location);
        const startDate = `${formatDateForLink(firstDay)}T${event.startTime}:00`;
        const endDate = `${formatDateForLink(firstDay)}T${event.endTime}:00`;
        return `${baseUrl}&subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${details}&location=${location}`;
    };

    // --- Event Listeners ---

    /**
     * Lida com o clique no botão "Extrair Grade Horária".
     * Injeta o content script e solicita a extração dos dados.
     */
    extractBtn.addEventListener('click', async () => {
        errorMessage.style.display = 'none';
        statusMessage.textContent = 'Procurando a tabela na página...';

        try {
            // Obtém a aba ativa e atual.
            let [tab] = await browser.tabs.query({ active: true, currentWindow: true });

            // Garante que o content script seja injetado na página.
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // Envia uma mensagem para o content script solicitando os dados.
            const response = await browser.tabs.sendMessage(tab.id, { action: "extract" });

            // Processa a resposta do content script.
            if (response && response.success && response.data.length > 0) {
                extractedEvents = response.data;
                statusMessage.style.display = 'none';
                extractBtn.style.display = 'none';
                resultsContainer.style.display = 'block'; 
                displayResults(extractedEvents);
            } else {
                errorMessage.style.display = 'block';
                statusMessage.textContent = 'Não foi possível extrair os dados.';
            }
        } catch (error) {
            console.error("Erro na extensão:", error);
            errorMessage.querySelector('p').innerHTML = `<strong>Erro:</strong> Falha ao comunicar com a página. Tente recarregar a página do JúpiterWeb e clicar no botão novamente. <br><small>Detalhe: ${error.message}</small>`;
            errorMessage.style.display = 'block';
            statusMessage.textContent = 'Falha na extração.';
        }
    });

    /**
     * Exibe os resultados extraídos na interface do popup.
     * @param {Array<Object>} events - A lista de eventos/aulas.
     */
    const displayResults = (events) => {
        classList.innerHTML = '';
        const today = new Date();
        // Calcula a data da primeira segunda-feira da semana atual para usar como base.
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

        events.forEach(event => {
            const li = document.createElement('li');
            
            // Calcula a data correta para a primeira ocorrência da aula.
            const eventDayIndex = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - (firstMonday.getDay() || 7) ));

            // Gera os links para os calendários.
            const googleLink = createGoogleCalendarLink(event, eventDate);
            const outlookLink = createOutlookCalendarLink(event, eventDate);
            
            li.innerHTML = `
                <p style="font-weight: bold; margin: 0 0 5px 0;">${event.title}</p>
                <p style="margin: 0 0 5px 0;">${event.day}: ${event.startTime} - ${event.endTime}</p>
                <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #555;">Local: ${event.location}</p>
                <div class="calendar-links">
                    <a href="${googleLink}" target="_blank" class="google-link">Google</a>
                    <a href="${outlookLink}" target="_blank" class="outlook-link">Outlook</a>
                </div>
            `;
            
            classList.appendChild(li);
        });
    };

    /**
     * Lida com o clique no botão "Exportar Tudo (.ics)".
     * Gera um arquivo .ics com todos os eventos e inicia o download.
     */
    exportIcsBtn.addEventListener('click', () => {
        if (extractedEvents.length === 0) return;

        // Calcula a data de início (primeira segunda-feira) e de fim do semestre (18 semanas depois).
        const today = new Date();
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

        const semesterEnd = new Date(firstMonday);
        semesterEnd.setDate(firstMonday.getDate() + 18 * 7); 
        const untilDate = semesterEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // Inicia a construção do conteúdo do arquivo .ics.
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CalendarUSP//ExportadorGradeHoraria//PT',
            'CALSCALE:GREGORIAN',
        ];

        // Adiciona cada evento ao arquivo .ics.
        extractedEvents.forEach(event => {
            const dayInitial = getDayInitial(event.day);
            if (!dayInitial) return;

            const eventDayIndex = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - (firstMonday.getDay() || 7) ));

            const dtstart = formatDateTimeICS(eventDate, event.startTime);
            const dtend = formatDateTimeICS(eventDate, event.endTime);

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
        
        // Cria um Blob com o conteúdo e simula um clique para fazer o download.
        const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
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
