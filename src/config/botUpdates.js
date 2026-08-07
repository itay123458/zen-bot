export const DEFAULT_UPDATE_CHANNEL_ID = '1527004410536923357';

export const DEFAULT_UPDATE_CONTENT = Object.freeze({
  version: '6.2.0',
  title: '🤖 עדכון חדש ל־EditIL Assistant',
  newFeatures: [
    'נוסף מעקב אוטומטי אחר עדכוני Animal Company, כולל פריטים, מפות, אירועים, שינויי משחק ותיקונים.',
    'נוספה פקודת בעלים ‎/ac mods‎ לבדיקה, הצגת מצב ופרסום ידני של עדכונים.',
  ],
  fixes: [
    'נמנעת שליחה כפולה של אותו עדכון באמצעות שמירת מזהי העדכונים ב־PostgreSQL.',
  ],
  improvements: [
    'הפקודה מוסתרת כברירת מחדל ומוגנת גם בבדיקת מזהה בעל הבוט בזמן ההפעלה.',
  ],
  changelogUrl: null,
  imageUrl: null,
});
