export const sendMessage = async (message) => {
    const res = await fetch("http://localhost/lunex-ai/server/chat.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
    });

    const data = await res.json();

    console.log("RAW GEMINI RESPONSE:", data);

    return (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response from LUNEX"
    );
};
