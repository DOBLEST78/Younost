window.YunostCommunity=(()=>{
  'use strict';
  const api=window.YunostApi,account=window.YunostAccount;
  let h,route='',generation=0,cursor=null,items=[],post=null;
  const states={registered:'Ты в списке',present:'Участие подтверждено',absent:'Участие не подтверждено',cancelled:'Запись отменена'};
  const stamp=v=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Novosibirsk',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
  const titles={'/feed':['Новостник','Всё, чем живёт «Юность».','Новости и ближайшие встречи нашей команды.'], '/my-events':['Мои мероприятия','Там, где мы вместе.','Твои записи, участие и история встреч.'], '/transactions':['Твои яблоки','Всё сходится.','Покупки, оплата мероприятий, возвраты и награды.'], '/achievements':['Достижения','Маленькие шаги. Большие победы.','Награды открываются после подтверждения участия.'], '/leaderboard':['Активность отряда','Каждый вклад имеет значение.','Рейтинг по заработанным яблокам. Покупки не уменьшают твой результат.']};
  function render(path,shared){
    h=shared;route=path;items=[];cursor=null;post=null;generation++;
    const publicPost=path.startsWith('/post/');
    if(!publicPost){const blocked=account.access(false,h);if(blocked)return blocked;if(account.user.membershipStatus!=='accepted')return h.intro('Личный кабинет','Сначала — знакомство.')+`<section class="panel empty-state"><h2>Дождись решения по анкете.</h2><p>Лента команды и мероприятия доступны участникам отряда.</p>${h.link('#/profile','Посмотреть статус','button')}</section>`;}
    const t=titles[path];return (t?h.intro(...t):'<a class="back-link" href="#/feed">← К новостям</a>')+'<div id="community-content"><section class="panel"><p role="status">Загружаем…</p></section></div>';
  }
  function card(p){
    const e=p.eventInfo;
    return `<article class="panel feed-card"><div class="post-meta"><span class="tag">${p.type==='event'?'Мероприятие':'Новость'} · ${p.audience==='team'?'Отряду':'Для всех'}</span><time>${stamp(p.publishAt)}</time></div><h2>${h.esc(p.title)}</h2><p class="post-text">${h.esc(p.body.length>420?p.body.slice(0,420)+'…':p.body)}</p>${p.photos.length?`<div class="post-gallery"><img src="${h.esc(p.photos[0])}" alt="${h.esc(p.title)}" loading="lazy">${p.photos.length>1?`<span class="gallery-count">Ещё фото: ${p.photos.length-1}</span>`:''}</div>`:''}${e?`<div class="event-summary"><span>${h.icon('calendar')} ${stamp(e.startsAt)}</span><span>${h.icon('apple')} ${e.cost===0?'Бесплатная запись':e.cost+' яблок за запись'}</span><span>+${e.reward} яблок за участие</span></div>`:''}${h.link('#/post/'+p.id,p.type==='event'?'Подробнее и записаться':'Читать историю','button soft','arrow')}</article>`;
  }
  async function mount(path,shared){
    if(shared)h=shared;route=path;
    if(path==='/blog'){items=[];cursor=null;generation++;}
    if(!document.querySelector('#community-content'))return;
    if(path!=='/blog'&&!path.startsWith('/post/')&&account.user?.membershipStatus!=='accepted')return;
    await load(false);
  }
  async function load(append=false){
    const token=++generation,node=document.querySelector('#community-content');if(!node)return;
    try{
      if(route.startsWith('/post/')){
        post=await api.request('posts/'+route.split('/').pop());let state='none';
        if(post.eventInfo&&account.user?.membershipStatus==='accepted')state=(await api.request('events/'+post.id+'/registration')).status;
        if(token!==generation||!document.contains(node))return;
        const p=post,e=p.eventInfo,closed=e&&(e.cancelled||new Date(e.startsAt)<=new Date()||e.registered>=e.capacity);
        node.innerHTML=`<article class="panel post-full"><div class="post-meta"><span class="tag">${p.type==='event'?'Мероприятие':'Новость'}</span><time>${stamp(p.publishAt)}</time></div><h1>${h.esc(p.title)}</h1><p class="post-text">${h.esc(p.body)}</p><div class="post-gallery">${p.photos.map(url=>`<img src="${h.esc(url)}" alt="Фотография к публикации" loading="lazy">`).join('')}</div>${e?`<section class="event-booking"><h2>Встречаемся в «Юности»</h2><dl class="profile-details"><div><dt>Когда · Новосибирск</dt><dd>${stamp(e.startsAt)} — ${stamp(e.endsAt)}</dd></div><div><dt>Где</dt><dd>${h.esc(e.place)}</dd></div><div><dt>Места</dt><dd>${e.registered} из ${e.capacity} занято</dd></div><div><dt>Яблоки</dt><dd>${e.cost} за запись · +${e.reward} за подтверждённое участие</dd></div></dl>${account.user?.membershipStatus!=='accepted'?`<p>Записаться могут участники отряда после входа.</p>${h.link(account.user?'#/profile':'#/login','В личный кабинет','button')}`:state==='registered'?`<span class="tag">Ты в списке участников</span>${new Date(e.startsAt)>new Date()?`<button class="button outline" data-cancel-event="${e.id}">Отменить запись · вернуть ${e.cost} яблок</button>`:''}`:state==='present'||state==='absent'?`<p>${states[state]}</p>`:closed?'<p>Запись закрыта.</p>':`<p>Твой баланс: ${account.user.apples} яблок.</p><button class="button" data-book-event="${e.id}">${e.cost?'Записаться за '+e.cost+' яблок':'Записаться бесплатно'}</button>`}<p class="form-status" role="alert"></p><p class="small-note">Отменить запись и вернуть яблоки можно до начала встречи. Награда за участие начисляется после отметки администратора.</p></section>`:''}</article>`;return;
      }
      const endpoint=route==='/feed'||route==='/blog'?'posts':route==='/my-events'?'me/events':route==='/transactions'?'me/transactions':route==='/achievements'?'me/achievements':'leaderboard';
      const data=await api.request(endpoint+'?cursor='+encodeURIComponent(append?cursor||'':''));
      if(token!==generation||!document.contains(node))return;
      items=append?[...items,...data.items]:data.items;cursor=data.nextCursor;
      let html='';
      if(route==='/feed'||route==='/blog')html=`<div class="feed-grid">${items.filter(p=>route!=='/blog'||p.audience==='public').map(card).join('')}</div>`;
      if(route==='/my-events')html=items.map(e=>`<article class="panel content-row"><div><span class="tag">${states[e.status]}</span><h2>${h.esc(e.title)}</h2><p>${stamp(e.startsAt)} · ${h.esc(e.place)}</p><p>${e.paid} яблок за запись · ${e.status==='present'?'Получено':'Награда'}: ${e.reward} яблок</p></div>${e.status==='registered'&&new Date(e.startsAt)>new Date()?`<button class="button outline compact" data-cancel-event="${e.id}">Отменить запись</button>`:''}</article>`).join('');
      if(route==='/transactions'){
        const kinds={purchase:'Покупка',event_payment:'Запись на мероприятие',event_refund:'Возврат за отмену',event_reward:'Награда за участие'};
        html=`<section class="panel wallet-panel"><span class="tag">Твой баланс</span><h2>${account.user.apples.toLocaleString('ru-RU')} яблок</h2><p>Заработано за всё время: ${account.user.earnedApples.toLocaleString('ru-RU')}</p>${items.map(t=>`<div class="ledger-row"><div><strong>${h.esc(t.title)}</strong><p>${kinds[t.kind]||'Операция'} · ${stamp(t.at)}</p></div><strong class="${t.amount>0?'amount-plus':''}">${t.amount>0?'+':''}${t.amount}</strong></div>`).join('')}</section>`;
      }
      if(route==='/achievements')html=`<div class="achievement-grid">${items.map(a=>`<article class="panel achievement-card ${a.current>=a.target?'unlocked':''}"><span class="achievement-symbol">${h.icon(a.current>=a.target?'star':'lock')}</span><span class="tag">${a.current>=a.target?'Открыто':'Впереди'}</span><h2>${h.esc(a.title)}</h2><p>${h.esc(a.description)}</p><progress value="${Math.min(a.current,a.target)}" max="${a.target}"></progress><p class="small-note">${Math.min(a.current,a.target)} из ${a.target}</p></article>`).join('')}</div><div class="section-space">${h.link('#/leaderboard','Рейтинг отряда','button white','arrow')}</div>`;
      if(route==='/leaderboard')html=`<section class="panel">${items.map(u=>`<div class="ranking-row ${u.isMe?'is-me':''}"><strong class="rank-place">${u.place}</strong><div><h3>${h.esc(u.fullName)}${u.isMe?' · это ты':''}</h3><p>Подтверждено мероприятий: ${u.attendedEvents}</p></div><strong>${u.earnedApples} ${h.icon('apple')}</strong></div>`).join('')}</section>`;
      if(!items.length&&route!=='/achievements')html=`<section class="panel empty-state"><h2>${route==='/blog'?'Новые истории скоро появятся здесь.':'Здесь начинается твоя история.'}</h2><p>${route==='/my-events'?'Выбери мероприятие в новостнике и запишись.':route==='/transactions'?'Операции появятся после первой записи, покупки или награды.':'Команда пока не добавила записи.'}</p>${route!=='/blog'?h.link('#/feed','В новостник','button soft'):''}</section>`;
      node.innerHTML=html+`<p class="form-status" role="alert"></p>${cursor?'<button class="button white" data-community-action="more">Показать ещё</button>':''}`;
    }catch(error){if(token===generation&&document.contains(node))node.innerHTML=`<section class="panel"><p class="form-status" role="alert">${h.esc(error.message)}</p><button class="button soft" data-community-action="retry">Попробовать снова</button></section>`;}
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.communityAction){b.disabled=true;await load(b.dataset.communityAction==='more');b.disabled=false;return;}
    if(!b.dataset.bookEvent&&!b.dataset.cancelEvent)return;
    if(b.dataset.cancelEvent&&!confirm('Отменить запись и вернуть потраченные яблоки?'))return;
    b.disabled=true;
    try{await api.send('events/'+(b.dataset.bookEvent||b.dataset.cancelEvent)+'/registration',{},b.dataset.bookEvent?'POST':'DELETE');h.toast(b.dataset.bookEvent?'Ты в списке! Запись сохранена.':'Запись отменена. Яблоки возвращены.');await account.refresh();}
    catch(e){h.toast(e.message);}finally{b.disabled=false;}
  });
  return {render,mount,cleanup:()=>generation++};
})();
