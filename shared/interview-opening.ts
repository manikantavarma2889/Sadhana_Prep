export const openingTopic = 'Introduction and role motivation';

export function openingQuestion(role: string | null) {
  return role
    ? 'To start, please tell me a little about yourself and why you are interested in the ' + role + ' role.'
    : 'To start, please tell me a little about yourself and what kind of role you are interested in.';
}
