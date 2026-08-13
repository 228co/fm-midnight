/* ============================================================
   FM-MIDNIGHT 剧集框架核心（全局对象 EP）
   供游戏作者编写 12 期独立故事时调用

   功能清单：
     1. 期注册与命名空间存档
        EP.config / EP.flag / EP.has / EP.require / EP.done / EP.progress
     2. 密码门 / 答案校验器
        EP.sha256 / EP.gate
     3. 加密工具与 URL 参数
        EP.caesar / EP.b64encode / EP.b64decode / EP.morseText / EP.param
     4. 氛围与触发组件
        EP.snow / EP.scare / EP.glitchEl / EP.idle / EP.atTime
        EP.consoleHint / EP.titleBlink

   依赖：须先引入 js/common.js（EP 构建于全局对象 FM 之上）

   调试后门：URL 携带 ?debug=1 时 FM.debug 为 true，
             EP.require 将直接放行所有流程门禁，便于作者自测
   ============================================================ */
(function () {
  'use strict';

  /* 当前期 id，由 EP.config 注册 */
  var currentId = null;

  /* 摩斯码表（与 common.js 中 FM.morse 保持一致） */
  var MORSE_TABLE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  };

  /* 读取完整的期数据对象 { ep01: {...}, ep02: {...} } */
  function epData() {
    var d = FM.load();
    return d.ep || {};
  }

  /* 读取当前期数据，无则返回空骨架 */
  function selfData() {
    var all = epData();
    var cur = all[currentId] || {};
    if (!cur.flags) cur.flags = {};
    return cur;
  }

  /* 写回当前期数据（注意：FM.save 是顶层浅合并，必须整体写回 ep 对象） */
  function saveSelf(patch) {
    var d = FM.load();
    if (!d.ep) d.ep = {};
    if (!d.ep[currentId]) d.ep[currentId] = { done: false, flags: {} };
    Object.assign(d.ep[currentId], patch);
    FM.save({ ep: d.ep });
  }

  var EP = {

    /* 当前期 id（config 后可用） */
    id: null,

    /* ---------- 1. 期注册与命名空间存档 ---------- */

    /* 注册当前期，创建存档命名空间
       opts: { id: 'ep01', title: '第1期《深夜点歌台》- FM-MIDNIGHT' }（title 可选） */
    config: function (opts) {
      currentId = opts.id;
      this.id = currentId;
      var d = FM.load();
      if (!d.ep) d.ep = {};
      if (!d.ep[currentId]) {
        d.ep[currentId] = { done: false, flags: {} };
        FM.save({ ep: d.ep });
      }
      if (opts.title) document.title = opts.title;
    },

    /* 写入当前期的 flag */
    flag: function (name) {
      var cur = selfData();
      cur.flags[name] = true;
      saveSelf({ flags: cur.flags });
    },

    /* 读取当前期的 flag */
    has: function (name) {
      return !!selfData().flags[name];
    },

    /* 期内门禁：无指定 flag 则踢回 redirectTo；?debug=1 时直接放行 */
    require: function (flagName, redirectTo) {
      if (FM.debug) return;
      if (!this.has(flagName)) location.replace(redirectTo);
    },

    /* 标记当前期通关 */
    done: function () {
      saveSelf({ done: true });
    },

    /* 12 期总进度（供 archive.html 选集页与主线联动使用） */
    progress: {
      list: ['ep01', 'ep02', 'ep03', 'ep04', 'ep05', 'ep06',
             'ep07', 'ep08', 'ep09', 'ep10', 'ep11', 'ep12'],
      /* 返回完整期数据对象 */
      doneFlags: function () { return epData(); },
      /* 某一期是否通关 */
      isDone: function (id) {
        var cur = epData()[id];
        return !!(cur && cur.done);
      },
      /* 已通关期数（0~12） */
      count: function () {
        var n = 0;
        for (var i = 0; i < this.list.length; i++) {
          if (this.isDone(this.list[i])) n++;
        }
        return n;
      }
    },

    /* ---------- 2. 密码门 / 答案校验器 ---------- */

    /* 计算字符串的 SHA-256（内部先 trim + toLowerCase 规范化）
       返回 Promise<小写 hex 字符串>
       注意：file:// 直接打开可能没有 crypto.subtle，请用 server.js 本地服务器运行 */
    sha256: function (text) {
      return new Promise(function (resolve, reject) {
        if (!window.crypto || !crypto.subtle) {
          reject(new Error('当前环境不支持 crypto.subtle，请用本地服务器运行（node server.js）'));
          return;
        }
        var normalized = String(text).trim().toLowerCase();
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
          .then(function (buf) {
            var arr = new Uint8Array(buf);
            var hex = '';
            for (var i = 0; i < arr.length; i++) {
              hex += ('0' + arr[i].toString(16)).slice(-2);
            }
            resolve(hex);
          })
          .catch(reject);
      });
    },

    /* 答案校验组件
       opts = {
         input:   '#answer',      必填 输入框选择器
         button:  '#submit',      必填 提交按钮选择器
         msg:     '#msg',         可选 提示信息元素选择器
         hash:    '...' 或 ['...','...'],  必填 答案 SHA-256 hex（针对 trim+toLowerCase 后的明文）；
                                         传数组表示多个等价答案均可通过
         normalize: function(s){}, 可选 校验前对输入做归一化（如去掉标点空格），
                                         哈希需按归一化后的结果计算
         flag:    'gate1',        可选 通过后写入的 flag 名，默认 'gate'
         hints:   {3:'提示1'},    可选 错误次数达到 key 时在 msg 显示对应提示
         deny:    '不对。',        可选 拒绝文案，默认"不对。再想想。"
         okText:  '对了。',        可选 通过时显示的文案
         goto:    'next.html',    可选 通过后跳转地址
         onOk:    function(){},   可选 通过后回调（与 goto 可只用一个）
       }
       点击按钮或在输入框按回车均触发校验 */
    gate: function (opts) {
      var input = document.querySelector(opts.input);
      var button = document.querySelector(opts.button);
      var msg = opts.msg ? document.querySelector(opts.msg) : null;
      if (!input || !button) return;

      var flagName = opts.flag || 'gate';
      var denyText = opts.deny || '不对。再想想。';
      var hashes = (opts.hash instanceof Array) ? opts.hash : [opts.hash];
      var wrong = 0;
      var self = this;

      function say(t) { if (msg) msg.textContent = t; }

      function check() {
        var val = input.value;
        if (opts.normalize) val = opts.normalize(val);
        EP.sha256(val).then(function (hex) {
          if (hashes.indexOf(hex) >= 0) {
            self.flag(flagName);
            if (opts.okText) say(opts.okText);
            if (opts.goto) {
              setTimeout(function () { location.href = opts.goto; }, 600);
            } else if (opts.onOk) {
              opts.onOk();
            }
          } else {
            wrong++;
            var hint = opts.hints && opts.hints[wrong];
            say(hint ? hint : denyText);
            input.value = '';
            input.focus();
          }
        }).catch(function (e) {
          say(e.message || '校验出错');
        });
      }

      button.addEventListener('click', check);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') check();
      });
    },

    /* ---------- 3. 加密工具与 URL 参数 ---------- */

    /* 凯撒位移（仅字母，保留大小写，支持负数位移） */
    caesar: function (str, shift) {
      return String(str).replace(/[a-zA-Z]/g, function (c) {
        var base = c >= 'a' && c <= 'z' ? 97 : 65;
        var code = c.charCodeAt(0) - base;
        return String.fromCharCode(((code + shift) % 26 + 26) % 26 + base);
      });
    },

    /* Base64 编码（Unicode 安全） */
    b64encode: function (str) {
      return btoa(encodeURIComponent(String(str)).replace(/%([0-9A-F]{2})/g,
        function (m, p) { return String.fromCharCode(parseInt(p, 16)); }));
    },

    /* Base64 解码（Unicode 安全） */
    b64decode: function (str) {
      return decodeURIComponent(Array.prototype.map.call(atob(String(str)), function (c) {
        return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    },

    /* 文本转摩斯码字符串（字母间单空格，单词间 ' / '） */
    morseText: function (str) {
      var words = String(str).toUpperCase().split(/\s+/);
      var out = [];
      for (var w = 0; w < words.length; w++) {
        var codes = [];
        for (var i = 0; i < words[w].length; i++) {
          var code = MORSE_TABLE[words[w][i]];
          if (code) codes.push(code);
        }
        if (codes.length) out.push(codes.join(' '));
      }
      return out.join(' / ');
    },

    /* 读取当前 URL 查询参数值（如 EP.param('from')） */
    param: function (name) {
      return new URLSearchParams(location.search).get(name);
    },

    /* ---------- 4. 氛围与触发组件 ---------- */

    /* 全屏噪点雪花屏（低分辨率画布放大铺满，逐帧随机噪点）
       intensity: 0~1，控制噪点密度与透明度，默认 0.5
       返回停止函数：调用后停止并移除画布 */
    snow: function (intensity) {
      intensity = (typeof intensity === 'number') ? intensity : 0.5;
      var cv = document.createElement('canvas');
      cv.className = 'snow';
      cv.style.opacity = String(0.15 + intensity * 0.5);
      var W = 220, H = 140;
      cv.width = W; cv.height = H;
      document.body.insertBefore(cv, document.body.firstChild);
      var ctx = cv.getContext('2d');
      var img = ctx.createImageData(W, H);
      var running = true;

      function frame() {
        if (!running) return;
        var d = img.data;
        var n = Math.floor(d.length / 4 * (0.3 + intensity * 0.7));
        d.fill(0);
        for (var i = 0; i < n; i++) {
          var p = Math.floor(Math.random() * (d.length / 4)) * 4;
          var v = Math.random() * 255;
          d[p] = d[p + 1] = d[p + 2] = v;
          d[p + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        requestAnimationFrame(frame);
      }
      frame();

      return function () {
        running = false;
        cv.remove();
      };
    },

    /* jumpscare：全屏黑层 + 惊吓内容 + FM.sting 音效
       opts = { duration: 毫秒（默认1200）, html: 层内 HTML, onDone: 结束回调 }
       注意：声音需用户手势激活 AudioContext 后才有效，
             请先让用户点击过"开启声音"或任何按钮 */
    scare: function (opts) {
      opts = opts || {};
      var duration = opts.duration || 1200;
      var overlay = document.createElement('div');
      overlay.className = 'scare-overlay';
      overlay.innerHTML = opts.html ||
        '<svg viewBox="0 0 100 100">' +
        '<ellipse cx="50" cy="45" rx="26" ry="34" fill="#e8e2d4"/>' +
        '<ellipse cx="40" cy="38" rx="5" ry="8" fill="#000"/>' +
        '<ellipse cx="60" cy="38" rx="5" ry="8" fill="#000"/>' +
        '<ellipse cx="50" cy="66" rx="8" ry="14" fill="#000"/>' +
        '</svg>';
      document.body.appendChild(overlay);
      try { FM.sting(); } catch (e) {}
      setTimeout(function () {
        overlay.remove();
        if (opts.onDone) opts.onDone();
      }, duration);
    },

    /* 给元素加/去故障效果（el 为选择器或元素，on 默认 true） */
    glitchEl: function (el, on) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return;
      if (on === false) el.classList.remove('glitch');
      else el.classList.add('glitch');
    },

    /* 玩家静止 sec 秒后触发 cb（once 默认 true，只触发一次） */
    idle: function (sec, cb, once) {
      if (once === undefined) once = true;
      var timer = null;
      function reset() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          cb();
          if (!once) reset();
        }, sec * 1000);
      }
      ['mousemove', 'keydown', 'click'].forEach(function (ev) {
        window.addEventListener(ev, reset);
      });
      reset();
    },

    /* 真实时间触发：当前小时数等于 hour 时执行 cb
       页面加载时检查一次，之后每 60 秒再检查（once 默认 true）
       用途示例：凌晨 3 点访问时出现隐藏内容 */
    atTime: function (hour, cb, once) {
      if (once === undefined) once = true;
      var fired = false;
      function check() {
        if (once && fired) return;
        if (new Date().getHours() === hour) {
          fired = true;
          cb();
        }
      }
      check();
      return setInterval(check, 60000);
    },

    /* 浏览器控制台线索（提示玩家"按 F12"后再看控制台） */
    consoleHint: function (msg, style) {
      console.log('%c' + msg, style || 'color:#a33;font-size:14px;');
    },

    /* 标签页标题在 titles 数组间循环切换
       interval 默认 800 毫秒；返回停止函数（停止时恢复原标题）
       可用于标题闪烁藏线索，或按摩斯节奏切换标题 */
    titleBlink: function (titles, interval) {
      interval = interval || 800;
      var original = document.title;
      var i = 0;
      var timer = setInterval(function () {
        document.title = titles[i % titles.length];
        i++;
      }, interval);
      return function () {
        clearInterval(timer);
        document.title = original;
      };
    }
  };

  window.EP = EP;
})();
