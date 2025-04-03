// 初始化
marked.setOptions({
  highlight: function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    return hljs.highlight(validLanguage, code).value;
  },
  langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
  pedantic: false,
  gfm: true,
  breaks: false,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
});

const db = new SimpleIDB({
  dbName: 'code-assist',
  storeName: 'conversations'
});

const vscode = acquireVsCodeApi();
let messages = [];
let currentId = 'code-assist';
let currentModel = localStorage.getItem("code-assist.currentModel") || "";

function init() {
  vscode.postMessage({
    command: "tags",
  });
  vscode.postMessage({
    command: "history",
    id: currentId
  });
}

function chatStart(message) {
  messages.push({
    role: "user",
    timestamp: Date.now(),
    content: message,
  });
  vscode.postMessage({
    command: "chat",
    model: currentModel,
    text: message,
    messages: messages,
  });
}

function chatStop() {
  vscode.postMessage({
    command: "stop",
  });
}

function chatEnd(text, info) {
  messages.push({
    role: "assistant",
    timestamp: Date.now(),
    content: text,
    info: info
  });
  saveData();
}

function saveData() {
  db.set({
    id: currentId,
    messages: messages,
    timestamp: Date.now()
  });
}

function cleanData() {
  db.set({
    id: currentId,
    messages: [],
    timestamp: Date.now()
  });
}

function onLoad() {
  const $select = document.getElementById("model-select");
  const $input = document.getElementById("chat-input");
  const $buttonChat = document.getElementById("chat-button");
  const $buttonStop = document.getElementById("stop-button");
  const $buttonClean = document.getElementById("clean-button");

  const $messages = document.getElementById("messages");

  function createMarkdownInfo(info) {
    if (!info) {
      return '';
    }
    const { model, tokens, duration } = info;
    const speed = tokens / duration;
    return `
  \`\`\`
  Model: ${model} 
  Tokens: ${tokens} 
  Duration: ${duration.toFixed(2)} Sec 
  Speed: ${speed.toFixed(2)} Token/s
  \`\`\`
  `;
  }

  function createMessageForYou(message) {
    const $message = document.createElement("div");
    $message.classList.add("message-you");
    $message.textContent = `You: ${message}`;
    return $message;
  }

  function createMessageForAI(message) {
    const $message = document.createElement("div");
    $message.classList.add("message-ai");
    $message.classList.add("markdown-body");
    $message.innerHTML = marked.parse(`AI: ${message}`);
    return $message;
  }

  function getLatestMessage() {
    const list = Array.from(document.querySelectorAll(".message-ai"));
    const $message = list[list.length - 1];
    return $message;
  }
  
  // 获取数据
  db.get(currentId).then(conversation => {
    messages = conversation.messages || [];
    messages.forEach(item => {
      if (item.role === "user") {
        $messages.appendChild(createMessageForYou(item.content));
      }
      if (item.role === "assistant") {
        $messages.appendChild(createMessageForAI(item.content + createMarkdownInfo(item.info)));
      }
    });
    $messages.scrollTo(0, $messages.scrollHeight);
    hljs.highlightAll();
  });
  // 初始化
  // 1. 获取模型列表
  // 2. 获取历史对话
  init();

  // 选择模型
  $select.addEventListener("change", (e) => {
    currentModel = e.target.value;
    localStorage.setItem("code-assist.currentModel", currentModel);
  });

  function sendMessage() {
    const message = $input.value;
    if (message) {
      $messages.appendChild(createMessageForYou(message));
      chatStart(message);
      $input.value = "";
    }
  }
  // 发送消息
  $buttonChat.addEventListener("click", () => {
    sendMessage();
  });

  // 允许按 Enter 键发送消息
  $input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // 中断消息
  $buttonStop.addEventListener("click", () => {
    chatStop();
  });

  // 清空消息
  $buttonClean.addEventListener("click", () => {
    messages = [];
    $messages.innerHTML = [];
    cleanData();
  });

  // 接受消息
  let contentTemp = "";
  let tokens = 0;
  let startTime = 0;
  let endTime = 0;
  window.addEventListener("message", (e) => {
    const type = e.data.type;
    if (type === "chat-pre") {
      contentTemp = `...`;
      $messages.appendChild(createMessageForAI(contentTemp));
      $messages.scrollTo(0, $messages.scrollHeight);
      $input.disabled = true;
      $buttonChat.disabled = true;
    }
    if (type === "chat-start") {
      const $message = getLatestMessage();
      contentTemp = '';
      $message.innerHTML = marked.parse(contentTemp);
      $messages.scrollTo(0, $messages.scrollHeight);
    } else if (type === "chat-data") {
      const $message = getLatestMessage();
      const json = e.data.text;
      const data = JSON.parse(json);
      const text = data.message.content;
      if (startTime === 0) {
        startTime = new Date(data.created_at).getTime();
      }
      endTime = new Date(data.created_at).getTime();
      contentTemp += text;
      $message.innerHTML = marked.parse(contentTemp);
      $messages.scrollTo(0, $messages.scrollHeight);
      tokens++;
    } else if (type === "chat-end") {
      const duration = (endTime - startTime) / 1000;
      chatEnd(contentTemp, { model: currentModel, tokens, duration });
      contentTemp += createMarkdownInfo({ model: currentModel, tokens, duration });
      const $message = getLatestMessage();
      $message.innerHTML = marked.parse(contentTemp);
      $messages.scrollTo(0, $messages.scrollHeight);
      hljs.highlightAll();
      tokens = 0;
      startTime = 0;
      endTime = 0;
      $input.disabled = false;
      $buttonChat.disabled = false;
    } else if (type === "tags-end") {
      const json = e.data.text;
      const models = json.models || [];
      models.sort((a, b) => a.name.localeCompare(b.name));
      $select.innerHTML = "";
      models.forEach((model) => {
        const $option = document.createElement("option");
        $option.value = model.name;
        $option.textContent = `${model.name}`;
        if ($option.value === currentModel) {
          $option.selected = true;
        }
        $select.appendChild($option);
      });
    }
  });
}

window.addEventListener("load", onLoad);
