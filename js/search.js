/* ============================================================
   晨曦FM 站内搜索接线
   全站 .searchbox 统一跳转到 search.html?q=关键字
   ============================================================ */
(function () {
  'use strict';

  function wire() {
    var box = document.querySelector('.searchbox');
    if (!box) return;
    var input = box.querySelector('input');
    var btn = box.querySelector('button');
    if (!input || !btn) return;

    function keyword() {
      var v = (input.value || '').replace(/^\s+|\s+$/g, '');
      return v === '请输入关键字' ? '' : v;
    }
    function go() {
      var v = keyword();
      location.href = 'search.html' + (v ? '?q=' + encodeURIComponent(v) : '');
    }

    btn.addEventListener('click', function (e) { e.preventDefault(); go(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); go(); }
    });
    input.addEventListener('focus', function () {
      if (input.value === '请输入关键字') input.value = '';
    });
    input.addEventListener('blur', function () {
      if (!input.value) input.value = '请输入关键字';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
