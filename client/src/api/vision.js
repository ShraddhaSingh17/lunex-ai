export const analyzeImage = async (image, prompt = "") => {
    const response = await fetch("http://localhost/lunex-ai/server/vision.php",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image,
                prompt, 
            }),
        }
    );
    const data = await response.json();
    return data.reply;
};