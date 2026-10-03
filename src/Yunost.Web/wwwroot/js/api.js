/* Единственная точка обращения интерфейса к серверу.
   Пароли, ключи и баланс в браузерное хранилище не записываются. */
window.YunostApi = (() => {
  async function request(path, options = {}) {
    if (location.protocol === 'file:') {
      throw new Error('Открыт просмотр интерфейса. Для работы с сервером запустите проект через ASP.NET Core.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/${path}`, {
        ...options,
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json', ...options.headers},
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Не удалось выполнить запрос. Попробуйте позже.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Сервер долго отвечает. Попробуйте ещё раз.');
      if (error instanceof TypeError) throw new Error('Нет связи с сервером. Проверьте подключение.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return Object.freeze({
    health: () => request('health'),
    login: data => request('auth/login', {method: 'POST', body: JSON.stringify(data)}),
    apply: data => request('membership-applications', {method: 'POST', body: JSON.stringify(data)})
  });
})();
