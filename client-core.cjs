'use strict';
// Pure display/participation policy; no storage, network, timers or gameplay.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HimaClient=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  const languages=Object.freeze([
    ['ja','日本語','ja-JP'],['en','English','en-US'],['es','Español','es-ES'],
    ['pt-BR','Português (Brasil)','pt-BR'],['zh-Hans','简体中文','zh-CN'],
    ['fr','Français','fr-FR'],['de','Deutsch','de-DE'],['ko','한국어','ko-KR'],
    ['ru','Русский','ru-RU'],['it','Italiano','it-IT'],['zh-Hant','繁體中文','zh-TW'],
    ['id','Bahasa Indonesia','id-ID'],['tr','Türkçe','tr-TR'],
    ['vi','Tiếng Việt','vi-VN'],['th','ไทย','th-TH']
  ].map(Object.freeze));
  function isSupported(value){return languages.some(row=>row[0]===value);}
  function languageFromLocale(value){
    const raw=String(value||'').trim().replace(/_/g,'-').toLowerCase();
    if(!raw)return null;
    if(raw.startsWith('zh')){
      if(raw.includes('hant'))return 'zh-Hant';
      if(raw.includes('hans'))return 'zh-Hans';
      return /(?:^|-)(tw|hk|mo)(?:-|$)/.test(raw)?'zh-Hant':'zh-Hans';
    }
    const base=raw.split('-')[0];
    if(base==='pt')return 'pt-BR';
    return isSupported(base)?base:null;
  }
  function resolveLocale(saved,browserLocales){
    if(isSupported(saved))return saved;
    for(const locale of Array.isArray(browserLocales)?browserLocales:[]){
      const resolved=languageFromLocale(locale);
      if(resolved)return resolved;
    }
    return 'en';
  }
  function captureParticipation(value){
    const capped=typeof value==='string'?value.trim().slice(0,20):'';
    const displayName=capped.replace(/[\uD800-\uDBFF]$/,'');
    return Object.freeze({displayName,participates:displayName.length>0});
  }
  const publicUrl='https://chameleonjp.codeberg.page/nayuta_no_himatsubushi/';
  const tags='#暇をつぶそう #ゲーム制作';
  const messages=Object.freeze({
    ja:['暇をつぶそう：バーで球を跳ね返し、200個のブロックを壊そう！壁とバーでの減点に注意。','暇をつぶそうで {score} 点！'],
    en:['暇をつぶそう: Bounce balls with the paddle to break 200 blocks! Watch out for wall and paddle penalties.','I scored {score} points in 暇をつぶそう!'],
    es:['暇をつぶそう: ¡Rebota las bolas con la pala y rompe 200 bloques! Ojo con las penalizaciones de paredes y pala.','¡Conseguí {score} puntos en 暇をつぶそう!'],
    'pt-BR':['暇をつぶそう: Rebata as bolas com a barra e quebre 200 blocos! Cuidado com as penalidades nas paredes e na barra.','Fiz {score} pontos em 暇をつぶそう!'],
    'zh-Hans':['暇をつぶそう：用挡板反弹小球，击碎200个砖块！注意碰墙和挡板会扣分。','我在暇をつぶそう中得了 {score} 分！'],
    fr:['暇をつぶそう : Faites rebondir les balles avec la raquette pour casser 200 briques ! Attention aux pénalités des murs et de la raquette.',"J’ai marqué {score} points dans 暇をつぶそう !"],
    de:['暇をつぶそう: Lenke die Bälle mit dem Schläger und zerstöre 200 Blöcke! Wände und Schläger kosten Punkte.','Ich habe {score} Punkte in 暇をつぶそう erreicht!'],
    ko:['暇をつぶそう: 막대로 공을 튕겨 블록 200개를 부수세요! 벽과 막대에 맞으면 감점돼요.','暇をつぶそう에서 {score}점을 기록했어요!'],
    ru:['暇をつぶそう: Отбивайте мячи платформой и разбейте 200 блоков! Стены и платформа отнимают очки.','Мой результат в 暇をつぶそう: {score} очк.'],
    it:['暇をつぶそう: Fai rimbalzare le palline con la barra e rompi 200 blocchi! Attenzione alle penalità di muri e barra.','Ho ottenuto {score} punti in 暇をつぶそう!'],
    'zh-Hant':['暇をつぶそう：用擋板反彈小球，擊碎200個磚塊！注意碰牆和擋板會扣分。','我在暇をつぶそう中得了 {score} 分！'],
    id:['暇をつぶそう: Pantulkan bola dengan papan dan hancurkan 200 balok! Dinding dan papan mengurangi poin.','Saya mendapat {score} poin di 暇をつぶそう!'],
    tr:['暇をつぶそう: Topları raketle sektir ve 200 bloğu kır! Duvar ve raket temasında puan kaybedersin.','暇をつぶそう oyununda {score} puan aldım!'],
    vi:['暇をつぶそう: Dùng thanh đỡ bật bóng để phá 200 khối! Chạm tường và thanh đỡ sẽ bị trừ điểm.','Tôi đạt {score} điểm trong 暇をつぶそう!'],
    th:['暇をつぶそう: ใช้แถบรับลูกบอลให้กระเด้งไปทำลาย 200 บล็อก! ระวังโดนหักคะแนนเมื่อชนกำแพงหรือแถบรับ','ฉันได้ {score} คะแนนใน 暇をつぶそう!']
  });
  function shareText(options){
    const locale=isSupported(options.locale)?options.locale:'en';
    const result=options.screen==='score';
    if(result&&(typeof options.score!=='number'||!Number.isFinite(options.score)))throw new TypeError('A finite current score is required');
    const numberLocale=languages.find(row=>row[0]===locale)[2];
    const line=result?messages[locale][1].replace('{score}',new Intl.NumberFormat(numberLocale).format(options.score)):messages[locale][0];
    return line+'\n'+publicUrl+'\n'+tags;
  }
  const fallbackLabels=Object.freeze({
  "ja": "Xを開けない場合は、共有文を選択してコピーしてください。",
  "en": "If X cannot open, select and copy the share text.",
  "es": "Si no se abre X, selecciona y copia el texto para compartir.",
  "pt-BR": "Se o X não abrir, selecione e copie o texto para compartilhar.",
  "zh-Hans": "如果无法打开X，请选择并复制分享文字。",
  "fr": "Si X ne s’ouvre pas, sélectionnez et copiez le texte à partager.",
  "de": "Wenn X nicht geöffnet wird, markiere und kopiere den Text zum Teilen.",
  "ko": "X를 열 수 없다면 공유 문구를 선택해서 복사해 주세요.",
  "ru": "Если X не открывается, выделите и скопируйте текст для публикации.",
  "it": "Se X non si apre, seleziona e copia il testo da condividere.",
  "zh-Hant": "如果無法開啟X，請選取並複製分享文字。",
  "id": "Jika X tidak terbuka, pilih dan salin teks untuk dibagikan.",
  "tr": "X açılamazsa paylaşım metnini seçip kopyala.",
  "vi": "Nếu không mở được X, hãy chọn và sao chép nội dung chia sẻ.",
  "th": "หากเปิด X ไม่ได้ ให้เลือกและคัดลอกข้อความที่จะแชร์"
});
  function shareFallbackLabel(locale){return fallbackLabels[isSupported(locale)?locale:"en"];}
  function shareIntent(text) { return 'https://twitter.com/intent/tweet?text='+encodeURIComponent(text); }
  function createShareAction(options) {
    let lastActivation=-Infinity;
    return function activateShare(event) {
      if(options.getScreen()!==options.screen || options.isDisabled() || (event.button!=null&&event.button!==0))return;
      event.preventDefault();
      const now=options.now();
      if(now-lastActivation<500)return;
      lastActivation=now;
      const text=options.getText();
      let popup;
      try {
        popup=options.openPopup('', '_blank');
        if(!popup)throw new Error('Popup unavailable');
        popup.opener=null;
        if(popup.opener!==null)throw new Error('Popup opener could not be detached');
        const destination=popup.document.createElement('a');
        destination.href=shareIntent(text);
        destination.target='_self';
        destination.rel='noreferrer';
        destination.referrerPolicy='no-referrer';
        popup.document.body.append(destination);
        destination.click();
      } catch (_) {
        try { if(popup)popup.close(); } catch (_) {}
        options.fallback(text);
      }
    };
  }
  return Object.freeze({languages,resolveLocale,captureParticipation,shareText,shareFallbackLabel,shareIntent,createShareAction,
    title:'暇をつぶそう',tags,publicUrl,
    rankingUrl:'https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=nayuta_no_himatsubushi'});
});
