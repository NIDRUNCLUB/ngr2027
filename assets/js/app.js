/* NID RUN CLUB × 2027 國家地理路跑 團報頁
 * 所有可調整的內容都在 config.js，這個檔案只放畫面與報名邏輯。 */
(function () {
  'use strict';

  var C = window.NGR_CONFIG;
  var COUNTRIES = window.NGR_COUNTRIES || ['TWN-Taiwan'];
  var OTHER = '__other__';
  var RECEIVE_LAST5 = String(C.bank.account).replace(/\D/g, '').slice(-5);
  /* --c = 填色（色帶、圓點），--ct = 白底上的文字色 */
  var DIST_VAR = { '21K': '--c:var(--k21);--ct:var(--k21-t)', '10K': '--c:var(--k10);--ct:var(--k10-t)', '5K': '--c:var(--k5);--ct:var(--k5-t)' };
  var DIST_MOD = { '21K': '21', '10K': '10', '5K': '5' };
  var DIST_FACTS = {
    '21K': '起跑 <b>凱達格蘭大道 05:30</b><br>限時 <b>210 分鐘</b><br>須滿 16 歲（2011 年以前出生）',
    '10K': '起跑 <b>凱達格蘭大道</b><br>挑戰組 05:50・慢跑組 06:00<br>限時 <b>100 分鐘</b>',
    '5K': '起跑 <b>大佳河濱公園</b><br>休閒組 08:00・親子組 08:10<br>限時 <b>90 分鐘</b>・不計時'
  };
  var DIST_PICK = {
    '21K': '05:30 起跑・限時 210 分・須滿 16 歲',
    '10K': '挑戰 05:50／慢跑 06:00・限時 100 分',
    '5K': '休閒 08:00／親子 08:10・限時 90 分'
  };

  var catByKey = {};
  C.categories.forEach(function (c) { catByKey[c.key] = c; });

  var state = {
    agreedAt: null,
    formOpenedAt: 0,
    submitting: false,
    tried: false,
    touched: {},
    lastOpener: null
  };

  /* ---------- helpers */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function money(n) { return 'NT$' + Number(n || 0).toLocaleString('en-US'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function radioVal(name) { var el = $('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  /* ---------- config text */
  function applyConfigText() {
    var map = {
      shipStudent: money(C.shipping.student),
      shipChild: money(shipFor('child')),
      shipGuest: money(C.shipping.guest),
      chip: money(C.chipDeposit),
      chipShort: '晶片押金 ' + C.chipDeposit,
      shipShort: '運費 ' + C.shipping.student + ' / ' + C.shipping.guest,
      contact: C.contact
    };
    $$('[data-cfg]').forEach(function (el) {
      var k = el.getAttribute('data-cfg');
      if (map[k] != null) el.textContent = map[k];
    });
    if (!(C.chipDeposit > 0)) $$('[data-needs-chip]').forEach(function (el) { el.hidden = true; });
    var bank = {
      bankCode: C.bank.bankCode, bankName: C.bank.bankName, branch: C.bank.branch,
      account: C.bank.account, name: C.bank.name
    };
    $$('[data-bank]').forEach(function (el) {
      var k = el.getAttribute('data-bank');
      if (bank[k] != null) el.textContent = bank[k];
    });
    $$('.js-official-rules').forEach(function (a) { a.href = C.officialRulesUrl; });
    var off = $('#officialLink'); if (off) off.href = C.officialUrl;

  }

  /* ---------- 團報時間：開放前鎖住按鈕，截止時間一到自動關閉 */
  var OPEN_AT = C.openAt ? new Date(C.openAt) : null;
  var CLOSE_AT = C.deadline ? new Date(C.deadline) : null;
  var TEST_MODE = /(^|[#&])test(&|$)/.test(location.hash);
  // 在已經打開的頁面網址後面加 #test，瀏覽器不會重新載入；這裡自動重新整理，讓測試模式馬上生效
  window.addEventListener('hashchange', function () {
    if (!TEST_MODE && /(^|[#&])test(&|$)/.test(location.hash)) location.reload();
  });
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var GATE_DEFAULT = null;
  var currentPhase = null;

  /* 一律用台灣時間顯示，不受手機時區影響 */
  function twParts(d) {
    var t = new Date(d.getTime() + 8 * 3600 * 1000);
    return { m: pad(t.getUTCMonth() + 1), d: pad(t.getUTCDate()), w: WEEK[t.getUTCDay()], hh: pad(t.getUTCHours()), mi: pad(t.getUTCMinutes()) };
  }
  function fmtTW(d) { var p = twParts(d); return p.m + '/' + p.d + '（' + p.w + '）' + p.hh + ':' + p.mi; }
  function fmtShort(d) { var p = twParts(d); return p.m + '/' + p.d; }
  function isBeforeOpen() { return !!OPEN_AT && Date.now() < OPEN_AT.getTime(); }

  function phaseNow() {
    if (CLOSE_AT && Date.now() > CLOSE_AT.getTime()) return 'closed';
    if (isBeforeOpen() && !TEST_MODE) return 'before';
    return 'open';
  }
  function remainText(ms) {
    var m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
    if (d > 0) return d + ' 天 ' + h + ' 小時';
    if (h > 0) return h + ' 小時 ' + mi + ' 分';
    return Math.max(1, mi) + ' 分鐘';
  }

  function renderPeriod() {
    var now = Date.now(), ph = phaseNow(), st = $('#phaseText');
    $('#periodText').textContent = OPEN_AT && CLOSE_AT ? fmtTW(OPEN_AT) + ' – ' + fmtTW(CLOSE_AT)
      : CLOSE_AT ? '即日起 – ' + fmtTW(CLOSE_AT) : '待公告';
    st.setAttribute('data-phase', ph);
    if (ph === 'before') st.textContent = '尚未開放・' + remainText(OPEN_AT.getTime() - now) + '後開始';
    else if (ph === 'closed') st.textContent = '已截止';
    else st.textContent = CLOSE_AT ? '報名中・剩 ' + remainText(CLOSE_AT.getTime() - now) : '報名中';
    $('#testBar').hidden = !(TEST_MODE && isBeforeOpen());
    if (ph !== currentPhase) { currentPhase = ph; applyPhase(ph); }
  }

  function applyPhase(ph) {
    if (!GATE_DEFAULT) GATE_DEFAULT = { t: $('#gateTitle').textContent, p: $('#gateText').textContent };
    $$('.js-open-terms').forEach(function (b) {
      if (!b.hasAttribute('data-label')) b.setAttribute('data-label', b.innerHTML);
      var small = b.classList.contains('btn--sm');
      b.disabled = ph !== 'open';
      if (ph === 'before') b.textContent = fmtShort(OPEN_AT) + (small ? ' 開放' : ' 00:00 開放報名');
      else if (ph === 'closed') b.textContent = small ? '已截止' : '團報已截止';
      else b.innerHTML = b.getAttribute('data-label');
    });
    if (ph === 'before') {
      $('#gateTitle').textContent = '團報 ' + fmtShort(OPEN_AT) + ' 開放';
      $('#gateText').textContent = '團報時間 ' + fmtTW(OPEN_AT) + ' 到 ' + fmtTW(CLOSE_AT) + '。開放後就能閱讀參賽聲明、填寫報名表，先看看組別、路線和紀念品吧。';
    } else if (ph === 'closed') {
      $('#gateTitle').textContent = '團報已截止';
      $('#gateText').textContent = '本次團報已在 ' + fmtTW(CLOSE_AT) + ' 截止收件，謝謝大家。如有問題請洽' + C.contact + '。';
      $$('.modal').forEach(function (m) { if (!m.hidden) closeModal(m); });
      if ($('#doneArea').hidden) {
        $('#formArea').hidden = true;
        $('#gate').hidden = false;
      }
      setTotalBar(false);
    } else {
      $('#gateTitle').textContent = GATE_DEFAULT.t;
      $('#gateText').textContent = GATE_DEFAULT.p;
    }
  }

  /* ---------- categories, bibs, fee table */
  function groupByDist() {
    var order = ['21K', '10K', '5K'], groups = {};
    C.categories.forEach(function (c) { (groups[c.dist] = groups[c.dist] || []).push(c); });
    return order.filter(function (d) { return groups[d]; }).map(function (d) { return { dist: d, items: groups[d] }; });
  }

  function renderBibs() {
    var html = groupByDist().map(function (g) {
      var bibs = g.items.map(function (c) {
        var chips = ['<span class="chip">' + c.start + ' 起跑</span>'];
        chips.push('<span class="chip">' + (c.chip ? '晶片計時' : '不計時') + '</span>');
        if (c.chip) chips.push('<span class="chip">' + (c.ranked ? '列入名次' : '不列名次') + '</span>');
        if (c.bag) chips.push('<span class="chip chip--hl">含衣保袋</span>');
        if (c.family) chips.push('<span class="chip chip--hl">家長與孩童皆須報名</span>');
        return '<article class="bib">' +
          '<div class="bib__band"><b>' + c.dist + '</b></div>' +
          '<h3 class="bib__name">' + esc(c.name) + '</h3>' +
          '<p class="bib__price"><small>NT$</small>' + c.price.toLocaleString('en-US') + '</p>' +
          '<div class="bib__chips">' + chips.join('') + '</div>' +
          '</article>';
      }).join('');
      return '<div class="dist dist--' + DIST_MOD[g.dist] + '">' +
        '<div class="dist__label"><span class="dist__km">' + g.dist + '</span><p class="dist__facts">' + DIST_FACTS[g.dist] + '</p></div>' +
        '<div class="bibs">' + bibs + '</div></div>';
    }).join('');
    $('#distGroups').innerHTML = html;
  }

  function renderFeeTable() {
    var showChip = C.chipDeposit > 0;
    var head = '<tr><th scope="col">組別</th><th scope="col" class="col-detail">報名費</th>' + (showChip ? '<th scope="col" class="col-detail">晶片押金</th>' : '') +
      '<th scope="col">當期學員／小孩應匯</th><th scope="col">非當期學員應匯</th></tr>';
    $('#feeTable thead').innerHTML = head;
    $('#feeTable tbody').innerHTML = C.categories.map(function (c) {
      var chip = c.chip ? C.chipDeposit : 0;
      var base = c.price + chip;
      return '<tr><td><span class="dot" style="' + DIST_VAR[c.dist] + '"></span><span class="fee-cat"><b>' + c.dist + '</b> ' + esc(c.name) + '</span></td>' +
        '<td class="col-detail">' + money(c.price) + '</td>' +
        (showChip ? '<td class="col-detail">' + (chip ? money(chip) : '—') + '</td>' : '') +
        '<td class="total st">' + money(base + C.shipping.student) + '</td>' +
        '<td class="total">' + money(base + C.shipping.guest) + '</td></tr>';
    }).join('');
  }

  /* ---------- form options */
  function fillSelect(sel, placeholder, opts) {
    sel.innerHTML = '<option value="">' + esc(placeholder) + '</option>' + opts;
  }
  function optionList(arr) { return arr.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join(''); }
  function classOptions() {
    return C.classes.map(function (g) {
      return '<optgroup label="' + esc(g.group) + '">' + optionList(g.items) + '</optgroup>';
    }).join('') + '<option value="' + OTHER + '">其他（自行填寫）</option>';
  }

  function renderFormOptions() {
    fillSelect($('#f-class'), '選擇你的班級', classOptions());
    fillSelect($('#f-ref-class'), '選擇朋友的班級', classOptions());
    fillSelect($('#f-parent-class'), '選擇爸爸或媽媽的班級', classOptions());
    fillSelect($('#f-size'), '選擇尺寸', optionList(C.sizes));
    $('#f-nat').innerHTML = optionList(COUNTRIES);
    $('#f-nat').value = 'TWN-Taiwan';

    var thisYear = new Date().getFullYear(), years = [];
    for (var y = thisYear; y >= 1930; y--) years.push('<option value="' + y + '">' + y + '</option>');
    fillSelect($('#f-birth-y'), '年', years.join(''));
    var months = [];
    for (var m = 1; m <= 12; m++) months.push('<option value="' + m + '">' + m + ' 月</option>');
    fillSelect($('#f-birth-m'), '月', months.join(''));
    renderDays();
    $('#f-paydate').max = todayISO();

    $('#catPick').innerHTML = groupByDist().map(function (g) {
      return '<div class="cat-pick__dist" style="' + DIST_VAR[g.dist] + '">' +
        '<p class="cat-pick__title"><b>' + g.dist + '</b>' + DIST_PICK[g.dist] + '</p>' +
        '<div class="cat-pick__grid">' + g.items.map(function (c) {
          var sub = [];
          if (c.chip) sub.push('含晶片押金 ' + C.chipDeposit);
          if (c.bag) sub.push('含衣保袋');
          if (c.family) sub.push('家長與 12 歲以下孩童');
          if (!c.chip && !c.family) sub.push('不計時・不寄物');
          return '<label class="choice cat-opt"><input type="radio" name="category" id="f-cat-' + c.key + '" value="' + c.key + '">' +
            '<span class="choice__body"><span class="nm"><b>' + esc(c.name) + '</b><small>' + esc(sub.join('・')) + '</small>' +
            (c.family ? '<small class="cat-note">家長與孩童皆須報名</small>' : '') +
            (c.maxBirthYear ? '<small class="cat-lock">' + c.maxBirthYear + ' 年以前出生才能報</small>' : '') + '</span>' +
            '<span class="pr">' + money(c.price) + '</span></span></label>';
        }).join('') + '</div></div>';
    }).join('');

    renderAddons();
  }

  function renderDays() {
    var y = parseInt(val('f-birth-y'), 10), m = parseInt(val('f-birth-m'), 10);
    var max = (y && m) ? new Date(y, m, 0).getDate() : 31;
    var sel = $('#f-birth-d'), cur = parseInt(sel.value, 10);
    var days = [];
    for (var d = 1; d <= max; d++) days.push('<option value="' + d + '">' + d + ' 日</option>');
    fillSelect(sel, '日', days.join(''));
    if (cur && cur <= max) sel.value = String(cur);
  }

  /* ---------- add-ons */
  var addonQty = { bag: 0, tee: 0, towel: 0 };
  var ADDON_IMG = { bag: 'assets/img/addon-bag.webp', tee: 'assets/img/addon-tee.webp', towel: 'assets/img/addon-towel.webp' };
  var ADDON_NOTE = {
    bag: '寄物用，規格同升級組衣保袋',
    tee: '一般款或親子組石虎款，可選尺寸',
    towel: '和完賽毛巾同款'
  };

  function renderAddons() {
    var box = $('#addonList'), step = $('#step-4');
    if (!C.addons || !C.addons.enabled) { step.hidden = true; return; }
    box.innerHTML = ['bag', 'tee', 'towel'].map(function (k) {
      var a = C.addons[k];
      var extra = k === 'tee'
        ? '<div class="addon__opts" id="teeOpts" hidden>' +
          '<select class="select" id="f-tee-style" name="teeStyle" aria-label="加購紀念衫款式"><option value="">選擇款式</option><option value="一般組">一般款</option><option value="親子組">親子組款（石虎）</option></select>' +
          '<select class="select" id="f-tee-size" name="teeSize" aria-label="加購紀念衫尺寸"><option value="">選擇尺寸</option>' + optionList(C.sizes) + '</select></div>'
        : '';
      return '<div class="addon field" data-field="addon-' + k + '">' +
        '<img src="' + ADDON_IMG[k] + '" alt="" width="267" height="160" loading="lazy">' +
        '<div class="addon__main">' +
        '<span class="addon__name"><b>' + esc(a.name) + '　' + money(a.price) + '</b><span>' + esc(ADDON_NOTE[k]) + '</span></span>' +
        '<span class="stepper" role="group" aria-label="' + esc(a.name) + ' 數量">' +
        '<button type="button" data-addon="' + k + '" data-step="-1" aria-label="減少">−</button>' +
        '<output id="q-' + k + '" aria-live="polite">0</output>' +
        '<button type="button" data-addon="' + k + '" data-step="1" aria-label="增加">+</button></span>' +
        extra + '</div></div>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-addon]');
      if (!b) return;
      var k = b.getAttribute('data-addon');
      var n = addonQty[k] + parseInt(b.getAttribute('data-step'), 10);
      addonQty[k] = Math.max(0, Math.min(C.addons[k].max, n));
      $('#q-' + k).textContent = addonQty[k];
      if (k === 'tee') $('#teeOpts').hidden = addonQty.tee === 0;
      refresh();
    });
  }

  /* ---------- conditional fields */
  function fieldValue(name) {
    var r = $('input[name="' + name + '"]:checked');
    if (r) return r.value;
    var el = document.querySelector('[name="' + name + '"]');
    return el && el.type !== 'radio' ? el.value : '';
  }

  function birthParts() {
    var y = parseInt(val('f-birth-y'), 10), m = parseInt(val('f-birth-m'), 10), d = parseInt(val('f-birth-d'), 10);
    return (y && m && d) ? { y: y, m: m, d: d } : null;
  }
  function ageOnRaceDay(b) {
    var r = C.raceDate.split('-').map(Number);
    var age = r[0] - b.y;
    if (r[1] < b.m || (r[1] === b.m && r[2] < b.d)) age--;
    return age;
  }
  function isMinor() { var b = birthParts(); return !!b && ageOnRaceDay(b) < 18; }

  function updateConditionals() {
    $$('[data-when]').forEach(function (el) {
      var p = el.getAttribute('data-when').split('=');
      el.hidden = fieldValue(p[0]) !== p[1];
    });
    $('#f-class-other').hidden = val('f-class') !== OTHER;
    $('#f-ref-class-other').hidden = val('f-ref-class') !== OTHER;
    $('#f-parent-class-other').hidden = val('f-parent-class') !== OTHER;
    $('#guardianBlock').hidden = !isMinor();

    // 21K 有年齡下限（大會：半馬須滿 16 歲）：選了出生年，太小就把 21K 鎖起來
    var birthY = parseInt(val('f-birth-y'), 10) || 0;
    C.categories.forEach(function (c) {
      var el = c.maxBirthYear && document.getElementById('f-cat-' + c.key);
      if (!el) return;
      el.disabled = birthY > c.maxBirthYear;
      el.closest('.choice').classList.toggle('is-locked', el.disabled);
    });

    var cat = catByKey[radioVal('category')];
    $('#lbl-size').innerHTML = (cat && cat.family ? '親子組紀念衫（石虎款）尺寸' : '紀念衫尺寸') + '<span class="req">*</span>';

    var isTW = val('f-nat') === 'TWN-Taiwan';
    $('#lbl-id').innerHTML = (isTW ? '身分證字號' : '居留證或護照號碼') + '<span class="req">*</span>';
    $('#idHelp').textContent = isTW ? '外籍人士請把國籍改成你的國家，再填居留證或護照號碼。' : '有居留證請填居留證號碼，沒有請填護照號碼。';
    $('#f-phone').placeholder = isTW ? '0912345678' : '+81 90 1234 5678';
  }

  /* ---------- 報名身分：當期學員／當期學員的小孩／非當期學員 */
  var MEMBER_LABEL = { student: '當期學員', child: '當期學員的小孩', guest: '非當期學員' };
  function shipFor(m) {
    if (m === 'student') return C.shipping.student;
    if (m === 'child') return C.shipping.child != null ? C.shipping.child : C.shipping.student;
    if (m === 'guest') return C.shipping.guest;
    return 0;
  }
  function whoText(v, short) {
    if (v.member === 'student') return '當期學員・' + v.className;
    if (v.member === 'child') return '當期學員的小孩・家長 ' + v.refName + '（' + v.refClass + '）';
    return '非當期學員・' + (short ? '朋友 ' : '當期學員朋友 ') + v.refName + '（' + v.refClass + '）';
  }

  /* ---------- fee */
  function calcFee() {
    var cat = catByKey[radioVal('category')];
    var member = radioVal('member');
    var lines = [];
    var entry = cat ? cat.price : 0;
    var chip = cat && cat.chip ? C.chipDeposit : 0;
    var ship = shipFor(member);
    lines.push(cat ? { k: '報名費・' + cat.label, v: entry } : { k: '報名費（請選組別）', v: null });
    if (cat && C.chipDeposit > 0) lines.push(cat.chip ? { k: '晶片押金（可退）', v: chip } : { k: '晶片押金（5K 免收）', v: 0, muted: true });
    lines.push(member ? { k: '運費・' + MEMBER_LABEL[member], v: ship } : { k: '運費（請選身分）', v: null });
    var addons = 0;
    if (C.addons && C.addons.enabled) {
      ['bag', 'tee', 'towel'].forEach(function (k) {
        if (addonQty[k] > 0) {
          var sub = addonQty[k] * C.addons[k].price;
          addons += sub;
          lines.push({ k: '加購・' + C.addons[k].name + ' × ' + addonQty[k], v: sub });
        }
      });
    }
    var ready = !!cat && !!member;
    return { lines: lines, entry: entry, chip: chip, ship: ship, addons: addons, total: entry + chip + ship + addons, ready: ready };
  }

  function renderFee() {
    var f = calcFee();
    var linesHTML = f.lines.map(function (l) {
      return '<li' + (l.muted || l.v === null ? ' class="muted"' : '') + '><span>' + esc(l.k) + '</span><span>' + (l.v === null ? '—' : money(l.v)) + '</span></li>';
    }).join('');
    $('#sumLines').innerHTML = linesHTML;
    $('#sumLinesInline').innerHTML = linesHTML;
    var t = f.ready ? money(f.total) : '—';
    $('#sumTotal').textContent = t;
    $('#payAmount').textContent = t;
    $('#tbTotal').textContent = t;
    return f;
  }

  /* ---------- validation */
  var LETTER = { A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33 };
  function twIdValid(id) {
    var m = /^([A-Z])([A-D1289])(\d{8})$/.exec(id);
    if (!m) return false;
    var n = LETTER[m[1]];
    var second = /\d/.test(m[2]) ? parseInt(m[2], 10) : LETTER[m[2]] % 10;
    var digits = [second].concat(m[3].split('').map(Number));
    var w = [8, 7, 6, 5, 4, 3, 2, 1];
    var sum = Math.floor(n / 10) + (n % 10) * 9;
    for (var i = 0; i < 8; i++) sum += digits[i] * w[i];
    sum += digits[8];
    return sum % 10 === 0;
  }
  function idGender(id) {
    var c = id.charAt(1);
    if (c === '1' || c === '8') return '男';
    if (c === '2' || c === '9') return '女';
    return '';
  }
  function cleanPhone(s) { return String(s || '').replace(/[\s\-()]/g, ''); }
  function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }

  function collect() {
    var b = birthParts();
    var cls = val('f-class') === OTHER ? val('f-class-other') : val('f-class');
    var ref = val('f-ref-class') === OTHER ? val('f-ref-class-other') : val('f-ref-class');
    var par = val('f-parent-class') === OTHER ? val('f-parent-class-other') : val('f-parent-class');
    var cat = catByKey[radioVal('category')];
    var mem = radioVal('member');
    return {
      member: mem,
      className: mem === 'student' ? cls : '',
      refName: mem === 'guest' ? val('f-ref-name') : mem === 'child' ? val('f-parent-name') : '',
      refClass: mem === 'guest' ? ref : mem === 'child' ? par : '',
      categoryKey: cat ? cat.key : '',
      category: cat ? cat.label : '',
      size: val('f-size'),
      name: val('f-name'),
      gender: radioVal('gender'),
      birth: b ? (b.y + '-' + pad(b.m) + '-' + pad(b.d)) : '',
      nationality: val('f-nat'),
      idno: val('f-id').toUpperCase().replace(/\s/g, ''),
      phone: cleanPhone(val('f-phone')),
      email: val('f-email'),
      ecName: val('f-ec-name'),
      ecPhone: cleanPhone(val('f-ec-phone')),
      ecRelation: val('f-ec-rel'),
      minor: isMinor(),
      gName: isMinor() ? val('f-g-name') : '',
      gId: isMinor() ? val('f-g-id').toUpperCase().replace(/\s/g, '') : '',
      gPhone: isMinor() ? cleanPhone(val('f-g-phone')) : '',
      addons: {
        bag: addonQty.bag,
        tee: addonQty.tee,
        teeStyle: addonQty.tee ? val('f-tee-style') : '',
        teeSize: addonQty.tee ? val('f-tee-size') : '',
        towel: addonQty.towel
      },
      last5: val('f-last5'),
      payDate: val('f-paydate'),
      note: val('f-note'),
      paid: $('#f-paid').checked
    };
  }

  function validate(v) {
    var e = {}, w = {};
    if (!v.member) e.member = '請選擇報名身分';
    if (v.member === 'student' && !v.className) e.className = val('f-class') === OTHER ? '請填寫你的班級名稱' : '請選擇你的班級';
    if (v.member === 'guest') {
      if (!v.refName) e.refName = '請填寫你的當期學員朋友姓名';
      else if (v.refName === v.name) e.refName = '請填另一位當期學員朋友，不能填自己';
      if (!v.refClass) e.refClass = val('f-ref-class') === OTHER ? '請填寫朋友的班級名稱' : '請選擇朋友的班級';
    }
    if (v.member === 'child') {
      if (!v.refName) e.parentName = '請填寫爸爸或媽媽的姓名';
      else if (v.refName === v.name) e.parentName = '請填爸爸或媽媽的姓名，不是小朋友自己的';
      if (!v.refClass) e.parentClass = val('f-parent-class') === OTHER ? '請填寫爸爸或媽媽的班級名稱' : '請選擇爸爸或媽媽的班級';
      var cb = birthParts();
      if (cb && ageOnRaceDay(cb) >= 18) e.member = '「當期學員的小孩」限比賽當天未滿 18 歲；已成年請改選「非當期學員」';
    }
    var cat = catByKey[v.categoryKey];
    if (!cat) e.category = '請選擇報名組別';
    if (!v.size) e.size = '請選擇紀念衫尺寸';
    if (!v.name) e.name = '請填寫姓名';
    else if (v.name.length < 2) e.name = '姓名至少 2 個字';
    if (!v.gender) e.gender = '請選擇性別';
    var b = birthParts();
    if (!b) e.birth = '請選完整的出生年月日';
    else {
      var bd = new Date(b.y, b.m - 1, b.d);
      if (bd > new Date()) e.birth = '出生日期不能在未來';
      else if (cat && cat.maxBirthYear && b.y > cat.maxBirthYear) {
        e.category = cat.dist + ' 須滿 ' + (Number(C.raceDate.slice(0, 4)) - cat.maxBirthYear) + ' 歲（' + cat.maxBirthYear + ' 年以前出生），請改選 10K 或 5K';
        e.birth = '這個生日不能報 ' + cat.dist + '，請到上面「報名組別」改選 10K 或 5K';
      }
    }
    if (!v.nationality) e.nationality = '請選擇國籍';
    var isTW = v.nationality === 'TWN-Taiwan';
    if (!v.idno) e.idno = isTW ? '請填寫身分證字號' : '請填寫居留證或護照號碼';
    else if (isTW && !twIdValid(v.idno)) e.idno = '身分證字號格式或檢查碼不正確，請再核對一次';
    else if (!isTW && !/^[A-Z0-9]{5,20}$/.test(v.idno)) e.idno = '號碼只能包含英文字母與數字';
    else if (isTW && v.gender && idGender(v.idno) && idGender(v.idno) !== v.gender) w.idno = '提醒：身分證第 2 碼和你選的性別不一致，請確認。';
    if (!v.phone) e.phone = '請填寫行動電話';
    else if (isTW && !/^09\d{8}$/.test(v.phone)) e.phone = '請填 09 開頭的 10 碼手機號碼';
    else if (!isTW && !/^\+?\d{7,15}$/.test(v.phone)) e.phone = '電話號碼格式不正確';
    if (!v.email) e.email = '請填寫 Email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = 'Email 格式不正確';
    if (!v.ecName) e.ecName = '請填寫緊急聯絡人';
    else if (v.ecName === v.name) e.ecName = '緊急聯絡人不能是自己';
    if (!v.ecPhone) e.ecPhone = '請填寫緊急聯絡人電話';
    else if (digitsOnly(v.ecPhone).length < 7) e.ecPhone = '電話號碼太短，請再確認';
    else if (v.phone && digitsOnly(v.ecPhone) === digitsOnly(v.phone)) e.ecPhone = '不能和你自己的手機相同';
    if (!v.ecRelation) e.ecRelation = '請填寫與緊急聯絡人的關係';
    if (v.minor) {
      if (!v.gName) e.gName = '請填寫監護人姓名';
      if (!v.gId) e.gId = '請填寫監護人身分證字號';
      else if (/^[A-Z][1289]/.test(v.gId) && !twIdValid(v.gId)) e.gId = '監護人身分證字號不正確';
      if (!v.gPhone) e.gPhone = '請填寫監護人電話';
      else if (digitsOnly(v.gPhone).length < 7) e.gPhone = '電話號碼太短，請再確認';
    }
    if (v.addons.tee > 0 && (!v.addons.teeStyle || !v.addons.teeSize)) e['addon-tee'] = '加購紀念衫請選款式與尺寸';
    if (!v.last5) e.last5 = '請填寫匯款帳號後五碼';
    else if (!/^\d{5}$/.test(v.last5)) e.last5 = '後五碼是 5 個數字';
    else if (v.last5 === RECEIVE_LAST5) e.last5 = RECEIVE_LAST5 + ' 是 NID 收款帳號的後五碼，請填「你自己匯出帳號」的後五碼';
    if (!v.payDate) e.payDate = '請選擇匯款日期';
    else if (v.payDate > todayISO()) e.payDate = '匯款日期不能在未來';
    if (!v.paid) e.paid = '請確認已完成匯款並勾選';
    return { errors: e, warnings: w };
  }

  function showErrors(result, all) {
    $$('[data-field]').forEach(function (f) {
      var k = f.getAttribute('data-field');
      var old = f.querySelectorAll('.err, .warn');
      for (var i = 0; i < old.length; i++) old[i].remove();
      f.classList.remove('is-invalid');
      var show = all || state.touched[k];
      if (show && result.errors[k] && !f.closest('[hidden]')) {
        f.classList.add('is-invalid');
        var p = document.createElement('p');
        p.className = 'err';
        p.textContent = result.errors[k];
        f.appendChild(p);
      } else if (show && result.warnings[k]) {
        var q = document.createElement('p');
        q.className = 'warn';
        q.textContent = result.warnings[k];
        f.appendChild(q);
      }
    });
  }

  /* ---------- refresh cycle */
  function refresh() {
    updateConditionals();
    renderFee();
    if (state.tried || Object.keys(state.touched).length) showErrors(validate(collect()), state.tried);
  }

  /* ---------- modals */
  function focusables(root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return !el.closest('[hidden]'); });
  }
  function openModal(m, opener) {
    state.lastOpener = opener || document.activeElement;
    m.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var f = focusables(m);
    setTimeout(function () {
      var t = m.querySelector('.modal__body[tabindex]') || f[0];
      if (t) t.focus({ preventScroll: true });
    }, 30);
  }
  function closeModal(m) {
    m.hidden = true;
    if (!$$('.modal').some(function (x) { return !x.hidden; })) document.documentElement.style.overflow = '';
    if (state.lastOpener && state.lastOpener.focus) state.lastOpener.focus({ preventScroll: true });
  }
  function wireModal(m, onDismiss) {
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(m); if (onDismiss) onDismiss(); }
    });
    m.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(m); if (onDismiss) onDismiss(); }
      if (e.key === 'Tab') {
        var f = focusables(m);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------- terms (參賽聲明) */
  function checkTermsRead() {
    var body = $('#termsBody');
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 28) {
      $('#btnAgree').disabled = false;
      $('#agreeHint').textContent = '按「同意」表示你已閱讀並同意大會簡章第十八、二十條與 NID 團報資料說明。';
    }
  }
  function openTerms(opener) {
    if (phaseNow() !== 'open') { renderPeriod(); return; }
    if (!$('#doneArea').hidden) { resetForAnother(); return; }
    if (state.agreedAt) { revealForm(false); return; }
    var m = $('#termsModal');
    $('#termsBody').scrollTop = 0;
    $('#btnAgree').disabled = true;
    $('#agreeHint').textContent = '請先閱讀到最下方，「同意」按鈕就會亮起。';
    openModal(m, opener);
    setTimeout(checkTermsRead, 60);
  }
  function revealForm(first) {
    $('#gate').hidden = true;
    $('#formArea').hidden = false;
    if (first) state.formOpenedAt = Date.now();
    var target = $('#signup');
    setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (first) { var r = $('#f-member-student'); if (r) r.focus({ preventScroll: true }); }
    }, 60);
    observeTotalBar();
  }

  /* ---------- review + submit */
  function reviewHTML(v, f) {
    var cat = catByKey[v.categoryKey];
    var rows = [];
    rows.push(['身分', whoText(v)]);
    rows.push(['組別', v.category]);
    rows.push([cat && cat.family ? '親子組紀念衫' : '紀念衫尺寸', v.size]);
    rows.push(['姓名', v.name + '・' + v.gender]);
    rows.push(['出生年月日', v.birth]);
    rows.push(['國籍／證號', v.nationality + '・' + v.idno]);
    rows.push(['行動電話', v.phone]);
    rows.push(['Email', v.email]);
    rows.push(['緊急聯絡人', v.ecName + '（' + v.ecRelation + '）' + v.ecPhone]);
    if (v.minor) rows.push(['監護人', v.gName + '・' + v.gId + '・' + v.gPhone]);
    var ad = [];
    if (v.addons.bag) ad.push('衣保袋 × ' + v.addons.bag);
    if (v.addons.tee) ad.push('紀念衫 × ' + v.addons.tee + '（' + v.addons.teeSize + '・' + (v.addons.teeStyle === '親子組' ? '石虎款' : '一般款') + '）');
    if (v.addons.towel) ad.push('毛巾 × ' + v.addons.towel);
    if (C.addons && C.addons.enabled) rows.push(['加購', ad.length ? ad.join('、') : '無']);
    rows.push(['匯款後五碼', v.last5 + '・' + v.payDate]);
    if (v.note) rows.push(['備註', v.note]);
    return '<dl>' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="big"><span>應匯金額</span><b>' + money(f.total) + '</b></div>';
  }

  function onSubmit(e) {
    e.preventDefault();
    state.tried = true;
    var v = collect();
    var result = validate(v);
    showErrors(result, true);
    var keys = Object.keys(result.errors);
    var box = $('#formError');
    if (keys.length) {
      box.textContent = '還有 ' + keys.length + ' 個地方需要修正，已用紅字標示。';
      box.hidden = false;
      var first = $('.field.is-invalid');
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var inp = first.querySelector('input, select, textarea');
        if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 350);
      }
      return;
    }
    box.hidden = true;
    var f = calcFee();
    $('#reviewBody').innerHTML = reviewHTML(v, f);
    openModal($('#reviewModal'), $('#submitBtn'));
  }

  function payload(v, f) {
    var data = JSON.parse(JSON.stringify(v));
    data.memberLabel = MEMBER_LABEL[v.member] || '';
    data.fee = { entry: f.entry, chip: f.chip, shipping: f.ship, addons: f.addons, total: f.total };
    data.agreedAt = state.agreedAt;
    data.submittedAt = new Date().toISOString();
    data.elapsedMs = state.formOpenedAt ? Date.now() - state.formOpenedAt : 0;
    data.website = val('f-website');
    data.test = TEST_MODE && isBeforeOpen();
    data.ua = navigator.userAgent.slice(0, 180);
    return data;
  }

  function confirmSubmit() {
    if (state.submitting) return;
    var v = collect(), f = calcFee();
    if (Object.keys(validate(v).errors).length) { closeModal($('#reviewModal')); return; }
    if (phaseNow() !== 'open') { renderPeriod(); return; }
    var btn = $('#btnConfirm');
    state.submitting = true;
    btn.disabled = true;
    btn.textContent = '送出中…';
    var body = payload(v, f);

    var done = function (res) {
      state.submitting = false;
      btn.disabled = false;
      btn.textContent = '確認送出';
      if (res && res.ok) {
        closeModal($('#reviewModal'));
        showDone(v, f, res);
      } else {
        closeModal($('#reviewModal'));
        var box = $('#formError');
        box.textContent = (res && res.message) || '送出失敗，請稍後再試一次。';
        box.hidden = false;
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (!C.endpoint) {
      setTimeout(function () { done({ ok: true, id: 'PREVIEW', preview: true }); }, 500);
      return;
    }
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    fetch(C.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok && res.code === 'DUPLICATE') res.message = '這個證件號碼已經報名過了。如需修改資料，請洽' + C.contact + '。';
        if (!res.ok && res.code === 'CLOSED') res.message = '團報已在 ' + (CLOSE_AT ? fmtTW(CLOSE_AT) : '截止時間') + ' 截止收件，這筆資料沒有送出。';
        if (!res.ok && res.code === 'NOT_OPEN') res.message = '團報還沒開放，' + (OPEN_AT ? fmtTW(OPEN_AT) : '開放時間') + ' 開始收件。';
        done(res);
      })
      .catch(function () {
        clearTimeout(timer);
        done({ ok: false, message: '網路連線失敗，資料沒有送出。請確認網路後再按一次「檢查資料並送出」；若一直失敗，請截圖並聯繫' + C.contact + '。' });
      });
  }

  /* ---------- 報名完成：頁面上的完成區＋跳出視窗（請學員截圖、傳給官方 LINE 小編） */
  function dayText(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : String(iso || '');
  }
  /* 開啟官方帳號聊天室並先打好訊息（LINE URL scheme：line.me/R/oaMessage/{LINE ID}/?{訊息}） */
  function lineLink(text) {
    var id = C.line && C.line.id;
    return id ? 'https://line.me/R/oaMessage/' + encodeURIComponent(id) + '/?' + encodeURIComponent(text) : '';
  }
  function lineMessage(v, f, res) {
    var test = res.preview || /^TEST-/.test(String(res.id || ''));
    return (test ? '【測試】' : '') + '【2027國家地理路跑 團報】報名完成\n' +
      '編號：' + (res.id || '—') + '\n' +
      '姓名：' + v.name + '\n' +
      '組別：' + v.category + '\n' +
      '應匯金額：' + money(f.total) + '\n' +
      '匯款後五碼：' + v.last5 + '（' + dayText(v.payDate) + ' 匯款）\n' +
      '截圖附上，麻煩小編確認，謝謝！';
  }

  function showDone(v, f, res) {
    var area = $('#doneArea');
    var cat = catByKey[v.categoryKey];
    var link = lineLink(lineMessage(v, f, res));
    var lineName = (C.line && C.line.name) || 'NID 官方 LINE';
    var who = whoText(v, true);
    var rows =
      '<dt>組別</dt><dd>' + esc(v.category) + '</dd>' +
      '<dt>' + (cat && cat.family ? '親子組紀念衫' : '紀念衫') + '</dt><dd>' + esc(v.size) + '</dd>' +
      '<dt>應匯金額</dt><dd>' + money(f.total) + '</dd>' +
      '<dt>匯款後五碼</dt><dd>' + esc(v.last5) + '（' + esc(dayText(v.payDate)) + ' 匯款）</dd>';
    var preview = res.preview ? '<p class="preview-flag">預覽模式：尚未設定收件網址，這筆資料沒有送出。</p>' : '';
    var lineBtn = link ? '<a class="btn btn--sun" href="' + esc(link) + '" target="_blank" rel="noopener">傳給官方 LINE 小編</a>' : '';
    var family = cat && cat.family;   // 親子組：家長與孩童皆須報名，提醒另一位也要報

    area.innerHTML = '<div class="done">' +
      '<span class="done__badge">報名資料已送出</span>' +
      '<h3>' + esc(v.name) + '，謝謝你加入 NID 團報！</h3>' +
      '<div><p class="done__label">報名編號</p><p class="done__id">' + esc(res.id || '—') + '</p></div>' +
      '<dl>' + rows + '</dl>' +
      '<p>請截圖保存這個畫面，並傳給 ' + esc(lineName) + ' 小編。有問題請洽' + esc(C.contact) + '。</p>' +
      (family ? '<p class="done__family"><b>親子組家長與孩童皆須報名</b>，另一位還沒報的話，請按「再幫一位報名」。</p>' : '') +
      preview +
      '<div class="done__actions">' + lineBtn + '<button class="btn btn--line" type="button" id="btnAnother">再幫一位報名</button></div>' +
      '</div>';

    // 跳出視窗：一個畫面放得下，方便學員截圖
    $('#doneShot').innerHTML =
      '<p class="shot__badge">✓ 報名完成</p>' +
      '<h2 class="shot__title" id="doneModalTitle">請截圖這個畫面</h2>' +
      '<div class="shot__card">' +
      '<p class="shot__label">報名編號</p><p class="shot__id">' + esc(res.id || '—') + '</p>' +
      '<dl class="shot__list"><dt>姓名</dt><dd>' + esc(v.name) + '</dd>' + rows + '<dt>身分</dt><dd>' + esc(who) + '</dd></dl>' +
      '</div>' +
      '<ol class="shot__steps">' +
      '<li><span><b>截圖</b>這個畫面（電源鍵＋音量鍵一起按）。</span></li>' +
      '<li><span>把截圖<b>傳給 ' + esc(lineName) + ' 小編</b>' + (link ? '：按下面的按鈕，報名資料會先幫你打好。' : '。') + '</span></li>' +
      (family ? '<li><span>親子組<b>家長與孩童皆須報名</b>：另一位還沒報的話，按「我截好了」再點「再幫一位報名」。</span></li>' : '') +
      '</ol>' + preview;
    var btn = $('#doneLineBtn');
    btn.hidden = !link;
    if (link) btn.href = link; else btn.removeAttribute('href');

    $('#formArea').hidden = true;
    area.hidden = false;
    setTotalBar(false);
    area.scrollIntoView({ block: 'start' });
    $('#btnAnother').addEventListener('click', resetForAnother);
    openModal($('#doneModal'), $('#btnAnother'));
  }

  function resetForAnother() {
    if (!$('#doneModal').hidden) closeModal($('#doneModal'));
    $('#signupForm').reset();
    addonQty = { bag: 0, tee: 0, towel: 0 };
    $$('#addonList output').forEach(function (o) { o.textContent = '0'; });
    var teeOpts = $('#teeOpts'); if (teeOpts) teeOpts.hidden = true;
    $('#f-nat').value = 'TWN-Taiwan';
    renderDays();
    state.tried = false;
    state.touched = {};
    state.agreedAt = null;
    $('#doneArea').hidden = true;
    $('#gate').hidden = false;
    refresh();
    showErrors({ errors: {}, warnings: {} }, false);
    openTerms();
  }

  /* ---------- totals bar on phones */
  var io;
  function setTotalBar(on) {
    var bar = $('#totalBar');
    bar.classList.toggle('is-on', !!on);
    document.body.classList.toggle('has-totalbar', !!on);
    bar.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  function observeTotalBar() {
    if (io || typeof IntersectionObserver !== 'function') return;
    var formIn = false, payIn = false;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.target.id === 'signupForm') formIn = en.isIntersecting;
        if (en.target.id === 'step-5') payIn = en.isIntersecting;
      });
      setTotalBar(formIn && !payIn && !$('#formArea').hidden);
    }, { threshold: 0 });
    io.observe($('#signupForm'));
    io.observe($('#step-5'));
  }

  /* ---------- copy */
  function copyText(text, btn) {
    var ok = function () { toast('已複製：' + text); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var done = false;
      try { done = document.execCommand('copy'); } catch (err) { done = false; }
      document.body.removeChild(ta);
      if (done) ok(); else toast('請長按帳號手動複製：' + text);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
        return;
      }
    } catch (err) { /* fall through */ }
    fallback();
  }

  /* ---------- route tabs */
  function wireTabs() {
    var tabs = $$('.tabs [role="tab"]');
    function select(t) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = tabs[(i + d + tabs.length) % tabs.length];
        select(n);
        n.focus();
      });
    });
  }

  /* ---------- live count (optional, needs endpoint) */
  function loadStats() {
    if (!C.endpoint || typeof fetch !== 'function') return;
    fetch(C.endpoint + (C.endpoint.indexOf('?') > -1 ? '&' : '?') + 'action=stats')
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.ok && s.total > 0) {
          var el = $('#statsText');
          el.textContent = '目前已有 ' + s.total + ' 人報名';
          el.hidden = false;
        }
      })
      .catch(function () { /* 只是顯示人數，失敗就不顯示 */ });
  }

  /* ---------- wire everything */
  function init() {
    applyConfigText();
    renderBibs();
    renderFeeTable();
    renderFormOptions();
    wireTabs();

    $$('.js-open-terms').forEach(function (b) {
      b.addEventListener('click', function () { openTerms(b); });
    });
    wireModal($('#termsModal'), null);
    wireModal($('#reviewModal'), null);
    wireModal($('#doneModal'), null);
    $('#termsBody').addEventListener('scroll', checkTermsRead, { passive: true });
    window.addEventListener('resize', function () { if (!$('#termsModal').hidden) checkTermsRead(); });
    $('#btnAgree').addEventListener('click', function () {
      state.agreedAt = new Date().toISOString();
      closeModal($('#termsModal'));
      toast('已同意參賽聲明，開始填寫報名表');
      revealForm(true);
    });
    $('#btnDisagree').addEventListener('click', function () {
      closeModal($('#termsModal'));
      toast('需要同意參賽聲明才能報名');
      $('#gateText').textContent = '你選擇了不同意，因此還不能報名。想報名時請重新閱讀並按「同意」；有疑問請洽' + C.contact + '。';
    });

    var form = $('#signupForm');
    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'f-last5') t.value = t.value.replace(/\D/g, '').slice(0, 5);
      if (t.id === 'f-id' || t.id === 'f-g-id') {
        var pos = t.selectionStart;
        t.value = t.value.toUpperCase().replace(/\s/g, '');
        try { t.setSelectionRange(pos, pos); } catch (err) { /* some inputs refuse */ }
      }
      refresh();
    });
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'f-birth-y' || t.id === 'f-birth-m') renderDays();
      var holder = t.closest('[data-field]');
      if (holder && (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox')) state.touched[holder.getAttribute('data-field')] = true;
      refresh();
    });
    form.addEventListener('focusout', function (e) {
      var holder = e.target.closest && e.target.closest('[data-field]');
      if (holder && (e.target.value || '').trim()) {
        state.touched[holder.getAttribute('data-field')] = true;
        refresh();
      }
    });
    $('#btnConfirm').addEventListener('click', confirmSubmit);

    document.addEventListener('click', function (e) {
      var b = e.target.closest('.js-copy');
      if (!b) return;
      var from = b.getAttribute('data-copy-from');
      var text = from === 'accountDigits' ? String(C.bank.account).replace(/\D/g, '') : from === 'bankCode' ? C.bank.bankCode : '';
      if (text) copyText(text, b);
    });

    refresh();
    renderPeriod();
    setInterval(renderPeriod, 30000);
    loadStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
