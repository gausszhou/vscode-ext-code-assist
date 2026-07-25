import type { ChatMessage } from "@/models/Message";

/**
 * 简易 Token 计算方法
 * token 是模型用来表示自然语言文本的基本单位，也是我们的计费单元，可以直观的理解为“字”或“词”；通常 1 个中文词语、1 个英文单词、1 个数字或 1 个符号计为 1 个 token。
 * 一般情况下模型中 token 和字数的换算比例大致如下：
 * 1 个英文字符 ≈ 0.3 个 token。
 * 1 个中文字符 ≈ 0.6 个 token。
 * 但因为不同模型的分词不同，所以换算比例也存在差异，每一次实际处理 token 数量以模型返回为准，您可以从返回结果的 usage 中查看。
 * @param text
 * @returns
 */
export function getTokenCount(text: string = ''): number {
  let tokenCount = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Simplified check: Chinese characters are mostly in 0x4E00-0x9FFF
    if (code >= 0x4e00 && code <= 0x9fff) {
      tokenCount += 0.6; // Chinese character
    } else {
      tokenCount += 0.3; // English or other
    }
  }

  return Math.ceil(tokenCount);
}

export const getMessageInfoFromMessage = (message: ChatMessage) => {
  const startTime = message.startTime ?? 0;
  const loadTime = message.loadTime ?? startTime;
  const endTime = message.endTime ?? startTime;
  const loadDuration = startTime ? ((loadTime - startTime) / 1000).toFixed(2) : '0.00';
  const evalDuration = loadTime ? ((endTime - loadTime) / 1000).toFixed(2) : '0.00';
  const totalDuration = startTime ? ((endTime - startTime) / 1000).toFixed(2) : '0.00';
  const content = (message.reasoning ?? '') + (message.content ?? '');
  const tokens = getTokenCount(content);
  const evalSec = parseFloat(evalDuration) || 1;
  const tokensSpeed = (tokens / evalSec).toFixed(2);
  const chars = content.length;
  const charsSpeed = (chars / evalSec).toFixed(2);
  return {
    provider: message.provider,
    loadDuration,
    evalDuration,
    totalDuration,
    tokens,
    tokensSpeed,
    chars,
    charsSpeed,
  };
};