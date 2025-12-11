import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StartScreen from "./components/StartScreen";
import PauseDialog from "./components/PauseDialog";
import { useGetMazeChaseGame } from "@/api/maze-chase/useGetMazeChaseGame";
import startBg from "./assets/Home_Background_assets.png";

const Game = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: gameData } = useGetMazeChaseGame(id || "");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [stage, setStage] = useState<"start" | "zoom" | "maze" | "gameover">(
    "start",
  );
  const [hideButton, setHideButton] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  // Initialize countdown from API
  useEffect(() => {
    if (gameData?.countdown) {
      setCountdown(gameData.countdown);
    }
  }, [gameData]);

  // Countdown timer
  useEffect(() => {
    if (stage !== "maze" || isPaused || countdown === null || countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, isPaused, countdown]);

  // Format countdown to MM:SS
  const formatCountdown = (seconds: number | null) => {
    if (seconds === null) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleStart = () => {
    setHideButton(true);

    setTimeout(() => {
      setStage("zoom");
    }, 200);

    setTimeout(() => {
      setStage("maze");
    }, 1400);
  };

  const handlePauseClick = () => {
    setIsPaused(true);
    setShowPauseDialog(true);
  };

  const handleResume = () => {
    setShowPauseDialog(false);
    setIsPaused(false);
    // Focus back to iframe so game can receive input
    iframeRef.current?.focus();
  };

  const handleRestart = () => {
    setShowPauseDialog(false);
    setIsPaused(false);
    setStage("start");
    setHideButton(false);
    setCountdown(gameData?.countdown || null);
    // Reload iframe to restart game
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
    }
  };

  // Handle keyboard shortcut for pause (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "maze") {
        if (isPaused) {
          handleResume();
        } else {
          handlePauseClick();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, isPaused, handleResume, handlePauseClick]);

  const handleBackToMenu = () => {
    navigate("/");
  };

  return (
    <>
      <style>
        {`          
          @keyframes zoomCenter {
            from { transform: scale(1); opacity: 1; }
            to { transform: scale(1.8); opacity: 1; }
          }
          .zoom-center {
            animation: zoomCenter 1.4s ease-out forwards;
          }

          @keyframes mazePop {
            from { transform: scale(0.2); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .maze-pop {
            animation: mazePop 0.6s ease-out forwards;
          }
        `}
      </style>

      {/* 1️⃣ Start Screen */}
      {stage === "start" && (
        <StartScreen hideButton={hideButton} onStart={handleStart} />
      )}

      {/* 2️⃣ Zoom Animation */}
      {stage === "zoom" && (
        <div
          className="fixed top-0 left-0 w-screen h-screen bg-cover bg-center zoom-center"
          style={{
            backgroundImage: `url(${startBg})`,
          }}
        ></div>
      )}

      {/* 3️⃣ Game Page with Godot */}
      {stage === "maze" && (
        <div className="w-screen h-screen relative maze-pop bg-black">
          {/* HUD - Countdown Timer */}
          <div className="absolute top-4 left-4 text-white text-2xl md:text-3xl font-bold drop-shadow-lg z-40 bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
            {formatCountdown(countdown)}
          </div>

          {/* Pause Button */}
          <div className="absolute top-4 right-6 z-50">
            <button
              onClick={handlePauseClick}
              className="w-10 h-10 md:w-12 md:h-12 bg-black/40 hover:bg-black/60 rounded-lg text-white text-2xl md:text-3xl flex justify-center items-center backdrop-blur-md transition-colors"
            >
              ☰
            </button>
          </div>

          {/* Godot Game iframe */}
          <iframe
            ref={iframeRef}
            src="/maze-chase/godot/FP-Pemweb.html"
            className="w-full h-full border-0"
            style={{
              pointerEvents: isPaused ? "none" : "auto",
            }}
            allow="autoplay; fullscreen; cross-origin-isolated"
            title="Maze Chase Game"
          />

          {/* Overlay when paused */}
          {isPaused && (
            <div className="absolute inset-0 bg-black/30 z-30 pointer-events-none" />
          )}
        </div>
      )}

      {/* 4️⃣ Game Over Screen */}
      {stage === "gameover" && (
        <div
          className="w-screen h-screen bg-cover bg-center relative flex items-center justify-center"
          style={{ backgroundImage: `url(${forrest})` }}
        >
          <div className="bg-black/80 backdrop-blur-md rounded-2xl p-8 md:p-12 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4">
              GAME OVER
            </h1>
            <p className="text-white text-lg md:text-xl mb-8">
              You ran out of lives!
            </p>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleRestart}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleBackToMenu}
                className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white text-lg font-bold rounded-xl transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Dialog */}
      <PauseDialog
        isOpen={showPauseDialog}
        onClose={() => {
          setShowPauseDialog(false);
          setIsPaused(false);
          iframeRef.current?.focus();
        }}
        onResume={handleResume}
        onRestart={handleRestart}
      />
    </>
  );
};

export default Game;
