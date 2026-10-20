
/* Интерфейс «Юности».
   Страницы, магазин, блог, регистрация и проверка почты.
*/

(() => {
  'use strict';

  const catalog = window.YunostCatalog;
  const account = window.YunostAccount;

  const main = document.querySelector('#main');
  const header = document.querySelector('#header');
  const dialog = document.querySelector('#preview-dialog');

  let currentFilter = 'Все';
  let toastTimer;
  let catalogError = 'Загружаем коллекцию…';
  let registrationCheckTimer = null;
let pendingRegistrationCredentials = null;

  catalog.products.splice(0);

  async function loadCatalog() {
    if (account.user?.membershipStatus !== 'accepted') {
      catalog.products.splice(0);
      return;
    }

    const userId = account.user.id;

    try {
      const data = await window.YunostApi.request('shop/products');

      if (account.user?.id !== userId) return;

      catalog.products.splice(
        0,
        catalog.products.length,
        ...data.items
      );

      catalogError = data.items.length
        ? ''
        : 'Коллекция пока пуста.';
    } catch (error) {
      catalogError = error.message;
    }

    const grid = document.querySelector('#product-grid');

    if (grid) {
      grid.innerHTML = productCards();
    }

    const status = document.querySelector('#catalog-status');

    if (status) {
      status.textContent = catalogError;
    }

    const count = document.querySelector('.filter-count');

    if (grid && count) {
      count.textContent = 'Всего: ' + catalog.products.length;
    }
  }

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

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])
    );

  const icon = name =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;

  const image = (
    key,
    alt = '',
    className = '',
    eager = false
  ) =>
    `<img src="assets/images/${key}.webp" alt="${esc(alt)}" class="${className}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

  const link = (
    href,
    text,
    className = 'button',
    symbol = ''
  ) =>
    `<a href="${esc(href)}" class="${className}" ${href.startsWith('https:') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${text}${symbol ? icon(symbol) : ''}</a>`;

  const intro = (
    kicker,
    title,
    subtitle = ''
  ) =>
    `<section class="page-intro"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</section>`;

  const pet = (outfit = []) => {
    const ids = Array.isArray(outfit)
      ? [...outfit]
      : [...(account.user?.equippedItems || []), outfit];

    const selected = [];

    for (const id of ids) {
      const product =
        (id === outfit
          ? catalog.products.find(p => p.id === id)
          : null) ||
        (account.user?.inventory || []).find(p => p.id === id) ||
        catalog.products.find(p => p.id === id);

      if (!product) continue;

      for (let i = selected.length - 1; i >= 0; i--) {
        if (
          selected[i].slot === product.slot ||
          (
            ['neck', 'body'].includes(product.slot) &&
            ['neck', 'body'].includes(selected[i].slot)
          )
        ) {
          selected.splice(i, 1);
        }
      }

      selected.push({
        modelKey: product.modelKey,
        color: product.color,
        slot: product.slot
      });
    }

    return `
      <div class="pet-figure pet3d"
           data-pet3d
           data-items="${esc(JSON.stringify(selected))}">
        <img
          class="pet-img"
          src="assets/images/mascot.webp"
          alt="Ёжик Фыр-Фырыч"
        >
        <button
          type="button"
          class="pet3d-reset"
          data-pet-reset
          aria-label="Вернуть ёжика в исходное положение"
        >↺</button>
        <span class="pet3d-status" role="status">
          Загружаем 3D-ёжика…
        </span>
      </div>
    `;
  };

  const photoCard = (
    href,
    key,
    title,
    text,
    tag = ''
  ) => `
    <a class="photo-card" href="${href}">
      <div class="photo-crop">
        ${image(key, '', 'card-photo')}
      </div>
      ${tag ? `<span class="card-kicker">${tag}</span>` : ''}
      <div class="card-body">
        <h2>${title}</h2>
        <div class="card-bottom">
          <p>${text}</p>
          <span class="circle-arrow">${icon('arrow')}</span>
        </div>
      </div>
    </a>
  `;

  const accountRoutes = [
    '/feed',
    '/my-events',
    '/achievements',
    '/pet',
    '/shop',
    '/wardrobe',
    '/profile',
    '/settings',
    '/welcome',
    '/leaderboard',
    '/transactions'
  ];

  function renderHeader(route) {
    const publicLinks = account.user
      ? [
          ['/', 'Главная'],
          ['/blog', 'Блог'],
          ['/services', 'Услуги']
        ]
      : [
          ['/', 'Главная'],
          ['/about', 'О нас'],
          ['/blog', 'Блог'],
          ['/services', 'Услуги']
        ];

    header.classList.remove('menu-open');

    header.innerHTML = `
      <a class="brand" href="#/" aria-label="Юность — главная">
        ${image('logo', '', '', true)}
        <span>
          <strong>Юность</strong>
          <small>Педагогический отряд</small>
        </span>
      </a>

      <nav
        class="main-nav"
        id="main-nav"
        aria-label="Основная навигация"
      >
        ${publicLinks.map(([path, title]) => `
          <a
            class="nav-link${route === path || (
              path === '/blog' &&
              route.startsWith('/article/')
            ) ? ' active' : ''}"
            href="#${path}"
            ${route === path ? 'aria-current="page"' : ''}
          >${title}</a>
        `).join('')}
      </nav>

      <div class="header-actions">
        ${link(
          account.user
            ? account.user.membershipStatus === 'accepted'
              ? '#/profile'
              : '#/pending'
            : '#/auth',
          account.user?.membershipStatus === 'accepted'
            ? 'Личный кабинет'
            : account.user
              ? 'Моя заявка'
              : 'Личный кабинет',
          'button',
          'user'
        )}

        <button
          class="menu-button"
          aria-label="Открыть меню"
          aria-controls="main-nav"
          aria-expanded="false"
          data-action="menu"
        >
          ${icon('menu')}
        </button>
      </div>
    `;
  }

  function accountNav(route) {
    const items = [
      ['/feed', 'Новостник'],
      ['/my-events', 'Мои мероприятия'],
      ['/achievements', 'Достижения'],
      ['/pet', 'Фыр-Фырыч'],
      ['/shop', 'Магазин']
    ];

    return `
      <nav class="account-nav" aria-label="Разделы личного кабинета">
        ${items.map(([href, title]) => `
          <a
            href="#${href}"
            class="${route === href || (
              href === '/shop' &&
              route === '/wardrobe'
            ) ? 'active' : ''}"
            ${route === href ? 'aria-current="page"' : ''}
          >${title}</a>
        `).join('')}
      </nav>
    `;
  }

  function home() {
    const isLoggedIn = !!account.user;
    const isAccepted =
      account.user?.membershipStatus === 'accepted';

    const mainButton = isLoggedIn
      ? isAccepted
        ? link('#/profile', 'Мой личный кабинет', 'button cyan')
        : link('#/pending', 'Статус моей заявки', 'button cyan')
      : link('#/auth', 'Стать частью отряда', 'button cyan');

    const accountCard = isLoggedIn
      ? isAccepted
        ? photoCard(
            '#/profile',
            'login_photo',
            'Мой личный кабинет',
            'Перейти в свой профиль'
          )
        : photoCard(
            '#/pending',
            'login_photo',
            'Моя заявка',
            'Посмотреть статус рассмотрения'
          )
      : photoCard(
          '#/auth',
          'login_photo',
          'Ты — часть команды',
          'Войти в личный кабинет'
        );

    return `
      <section class="reference-hero">
        <div class="reference-caption">
          <h2>Здесь начинается<br>твоё лучшее лето.</h2>
          <p>Педагогический отряд «Юность»</p>
        </div>

        <div class="reference-message">
          
        
          <h2>Воплощаем в реальность детские мечты.</h2>


          ${!isLoggedIn ? `
            <div class="hero-actions">
              ${mainButton}
              ${link('#/about', 'Узнать о нас', 'button white')}
            </div>
          ` : ''}
        </div>
      </section>

      <section class="reference-links" aria-label="Разделы сайта">
        ${photoCard(
          '#/blog',
          'join_photo',
          'Наши истории',
          'Люди и события отряда'
        )}

        ${photoCard(
          '#/services',
          'host',
          'Праздник с «Юностью»',
          '9 услуг для ваших событий'
        )}

        ${accountCard}
      </section>
    `;
  }

  function about() {
    return `
      ${intro(
        'Наша история',
        'Не просто отряд. Свои люди.',
        'Мы собираемся вместе, чтобы делать детство ярче, а жизнь — чуть добрее.'
      )}

      <section class="panel about-hero">
        ${image(
          'join_photo',
          'Участники педагогического отряда «Юность»',
          '',
          true
        )}

        <div class="about-content">
          <span class="tag">Педагогический отряд «Юность»</span>

          <h2>
            Быть рядом.<br>
            Делать вместе.<br>
            Оставаться собой.
          </h2>

          <p>
            «Юность» — это люди, которых объединяет любовь
            к работе с детьми, творчеству и общему делу.
          </p>

          <p>
            Мы придумываем события, учимся друг у друга,
            поддерживаем новые идеи и бережно храним наши традиции.
          </p>

          ${link(
            '#/join',
            'Хочу стать частью отряда',
            'button',
            'arrow'
          )}
        </div>
      </section>

      <section class="values-grid">
        <article class="value-card">
          <span class="value-number">01 / ЛЮДИ</span>
          <h3>Команда рядом</h3>
          <p>
            Здесь можно найти поддержку и людей,
            с которыми хочется создавать новое.
          </p>
        </article>

        <article class="value-card">
          <span class="value-number">02 / ДЕЛО</span>
          <h3>Вклад каждого</h3>
          <p>
            Идея, улыбка, помощь на событии —
            большое дело начинается с небольшого шага.
          </p>
        </article>

        <article class="value-card">
          <span class="value-number">03 / РОСТ</span>
          <h3>Учимся вместе</h3>
          <p>
            Пробуем себя в разных ролях,
            делимся опытом и замечаем маленькие победы.
          </p>
        </article>
      </section>

      <section class="contact-strip">
        <div>
          <h2>Есть вопрос к команде?</h2>
          <p>Напиши нам — познакомимся и всё расскажем.</p>
        </div>

        ${link(
          catalog.telegram,
          'Написать в Telegram',
          'button',
          'external'
        )}
      </section>
    `;
  }

  function filters(type, categories, count) {
    return `
      <div
        class="filters"
        role="group"
        aria-label="${type === 'service'
          ? 'Категории услуг'
          : 'Категории одежды'}"
      >
        ${categories.map(category => `
          <button
            class="filter"
            data-filter-type="${type}"
            data-filter="${esc(category)}"
            aria-pressed="${category === currentFilter}"
          >${category}</button>
        `).join('')}

        <span class="filter-count">Всего: ${count}</span>
      </div>
    `;
  }

  function serviceCards() {
    return catalog.services
      .filter(service =>
        currentFilter === 'Все' ||
        service.category === currentFilter
      )
      .map(service => `
        <article class="service-card">
          ${image(service.id, service.title)}

          <div class="card-body">
            <h2>${service.title}</h2>
            <p>${service.description}</p>

            <div class="service-price">
              ${service.price}
            </div>

            ${link(
              catalog.telegram,
              'Обсудить в Telegram',
              'button soft wide',
              'external'
            )}
          </div>
        </article>
      `)
      .join('');
  }

  function services() {
    return `
      ${intro(
        'Услуги «Юности»',
        'Вы придумываете повод.<br>Мы создаём настроение.',
        'Уютный день рождения, большое событие или выходные для команды. Найдём формат, который подойдёт именно вам.'
      )}

      <section aria-label="Каталог услуг">
        ${filters(
          'service',
          [
            'Все',
            'Праздники',
            'Для команды',
            'Специалисты',
            'Оформление'
          ],
          9
        )}

        <div class="services-grid" id="service-grid">
          ${serviceCards()}
        </div>

        <p class="light-note">
          Фотографии иллюстрируют форматы услуг
          и не являются портфолио проведённых мероприятий.
        </p>
      </section>

      <section class="contact-strip">
        <div>
          <h2>Твоя идея не помещается в карточку?</h2>
          <p>
            Расскажи, что ты задумал.
            Вместе найдём решение.
          </p>
        </div>

        ${link(
          catalog.telegram,
          'Обсудить идею',
          'button',
          'external'
        )}
      </section>
    `;
  }

  function blog() {
    return `
      ${intro(
        'Блог отряда',
        'Сохраняем самое тёплое.',
        'Люди, встречи и впечатления, из которых складывается наша «Юность».'
      )}

      <div id="community-content"></div>

      <h2 class="archive-heading">
        Из архива «Юности»
      </h2>

      <section class="two-grid blog-grid">
        ${catalog.news.map(item =>
          photoCard(
            '#/article/' + item.id,
            item.image,
            item.title,
            item.description,
            item.category
          )
        ).join('')}
      </section>

      <p class="light-note">
        Материалы из архива «Юности».
      </p>
    `;
  }

  function article(id) {
    const item = catalog.news.find(news => news.id === id);

    if (!item) return notFound();

    return `
      <a class="back-link" href="#/blog">
        ← Все истории
      </a>

      <article class="panel article">
        ${image(item.image, item.title, '', true)}

        <div class="article-text">
          <span class="tag">${item.category}</span>
          <h1>${item.title}</h1>
          <p>${item.body}</p>

          ${link(
            '#/blog',
            'К другим историям',
            'button soft',
            'arrow'
          )}
        </div>
      </article>
    `;
  }

  function auth() {
    return `
      ${intro(
        'Добро пожаловать',
        'Твоя история в «Юности».',
        'Присоединяйся к команде или возвращайся к своим открытиям.'
      )}

      <section
        class="two-grid auth-choice"
        aria-label="Вход или вступление"
      >
        ${photoCard(
          '#/join',
          'join_photo',
          'Хочу в отряд',
          'Знакомство начинается с небольшой анкеты.',
          'Новое начало'
        )}

        ${photoCard(
          '#/login',
          'login_photo',
          'Я уже в команде',
          'События, достижения и твой Фыр-Фырыч ждут.',
          'С возвращением'
        )}
      </section>
    `;
  }

  function login() {
    return `
      <a class="back-link" href="#/auth">
        ← Назад к знакомству
      </a>

      <section class="panel form-panel">
        <div class="form-image">
          ${image(
            'login_photo',
            'Участники отряда вместе на встрече',
            '',
            true
          )}

          <div class="form-image-text">
            <h2>
              С возвращением<br>
              в «Юность»!
            </h2>

            <p>
              Твои события, маленькие победы
              и большой путь — всё здесь.
            </p>
          </div>
        </div>

        <div class="form-content">
          <span class="tag">Личный кабинет</span>

          <h1 class="section-space">
            Рады видеть тебя.
          </h1>

          <p>
            Войди, чтобы продолжить свою историю.
          </p>

          <form id="login-form" class="form-fields">
            <div class="field">
              <label for="email">Электронная почта</label>

              <input
                id="email"
                name="email"
                type="email"
                autocomplete="username"
                placeholder="you@example.com"
                maxlength="254"
                required
              >
            </div>

            <div class="field">
              <label for="password">Пароль</label>

              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Введите пароль"
                required
                maxlength="128"
              >
            </div>

            <p class="form-status" role="alert"></p>

            <button class="button wide" type="submit">
              Войти ${icon('arrow')}
            </button>
          </form>

          <div class="form-extra">
            Нужна помощь?
            <a
              href="${catalog.telegram}"
              target="_blank"
              rel="noopener noreferrer"
            >Напиши нам ↗</a>
          </div>

          <div class="stage-notice" data-account-notice>
            Вход временно недоступен.
            Попробуйте позже или напишите команде.
          </div>

          <div class="form-extra">
            Ещё не в отряде?
            <a href="#/join">
              Познакомиться с командой
            </a>
          </div>
        </div>
      </section>
    `;
  }

  function join() {
    return `
      ${intro(
        'Присоединиться',
        'Начнём со знакомства.',
        'Заполни анкету и создай аккаунт. Команда рассмотрит заявку, а её статус появится в личном кабинете.'
      )}

      <section class="panel join-layout">
        <div class="join-aside">
          <div class="join-steps">
            <div class="step active">
              <b>1</b>Анкета
            </div>

            <div class="step">
              <b>2</b>Рассмотрение
            </div>

            <div class="step">
              <b>3</b>Ты в отряде
            </div>
          </div>

          <h2>
            Большая история<br>
            начинается с тебя.
          </h2>

          <p>
            Расскажи о себе, своих увлечениях и опыте.
            Пароль понадобится для входа в личный кабинет.
          </p>

          ${link(
            '#/login',
            'Уже есть аккаунт? Войти',
            'button soft'
          )}

          <div class="stage-notice" data-account-notice>
            Приём анкет временно недоступен.
            Можно связаться с командой в Telegram.
          </div>
        </div>

        <div class="form-content">
          <form id="join-form" class="form-fields">
            <div class="field">
              <label for="fullName">
                Фамилия, имя и отчество
              </label>

              <input
                id="fullName"
                name="fullName"
                autocomplete="name"
                required
                minlength="5"
                maxlength="140"
                placeholder="Твоё ФИО?"
              >
            </div>

            ${window.YunostForms.birthFields()}

            <div class="field-row">
              <div class="field">
                <label for="phone">Телефон</label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autocomplete="tel"
                  placeholder="+7 999 123-45-67"
                  maxlength="30"
                  required
                >
              </div>

              <div class="field">
                <label for="join-email">
                  Электронная почта
                </label>

                <input
                  id="join-email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  maxlength="254"
                  required
                >
              </div>
            </div>

            <div class="field">
              <label for="aboutYou">О себе</label>

              <textarea
                id="aboutYou"
                name="about"
                placeholder="Что тебя увлекает? Что хочется попробовать?"
                maxlength="2000"
                required
              ></textarea>
            </div>

            <div class="field">
              <label for="experience">
                Опыт работы с детьми
              </label>

              <textarea
                id="experience"
                name="experience"
                placeholder="Если опыта пока нет — это тоже можно написать."
                maxlength="2000"
              ></textarea>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="join-password">
                  Придумай пароль
                </label>

                <input
                  id="join-password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  maxlength="128"
                  placeholder="Не менее 8 символов"
                >
              </div>

              <div class="field">
                <label for="confirm-password">
                  Повтори пароль
                </label>

                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  maxlength="128"
                  placeholder="Ещё раз тот же пароль"
                >
              </div>
            </div>

            <p class="small-note">
              Анкета и контакты будут доступны администраторам
              для рассмотрения заявки. Пароль им не виден.
            </p>

            <p class="form-status" role="alert"></p>

            <button type="submit" class="button wide">
              Создать аккаунт и отправить анкету
              ${icon('arrow')}
            </button>

            <p class="form-extra">
              Есть аккаунт?
              <a href="#/login">Войти</a>
            </p>
          </form>
        </div>
      </section>
    `;
  }

  function productCards() {
    return catalog.products
      .filter(product =>
        currentFilter === 'Все' ||
        product.category === currentFilter
      )
      .map(product => `
        <article class="product-card">
          <div class="product-picture">
            <img
              src="${esc(product.imageUrl)}"
              alt="${esc(product.title)}"
              loading="lazy"
            >
          </div>

          <h2>${esc(product.title)}</h2>
          <p>${esc(product.tag)}</p>

          <div class="price-row">
            ${icon('apple')} ${product.price}
            <span class="small-note">яблок</span>
          </div>

          <button
            class="button soft wide"
            data-try="${esc(product.id)}"
          >
            Примерить ${icon('arrow')}
          </button>
        </article>
      `)
      .join('');
  }

  function shop() {
    return `
      ${intro(
        'Магазин для ёжика',
        'Маленькие вещи. Большая радость.',
        'Выбирай наряды для Фыр-Фырыча. Здесь принимают яблоки за участие в жизни отряда — настоящие деньги не нужны.'
      )}

      <section class="shop-layout">
        <aside class="pet-aside">
          <h2>Твой Фыр-Фырыч</h2>

          ${pet(account.user?.equippedItems || [])}

          <p>
            Каждая вещь — ещё одна маленькая история.
          </p>

          ${link(
            '#/wardrobe',
            'Мой гардероб',
            'button wide'
          )}
        </aside>

        <div>
          ${filters(
            'product',
            [
              'Все',
              'Головные уборы',
              'Аксессуары',
              'Одежда'
            ],
            catalog.products.length
          )}

          <div class="products-grid" id="product-grid">
            ${productCards()}
          </div>

          <p
            id="catalog-status"
            class="light-note"
            role="status"
          >${esc(catalogError)}</p>

          <p class="light-note">
            ${account.user?.membershipStatus === 'accepted'
              ? `Твой баланс: ${Number(account.user.apples || 0).toLocaleString('ru-RU')} яблок. Купленные вещи остаются в гардеробе.`
              : 'Магазин откроется после принятия в отряд.'}
          </p>
        </div>
      </section>
    `;
  }

  function petPage() {
    return `
      ${intro(
        'Мой Фыр-Фырыч',
        'Большой друг маленьких побед.',
        'Знакомься с ёжиком, который будет расти вместе с тобой.'
      )}

      <section class="pet-main">
        <div class="pet-showcase">
          ${pet(account.user?.equippedItems || [])}

          <span class="tag">
            Хранитель тёплых моментов
          </span>
        </div>

        <div class="panel pet-info">
          <span class="tag">Всегда на твоей стороне</span>

          <h2>Растём вместе.</h2>

          <p>
            Участвуй в жизни команды,
            получай яблоки за свой вклад
            и выбирай подарки для Фыр-Фырыча.
          </p>

          <ul class="benefits">
            <li>
              ${icon('calendar')}
              Участие в событиях отряда
            </li>

            <li>
              ${icon('star')}
              Достижения и маленькие победы
            </li>

            <li>
              ${icon('bag')}
              Наряды за игровые яблоки
            </li>
          </ul>

          ${link(
            '#/shop',
            'Выбрать подарок',
            'button',
            'arrow'
          )}

          ${account.user
            ? link(
                '#/wardrobe',
                'Открыть мой гардероб',
                'button soft'
              )
            : link(
                '#/login',
                'Войти в свой кабинет',
                'button soft'
              )}
        </div>
      </section>
    `;
  }

  function gate(
    kicker,
    title,
    description,
    symbol = 'lock',
    extra = ''
  ) {
    return `
      ${intro(kicker, title)}

      <section class="panel empty-state">
        <div class="empty-symbol">
          ${icon(symbol)}
        </div>

        <h2>Здесь начинается твоя история.</h2>
        <p>${description}</p>

        <div class="empty-actions">
          ${link(
            '#/login',
            'Войти в кабинет',
            'button',
            'arrow'
          )}

          ${link(
            '#/auth',
            'Я пока не в отряде',
            'button soft'
          )}
        </div>
      </section>

      ${extra}
    `;
  }

  function pending() {
    if (!account.user) {
      return gate(
        'Заявка в отряд',
        'Узнать статус заявки',
        'Войди в свой аккаунт, чтобы посмотреть решение администрации.'
      );
    }

    const status = account.user.membershipStatus;

    const steps = `
      <div class="join-steps">
        <div class="step">
          <b>1</b> Анкета
        </div>

        <div class="step">
          <b>2</b> Рассмотрение
        </div>

        <div class="step">
          <b>3</b> Решение
        </div>
      </div>
    `;

    if (status === 'accepted') {
      return `
        ${intro(
          'Заявка в отряд',
          'Поздравляем, ты принята в «Юность»!'
        )}

        <section class="panel empty-state">
          ${steps}

          <div class="empty-symbol">
            ${icon('check')}
          </div>

          <h2>Добро пожаловать в команду!</h2>

          <p>
            Твоя заявка одобрена.
            Теперь тебе доступны личный кабинет,
            мероприятия, достижения и Фыр-Фырыч.
          </p>

          ${link(
            '#/profile',
            'Перейти в личный кабинет',
            'button'
          )}
        </section>
      `;
    }

    if (status === 'ignored') {
      return `
        ${intro(
          'Заявка в отряд',
          'Решение по твоей анкете'
        )}

        <section class="panel empty-state">
          ${steps}

          <div class="empty-symbol">
            ${icon('heart')}
          </div>

          <h2>К сожалению, заявка отклонена</h2>

          <p>
            Спасибо за интерес к педагогическому
            отряду «Юность». Команда рассмотрела твою
            анкету, но пока не может принять тебя в состав.
          </p>

          ${link(
            '#/',
            'Вернуться на главную',
            'button'
          )}
        </section>
      `;
    }

    return `
      ${intro(
        'Заявка в отряд',
        'Твоя анкета на рассмотрении'
      )}

      <section class="panel empty-state">
        ${steps}

        <div class="empty-symbol">
          ${icon('clock')}
        </div>

        <h2>Ожидаем решение администрации</h2>

        <p>
          Анкета успешно отправлена.
          Как только команда рассмотрит заявку,
          здесь появится решение.
        </p>

        <p class="small-note">
          Ты можешь пользоваться публичными страницами сайта.
        </p>

        <button
          type="button"
          class="button"
          data-account-action="check-application-status"
        >
          Проверить статус заявки
        </button>

        ${link(
          '#/',
          'Вернуться на главную',
          'button soft'
        )}
      </section>
    `;
  }

  function notFound() {
    return `
      ${intro(
        'Страница не найдена',
        'Кажется, мы немного свернули.'
      )}

      <section class="panel empty-state">
        <h2>Вернёмся к знакомым местам?</h2>

        <p>
          Такой страницы сейчас нет.
          На главной есть всё, с чего стоит начать.
        </p>

        ${link(
          '#/',
          'На главную',
          'button',
          'arrow'
        )}
      </section>
    `;
  }

  const views = {
    '/': ['Главная', home],
    '/about': ['О нас', about],
    '/blog': ['Блог', blog],
    '/services': ['Услуги', services],
    '/auth': ['Знакомство', auth],
    '/login': ['Вход', login],
    '/join': ['Вступление', join],
    '/pending': ['Статус анкеты', pending],
    '/pet': ['Фыр-Фырыч', petPage],
    '/shop': ['Магазин', shop],

    '/feed': [
      'Новостник',
      () => gate(
        'Внутри отряда',
        'Всё, чем живёт «Юность».',
        'После входа здесь будут новые мероприятия, задачи и новости для команды.',
        'calendar'
      )
    ],

    '/my-events': [
      'Мои мероприятия',
      () => gate(
        'Твой путь',
        'Моменты, в которых ты — часть команды.',
        'Войди, чтобы увидеть свои заявки, предстоящие встречи и историю участия.',
        'calendar'
      )
    ],

    '/achievements': [
      'Достижения',
      () => gate(
        'Есть чем гордиться',
        'Твои маленькие и большие победы.',
        'Здесь будут храниться твои достижения. Награды и яблоки начисляет команда после проверки участия.',
        'star',
        '<div class="route-links"><a href="#/leaderboard">Рейтинг активности →</a></div>'
      )
    ],

    '/wardrobe': [
      'Гардероб',
      () => gate(
        'Стиль Фыр-Фырыча',
        'У каждого ёжика свой характер.',
        'После входа здесь появятся купленные вещи.',
        'bag'
      )
    ],

    '/profile': [
      'Профиль',
      () => gate(
        'Личный кабинет',
        'Твоя «Юность».',
        'Профиль, участие в событиях и достижения будут доступны после входа.',
        'user'
      )
    ],

    '/settings': [
      'Настройки',
      () => gate(
        'Личный кабинет',
        'Всё важное о тебе.',
        'Чтобы редактировать данные профиля, сначала войди в аккаунт.',
        'user'
      )
    ],

    '/welcome': [
      'Добро пожаловать',
      () => gate(
        'Начало пути',
        'Рады, что ты с нами.',
        'После одобрения заявки здесь можно будет завершить настройку личного кабинета.',
        'heart'
      )
    ],

    '/leaderboard': [
      'Рейтинг',
      () => gate(
        'Активность отряда',
        'Каждый вклад имеет значение.',
        'Рейтинг учитывает заработанные за активность баллы.',
        'star'
      )
    ]
  };

  function routePath() {
    return location.hash.startsWith('#/')
      ? location.hash.slice(1).split('?')[0]
      : '/';
  }

  function render(resetScroll = true) {
    window.YunostPet3D?.disposeAll();
    window.YunostAdmin?.cleanup();
    window.YunostCommunity?.cleanup();

    const route = routePath();

    currentFilter = 'Все';

    if (dialog.open) {
      dialog.close();
    }

    renderHeader(route);

    const view = views[route];
    const adminRoute = route.startsWith('/manage');

    const shared = {
      icon,
      esc,
      intro,
      link,
      pet,
      toast: showToast
    };

    const communityRoute =
      [
        '/feed',
        '/my-events',
        '/transactions',
        '/achievements',
        '/leaderboard'
      ].includes(route) ||
      route.startsWith('/post/');

    const personalRoute = [
      '/profile',
      '/settings',
      '/wardrobe',
      '/welcome'
    ].includes(route);

    let content;
    let adminAllowed = false;

    if (
      accountRoutes.includes(route) &&
      account.user?.membershipStatus !== 'accepted'
    ) {
      content = account.user
        ? pending()
        : account.access(false, shared);
    } else if (adminRoute) {
      const blocked = account.access(true, shared);

      adminAllowed = !blocked;

      content = blocked || (
        [
          '/manage/applications',
          '/manage/team',
          '/manage/members'
        ].includes(route)
          ? account.render(route, shared)
          : window.YunostAdmin.render(route, shared)
      );
    } else if (communityRoute) {
      content = window.YunostCommunity.render(route, shared);
    } else if (personalRoute) {
      content = account.render(route, shared);
    } else if (view) {
      content = view[1]();
    } else if (route.startsWith('/article/')) {
      content = article(route.slice(9));
    } else {
      content = notFound();
    }

    document.title = `${
      adminRoute
        ? 'Управление сайтом'
        : view
          ? view[0]
          : route.startsWith('/article/') ||
            route.startsWith('/post/')
            ? 'История отряда'
            : route === '/transactions'
              ? 'История яблок'
              : 'Страница не найдена'
    } — Юность`;

    main.innerHTML = (
      account.user?.membershipStatus === 'accepted' &&
      accountRoutes.includes(route)
        ? accountNav(route)
        : ''
    ) + content;

    updateAvailability();

    if (
      adminAllowed &&
      ![
        '/manage/applications',
        '/manage/team',
        '/manage/members'
      ].includes(route)
    ) {
      window.YunostAdmin.mount(route);
    }

    account.mount(route);

    if (communityRoute || route === '/blog') {
      window.YunostCommunity.mount(route, shared);
    }

    if (
      route === '/shop' &&
      account.user?.membershipStatus === 'accepted'
    ) {
      loadCatalog();
    }

    window.YunostPet3D?.mount(main);
    window.YunostForms.mount();

    if (resetScroll) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
  }

  function updateAvailability() {
    document
      .querySelectorAll('[data-account-notice]')
      .forEach(notice => {
        notice.hidden =
          !account.ready ||
          account.enabled;
      });
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('visible');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () => toast.classList.remove('visible'),
      5000
    );
  }

  function previewProduct(id) {
    const product = catalog.products.find(
      item => item.id === id
    );

    if (!product) return;

    const ownedItems = account.user?.ownedItems || [];

    dialog.innerHTML = `
      <button
        class="dialog-close"
        data-action="close-dialog"
        aria-label="Закрыть примерку"
      >
        ${icon('close')}
      </button>

      <div class="preview-content">
        <div class="preview-stage">
          ${pet(id)}
        </div>

        <div class="preview-details">
          <span class="tag">
            Примерочная Фыр-Фырыча
          </span>

          <h2 id="dialog-title">
            ${esc(product.title)}
          </h2>

          <p>
            ${esc(product.tag)}.
            Посмотри, как новый наряд меняет
            настроение твоего ёжика.
          </p>

          <div class="price-row">
            ${icon('apple')}
            ${product.price} яблок
          </div>

          ${
            !account.user
              ? link(
                  '#/login',
                  'Войти для покупки',
                  'button wide',
                  'arrow'
                )
              : ownedItems.includes(id)
                ? link(
                    '#/wardrobe',
                    'Уже в твоём гардеробе',
                    'button wide'
                  )
                : account.user.membershipStatus !== 'accepted'
                  ? `<p class="small-note">
                       Покупки откроются после принятия в отряд.
                     </p>`
                  : `<button
                       class="button wide"
                       data-buy="${esc(id)}"
                     >
                       Купить за ${product.price} яблок
                     </button>`
          }

          <p
            class="form-status"
            id="purchase-status"
            role="alert"
          ></p>

          <p class="small-note">
            Примерка бесплатная.
            Яблоки списываются только после покупки.
          </p>
        </div>
      </div>
    `;

    dialog.showModal();
    window.YunostPet3D?.mount(dialog);
  }

  document.addEventListener('click', async event => {
    const target = event.target.closest('a,button');

    if (!target) return;

    if (target.getAttribute('href') === '#main') {
      event.preventDefault();
      main.focus();
      return;
    }

    if (target.dataset.action === 'menu') {
      const expanded = header.classList.toggle('menu-open');

      target.setAttribute(
        'aria-expanded',
        String(expanded)
      );

      target.setAttribute(
        'aria-label',
        expanded ? 'Закрыть меню' : 'Открыть меню'
      );

      target.innerHTML = icon(
        expanded ? 'close' : 'menu'
      );
    }

    if (target.dataset.action === 'close-dialog') {
      dialog.close();
    }

    if (target.dataset.try) {
      previewProduct(target.dataset.try);
    }

    if (target.dataset.buy) {
      target.disabled = true;

      const status = dialog.querySelector(
        '#purchase-status'
      );

      try {
        await account.purchase(target.dataset.buy);

        showToast(
          'Покупка сохранена. Вещь уже в твоём гардеробе.'
        );
      } catch (error) {
        if (status) {
          status.textContent = error.message;
        }
      } finally {
        target.disabled = false;
      }
    }

    if (target.dataset.filter) {
      currentFilter = target.dataset.filter;

      const type = target.dataset.filterType;

      const group = target.closest('.filters');

      if (group) {
        group.querySelectorAll('button').forEach(button => {
          button.setAttribute(
            'aria-pressed',
            String(button.dataset.filter === currentFilter)
          );
        });
      }

      const grid = document.querySelector(
        type === 'service'
          ? '#service-grid'
          : '#product-grid'
      );

      if (grid) {
        grid.innerHTML =
          type === 'service'
            ? serviceCards()
            : productCards();
      }
    }

    if (
      dialog.open &&
      target.getAttribute('href')?.startsWith('#/')
    ) {
      dialog.close();
    }
  });

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      dialog.close();
    }
  });

  // Проверка подтверждения электронной почты.

  function stopRegistrationCheck() {
    if (registrationCheckTimer !== null) {
      clearInterval(registrationCheckTimer);
      registrationCheckTimer = null;
    }
  }

  function startRegistrationCheck(ticket) {
    stopRegistrationCheck();

    let checking = false;

    const check = async () => {
      if (
        checking ||
        routePath() !== '/join' ||
        !ticket
      ) {
        return;
      }

      checking = true;

      try {
        const result =
          await window.YunostApi.registrationStatus(ticket);

        if (result.confirmed) {
          clearInterval(registrationCheckTimer);
          registrationCheckTimer = null;
          sessionStorage.removeItem('yunost.registrationTicket');

          const status = document.querySelector(
            '#join-form .form-status'
          );

          if (status) {
            status.classList.add('email-confirmation');
            status.textContent =
              '✅ Почта подтверждена! Открываем статус заявки…';
          }

          if (pendingRegistrationCredentials) {
            const credentials = pendingRegistrationCredentials;
            pendingRegistrationCredentials = null;

            try {
              await account.authenticate(credentials, false);
            } catch (loginError) {
              if (status) {
                status.textContent =
                  '✅ Почта подтверждена! ' +
                  'Для просмотра статуса заявки войди в аккаунт.';

                const loginLink = document.createElement('a');
                loginLink.href = '#/login';
                loginLink.className = 'button';
                loginLink.textContent = 'Войти';

                status.append(
                  document.createElement('br'),
                  loginLink
                );
              }
            }
          } else if (status) {
            status.textContent =
              '✅ Почта подтверждена! ' +
              'Войди в аккаунт, чтобы посмотреть статус заявки.';

            const loginLink = document.createElement('a');
            loginLink.href = '#/login';
            loginLink.className = 'button';
            loginLink.textContent = 'Войти';

            status.append(
              document.createElement('br'),
              loginLink
            );
          }
        }
      } catch (error) {
        if (error.status === 410) {
          stopRegistrationCheck();

          sessionStorage.removeItem(
            'yunost.registrationTicket'
          );

          const status = document.querySelector(
            '#join-form .form-status'
          );

          if (status) {
            status.textContent =
              'Время ожидания истекло. ' +
              'Если почта уже подтверждена, войди в аккаунт.';
          }
        }
        // При временной ошибке сети проверка повторится.
      } finally {
        checking = false;
      }
    };

    registrationCheckTimer = setInterval(check, 5000);

    check();
  }

  function restoreRegistrationCheck() {
    if (routePath() !== '/join') return;

    const ticket = sessionStorage.getItem(
      'yunost.registrationTicket'
    );

    const status = document.querySelector(
      '#join-form .form-status'
    );

    if (!ticket || !status) return;

    status.classList.add('email-confirmation');

    status.textContent =
      '✉️ Ожидаем подтверждение электронной почты.\n\n' +
      'Если ты уже подтвердил почту с телефона, ' +
      'мы проверим её статус автоматически.';

    startRegistrationCheck(ticket);
  }

  // Отправка формы входа и регистрации.

  document.addEventListener('submit', async event => {
    const form = event.target;

    if (
      form.id !== 'login-form' &&
      form.id !== 'join-form'
    ) {
      return;
    }

    event.preventDefault();

    const status = form.querySelector('.form-status');

    const button = form.querySelector(
      'button[type="submit"]'
    );

    if (!status || !button) return;

    button.disabled = true;

    status.textContent = '';
    status.classList.remove('email-confirmation');

    try {
      const values = Object.fromEntries(
        new FormData(form)
      );

      if (form.id === 'join-form') {
      pendingRegistrationCredentials = {
        email: values.email,
        password: values.password
      };
    }

    const result = await account.authenticate(
        values,
        form.id === 'join-form'
      );

      if (result?.confirmationRequired) {
        const registrationTicket =
          result.registrationTicket;

        status.classList.add('email-confirmation');

        status.textContent =
          '✉️ Проверь свою электронную почту!\n\n' +
          'Регистрация принята. Для активации аккаунта ' +
          'перейди по ссылке из письма от «Юности».\n\n' +
          'Можешь подтвердить почту с телефона. ' +
          'Эта страница автоматически проверит подтверждение.';

        if (registrationTicket) {
          sessionStorage.setItem(
            'yunost.registrationTicket',
            registrationTicket
          );

          startRegistrationCheck(registrationTicket);
        }

        const resendButton =
          document.createElement('button');

        resendButton.type = 'button';
        resendButton.className = 'button soft';

        resendButton.textContent =
          'Отправить письмо повторно';

        const resendStatus =
          document.createElement('p');

        resendStatus.className = 'small-note';

        resendStatus.setAttribute(
          'role',
          'status'
        );

        resendButton.addEventListener(
          'click',
          async () => {
            resendButton.disabled = true;

            resendStatus.textContent =
              'Отправляем запрос…';

            try {
              await window.YunostApi.resendConfirmation(
                values.email
              );

              resendStatus.textContent =
                'Запрос принят. Если адрес ожидает подтверждения, ' +
                'письмо будет отправлено. Проверь «Входящие» и «Спам».';
            } catch (error) {
              resendStatus.textContent = error.message;
            } finally {
              resendButton.disabled = false;
            }
          }
        );

        status.append(
          document.createElement('br'),
          resendButton,
          resendStatus
        );
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      if (form.elements.password) {
        form.elements.password.value = '';
      }

      if (form.elements.confirmPassword) {
        form.elements.confirmPassword.value = '';
      }

      button.disabled = false;
    }
  });

  document.addEventListener(
    'yunost:account-changed',
    () => {
      loadCatalog();

      const route = routePath();

      // Не стираем заполненную анкету,
      // если проверка входа завершилась позже.

      if (
        ['/join', '/login'].includes(route) &&
        !account.user
      ) {
        renderHeader(route);
        updateAvailability();
        return;
      }

      render(false);
    }
  );

  window.addEventListener('hashchange', () => {
    if (routePath() !== '/join') {
      stopRegistrationCheck();
    }

    render();

    restoreRegistrationCheck();
  });

  render(false);
  restoreRegistrationCheck();

  account.bootstrap();

  dialog.addEventListener('close', () => {
    window.YunostPet3D?.cleanup();
  });

  document.addEventListener(
    'yunost:catalog-updated',
    loadCatalog
  );
})();
