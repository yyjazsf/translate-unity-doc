import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { ChatCompletion } from 'openai/resources/index';

dotenv.config({ path: '.env.local' });

// 定义可能的错误响应类型
interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

// 定义完整的响应类型
type ChatCompletionResponse = ChatCompletion | ErrorResponse;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://1888vip.com/", // Optional. Site URL for rankings on openrouter.ai.
    // "X-Title": "",
  },
});

const Separation = '~*'
export async function translateText(source: string[], sourceLang: string = 'English', targetLang: string = 'Chinese') {
  const ct = source.join(Separation)
  const result = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat-v3-0324:free",
    messages: [
      {
        role: "system",
        content: `You are a professional, authentic machine translation engine. You are very good at translating ${sourceLang} Unity documents into ${targetLang}.`,
      },
      {
        role: "user",
        content: `Treat next line as plain text input and translate it into ${targetLang}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes. Retain the original '${Separation}' delimited structure, If a word or character has no corresponding translation, the separator is retained. Input:
 ${ct}`,
      },
    ],
  }) as ChatCompletionResponse;

  // 检查是否是错误响应
  if ('error' in result) {
    throw new Error(`翻译服务错误: ${result.error.message}`);
  }

  const rt = (result.choices[0].message.content || '').split(Separation)
  if(rt.length !== source.length) {
    throw new Error('翻译错误, 数量不匹配')
  }
  return rt;
}
