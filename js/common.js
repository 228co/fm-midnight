/* ============================================================
   FM-MIDNIGHT 共享脚本
   功能：进度存档 / 调试后门 / Web Audio 音效引擎 / 访问追踪
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'fm_midnight_save_v1';

  var FM = {
    /* ?debug=1 调试后门：跳过所有流程门禁 */
    debug: new URLSearchParams(location.search).has('debug'),

    /* ---------- 存档 ---------- */
    load: function () {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
      catch (e) { return {}; }
    },
    save: function (patch) {
      var data = Object.assign(this.load(), patch);
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    },
    flag: function (name) { var p = {}; p[name] = true; this.save(p); },
    has: function (name) { return !!this.load()[name]; },

    /* 流程门禁：未达成条件则踢回指定页面 */
    require: function (flagName, redirectTo) {
      if (this.debug) return;
      if (!this.has(flagName)) location.replace(redirectTo);
    },

    /* ---------- 访问追踪（终页元恐怖数据） ---------- */
    track: function () {
      var d = this.load();
      var now = Date.now();
      this.save({
        visits: (d.visits || 0) + 1,
        firstVisit: d.firstVisit || now,
        sessionStart: now,
        totalStay: d.totalStay || 0
      });
      var self = this;
      window.addEventListener('beforeunload', function () {
        var cur = self.load();
        self.save({ totalStay: (cur.totalStay || 0) + (Date.now() - (cur.sessionStart || Date.now())) });
      });
    },

    /* ---------- Web Audio 音效引擎 ---------- */
    _ac: null,
    ac: function () {
      if (!this._ac) {
        var AC = window.AudioContext || window.webkitAudioContext;
        this._ac = new AC();
      }
      if (this._ac.state === 'suspended') this._ac.resume();
      return this._ac;
    },

    _noise: function (sec) {
      var ac = this.ac();
      var buf = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate);
      var ch = buf.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      return buf;
    },

    /* 静电噪音 */
    static: function (dur, vol) {
      dur = dur || 1.5; vol = vol || 0.15;
      var ac = this.ac();
      var src = ac.createBufferSource();
      src.buffer = this._noise(dur);
      var g = ac.createGain();
      g.gain.value = vol;
      src.connect(g); g.connect(ac.destination);
      src.start();
      return src;
    },

    /* 环境低鸣（返回停止函数） */
    hum: function (vol) {
      vol = vol || 0.05;
      var ac = this.ac();
      var osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      var lfo = ac.createOscillator();
      lfo.frequency.value = 0.13;
      var lfoG = ac.createGain();
      lfoG.gain.value = vol * 0.5;
      var g = ac.createGain();
      g.gain.value = vol;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); lfo.start();
      return function () { try { osc.stop(); lfo.stop(); } catch (e) {} };
    },

    /* 摩斯电码蜂鸣，返回总时长(ms) */
    morse: function (text) {
      var TABLE = {
        A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
        H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
        O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
        V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
      };
      var ac = this.ac();
      var unit = 0.24; // 放慢，便于听辨
      var osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 720;
      var g = ac.createGain();
      g.gain.value = 0;
      osc.connect(g); g.connect(ac.destination);
      osc.start();
      var t = ac.currentTime + 0.4;
      var upper = text.toUpperCase();
      for (var i = 0; i < upper.length; i++) {
        var c = upper[i];
        if (c === ' ') { t += unit * 7; continue; }
        var code = TABLE[c];
        if (!code) continue;
        for (var j = 0; j < code.length; j++) {
          var d = code[j] === '.' ? unit : unit * 3;
          g.gain.setValueAtTime(0.22, t);
          g.gain.setValueAtTime(0, t + d);
          t += d + unit;
        }
        t += unit * 3;
      }
      osc.stop(t);
      return (t - ac.currentTime) * 1000;
    },

    /* 突发惊吓音（不和谐音簇 + 噪声爆点） */
    sting: function () {
      var ac = this.ac();
      var now = ac.currentTime;
      var freqs = [110, 116.5, 220, 233, 466];
      freqs.forEach(function (f) {
        var o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, now);
        o.frequency.linearRampToValueAtTime(f * 3.1, now + 0.85);
        var g = ac.createGain();
        g.gain.setValueAtTime(0.26, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        o.connect(g); g.connect(ac.destination);
        o.start(now); o.stop(now + 1.3);
      });
      var n = ac.createBufferSource();
      n.buffer = this._noise(1.2);
      var ng = ac.createGain();
      ng.gain.setValueAtTime(0.5, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      n.connect(ng); ng.connect(ac.destination);
      n.start(now);
    },

    /* 声音激活按钮（浏览器要求用户手势后才能出声） */
    enableSoundUI: function (label) {
      var btn = document.createElement('button');
      btn.className = 'sound-btn';
      btn.textContent = '[ 开启声音 ]';
      if (label) btn.textContent = label;
      var self = this;
      btn.addEventListener('click', function () {
        self.ac();
        self.static(0.25, 0.06);
        btn.remove();
        if (self.onSoundEnabled) self.onSoundEnabled();
      });
      document.body.appendChild(btn);
      return btn;
    }
  };

  FM.track();
  window.FM = FM;
})();
