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
            'Quinta-feira': 'TH', 'Sexta-feira': 'FR', 'Sábado': 'SA', 'Domingo': 'SU'
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
     * Calcula a primeira ocorrência do dia da semana (targetDayName)
     * a partir de uma data de início (startDate).
     */
    const calculateFirstClassDate = (startDate, targetDayName) => {
        const daysMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const targetIndex = daysMap.indexOf(targetDayName);
        if (targetIndex === -1) return new Date(startDate); // Fallback

        const start = new Date(startDate);
        const currentIndex = start.getDay();
        
        let daysToAdd = targetIndex - currentIndex;
        if (daysToAdd < 0) {
            daysToAdd += 7;
        }

        const firstClass = new Date(start);
        firstClass.setDate(start.getDate() + daysToAdd);
        return firstClass;
    };

        /**
     * Cria um link para adicionar um evento recorrente ao Google Agenda.
     * @param {Object} event - O objeto da aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Google Agenda.
     */
    const createGoogleCalendarLink = (event, firstDate) => {
        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description);
        const location = encodeURIComponent(event.location);
        const startDateTime = formatDateTimeForCalendar(firstDate, event.startTime);
        const endDateTime = formatDateTimeForCalendar(firstDate, event.endTime);
        const dayInitial = getDayInitial(event.day);
        
        let rrule = `FREQ=WEEKLY;BYDAY=${dayInitial}`;
        
        // Se tiver data de fim, usa UNTIL
        if (event.endDate) {
            // Google Calendar via URL aceita YYYYMMDD para UNTIL
            const endD = new Date(event.endDate);
            const y = endD.getFullYear();
            const m = (endD.getMonth() + 1).toString().padStart(2, '0');
            const d = endD.getDate().toString().padStart(2, '0');
            // Adiciona um dia de margem ou define horário final do dia para garantir inclusão
            rrule += `;UNTIL=${y}${m}${d}T235959Z`;
        } else {
            rrule += `;COUNT=18`;
        }

        return `${baseUrl}&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${location}&ctz=America/Sao_Paulo&recur=RRULE:${rrule}`;
    };

        /**
     * Cria um link para adicionar um evento ao Outlook Calendar.
     * @param {Object} event - O objeto da aula.
     * @param {Date} firstDay - A data da primeira ocorrência da aula.
     * @returns {string} A URL completa para o Outlook.
     */
    const createOutlookCalendarLink = (event, firstDate) => {
        const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent';
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description);
        const location = encodeURIComponent(event.location);
        const startStr = `${formatDateForLink(firstDate)}T${event.startTime}:00`;
        const endStr = `${formatDateForLink(firstDate)}T${event.endTime}:00`;
        
        // Outlook Web via link simples não suporta RRULE complexa facilmente na URL GET,
        // então mantemos o aviso no corpo para o usuário configurar.
        return `${baseUrl}&subject=${title}&startdt=${startStr}&enddt=${endStr}&body=${details}&location=${location}`;
    };

    /**
     * Lida com o clique no botão "Extrair Grade Horária", enviando uma mensagem
     * para o content script e processando a resposta.
     */
    extractBtn.addEventListener('click', async () => {
        errorMessage.style.display = 'none';
        statusMessage.textContent = 'Extraindo dados (isso pode levar alguns segundos)...';

        try {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            const response = await browser.tabs.sendMessage(tab.id, { action: "extract" });

            if (response && response.success && response.data.length > 0) {
                extractedEvents = response.data;
                statusMessage.style.display = 'none';
                extractBtn.style.display = 'none';
                resultsContainer.style.display = 'block';
                displayResults(extractedEvents);
            } else {
                errorMessage.style.display = 'block';
                statusMessage.textContent = 'Erro ao extrair.';
            }
        } catch (error) {
            console.error(error);
            const p = errorMessage.querySelector('p');
            p.innerText = `Erro: ${error.message}. Tente recarregar a página do Júpiter.`;
            errorMessage.style.display = 'block';
            statusMessage.textContent = 'Falha.';
        }
    });

    const displayResults = (events) => {
        classList.innerHTML = '';
        
        events.forEach(event => {
            const li = document.createElement('li');

            // Determinar a data da primeira aula
            let firstClassDate;
            if (event.startDate) {
                firstClassDate = calculateFirstClassDate(event.startDate, event.day);
            } else {
                // Fallback (lógica antiga) se não achou data
                const today = new Date();
                firstClassDate = calculateFirstClassDate(today, event.day);
            }

            const googleLink = createGoogleCalendarLink(event, firstClassDate);
            const outlookLink = createOutlookCalendarLink(event, firstClassDate);

            const pTitle = document.createElement('p');
            pTitle.style.fontWeight = 'bold';
            pTitle.style.margin = '0 0 5px 0';
            pTitle.textContent = event.title;

            const pSchedule = document.createElement('p');
            pSchedule.style.margin = '0 0 5px 0';
            pSchedule.textContent = `${event.day}: ${event.startTime} - ${event.endTime}`;

            // Exibe o Professor
            const pProf = document.createElement('p');
            pProf.style.margin = '0 0 5px 0';
            pProf.style.fontSize = '0.85rem';
            pProf.style.color = '#555';
            pProf.style.fontStyle = 'italic';
            pProf.textContent = event.professors || 'Prof. não identificado';

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
            li.appendChild(pProf);
            li.appendChild(divLinks);

            classList.appendChild(li);
        });
    };

    /**
     * Gera e inicia o download de um arquivo .ics contendo todas as aulas extraídas.
     */
    exportIcsBtn.addEventListener('click', () => {
        if (extractedEvents.length === 0) return;

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CalendarUSP//ExportadorGradeHoraria//PT',
            'CALSCALE:GREGORIAN',
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

            // Calcular primeira aula
            let firstClassDate;
            if (event.startDate) {
                firstClassDate = calculateFirstClassDate(event.startDate, event.day);
            } else {
                firstClassDate = calculateFirstClassDate(new Date(), event.day);
            }

            const dtstart = formatDateTimeForCalendar(firstClassDate, event.startTime);
            const dtend = formatDateTimeForCalendar(firstClassDate, event.endTime);

            // Regra de recorrência
            let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayInitial}`;
            if (event.endDate) {
                // Formata UNTIL para UTC (aproximado, adicionando Z ao final da string local formatada 
                // para garantir que a data final inclua a última aula)
                const endD = new Date(event.endDate);
                endD.setHours(23, 59, 59);
                
                // Formato básico para iCal UNTIL: YYYYMMDDTHHMMSSZ
                const y = endD.getFullYear();
                const m = (endD.getMonth() + 1).toString().padStart(2, '0');
                const d = endD.getDate().toString().padStart(2, '0');
                const h = endD.getHours().toString().padStart(2, '0');
                const min = endD.getMinutes().toString().padStart(2, '0');
                const s = endD.getSeconds().toString().padStart(2, '0');
                
                rrule += `;UNTIL=${y}${m}${d}T${h}${min}${s}Z`;
            } else {
                rrule += `;COUNT=18`;
            }

            icsContent.push(
                'BEGIN:VEVENT',
                `DTSTART;TZID=America/Sao_Paulo:${dtstart}`,
                `DTEND;TZID=America/Sao_Paulo:${dtend}`,
                rrule,
                `SUMMARY:${event.title}`,
                `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
                `LOCATION:${event.location}`,
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');

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