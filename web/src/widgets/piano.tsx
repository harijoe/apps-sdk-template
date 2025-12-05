import { useState, useEffect, useCallback, useRef } from "react";
import { Piano, KeyboardShortcuts, MidiNumbers } from "react-piano";
import Soundfont from "soundfont-player";
import { mountWidget, useLocale, createStore } from "skybridge/web";
import { Spinner } from "../components/ui/shadcn-io/spinner";
import "../index.css";
import "react-piano/dist/styles.css";

type NoteRecord = {
  midiNumber: number;
  noteName: string;
  timestamp: number;
  intervalFromPrevious?: number; // Time in ms from previous note
};

type SavedSong = {
  id: string;
  name: string;
  notes: NoteRecord[];
  createdAt: number;
};

type SongsStore = {
  songs: SavedSong[];
  addSong: (song: Omit<SavedSong, "id" | "createdAt">) => void;
  deleteSong: (id: string) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SoundfontInstrument = any;

const useSongsStore = createStore<SongsStore>((set) => ({
  songs: [],
  addSong: (song) =>
    set((state) => ({
      songs: [
        ...state.songs,
        {
          ...song,
          id: Date.now().toString(),
          createdAt: Date.now(),
        },
      ],
    })),
  deleteSong: (id) =>
    set((state) => ({
      songs: state.songs.filter((song) => song.id !== id),
    })),
}));

function PianoWidget() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [instrument, setInstrument] = useState<SoundfontInstrument | null>(null);
  const [recordedNotes, setRecordedNotes] = useState<NoteRecord[]>([]);
  const [pianoWidth, setPianoWidth] = useState(600);
  const [isRecording, setIsRecording] = useState(false);
  const [songName, setSongName] = useState("");
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const noteStartTimesRef = useRef<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { songs, addSong, deleteSong } = useSongsStore();

  useEffect(() => {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AudioContextClass();
    setAudioContext(ac);

    Soundfont.instrument(ac, "acoustic_grand_piano")
      .then((inst) => {
        setInstrument(inst);
      })
      .catch((error) => {
        console.error("Error loading piano instrument:", error);
      });

    return () => {
      ac.close();
    };
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 32; // Subtract padding
        setPianoWidth(Math.max(300, width));
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // One octave (C4 to C5) with a few extra notes on left (A3, A#3, B3) and right (C#5, D5)
  const firstNote = MidiNumbers.fromNote("a3");
  const lastNote = MidiNumbers.fromNote("d5");
  const keyboardShortcuts = KeyboardShortcuts.create({
    firstNote: firstNote,
    lastNote: lastNote,
    keyboardConfig: KeyboardShortcuts.HOME_ROW,
  });

  // Static mapping of MIDI numbers to note names for A3 to D5 (one octave + extras)
  const getNoteName = (midiNumber: number): string => {
    const noteMap: Record<number, string> = {
      57: "A", // A3
      58: "A#", // A#3 (black key)
      59: "B", // B3
      60: "C", // C4
      61: "C#", // C#4 (black key)
      62: "D", // D4
      63: "D#", // D#4 (black key)
      64: "E", // E4
      65: "F", // F4
      66: "F#", // F#4 (black key)
      67: "G", // G4
      68: "G#", // G#4 (black key)
      69: "A", // A4
      70: "A#", // A#4 (black key)
      71: "B", // B4
      72: "C", // C5
      73: "C#", // C#5 (black key)
      74: "D", // D5
    };
    return noteMap[midiNumber] || "?";
  };

  const playNote = useCallback(
    (midiNumber: number) => {
      // Disable playing when entering song name
      if (!isRecording && recordedNotes.length > 0) {
        return;
      }
      if (instrument) {
        instrument.play(midiNumber);
      }
    },
    [instrument, isRecording, recordedNotes.length],
  );

  const stopNote = useCallback((midiNumber: number) => {
    // Keep sound playing even if key is released - do nothing
    // Parameter required by Piano component API but intentionally unused
    void midiNumber;
    // if (instrument) {
    //   instrument.stop(midiNumber);
    // }
  }, []);

  const onPlayNoteInput = useCallback(
    (midiNumber: number) => {
      // Only record if this note is not already active (prevents duplicate recordings)
      if (!activeNotesRef.current.has(midiNumber)) {
        activeNotesRef.current.add(midiNumber);
        const now = Date.now();
        noteStartTimesRef.current.set(midiNumber, now);

        // Get note name from static mapping (C, D, E, F, G, A, B)
        const noteName = getNoteName(midiNumber);

        // Only record if recording is active
        if (isRecording) {
          setRecordedNotes((prev) => {
            const intervalFromPrevious = prev.length > 0 ? now - prev[prev.length - 1].timestamp : 0;
            return [
              ...prev,
              {
                midiNumber,
                noteName,
                timestamp: now,
                intervalFromPrevious,
              },
            ];
          });
        }
      }
    },
    [isRecording],
  );

  const onStopNoteInput = useCallback((midiNumber: number) => {
    // Remove from active notes when note stops
    activeNotesRef.current.delete(midiNumber);
  }, []);

  const renderNoteLabel = useCallback(({ midiNumber, isAccidental }: { midiNumber: number; isAccidental: boolean }) => {
    // Don't render labels for black keys (accidentals)
    if (isAccidental) {
      return null;
    }
    // Render the note name from static mapping for white keys
    const noteName = getNoteName(midiNumber);
    return <div className="ReactPiano__NoteLabel">{noteName}</div>;
  }, []);

  const calculateSongDuration = useCallback((notes: NoteRecord[]): number => {
    if (notes.length === 0) return 0;
    let totalDuration = 0;
    notes.forEach((note, index) => {
      if (index > 0) {
        totalDuration += note.intervalFromPrevious || 0;
      }
    });
    return totalDuration;
  }, []);

  const formatDuration = useCallback((durationMs: number): string => {
    const seconds = durationMs / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }, []);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedNotes([]);
    activeNotesRef.current.clear();
    noteStartTimesRef.current.clear();
  }, []);

  const handleFinishRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleSave = useCallback(() => {
    if (recordedNotes.length === 0 || !songName.trim()) {
      return;
    }
    addSong({
      name: songName.trim(),
      notes: [...recordedNotes],
    });
    setSongName("");
    setRecordedNotes([]);
    setIsRecording(false);
    activeNotesRef.current.clear();
    noteStartTimesRef.current.clear();
  }, [recordedNotes, songName, addSong]);

  const handlePlaySong = useCallback(
    (song: SavedSong) => {
      if (!instrument) return;

      // Set playing state
      setPlayingSongId(song.id);

      // Calculate total duration
      let totalDuration = 0;
      song.notes.forEach((note, index) => {
        if (index > 0) {
          totalDuration += note.intervalFromPrevious || 0;
        }
      });

      // Play notes with their recorded timing (cumulative delays)
      let cumulativeDelay = 0;
      song.notes.forEach((note, index) => {
        if (index > 0) {
          cumulativeDelay += note.intervalFromPrevious || 0;
        }
        setTimeout(() => {
          instrument.play(note.midiNumber);
        }, cumulativeDelay);
      });

      // Clear playing state when song finishes
      setTimeout(() => {
        setPlayingSongId(null);
      }, totalDuration + 1000); // Add 1 second buffer for the last note to finish
    },
    [instrument],
  );

  if (!instrument || !audioContext) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="text-gray-600">Loading piano...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 p-4 w-full max-w-full box-border"
      style={{ height: "100vh", minHeight: "400px" }}
    >
      <div className="flex flex-col items-center justify-center w-full" style={{ height: "80%", minHeight: "200px" }}>
        <div ref={containerRef} className="w-full flex justify-center items-center h-full">
          <Piano
            noteRange={{ first: firstNote, last: lastNote }}
            playNote={playNote}
            stopNote={stopNote}
            width={pianoWidth}
            keyboardShortcuts={keyboardShortcuts}
            onPlayNoteInput={onPlayNoteInput}
            onStopNoteInput={onStopNoteInput}
            renderNoteLabel={renderNoteLabel}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isRecording ? (
          <div className="flex flex-col gap-3 items-center">
            <div className="flex items-center justify-center gap-2 text-sm text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span>{locale === "en" ? "Recording..." : "Enregistrement en cours..."}</span>
            </div>
            <button
              onClick={handleFinishRecording}
              className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 shadow-sm"
            >
              {locale === "en" ? "Finish" : "Terminer"}
            </button>
          </div>
        ) : recordedNotes.length > 0 ? (
          <div className="flex flex-col gap-2 items-center">
            <div className="flex flex-row gap-2 items-center w-full max-w-md">
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder={locale === "en" ? "Song name" : "Nom de la chanson"}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && songName.trim()) {
                    handleSave();
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!songName.trim()}
                className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 shadow-sm"
              >
                {locale === "en" ? "Confirm" : "Confirmer"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-row gap-3 items-center justify-center">
            <button
              onClick={handleStartRecording}
              className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 shadow-sm"
            >
              {locale === "en" ? "Start Recording" : "Commencer l'enregistrement"}
            </button>
          </div>
        )}
        {recordedNotes.length > 0 && (
          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border max-h-32 overflow-y-auto">
            <div className="font-semibold mb-1">
              {recordedNotes.length} note{recordedNotes.length !== 1 ? "s" : ""} recorded:
            </div>
            <div className="flex flex-wrap gap-1">
              {recordedNotes.map((note, index) => (
                <span key={index} className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                  <span className="font-mono font-semibold">{note.noteName}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {songs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="font-semibold text-sm text-gray-700">
              {locale === "en" ? "Saved Songs:" : "Chansons enregistrées:"}
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-2 bg-white border rounded hover:bg-gray-50"
                >
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-sm">{song.name}</span>
                    <span className="text-xs text-gray-500">
                      {formatDuration(calculateSongDuration(song.notes))} •{" "}
                      {new Date(song.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlaySong(song)}
                      disabled={playingSongId === song.id}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {playingSongId === song.id ? (
                        <>
                          <Spinner variant="circle" size={12} />
                          <span>{locale === "en" ? "Play" : "Jouer"}</span>
                        </>
                      ) : (
                        <span>{locale === "en" ? "Play" : "Jouer"}</span>
                      )}
                    </button>
                    <button
                      onClick={() => deleteSong(song.id)}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      {locale === "en" ? "Delete" : "Supprimer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PianoWidget;

mountWidget(<PianoWidget />);
