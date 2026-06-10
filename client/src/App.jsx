import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { sendMessage } from "./api/gemini";
import { analyzeImage } from "./api/vision";

function App() {
    const [input, setInput] = useState("");
    const [chat, setChat] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [captureTime, setCaptureTime] = useState("--");
    const [eventLogs, setEventLogs] = useState(["SYSTEM BOOT COMPLETE"]);
    const [visionData, setVisionData] = useState({
        status: "STANDBY",
        object: "None",
        confidence: "0%",
    });
    const [booting, setBooting] = useState(true);
    const [metrics, setMetrics] = useState({
        cpu: 42,
        memory: 68,
    });

    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.onstart = () => {
            console.log("Recognition started");
            setIsListening(true);
        };

        recognition.onend = () => {
            console.log("Recognition ended");
            setIsListening(false);
            addLog("VOICE LISTENING");
        };

        recognition.onerror = (event) => {
            console.log("Recognition error:", event.error);
        };

        recognition.continuous = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            console.log("VOICE DETECTED:", text);
            addLog(`COMMAND: ${text}`);
            setInput(text);
            handleSend(text);
        };

        recognitionRef.current = recognition;
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat, isThinking]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setBooting(false);
        }, 4000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setMetrics({
                cpu: Math.floor(Math.random() * 30) + 50,
                memory: Math.floor(Math.random() * 20) + 60,
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const startListening = () => {
        try {
            recognitionRef.current?.stop();
            recognitionRef.current?.start();
        } catch (e) {
            console.log(e);
        }
    };

    const speak = (text) => {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) {
            window.speechSynthesis.onvoiceschanged = () => {
                speak(text);
            };
            return;
        }
        const preferredVoice =
            voices.find(
                (v) =>
                    v.name.toLowerCase().includes("female") ||
                    v.name.toLowerCase().includes("zira") ||
                    v.name.toLowerCase().includes("google us english"),
            ) ||
            voices.find((v) => v.lang === "en-US") ||
            voices[0];

        speech.voice = preferredVoice;

        speech.lang = "en-US";
        speech.rate = 1.5;
        speech.pitch = 1.1;
        speech.volume = 1;
        window.speechSynthesis.speak(speech);
    };

    const handleCommand = (text) => {
        const command = text.toLowerCase();

        if (command.includes("open youtube")) {
            window.open("https://youtube.com", "_blank");
            return "Opening Youtube";
        }

        if (command.includes("open google")) {
            window.open("https://google.com", "_blank");
            return "Opening Google";
        }

        if (command.includes("what time is it")) {
            return `Current time is ${new Date().toLocaleTimeString()}`;
        }

        return null;
    };

    const typeResponse = async (text) => {
        let currentText = "";

        const botMsg = {
            role: "lunex",
            text: "",
        };
        setChat((prev) => [...prev, botMsg]);
        setIsTyping(true);
        for (let i = 0; i < text.length; i++) {
            currentText += text[i];
            setChat((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "lunex",
                    text: currentText,
                };
                return updated;
            });
            await new Promise((resolved) => setTimeout(resolved, 15));
        }
        setIsTyping(false);
    };

    const handleSend = async (customText = "") => {
        const text = typeof customText === "string" ? customText : input;
        if (!text.trim()) return;

        const userMsg = { role: "user", text };
        setChat((prev) => [...prev, userMsg]);

        const commandResult = handleCommand(text);

        if (commandResult) {
            const botMsg = { role: "lunex", text: commandResult };
            setChat((prev) => [...prev, botMsg]);
            speak(commandResult);
            setInput("");
            return;
        }

        setIsThinking(true);
        try {
            const reply = await sendMessage(text);

            setIsThinking(false);

            await typeResponse(reply);

            speak(reply);
        } catch (error) {
            console.error(error);

            setChat((prev) => [
                ...prev,
                {
                    role: "lunex",
                    text: "Unable to contact AI service.",
                },
            ]);
        } finally {
            setIsThinking(false);
        }
        setInput("");
    };

    const addLog = (message) => {
        const time = new Date().toLocaleTimeString();
        setEventLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 7)]);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraActive(true);
            addLog("CAMERA ACTIVATED");
        } catch (error) {
            console.error(error);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        addLog("CAMERA DEACTIVATED");
    };

    const captureFrame = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL("image/png");
        setCapturedImage(imageData);
        setVisionData({
            status: "ANALYZING",
            object: "...",
            confidence: "...",
        });
        addLog("FRAME CAPTURED");
        const result = await analyzeImage(imageData);
        speak(result);
        addLog("VISION ANALYSIS COMPLETE");
        setVisionData({
            status: "LOCKED",
            object: result,
            confidence: "AI",
        });
        setCaptureTime(new Date().toLocaleTimeString());
    };

    const askVision = async () => {
        if (!capturedImage) return;
        const result = await analyzeImage(
            capturedImage,
            "Describe everything visible in this image.",
        );
        setChat((prev) => [
            ...prev,
            {
                role: "lunex",
                text: result,
            },
        ]);
        speak(result);
    };

    if (booting) {
        return (
            <div className="h-screen bg-black text-fuchsia-300 flex items-center justify-center">
                <div className="w-[600px] max-w-[90%]">
                    <div className="text-2xl tracking-widest mb-8">
                        LUNEX INITIALIZATION
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>CORE SYSTEM ONLINE</div>
                        <div>VOICE MODULE ONLINE</div>
                        <div>COMMAND INTERFACE ONLINE</div>
                        <div>MEMORY SYSTEM ONLINE</div>
                        <div>NEURAL MATRIX ONLINE</div>
                    </div>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4 }}
                        className="h-1 bg-fuchsia-400 mt-8"
                    />
                </div>
            </div>
        );
    }
    return (
        <div className="absolute inset-0 bg-black overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(180,0,255,0.12),_transparent_60%)]"></div>

            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,rgba(180,0,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(180,0,255,0.15)_1px,transparent_1px)] bg-[size:60px_60px]"></div>

            <div className="absolute inset-0 pointer-events-none z-50">
                <div className="absolute top-4 left-4 w-10 h-10 border-l border-t border-fuchsia-400/40"></div>
                <div className="absolute top-4 right-4 w-10 h-10 border-r border-t border-fuchsia-400/40"></div>
                <div className="absolute bottom-4 left-4 w-10 h-10 border-l border-b border-fuchsia-400/40"></div>
                <div className="absolute bottom-4 right-4 w-10 h-10 border-r border-b border-fuchsia-400/40"></div>
            </div>

            <div className="relative z-10 flex justify-between items-center px-6 py-4 border-b border-fuchsia-400/20 backdrop-blur-xl bg-black/30">
                <div className="text-fuchsia-300 tracking-widest text-sm">
                    LUNEX CORE SYSTEM
                </div>

                <div className="flex items-center gap-2 text-green-400 text-xs animate-pulse">
                    ● ONLINE
                </div>
            </div>

            <div className="relative z-10 h-64 flex flex-col justify-center items-center py-6 ">
                <motion.div
                    animate={{
                        scale: isListening
                            ? [1, 1.08, 1.15, 1.08, 1]
                            : isThinking
                              ? [1, 1.03, 1.06, 1.03, 1]
                              : 1,
                    }}
                    transition={{
                        duration: isListening ? 1.5 : 2,
                        repeat: isListening || isThinking ? Infinity : 0,
                    }}
                    className="relative w-32 h-32">
                    <motion.div
                        animate={
                            isListening
                                ? {
                                      scale: [1, 1.3, 1.6],
                                      opacity: [0.6, 0.3, 0],
                                  }
                                : {
                                      scale: 1,
                                      opacity: 0,
                                  }
                        }
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                        className="absolute inset-[-20px] rounded-full border border-fuchsia-400"
                    />
                    <motion.div
                        animate={
                            isListening
                                ? {
                                      scale: [1, 1.4, 1.8],
                                      opacity: [0.4, 0.2, 0],
                                  }
                                : {
                                      scale: 1,
                                      opacity: 0,
                                  }
                        }
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: 0.5,
                            ease: "easeOut",
                        }}
                        className="absolute inset-[-20px] rounded-full border border-fuchsia-300/60"
                    />

                    <motion.div
                        animate={{
                            rotate: 360,
                            scale: isListening ? 1.1 : 1,
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute inset-[-20px] rounded-full border border-fuchsia-400/40"
                    />
                    <motion.div
                        animate={{
                            rotate: -360,
                            scale: isListening ? 1.15 : 1,
                        }}
                        transition={{
                            duration: 10,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute inset-[-10px] rounded-full border border-fuchsia-300/50"
                    />

                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute inset-0">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(0,255,255,0.8)]" />

                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(0,255,255,0.8)]" />

                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(0,255,255,0.8)]" />

                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
                    </motion.div>

                    <motion.div
                        animate={{
                            boxShadow: isListening
                                ? "0 0 80px rgba(217,70,239,0.8)"
                                : isThinking
                                  ? "0 0 50px rgba(217,70,239,0.5)"
                                  : "0 0 20px rgba(217,70,239,0.2)",
                        }}
                        className="absolute inset-0 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10"
                    />

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                            animate={{
                                scale: isListening
                                    ? [1, 1.08, 1.15, 1.08, 1]
                                    : isThinking
                                      ? [1, 1.03, 1.06, 1.03, 1]
                                      : 1,
                            }}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-300 to-purple-600"
                        />
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white" />
                </motion.div>

                <div className="mt-8 text-center text-fuchsia-300 text-xs tracking-[0.3em]">
                    {isListening
                        ? "AWAITING COMMAND"
                        : isThinking
                          ? "ANALYZING COMMAND"
                          : "SYSTEM READY"}
                </div>
            </div>
            <div className="absolute left-6 top-24 w-56">
                <div className="bg-black/30 backdrop-blur-xl border border-fuchsia-400/20 rounded-xl p-4">
                    <div className="text-fuchsia-300 text-xs tracking-widest mb-4">
                        SYSTEM METRICS
                    </div>
                    <div className="space-y-2 text-sm">
                        <div>
                            CPU
                            <div className="h-1 bg-fuchsia-900 rounded mt-1">
                                <div
                                    className="h-1 bg-fuchsia-400 rounded"
                                    style={{ width: `${metrics.cpu}%` }}
                                />
                            </div>
                            <div>{metrics.cpu}%</div>
                        </div>
                        <div>
                            MEMORY
                            <div className="h-1 bg-fuchsia-900 rounded mt-1">
                                <div
                                    className="h-1 bg-fuchsia-400 rounded"
                                    style={{ width: `${metrics.memory}%` }}
                                />
                            </div>
                            <div>{metrics.memory}%</div>
                        </div>
                        <div className="text-green-400">NETWORK ONLINE</div>
                    </div>
                </div>
            </div>

            <div className="absolute right-6 top-24 w-56">
                <div className="bg-black/30 backdrop-blur-xl border border-fuchsia-400/20 rounded-xl p-4">
                    <div className="text-fuchsia-300 text-xs tracking-widest mb-4">
                        MODULE STATUS
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="text-green-400">● VOICE READY</div>
                        <div className="text-yellow-400">● MEMORY ACTIVE</div>
                        <div
                            className={
                                cameraActive ? "text-green-400" : "text-red-400"
                            }>
                            ●{" "}
                            {cameraActive ? "CAMERA ONLINE" : "CAMERA OFFLINE"}
                        </div>
                        <div className="text-fuchsia-300">● AI ACTIVE</div>
                    </div>
                </div>
            </div>

            <div className="absolute right-6 top-[320px] w-56">
                <div className="bg-black/30 backdrop-blur-xl border border-fuchsia-400/20 rounded-xl p-3">
                    <div className="text-fuchsia-300 text-xs tracking-widest mb-3">
                        CAMERA VISION
                    </div>
                    <div className="relative">
                        {cameraActive && (
                            <motion.div
                                animate={{
                                    top: ["0%", "100%", "0%"],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                                className="absolute left-0 right-0 w-full h-[2px] bg-fuchsia-400/70 shadow-[0_0_10px_rgba(217,70,239,0.8)]"
                            />
                        )}
                        {cameraActive && (
                            <div className="absolute top-8 left-3 text-[10px] text-fuchsia-300 space-y-1 font-mono">
                                <div>TARGET ID: 0021</div>
                                <div>STATUS: TRACKING</div>
                                <div>LATENCY: 12ms</div>
                                <div>SIGNAL: 98%</div>
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full rounded-lg border border-fuchsia-400/20"
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <motion.div
                                animate={{
                                    x: [-5, 5, -5],
                                    y: [3, -3, 3],
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                                className="w-24 h-24 border border-fuchsia-400/60 rounded-md"
                            />
                        </div>
                        <div className="absolute top-2 left-2 w-5 h-5 border-l border-t border-fuchsia-400"></div>
                        <div className="absolute top-2 right-2 w-5 h-5 border-r border-t border-fuchsia-400"></div>
                        <div className="absolute bottom-2 left-2 w-5 h-5 border-l border-b border-fuchsia-400"></div>
                        <div className="absolute bottom-2 right-2 w-5 h-5 border-r border-b border-fuchsia-400"></div>
                        <div className="absolute bottom-2 left-2 text-[10px] text-fuchsia-300 tracking-widest">
                            {cameraActive ? "TARGET LOCK" : "STANDBY"}
                        </div>
                        <div className="absolute top-2 left-2 text-[10px] text-green-400 animate-pulse">
                            {cameraActive ? "SCANNING..." : "OFFLINE"}
                        </div>
                        <div className="absolute top-2 right-2 text-[10px] text-red-400 animate-pulse">
                            ● LIVE
                        </div>
                        <div className="absolute bottom-2 right-2 text-[10px] text-fuchsia-300">
                            60 FPS
                        </div>
                    </div>
                    <button
                        onClick={startCamera}
                        className="w-full mt-3 py-2 rounded-lg border border-fuchsia-400/30 text-fuchsia-200">
                        ACTIVATE
                    </button>
                    <button
                        onClick={captureFrame}
                        className="w-full mt-2 py-2 rounded-lg border border-emerald-400/30 text-emerald-200">
                        CAPTURE FRAME
                    </button>
                    <button
                        onClick={askVision}
                        className="w-full mt-2 py-2 rounded-lg border border-fuchsia-400/30 text-fuchsia-200">
                        ANALYSE
                    </button>
                    <button
                        onClick={() => {
                            setCapturedImage(null);
                            setVisionData({
                                status: "STANDBY",
                                object: "NONE",
                                confidence: "0%",
                            });
                        }}
                        className="w-full mt-2 py-2 rounded-lg border border-red-400/30 text-red-200">
                        DISCARD
                    </button>
                    <button
                        onClick={stopCamera}
                        className="w-full mt-2 py-2 rounded-lg border border-red-400/30 text-red-200">
                        DEACTIVATE
                    </button>
                </div>
            </div>

            <div className="absolute left-6 top-[320px] w-56">
                <div className="bg-black/30 backdrop-blur-xl border border-fuchsia-400/20 rounded-xl p-4">
                    <div className="text-fuchsia-300 text-xs tracking-widest mb-4">
                        VISION ANALYSIS
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            STATUS:
                            <span className="text-green-400 ml-2">
                                {visionData.status}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            OBJECT:
                            <span className="text-fuchsia-300 ml-2">
                                {visionData.object}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            CONFIDENCE:
                            <span className="text-yellow-300 ml-2">
                                {visionData.confidence}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            TIME:
                            <span className="text-fuchsia-300 ml-2">
                                {captureTime}
                            </span>
                        </div>
                        {capturedImage && (
                            <div className="max-h-32 overflow-y-auto mt-3">
                                <div className="text-fuchsia-300 text-xs tracking-widest mb-2">
                                    CAPTURED FRAME
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute left-6 top-[560px] w-56 h-48">
                <div className="bg-black/30 backdrop-blur-xl border border-fuchsia-400/20 rounded-xl p-4 h-full">
                    <div className="text-fuchsia-300 text-xs tracking-widest mb-4">
                        EVENT LOG
                    </div>
                    <div className="overflow-y-auto h-[120px] space-y-2 text-xs">
                        {eventLogs.map((log, index) => (
                            <div
                                key={index}
                                className="text-fuchsia-200 border-b border-fuchsia-400/10 pb-1">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-3 ml-72 mr-72 mb-4 rounded-2xl border border-fuchsia-400/20 bg-black/20 backdrop-blur-xl">
                {chat.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`max-w-[70%] p-3 rounded-xl backdrop-blur-md border ${
                            msg.role === "user"
                                ? "ml-auto bg-fuchsia-500/10 border border-fuchsia-400/30 text-fuchsia-200 backdrop-blur-md shadow-[0_0_15px_rgba(217,70,239,0.15)]"
                                : "mr-auto bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 backdrop-blur-md shadow-[0_0_15px_rgba(0,255,150,0.12)]"
                        }`}>
                        <>
                            {msg.text}
                            {msg.role === "lunex" &&
                                i === chat.length - 1 &&
                                isTyping}
                        </>
                    </motion.div>
                ))}

                {isThinking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mr-auto bg-yellow-500/10 border border-yellow-400/30 text-yellow-200 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                            <span>ANALYZING COMMAND</span>
                            <motion.span
                                animate={{
                                    opacity: [0, 1, 0],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                }}>
                                ●
                            </motion.span>
                        </div>
                    </motion.div>
                )}

                <div ref={chatEndRef} />
            </div>

            <div className="relative z-10 p-4 border-t border-fuchsia-400/20 flex gap-2 backdrop-blur-xl bg-black/40">
                <button
                    onClick={startListening}
                    className="bg-red-500/20 px-4 py-2 hover:bg-red-500/30 border border-red-400/40 rounded-lg text-red-200 shadow-[0_0_10px_rgba(217,70,239,0.15)]">
                    Talk
                </button>

                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask LUNEX..."
                    className="flex-1 p-3 bg-black/40 border border-fuchsia-400/30 text-white rounded-lg outline-none focus:border-fuchsia-300 focus:shadow-[0_0_10px_rgba(217,70,239,0.2)]"
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    className="px-6 py-2 bg-fuchsia-500/20 hover:bg-fuchsia-400/30 border border-fuchsia-400/40 rounded-lg text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.15)]">
                    EXECUTE
                </motion.button>
            </div>
        </div>
    );
}

export default App;
