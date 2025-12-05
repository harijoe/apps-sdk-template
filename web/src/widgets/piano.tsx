import { useState, useEffect, useCallback, useRef } from "react";
import { Piano, KeyboardShortcuts, MidiNumbers } from "react-piano";
import Soundfont from "soundfont-player";
import { mountWidget, useLocale } from "skybridge/web";
import { Spinner } from "../components/ui/shadcn-io/spinner";
import "../index.css";
import "react-piano/dist/styles.css";

type NoteRecord = {
  midiNumber: number;
  noteName: string;
  timestamp: number;
  intervalFromPrevious?: number; // Time in ms from previous note
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SoundfontInstrument = any;

function PianoWidget() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [instrument, setInstrument] = useState<SoundfontInstrument | null>(null);
  const [recordedNotes, setRecordedNotes] = useState<NoteRecord[]>([]);
  const [pianoWidth, setPianoWidth] = useState(600);
  const [isThinking, setIsThinking] = useState(false);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const noteStartTimesRef = useRef<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();

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

  const toDoReMi = (noteName: string): string => {
    const noteMap: Record<string, string> = {
      C: "Do",
      D: "Re",
      E: "Mi",
      F: "Fa",
      G: "Sol",
      A: "La",
      B: "Si",
    };
    return noteMap[noteName] || noteName;
  };
  const playNote = useCallback(
    (midiNumber: number) => {
      if (instrument) {
        instrument.play(midiNumber);
      }
    },
    [instrument],
  );

  const stopNote = useCallback(
    (midiNumber: number) => {
      // Keep sound playing even if key is released - do nothing
      // if (instrument) {
      //   instrument.stop(midiNumber);
      // }
    },
    [instrument],
  );

  const onPlayNoteInput = useCallback((midiNumber: number) => {
    // Only record if this note is not already active (prevents duplicate recordings)
    if (!activeNotesRef.current.has(midiNumber)) {
      activeNotesRef.current.add(midiNumber);
      const now = Date.now();
      noteStartTimesRef.current.set(midiNumber, now);

      // Get note name from static mapping (C, D, E, F, G, A, B)
      const noteName = getNoteName(midiNumber);

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
  }, []);

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

  const handleGuess = useCallback(() => {
    if (recordedNotes.length === 0) {
      return;
    }

    setIsThinking(true);

    // Format notes with timings for the LLM
    const notesString = recordedNotes
      .map((note, index) => {
        if (index === 0) {
          return `${note.noteName}`;
        }

        return `${toDoReMi(note.noteName)}`;
      })
      .join(", ");

    const prompt = `I've played these notes on a piano: ${notesString}. Try your best to guess what song this is. It's most likely a '${locale}' song but not necessarily, it's most likely popular though. I want a short answer : just reply with the song name.`;

    window.openai.sendFollowUpMessage({ prompt });

    // Clear the recorded notes after sending the guess
    setRecordedNotes([]);
    activeNotesRef.current.clear();
    noteStartTimesRef.current.clear();

    // Reset thinking state after a delay (since we don't have a callback from sendFollowUpMessage)
    // The user can also reset it by clicking reset or recording new notes
    setTimeout(() => {
      setIsThinking(false);
    }, 5000);
  }, [recordedNotes, locale]);

  const handleReset = useCallback(() => {
    setRecordedNotes([]);
    setIsThinking(false);
    activeNotesRef.current.clear();
    noteStartTimesRef.current.clear();
  }, []);

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
      <div className="flex flex-col items-center justify-center w-full" style={{ height: "80%", minHeight: "300px" }}>
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
        <div className="flex flex-row gap-3 items-center justify-center">
          <button
            onClick={handleGuess}
            disabled={recordedNotes.length === 0 || isThinking}
            className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 shadow-sm"
          >
            {locale === "en" ? "Guess" : "Devinez"}
          </button>
          <button
            onClick={handleReset}
            disabled={recordedNotes.length === 0}
            className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-6 py-2 shadow-sm"
            title="Reset recorded notes"
          >
            {locale === "en" ? "Reset" : "Recommencer"}
          </button>
        </div>
        {isThinking && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Spinner variant="circle" size={16} />
            <span>{locale === "en" ? "ChatGPT is thinking…" : "ChatGPT réfléchit…"}</span>
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
      </div>
    </div>
  );
}

export default PianoWidget;

mountWidget(<PianoWidget />);
