/* Управление контентом: все изменения проходят проверку прав на сервере. */
window.YunostAdmin = (() => {
  'use strict';
  const api=window.YunostApi;
  let h, route='', generation=0, items=[], cursor=null, editing=null, attachments=[];
  const statuses={draft:'Черновик',published:'В ленте',deleting:'Удаляется'};
  const registrationStatuses={registered:'Ждёт подтверждения',present:'Участвовал',absent:'Не пришёл',cancelled:'Запись отменена'};
  const stamp=v=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Novosibirsk',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
  const toInput=v=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Novosibirsk',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T');
  const fromInput=v=>{const d=new Date(v+':00+07:00');if(!Number.isFinite(+d))throw Error('Проверьте дату и время.');return d.toISOString();};
  const field=(name,label,value='',type='text',extra='')=>`<div class="field"><label for="edit-${name}">${label}</label><input id="edit-${name}" name="${name}" type="${type}" value="${h.esc(value)}" ${extra}></div>`;
  const select=(name,label,options)=>`<div class="field"><label for="edit-${name}">${label}</label><select id="edit-${name}" name="${name}">${options.map(([v,t])=>`<option value="${h.esc(v)}">${h.esc(t)}</option>`).join('')}</select></div>`;
  const busy=()=>'<p class="loading-line" role="status">Загружаем…</p>';
  const statusBadge=p=>p.state==='published'?(new Date(p.publishAt)>new Date()?'Запланировано':new Date(p.expiresAt)<=new Date()?'Срок истёк':'В ленте'):statuses[p.state];
  function render(path,shared) {
    h=shared;route=path;items=[];cursor=null;editing=null;attachments=[];
    let content='';
    if(path==='/manage/new'||path.startsWith('/manage/edit/'))content=h.intro('Редактор','История начинается здесь.','Добавь текст, фотографии и срок показа. Время указывается по Новосибирску (UTC+7).')+'<div id="admin-content">'+busy()+'</div>';
    else if(path==='/manage/products/new'||path.startsWith('/manage/products/edit/'))content=h.intro('Магазин','Новый образ Фыр-Фырыча.','Добавь фотографию вещи, выбери её 3D-форму и цвет для примерки.')+'<div id="admin-content">'+busy()+'</div>';
    else if(path==='/manage/cleanup')content=h.intro('Порядок на сайте','Срок прошёл — лента обновилась.','Пост скрывается в выбранное время. Сервер затем удаляет запись и неиспользуемые фотографии.')+'<section class="panel settings-panel" id="admin-content">'+busy()+'</section>';
    else if(path==='/manage/rewards')content=h.intro('Участие и яблоки','Каждый вклад имеет значение.','После окончания встречи отметь, кто участвовал. Награду за одно участие можно получить только один раз.')+'<section class="panel" id="admin-content">'+busy()+'</section>';
    else if(path.startsWith('/manage/participants/'))content=h.intro('Участники мероприятия','Были вместе. Сделали вместе.')+'<section class="panel" id="admin-content">'+busy()+'</section>';
    else {
      const products=path==='/manage/products';
      content=`<div class="manage-heading"><div><span class="eyebrow">Управление «Юностью»</span><h1>${products?'Коллекция для ёжика.':'Всё важное — в одной ленте.'}</h1><p>${window.YunostAccount.user.role==='admin'?'Здесь твои записи.':'Здесь записи всей команды сайта.'}</p></div>${h.link(products?'#/manage/products/new':'#/manage/new',products?'Добавить вещь':'Создать публикацию','button cyan','arrow')}</div><section class="panel" id="admin-content">${busy()}</section>`;
    }
    return window.YunostAccount.adminNav(path)+content;
  }
  const alive=(token,node)=>token===generation&&document.contains(node);
  async function mount(path) {
    const token=++generation,node=document.querySelector('#admin-content');if(!node)return;
    try {
      if(path==='/manage/new') {editing={id:crypto.randomUUID().replaceAll('-',''),version:0};node.innerHTML=editor();wireEditor();return;}
      if(path.startsWith('/manage/edit/')) {const p=await api.request('manage/posts/'+path.split('/').pop());if(!alive(token,node))return;editing=p;attachments=p.mediaIds.map((id,i)=>({id,url:p.photos[i]}));node.innerHTML=editor(p);wireEditor(p);return;}
      if(path==='/manage/products/new'){editing={id:crypto.randomUUID().replaceAll('-',''),version:0};node.innerHTML=productEditor();window.YunostForms.mount(node);return;}
      if(path.startsWith('/manage/products/edit/')) {const data=await api.request('manage/products');if(!alive(token,node))return;editing=data.items.find(p=>p.id===path.split('/').pop());if(!editing)throw Error('Вещь не найдена или нет права на изменение.');node.innerHTML=productEditor(editing);const f=node.querySelector('form');f.elements.category.value=editing.category;f.elements.slot.value=editing.slot;f.elements.modelKey.value=editing.modelKey;window.YunostForms.mount(node);return;}
      if(path==='/manage/cleanup') {
        const settings=await api.request('manage/cleanup');if(!alive(token,node))return;
        node.innerHTML=`<form id="cleanup-form" class="form-fields"><h2>Время на восстановление</h2><p>После истечения срока запись скрыта. Пока не прошла эта пауза, её можно открыть в публикациях и продлить срок.</p>${select('retentionDays','Удалять запись и фотографии после окончания показа',[['0','Сразу, при ближайшей очистке'],['1','Через 1 день'],['7','Через 7 дней'],['30','Через 30 дней']])}<p class="small-note">Проверка выполняется каждую минуту, пока сервер запущен. Участие и история яблок сохраняются. Неотмеченные участники остаются в разделе «Участие и яблоки» даже после удаления афиши.</p><p class="form-status" role="alert"></p>${settings.canEdit?'<div class="form-actions"><button type="submit" class="button">Сохранить</button><button type="button" class="button outline" data-admin-action="cleanup">Очистить сейчас</button></div>':'<p>Эту настройку меняют владелец и совладелец.</p>'}</form>`;
        node.querySelector('select').value=settings.retentionDays;node.querySelector('select').disabled=!settings.canEdit;window.YunostForms.mount(node);return;
      }
      await loadList(false);
    } catch(error){if(alive(token,node))node.innerHTML=`<p class="form-status" role="alert">${h.esc(error.message)}</p><button class="button soft" data-admin-action="retry">Попробовать снова</button>`;}
  }
  async function loadList(append=false){
    const token=generation,node=document.querySelector('#admin-content');if(!node)return;
    const endpoint=route==='/manage/products'?'manage/products':route==='/manage/rewards'?'manage/events':route.startsWith('/manage/participants/')?'manage/events/'+route.split('/').pop()+'/participants':'manage/posts';
    const data=await api.request(endpoint+'?cursor='+encodeURIComponent(append?cursor||'':''));if(!alive(token,node))return;
    items=append?[...items,...data.items]:data.items;cursor=data.nextCursor;
    let html='';
    if(route==='/manage/products') html=items.map(p=>`<article class="content-row"><img class="row-image" src="${h.esc(p.imageUrl)}" alt=""><div><span class="tag">${h.esc(p.category)}</span><h2>${h.esc(p.title)}</h2><p>${p.price} яблок</p></div><div class="row-actions">${h.link('#/manage/products/edit/'+p.id,'Изменить','button soft compact')}<button class="button outline compact" data-remove-product="${p.id}">Удалить</button></div></article>`).join('');
    else if(route==='/manage/rewards') html=items.map(e=>`<article class="content-row"><div><span class="tag">${e.cancelled?'Отменено':e.pending?'Ждут отметки: '+e.pending:'Все отметки выставлены'}</span><h2>${h.esc(e.title)}</h2><p>${stamp(e.endsAt)} · Награда ${e.reward} яблок</p></div>${h.link('#/manage/participants/'+e.id,'Участники','button soft compact')}</article>`).join('');
    else if(route.startsWith('/manage/participants/')){
      const e=data.eventInfo;editing=e;
      html=`<div class="section-space"><h2>${h.esc(e.title)}</h2><p>${stamp(e.startsAt)} — ${stamp(e.endsAt)}</p><p>Оплата за запись: ${e.cost} яблок. Награда за участие: ${e.reward} яблок.</p>${new Date(e.endsAt)>new Date()?'<p class="small-note">Отметки откроются после окончания мероприятия.</p>':''}</div>`+items.map(p=>`<article class="content-row"><div><h3>${h.esc(p.fullName)}</h3><p>${registrationStatuses[p.status]} · ${p.reward} яблок за участие</p></div>${p.status==='registered'&&!e.cancelled&&new Date(e.endsAt)<=new Date()?`<div class="row-actions"><button class="button compact" data-attend="${p.userId}" data-decision="present">Участвовал · +${p.reward}</button><button class="button outline compact" data-attend="${p.userId}" data-decision="absent">Не пришёл</button></div>`:''}</article>`).join('');
    } else html=items.map(p=>`<article class="content-row">${p.photos[0]?`<img class="row-image" src="${h.esc(p.photos[0])}" alt="">`:''}<div><span class="tag">${statusBadge(p)} · ${p.type==='event'?'Мероприятие':'Новость'} · ${p.audience==='team'?'Отряду':'Всем'}</span><h2>${h.esc(p.title)}</h2><p>${stamp(p.publishAt)} → ${stamp(p.expiresAt)}</p></div><div class="row-actions">${h.link('#/manage/edit/'+p.id,'Изменить','button soft compact')}<button class="button outline compact" data-remove-post="${p.id}">Удалить</button></div></article>`).join('');
    node.innerHTML=(html||'<div class="empty-state"><h2>Пока ничего нет.</h2><p>Новые записи появятся здесь.</p></div>')+`<p class="form-status" id="admin-status" role="alert"></p>${cursor?'<button class="button soft" data-admin-action="more">Показать ещё</button>':''}`;
  }
  function editor(p={}){
    const e=p.eventInfo||{},now=Date.now();
    return `<div class="composer-layout"><form id="publication-form" class="panel composer form-fields">${select('type','Что публикуем',[['news','Новость'],['event','Мероприятие']])}${field('title','Заголовок',p.title||'','text','required minlength="3" maxlength="180"')}<div class="field"><label for="post-body">Текст публикации</label><textarea id="post-body" name="body" rows="7" required maxlength="12000" placeholder="Расскажи, что происходит…">${h.esc(p.body||'')}</textarea></div><div class="upload-zone"><label for="post-photos" class="button soft">Добавить фотографии</label><input id="post-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><p>До 6 фотографий, каждая до 5 МБ. Можно убрать лишнее перед сохранением.</p><div id="attachment-list" class="attachment-list"></div></div>${select('audience','Кто увидит запись',[['public','Все посетители'],['team','Только участники отряда']])}<div class="event-fields" id="event-fields"><h3>Мероприятие</h3><div class="field-row">${field('startsAt','Начало',toInput(e.startsAt||now+86400000),'datetime-local')}${field('endsAt','Окончание',toInput(e.endsAt||now+90000000),'datetime-local')}</div>${field('place','Где встречаемся',e.place||'','text','maxlength="300"')}<div class="field-row">${field('capacity','Количество мест',e.capacity||30,'number','min="1" max="1000" step="1"')}${field('cost','Стоимость записи в яблоках',e.cost||0,'number','min="0" max="100000" step="1"')}${field('reward','Награда за участие',e.reward||0,'number','min="0" max="100000" step="1"')}</div><p class="small-note">0 яблок — бесплатная запись. Награда начисляется после твоего подтверждения участия.</p>${e.everBooked?'<p class="small-note">Участники уже записались. Условия мероприятия закреплены; текст и фотографии можно обновлять.</p>':''}</div><div class="field-row">${field('publishAt','Показать с',toInput(p.publishAt||now),'datetime-local','required')}${field('expiresAt','Убрать из ленты',toInput(p.expiresAt||now+7*86400000),'datetime-local','required')}</div><p class="small-note">Время — Новосибирск, UTC+7. Будущая дата автоматически запланирует публикацию.</p><p class="form-status" role="alert"></p><div class="form-actions"><button type="submit" name="saveState" value="published" class="button">${p.version?'Сохранить и опубликовать':'Опубликовать'}</button><button type="submit" name="saveState" value="draft" class="button outline" ${e.everBooked?'disabled':''}>Сохранить черновик</button></div></form><aside class="composer-preview"><span class="preview-label">Так увидят участники</span><article class="panel live-post"><span class="tag">Юность · это по любви</span><h2 id="live-title">Здесь будет заголовок</h2><p id="live-body" class="post-text">Твоя история</p><div id="live-images" class="post-gallery"></div><p id="live-event" class="small-note"></p></article></aside></div>`;
  }
  function wireEditor(p={}){
    const f=document.querySelector('#publication-form');f.elements.type.value=p.type||'news';f.elements.type.disabled=!!p.version;f.elements.audience.value=p.audience||'public';
    if(p.eventInfo?.everBooked)for(const key of ['startsAt','endsAt','place','capacity','cost','reward','audience','publishAt'])f.elements[key].disabled=true;
    syncPreview();window.YunostForms.mount(f);
  }
  function syncPreview(){
    const f=document.querySelector('#publication-form');if(!f)return;
    const isEvent=f.elements.type.value==='event';document.querySelector('#event-fields').hidden=!isEvent;
    for(const key of ['startsAt','endsAt','place','capacity','cost','reward'])f.elements[key].required=isEvent;
    document.querySelector('#live-title').textContent=f.elements.title.value||'Здесь будет заголовок';document.querySelector('#live-body').textContent=f.elements.body.value||'Твоя история';
    document.querySelector('#live-event').textContent=isEvent?`Запись: ${f.elements.cost.value||0} яблок · За участие: ${f.elements.reward.value||0} яблок`:'';
    document.querySelector('#live-images').innerHTML=attachments.map(a=>`<img src="${h.esc(a.url)}" alt="Фотография к публикации">`).join('');
    document.querySelector('#attachment-list').innerHTML=attachments.map((a,i)=>`<div class="attachment-thumb"><img src="${h.esc(a.url)}" alt="Фото ${i+1}"><button type="button" data-remove-photo="${i}" aria-label="Убрать фото ${i+1}">×</button></div>`).join('');
  }
  function productEditor(p={}){
    return `<form id="product-form" class="panel form-fields settings-panel">${field('title','Название',p.title||'','text','required minlength="2" maxlength="120"')}${field('tag','Короткая подпись',p.tag||'','text','maxlength="100"')}<div class="field-row">${field('price','Цена в яблоках',p.price??90,'number','required min="0" max="100000" step="1"')}${select('category','Категория',[['Головные уборы','Головные уборы'],['Аксессуары','Аксессуары'],['Одежда','Одежда']])}</div>${select('modelKey','3D-форма',[['panama','Панама'],['beanie','Шапка с помпоном'],['glasses','Очки'],['tie','Галстук'],['scarf','Шарф'],['hoodie','Худи']])}${field('color','Цвет ткани',p.color||'#75b4dd','color')}${select('slot','Тип вещи',[['head','Головной убор'],['eyes','Очки'],['neck','Шарф или галстук'],['body','Одежда']])}<div class="product-upload-grid">${[['image','Картинка вещи',p.imageUrl],['outfit','Дополнительная иллюстрация (необязательно)',p.outfitId?p.outfitUrl:null]].map(([n,t,url])=>`<div class="field"><label for="product-${n}">${t}</label>${url?`<img class="upload-preview" src="${h.esc(url)}" alt="${t}">`:''}<input id="product-${n}" name="${n}" type="file" accept="image/png,image/jpeg,image/webp" ${!p.version&&n==='image'?'required':''}></div>`).join('')}</div><p class="small-note">PNG, JPEG или WebP до 5 МБ. Фотография — для карточки. В примерке используется выбранная объёмная форма. Можно создавать новые расцветки; для принципиально новой формы потребуется добавить 3D-модель.</p><p class="form-status" role="alert"></p><button class="button" type="submit">Сохранить вещь</button></form>`;
  }
  function checkFile(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Выбери PNG, JPEG или WebP до 5 МБ.');}
  document.addEventListener('input',event=>{if(event.target.closest('#publication-form'))syncPreview();});
  document.addEventListener('change',async event=>{
    const input=event.target;
    if(input.name==='modelKey'&&input.closest('#product-form')){const f=input.form;f.elements.slot.value={panama:'head',beanie:'head',glasses:'eyes',tie:'neck',scarf:'neck',hoodie:'body'}[input.value];f.elements.category.value=['panama','beanie'].includes(input.value)?'Головные уборы':input.value==='hoodie'?'Одежда':'Аксессуары';}
    if(input.id==='post-photos'){
      try{if(attachments.length+input.files.length>6)throw Error('К записи можно добавить до 6 фотографий.');for(const f of input.files)checkFile(f);for(const file of input.files)attachments.push({file,url:URL.createObjectURL(file)});syncPreview();}
      catch(e){h.toast(e.message);}input.value='';
    }
    if(input.type==='file'&&input.closest('#product-form')&&input.files[0]){
      try{checkFile(input.files[0]);let img=input.parentElement.querySelector('img');if(!img){img=document.createElement('img');img.className='upload-preview';input.before(img);}if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl);img.src=URL.createObjectURL(input.files[0]);img.dataset.objectUrl=img.src;}
      catch(e){input.value='';h.toast(e.message);}
    }
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!['publication-form','product-form','cleanup-form'].includes(form.id))return;event.preventDefault();
    const status=form.querySelector('.form-status'),buttons=[...form.querySelectorAll('button[type="submit"]')];buttons.forEach(b=>b.disabled=true);status.textContent='Сохраняем…';
    try{
      const value=n=>form.elements[n].value;
      if(form.id==='publication-form'){
        for(const a of attachments)if(!a.id){status.textContent='Загружаем фотографии…';a.id=(await api.upload(a.file)).id;}
        const data={title:value('title'),body:value('body'),type:value('type'),audience:value('audience'),state:event.submitter?.value||'draft',publishAt:fromInput(value('publishAt')),expiresAt:fromInput(value('expiresAt')),mediaIds:attachments.map(a=>a.id),version:editing.version,
          startsAt:fromInput(value('startsAt')),endsAt:fromInput(value('endsAt')),place:value('place'),capacity:Number(value('capacity')),cost:Number(value('cost')),reward:Number(value('reward'))};
        await api.send('manage/posts/'+editing.id,data,'PUT');h.toast(data.state==='draft'?'Черновик сохранён.':'Публикация сохранена.');location.hash='/manage';
      } else if(form.id==='product-form'){
        const ids={image:editing.imageId||'',outfit:editing.outfitId||''};
        for(const key of ['image','outfit']){const input=form.elements[key];if(input.files[0]){checkFile(input.files[0]);ids[key]=(await api.upload(input.files[0])).id;}}
        await api.send('manage/products/'+editing.id,{title:value('title'),tag:value('tag'),price:Number(value('price')),category:value('category'),slot:value('slot'),modelKey:value('modelKey'),color:value('color'),imageId:ids.image,outfitId:ids.outfit,version:editing.version},'PUT');document.dispatchEvent(new Event('yunost:catalog-updated'));h.toast('Вещь сохранена в магазине.');location.hash='/manage/products';
      } else {await api.send('manage/cleanup',{retentionDays:Number(value('retentionDays'))},'PUT');status.textContent='Настройка сохранена.';}
    }catch(error){status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
  });
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.removePhoto!==undefined){const a=attachments.splice(Number(b.dataset.removePhoto),1)[0];if(a.file)URL.revokeObjectURL(a.url);syncPreview();return;}
    if(!b.dataset.adminAction&&!b.dataset.removePost&&!b.dataset.removeProduct&&!b.dataset.attend)return;
    b.disabled=true;
    try{
      if(b.dataset.adminAction==='retry')await mount(route);
      if(b.dataset.adminAction==='more')await loadList(true);
      if(b.dataset.adminAction==='cleanup'){await api.send('manage/cleanup/run');h.toast('Очистка завершена.');}
      if(b.dataset.removePost&&confirm('Удалить публикацию? Записанным участникам отменённого мероприятия вернутся потраченные яблоки.')){await api.send('manage/posts/'+b.dataset.removePost,{},'DELETE');h.toast('Публикация снята. Очистка и возвраты продолжатся на сервере.');await loadList();}
      if(b.dataset.removeProduct&&confirm('Удалить вещь из магазина? Купленные экземпляры останутся в гардеробах.')){await api.send('manage/products/'+b.dataset.removeProduct,{},'DELETE');document.dispatchEvent(new Event('yunost:catalog-updated'));await loadList();}
      if(b.dataset.attend&&confirm(b.dataset.decision==='present'?'Подтвердить участие и начислить награду?':'Отметить, что участник не пришёл? Награда не будет начислена.')){await api.send(`manage/events/${editing.id}/participants/${b.dataset.attend}`,{decision:b.dataset.decision});h.toast('Отметка сохранена.');await loadList();}
    }catch(error){h.toast(error.message);}finally{b.disabled=false;}
  });
  function cleanup(){generation++;for(const a of attachments)if(a.file)URL.revokeObjectURL(a.url);document.querySelectorAll('[data-object-url]').forEach(i=>URL.revokeObjectURL(i.dataset.objectUrl));attachments=[];}
  return {render,mount,cleanup};
})();
