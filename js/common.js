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

    /* 人声呢喃片段：带语调起伏的含糊"念信声"，听不清字 */
    mumble: function (dur, vol) {
      dur = dur || 0.8; vol = vol || 0.15;
      var ac = this.ac();
      var now = ac.currentTime;
      var src = ac.createBufferSource();
      src.buffer = this._noise(dur + 0.1);
      // 共振峰扫频 = 语调的抑扬
      var bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3;
      bp.frequency.setValueAtTime(380, now);
      bp.frequency.linearRampToValueAtTime(840, now + dur * 0.3);
      bp.frequency.linearRampToValueAtTime(500, now + dur * 0.58);
      bp.frequency.linearRampToValueAtTime(920, now + dur * 0.82);
      bp.frequency.linearRampToValueAtTime(600, now + dur);
      // 振幅做出"音节"感：几个小顿挫，像一句话
      var g = ac.createGain();
      g.gain.setValueAtTime(0, now);
      var syl = [0.02, 0.16, 0.28, 0.46, 0.6, 0.78, 0.94];
      syl.forEach(function (p, i) {
        g.gain.linearRampToValueAtTime(i % 2 === 0 ? vol : vol * 0.22, now + dur * p);
      });
      g.gain.linearRampToValueAtTime(0, now + dur);
      src.connect(bp); bp.connect(g); g.connect(ac.destination);
      src.start(now); src.stop(now + dur + 0.05);
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

    /* 循环静电底噪：缓慢起伏、低闷，返回可调音量的句柄 {setVol, stop} */
    staticLoop: function (vol) {
      vol = (vol === undefined) ? 0.12 : vol;
      var ac = this.ac();
      var src = ac.createBufferSource();
      src.buffer = this._noise(2);
      src.loop = true;
      // 大幅压低高频，底噪更"闷"更慢，像隔着墙的老收音机
      var filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      var g = ac.createGain();
      g.gain.value = vol;
      // 极慢的呼吸起伏（约 13 秒一个周期），让底噪"慢"下来
      var lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.077;
      var lfoG = ac.createGain();
      lfoG.gain.value = vol * 0.45;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      src.connect(filter); filter.connect(g); g.connect(ac.destination);
      src.start(); lfo.start();
      return {
        setVol: function (v) {
          g.gain.setTargetAtTime(Math.max(0, v), ac.currentTime, 0.05);
        },
        stop: function () { try { src.stop(); lfo.stop(); } catch (e) {} }
      };
    },

    /* 无具体语义的电波低语：含糊人声的呢喃，持续返回 {setVol, stop} */
    whisper: function () {
      var ac = this.ac();
      var out = ac.createGain();
      out.gain.value = 0;
      out.connect(ac.destination);

      // 用数个缓慢扫频的带通滤波噪声叠加，模拟"隔着电波的人声咕哝"
      var noiseBuf = this._noise(2);
      var nodes = [];
      var formants = [300, 750, 1400]; // 人声共振峰大致区域
      formants.forEach(function (f0, idx) {
        var src = ac.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        var bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f0;
        bp.Q.value = 6;
        var g = ac.createGain();
        g.gain.value = idx === 0 ? 0.5 : 0.28;
        // 缓慢 LFO 让共振峰上下游移，产生"含糊说话"的流动感
        var lfo = ac.createOscillator();
        lfo.frequency.value = 1.6 + idx * 0.9;
        var lfoG = ac.createGain();
        lfoG.gain.value = f0 * 0.35;
        lfo.connect(lfoG); lfoG.connect(bp.frequency);
        // 振幅也轻微抖动，模拟气息断续
        var alfo = ac.createOscillator();
        alfo.frequency.value = 3.1 + idx * 1.3;
        var alfoG = ac.createGain();
        alfoG.gain.value = g.gain.value * 0.6;
        alfo.connect(alfoG); alfoG.connect(g.gain);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(); lfo.start(); alfo.start();
        nodes.push(src, lfo, alfo);
      });

      return {
        setVol: function (v) {
          out.gain.setTargetAtTime(Math.max(0, v), ac.currentTime, 0.08);
        },
        stop: function () {
          nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
        }
      };
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
    },

    /* ---------- 深夜站全域背景底噪 ----------
       仅黑站页面（episodes/、home.html、archive.html）生效。
       浏览器要求用户手势后才能出声：首次点击/按键时启动，
       音量压得很低，像收音机没调准台的雪花底噪。 */
    _bgStarted: false,
    bgStatic: function (vol) {
      if (this._bgStarted) return;
      this._bgStarted = true;
      var self = this;
      var start = function () {
        self.bgHandle = self.staticLoop(vol || 0.05);
        window.removeEventListener('pointerdown', start);
        window.removeEventListener('keydown', start);
        window.removeEventListener('touchstart', start);
      };
      window.addEventListener('pointerdown', start);
      window.addEventListener('keydown', start);
      window.addEventListener('touchstart', start);
    }
  };

  FM.track();
  window.FM = FM;

  /* 黑站页面自动挂背景底噪（压到极低，若有似无） */
  if (/episodes\/|home\.html|archive\.html/.test(location.pathname)) {
    FM.bgStatic(0.015);
  }
})();
