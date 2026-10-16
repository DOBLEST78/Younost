/* Личные данные приходят только с сервера; изменение HTML или localStorage не даёт прав. */
window.YunostAccount = (() => {
  'use strict';
  const api = window.YunostApi;
  let user = null, ready = false, enabled = false, connectionError = '';
  let helpers, generation = 0, applicationStatus = 'pending', nextCursor = null, memberCursor = null;
  const roleNames = {owner:'Владелец',coowner:'Совладелец',admin:'Администратор',member:'Участник'};
  const statusNames = {pending:'На рассмотрении',accepted:'Ты в отряде',ignored:'Заявка не принята'};
  const changed = () => document.dispatchEvent(new Event('yunost:account-changed'));
  const setUser = value => { user = value; ready = true; changed(); };
  const path = () => location.hash.slice(1).split('?')[0];
  const date = value => value ? new Intl.DateTimeFormat('ru-RU',{timeZone:value.length===10?'UTC':'Asia/Novosibirsk',day:'numeric',month:'long',year:'numeric'}).format(new Date(value.length === 10 ? value+'T00:00:00Z' : value)) : '—';
  const notice = () => user.membershipStatus === 'pending'
    ? '<strong>Анкета у команды.</strong> Администратор рассмотрит её. Статус появится здесь; магазин уже можно посмотреть.'
    : user.membershipStatus === 'ignored'
    ? '<strong>Заявка не принята.</strong> Если хочешь уточнить решение, напиши команде в Telegram.'
    : '<strong>Добро пожаловать в отряд!</strong> Твой профиль, яблоки и гардероб всегда под рукой.';

  async function bootstrap() {
    if (location.protocol === 'file:') { ready = true; changed(); return; }
    try {
      const hash=new URLSearchParams(location.hash.slice(1));
      if(hash.has('access_token')){
        const accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token');
        history.replaceState(null,'',location.pathname+location.search+'#/pending');
        const result=await api.send('auth/confirm',{accessToken,refreshToken});user=result.user;enabled=true;
      } else {const result=await api.me();user=result.user;enabled=result.accountsEnabled;}
    }
    catch (error) { connectionError = error.message; }
    ready = true; changed();
  }
  async function refresh() { const result = await api.me(); user = result.user; enabled = result.accountsEnabled; changed(); return user; }
  async function authenticate(data, create = false) {
    const result = await (create ? api.apply(data) : api.login(data));
    enabled = true; connectionError = '';
    if(result.confirmationRequired)return result;
    setUser(result.user);
    location.hash = result.user.membershipStatus === 'accepted'
  ? '/profile'
  : '/pending';
  }
  function guard(admin = false) {
    const {intro,link,icon,esc} = helpers;
    if (!ready) return `${intro('Личный кабинет','Открываем твой профиль…')}<section class="panel empty-state" role="status"><p>Проверяем вход.</p></section>`;
    if (!user) return `${intro('Личный кабинет','Рады видеть тебя.')}<section class="panel empty-state"><div class="empty-symbol">${icon('user')}</div><h2>Войди в свою «Юность».</h2><p>${esc(connectionError || 'После входа здесь появятся твоя анкета, баланс яблок и одежда Фыр-Фырыча.')}</p><div class="empty-actions">${link('#/login','Войти','button')}${link('#/join','Создать аккаунт','button soft')}</div></section>`;
    // Кандидат может открыть только страницу статуса своей заявки.
if (user.membershipStatus !== 'accepted' && path() !== '/pending') {
  return `
    ${intro('Заявка в отряд', 'Твоя история только начинается.')}

    <section class="panel empty-state">
      <div class="empty-symbol">${icon('clock')}</div>

      <h2>
        ${user.membershipStatus === 'ignored'
          ? 'К сожалению, заявка отклонена'
          : 'Твоя заявка на рассмотрении'}
      </h2>

      <p>
        ${user.membershipStatus === 'ignored'
          ? 'Команда рассмотрела твою анкету и приняла решение. Доступ к личному кабинету пока закрыт.'
          : 'Дождись решения администрации. После принятия в отряд тебе откроются личный кабинет, достижения, магазин и Фыр-Фырыч.'}
      </p>

      ${link('#/pending', 'Посмотреть статус заявки', 'button')}
      ${link('#/', 'Вернуться на главную', 'button soft')}
    </section>
  `;
}
    if (admin && !user.canManage) return `${intro('Личный кабинет','Этот раздел — для команды сайта.')}<section class="panel empty-state"><div class="empty-symbol">${icon('lock')}</div><h2>У тебя нет доступа к управлению.</h2><p>Право администратора назначает владелец или совладелец отряда.</p>${link('#/profile','В мой кабинет','button')}</section>`;
    return null;
  }
  function profile() {
    const {esc,intro,link,pet,icon} = helpers;
    return `${intro('Личный кабинет','Твоя «Юность».','Место, где живут твои маленькие и большие победы.')}<div class="profile-layout"><aside class="panel profile-pet"><span class="tag">${esc(user.membershipStatus==='accepted'?roleNames[user.role]: 'Кандидат в отряд')}</span>${pet(user.equippedItems)}<h2>Твой Фыр-Фырыч</h2><p>У каждой истории свой стиль.</p>${link('#/wardrobe','Открыть гардероб','button wide')}${link('#/shop','Заглянуть в магазин','button soft wide')}</aside><div class="profile-main"><section class="panel"><div class="profile-title"><div><span class="eyebrow dark-eyebrow">С возвращением</span><h2>${esc(user.fullName)}</h2></div><button class="button outline compact" data-account-action="logout">Выйти</button></div><div class="membership-notice status-${esc(user.membershipStatus)}"><span class="status-dot"></span><div><span class="tag">${esc(statusNames[user.membershipStatus])}</span><p>${notice()}</p></div></div><div class="profile-stats"><div><span>${icon('apple')} Твой баланс</span><strong>${user.apples.toLocaleString('ru-RU')} <small>яблок</small></strong></div><div><span>${icon('star')} Заработано за всё время</span><strong>${user.earnedApples.toLocaleString('ru-RU')} <small>яблок</small></strong></div></div><dl class="profile-details"><div><dt>Электронная почта</dt><dd>${esc(user.email)}</dd></div><div><dt>Телефон</dt><dd>${esc(user.phone)}</dd></div><div><dt>Дата рождения</dt><dd>${esc(date(user.birthDate))}</dd></div><div><dt>О себе</dt><dd>${esc(user.about)}</dd></div></dl>${link('#/settings','Изменить анкету','button soft')}</section>${user.canManage?`<section class="panel profile-manage"><div><span class="tag">${esc(roleNames[user.role])}</span><h2>Позаботимся о команде?</h2><p>Рассматривай заявки новых участников и управляй сайтом.</p></div>${link('#/manage/applications','Управление сайтом','button','arrow')}</section>`:''}<div class="profile-quick-links">${link('#/shop',icon('bag')+' Магазин','panel')}${link('#/transactions',icon('apple')+' История яблок','panel')}${link('#/my-events',icon('calendar')+' Мои мероприятия','panel')}${link(window.YunostCatalog.telegram,'Связаться с командой ↗','panel')}</div></div></div>`;
  }
  function settings() {
    const {intro,esc,link} = helpers;
    return `${intro('Личный кабинет','Всё важное о тебе.')}<section class="panel settings-panel"><form id="profile-form" class="form-fields"><div class="field"><label for="profile-name">Фамилия, имя и отчество</label><input id="profile-name" name="fullName" value="${esc(user.fullName)}" required minlength="5" maxlength="140" autocomplete="name"></div><div class="field"><label for="profile-phone">Телефон</label><input id="profile-phone" name="phone" type="tel" value="${esc(user.phone)}" required maxlength="30" autocomplete="tel"></div><div class="field"><label for="profile-about">О себе</label><textarea id="profile-about" name="about" maxlength="2000" required>${esc(user.about)}</textarea></div><div class="field"><label for="profile-experience">Опыт работы с детьми</label><textarea id="profile-experience" name="experience" maxlength="2000">${esc(user.experience)}</textarea></div><p class="small-note">Пока заявка на рассмотрении, команда увидит обновлённую анкету.</p><p class="form-status" role="alert"></p><div class="form-actions"><button class="button" type="submit">Сохранить изменения</button>${link('#/profile','Назад в кабинет','button outline')}</div></form></section>`;
  }
  function wardrobe() {
    const {intro,esc,link,pet} = helpers;
    const products = [...(user.inventory||[])];
    for(const id of user.ownedItems)if(!products.some(p=>p.id===id)){const p=window.YunostCatalog.products.find(p=>p.id===id);if(p)products.push(p);}
    return `${intro('Гардероб Фыр-Фырыча','У каждого ёжика свой характер.','Купленные вещи остаются с тобой. Выбери, что надеть сегодня.')}<div class="shop-layout"><aside class="pet-aside"><h2>Твой Фыр-Фырыч</h2>${pet(user.equippedItems)}<p>Так ёжик выглядит в твоём профиле.</p>${link('#/shop','Найти новый наряд','button wide')}</aside><section>${products.length?`<div class="products-grid">${products.map(p=>`<article class="product-card"><div class="product-picture"><img src="${esc(p.imageUrl || `assets/images/product-${p.id}.webp`)}" alt="${esc(p.title)}"></div><h2>${esc(p.title)}</h2><p>${esc(p.tag)}</p><span class="tag">${user.equippedItems.includes(p.id)?'Надето':window.YunostCatalog.products.some(i=>i.id===p.id)?'В твоём гардеробе':'Эксклюзив · больше не продаётся'}</span><button class="button soft wide" data-equip="${p.id}" data-equipped="${!user.equippedItems.includes(p.id)}">${user.equippedItems.includes(p.id)?'Снять':'Надеть'}</button></article>`).join('')}</div>`:`<div class="panel empty-state"><h2>Первый наряд ещё впереди.</h2><p>Загляни в магазин, примерь одежду и выбери, на что копить яблоки.</p>${link('#/shop','Открыть магазин','button')}</div>`}<p class="light-note">Сочетай головной убор, очки и одежду. Вещи одного типа заменяют друг друга; шарф и галстук носятся без худи. Вещи, снятые с продажи, остаются в твоём гардеробе.</p></section></div>`;
  }
  function adminNav(route) {
    const {esc} = helpers;
    const links=[['/manage/applications','Заявки в отряд'],['/manage','Публикации'],['/manage/rewards','Участие и яблоки'],['/manage/products','Магазин']];
    if(['owner','coowner'].includes(user.role)) links.push(['/manage/members','Участники'],['/manage/team','Команда и права']);
    links.push(['/manage/cleanup','Очистка']);
    return `<nav class="manage-nav" aria-label="Управление сайтом">${links.map(([p,t])=>`<a href="#${p}" class="${p===route?'active':''}" ${p===route?'aria-current="page"':''}>${esc(t)}</a>`).join('')}<a href="#/profile" class="manage-back">Мой кабинет ↗</a></nav>`;
  }
  function applications() {
    const {intro} = helpers;
    return `${intro('Заявки в отряд','Знакомимся с будущей командой.','Анкеты видны только администраторам. Прими участника или перенеси заявку в игнорируемые.')}<section class="panel applications-panel"><div class="application-toolbar"><div class="filters" role="group" aria-label="Статус заявок">${[['pending','На рассмотрении'],['accepted','Принятые'],['ignored','Игнорируемые']].map(([s,t])=>`<button class="filter" data-application-status="${s}" aria-pressed="${s===applicationStatus}">${t}</button>`).join('')}</div><button class="button outline compact" data-account-action="refresh-applications">Обновить</button></div><p id="applications-status" class="form-status" role="status"></p><div id="applications-list" aria-live="polite"><p>Загружаем анкеты…</p></div><button id="applications-more" class="button soft" data-account-action="more-applications" hidden>Показать ещё</button></section>`;
  }
  function applicationCard(a) {
    const {esc} = helpers;
    return `<article class="application-card" data-application-id="${esc(a.id)}"><div class="application-heading"><div><span class="tag">${esc(statusNames[a.status])}</span><h2>${esc(a.fullName)}</h2><p>Анкета от ${esc(date(a.createdAt))}</p></div></div><dl class="application-details"><div><dt>Дата рождения</dt><dd>${esc(date(a.birthDate))}</dd></div><div><dt>Телефон</dt><dd>${esc(a.phone)}</dd></div><div><dt>Электронная почта</dt><dd>${esc(a.email)}</dd></div><div><dt>О себе</dt><dd>${esc(a.about)}</dd></div><div><dt>Опыт работы с детьми</dt><dd>${esc(a.experience || 'Не указан')}</dd></div></dl>${a.status==='pending'?`<div class="form-actions"><button class="button" data-review="${esc(a.id)}" data-decision="accepted">Принять</button><button class="button outline" data-review="${esc(a.id)}" data-decision="ignored">Игнорировать</button></div><p class="small-note">«Игнорировать» уберёт заявку из новых, сохранив анкету и решение.</p>`:`<p class="small-note">Рассмотрена ${esc(date(a.reviewedAt))}</p>`}<p class="form-status" role="alert"></p></article>`;
  }
  async function loadApplications(append = false) {
    const token = ++generation;
    const list = document.querySelector('#applications-list'), status = document.querySelector('#applications-status');
    if (!list) return;
    status.textContent = 'Загружаем анкеты…';
    try {
      const result = await api.applications(applicationStatus, append ? nextCursor : '');
      if (token !== generation || !document.contains(list)) return;
      nextCursor = result.nextCursor;
      const html = result.items.map(applicationCard).join('');
      if (append) list.insertAdjacentHTML('beforeend',html);
      else list.innerHTML = html || `<div class="empty-state"><h2>${applicationStatus==='pending'?'Все заявки разобраны.':'Пока нет анкет в этом разделе.'}</h2><p>Новые анкеты появятся здесь после регистрации на сайте.</p></div>`;
      document.querySelector('#applications-more').hidden = !nextCursor;
      status.textContent = '';
    } catch (error) { if(token===generation && document.contains(status)) { status.textContent=error.message; if(!append) list.replaceChildren(); } }
  }
  function team() {
    const {intro} = helpers;
    if (!['owner','coowner'].includes(user.role)) return '<section class="panel empty-state"><h1>Назначение ролей недоступно.</h1><p>Администраторов назначает владелец или совладелец.</p></section>';
    return `${intro('Команда и права','Нужный доступ — нужным людям.','Найди принятого участника по точной почте и выбери его роль.')}<section class="panel settings-panel"><form id="team-search-form" class="form-fields"><div class="field"><label for="member-email">Электронная почта участника</label><input type="email" id="member-email" name="email" required maxlength="254" placeholder="name@example.com"></div><button type="submit" class="button">Найти участника</button><p class="form-status" role="alert"></p></form><div id="team-result"></div><p class="small-note section-space">${user.role==='owner'?'Ты можешь назначать совладельцев и администраторов. Роль владельца защищена.':'Ты можешь назначать и снимать администраторов. Менять владельца и совладельцев нельзя.'}</p></section>`;
  }
  function members() {
    if(!['owner','coowner'].includes(user.role))return '<section class="panel empty-state"><h1>Нет доступа к списку аккаунтов.</h1></section>';
    const {intro}=helpers;
    return `${intro('Участники и кандидаты','Люди нашей «Юности».','Управление аккаунтами доступно владельцу и совладельцу.')}<section class="panel"><p class="small-note">«Удалить аккаунт» полностью удаляет вход, анкету, профиль, покупки и яблоки. Для возвращения человек регистрируется заново.</p><p id="members-status" class="form-status" role="status"></p><div id="members-list"><p>Загружаем участников…</p></div><button id="members-more" class="button soft" data-account-action="more-members" hidden>Показать ещё</button></section>`;
  }
  async function loadMembers(append=false) {
    const token=++generation, list=document.querySelector('#members-list'), status=document.querySelector('#members-status');
    if(!list)return;
    try {
      const result=await api.members(append?memberCursor:'');
      if(token!==generation || !document.contains(list))return;
      memberCursor=result.nextCursor;
      const {esc}=helpers;
      const html=result.items.map(m=>`<article class="member-row"><div><h2>${esc(m.fullName)}</h2><p>${esc(m.email)}</p><span class="tag">${esc(roleNames[m.role])} · ${esc(m.membershipStatus==='deleting'?'Удаляется':statusNames[m.membershipStatus])}</span></div>${m.canDelete?`<button class="button outline compact" data-delete-member="${esc(m.id)}" data-member-name="${esc(m.fullName)}">${m.membershipStatus==='deleting'?'Продолжить удаление':'Удалить аккаунт'}</button>`:'<span class="small-note">Защищённый аккаунт</span>'}</article>`).join('');
      if(append)list.insertAdjacentHTML('beforeend',html);else list.innerHTML=html||'<p>Нет аккаунтов.</p>';
      document.querySelector('#members-more').hidden=!memberCursor;
      status.textContent='';
    }catch(error){if(token===generation && document.contains(status)){status.textContent=error.message;list.replaceChildren();}}
  }
  function confirmDelete(uid,name) {
    const {esc}=helpers, dialog=document.querySelector('#preview-dialog');
    dialog.innerHTML=`<section class="delete-dialog"><span class="tag">Полное удаление</span><h2 id="dialog-title">Удалить аккаунт?</h2><p><strong>${esc(name)}</strong> больше не сможет войти со старым аккаунтом. Анкета, профиль, гардероб и яблоки будут удалены без восстановления. Для возвращения потребуется новая регистрация.</p><form id="delete-account-form" data-uid="${esc(uid)}"><label class="checkbox-label"><input type="checkbox" name="confirm" required>Я понимаю, что аккаунт и его данные будут удалены</label><p class="form-status" role="alert"></p><div class="form-actions"><button class="button outline" type="button" data-action="close-dialog">Отмена</button><button class="button danger" type="submit">Удалить навсегда</button></div></form></section>`;
    window.YunostForms.mount(dialog);dialog.showModal();
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.deleteMember)confirmDelete(b.dataset.deleteMember,b.dataset.memberName);
    if(b.dataset.accountAction==='more-members')loadMembers(true);
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(form.id!=='delete-account-form')return;
    event.preventDefault();
    const button=form.querySelector('[type="submit"]'),status=form.querySelector('.form-status');
    button.disabled=true;
    try {
      const result=await api.deleteMember(form.dataset.uid);
      document.querySelector('#preview-dialog').close();
      helpers.toast(result.pending?'Доступ закрыт. Сервер продолжает удаление и повторит его при сбое связи.':'Аккаунт и его данные полностью удалены.');
      if(path()==='/manage/members')await loadMembers();
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  });

  function render(route, shared) {
    helpers = shared;
    const locked = guard(route.startsWith('/manage'));
    if (locked) return locked;
    if(route==='/manage/applications') return adminNav(route)+applications();
    if(route==='/manage/team') return adminNav(route)+team();
    if(route==='/manage/members') return adminNav(route)+members();
    if(route==='/settings') return settings();
    if(route==='/wardrobe') return wardrobe();
    return profile();
  }
  function mount(route) { generation++; if(route==='/manage/applications' && user?.canManage) loadApplications(); if(route==='/manage/members' && user?.canManage) loadMembers(); }
  async function purchase(id) { const result = await api.purchase(id); setUser(result.user); }

  document.addEventListener('yunost:session-expired', () => { user=null; changed(); });
  document.addEventListener('click', async event => {
    const b=event.target.closest('button'); if(!b)return;
    // Обновление статуса заявки без повторного входа
if (b.dataset.accountAction === 'check-application-status') {
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = 'Проверяем заявку…';

    try {
        const updatedUser = await refresh();

        if (updatedUser?.membershipStatus === 'accepted') {
            location.hash = '/pending';
        } else if (updatedUser?.membershipStatus === 'ignored') {
            location.hash = '/pending';
        } else {
            b.textContent = 'Решение пока не принято';
        }
    } catch (error) {
        b.textContent = 'Ошибка проверки';
        console.error('Ошибка обновления заявки:', error);
    } finally {
        b.disabled = false;

        if (document.contains(b) && b.textContent === 'Проверяем заявку…') {
            b.textContent = originalText;
        }
    }

    return;
}
    if(b.dataset.applicationStatus) { applicationStatus=b.dataset.applicationStatus; document.querySelectorAll('[data-application-status]').forEach(el=>el.setAttribute('aria-pressed',String(el===b))); loadApplications(); return; }
    const action=b.dataset.accountAction;
    if(action==='refresh-applications') { loadApplications(); return; }
    if(action==='more-applications') { loadApplications(true); return; }
    if(!['logout'].includes(action) && !b.dataset.review && !b.dataset.equip) return;
    b.disabled=true;
    try {
      if(action==='logout') { await api.logout(); user=null; changed(); location.hash='/login'; return; }
      if(b.dataset.review) {
        const card=b.closest('.application-card'); card.querySelectorAll('button').forEach(button=>button.disabled=true);
        await api.review(b.dataset.review,b.dataset.decision);
        helpers.toast(b.dataset.decision==='accepted'?'Участник принят в отряд.':'Заявка перенесена в игнорируемые.');
        await loadApplications();
      }
      if(b.dataset.equip) { const result=await api.equip(b.dataset.equip,b.dataset.equipped==='true'); setUser(result.user); helpers.toast('Гардероб сохранён.'); }
    } catch(error) {
      const status=b.closest('.application-card')?.querySelector('.form-status');
      if(status) {status.textContent=error.message; b.closest('.application-card').querySelectorAll('button').forEach(button=>button.disabled=false);}
      else helpers.toast(error.message);
    } finally {b.disabled=false;}
  });
  document.addEventListener('submit', async event => {
    const form=event.target;
    if(!['profile-form','team-search-form','change-role-form'].includes(form.id))return;
    event.preventDefault();
    const status=form.querySelector('.form-status'), button=form.querySelector('[type="submit"]');
    button.disabled=true; status.textContent='';
    try {
      const data=Object.fromEntries(new FormData(form));
      if(form.id==='profile-form') { const result=await api.updateProfile(data); setUser(result.user); location.hash='/profile'; helpers.toast('Анкета сохранена.'); }
      if(form.id==='team-search-form') {
        const result=await api.findMember(data.email);
        if(!document.contains(form))return;
        const target=document.querySelector('#team-result'), {esc}=helpers, member=result.items[0];
        if(!member) {target.innerHTML='<p class="section-space">Участник с такой почтой не найден.</p>';return;}
        const editable=member.id!==user.id && member.role!=='owner' && (user.role==='owner'||member.role!=='coowner') && member.membershipStatus==='accepted';
        target.innerHTML=`<div class="team-found"><h2>${esc(member.fullName)}</h2><p>${esc(member.email)}</p><span class="tag">${esc(roleNames[member.role])} · ${esc(statusNames[member.membershipStatus])}</span>${editable?`<form id="change-role-form" class="form-fields section-space" data-uid="${esc(member.id)}"><div class="field"><label for="member-role">Роль</label><select id="member-role" name="role">${[['member','Участник'],['admin','Администратор'],...(user.role==='owner'?[['coowner','Совладелец']]:[])].map(([r,t])=>`<option value="${r}" ${member.role===r?'selected':''}>${t}</option>`).join('')}</select></div><p class="form-status" role="alert"></p><button class="button" type="submit">Сохранить роль</button></form>`:'<p class="small-note section-space">Роль этого аккаунта сейчас нельзя изменить.</p>'}</div>`;
        window.YunostForms.mount(target);
      }
      if(form.id==='change-role-form') {await api.changeRole(form.dataset.uid,data.role);status.textContent='Роль сохранена.';helpers.toast('Права участника обновлены.');}
    }catch(error){if(document.contains(status)) status.textContent=error.message;}
    finally{button.disabled=false;}
  });
  return Object.freeze({get user(){return user;},get ready(){return ready;},get enabled(){return enabled;},bootstrap,refresh,authenticate,render,mount,access:(admin,shared)=>{helpers=shared;return guard(admin);},adminNav,purchase});
})();
