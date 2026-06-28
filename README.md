# AI Screenshot Helper

## 版本選擇與下載

> [!NOTE]
> GitHub 預設下載的是已測試版。未測試版會放在獨立分支。

- **已測試版**：使用 `main` 分支，這是已實測、建議一般使用者下載的版本。
- **未測試版**：使用 `experimental-multi-api` 分支，包含多家 AI API 支援，但還沒側試過，因為我沒錢買api。

下載方式：

1. 到 GitHub 專案頁面。
2. 點選左上方分支選單。
3. 選擇 `main` 下載穩定版，或選擇 `experimental-multi-api` 下載未測試版。
4. 點選 **Code** → **Download ZIP**。

AI Screenshot Helper 是一個 Chrome 擴充功能，可以讓你在網頁上框選畫面截圖，並把截圖和你的問題一起送到 Gemini Vision 進行分析。

> [!IMPORTANT]
> 本軟體僅供教育研究用途。使用者需自行確認使用情境是否合法、是否符合學校或平台規範，並自行承擔使用本工具所產生的責任。

## 教學文件

- [如何申請 Gemini API Key](docs/GEMINI_API_KEY.md)
- [Ulearn 使用示範](docs/ULEARN_USAGE.md)

## 從零開始安裝

### 1. 下載專案

如果你熟悉 Git，可以使用：

```powershell
git clone https://github.com/Lin060105/AI-Screenshot-Helper.git
```

也可以在 GitHub 頁面點選 **Code**，再點 **Download ZIP**，下載後解壓縮。

### 2. 開啟 Chrome 擴充功能頁面

在 Chrome 網址列輸入：

```text
chrome://extensions
```

或是從這裡點進去

![開啟擴充功能](Sample%20image/stepA.jpg)

### 3. 開啟開發人員模式並點選載入未封裝項目

在右上角打開 **開發人員模式** 後點選 **載入未封裝項目** 。

![點選載入未封裝項目](Sample%20image/stepB.jpg)

### 4. 選擇專案資料夾

點選 **載入未封裝項目**。

選擇這個專案資料夾，也就是包含 `manifest.json` 的那一層資料夾。

![選擇擴充功能資料夾](Sample%20image/stepC.jpg)

### 5. 設定 Gemini API Key

安裝完成後，打開任意一般網頁，右下角會出現 AI Screenshot Helper 的小按鈕。

打開面板後，在 **Gemini API 設定** 裡貼上你的 API Key，然後按 **儲存**。

如果你還沒有 API Key，請看這份教學：

[如何申請 Gemini API Key](docs/GEMINI_API_KEY.md)

### 6. 開始使用

1. 開啟任意一般網頁。
2. 點開右下角的 AI Screenshot Helper。
3. 按 **截圖** 。
4. 用滑鼠拖曳選取想分析的畫面區域。
5. 輸入你的問題。
6. 按 **送出**，等待 Gemini 回覆。

更完整的操作示範請看：

[Ulearn 使用示範](docs/ULEARN_USAGE.md)

## Gemini 模型設定

預設模型是：

```text
gemini-flash-latest
```

如果無法使用這個模型，可以在面板中的模型欄位改成其他可用模型，例如：

```text
gemini-2.5-flash
```

詳細請看 [如何申請 Gemini API Key](docs/GEMINI_API_KEY.md) ，內有除錯教學

## 權限說明

這個擴充功能會要求以下權限：

- `activeTab`：在你主動截圖時，擷取目前分頁畫面。
- `storage`：在本機儲存 Gemini API Key 與模型名稱。
- `scripting`：讓擴充功能可以在網頁中顯示操作面板。
- `<all_urls>`：讓操作面板可以出現在一般網頁上。

## 隱私說明

Gemini API Key 只會儲存在 Chrome 的本機擴充功能儲存空間，也就是 `chrome.storage.local`。

這個專案不會把你的 API Key 存進程式碼，也不會上傳到 GitHub。

只有在你按下 **送出** 時，截圖內容與文字問題才會送到 Google Gemini API。

## 專案結構

```text
.
├── background.js
├── content.js
├── manifest.json
├── style.css
├── ui.html
├── README.md
├── LICENSE
├── docs/
│   ├── GEMINI_API_KEY.md
│   └── ULEARN_USAGE.md
└── Sample image/
    ├── step1.jpg
    ├── step2.jpg
    ├── step3.jpg
    ├── step4.jpg
    ├── step5.jpg
    ├── step5-1.jpg
    ├── stepA.jpg
    ├── stepB.jpg
    ├── stepC.jpg
    ├── step甲.jpg
    ├── step乙.jpg
    ├── step丙.jpg
    └── step丁.jpg
```

## 開發方式

這個專案沒有 build step。修改檔案後，到 `chrome://extensions` 按重新載入即可測試。

## License

本專案採用 MIT License。詳見 [LICENSE](LICENSE)。
