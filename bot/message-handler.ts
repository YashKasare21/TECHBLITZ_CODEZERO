import { runAgentTurn } from "./llm";
import { addMessage, getHistory } from "./conversation-store";

export async function handleMessage(
  phone: string,
  text: string
): Promise<string> {
  addMessage(phone, "user", text);

  const history = await getHistory(phone);
  const reply = await runAgentTurn(phone, history);

  addMessage(phone, "assistant", reply);
  return reply;
}
