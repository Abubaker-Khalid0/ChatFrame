/** English interface strings (LTR). Shape defines the `Dictionary` contract. */
export const en = {
  appName: 'ChatFrame',
  welcome: {
    title: 'Welcome to ChatFrame',
    localFirst: 'ChatFrame runs entirely on your own machine.',
    readOnly: 'It only reads your data — it never sends, edits, or deletes anything.',
    choosePrompt: 'Choose your language',
    continue: 'Continue',
  },
  language: {
    label: 'Language',
    en: 'English',
    ar: 'العربية',
  },
  nextStep: {
    title: 'Next steps coming soon',
    body: 'The rest of the ChatFrame experience is on its way. Thanks for your patience!',
  },
  health: {
    checking: 'Starting ChatFrame…',
    ready: 'Ready',
    notReady: "ChatFrame isn't ready yet. Make sure the app is running, then try again.",
  },
};

export type Dictionary = typeof en;
