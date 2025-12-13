import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import api from "@/api/axios";
import toast from "react-hot-toast";

interface TypeSpeedText {
  id: string;
  content: string;
  difficulty: "easy" | "medium" | "hard";
}

interface TypingResult {
  total_characters: number;
  correct_characters: number;
  incorrect_characters: number;
  wpm: number;
  accuracy: number;
  time_taken: number;
}

export default function TypeSpeed() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<"easy" | "medium" | "hard">("easy");
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [generatedText, setGeneratedText] = useState<TypeSpeedText | null>(
    null,
  );

  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(60);

  const [result, setResult] = useState<TypingResult | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  useEffect(() => {
    setTimeRemaining(timeLimit);
  }, [timeLimit]);

  const textWords = useMemo(() => {
    if (!generatedText) return [];
    const words = generatedText.content
      .split(/\s+/)
      .filter((word) => word.length > 0);
    return words.map(
      (word, index) => word + (index < words.length - 1 ? " " : ""),
    );
  }, [generatedText]);

  useEffect(() => {
    let timer: number | null = null;
    if (gameStarted && !gameFinished && !isPaused && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer!);
            handleFinishGame(true);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timer) {
      clearInterval(timer);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameStarted, gameFinished, isPaused, timeRemaining, generatedText]);

  const handleFinishGame = useCallback(
    async (timeIsUp: boolean) => {
      if (!generatedText || !gameStartTime) return;

      setGameStarted(false);
      setGameFinished(true);

      let timeTaken = Math.floor((Date.now() - gameStartTime) / 1000);
      if (timeTaken < 1) timeTaken = 1;

      const wordsTyped = textWords.slice(0, currentWordIndex);
      const rawInput = [...wordsTyped, userInput].join("");

      const finalInput = rawInput.replace(/\s+/g, " ").trim();

      const textIdToSend =
        generatedText.id || `auto-${generatedText.difficulty}-${Date.now()}`;

      try {
        // If `id` is not provided OR the generated text is an auto-generated text
        // (id starts with 'auto-'), compute locally because backend expects a
        // stored text (text_id) inside a saved game and will return 404.
        if (!id || (generatedText.id && generatedText.id.startsWith("auto-"))) {
          const originalText = generatedText.content;
          const userInp = finalInput;

          const maxLen = Math.max(originalText.length, userInp.length);
          let correctChars = 0;
          let mismatches = 0;
          for (let i = 0; i < maxLen; i++) {
            const o = originalText[i] ?? "";
            const u = userInp[i] ?? "";
            if (o === u && o !== "") {
              correctChars++;
            } else {
              mismatches++;
            }
          }
          const incorrectChars = mismatches;
          const accuracy =
            maxLen === 0 ? 0 : Math.round((correctChars / maxLen) * 100);
          const timeInMinutes =
            Math.max(timeIsUp ? timeLimit : timeTaken, 1) / 60;
          const wpm = Math.round(userInp.length / 5 / timeInMinutes);

          const localResult: TypingResult = {
            total_characters: maxLen,
            correct_characters: correctChars,
            incorrect_characters: incorrectChars,
            wpm,
            accuracy,
            time_taken: timeIsUp ? timeLimit : timeTaken,
          };

          setResult(localResult);
          toast.success("Results calculated (local)");
          return;
        }

        // Otherwise call backend check endpoint for saved games
        const res = await api.post(
          `/api/game/game-type/type-speed/${id}/check`,
          {
            text_id: textIdToSend,
            user_input: finalInput,
            time_taken: timeIsUp ? timeLimit : timeTaken,
          },
        );

        const resultData: TypingResult = res.data.data;
        setResult(resultData);
        toast.success("Results calculated!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to calculate results.");
      }
    },
    [
      generatedText,
      gameStartTime,
      userInput,
      timeLimit,
      id,
      textWords,
      currentWordIndex,
    ],
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    if (!gameStarted && generatedText) {
      setGameStartTime(Date.now());
      setGameStarted(true);
    }

    if (!gameStarted) return;

    setUserInput(value);

    if (value.endsWith(" ")) {
      setCurrentWordIndex((prev) => prev + 1);
      setUserInput("");

      if (currentWordIndex === textWords.length - 1) {
        handleFinishGame(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    setGameStarted(false);
    setGameFinished(false);
    setUserInput("");
    setCurrentWordIndex(0);
    setResult(null);

    try {
      // PERBAIKAN URL: Menggunakan full path dari root untuk menghindari 404
      const res = await api.get("/api/game/game-type/type-speed/generate", {
        params: { mode, time_limit: timeLimit },
      });

      const payload = res.data.data;
      const textData = payload?.text;

      if (textData) {
        setGeneratedText(textData);
        if (payload.time_limit && typeof payload.time_limit === "number") {
          setTimeLimit(payload.time_limit);
          setTimeRemaining(payload.time_limit);
        } else {
          setTimeRemaining(timeLimit);
        }
      } else {
        throw new Error("Invalid text structure returned.");
      }
      toast.success("Text generated successfully. Press START to type!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate text");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (generatedText) {
      setGameStartTime(Date.now());
      setGameStarted(true);
      setGameFinished(false);
      setIsPaused(false);
      setUserInput("");
      setTimeRemaining(timeLimit);
    } else {
      toast.error("Please generate text first.");
    }
  };

  const handleExit = () => navigate(-1);

  const renderText = () => {
    return textWords.map((word, index) => {
      let wordStatus = "";
      if (index < currentWordIndex) {
        wordStatus = "text-gray-500";
      } else if (index === currentWordIndex) {
        const currentInput = userInput;
        const isCorrect = word.startsWith(currentInput);
        wordStatus = isCorrect
          ? "text-black font-semibold underline"
          : "text-red-600 font-bold";
      } else {
        wordStatus = "text-gray-400";
      }

      return (
        <span key={index} className={`transition duration-100 ${wordStatus}`}>
          {word}
        </span>
      );
    });
  };

  if (loading && !generatedText) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-black" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">
        Type Speed Challenge (Practice Mode)
      </h1>

      <div className="flex gap-4 mb-4 p-4 border rounded-lg bg-white items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Mode</label>
          <select
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as "easy" | "medium" | "hard")
            }
            className="border rounded px-2 py-1"
            disabled={loading || gameStarted}
          >
            <option value="easy">Easy (±200 Words)</option>
            <option value="medium">Medium (±500 Words)</option>
            <option value="hard">Hard (±1000 Words)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Duration (s)</label>
          <input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value) || 30)}
            min={30}
            max={300}
            className="border rounded px-2 py-1 w-24"
            disabled={loading || gameStarted}
          />
        </div>

        <Button onClick={handleGenerate} disabled={loading || gameStarted}>
          {loading ? "Loading..." : "Generate Text"}
        </Button>

        <Button variant="outline" onClick={handleExit}>
          Back
        </Button>
      </div>

      {generatedText && (
        <div className="flex justify-between items-center mb-4 p-4 border rounded-lg bg-white">
          <div>
            <span className="text-lg font-semibold">Difficulty: </span>
            <span
              className={`font-bold ${generatedText.difficulty === "hard" ? "text-red-600" : generatedText.difficulty === "medium" ? "text-orange-500" : "text-green-600"}`}
            >
              {generatedText.difficulty.toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-lg font-semibold">Time Left: </span>
            <span className="text-2xl font-mono text-blue-700">
              {timeRemaining}s
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 bg-slate-100 p-6 rounded-lg border-2 min-h-[150px] overflow-hidden">
        {generatedText ? (
          <div className="text-lg font-mono leading-relaxed tracking-wider">
            {renderText()}
          </div>
        ) : (
          <div className="text-gray-500 italic">
            Press "Generate Text" to start the challenge.
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <Button
          onClick={handleStart}
          disabled={loading || !generatedText || gameStarted}
        >
          {gameStarted && !gameFinished ? "Game Started" : "Start Typing"}
        </Button>
        {gameStarted && !gameFinished && (
          <Button variant="outline" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? "Resume" : "Pause"}
          </Button>
        )}
      </div>

      <textarea
        className="w-full p-4 border-2 rounded-lg font-mono resize-none focus:ring-4 focus:ring-blue-300 transition duration-150"
        rows={1}
        placeholder={
          gameStarted
            ? `Start typing: ${textWords[currentWordIndex] || "...finishing"}`
            : "Press START to begin."
        }
        value={userInput}
        onChange={handleInput}
        disabled={!gameStarted || gameFinished || isPaused || !generatedText}
      />

      {gameFinished && result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          <h3 className="text-xl font-bold mb-3 text-green-800">
            Results (WPM & Accuracy)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <p>
              <strong>Words Per Minute (WPM):</strong> {result.wpm}
            </p>
            <p>
              <strong>Accuracy:</strong> {result.accuracy}%
            </p>
            <p>
              <strong>Correct Characters:</strong> {result.correct_characters}
            </p>
            <p>
              <strong>Incorrect Characters (Typo):</strong>{" "}
              {result.incorrect_characters}
            </p>
            <p>
              <strong>Time Taken:</strong> {result.time_taken}s
            </p>
          </div>
        </div>
      )}
      {gameFinished && !result && (
        <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
          Calculating results...
        </div>
      )}
    </div>
  );
}
