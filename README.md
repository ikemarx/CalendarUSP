# CalendarUSP

![Ícone da Extensão](images/icon128.png)

Extensão de navegador para extrair a grade horária do JúpiterWeb (USP) e importá-la para o seu calendário preferido.

[![Licença: MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Instalar

<div align="center">
  <a href="https://addons.mozilla.org/firefox/addon/calendarusp/" title="Adicionar ao Firefox">
    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg" alt="Firefox" width="80">
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/calendarusp/hahlhcelhcokmpgficmnbcnlacikacjb" title="Adicionar ao Chrome">
    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg" alt="Chrome" width="80">
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/calendarusp/hahlhcelhcokmpgficmnbcnlacikacjb" title="Adicionar ao Edge">
    <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg" alt="Edge" width="80">
  </a>
</div>

---

## Funcionalidades

- **Extração automática** — lê disciplinas, turmas, horários, datas de início/fim e professores diretamente da página de grade do JúpiterWeb. Se a grade ainda não foi gerada, aciona o botão "Buscar" automaticamente.
- **Exportação .ics** — gera um arquivo `.ics` com recorrência semanal para o semestre, compatível com Google Agenda, Outlook, Apple Calendar e qualquer app que suporte iCalendar.
- **Links rápidos por aula** — botões Google e Outlook por disciplina, já com a regra de recorrência configurada.
- **Exportação individual** — baixe o `.ics` de uma única aula pelo botão `.ics` em cada card.
- **Seleção de aulas** — marque/desmarque disciplinas antes de exportar; o botão "Baixar .ics (selecionadas)" respeita a seleção.
- **Lembrete configurável** — escolha 10, 15, 30 minutos ou 1 hora de antecedência; o lembrete é embutido no `.ics`.
- **Grade semanal** — alterne para a visualização de grade e veja todas as aulas organizadas por dia e horário.
- **Cache automático** — a última extração fica salva localmente; o popup carrega instantaneamente sem precisar voltar ao JúpiterWeb.

---

## Como usar

1. Instale a extensão pelo link da sua loja acima.
2. Acesse a página de [Grade Horária](https://uspdigital.usp.br/jupiterweb/gradeHoraria) no JúpiterWeb (é necessário estar logado).
3. Clique no ícone da extensão na barra de ferramentas do navegador.
4. Clique em **"Extrair Grade Horária"**. Se a grade ainda não tiver sido gerada na página, a extensão clica em "Buscar" automaticamente e aguarda o carregamento.
5. Suas aulas serão listadas. A partir daí você pode:
   - Clicar em **Google** ou **Outlook** para adicionar uma aula individualmente.
   - Clicar em **.ics** para baixar o arquivo de uma única aula.
   - Selecionar as aulas desejadas e clicar em **"Baixar .ics (selecionadas)"** para exportar em lote.

### Como importar o arquivo `.ics`

- [Google Agenda](https://support.google.com/calendar/answer/37118?hl=pt)
- [Microsoft Outlook](https://support.microsoft.com/pt-br/office/importar-ou-subscrever-um-calend%C3%A1rio-no-outlook-com-cff1429c-5af6-41ec-a5b4-74f2c278e98c)
- [Apple Calendar](https://support.apple.com/pt-br/guide/calendar/icl1023/mac)

---

## Contribuindo

Contribuições são bem-vindas. Abra uma issue para reportar bugs ou sugerir melhorias, ou envie um pull request diretamente.

---

## Licença

Distribuído sob a Licença MIT. Veja [LICENSE](LICENSE) para detalhes.
