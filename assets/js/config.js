/* =========================================================
 * NID RUN CLUB × 2027 國家地理路跑 團報設定檔
 * ---------------------------------------------------------
 * 要改價格、班級、截止日、收件網址，只要改這個檔案。
 * 其他檔案（app.js / style.css）不用動。
 * ========================================================= */
window.NGR_CONFIG = {

  /* Google Apps Script 網頁應用程式網址（部署後貼上）。
   * 留空 = 預覽模式：可以完整操作，但資料不會送出。 */
  endpoint: 'https://script.google.com/macros/s/AKfycbz9rljmw8NtCjlQeHBwZBlnZQaorrqYOL9sebw_J8kcLe40rCPc9YObEwGBAmpAaOdm9w/exec',

  /* 團報時間（台灣時間）。開放前按鈕會鎖住；截止時間一到自動關閉報名。
   * apps-script/Code.gs 的 OPEN_AT / DEADLINE 要設成一樣。
   * 開放前要測試：網址後面加 #test（例：…/ngr2027/#test），送出的資料會標成【測試】。 */
  openAt: '2026-11-03T00:00:00+08:00',
  deadline: '2026-11-09T23:59:59+08:00',

  /* 團報窗口（顯示在頁面上，讓報名者有問題時知道找誰；前面會自動接「請洽」，這裡只寫對象） */
  contact: '各班教練或 NID 官方 LINE',

  /* NID 官方 LINE：報名完成會跳出視窗，請學員截圖傳給小編。
   * url = 官方帳號頁面，「傳給官方 LINE 小編」按鈕直接開這個網址；
   * id = 官方帳號的 LINE ID（@ 開頭）；url 和 id 都留空就不顯示 LINE 按鈕。 */
  line: { id: '@eei8717i', name: 'NID 官方 LINE', url: 'https://page.line.me/eei8717i?openQrModal=true' },

  /* 大會官方頁面 */
  officialUrl: 'https://irunner.biji.co/2027NGR',
  officialRulesUrl: 'https://irunner.biji.co/2027NGR?page=5606',

  /* 運費（NID 團報規則）：當期學員 50、當期學員的小孩 50（比賽當天未滿 18 歲，爸爸或媽媽是當期學員）、非當期學員 80
   * apps-script/Code.gs 的 SHIPPING 要設成一樣。 */
  shipping: { student: 50, child: 50, guest: 80 },

  /* 晶片押金：大會規定 21K、10K 每人另加 100 元，賽後歸還晶片即退還。
   * 若團報不向學員收，改成 0。 */
  chipDeposit: 100,

  /* 匯款資訊 */
  bank: {
    name: '江凱為',
    bankCode: '822',
    bankName: '中國信託商業銀行',
    branch: '瑞光分行',
    account: '7165-4022-7006'
  },

  /* 報名組別。key 不要改；label 必須和大會團報表的選項文字一字不差。 */
  categories: [
    { key: '21K-HM',  dist: '21K', label: '21K（半馬組）',     name: '半馬組',     price: 1390, start: '05:30', limit: 210, chip: true,  bag: false, cap: true,  ranked: true,  maxBirthYear: 2011 },
    { key: '21K-HMU', dist: '21K', label: '21K（半馬升級組）', name: '半馬升級組', price: 1690, start: '05:30', limit: 210, chip: true,  bag: true,  cap: true,  ranked: true,  maxBirthYear: 2011 },
    { key: '10K-CH',  dist: '10K', label: '10K（挑戰組）',     name: '挑戰組',     price: 1090, start: '05:50', limit: 100, chip: true,  bag: false, cap: true,  ranked: true },
    { key: '10K-CHU', dist: '10K', label: '10K（挑戰升級組）', name: '挑戰升級組', price: 1390, start: '05:50', limit: 100, chip: true,  bag: true,  cap: true,  ranked: true },
    { key: '10K-JG',  dist: '10K', label: '10K（慢跑組）',     name: '慢跑組',     price: 1090, start: '06:00', limit: 100, chip: true,  bag: false, cap: true,  ranked: false },
    { key: '10K-JGU', dist: '10K', label: '10K（慢跑升級組）', name: '慢跑升級組', price: 1390, start: '06:00', limit: 100, chip: true,  bag: true,  cap: true,  ranked: false },
    { key: '5K-FUN',  dist: '5K',  label: '5K（休閒組）',      name: '休閒組',     price: 650,  start: '08:00', limit: 90,  chip: false, bag: false, cap: false, ranked: false },
    { key: '5K-FAM',  dist: '5K',  label: '5K（親子組）',      name: '親子組',     price: 650,  start: '08:10', limit: 90,  chip: false, bag: false, cap: false, ranked: false, family: true }
  ],

  /* 紀念衫尺寸（與大會選單相同） */
  sizes: ['兒童6號', '兒童8號', '兒童10號', '兒童12號', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],

  /* 官方加購品。enabled 改成 false 就不開放加購。 */
  addons: {
    enabled: true,
    bag:   { name: '賽事衣保袋', price: 700, max: 3 },
    tee:   { name: '活動紀念衫', price: 590, max: 5 },
    towel: { name: '運動毛巾',   price: 290, max: 5 }
  },

  /* 當期班級（取自 NID 官網 2026 年 9 月、12 月梯次班級名稱）。
   * 每期開班不同時，直接增刪這份清單即可。 */
  classes: [
    { group: '專業跑步課程｜臺北田徑場', items: ['週一北田跑步班', '週三北田早跑班', '週三北田跑步班', '週三北田初階跑步班', '週四北田初階跑步班', '週日北田早跑班'] },
    { group: '專業跑步課程｜內湖高工', items: ['週一內湖初階跑步班', '週二內湖跑步班', '週三內湖跑步班', '週四內湖初階跑步班', '週五內湖初階跑步班'] },
    { group: '專業跑步課程｜中正紀念堂', items: ['週一中正初階跑步班', '週二中正初階跑步班', '週四中正初階跑班'] },
    { group: '專業跑步課程｜大同高中', items: ['週一大同初階跑步班', '週四大同跑步班'] },
    { group: '專業跑步課程｜中正國小', items: ['週二龍江跑步班'] },
    { group: '專業跑步課程｜板橋', items: ['週二板一初階跑步班', '週三板一跑步班', '週四板一初階跑步班', '週五板二初階跑步班'] },
    { group: '專業跑步課程｜新莊・汐止', items: ['週三新莊初階跑步班', '週五新莊跑步班', '週六汐止早跑班'] },
    { group: '專業跑步課程｜高雄', items: ['週二苓雅初階跑步班', '週三苓雅跑步班', '週四苓雅跑步班', '週六苓雅早跑班', '週二高大初階跑步班', '週三高大跑步班', '週四高大初階跑步班', '週一三民跑步班', '週五三民初階跑步班', '週五高科跑步班'] },
    { group: '跑者養成班', items: ['週一北田跑者養成班', '週四北田跑者養成班', '週五北田跑者養成班'] },
    { group: 'HYROX 跑步訓練營', items: ['週六ＨＹＲＯＸ訓練營', '週一三民ＨＹＲＯＸ訓練營'] },
    { group: '跑者肌力課程', items: ['週一北田跑者肌力1830', '週一北田跑者肌力1830(PETER)', '週一北田跑者肌力1930', '週二北田跑者肌力1830', '週二北田跑者肌力1930', '週一松江跑者肌力班（室內）', '週六松江跑者肌力班1000（室內）', '週六松江跑者肌力班1700（室內）', '週五大直跑者肌力班（室內）'] }
  ],

  /* 比賽日（用來判斷是否未滿 18 歲、需填監護人） */
  raceDate: '2027-03-14'
};
