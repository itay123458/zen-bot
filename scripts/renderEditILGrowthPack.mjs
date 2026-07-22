import { chromium } from 'playwright-core';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const videoId = process.argv[2] || 'community';
const concepts = {
  community: {
    label: 'קהילת העורכים בישראל',
    scenes: [
      ['עורכים לבד?', 'לא חייבים להישאר לבד.', 'קהילה ישראלית שמבינה עריכה.'],
      ['מעלים עריכה', 'ומקבלים משוב אמיתי.', 'תגובות, רעיונות ושיפור מפרויקט לפרויקט.'],
      ['לומדים ביחד', 'After Effects • CapCut', 'מדריכים, משאבים ואתגרים במקום אחד.'],
      ['הפרויקט הבא מתחיל כאן', 'הצטרפו ל־EditIL', 'editil.com']
    ]
  },
  resources: {
    label: 'משאבים לעורכי וידאו',
    scenes: [
      ['מחפשים חומרי עריכה?', 'חסכו שעות של חיפושים.', 'כלים שימושיים לעורכים במקום אחד.'],
      ['אפקטים קוליים', 'פריסטים • מדריכים', 'רעיונות שיעזרו להפוך עריכה טובה למעולה.'],
      ['מתאים לכל רמה', 'מתחילים ומתקדמים.', 'לומדים, משתפים ומתקדמים יחד.'],
      ['רוצים עוד משאבים?', 'היכנסו ל־EditIL', 'editil.com']
    ]
  },
  challenge: {
    label: 'אתגרי עריכה קהילתיים',
    scenes: [
      ['חושבים שאתם עורכים טוב?', 'בואו להוכיח את זה.', 'אתגר קצר. רעיון אחד. אינסוף סגנונות.'],
      ['יוצרים גרסה משלכם', 'ומעלים לקהילה.', 'הקהילה צופה, מגיבה ובוחרת.'],
      ['מקבלים במה', 'ומגלים עורכים חדשים.', 'הזדמנות להשתפר ולהציג את הכישרון שלכם.'],
      ['מוכנים לאתגר הבא?', 'הצטרפו ל־EditIL', 'editil.com']
    ]
  }
};

const concept = concepts[videoId];
if (!concept) throw new Error(`Unknown concept: ${videoId}`);
const outputDir = resolve(`tmp/growth-pack/${videoId}`);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--hide-scrollbars']
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const sceneHtml = concept.scenes.map(([eyebrow, headline, copy], index) => `
  <section class="scene" data-index="${index}">
    <span class="eyebrow">${eyebrow}</span>
    <h1>${headline}</h1>
    <p>${copy}</p>
    ${index === 1 ? '<div class="mock"><i></i><div><b>העריכה החדשה שלי</b><small>Motion Design • Gaming Edit</small></div><strong>▶</strong></div><div class="reactions"><span>🔥 18</span><span>✨ 12</span><span>🎬 7</span></div>' : ''}
    ${index === 2 ? '<div class="chips"><span>🎬 עריכות</span><span>📦 משאבים</span><span>💡 מדריכים</span><span>🏆 אתגרים</span></div>' : ''}
    ${index === 3 ? '<div class="button">הצטרפו עכשיו</div>' : ''}
  </section>`).join('');

