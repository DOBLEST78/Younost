/* Единая русская валидация для всех форм, независимо от языка браузера. */
window.YunostForms = (() => {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Novosibirsk', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const yearNow = () => Number(today().slice(0, 4));
  function birthFields() {
    return `<fieldset class="birth-fields"><legend>Дата рождения</legend><div class="birth-selects"><div class="field"><label for="birth-day">День</label><select id="birth-day" name="birthDay" required autocomplete="bday-day"><option value="">День</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div><div class="field"><label for="birth-month">Месяц</label><select id="birth-month" name="birthMonth" required autocomplete="bday-month"><option value="">Месяц</option>${months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div><div class="field"><label for="birth-year">Год</label><select id="birth-year" name="birthYear" required autocomplete="bday-year"><option value="">Год</option>${Array.from({length:yearNow()-1989},(_,i)=>`<option value="${1990+i}">${1990+i}</option>`).join('')}</select></div></div><input type="hidden" id="birthDate" name="birthDate"><p class="small-note">Выберите свою дату рождения. Список годов начинается с 1990.</p></fieldset>`;
  }
  function prepare(form) {
    if (form.elements.birthYear) {
      const y = Number(form.elements.birthYear.value), m = Number(form.elements.birthMonth.value), d = Number(form.elements.birthDay.value);
      const day = form.elements.birthDay;
      day.setCustomValidity('');
      form.elements.birthDate.value = '';
      if (y && m && d) {
        const value = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (d > new Date(y,m,0).getDate()) day.setCustomValidity('Такого дня в выбранном месяце нет. Проверьте дату рождения.');
        else if (value > today()) day.setCustomValidity('Дата рождения не может быть в будущем.');
        else form.elements.birthDate.value = value;
      }
    }
    if (form.elements.confirmPassword) {
      const confirm = form.elements.confirmPassword;
      confirm.setCustomValidity(confirm.value && confirm.value !== form.elements.password.value ? 'Пароли не совпадают.' : '');
    }
  }
  function russianMessage(field) {
    const v = field.validity;
    if (v.customError) return field.validationMessage;
    if (v.valueMissing) return field.type === 'checkbox' ? 'Поставьте отметку, чтобы продолжить.' : field.tagName === 'SELECT' ? 'Выберите значение из списка.' : 'Заполните это поле.';
    if (v.typeMismatch && field.type === 'email') return 'Введите электронную почту в формате name@example.com.';
    if (v.typeMismatch && field.type === 'url') return 'Введите полный адрес ссылки, например https://example.com.';
    if (v.tooShort) return `Введите не менее ${field.minLength} символов.`;
    if (v.tooLong) return `Введите не более ${field.maxLength} символов.`;
    if (v.patternMismatch) return field.type === 'tel' ? 'Введите телефон: от 10 до 15 цифр, можно с кодом страны.' : 'Проверьте формат значения.';
    if (v.rangeUnderflow) return `Минимальное значение: ${field.min}.`;
    if (v.rangeOverflow) return `Максимальное значение: ${field.max}.`;
    if (v.stepMismatch) return 'Введите целое число в допустимом диапазоне.';
    if (v.badInput) return 'Введите корректное значение.';
    return v.valid ? '' : 'Проверьте это поле.';
  }
  function validate(form) {
    for (const field of form.elements) {
      if (typeof field.setCustomValidity !== 'function' || field.disabled) continue;
      field.setCustomValidity('');
      // Проверяем также программно заполненные значения: браузер не всегда учитывает minlength.
      if (field.required && field.value && !field.value.trim()) field.setCustomValidity('Заполните это поле.');
      else if (field.minLength > 0 && field.value && field.value.length < field.minLength) field.setCustomValidity(`Введите не менее ${field.minLength} символов.`);
      if (field.type === 'tel' && field.value && !/^\+?[0-9() .-]+$/.test(field.value)) field.setCustomValidity('Проверьте номер телефона.');
      if (field.type === 'tel' && field.value) { const n = field.value.replace(/\D/g,'').length; if(n<10||n>15) field.setCustomValidity('Введите телефон: от 10 до 15 цифр.'); }
      const message = russianMessage(field);
      if (message) field.setCustomValidity(message);
    }
    prepare(form);
    return form.reportValidity();
  }
  document.addEventListener('submit', event => {
    if (!validate(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('invalid', event => {
    const field = event.target;
    if (typeof field.setCustomValidity === 'function') field.setCustomValidity(russianMessage(field));
  }, true);
  for (const name of ['input','change']) document.addEventListener(name, event => {
    const field = event.target;
    if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
    if (field.form) prepare(field.form);
  });
  function mount(root = document) { root.querySelectorAll('form').forEach(form => { form.noValidate = true; }); }
  return Object.freeze({birthFields, prepare, validate, mount});
})();
