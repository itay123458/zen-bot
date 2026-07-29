export const DEFAULT_UPDATE_CHANNEL_ID = '1527004410536923357';

export const DEFAULT_UPDATE_CONTENT = Object.freeze({
  version: '4.6.0',
  title: '🤖 עדכון חדש ל־EditIL Assistant',
  newFeatures: [
    'נוספו פקודות ניהול חדשות: /softban, /untimeout, /note, /notes, /clearnotes, /hide, /unhide ו־/voicekick',
  ],
  fixes: [
    'כל פקודות הניהול נבנו מחדש עם בדיקות הרשאה והיררכיה אחידות, תיעוד פעולות והודעות ברורות בעברית',
  ],
  improvements: [
    '/clear קיבלה מסננים לפי חבר, בוטים, קישורים, קבצים וטקסט; /timeout תומכת במשך משולב כמו 1h30m',
  ],
  changelogUrl: null,
  imageUrl: null,
});
