export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { promptText } = req.body;
    if (!promptText) {
        return res.status(400).json({ error: 'Missing promptText' });
    }

    // 從 Vercel 環境變數安全讀取 Pollinations API Key
    const apiKey = process.env.POLLINATIONS_API_KEY;

    const encodedPrompt = encodeURIComponent(
        `children storybook style illustration, ${promptText}, vivid colors, cute, clean lines`
    );

    // 如果有設定 Key，帶上 key 參數解鎖付費通道的高優先級與快速生成
    let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
    if (apiKey) {
        imageUrl += `&key=${apiKey}`;
    }

    try {
        // 後端預先驗證圖片請求（包含帶入付費 Key 的 Authorization Header 雙重保障）
        const headers = {};
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(imageUrl, { method: 'GET', headers });

        if (!response.ok) {
            throw new Error(`Pollinations API 回應異常: ${response.status}`);
        }

        // 回傳成功可用的圖片 URL 給前端
        return res.status(200).json({ imageUrl });
    } catch (error) {
        console.error("Pollinations 繪圖失敗:", error);
        return res.status(500).json({ error: error.message });
    }
}