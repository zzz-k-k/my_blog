/* Copy the code text, never the toolbar, HTML markup or line numbers. */
(function () {
  'use strict';
  function fallbackCopy(text) {
    var active = document.activeElement;
    var selection = window.getSelection();
    var ranges = [];
    if (selection) for (var i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.setAttribute('aria-label', '待复制代码');
    input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(input);
    try {
      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, input.value.length);
      return document.execCommand('copy');
    } finally {
      input.remove();
      if (active && active.focus) active.focus({ preventScroll: true });
      if (selection) {
        selection.removeAllRanges();
        ranges.forEach(function (range) { selection.addRange(range); });
      }
    }
  }

  document.querySelectorAll('.doc-body pre > code').forEach(function (code) {
    if (code.closest('.code-block') || (code.querySelector('.lnt') && !code.hasAttribute('data-lang'))) return;
    var pre = code.parentElement;
    var block = pre.closest('.highlight') || pre;
    var wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    block.before(wrapper);
    wrapper.appendChild(block);
    var toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    var language = document.createElement('span');
    language.className = 'code-language';
    language.textContent = code.dataset.lang || (code.className.match(/language-([\w+-]+)/) || [])[1] || '代码';
    var actions = document.createElement('div');
    actions.className = 'code-copy';
    var status = document.createElement('span');
    status.className = 'code-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    var copyIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
    var checkIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
    button.innerHTML = copyIcon;
    button.setAttribute('aria-label', '复制代码');
    button.title = '复制代码';
    actions.append(status, button);
    toolbar.append(language, actions);
    wrapper.prepend(toolbar);
    var resetTimer;
    button.addEventListener('click', async function () {
      clearTimeout(resetTimer);
      status.textContent = '';
      status.classList.remove('is-error');
      button.innerHTML = copyIcon;
      var clone = code.cloneNode(true);
      clone.querySelectorAll('.ln, .lnt, .line-numbers').forEach(function (node) { node.remove(); });
      var text = clone.textContent; // textContent preserves original indentation and newlines.
      var copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (_) { /* Embedded browsers can deny this API; try the selection-based path. */ }
      if (!copied) {
        try { copied = fallbackCopy(text); } catch (_) { copied = false; }
      }
      if (copied) {
        status.textContent = '已复制';
        button.innerHTML = checkIcon;
        button.title = '已复制';
        button.setAttribute('aria-label', '已复制');
      } else {
        // Give the user a usable selection if both clipboard mechanisms are unavailable.
        var range = document.createRange();
        range.selectNodeContents(code);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = '已选中代码，请按 ⌘C / Ctrl+C';
        status.classList.add('is-error');
      }
      resetTimer = setTimeout(function () {
        status.textContent = '';
        status.classList.remove('is-error');
        button.innerHTML = copyIcon;
        button.title = '复制代码';
        button.setAttribute('aria-label', '复制代码');
      }, 3500);
    });
  });
})();
