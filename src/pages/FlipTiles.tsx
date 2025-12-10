import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { ArrowLeft, Menu, RotateCcw } from "lucide-react";
import api from "@/api/axios";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tile = {
  label: string;
  flipped: boolean;
  removed: boolean;
  id: string;
  color: string; // tailwind color class
  justRemoved?: boolean;
  justRestored?: boolean;
  justUnflipped?: boolean;
};

type GameData = {
  id: string;
  name: string;
  description: string;
  thumbnail_image: string | null;
  game_json: {
    tiles: { label: string }[];
  };
};

function randomId() {
  return Math.random().toString(36).slice(2, 9);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FlipTiles() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [spinnerTarget, setSpinnerTarget] = useState<string | null>(null);
  const [zoomedTile, setZoomedTile] = useState<string | null>(null);
  const [zoomFromRect, setZoomFromRect] = useState<DOMRect | null>(null);
  const [zoomLeaving, setZoomLeaving] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        // Try to fetch game detail (auth required for now)
        const gameResponse = await api.get(
          `/api/game/game-type/flip-tiles/${id}`,
        );
        const game = gameResponse.data.data;
        setGameData(game);

        if (game.game_json && game.game_json.tiles) {
          const palette = [
            "bg-red-500",
            "bg-blue-500",
            "bg-green-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-indigo-500",
            "bg-yellow-500",
            "bg-orange-500",
            "bg-teal-500",
            "bg-fuchsia-500",
            "bg-cyan-500",
            "bg-lime-500",
          ];
          setTiles(
            game.game_json.tiles.map((t: { label: string }, idx: number) => ({
              id: randomId(),
              label: t.label,
              flipped: false,
              removed: false,
              color: palette[idx % palette.length],
            })),
          );
        }

        try {
          await api.post("/api/game/play-count", { game_id: id });
        } catch (playErr) {
          console.warn("Play count update failed", playErr);
        }
      } catch (err: unknown) {
        console.error("Failed to load Flip Tiles game:", err);
        setError("Failed to load Flip Tiles game. Please try again.");
        toast.error("Failed to load Flip Tiles game");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGame();
    } else {
      // Fallback: show demo tiles so page isn't stuck loading
      const demoTiles = Array.from({ length: 12 }, (_, i) => ({
        label: `Demo ${i + 1}`,
      }));
      const palette = [
        "bg-red-500",
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-pink-500",
        "bg-indigo-500",
        "bg-yellow-500",
        "bg-orange-500",
        "bg-teal-500",
        "bg-fuchsia-500",
        "bg-cyan-500",
        "bg-lime-500",
      ];
      setGameData({
        id: "demo",
        name: "Flip Tiles Demo",
        description: "Demo mode (no game id provided).",
        thumbnail_image: null,
        game_json: { tiles: demoTiles },
      });
      setTiles(
        demoTiles.map((t, idx) => ({
          id: randomId(),
          label: t.label,
          flipped: false,
          removed: false,
          color: palette[idx % palette.length],
        })),
      );
      setLoading(false);
    }
  }, [id]);

  // Auto-hide intro sequence
  useEffect(() => {
    if (!loading && gameData) {
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 3500); // 3.5s total intro duration
      return () => clearTimeout(timer);
    }
  }, [loading, gameData]);

  const [tileHeight, setTileHeight] = useState(100);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compute columns to fill available width. Use rounding to reduce unused right space.
  const [columns, setColumns] = useState(4);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevPositionsRef = useRef<Record<string, DOMRect>>({});

  // Responsive columns based on width
  useLayoutEffect(() => {
    function computeColumns() {
      const w = window.innerWidth; // full viewport width for better fill
      const minTile = 190; // target min width per tile
      const raw = Math.max(1, Math.min(tiles.length, Math.round(w / minTile)));
      const clamped = Math.min(5, raw); // enforce max 5 columns but stretch width
      setColumns(clamped);
    }
    computeColumns();
    window.addEventListener("resize", computeColumns);
    return () => window.removeEventListener("resize", computeColumns);
  }, [tiles.length]);

  // Width-based rectangular height (undo vertical fill)
  useEffect(() => {
    function computeRectangularHeight() {
      const viewportW = window.innerWidth - 48; // approximate horizontal padding
      if (columns === 0) return;
      const gap = 12;
      const tileWidth = (viewportW - (columns - 1) * gap) / columns;
      // Use the previous ratio 0.45 with sensible min
      const height = Math.max(88, Math.round(tileWidth * 0.45));
      setTileHeight(height);
    }
    computeRectangularHeight();
    window.addEventListener("resize", computeRectangularHeight);
    return () => window.removeEventListener("resize", computeRectangularHeight);
  }, [columns]);

  const flipTile = (tileId: string) => {
    setTiles((prev) =>
      prev.map((t) => {
        if (t.id !== tileId) return t;
        if (t.flipped) {
          return { ...t, flipped: false, justUnflipped: true };
        }
        return { ...t, flipped: true, justUnflipped: false };
      }),
    );
    // clear the one-shot unflip flag
    setTimeout(() => {
      setTiles((prev) =>
        prev.map((t) => (t.id === tileId ? { ...t, justUnflipped: false } : t)),
      );
    }, 400);
    setZoomedTile(null);
  };

  const removeTile = (tileId: string) => {
    setTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, justRemoved: true } : t)),
    );
    setTimeout(() => {
      setTiles((prev) =>
        prev.map((t) =>
          t.id === tileId ? { ...t, removed: true, justRemoved: false } : t,
        ),
      );
    }, 380);
    setZoomedTile(null);
  };

  const restoreAll = () => {
    setTiles((prev) =>
      prev.map((t) =>
        t.removed
          ? { ...t, flipped: false, removed: false, justRestored: true }
          : { ...t, flipped: false },
      ),
    );
    setTimeout(() => {
      setTiles((prev) => prev.map((t) => ({ ...t, justRestored: false })));
    }, 420);
    setSpinnerTarget(null);
    setZoomedTile(null);
  };

  const shuffleTiles = () => {
    // Capture current positions for FLIP (all tiles, including removed)
    const currentPositions: Record<string, DOMRect> = {};
    Object.entries(cardRefs.current).forEach(([id, el]) => {
      if (el) currentPositions[id] = el.getBoundingClientRect();
    });
    prevPositionsRef.current = currentPositions;
    setTiles((prev) => {
      // Shuffle entire array so removed placeholders also move
      const shuffled = shuffleArray(prev);
      return shuffled;
    });
  };

  const showAllFronts = () => {
    setTiles((prev) =>
      prev.map((t) => ({ ...t, flipped: false, justUnflipped: t.flipped })),
    );
    setTimeout(() => {
      setTiles((prev) => prev.map((t) => ({ ...t, justUnflipped: false })));
    }, 400);
  };

  const showAllBacks = () => {
    setTiles((prev) => prev.map((t) => ({ ...t, flipped: true })));
  };

  const startAgain = () => {
    if (!gameData?.game_json?.tiles) return;

    // Re-initialize tiles from gameData
    const palette = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-yellow-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-fuchsia-500",
      "bg-cyan-500",
      "bg-lime-500",
    ];
    setTiles(
      gameData.game_json.tiles.map((t: { label: string }, idx: number) => ({
        id: randomId(),
        label: t.label,
        flipped: false,
        removed: false,
        color: palette[idx % palette.length],
      })),
    );
    setZoomedTile(null);
    toast.success("Game restarted");
  };

  // Perform FLIP animation after reorder
  useLayoutEffect(() => {
    const prevPositions = prevPositionsRef.current;
    if (!Object.keys(prevPositions).length) return;
    const newPositions: Record<string, DOMRect> = {};
    Object.entries(cardRefs.current).forEach(([id, el]) => {
      if (el) newPositions[id] = el.getBoundingClientRect();
    });
    Object.entries(newPositions).forEach(([id, newRect]) => {
      const prev = prevPositions[id];
      if (!prev) return;
      const dx = prev.left - newRect.left;
      const dy = prev.top - newRect.top;
      if (dx === 0 && dy === 0) return;
      const el = cardRefs.current[id];
      if (!el) return;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = "none";
      requestAnimationFrame(() => {
        el.style.transform = "translate(0,0)";
        el.style.transition = "transform 600ms cubic-bezier(.4,.2,.2,1)";
      });
    });
    prevPositionsRef.current = {};
  }, [tiles]);

  const spinRandom = () => {
    const candidates = tiles.filter((t) => !t.removed);
    if (candidates.length === 0) return;
    const spins = 20;
    let idx = 0;
    const interval = setInterval(() => {
      const pick = candidates[idx % candidates.length];
      setSpinnerTarget(pick.id);
      idx++;
      if (idx >= spins) {
        clearInterval(interval);
        const finalPick =
          candidates[Math.floor(Math.random() * candidates.length)];
        setSpinnerTarget(finalPick.id);

        // Get the tile's position for zoom animation
        const tileElement = cardRefs.current[finalPick.id];
        if (tileElement) {
          const rect = tileElement.getBoundingClientRect();
          setZoomFromRect(rect);
        }

        setZoomedTile(finalPick.id); // auto-open after random spin finishes
      }
    }, 100);
  };

  const zoomedTileData = tiles.find((t) => t.id === zoomedTile);

  if (loading) {
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-black"></div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center gap-4">
        <Typography variant="p">{error ?? "Game not found"}</Typography>
        <Button onClick={() => navigate("/")}>Go Back</Button>
      </div>
    );
  }

  // --- PHASE 1: INTRO SCREEN ---
  if (showIntro) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px]"></div>

        <div className="flex gap-2 mb-6 md:mb-8 relative z-10 perspective-[1000px]">
          {["F", "L", "I", "P"].map((char, i) => (
            <div
              key={i}
              className="w-16 h-20 md:w-24 md:h-32 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl shadow-[0_8px_0_theme(colors.sky.700),0_15px_20px_rgba(0,0,0,0.4)] text-white text-4xl md:text-6xl font-black flex items-center justify-center animate-in zoom-in slide-in-from-bottom-20 duration-700 border-t border-white/30"
              style={{
                animationDelay: `${i * 150}ms`,
                animationFillMode: "both",
                transformStyle: "preserve-3d",
              }}
            >
              <div className="animate-bounce delay-700 drop-shadow-md">
                {char}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 relative z-10 perspective-[1000px]">
          {["T", "I", "L", "E", "S"].map((char, i) => (
            <div
              key={i}
              className={`w-14 h-18 md:w-20 md:h-28 rounded-xl shadow-[0_6px_0_rgba(0,0,0,0.2),0_10px_15px_rgba(0,0,0,0.3)] text-white text-3xl md:text-5xl font-black flex items-center justify-center animate-in zoom-in slide-in-from-bottom-20 duration-700 border-t border-white/20 ${
                [
                  "bg-gradient-to-br from-red-400 to-red-600",
                  "bg-gradient-to-br from-yellow-400 to-yellow-600",
                  "bg-gradient-to-br from-green-400 to-green-600",
                  "bg-gradient-to-br from-purple-400 to-purple-600",
                  "bg-gradient-to-br from-pink-400 to-pink-600",
                ][i]
              }`}
              style={{
                animationDelay: `${600 + i * 150}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="animate-pulse drop-shadow-sm">{char}</div>
            </div>
          ))}
        </div>
        <Typography
          variant="h3"
          className="text-white mt-12 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-[1800ms] fill-mode-both drop-shadow-lg tracking-widest font-bold"
        >
          GET READY!
        </Typography>
      </div>
    );
  }

  // --- PHASE 2: GAMEPLAY (Rendered after intro) ---
  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-700 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            className="pl-0 hover:bg-transparent text-slate-600 hover:text-orange-600 font-medium transition-colors"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Exit Game
          </Button>

          {/* MENU BUTTON */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shadow-sm border-slate-300"
              >
                <Menu className="h-5 w-5 text-slate-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 shadow-xl border-slate-200"
            >
              <DropdownMenuLabel>FLIP TILES OPTIONS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={showAllFronts}>
                Show all tile fronts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={showAllBacks}>
                Show all tile backs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shuffleTiles}>
                Shuffle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={spinRandom}>
                Random spinner
              </DropdownMenuItem>
              <DropdownMenuItem onClick={restoreAll}>
                Restore eliminated
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startAgain}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Start again
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>Resume</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="mb-8 text-center">
          <Typography
            variant="h1"
            className="mb-2 border-none text-4xl font-black tracking-tight text-slate-800 drop-shadow-sm"
          >
            {gameData.name}
          </Typography>
          <Typography variant="muted" className="text-lg">
            {gameData.description}
          </Typography>
        </div>

        {/* Tiles Grid with 3D animation */}
        <div
          className="w-full border-0 bg-transparent p-4 h-[calc(100vh-260px)] overflow-visible"
          style={{ perspective: "1000px" }}
        >
          <div
            ref={containerRef}
            className="grid w-full h-full content-start"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 16,
            }}
          >
            {tiles.map((tile) => {
              if (tile.justRemoved) {
                return (
                  <div
                    key={tile.id}
                    ref={(r) => {
                      cardRefs.current[tile.id] = r;
                    }}
                    className="flex items-center justify-center opacity-0 scale-50 transition-all duration-500 ease-in-out"
                    style={{ height: tileHeight }}
                  ></div>
                );
              }
              if (tile.removed) {
                return (
                  <div
                    key={tile.id}
                    ref={(r) => {
                      cardRefs.current[tile.id] = r;
                    }}
                    className="rounded-xl bg-slate-200/50 inner-shadow-sm"
                    style={{ height: tileHeight }}
                  ></div>
                );
              }
              return (
                <div
                  key={tile.id}
                  ref={(r) => {
                    cardRefs.current[tile.id] = r;
                  }}
                  className={`relative cursor-pointer transition-transform duration-300 ${spinnerTarget === tile.id ? "scale-105 z-20" : "hover:-translate-y-1 hover:z-10"}`}
                  style={{
                    height: tileHeight,
                    perspective: "1000px",
                  }}
                  onClick={() => {
                    const el = cardRefs.current[tile.id];
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      setZoomFromRect(rect);
                    }
                    setZoomedTile(tile.id);
                  }}
                >
                  <div
                    className="w-full h-full relative transition-all duration-500 rounded-xl"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: tile.flipped
                        ? "rotateY(180deg)"
                        : "rotateY(0deg)",
                    }}
                  >
                    {/* Front Face (Label / Color) - Visible at 0deg */}
                    <div
                      className={`absolute inset-0 w-full h-full backface-hidden rounded-xl flex items-center justify-center font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15),0_10px_10px_rgba(0,0,0,0.1)] border-t border-white/30 ${tile.color} bg-gradient-to-br from-white/10 to-black/5`}
                      style={{
                        backfaceVisibility: "hidden",
                        fontSize: `clamp(0.8rem, ${tileHeight / 90}rem, 1.25rem)`,
                        WebkitBackfaceVisibility: "hidden", // Safari support
                        textShadow: "0 2px 2px rgba(0,0,0,0.2)",
                      }}
                    >
                      {tile.label}
                    </div>

                    {/* Back Face (Question Mark) - Visible at 180deg */}
                    <div
                      className="absolute inset-0 w-full h-full bg-slate-800 backface-hidden rounded-xl flex items-center justify-center font-black text-white shadow-[0_6px_0_rgba(0,0,0,0.3),0_10px_10px_rgba(0,0,0,0.2)] border-t border-white/10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-700 to-slate-900"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        WebkitBackfaceVisibility: "hidden", // Safari support
                        fontSize: `clamp(1.5rem, ${tileHeight / 50}rem, 3rem)`,
                      }}
                    >
                      <span className="drop-shadow-lg opacity-80">?</span>
                      {/* Subtle Pattern Overlay */}
                      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    </div>
                  </div>

                  {/* Spinner Ring Effect */}
                  {spinnerTarget === tile.id && (
                    <div className="absolute -inset-2 border-4 border-sky-400 rounded-2xl animate-pulse pointer-events-none"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {tiles.every((t) => t.removed) && (
          <div className="text-center py-12 animate-in fade-in slide-in-from-bottom-5">
            <Typography variant="muted" className="text-xl font-medium">
              All tiles removed!
            </Typography>
            <Button variant="outline" className="mt-4" onClick={restoreAll}>
              Restore All Tiles
            </Button>
          </div>
        )}
      </div>

      {zoomedTile && zoomedTileData && zoomFromRect && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-slate-900/60 ${zoomLeaving ? "pointer-events-none" : ""}`}
          onClick={() => {
            setZoomLeaving(true);
            setTimeout(() => {
              setZoomedTile(null);
              setZoomFromRect(null);
              setZoomLeaving(false);
            }, 300);
          }}
        >
          <div
            className={`${zoomLeaving ? "zoom-overlay-exit" : "zoom-overlay-enter"} relative rounded-2xl shadow-2xl flex flex-col bg-white border border-slate-200`}
            style={{
              width: "min(90vw, 420px)",
              ...({
                "--from-transform": `translate(${zoomFromRect.left + zoomFromRect.width / 2}px, ${
                  zoomFromRect.top + zoomFromRect.height / 2
                }px) translate(-50%, -50%) scale(${Math.min(
                  zoomFromRect.width / 420,
                  zoomFromRect.height / 420,
                )})`,
              } as React.CSSProperties),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              {/* Zoomed Tile Graphic */}
              <div
                className={`w-full aspect-square rounded-xl flex items-center justify-center text-6xl font-black shadow-inner border-4 border-slate-100 ${zoomedTileData.flipped ? "bg-slate-800 text-white" : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800"}`}
              >
                {zoomedTileData.flipped ? "?" : zoomedTileData.label}
              </div>

              <div className="flex gap-4">
                <Button
                  className="flex-1 h-12 text-lg font-bold shadow-sm"
                  variant="outline"
                  onClick={() => flipTile(zoomedTileData.id)}
                >
                  {zoomedTileData.flipped ? "Reveal" : "Hide"}
                </Button>
                <Button
                  className="flex-1 h-12 text-lg font-bold shadow-md bg-red-500 hover:bg-red-600 text-white border-none"
                  onClick={() => removeTile(zoomedTileData.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
