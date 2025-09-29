// src/polyfills.js
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import 'url-search-params-polyfill';

// Intl para formateo de fechas/moneda en es-AR (si no usás locales, podés omitir)
try {
  if (!window.Intl) {
    require('intl');
    require('intl/locale-data/jsonp/es-AR.js');
  }
} catch {}

// Fallback para addEventListener options en navegadores viejos
(function () {
  let supportsOptions = false;
  try {
    const opts = Object.defineProperty({}, 'passive', { get() { supportsOptions = true; } });
    window.addEventListener('test', null, opts);
    window.removeEventListener('test', null, opts);
  } catch {}
  if (!supportsOptions) {
    const _add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const useCapture = typeof options === 'boolean' ? options : false;
      return _add.call(this, type, listener, useCapture);
    };
  }
})();
