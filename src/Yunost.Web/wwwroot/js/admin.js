/* Фронтенд панели управления. До подключения Identity + SQL Server
   доступны редактор и предпросмотр. Публикация, роли и начисления не имитируются.
   Серверные права будут проверяться независимо от отображаемых кнопок. */
window.YunostAdmin = (() => {
  'use strict';
  let helpers;
  let attachments = [];
  let editorType = 'news';
  let activeRoute = '';
  let generation = 0;
  const maxFiles = 6;
  const maxFileBytes = 5 * 1024 * 1024;
  const zone = 'Asia/Novosibirsk';
  const unavailable = 'Панель пока работает в режиме подготовки интерфейса. Изменения на сервер не отправлены. Подключение учётных записей и SQL Server — следующий этап.';
  const dateText = date => new Intl.DateTimeFormat('ru-RU', {timeZone: zone, day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
  const parseDate = value => value ? new Date(value + ':00+07:00') : null;
  const toInput = date => {
    const parts = new Intl.DateTimeFormat('sv-SE', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
    return parts.replace(' ', 'T');
  };

  function nav(route) {
    const links = [['/manage','Публикации'],['/manage/rewards','Участие и яблоки'],['/manage/team','Команда и права'],['/manage/cleanup','Очистка']];
    return `<nav class="manage-nav" aria-label="Управление сайтом">${links.map(([p,t])=>`<a href="#${p}" class="${p===route || (p==='/manage'&&route==='/manage/new')?'active':''}">${t}</a>`).join('')}<a href="#/" class="manage-back">На сайт ↗</a></nav><p class="manage-stage">Фронтенд панели · публикация, выдача прав и начисления станут доступны после подключения сервера и базы.</p>`;
  }

  function publications() {
    const {icon,link} = helpers;
    return `<div class="manage-heading"><div><span class="eyebrow">Управление «Юностью»</span><h1>Всё важное — в одной ленте.</h1><p>Новости, события и люди, которые делают их возможными.</p></div>${link('#/manage/new','Создать публикацию','button cyan','arrow')}</div><div class="manage-layout"><section class="panel publication-panel"><div class="post-status-tabs" role="group" aria-label="Статус публикаций">${['Опубликовано','Запланировано','Черновики','Истёкшие'].map((t,i)=>`<button type="button" data-post-status="${t}" aria-pressed="${i===0}">${t}</button>`).join('')}</div><div class="publication-empty"><div class="empty-symbol">${icon('calendar')}</div><h2 id="publication-list-title">Твои публикации будут здесь</h2><p id="publication-list-description">Список загрузится после подключения базы. Уже можно собрать публикацию и посмотреть, как она будет выглядеть на сайте.</p>${link('#/manage/new','Написать новость','button soft')}</div></section><aside class="manage-tips"><div class="panel"><span class="tag">Быстрое действие</span><h2>Есть повод встретиться?</h2><p>Создай мероприятие, укажи время и награду участникам в яблоках.</p>${link('#/manage/new?type=event','Создать мероприятие','button wide','calendar')}</div><div class="panel"><h3>Срок показа — у каждой записи</h3><p>Ты сама выбираешь дату. Когда срок пройдёт, запись исчезнет из ленты автоматически.</p>${link('#/manage/cleanup','Как работает очистка','text-link','arrow')}</div></aside></div>`;
  }

  function editor() {
    editorType = new URLSearchParams(location.hash.split('?')[1] || '').get('type') === 'event' ? 'event' : 'news';
    const {icon} = helpers;
    return `<div class="manage-heading"><div><a class="back-link" href="#/manage">← К публикациям</a><h1>Поделись тем, что важно.</h1><p>Напиши текст, добавь фотографии. Остальное — в нескольких полях.</p></div><span class="timezone-badge">Время Новосибирска · UTC+7</span></div><div class="composer-layout"><form id="publication-form" class="panel composer"><div class="compose-type" role="group" aria-label="Тип публикации"><button type="button" data-compose-type="news" aria-pressed="${editorType==='news'}">${icon('heart')} Новость</button><button type="button" data-compose-type="event" aria-pressed="${editorType==='event'}">${icon('calendar')} Мероприятие</button></div><div class="field"><label for="post-title">Заголовок</label><input id="post-title" name="title" placeholder="О чём расскажем команде?" maxlength="120" required><span class="field-counter" id="title-counter">0 / 120</span></div><div class="field"><label for="post-body">Текст публикации</label><textarea id="post-body" name="body" rows="6" maxlength="5000" placeholder="Пиши так, как рассказываешь друзьям. Можно разделять текст на абзацы." required></textarea><span class="field-counter" id="body-counter">0 / 5000</span></div><div class="upload-zone"><label class="button soft" for="post-photos">+ Добавить фотографии</label><input type="file" id="post-photos" accept="image/jpeg,image/png,image/webp" multiple><p>До 6 фото · JPG, PNG или WebP · до 5 МБ каждое</p><div id="attachment-list" class="attachment-list"></div><p class="form-status" id="attachment-status" role="alert"></p></div><fieldset id="event-fields" class="event-fields"><legend>Подробности мероприятия</legend><div class="field-row"><div class="field"><label for="event-start">Начало</label><input id="event-start" name="startsAt" type="datetime-local" required></div><div class="field"><label for="event-end">Окончание</label><input id="event-end" name="endsAt" type="datetime-local" required></div></div><div class="field"><label for="event-place">Где встречаемся</label><input id="event-place" name="place" placeholder="Место и адрес" maxlength="250" required></div><div class="field-row"><div class="field"><label for="event-reward">Награда за участие, яблок</label><input id="event-reward" name="reward" type="number" min="0" max="5000" step="1" value="15" required></div><div class="field"><label for="event-capacity">Количество мест</label><input id="event-capacity" name="capacity" type="number" min="1" max="1000" step="1" value="20" required></div></div><p class="small-note">Яблоки получают подтверждённые участники. Один человек — одно начисление за мероприятие.</p></fieldset><div class="compose-settings"><div class="field"><label for="post-audience">Кому показать</label><select id="post-audience" name="audience"><option value="public">Всем посетителям сайта</option><option value="team">Только участникам отряда</option></select></div><div class="field"><label for="publication-start">Когда опубликовать</label><select id="publication-start" name="publishMode"><option value="now">Сразу после нажатия «Опубликовать»</option><option value="scheduled">Выбрать дату и время</option></select></div><div class="field" id="scheduled-field" hidden><label for="scheduled-at">Дата публикации</label><input id="scheduled-at" name="publishAt" type="datetime-local"></div><div class="field"><label for="post-lifetime">Сколько показывать в ленте</label><select id="post-lifetime" name="lifetime"><option value="1">1 день</option><option value="7" selected>7 дней</option><option value="30">30 дней</option><option value="custom">До выбранной даты</option></select></div><div class="field" id="expiry-field" hidden><label for="expires-at">Убрать из ленты</label><input id="expires-at" name="expiresAt" type="datetime-local"></div></div><p id="lifetime-summary" class="lifetime-summary"></p><p class="form-status" id="publish-status" role="alert"></p><div class="compose-actions"><button class="button" type="submit">Опубликовать ${icon('arrow')}</button><button class="button outline" type="button" data-admin-action="draft">Сохранить черновик</button></div><p class="small-note">Сейчас работает предпросмотр. Текст и фотографии остаются только в этой открытой форме, пока база не подключена.</p></form><aside class="composer-preview"><div class="preview-caption"><span>Так увидят публикацию</span><span class="tag">Предпросмотр</span></div><article class="live-post"><div class="post-author"><img src="assets/images/logo.webp" alt=""><div><strong>Педагогический отряд «Юность»</strong><span id="preview-published">После публикации</span></div></div><div class="live-post-content"><span class="tag" id="preview-type">Новость</span><h2 id="preview-title">Здесь будет твой заголовок</h2><p id="preview-body">А здесь — история, которой ты хочешь поделиться.</p></div><div id="preview-photos" class="preview-photos"></div><div id="preview-event" class="preview-event" hidden></div><div class="post-preview-footer"><span id="preview-audience">Всем посетителям</span><span id="preview-expiry">7 дней в ленте</span></div></article><div class="preview-help"><h3>Удобно и на телефоне</h3><p>Фотографии подстраиваются под ширину экрана, длинный текст переносится, а кнопки остаются удобными для нажатия.</p></div></aside></div>`;
  }

  function team() {
    const {icon} = helpers;
    return `<div class="manage-heading"><div><span class="eyebrow">Команда и права</span><h1>Нужный доступ — нужным людям.</h1><p>Ты назначаешь совладельца. Он помогает управлять администраторами и публикациями.</p></div></div><section class="panel owner-card"><span class="owner-avatar">АГ</span><div><span class="tag">Главный администратор проекта</span><h2>Гущина Алина Артемовна</h2><p>При запуске твоя учётная запись будет закреплена за владельцем. Совладелец и администраторы не смогут снять с тебя эту роль.</p></div><span class="protected-role">${icon('lock')} Защищённая роль</span></section><section class="role-grid"><article class="panel role-card"><div class="role-symbol">${icon('user')}</div><h2>Совладелец</h2><p>Помогает тебе вести сайт, назначает и снимает администраторов, работает с публикациями и мероприятиями.</p><ul><li>Назначаешь только ты</li><li>Не может менять владельца</li><li>Не может назначать другого совладельца</li></ul><button class="button wide" data-admin-action="add-coowner">Добавить совладельца</button></article><article class="panel role-card"><div class="role-symbol">${icon('calendar')}</div><h2>Администраторы</h2><p>Публикуют новости и мероприятия. Подтверждают участие и выдают награды за события, которые ведут.</p><ul><li>Назначаешь ты или совладелец</li><li>Работают со своими публикациями</li><li>Не выдают права другим людям</li></ul><button class="button soft wide" data-admin-action="add-admin">Добавить администратора</button></article></section><section class="panel team-list"><h2>Участники с доступом</h2><p>После подключения аккаунтов здесь появятся поиск по имени и почте, список ролей и кнопки изменения доступа. Назначать права можно будет существующим зарегистрированным пользователям.</p><div class="field section-space"><label for="team-search">Найти участника</label><input type="search" id="team-search" placeholder="Имя или электронная почта" disabled></div></section>`;
  }

  function rewards() {
    const {icon,link} = helpers;
    return `<div class="manage-heading"><div><span class="eyebrow">Участие и яблоки</span><h1>Замечаем вклад каждого.</h1><p>Выбери событие, отметь тех, кто участвовал, и подтверди начисление.</p></div>${link('#/manage/new?type=event','Создать мероприятие','button cyan','calendar')}</div><section class="panel rewards-panel"><div class="reward-step-row"><span><b>1</b> Выбрать мероприятие</span><span><b>2</b> Подтвердить участников</span><span><b>3</b> Начислить яблоки</span></div><div class="field"><label for="reward-event">Мероприятие</label><select id="reward-event" disabled><option>Список появится после подключения базы</option></select></div><div class="reward-empty">${icon('apple')}<h2>Здесь будет список участников</h2><p>Рядом с каждым — отметка участия, сумма награды и статус начисления. Уже оплаченные участия нельзя оплатить повторно.</p></div><div class="reward-total"><div><strong>К начислению: — яблок</strong><span>Сумма считается по выбранным подтверждённым участникам</span></div><button class="button" disabled>Начислить яблоки</button></div></section><section class="admin-rule-grid"><div class="panel"><h3>Без двойных начислений</h3><p>Повторное нажатие или обновление страницы не добавит яблоки второй раз. Это проверяет сервер.</p></div><div class="panel"><h3>История остаётся</h3><p>Даже когда афиша исчезнет из ленты, участие и начисление останутся в истории аккаунта.</p></div></section>`;
  }

  function cleanupPage() {
    return `<div class="manage-heading"><div><span class="eyebrow">Порядок на сайте</span><h1>Срок прошёл — лента обновилась.</h1><p>Срок показа задаётся при публикации. Старые записи не нужно убирать вручную.</p></div></div><section class="cleanup-flow"><article class="panel"><span class="flow-number">01</span><h2>Убрать из ленты</h2><p>В выбранную дату запись перестаёт показываться посетителям и участникам. Проверка срока выполняется при загрузке ленты.</p></article><article class="panel"><span class="flow-number">02</span><h2>Дать время вернуть</h2><p>Запись попадает в истёкшие. Владелец или совладелец сможет продлить срок до окончательной очистки.</p></article><article class="panel"><span class="flow-number">03</span><h2>Освободить место</h2><p>Сервер удаляет тяжёлые файлы, которые больше нигде не используются. Учёт участия и яблок сохраняется отдельно.</p></article></section><form class="panel cleanup-settings" id="cleanup-form"><div><h2>Когда очищать файлы</h2><p>Пауза после исчезновения из ленты позволяет восстановить случайно просроченную публикацию.</p></div><div class="field"><label for="cleanup-delay">Время на восстановление</label><select id="cleanup-delay"><option value="1">1 день после окончания показа</option><option value="7" selected>7 дней после окончания показа</option><option value="30">30 дней после окончания показа</option></select></div><p class="small-note">Для мероприятий очистка ждёт завершения проверки участия и начислений. Файлы, используемые в других действующих публикациях, сохраняются.</p><p class="form-status" id="cleanup-status" role="alert"></p><button class="button" type="submit">Сохранить настройку</button><p class="small-note">Это проект настройки. Фоновая очистка заработает на сервере после подключения базы.</p></form>`;
  }

  function render(route, shared) {
    helpers = shared; activeRoute = route;
    const view = {'/manage':publications,'/manage/new':editor,'/manage/team':team,'/manage/rewards':rewards,'/manage/cleanup':cleanupPage}[route];
    return nav(route) + (view ? view() : publications());
  }

  function expireDate(form) {
    const scheduled = form.elements.publishMode.value === 'scheduled';
    const published = scheduled ? parseDate(form.elements.publishAt.value) : new Date();
    if (!published || !Number.isFinite(published.getTime())) return null;
    return form.elements.lifetime.value === 'custom' ? parseDate(form.elements.expiresAt.value) : new Date(published.getTime()+Number(form.elements.lifetime.value)*86400000);
  }

  function syncPreview() {
    const form = document.querySelector('#publication-form');
    if (!form) return;
    const {esc,icon} = helpers;
    const value = name => form.elements[name].value.trim();
    document.querySelector('#title-counter').textContent = `${value('title').length} / 120`;
    document.querySelector('#body-counter').textContent = `${value('body').length} / 5000`;
    document.querySelector('#preview-title').textContent = value('title') || 'Здесь будет твой заголовок';
    document.querySelector('#preview-body').textContent = value('body') || 'А здесь — история, которой ты хочешь поделиться.';
    document.querySelector('#preview-type').textContent = editorType === 'event' ? 'Мероприятие' : 'Новость';
    document.querySelector('#preview-audience').textContent = value('audience') === 'team' ? 'Только отряду' : 'Всем посетителям';
    const scheduled = value('publishMode') === 'scheduled';
    document.querySelector('#scheduled-field').hidden = !scheduled;
    form.elements.publishAt.required = scheduled;
    const custom = value('lifetime') === 'custom';
    document.querySelector('#expiry-field').hidden = !custom;
    form.elements.expiresAt.required = custom;
    const published = scheduled ? parseDate(value('publishAt')) : null;
    document.querySelector('#preview-published').textContent = published && Number.isFinite(published.getTime()) ? dateText(published) : 'После публикации';
    const expiry = expireDate(form);
    document.querySelector('#lifetime-summary').textContent = expiry && Number.isFinite(expiry.getTime()) ? `Убрать из ленты: ${dateText(expiry)} · Новосибирск` : 'Выбери дату публикации и окончания показа.';
    document.querySelector('#preview-expiry').textContent = custom ? 'До выбранной даты' : `${value('lifetime')} дн. в ленте`;
    const event = document.querySelector('#preview-event');
    event.hidden = editorType !== 'event';
    const start = parseDate(value('startsAt'));
    event.innerHTML = `<span>${icon('calendar')} ${start && Number.isFinite(start.getTime()) ? esc(dateText(start)) : 'Дата и время встречи'}</span><span>${esc(value('place') || 'Место встречи')}</span><div>${icon('apple')} +${esc(value('reward') || '0')} яблок за участие</div><button class="button soft wide" type="button" disabled>Участвовать</button>`;
    document.querySelector('#preview-photos').innerHTML = attachments.map(a=>`<img src="${a.url}" alt="${esc(a.file.name)}">`).join('');
    document.querySelector('#attachment-list').innerHTML = attachments.map((a,i)=>`<div class="attachment"><img src="${a.url}" alt=""><button type="button" data-remove-photo="${i}" aria-label="Удалить фото ${esc(a.file.name)}">×</button></div>`).join('');
  }

  function setType(type) {
    editorType = type;
    const fieldset = document.querySelector('#event-fields');
    fieldset.hidden = type !== 'event'; fieldset.disabled = type !== 'event';
    document.querySelectorAll('[data-compose-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.composeType===type)));
    syncPreview();
  }

  function mount(route) {
    if (route !== '/manage/new') return;
    const form = document.querySelector('#publication-form');
    form.elements.publishAt.min = toInput(new Date());
    form.elements.expiresAt.min = toInput(new Date());
    setType(editorType);
  }

  function roleDialog(kind) {
    const dialog = document.querySelector('#preview-dialog');
    const coowner = kind === 'coowner';
    dialog.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Закрыть">${helpers.icon('close')}</button><div class="role-dialog"><span class="tag">Управление доступом</span><h2 id="dialog-title">${coowner?'Добавить совладельца':'Добавить администратора'}</h2><p>${coowner?'Выбери человека, которому доверяешь управление командой. Эту роль можешь выдать и снять только ты.':'Пользователь сможет создавать свои новости и мероприятия, подтверждать участие и начислять за него яблоки.'}</p><form id="role-form" class="form-fields"><div class="field"><label for="role-email">Почта зарегистрированного пользователя</label><input type="email" id="role-email" name="email" autocomplete="off" placeholder="name@example.com" maxlength="254" required></div><p class="small-note">На следующем этапе сервер найдёт аккаунт и покажет имя человека для подтверждения. Сейчас доступ никому не выдаётся.</p><p class="form-status" role="alert"></p><button class="button wide" type="submit">Найти пользователя</button></form></div>`;
    dialog.showModal();
  }

  document.addEventListener('input', event => {
    if (event.target.closest('#publication-form')) syncPreview();
  });
  document.addEventListener('change', async event => {
    if (event.target.id !== 'post-photos') return;
    const uploadGeneration = generation;
    const status = document.querySelector('#attachment-status');
    const messages=[];
    for (const file of event.target.files) {
      if (attachments.length >= maxFiles) {messages.push('Можно добавить не больше 6 фотографий.');break;}
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {messages.push(`${file.name}: выбери JPG, PNG или WebP.`);continue;}
      if (file.size > maxFileBytes) {messages.push(`${file.name}: файл больше 5 МБ.`);continue;}
      const url=URL.createObjectURL(file);
      const img=new Image();img.src=url;
      try {
        await img.decode();
        if (generation !== uploadGeneration) {URL.revokeObjectURL(url);return;}
        attachments.push({file,url});
      } catch {URL.revokeObjectURL(url);messages.push(`${file.name}: не удалось прочитать изображение.`);}
    }
    if (!document.contains(status)) return;
    status.textContent=messages.join(' ');
    event.target.value='';syncPreview();
  });
  document.addEventListener('click', event => {
    const b=event.target.closest('button');if(!b)return;
    if (b.dataset.composeType) setType(b.dataset.composeType);
    if (b.dataset.removePhoto !== undefined) {
      const index=Number(b.dataset.removePhoto);if(attachments[index])URL.revokeObjectURL(attachments[index].url);
      attachments.splice(index,1);syncPreview();
    }
    if (b.dataset.adminAction==='add-coowner') roleDialog('coowner');
    if (b.dataset.adminAction==='add-admin') roleDialog('admin');
    if (b.dataset.adminAction==='draft') document.querySelector('#publish-status').textContent='Сохранение черновика в базе ещё не подключено. Текст не сохранён; пока не закрывай эту форму.';
    if(b.dataset.postStatus){
      document.querySelectorAll('[data-post-status]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
      document.querySelector('#publication-list-title').textContent=b.dataset.postStatus;
      document.querySelector('#publication-list-description').textContent='Этот список загрузится после подключения базы данных.';
    }
  });
  document.addEventListener('submit', event => {
    const form=event.target;
    if (!['publication-form','role-form','cleanup-form'].includes(form.id))return;
    event.preventDefault();
    const status=form.querySelector('.form-status');
    if(form.id==='publication-form'){
      const expiry=expireDate(form);
      const published=form.elements.publishMode.value==='scheduled'?parseDate(form.elements.publishAt.value):new Date();
      const errors=[];
      if(!form.elements.title.value.trim() || !form.elements.body.value.trim())errors.push('Заполни заголовок и текст.');
      if(form.elements.publishMode.value==='scheduled' && (!published || published<=new Date()))errors.push('Время публикации должно быть в будущем.');
      if(!expiry || !Number.isFinite(expiry.getTime()) || !published || expiry<=published)errors.push('Окончание показа должно быть позже публикации.');
      if(editorType==='event'){
        const start=parseDate(form.elements.startsAt.value),end=parseDate(form.elements.endsAt.value);
        if(!start || !end || end<=start)errors.push('Окончание мероприятия должно быть позже начала.');
        if(start && published && start<published)errors.push('Мероприятие должно начинаться после публикации.');
        if(end && expiry && expiry<end)errors.push('Показывай мероприятие как минимум до его окончания.');
      }
      document.querySelector('#publish-status').textContent=errors.length?errors.join(' '):unavailable;
    } else if(form.id==='role-form')status.textContent='Поиск аккаунтов и выдача ролей будут доступны после подключения сервера. Права не изменены.';
    else document.querySelector('#cleanup-status').textContent='Настройка пока не сохранена. Фоновая очистка будет подключена на сервере вместе с базой.';
  });
  function cleanup(){generation++;attachments.forEach(a=>URL.revokeObjectURL(a.url));attachments=[];}
  return Object.freeze({render,mount,cleanup});
})();
