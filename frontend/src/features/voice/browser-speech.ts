export function createSpokenPrompt(text: string, defaultVoice = false) {
  const prompt = new SpeechSynthesisUtterance(text);
  prompt.lang = 'en-US';
  prompt.pitch = 1.05;
  if (!defaultVoice) {
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase() === 'en-us');
    prompt.voice = voices.find(voice => voice.localService && /samantha|zira|jenny|aria/i.test(voice.name))
      ?? voices.find(voice => voice.localService)
      ?? voices.find(voice => /google us english/i.test(voice.name))
      ?? null;
  }
  return prompt;
}
