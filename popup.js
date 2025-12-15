/**
 * @file popup.js
 * @description Gerencia a lógica da interface do popup da extensão, incluindo a
 * extração de dados da página, a exibição dos resultados e a geração de links
 * e arquivos de calendário (.ics).
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção de Elementos do DOM ---
    const extractBtn = document.getElementById('extract-btn');
    const exportIcsBtn = document.getElementById('export-ics-btn');
    const resultsContainer = document.getElementById('results-container');
    const classList = document.getElementById('class-list');
    const statusMessage = document.getElementById('status-message');
    const errorMessage = document.getElementById('error-message');

    // Armazena os eventos (aulas) extraídos da página.
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
     * Formata um objeto de data e uma string de hora para o padrão de calendário
     * (ex: '20250804T070000'), usando componentes de tempo locais para evitar
     * conversões indesejadas de fuso horário.
     * @param {Date} date - O objeto Date base do evento.
     * @param {string} time - A hora no formato "HH:MM".
     * @returns {string} A data e hora formatada.
     */
    const formatDateTimeForCalendar = (date, time) => {
        const [hours, minutes] = time.split(':');
        const d = new Date(date);

        d.setHours(parseInt(hours, 10));
        d.setMinutes(parseInt(minutes, 10));
        d.setSeconds(0);
        d.setMilliseconds(0);

        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const fHours = d.getHours().toString().padStart(2, '0');
        const fMinutes = d.getMinutes().toString().padStart(2, '0');

        return `${year}${month}${day}T${fHours}${fMinutes}00`;
    };

    /**
     * Formata um objeto Date para uma string de data no formato "YYYY-MM-DD",
     * utilizando métodos que operam no fuso horário local.
     * @param {Date} date - O objeto Date a ser formatado.
     * @returns {string} A data formatada.
     */
    const formatDateForLink = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /**
     * Cria um link para adicionar um evento recorrente ao Google Agenda.
     * @param {Object} event - O objeto da aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Google Agenda.
     */
    const createGoogleCalendarLink = (event, firstDay) => {
        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description);
        const location = encodeURIComponent(event.location);
        const startDate = formatDateTimeForCalendar(firstDay, event.startTime);
        const endDate = formatDateTimeForCalendar(firstDay, event.endTime);
        const dayInitial = getDayInitial(event.day);
        const rrule = `FREQ=WEEKLY;BYDAY=${dayInitial};COUNT=18`;

        // Define explicitamente o fuso horário para garantir a precisão no Google Agenda.
        return `${baseUrl}&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&ctz=America/Sao_Paulo&recur=RRULE:${rrule}`;
    };

    /**
     * Cria um link para adicionar um evento ao Outlook Calendar.
     * @param {Object} event - O objeto da aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Outlook.
     */
    const createOutlookCalendarLink = (event, firstDay) => {
        const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(`${event.description}\n\nAtenção: configure a recorrência para semanalmente, terminando em aprox. 18 semanas.`);
        const location = encodeURIComponent(event.location);
        const startDate = `${formatDateForLink(firstDay)}T${event.startTime}:00`;
        const endDate = `${formatDateForLink(firstDay)}T${event.endTime}:00`;
        return `${baseUrl}&subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${details}&location=${location}`;
    };

    /**
     * Lida com o clique no botão "Extrair Grade Horária", enviando uma mensagem
     * para o content script e processando a resposta.
     */
    extractBtn.addEventListener('click', async () => {
        errorMessage.style.display = 'none';
        statusMessage.textContent = 'Procurando a tabela na página...';

        try {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

            // Injeta o content script na aba ativa para garantir que ele esteja em execução.
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Envia uma mensagem para o content script solicitando a extração dos dados.
            const response = await browser.tabs.sendMessage(tab.id, { action: "extract" });

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
            const p = errorMessage.querySelector('p');
            p.textContent = '';
            const strong = document.createElement('strong');
            strong.textContent = 'Erro: ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode('Falha ao comunicar com a página. Tente recarregar a página do JúpiterWeb e clicar no botão novamente. '));
            const br = document.createElement('br');
            p.appendChild(br);
            const small = document.createElement('small');
            small.textContent = `Detalhe: ${error.message}`;
            p.appendChild(small);
            errorMessage.style.display = 'block';
            statusMessage.textContent = 'Falha na extração.';
        }
    });

    /**
     * Renderiza a lista de aulas extraídas na interface do popup.
     * @param {Array<Object>} events - A lista de aulas.
     */
    const displayResults = (events) => {
        classList.innerHTML = '';
        const today = new Date();

        // Define a data de início como a última segunda-feira para servir de âncora.
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

        events.forEach(event => {
            const li = document.createElement('li');

            // Calcula a data da primeira ocorrência da aula com base na âncora.
            const dayIndexMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const eventDayIndex = dayIndexMap.indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - 1));

            const googleLink = createGoogleCalendarLink(event, eventDate);
            const outlookLink = createOutlookCalendarLink(event, eventDate);

            // Constrói o HTML do item da lista de forma segura para evitar XSS.
            const pTitle = document.createElement('p');
            pTitle.style.fontWeight = 'bold';
            pTitle.style.margin = '0 0 5px 0';
            pTitle.textContent = event.title;

            const pSchedule = document.createElement('p');
            pSchedule.style.margin = '0 0 5px 0';
            pSchedule.textContent = `${event.day}: ${event.startTime} - ${event.endTime}`;

            const pCode = document.createElement('p');
            pCode.style.margin = '0 0 10px 0';
            pCode.style.fontSize = '0.9rem';
            pCode.style.color = '#555';
            pCode.textContent = `Código: ${event.code || 'N/A'}`;

            const divLinks = document.createElement('div');
            divLinks.className = 'calendar-links';

            const aGoogle = document.createElement('a');
            aGoogle.href = googleLink;
            aGoogle.target = '_blank';
            aGoogle.className = 'google-link';
            aGoogle.textContent = 'Google';

            const aOutlook = document.createElement('a');
            aOutlook.href = outlookLink;
            aOutlook.target = '_blank';
            aOutlook.className = 'outlook-link';
            aOutlook.textContent = 'Outlook';

            divLinks.appendChild(aGoogle);
            divLinks.appendChild(aOutlook);
            li.appendChild(pTitle);
            li.appendChild(pSchedule);
            li.appendChild(pCode);
            li.appendChild(divLinks);

            classList.appendChild(li);
        });
    };

    /**
     * Gera e inicia o download de um arquivo .ics contendo todas as aulas extraídas.
     */
    exportIcsBtn.addEventListener('click', () => {
        if (extractedEvents.length === 0) return;

        const today = new Date();
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

        // Define a data de término da recorrência (18 semanas após o início).
        const semesterEnd = new Date(firstMonday);
        semesterEnd.setDate(firstMonday.getDate() + 18 * 7);
        const untilDate = formatDateTimeForCalendar(semesterEnd, '00:00') + 'Z';

        // Inicia a construção do conteúdo do arquivo .ics.
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CalendarUSP//ExportadorGradeHoraria//PT',
            'CALSCALE:GREGORIAN',
            // Adiciona a definição do fuso horário para garantir a correta interpretação.
            'BEGIN:VTIMEZONE',
            'TZID:America/Sao_Paulo',
            'BEGIN:STANDARD',
            'DTSTART:19700101T000000',
            'TZOFFSETFROM:-0300',
            'TZOFFSETTO:-0300',
            'TZNAME:BRT',
            'END:STANDARD',
            'END:VTIMEZONE'
        ];

        extractedEvents.forEach(event => {
            const dayInitial = getDayInitial(event.day);
            if (!dayInitial) return;

            const dayIndexMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const eventDayIndex = dayIndexMap.indexOf(event.day);
            const eventDate = new Date(firstMonday);
            eventDate.setDate(firstMonday.getDate() + (eventDayIndex - 1));

            const dtstart = formatDateTimeForCalendar(eventDate, event.startTime);
            const dtend = formatDateTimeForCalendar(eventDate, event.endTime);

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

        // Cria um Blob e simula um clique para iniciar o download do arquivo.
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
