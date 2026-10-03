/* Интерфейс «Юности». Без зависимостей и сборщика.
   Переключение страниц — hash-маршруты, поэтому просмотр работает и из файла.
   Финансовые операции, вход и заявки выполняются только будущим серверным API. */
(() => {
  'use strict';
  const catalog = window.YunostCatalog;
  const main = document.querySelector('#main');
  const header = document.querySelector('#header');
  const dialog = document.querySelector('#preview-dialog');
  let currentFilter = 'Все';
  let toastTimer;
  let accountsEnabled = false;

  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    heart: '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    bag: '<path d="M6 7h12l2 14H4L6 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    apple: '<path d="M12 7C8 4 3 7 3 12c0 5 3 9 6 9 1 0 2-1 3-1s2 1 3 1c3 0 6-4 6-9 0-5-5-8-9-5Z"/><path d="M12 7c0-3 1-5 5-5-1 3-3 4-5 4m0 1-2-5"/>'
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
  const image = (key, alt = '', className = '', eager = false) => `<img src="assets/images/${key}.webp" alt="${esc(alt)}" class="${className}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  const link = (href, text, className = 'button', symbol = '') => `<a href="${esc(href)}" class="${className}" ${href.startsWith('https:') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${text}${symbol ? icon(symbol) : ''}</a>`;
  const intro = (kicker, title, subtitle = '') => `<section class="page-intro"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</section>`;
  const pet = (outfit = '') => `<div class="pet-figure">${image('mascot', 'Ёжик Фыр-Фырыч', 'pet-img', true)}${outfit ? `<img class="outfit outfit-${outfit}" src="assets/images/${outfit}.svg" alt="">` : ''}</div>`;
  const photoCard = (href, key, title, text, tag = '') => `<a class="photo-card" href="${href}"><div class="photo-crop">${image(key, '', 'card-photo')}</div>${tag ? `<span class="card-kicker">${tag}</span>` : ''}<div class="card-body"><h2>${title}</h2><div class="card-bottom"><p>${text}</p><span class="circle-arrow">${icon('arrow')}</span></div></div></a>`;
  const accountRoutes = ['/feed', '/my-events', '/achievements', '/pet', '/shop', '/wardrobe', '/profile', '/settings', '/welcome', '/leaderboard'];

  function renderHeader(route) {
    const publicLinks = [['/', 'Главная'], ['/about', 'О нас'], ['/blog', 'Блог'], ['/services', 'Услуги']];
    header.classList.remove('menu-open');
    header.innerHTML = `<a class="brand" href="#/" aria-label="Юность — главная">${image('logo', '', '', true)}<span><strong>Юность</strong><small>Педагогический отряд</small></span></a><nav class="main-nav" id="main-nav" aria-label="Основная навигация">${publicLinks.map(([path, title]) => `<a class="nav-link${route === path || (path === '/blog' && route.startsWith('/article/')) ? ' active' : ''}" href="#${path}" ${route === path ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav><div class="header-actions">${link('#/auth', 'Личный кабинет', 'button', 'user')}<button class="menu-button" aria-label="Открыть меню" aria-controls="main-nav" aria-expanded="false" data-action="menu">${icon('menu')}</button></div>`;
  }

  function accountNav(route) {
    const items = [['/feed', 'Новостник'], ['/my-events', 'Мои мероприятия'], ['/achievements', 'Достижения'], ['/pet', 'Фыр-Фырыч'], ['/shop', 'Магазин']];
    return `<nav class="account-nav" aria-label="Разделы личного кабинета">${items.map(([href, title]) => `<a href="#${href}" class="${route === href || (href === '/shop' && route === '/wardrobe') ? 'active' : ''}" ${route === href ? 'aria-current="page"' : ''}>${title}</a>`).join('')}<a href="#/profile" class="account-entry">${icon('user')} Профиль</a></nav>`;
  }

  function home() {
    return `<section class="reference-hero"><div class="reference-caption"><h2>Здесь начинается<br>твоё лучшее лето.</h2><p>Педагогический отряд «Юность»</p></div><div class="reference-message"><span class="tag">Детские мечты сбываются</span><h1>Юность —<br>это по любви.</h1><h2>Воплощаем в реальность детские мечты.</h2><p>Дружба, творчество и люди, которые рядом.<br>Создаём моменты, к которым хочется возвращаться.</p><div class="hero-actions">${link('#/auth', 'Стать частью отряда', 'button cyan')}${link('#/about', 'Узнать о нас', 'button white')}</div></div></section><section class="reference-links" aria-label="Разделы сайта">${photoCard('#/blog', 'join_photo', 'Наши истории', 'Люди и события отряда')}${photoCard('#/services', 'host', 'Праздник с «Юностью»', '9 услуг для ваших событий')}${photoCard('#/auth', 'login_photo', 'Ты — часть команды', 'Войти в личный кабинет')}</section>`;
  }

  function about() {
    return `${intro('Наша история', 'Не просто отряд. Свои люди.', 'Мы собираемся вместе, чтобы делать детство ярче, а жизнь — чуть добрее.')}<section class="panel about-hero">${image('join_photo', 'Участники педагогического отряда «Юность»', '', true)}<div class="about-content"><span class="tag">Педагогический отряд «Юность»</span><h2>Быть рядом.<br>Делать вместе.<br>Оставаться собой.</h2><p>«Юность» — это люди, которых объединяет любовь к работе с детьми, творчеству и общим делам.</p><p>Мы придумываем события, учимся друг у друга, поддерживаем новые идеи и бережно храним наши традиции.</p>${link('#/join', 'Хочу стать частью отряда', 'button', 'arrow')}</div></section><section class="values-grid"><article class="value-card"><span class="value-number">01 / ЛЮДИ</span><h3>Команда рядом</h3><p>Здесь можно найти поддержку и людей, с которыми хочется создавать новое.</p></article><article class="value-card"><span class="value-number">02 / ДЕЛО</span><h3>Вклад каждого</h3><p>Идея, улыбка, помощь на событии — большое дело начинается с небольшого шага.</p></article><article class="value-card"><span class="value-number">03 / РОСТ</span><h3>Учимся вместе</h3><p>Пробуем себя в разных ролях, делимся опытом и замечаем маленькие победы.</p></article></section><section class="contact-strip"><div><h2>Есть вопрос к команде?</h2><p>Напиши нам — познакомимся и всё расскажем.</p></div>${link(catalog.telegram, 'Написать в Telegram', 'button', 'external')}</section>`;
  }

  function filters(type, categories, count) {
    return `<div class="filters" role="group" aria-label="${type === 'service' ? 'Категории услуг' : 'Категории одежды'}">${categories.map(category => `<button class="filter" data-filter-type="${type}" data-filter="${esc(category)}" aria-pressed="${category === currentFilter}">${category}</button>`).join('')}<span class="filter-count">Всего: ${count}</span></div>`;
  }

  function serviceCards() {
    return catalog.services.filter(s => currentFilter === 'Все' || s.category === currentFilter).map(s => `<article class="service-card">${image(s.id, s.title)}<div class="card-body"><h2>${s.title}</h2><p>${s.description}</p><div class="service-price">${s.price}</div>${link(catalog.telegram, 'Обсудить в Telegram', 'button soft wide', 'external')}</div></article>`).join('');
  }

  function services() {
    return `${intro('Услуги «Юности»', 'Вы придумываете повод.<br>Мы создаём настроение.', 'Уютный день рождения, большое событие или выходные для команды. Найдём формат, который подойдёт именно вам.')}<section aria-label="Каталог услуг">${filters('service', ['Все', 'Праздники', 'Для команды', 'Специалисты', 'Оформление'], 9)}<div class="services-grid" id="service-grid">${serviceCards()}</div><p class="light-note">Фотографии иллюстрируют форматы услуг и не являются портфолио проведённых мероприятий.</p></section><section class="contact-strip"><div><h2>Твоя идея не помещается в карточку?</h2><p>Расскажи, что ты задумал. Вместе найдём решение.</p></div>${link(catalog.telegram, 'Обсудить идею', 'button', 'external')}</section>`;
  }

  function blog() {
    return `${intro('Блог отряда', 'Сохраняем самое тёплое.', 'Люди, встречи и впечатления, из которых складывается наша «Юность».')}<section class="two-grid">${catalog.news.map(n => photoCard('#/article/' + n.id, n.image, n.title, n.description, n.category)).join('')}</section><p class="light-note">Материалы из архива «Юности».</p>`;
  }

  function article(id) {
    const n = catalog.news.find(item => item.id === id);
    if (!n) return notFound();
    return `<a class="back-link" href="#/blog">← Все истории</a><article class="panel article">${image(n.image, n.title, '', true)}<div class="article-text"><span class="tag">${n.category}</span><h1>${n.title}</h1><p>${n.body}</p>${link('#/blog', 'К другим историям', 'button soft', 'arrow')}</div></article>`;
  }

  function auth() {
    return `${intro('Добро пожаловать', 'Твоя история в «Юности».', 'Присоединяйся к команде или возвращайся к своим открытиям.')}<section class="two-grid auth-choice" aria-label="Вход или вступление">${photoCard('#/join', 'join_photo', 'Хочу в отряд', 'Знакомство начинается с небольшой анкеты.', 'Новое начало')}${photoCard('#/login', 'login_photo', 'Я уже в команде', 'События, достижения и твой Фыр-Фырыч ждут.', 'С возвращением')}</section>`;
  }

  function login() {
    return `<a class="back-link" href="#/auth">← Назад к знакомству</a><section class="panel form-panel"><div class="form-image">${image('login_photo', 'Участники отряда вместе на встрече', '', true)}<div class="form-image-text"><h2>С возвращением<br>в «Юность»!</h2><p>Твои события, маленькие победы и большой путь — всё здесь.</p></div></div><div class="form-content"><span class="tag">Личный кабинет</span><h1 class="section-space">Рады видеть тебя.</h1><p>Войди, чтобы продолжить свою историю.</p><form id="login-form" class="form-fields"><div class="field"><label for="email">Электронная почта</label><input id="email" name="email" type="email" autocomplete="username" placeholder="you@example.com" maxlength="254" required></div><div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Введите пароль" required maxlength="128"></div><p class="form-status" role="alert"></p><button class="button wide" type="submit">Войти ${icon('arrow')}</button></form><div class="form-extra">Нужна помощь? <a href="${catalog.telegram}" target="_blank" rel="noopener noreferrer">Напиши нам ↗</a></div><div class="stage-notice" data-account-notice>Вход пока недоступен: личный кабинет ещё в разработке. Введённые данные не сохраняются.</div><div class="form-extra">Ещё не в отряде? <a href="#/join">Познакомиться с командой</a></div></div></section>`;
  }

  function join() {
    return `${intro('Присоединиться', 'Начнём со знакомства.', 'Расскажи немного о себе — будем рады встретиться лично.')}<section class="panel join-layout"><div class="join-aside"><div class="join-steps"><div class="step active"><b>1</b>Анкета</div><div class="step"><b>2</b>Собеседование</div><div class="step"><b>3</b>Ты в команде</div></div><h2>У каждого большого дела есть начало.</h2><p>После рассмотрения анкеты команда свяжется с тобой и пригласит познакомиться. А дальше — новые люди, идеи и возможности.</p>${link(catalog.telegram, 'Задать вопрос', 'button soft', 'external')}<div class="stage-notice" data-account-notice>Онлайн-приём анкет ещё не открыт. Сейчас для вступления напиши нам в Telegram. Поля ниже показывают будущую форму; данные никуда не отправляются.</div></div><div class="form-content"><form id="join-form" class="form-fields"><div class="field-row"><div class="field"><label for="lastName">Фамилия</label><input id="lastName" name="lastName" autocomplete="family-name" placeholder="Твоя фамилия" maxlength="80" required></div><div class="field"><label for="firstName">Имя</label><input id="firstName" name="firstName" autocomplete="given-name" placeholder="Твоё имя" maxlength="80" required></div></div><div class="field-row"><div class="field"><label for="middleName">Отчество, если есть</label><input id="middleName" name="middleName" autocomplete="additional-name" placeholder="Твоё отчество" maxlength="80"></div><div class="field"><label for="birthDate">Дата рождения</label><input id="birthDate" name="birthDate" type="date" required></div></div><div class="field-row"><div class="field"><label for="phone">Телефон</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+7 999 123-45-67" maxlength="30" pattern="[+0-9() .-]{10,30}" required></div><div class="field"><label for="join-email">Электронная почта</label><input id="join-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254" required></div></div><div class="field"><label for="aboutYou">О себе</label><textarea id="aboutYou" name="about" placeholder="Что тебя увлекает? Что хочется попробовать?" maxlength="2000" required></textarea></div><div class="field"><label for="experience">Опыт работы с детьми</label><textarea id="experience" name="experience" placeholder="Если опыта пока нет — это тоже можно написать." maxlength="2000"></textarea></div><p class="form-status" role="alert"></p><button type="submit" class="button wide">Отправить анкету ${icon('arrow')}</button></form></div></section>`;
  }

  function productCards() {
    return catalog.products.filter(p => currentFilter === 'Все' || p.category === currentFilter).map(p => `<article class="product-card"><div class="product-picture"><img src="assets/images/${p.id}.svg" alt="${p.title}" loading="lazy"></div><h2>${p.title}</h2><p>${p.tag}</p><div class="price-row">${icon('apple')} ${p.price} <span class="small-note">яблок</span></div><button class="button soft wide" data-try="${p.id}">Примерить ${icon('arrow')}</button></article>`).join('');
  }

  function shop() {
    return `${intro('Магазин для ёжика', 'Маленькие вещи. Большая радость.', 'Выбирай наряды для Фыр-Фырыча. Здесь принимают яблоки за участие в жизни отряда — настоящие деньги не нужны.')}<section class="shop-layout"><aside class="pet-aside"><h2>Твой Фыр-Фырыч</h2>${pet()}<p>Каждая вещь — ещё одна маленькая история.</p>${link('#/wardrobe', 'Мой гардероб', 'button wide')}</aside><div>${filters('product', ['Все', 'Головные уборы', 'Аксессуары', 'Одежда'], 6)}<div class="products-grid" id="product-grid">${productCards()}</div><p class="light-note">Примерка доступна всем. Покупки и личный баланс появятся после открытия кабинета. Стоимость вещей пока проектная.</p></div></section>`;
  }

  function petPage() {
    return `${intro('Мой Фыр-Фырыч', 'Большой друг маленьких побед.', 'Знакомься с ёжиком, который будет расти вместе с тобой.')}<section class="pet-main"><div class="pet-showcase">${pet()}<span class="tag">Хранитель тёплых моментов</span></div><div class="panel pet-info"><span class="tag">Всегда на твоей стороне</span><h2>Растём вместе.</h2><p>Участвуй в жизни команды, получай яблоки за свой вклад и выбирай подарки для Фыр-Фырыча.</p><ul class="benefits"><li>${icon('calendar')} Участие в событиях отряда</li><li>${icon('star')} Достижения и маленькие победы</li><li>${icon('bag')} Наряды за игровые яблоки</li></ul>${link('#/shop', 'Выбрать подарок', 'button', 'arrow')}${link('#/login', 'Войти в свой кабинет', 'button soft')}</div></section>`;
  }

  function gate(kicker, title, text, symbol = 'lock', extra = '') {
    return `${intro(kicker, title)}<section class="panel empty-state"><div class="empty-symbol">${icon(symbol)}</div><h2>Здесь начинается твоя история.</h2><p>${text}</p><div class="empty-actions">${link('#/login', 'Войти в кабинет', 'button', 'arrow')}${link('#/auth', 'Я пока не в отряде', 'button soft')}</div></section>${extra}`;
  }

  function pending() {
    return `${intro('Анкета кандидата', 'Давай держать связь.')}<section class="panel empty-state"><div class="empty-symbol">${icon('heart')}</div><h2>Знакомство — первый шаг.</h2><p>Пока онлайн-приём анкет не открыт, отправь сообщение команде в Telegram. Мы расскажем о вступлении и ответим на вопросы. Здесь позднее появится статус твоей заявки.</p>${link(catalog.telegram, 'Написать команде', 'button', 'external')}</section>`;
  }

  function notFound() {
    return `${intro('Страница не найдена', 'Кажется, мы немного свернули.')}<section class="panel empty-state"><h2>Вернёмся к знакомым местам?</h2><p>Такой страницы сейчас нет. На главной есть всё, с чего стоит начать.</p>${link('#/', 'На главную', 'button', 'arrow')}</section>`;
  }

  const views = {
    '/': ['Главная', home], '/about': ['О нас', about], '/blog': ['Блог', blog],
    '/services': ['Услуги', services], '/auth': ['Знакомство', auth],
    '/login': ['Вход', login], '/join': ['Вступление', join], '/pending': ['Статус анкеты', pending],
    '/pet': ['Фыр-Фырыч', petPage], '/shop': ['Магазин', shop],
    '/feed': ['Новостник', () => gate('Внутри отряда', 'Всё, чем живёт «Юность».', 'После входа здесь будут новые мероприятия, задачи и новости для команды.', 'calendar')],
    '/my-events': ['Мои мероприятия', () => gate('Твой путь', 'Моменты, в которых ты — часть команды.', 'Войди, чтобы увидеть свои заявки, предстоящие встречи и историю участия.', 'calendar')],
    '/achievements': ['Достижения', () => gate('Есть чем гордиться', 'Твои маленькие и большие победы.', 'Здесь будут храниться твои достижения. Награды и яблоки начисляет команда после проверки участия.', 'star', '<div class="route-links"><a href="#/leaderboard">Рейтинг активности →</a></div>')],
    '/wardrobe': ['Гардероб', () => gate('Стиль Фыр-Фырыча', 'У каждого ёжика свой характер.', 'После входа здесь появятся купленные вещи. А пока можно посмотреть коллекцию и примерить любой наряд.', 'bag', '<div class="route-links"><a href="#/shop">Вернуться в магазин →</a></div>')],
    '/profile': ['Профиль', () => gate('Личный кабинет', 'Твоя «Юность».', 'Профиль, участие в событиях и достижения будут доступны после входа.', 'user', '<div class="route-links"><a href="#/settings">Настройки профиля →</a></div>')],
    '/settings': ['Настройки', () => gate('Личный кабинет', 'Всё важное о тебе.', 'Чтобы редактировать данные своего профиля, сначала войди в аккаунт.', 'user')],
    '/welcome': ['Добро пожаловать', () => gate('Начало пути', 'Рады, что ты с нами.', 'После одобрения заявки здесь можно будет завершить настройку личного кабинета.', 'heart')],
    '/leaderboard': ['Рейтинг', () => gate('Активность отряда', 'Каждый вклад имеет значение.', 'Рейтинг будет учитывать заработанные за активность баллы. Покупка одежды для ёжика не уменьшит место в рейтинге.', 'star')]
  };

  function routePath() { return location.hash.startsWith('#/') ? location.hash.slice(1).split('?')[0] : '/'; }

  function render(resetScroll = true) {
    window.YunostAdmin?.cleanup();
    const route = routePath();
    currentFilter = 'Все';
    dialog.close();
    renderHeader(route);
    const view = views[route];
    const adminRoute = route.startsWith('/manage');
    const content = adminRoute ? window.YunostAdmin.render(route, {icon, esc, intro, link}) : view ? view[1]() : route.startsWith('/article/') ? article(route.slice(9)) : notFound();
    document.title = `${adminRoute ? 'Управление сайтом' : view ? view[0] : route.startsWith('/article/') ? 'История отряда' : 'Страница не найдена'} — Юность`;
    main.innerHTML = (accountRoutes.includes(route) ? accountNav(route) : '') + content;
    const birthDate = document.querySelector('#birthDate');
    if (birthDate) birthDate.max = new Date().toLocaleDateString('en-CA');
    updateAvailability();
    if (adminRoute) window.YunostAdmin.mount(route);
    if (resetScroll) { window.scrollTo(0, 0); main.focus({preventScroll: true}); }
  }

  function updateAvailability() {
    document.querySelectorAll('[data-account-notice]').forEach(n => { n.hidden = accountsEnabled; });
  }

  function showToast(text) {
    const toast = document.querySelector('#toast');
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
  }

  function previewProduct(id) {
    const product = catalog.products.find(p => p.id === id);
    if (!product) return;
    dialog.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Закрыть примерку">${icon('close')}</button><div class="preview-content"><div class="preview-stage">${pet(id)}</div><div class="preview-details"><span class="tag">Примерочная Фыр-Фырыча</span><h2 id="dialog-title">${product.title}</h2><p>${product.tag}. Посмотри, как новый наряд меняет настроение твоего ёжика.</p><div class="price-row">${icon('apple')} ${product.price} яблок</div>${link('#/login', 'Войти для покупки', 'button wide', 'arrow')}<p class="small-note">Примерка бесплатная. Яблоки не списываются. Покупки откроются вместе с личным кабинетом.</p></div></div>`;
    dialog.showModal();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('a,button');
    if (!target) return;
    if (target.getAttribute('href') === '#main') { event.preventDefault(); main.focus(); return; }
    if (target.dataset.action === 'menu') {
      const expanded = header.classList.toggle('menu-open');
      target.setAttribute('aria-expanded', String(expanded));
      target.setAttribute('aria-label', expanded ? 'Закрыть меню' : 'Открыть меню');
      target.innerHTML = icon(expanded ? 'close' : 'menu');
    }
    if (target.dataset.action === 'close-dialog') dialog.close();
    if (target.dataset.try) previewProduct(target.dataset.try);
    if (target.dataset.filter) {
      currentFilter = target.dataset.filter;
      const type = target.dataset.filterType;
      target.closest('.filters').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === currentFilter)));
      const grid = document.querySelector(type === 'service' ? '#service-grid' : '#product-grid');
      grid.innerHTML = type === 'service' ? serviceCards() : productCards();
    }
    if (dialog.open && target.getAttribute('href')?.startsWith('#/')) dialog.close();
  });

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!['login-form', 'join-form'].includes(form.id)) return;
    event.preventDefault();
    const status = form.querySelector('.form-status');
    // На первом этапе не передаём персональные данные в несуществующий API.
    if (!accountsEnabled) {
      status.textContent = form.id === 'login-form'
        ? 'Вход ещё не открыт. Мы сообщим, когда личный кабинет будет готов.'
        : 'Онлайн-приём анкет ещё не открыт. Напиши команде в Telegram — там тебе помогут со вступлением.';
      status.scrollIntoView({block: 'nearest'});
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      if (form.id === 'login-form') {
        await window.YunostApi.login(values);
        // Персональный кабинет подключается вместе с серверной авторизацией.
        showToast('Ответ сервера получен.');
      } else {
        await window.YunostApi.apply(values);
        showToast('Ответ сервера получен.');
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      if (form.id === 'login-form') form.elements.password.value = '';
      button.disabled = false;
    }
  });

  window.addEventListener('hashchange', () => render());
  render(false);
  if (location.protocol !== 'file:') {
    window.YunostApi.health().then(result => {
      accountsEnabled = result.accountsEnabled === true;
      updateAvailability();
    }).catch(() => { accountsEnabled = false; });
  }
})();
