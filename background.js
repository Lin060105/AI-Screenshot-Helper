const MESSAGE_TYPES = {
  CAPTURE_VISIBLE_TAB: "AI_HELPER_CAPTURE_VISIBLE_TAB",
  START_CAPTURE: "AI_HELPER_START_CAPTURE",
  GENERATE_CONTENT: "AI_HELPER_GENERATE_CONTENT"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === MESSAGE_TYPES.GENERATE_CONTENT) {
    generateContent(message.payload)
      .then((text) => {
        sendResponse({ ok: true, text });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || "AI API 請求失敗。"
        });
      });
    return true;
  }

  if (message.type !== MESSAGE_TYPES.CAPTURE_VISIBLE_TAB) {
    return false;
  }

  chrome.tabs.captureVisibleTab(
    sender.tab && sender.tab.windowId ? sender.tab.windowId : undefined,
    { format: "png" },
    (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError.message || "Unable to capture the current tab."
        });
        return;
      }

      sendResponse({
        ok: true,
        dataUrl
      });
    }
  );

  return true;
});

async function generateContent(payload) {
  const provider = payload && payload.provider;

  if (provider === "gemini") {
    return callGemini(payload);
  }

  if (provider === "openai") {
    return callOpenAI(payload);
  }

  if (provider === "anthropic") {
    return callAnthropic(payload);
  }

  if (provider === "deepseek") {
    return callDeepSeek(payload);
  }

  throw new Error("不支援的 AI 供應商。");
}

async function callGemini(payload) {
  const parts = [
    { text: `${payload.systemPrompt}\n\n使用者問題：${payload.userText}` }
  ];

  if (payload.imageDataUrl) {
    parts.push({
      inline_data: {
        mime_type: "image/png",
        data: stripDataUrlPrefix(payload.imageDataUrl)
      }
    });
  }

  const data = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(payload.modelName)}:generateContent?key=${encodeURIComponent(payload.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ]
      })
    }
  );

  const partsOut = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts || []
    : [];

  return partsOut.map((part) => part.text || "").filter(Boolean).join("\n").trim();
}

async function callOpenAI(payload) {
  const content = [
    {
      type: "input_text",
      text: `${payload.systemPrompt}\n\n使用者問題：${payload.userText}`
    }
  ];

  if (payload.imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: payload.imageDataUrl
    });
  }

  const data = await requestJson("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${payload.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: payload.modelName,
      input: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  if (data && data.output_text) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data && data.output) ? data.output : [];
  return output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .map((item) => item.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callAnthropic(payload) {
  const content = [];

  if (payload.imageDataUrl) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: stripDataUrlPrefix(payload.imageDataUrl)
      }
    });
  }

  content.push({
    type: "text",
    text: payload.userText
  });

  const data = await requestJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": payload.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: payload.modelName,
      max_tokens: 1200,
      system: payload.systemPrompt,
      messages: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  return (Array.isArray(data && data.content) ? data.content : [])
    .map((item) => item.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callDeepSeek(payload) {
  if (payload.imageDataUrl) {
    throw new Error("DeepSeek 官方 Chat API 目前不支援圖片輸入。請刪除截圖後用文字詢問，或改用 Gemini / OpenAI / Claude。");
  }

  const data = await requestJson("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${payload.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: payload.modelName,
      stream: false,
      messages: [
        {
          role: "system",
          content: payload.systemPrompt
        },
        {
          role: "user",
          content: payload.userText
        }
      ]
    })
  });

  return data && data.choices && data.choices[0] && data.choices[0].message
    ? (data.choices[0].message.content || "").trim()
    : "";
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && data.error
      ? data.error.message || data.error.type || JSON.stringify(data.error)
      : response.statusText;
    throw new Error(message || `HTTP ${response.status}`);
  }

  return data;
}

function stripDataUrlPrefix(dataUrl) {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "start-capture") {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (!activeTab || !activeTab.id) {
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, {
      type: MESSAGE_TYPES.START_CAPTURE
    });
  });
});
