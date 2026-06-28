(() => {
  const ROOT_ID = "ai-helper-shadow-host";
  const MESSAGE_TYPES = {
    CAPTURE_VISIBLE_TAB: "AI_HELPER_CAPTURE_VISIBLE_TAB",
    START_CAPTURE: "AI_HELPER_START_CAPTURE",
    GENERATE_CONTENT: "AI_HELPER_GENERATE_CONTENT"
  };
  const STORAGE_KEYS = {
    PROVIDER: "aiProvider",
    PROVIDER_SETTINGS: "aiProviderSettings"
  };
  const PROVIDERS = {
    gemini: {
      label: "Gemini",
      defaultModel: "gemini-flash-latest",
      supportsImages: true
    },
    openai: {
      label: "OpenAI",
      defaultModel: "gpt-4.1-mini",
      supportsImages: true
    },
    anthropic: {
      label: "Claude",
      defaultModel: "claude-sonnet-4-5",
      supportsImages: true
    },
    deepseek: {
      label: "DeepSeek",
      defaultModel: "deepseek-chat",
      supportsImages: false
    }
  };
  const DEFAULT_PROVIDER = "gemini";
  const SYSTEM_PROMPT = "你是一個專業的程式設計助教，請閱讀圖片中的題目，給出正確答案，並用簡短的繁體中文解釋原因。";

  let shadowRoot = null;
  let panel = null;
  let body = null;
  let chatLog = null;
  let preview = null;
  let previewImage = null;
  let clearScreenshotButton = null;
  let promptInput = null;
  let captureButton = null;
  let sendButton = null;
  let providerSelect = null;
  let apiKeyInput = null;
  let modelInput = null;
  let saveKeyButton = null;
  let saveModelButton = null;
  let keyStatus = null;
  let collapseButton = null;
  let providerSettings = {};
  let croppedImageDataUrl = "";
  let isDraggingPanel = false;
  let didMovePanel = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  init().catch((error) => {
    console.error("[AI Screenshot Helper] Failed to initialize.", error);
  });

  async function init() {
    await createShadowUi();
    bindUiEvents();
    await restoreSettings();
    setPanelMinimized(true);
    addMessage("system", "請先選擇 AI 供應商並設定 API Key。Gemini、OpenAI、Claude 支援截圖；DeepSeek 目前支援純文字。");
  }

  async function createShadowUi() {
    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);

    shadowRoot = host.attachShadow({ mode: "open" });

    const [styleText, uiHtml] = await Promise.all([
      fetch(chrome.runtime.getURL("style.css")).then((response) => response.text()),
      fetch(chrome.runtime.getURL("ui.html")).then((response) => response.text())
    ]);

    const style = document.createElement("style");
    style.textContent = styleText;
    shadowRoot.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = uiHtml;
    shadowRoot.appendChild(wrapper);

    panel = shadowRoot.querySelector(".ai-helper-panel");
    body = shadowRoot.getElementById("aiHelperBody");
    chatLog = shadowRoot.getElementById("aiHelperChatLog");
    preview = shadowRoot.getElementById("aiHelperPreview");
    previewImage = shadowRoot.getElementById("aiHelperPreviewImage");
    clearScreenshotButton = shadowRoot.getElementById("aiHelperClearScreenshotButton");
    promptInput = shadowRoot.getElementById("aiHelperPromptInput");
    captureButton = shadowRoot.getElementById("aiHelperCaptureButton");
    sendButton = shadowRoot.getElementById("aiHelperSendButton");
    providerSelect = shadowRoot.getElementById("aiHelperProviderSelect");
    apiKeyInput = shadowRoot.getElementById("aiHelperApiKeyInput");
    modelInput = shadowRoot.getElementById("aiHelperModelInput");
    saveKeyButton = shadowRoot.getElementById("aiHelperSaveKeyButton");
    saveModelButton = shadowRoot.getElementById("aiHelperSaveModelButton");
    keyStatus = shadowRoot.getElementById("aiHelperKeyStatus");
    collapseButton = shadowRoot.getElementById("aiHelperCollapseButton");

    panel.style.pointerEvents = "auto";
  }

  function bindUiEvents() {
    const titlebar = shadowRoot.querySelector("[data-drag-handle]");
    titlebar.addEventListener("mousedown", startPanelDrag);
    window.addEventListener("mousemove", movePanel);
    window.addEventListener("mouseup", stopPanelDrag);

    captureButton.addEventListener("click", startCaptureFlow);
    clearScreenshotButton.addEventListener("click", clearScreenshot);
    sendButton.addEventListener("click", sendToAi);
    providerSelect.addEventListener("change", handleProviderChange);
    saveKeyButton.addEventListener("click", saveApiKey);
    saveModelButton.addEventListener("click", saveModelName);
    collapseButton.addEventListener("click", handleCollapseButtonClick);

    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === MESSAGE_TYPES.START_CAPTURE) {
        startCaptureFlow();
      }
    });
  }

  function startPanelDrag(event) {
    const isMinimized = panel.classList.contains("is-minimized");
    if (event.button !== 0 || (!isMinimized && event.target.closest("button"))) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    isDraggingPanel = true;
    didMovePanel = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    event.preventDefault();
  }

  function movePanel(event) {
    if (!isDraggingPanel) {
      return;
    }

    if (Math.abs(event.clientX - dragStartX) > 3 || Math.abs(event.clientY - dragStartY) > 3) {
      didMovePanel = true;
    }

    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = clamp(event.clientX - dragOffsetX, 0, maxLeft);
    const nextTop = clamp(event.clientY - dragOffsetY, 0, maxTop);

    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  }

  function stopPanelDrag() {
    isDraggingPanel = false;
  }

  function handleCollapseButtonClick(event) {
    if (didMovePanel) {
      event.preventDefault();
      event.stopPropagation();
      didMovePanel = false;
      return;
    }

    togglePanelSize();
  }

  function togglePanelSize() {
    setPanelMinimized(!panel.classList.contains("is-minimized"));
  }

  function setPanelMinimized(isMinimized) {
    panel.classList.toggle("is-minimized", isMinimized);
    body.classList.toggle("is-collapsed", isMinimized);
    collapseButton.textContent = isMinimized ? "" : "-";
    collapseButton.setAttribute("aria-label", isMinimized ? "Open AI Screenshot Helper" : "Minimize AI Screenshot Helper");
    collapseButton.title = isMinimized ? "Open" : "Minimize";
  }

  async function restoreSettings() {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.PROVIDER, STORAGE_KEYS.PROVIDER_SETTINGS]);
    providerSettings = stored[STORAGE_KEYS.PROVIDER_SETTINGS] || {};

    const provider = normalizeProvider(stored[STORAGE_KEYS.PROVIDER]);
    providerSelect.value = provider;
    applyProviderFields(provider);
  }

  async function saveApiKey() {
    const provider = normalizeProvider(providerSelect.value);
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      keyStatus.textContent = "請先輸入 API Key。";
      return;
    }

    providerSettings[provider] = {
      ...providerSettings[provider],
      apiKey,
      modelName: normalizeModelName(provider, modelInput.value)
    };
    await persistProviderSettings(provider);
    keyStatus.textContent = `${PROVIDERS[provider].label} API Key 已儲存。`;
  }

  async function saveModelName() {
    const provider = normalizeProvider(providerSelect.value);
    const modelName = normalizeModelName(provider, modelInput.value);
    modelInput.value = modelName;
    providerSettings[provider] = {
      ...providerSettings[provider],
      apiKey: apiKeyInput.value.trim(),
      modelName
    };
    await persistProviderSettings(provider);
    keyStatus.textContent = `模型已設定為 ${modelName}。`;
  }

  async function handleProviderChange() {
    const previousProvider = Object.keys(PROVIDERS).find((provider) => providerSelect.dataset.currentProvider === provider);
    if (previousProvider) {
      providerSettings[previousProvider] = {
        ...providerSettings[previousProvider],
        apiKey: apiKeyInput.value.trim(),
        modelName: normalizeModelName(previousProvider, modelInput.value)
      };
    }

    const provider = normalizeProvider(providerSelect.value);
    providerSelect.dataset.currentProvider = provider;
    applyProviderFields(provider);
    await persistProviderSettings(provider);
  }

  function applyProviderFields(provider) {
    const settings = providerSettings[provider] || {};
    const modelName = normalizeModelName(provider, settings.modelName);
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = modelName;
    providerSelect.dataset.currentProvider = provider;
    keyStatus.textContent = settings.apiKey
      ? `已載入 ${PROVIDERS[provider].label} 設定。`
      : `${PROVIDERS[provider].label} 預設模型：${modelName}`;
  }

  async function persistProviderSettings(provider) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PROVIDER]: provider,
      [STORAGE_KEYS.PROVIDER_SETTINGS]: providerSettings
    });
  }

  async function startCaptureFlow() {
    setButtonBusy(captureButton, true, "截圖中...");

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CAPTURE_VISIBLE_TAB
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "無法擷取目前分頁。");
      }

      await openCropOverlay(response.dataUrl);
    } catch (error) {
      addMessage("error", `截圖失敗：${error.message}`);
    } finally {
      setButtonBusy(captureButton, false, "截圖");
    }
  }

  function openCropOverlay(fullPageDataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const deviceRatio = window.devicePixelRatio || 1;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isSelecting = false;

        canvas.width = Math.round(viewportWidth * deviceRatio);
        canvas.height = Math.round(viewportHeight * deviceRatio);
        canvas.style.background = "rgba(15, 23, 42, 0.28)";
        canvas.style.cursor = "crosshair";
        canvas.style.inset = "0";
        canvas.style.position = "fixed";
        canvas.style.width = `${viewportWidth}px`;
        canvas.style.height = `${viewportHeight}px`;
        canvas.style.zIndex = "2147483647";
        document.documentElement.appendChild(canvas);

        drawOverlay();

        canvas.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }

          isSelecting = true;
          startX = event.clientX;
          startY = event.clientY;
          currentX = event.clientX;
          currentY = event.clientY;
          drawOverlay();
        });

        canvas.addEventListener("mousemove", (event) => {
          if (!isSelecting) {
            return;
          }

          currentX = event.clientX;
          currentY = event.clientY;
          drawOverlay();
        });

        canvas.addEventListener("mouseup", () => {
          if (!isSelecting) {
            return;
          }

          isSelecting = false;
          const rect = normalizeRect(startX, startY, currentX, currentY);
          canvas.remove();

          if (rect.width < 4 || rect.height < 4) {
            addMessage("system", "選取範圍太小，已取消截圖。");
            resolve();
            return;
          }

          cropImage(image, rect);
          resolve();
        });

        canvas.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            canvas.remove();
            resolve();
          }
        });
        canvas.tabIndex = 0;
        canvas.focus();

        function drawOverlay() {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.save();
          context.scale(deviceRatio, deviceRatio);
          context.fillStyle = "rgba(15, 23, 42, 0.36)";
          context.fillRect(0, 0, viewportWidth, viewportHeight);

          if (isSelecting) {
            const rect = normalizeRect(startX, startY, currentX, currentY);
            context.clearRect(rect.x, rect.y, rect.width, rect.height);
            context.strokeStyle = "#60a5fa";
            context.lineWidth = 2;
            context.setLineDash([8, 4]);
            context.strokeRect(rect.x, rect.y, rect.width, rect.height);
            context.fillStyle = "rgba(96, 165, 250, 0.12)";
            context.fillRect(rect.x, rect.y, rect.width, rect.height);
          }

          context.restore();
        }
      };

      image.onerror = () => {
        reject(new Error("截圖影像載入失敗。"));
      };

      image.src = fullPageDataUrl;
    });
  }

  function cropImage(image, rect) {
    const scaleX = image.naturalWidth / window.innerWidth;
    const scaleY = image.naturalHeight / window.innerHeight;
    const sourceX = Math.round(rect.x * scaleX);
    const sourceY = Math.round(rect.y * scaleY);
    const sourceWidth = Math.round(rect.width * scaleX);
    const sourceHeight = Math.round(rect.height * scaleY);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, sourceWidth);
    outputCanvas.height = Math.max(1, sourceHeight);

    const outputContext = outputCanvas.getContext("2d");
    outputContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height
    );

    croppedImageDataUrl = outputCanvas.toDataURL("image/png");
    previewImage.src = croppedImageDataUrl;
    preview.hidden = false;
    addMessage("system", "截圖完成，請輸入問題後送出。");
  }

  function clearScreenshot() {
    croppedImageDataUrl = "";
    previewImage.removeAttribute("src");
    preview.hidden = true;
    addMessage("system", "已刪除截圖，可以重新截圖。");
  }

  async function sendToAi() {
    const provider = normalizeProvider(providerSelect.value);
    const apiKey = apiKeyInput.value.trim();
    const modelName = normalizeModelName(provider, modelInput.value);
    const userText = promptInput.value.trim();

    if (!apiKey) {
      addMessage("error", `請先設定並儲存 ${PROVIDERS[provider].label} API Key。`);
      return;
    }

    if (croppedImageDataUrl && !PROVIDERS[provider].supportsImages) {
      addMessage("error", `${PROVIDERS[provider].label} 目前不支援圖片輸入。請刪除截圖後用文字詢問，或改用 Gemini / OpenAI / Claude。`);
      return;
    }

    if (!userText && !croppedImageDataUrl) {
      addMessage("error", "請輸入問題，或先截圖再送出。");
      return;
    }

    modelInput.value = modelName;
    providerSettings[provider] = {
      ...providerSettings[provider],
      apiKey,
      modelName
    };
    await persistProviderSettings(provider);

    const userMessage = userText || "請分析這張截圖。";
    addMessage("user", userMessage);
    const waitingMessage = addMessage("system", `${PROVIDERS[provider].label} 回覆中...`);
    setButtonBusy(sendButton, true, "送出中...");

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GENERATE_CONTENT,
        payload: {
          provider,
          apiKey,
          modelName,
          systemPrompt: SYSTEM_PROMPT,
          userText: userMessage,
          imageDataUrl: croppedImageDataUrl
        }
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "AI API 沒有回應。");
      }

      waitingMessage.remove();
      addMessage("ai", response.text || `${PROVIDERS[provider].label} 沒有回傳文字內容。`);
      promptInput.value = "";
    } catch (error) {
      waitingMessage.remove();
      addMessage("error", `${PROVIDERS[provider].label} API 錯誤：${buildApiErrorMessage(error.message, provider, modelName)}`);
    } finally {
      setButtonBusy(sendButton, false, "送出");
    }
  }

  function addMessage(type, text) {
    const message = document.createElement("div");
    message.className = `ai-helper-message ${type}`;
    message.textContent = text;
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
    return message;
  }

  function setButtonBusy(button, isBusy, label) {
    button.disabled = isBusy;
    button.textContent = label;
  }

  function normalizeRect(startX, startY, endX, endY) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    return { x, y, width, height };
  }

  function normalizeProvider(provider) {
    return PROVIDERS[provider] ? provider : DEFAULT_PROVIDER;
  }

  function normalizeModelName(provider, modelName) {
    const currentProvider = normalizeProvider(provider);
    const trimmed = (modelName || "").trim().replace(/^models\//, "");
    return trimmed || PROVIDERS[currentProvider].defaultModel;
  }

  function buildApiErrorMessage(message, provider, modelName) {
    if (/not found|not supported|ListModels/i.test(message)) {
      return `${message}\n\n目前供應商：${PROVIDERS[provider].label}\n目前模型：${modelName}\n請確認這個 API Key 可以使用該模型，或改回預設模型 ${PROVIDERS[provider].defaultModel}。`;
    }

    return message;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