await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Arial,"Segoe UI",sans-serif;background:#050711;color:#fff}.stage{position:relative;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(circle at 82% 13%,rgba(47,128,255,.34),transparent 32%),radial-gradient(circle at 10% 85%,rgba(255,79,174,.27),transparent 35%),#060812}.grid{position:absolute;inset:-200px;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.13) 1px,transparent 1px);background-size:88px 88px;transform:rotate(-8deg)}.orb{position:absolute;width:520px;height:520px;border-radius:50%;border:2px solid rgba(114,183,255,.18);top:540px;left:280px;box-shadow:0 0 0 90px rgba(47,128,255,.035),0 0 0 180px rgba(255,79,174,.025)}.top{position:absolute;z-index:5;top:74px;right:64px;left:64px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:18px;font-size:38px;font-weight:900}.logo{width:72px;height:72px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(135deg,#2f80ff,#ff4fae);box-shadow:0 18px 50px rgba(47,128,255,.25);font-size:40px}.tag{padding:13px 20px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(12,15,28,.72);color:#cbd5ea;font-size:20px}.scene{position:absolute;z-index:3;inset:230px 68px 250px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0}.eyebrow{color:#72b7ff;font-size:27px;font-weight:900;letter-spacing:.03em}.scene h1{max-width:930px;margin:24px 0;font-size:105px;line-height:1.03;letter-spacing:-5px;background:linear-gradient(90deg,#fff 5%,#72b7ff 52%,#ff5db8 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.scene p{max-width:790px;margin:0;color:#b5bfd5;font-size:31px;line-height:1.55}.mock{width:880px;height:340px;margin-top:54px;padding:34px;display:grid;grid-template-columns:210px 1fr 95px;gap:28px;align-items:center;border:1px solid rgba(255,255,255,.16);border-radius:30px;background:rgba(23,27,43,.91);box-shadow:0 45px 100px rgba(0,0,0,.45);text-align:right}.mock i{height:270px;border-radius:20px;background:radial-gradient(circle at 70% 25%,#2f80ff,transparent 45%),linear-gradient(145deg,#192b54,#6c224c)}.mock b{display:block;font-size:34px}.mock small{display:block;margin-top:12px;color:#8f9ab2;font-size:22px}.mock strong{width:78px;height:78px;display:grid;place-items:center;border-radius:50%;background:#0a0c16;font-size:30px}.reactions{display:flex;gap:16px;margin-top:-29px;z-index:2}.reactions span,.chips span{padding:14px 22px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:#23283a;font-size:23px}.chips{max-width:900px;margin-top:70px;display:flex;flex-wrap:wrap;justify-content:center;gap:20px}.chips span{padding:22px 30px;font-size:28px}.button{margin-top:55px;padding:25px 54px;border-radius:20px;background:linear-gradient(110deg,#2f80ff,#745cff,#ff4fae);box-shadow:0 24px 70px rgba(92,88,255,.35);font-size:34px;font-weight:900}.footer{position:absolute;z-index:5;right:64px;bottom:95px;left:64px;display:flex;justify-content:space-between;color:#7f8aa2;font-size:20px}.progress{position:absolute;z-index:5;right:64px;bottom:66px;left:64px;height:7px;overflow:hidden;border-radius:10px;background:rgba(255,255,255,.13)}.progress i{display:block;width:100%;height:100%;transform-origin:right;background:linear-gradient(90deg,#2f80ff,#72b7ff,#ff4fae)}
</style></head><body><main class="stage"><div class="grid"></div><div class="orb"></div><header class="top"><div class="brand"><span class="logo">E</span>EditIL</div><span class="tag">${concept.label}</span></header>${sceneHtml}<footer class="footer"><span>EDITIL.COM</span><span>קהילת העורכים בישראל</span></footer><div class="progress"><i></i></div></main><script>
window.renderAt=time=>{const duration=12,index=Math.min(3,Math.floor(time/3)),local=(time-index*3)/3;document.querySelectorAll('.scene').forEach((scene,i)=>{const fade=Math.min(1,local*6,(1-local)*7);scene.style.opacity=i===index?fade:0;scene.style.transform=i===index?\`translate3d(0,\${(1-local)*32}px,0) scale(\${.96+local*.04})\`:'scale(.96)'});document.querySelector('.grid').style.transform=\`rotate(-8deg) translate3d(\${-time*8}px,\${time*3}px,0)\`;document.querySelector('.orb').style.transform=\`scale(\${1+Math.sin(time*1.7)*.035}) rotate(\${time*3}deg)\`;document.querySelector('.progress i').style.transform=\`scaleX(\${Math.min(1,time/duration)})\`;};
</script></body></html>`);

const fps = 20;
const seconds = 12;
for (let frame = 0; frame < fps * seconds; frame += 1) {
  await page.evaluate(time => window.renderAt(time), frame / fps);
  await page.screenshot({ path: resolve(outputDir, `frame-${String(frame).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
}
await browser.close();
console.log(`${videoId}: ${fps * seconds} frames written to ${outputDir}`);
