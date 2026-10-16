/* Запросы к ASP.NET. Сессия хранится в HttpOnly-cookie, не в localStorage. */
window.YunostApi = (() => {
  async function request(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('Запустите сайт через start.cmd и откройте http://localhost:5080. Вход не работает при открытии HTML-файла.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/${path}`, {
        ...options, credentials: 'same-origin', cache: 'no-store',
        headers: {'Content-Type': 'application/json', 'X-Yunost-Request': '1', ...options.headers}, signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.detail || 'Не удалось выполнить запрос. Попробуйте позже.');
        error.status = response.status;
        if (response.status === 401 && !path.startsWith('auth/')) document.dispatchEvent(new Event('yunost:session-expired'));
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Сервер долго отвечает. Обновите данные перед повторным действием.');
      if (error instanceof TypeError) throw new Error('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  const send = (path, body = {}, method = 'POST') => request(path, {method, body: JSON.stringify(body)});
  return Object.freeze({
    request, send, upload: file => request('manage/media', {method:'POST',body:file,headers:{'Content-Type':file.type}}),
    health: () => request('health'), me: () => request('me'),
   login: data => send('auth/login', data),
apply: data => send('membership-applications', data),
resendConfirmation: email => send('auth/resend', { email }),
registrationStatus: registrationTicket =>
  send('auth/registration-status', { registrationTicket }),
    logout: () => send('auth/logout'), updateProfile: data => send('me', data, 'PATCH'),
    applications: (status, cursor = '') => request(`manage/applications?status=${encodeURIComponent(status)}&cursor=${encodeURIComponent(cursor)}`),
    review: (uid, decision) => send(`manage/applications/${encodeURIComponent(uid)}/decision`, {decision}),
    findMember: email => request(`manage/team?email=${encodeURIComponent(email)}`),
    changeRole: (uid, role) => send(`manage/team/${encodeURIComponent(uid)}/role`, {role}, 'PATCH'),
    members: (cursor = '') => request('manage/members?cursor=' + encodeURIComponent(cursor)),
    deleteMember: uid => send(`manage/members/${encodeURIComponent(uid)}`, {}, 'DELETE'),
    deletionStatus: uid => request(`manage/members/${encodeURIComponent(uid)}/deletion`),
    purchase: id => send(`shop/${encodeURIComponent(id)}/purchase`),
    equip: (productId, equipped) => send('me/wardrobe', {productId, equipped}, 'PUT')
  });
})();
