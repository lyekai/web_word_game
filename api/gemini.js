export default async function handler(req, res) {
    // 只允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 從環境變數讀取 API Key (安全！)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY' });
    }

    const {
        userSentence,
        correctSelected,
        wrongSelected,
        missingWords,
        targetAnswers,
        sentencePrompt,
        roundIndex
    } = req.body;

    const systemInstruction = 
        "你是一位國中一年級英文老師。請根據『原始圖片包含的正確單字』進行回饋。" +
        "1. 禁止使用任何 Markdown 符號（如 ** 或 __）。" +
        "2. 單字提示：請針對『學生遺漏的所有正確單字』逐一提供外觀、特徵或位置線索，不准說出英文單字本身。" +
        "3. 畫面引導：必須嚴格參考『原始圖片正確單字』。每次建議增加一個簡單細節。";

    const promptText = 
        `【教學現況】這是第 ${roundIndex + 1} 次回饋。\n` +
        `圖片中真實存在的正確單字: ${targetAnswers.join(", ")}\n` +
        `學生選中的正確單字: ${correctSelected.join(", ")}\n` +
        `學生選錯的單字: ${wrongSelected.join(", ")}\n` +
        `學生遺漏的單字: ${missingWords.join(", ")}\n` +
        `學生目前造句: 『${userSentence}』\n` +
        `要求句型: 『${sentencePrompt}』\n\n` +
        "請務必依照以下編號順序回報，以下三個段落每段之間換一行即可：\n" +
        "1. 單字提示：針對遺漏單字提供線索\n" +
        "2. 文法修正：檢查句子文法與單字拼法\n" +
        "3. 畫面引導建議：如何讓句子更接近圖片內容";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] }
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            return res.status(response.status).json({ error: errData });
        }

        const data = await response.json();
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/1\. /g, "\n1. ").replace(/\*\*/g, "");

        return res.status(200).json({ result: rawText });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}