import axios from "axios";
import * as vscode from "vscode";

const setting = vscode.workspace.getConfiguration("code-assist");
const origin = setting.get<string>("origin") || "http://127.0.0.1:11434";

const API_TAGS = origin + "/api/tags";
const API_CHAT = origin + "/api/chat";
const API_STOP = origin + "/api/delete";

export function tags(onText: any) {
  return axios.get(API_TAGS).then((res) => {
    console.log("tags-end", res.data);
    onText("tags-end", res.data);
  });
}

export function stop(onText: any) {
  return axios.get(API_STOP).then((res) => {
    console.log("stop-end", res.data);
    onText("stop-end", res.data);
  });
}

export async function chat(
  prompt: string,
  messages: any[],
  model: string,
  onText: any,
  controller: AbortController
) {
  const data = {
    model,
    messages: [
      ...messages,
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: true,
    raw: true,
  };
  console.log("chat-req", data);
  const template = {
    model: model,
    created_at: new Date().toISOString(),
    message: { role: "assistant", content: "" },
    done: false,
  };
  onText("chat-pre", JSON.stringify(template));
  const response = await axios.post(API_CHAT, data, { responseType: "stream", signal: controller.signal });
  const stream = response!.data;
  let timer: null | any = null;
  onText("chat-start", JSON.stringify(template));
  stream.on("data", (data: any) => {
    const text = new TextDecoder().decode(data);
    if (text.trim()) {
      onText("chat-data", text);
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      console.log("chat-end", template);
      onText("chat-end", JSON.stringify(template));
    }, 300);
  });

  stream.on("chat-end", (data: any) => {
    if (timer) {
      clearTimeout(timer);
    }
    console.log("chat-end", data);
    onText("chat-end", JSON.stringify(template));
  });
}
