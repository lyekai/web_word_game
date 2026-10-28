// Vercel Serverless Function: api/generate-image.js
// Set POLLINATIONS_API_KEY in Vercel Project Settings > Environment Variables.
// Never put the secret key in frontend code or commit it to the repository.

export const config = {
    maxDuration: 60
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        console.error("POLLINATIONS_API_KEY is not configured");
        return res.status(500).json({
            error: "伺服器尚未設定 Pollinations API Key"
        });
    }

    const promptText = req.body?.promptText;
    if (typeof promptText !== "string" || !promptText.trim()) {
        return res.status(400).json({ error: "Missing promptText" });
    }

    // Limit user input length and ensure the sentence is the main subject of the prompt.
    const sentence = promptText.trim().slice(0, 1000);
    const prompt = [
        "Children's storybook style illustration based on this English sentence:",
        `\"${sentence}\".`,
        "Depict the people, animals, objects, actions, and setting described in the sentence.",
        "Cute, vivid colors, clean lines, friendly educational illustration, square composition.",
        "Do not include words, letters, captions, or a watermark."
    ].join(" ");

    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
        model: "black-forest-labs/flux.1-schnell",
        width: "512",
        height: "512",
        nologo: "true"
    });
    const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?${params.toString()}`;

    try {
        const upstreamResponse = await fetch(imageUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "image/*"
            },
            signal: AbortSignal.timeout(55000)
        });

        if (!upstreamResponse.ok) {
            const upstreamText = await upstreamResponse.text();
            // Log status and a short error only. Never log the API key or request headers.
            console.error("Pollinations API error", {
                status: upstreamResponse.status,
                message: upstreamText.slice(0, 1000)
            });
            return res.status(502).json({
                error: "Pollinations 圖片生成失敗",
                upstreamStatus: upstreamResponse.status,
                details: upstreamText.slice(0, 500)
            });
        }

        const contentType = upstreamResponse.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) {
            const responseText = await upstreamResponse.text();
            console.error("Pollinations returned non-image response", {
                contentType,
                message: responseText.slice(0, 500)
            });
            return res.status(502).json({
                error: "Pollinations 回傳的內容不是圖片",
                details: contentType || "Missing Content-Type"
            });
        }

        const imageBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
        if (imageBuffer.length === 0) {
            return res.status(502).json({ error: "Pollinations 回傳空白圖片" });
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", String(imageBuffer.length));
        res.setHeader("Cache-Control", "no-store, max-age=0");
        return res.status(200).send(imageBuffer);
    } catch (error) {
        console.error("Image generation request failed", {
            name: error?.name,
            message: error?.message
        });
        return res.status(502).json({
            error: "無法完成圖片生成請求",
            details: error?.name === "TimeoutError"
                ? "圖片生成逾時，請稍後再試"
                : "請查看 Vercel Functions Logs"
        });
    }
}
