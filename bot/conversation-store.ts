interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const conversations = new Map<string, Message[]>();

export function getHistory(jid: string): Message[] {
  return conversations.get(jid) || [];
}

export function addMessage(
  jid: string,
  role: "user" | "assistant",
  content: string
) {
  const history = conversations.get(jid) || [];
  history.push({ role, content });
  if (history.length > 20) history.splice(0, history.length - 20);
  conversations.set(jid, history);
}

export function clearHistory(jid: string) {
  conversations.delete(jid);
}
