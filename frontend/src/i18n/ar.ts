import type { Dictionary } from './en';

/** Arabic interface strings (RTL). Must satisfy the same shape as `en`. */
export const ar: Dictionary = {
  appName: 'ChatFrame',
  welcome: {
    title: 'مرحبًا بك في ChatFrame',
    localFirst: 'يعمل ChatFrame بالكامل على جهازك الخاص.',
    readOnly: 'يقرأ بياناتك فقط — ولا يرسل أو يعدّل أو يحذف أي شيء.',
    choosePrompt: 'اختر لغتك',
    continue: 'متابعة',
  },
  language: {
    label: 'اللغة',
    en: 'English',
    ar: 'العربية',
  },
  nextStep: {
    title: 'الخطوات التالية قريبًا',
    body: 'بقية تجربة ChatFrame في طريقها إليك. شكرًا لصبرك!',
  },
  health: {
    checking: 'جارٍ تشغيل ChatFrame…',
    ready: 'جاهز',
    notReady: 'ChatFrame غير جاهز بعد. تأكد من أن التطبيق قيد التشغيل ثم حاول مرة أخرى.',
  },
};
