// The AI provider lives in this one file. To switch providers, change the two factories below
// (and the Pinecone index dimension if the new embedding model has a different size).
import { ChatOpenAI } from "@langchain/openai";
import { CHAT_MODEL } from "@/lib/constants";
import { requireEnv } from "@/lib/env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_API_KEY = () => requireEnv("OPENROUTER_API_KEY");

export function getChatModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: `openai/${CHAT_MODEL}`,
    temperature: 0,
    streaming: true,
    apiKey: OPENROUTER_API_KEY(),
    configuration: { baseURL: OPENROUTER_BASE_URL },
  });
}
