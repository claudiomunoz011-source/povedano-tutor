import React, { Component, useEffect, useMemo, useRef, useState } from "react";

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        <p className="font-bold mb-2">⚠️ An error occurred in this panel:</p>
        <pre className="whitespace-pre-wrap text-xs bg-red-100 rounded-xl p-3 overflow-auto">{this.state.error?.message || String(this.state.error)}</pre>
        <button onClick={() => this.setState({ error: null })} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700">Try again</button>
      </div>
    );
    return this.props.children;
  }
}
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, BookOpenCheck, Users, Download, RefreshCw, Languages,
  Settings2, Sparkles, CheckCircle, XCircle, ClipboardList,
  LineChart, BarChart2, Key, Eye, EyeOff, Loader2, AlertTriangle, Lock, X
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const SCHOOL_NAME   = "Liceo San Pedro Poveda";
const LOGO_PATH     = "/logo.png";
const TEACHER_PASS  = "profesor2026";

const SCENARIOS = [
  { key: "airport",    label: "✈️ Airport" },
  { key: "restaurant", label: "🍽️ Restaurant" },
  { key: "hotel",      label: "🏨 Hotel" },
  { key: "school",     label: "🏫 School" },
  { key: "hospital",   label: "🏥 Hospital" },
  { key: "store",      label: "🛍️ Store" },
  { key: "street",     label: "🚕 Street" },
];

const LEVELS = [
  { key: "A1", label: "A1 Beginner" },
  { key: "A2", label: "A2 Elementary" },
  { key: "B1", label: "B1 Intermediate" },
  { key: "B2", label: "B2 Upper-Int" },
  { key: "C1", label: "C1 Advanced" },
];

const OPENERS = {
  airport:    "You are at the airport check-in counter. I am the airline agent. Hello! May I have your passport, please?",
  restaurant: "Welcome to The Blue Café. I'll be your waiter today. May I take your order?",
  hotel:      "Good evening! Welcome to Sunrise Hotel. Do you have a reservation?",
  school:     "Hi there! I'm your English teacher today. What would you like to practice?",
  hospital:   "Hello. I'm the nurse on duty. What brings you to the hospital today?",
  store:      "Hi! Welcome to City Mart. How can I help you today?",
  street:     "Excuse me! You look lost. Are you looking for a place?",
};

// ── Fallback corrections ──────────────────────────────────────────────────────
const RULES = [
  { pattern: /\bI want\b/gi,            replace: "I'd like",              note: "In service contexts, 'I'd like' is more polite than 'I want'." },
  { pattern: /\bI am agree\b/gi,        replace: "I agree",               note: "The verb 'agree' doesn't use 'am'. Say 'I agree'." },
  { pattern: /\bmore better\b/gi,       replace: "better",                note: "'Better' is already comparative; don't add 'more'." },
  { pattern: /\bpeoples\b/gi,           replace: "people",                note: "'People' is already plural; no 's' needed." },
  { pattern: /\bI have (\d+) years\b/gi,replace: (_,p)=>`I am ${p} years old`, note: "For age, say 'I am … years old'." },
  { pattern: /\bI no understand\b/gi,   replace: "I don't understand",    note: "Use 'don't' + base verb to negate in simple present." },
  { pattern: /\bI am not agree\b/gi,    replace: "I don't agree",         note: "Say 'I don't agree', not 'I am not agree'." },
];

const FOLLOWUPS = {
  airport:    ["How many bags are you checking in?","Where are you flying today?","Would you like a window or an aisle seat?"],
  restaurant: ["Would you like anything to drink?","How would you like your steak cooked?","Do you have any allergies?"],
  hotel:      ["How many nights will you be staying?","Would you prefer a double or a twin room?","Do you need breakfast included?"],
  school:     ["What topics would you like to review today?","Could you give me an example sentence in past simple?","What's your learning goal this week?"],
  hospital:   ["How long have you had these symptoms?","Are you taking any medication?","On a scale of 1 to 10, how strong is the pain?"],
  store:      ["What size are you looking for?","Would you like to try a different color?","Is this for a special occasion?"],
  street:     ["Where would you like to go?","Do you prefer the bus or the subway?","Do you have a map or use your phone?"],
};

function fallbackReply(scenario, input) {
  let corrected = input;
  const notes = [];
  for (const r of RULES) {
    if (r.pattern.test(corrected)) {
      corrected = corrected.replace(r.pattern, r.replace);
      notes.push(r.note);
    }
  }
  corrected = corrected.trim();
  if (corrected.length > 0) {
    corrected = corrected[0].toUpperCase() + corrected.slice(1);
    if (!/[.!?]$/.test(corrected)) corrected += ".";
  }
  const opts = FOLLOWUPS[scenario] || ["Could you tell me more?"];
  const follow = opts[Math.floor(Math.random() * opts.length)];
  const noteText = notes[0] || "Well phrased. Keep going!";
  return {
    text: `👍 Good!\n\n✔ Corrected: ${corrected}\n📝 Note: ${noteText}\n\n${follow}`,
    hasError: notes.length > 0,
  };
}

// ── Gemini API ────────────────────────────────────────────────────────────────
async function callGemini(apiKey, scenario, level, history, userInput) {
  const systemPrompt =
    `You are an English conversation tutor for ${SCHOOL_NAME}. ` +
    `Play the role of a native speaker in a "${scenario}" scenario. ` +
    `The student's level is ${level}. ` +
    `Rules:\n` +
    `1. Stay in character in your conversational reply.\n` +
    `2. Evaluate the student's latest input for spelling, grammar, or vocabulary mistakes.\n` +
    `3. You MUST respond in JSON format with the following keys:\n` +
    `   - "reply": Your conversational reply as the character (max 80 words, end with a follow-up question, be encouraging).\n` +
    `   - "hasError": boolean (true if the student made a spelling, grammar, or vocabulary mistake in their latest input, false otherwise).\n` +
    `   - "explanation": string (briefly explain the mistake and how to fix it in Spanish, or empty if hasError is false).\n` +
    `   - "correctedSentence": string (the corrected version of the student's sentence, or empty if hasError is false).`;

  // Filter out any error or fallback warning messages from history
  const cleanHistory = history.filter(m => 
    m.text && 
    !m.text.includes("⚠️ AI error") && 
    !m.text.includes("Fallback mode") &&
    !m.text.includes("Check your API key")
  );

  const contents = [];
  let lastRole = null;

  const addPart = (role, text) => {
    if (role === lastRole) {
      if (contents.length > 0) {
        contents[contents.length - 1].parts[0].text += "\n" + text;
      }
      return;
    }
    contents.push({ role, parts: [{ text }] });
    lastRole = role;
  };

  // Process history
  cleanHistory.forEach(m => {
    const apiRole = m.role === "tutor" ? "model" : "user";
    if (contents.length === 0 && apiRole === "model") {
      addPart("user", "Hello, let's start the dialogue.");
    }
    addPart(apiRole, m.text);
  });

  // Add the new user input
  addPart("user", userInput);

  const fetchFromModel = async (modelName) => {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { 
            temperature: 0.75, 
            maxOutputTokens: 1000,
            responseMimeType: "application/json"
          },
        }),
      }
    );
  };

  let res;
  try {
    res = await fetchFromModel("gemini-3.5-flash");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || "";
      const isTransient = res.status === 429 || res.status === 503 || errMsg.toLowerCase().includes("demand") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("quota");
      
      if (isTransient) {
        // Wait 1.5s and retry gemini-3.5-flash
        await new Promise(r => setTimeout(r, 1500));
        res = await fetchFromModel("gemini-3.5-flash");
        
        if (!res.ok) {
          // Fall back to gemini-3.1-pro-preview if still failing
          res = await fetchFromModel("gemini-3.1-pro-preview");
        }
      } else {
        // Re-create the response object so we can throw the error normally below
        res = { ok: false, json: async () => errData, status: res.status };
      }
    }
  } catch (e) {
    // If network failure or other error, try fallback
    try {
      res = await fetchFromModel("gemini-3.1-pro-preview");
    } catch (fallbackErr) {
      throw e; // throw the original error if fallback also fails
    }
  }

  if (!res || !res.ok) {
    const err = res ? await res.json().catch(() => ({})) : {};
    throw new Error(err?.error?.message || `API error ${res?.status || "Unknown"}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const loadLS = key => { try { return JSON.parse(localStorage.getItem(key)||"null") } catch { return null } };
const saveLS = (key, v) => localStorage.setItem(key, JSON.stringify(v));

// ── Password Modal ────────────────────────────────────────────────────────────
function PasswordModal({ onSuccess, onClose }) {
  const [pwd, setPwd]       = useState("");
  const [show, setShow]     = useState(false);
  const [error, setError]   = useState("");
  const inputRef            = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = e => {
    e.preventDefault();
    if (pwd.trim() === TEACHER_PASS.trim()) { onSuccess(); }
    else { setError("Incorrect password. Please try again."); setPwd(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-100 p-3 rounded-full mb-3">
            <Lock className="h-7 w-7 text-indigo-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Teacher Panel</h2>
          <p className="text-sm text-slate-500 mt-1">Enter the teacher password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={pwd}
              onChange={e => { setPwd(e.target.value); setError(""); }}
              placeholder="Password"
              className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${error ? "border-red-400 bg-red-50" : "border-slate-200"}`}
            />
            <button type="button" onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          <button type="submit"
            className="w-full py-3 rounded-xl bg-indigo-700 text-white font-semibold hover:bg-indigo-800 transition">
            Enter Panel
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function EnglishDialogueTutor() {
  const [mode, setMode]               = useState("student");
  const [showPassModal, setShowPassModal] = useState(false);
  const [apiKey, setApiKey]           = useState(() => loadLS("povedano_openai_key") || "");
  const [students, setStudents]       = useState(() => loadLS("povedano_students_v1") || []);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [newStudentName, setNewStudentName]   = useState("");
  const [newStudentCourse, setNewStudentCourse] = useState("");
  const [progress, setProgress]       = useState(() => loadLS("povedano_progress_v1") || {});
  const [scenario, setScenario]       = useState("restaurant");
  const [level, setLevel]             = useState("A2");
  const [started, setStarted]         = useState(false);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [lastCorrection, setLastCorrection] = useState(null);
  const [turnCount, setTurnCount]     = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [isLoading, setIsLoading]     = useState(false);
  const [aiError, setAiError]         = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, mode]);
  useEffect(() => saveLS("povedano_students_v1", students), [students]);
  useEffect(() => saveLS("povedano_progress_v1", progress), [progress]);
  useEffect(() => saveLS("povedano_openai_key", apiKey), [apiKey]);
  useEffect(() => {
    if (students.length > 0 && !students.find(s => s.id === selectedStudentId))
      setSelectedStudentId(students[0].id);
  }, [students]);

  const scenarioLabel = useMemo(() => SCENARIOS.find(s => s.key === scenario)?.label || "", [scenario]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId]);

  const startSession = () => {
    setMessages([{ role: "tutor", text: OPENERS[scenario] }]);
    setStarted(true); setLastCorrection(null);
    setTurnCount(0); setMistakeCount(0); setAiError("");
  };

  const resetSession = () => {
    setStarted(false); setMessages([]); setInput("");
    setLastCorrection(null); setTurnCount(0); setMistakeCount(0); setAiError("");
  };

  const endAndSaveSession = () => {
    if (!selectedStudent) return;
    const rec = { ts: Date.now(), scenario, level, turns: turnCount, mistakes: mistakeCount };
    setProgress(prev => ({
      ...prev,
      [selectedStudent.id]: [...(prev[selectedStudent.id] || []), rec],
    }));
    resetSession();
  };

  const onSend = async () => {
    if (!started || isLoading) return;
    const content = input.trim();
    if (!content) return;
    const studentMsg = { role: "student", text: content };
    setMessages(m => [...m, studentMsg]);
    setInput(""); setAiError(""); setTurnCount(t => t + 1);

    if (apiKey) {
      setIsLoading(true);
      try {
        const jsonText = await callGemini(apiKey, scenario, level, messages, content);
        
        let reply = "";
        let hasError = false;
        let notes = [];
        
        try {
          const result = JSON.parse(jsonText);
          reply = result.reply || "Hello!";
          hasError = !!result.hasError;
          if (hasError) {
            notes = [
              result.correctedSentence ? `❌ Corrected: "${result.correctedSentence}"` : "",
              result.explanation ? `💡 Note: ${result.explanation}` : ""
            ].filter(Boolean);
          }
        } catch (e) {
          // Fallback if parsing fails
          reply = jsonText;
          hasError = jsonText.includes("📝");
          if (hasError) {
            notes = ["See the 📝 Tip in the tutor's reply."];
          }
        }

        setMessages(m => [...m, { role: "tutor", text: reply }]);
        if (hasError) setMistakeCount(c => c + 1);
        setLastCorrection({ corrected: content, notes });
      } catch (err) {
        const msg = err.message;
        setAiError(msg);
        setMessages(m => [...m, { role: "tutor", text: "⚠️ AI error. Check your API key in the Teacher Panel." }]);
      } finally {
        setIsLoading(false);
      }
    } else {
      const { text, hasError } = fallbackReply(scenario, content);
      setMessages(m => [...m, { role: "tutor", text }]);
      if (hasError) setMistakeCount(c => c + 1);
      setLastCorrection({ corrected: content, notes: hasError ? ["Check the 📝 Note in the reply."] : [] });
    }
  };

  const downloadTranscript = () => {
    const txt = messages.map(m => `${m.role.toUpperCase()}: ${m.text.replace(/\n/g," ")}`).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" })),
      download: `dialogue_${scenario}_${new Date().toISOString().slice(0,10)}.txt`,
    });
    a.click();
  };

  const exportProgressCSV = () => {
    const rows = [["student_id","name","course","date","scenario","level","turns","mistakes"].join(",")];
    students.forEach(st =>
      (progress[st.id] || []).forEach(r =>
        rows.push([st.id, `"${st.name.replace(/"/g,'""')}"`, `"${(st.course||"").replace(/"/g,'""')}"`,
          fmtDate(r.ts), r.scenario, r.level, r.turns, r.mistakes].join(","))
      )
    );
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" })),
      download: `progress_${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
  };

  // Stats (memoized)
  const { totalSessions, totalTurns, totalMistakes, byScenario } = useMemo(() => {
    let totalSessions=0, totalTurns=0, totalMistakes=0;
    const byScenario = {};
    try {
      Object.values(progress || {}).forEach(arr => (Array.isArray(arr) ? arr : []).forEach(r => {
        if (!r) return;
        totalSessions++;
        totalTurns    += (r.turns    || 0);
        totalMistakes += (r.mistakes || 0);
        const sc = r.scenario || "unknown";
        if (!byScenario[sc]) byScenario[sc] = { sessions:0, turns:0, mistakes:0 };
        byScenario[sc].sessions++;
        byScenario[sc].turns    += (r.turns    || 0);
        byScenario[sc].mistakes += (r.mistakes || 0);
      }));
    } catch(e) { console.error("Stats error:", e); }
    return { totalSessions, totalTurns, totalMistakes, byScenario };
  }, [progress]);

  const handleTeacherClick = () => setShowPassModal(true);
  const handlePassSuccess  = () => { setShowPassModal(false); setMode("teacher"); };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">

      {/* Password Modal */}
      <AnimatePresence>
        {showPassModal && (
          <PasswordModal onSuccess={handlePassSuccess} onClose={() => setShowPassModal(false)} />
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <img src={LOGO_PATH} alt="logo" className="h-12 w-12 rounded-full border object-cover" />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-indigo-900 flex items-center gap-3">
                <Languages className="h-7 w-7" /> {SCHOOL_NAME} · English Dialogue Tutor
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Practice real English conversations. Automatic correction and student progress tracking.
                {apiKey
                  ? <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Gemini AI Active</span>
                  : <span className="ml-2 text-amber-500 font-medium">⚠️ No API Key — fallback mode</span>
                }
              </p>
            </div>
          </div>
          <div>
            {mode === "student" ? (
              <button onClick={handleTeacherClick}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-indigo-900 text-white shadow hover:opacity-90 transition">
                <Lock className="h-4 w-4" /> Teacher Panel
              </button>
            ) : (
              <button onClick={() => setMode("student")}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-indigo-900 text-white shadow hover:opacity-90 transition">
                <BookOpenCheck className="h-4 w-4" /> Student Mode
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        {mode === "student" ? (
          <StudentMode
            scenario={scenario} setScenario={setScenario} level={level} setLevel={setLevel}
            started={started} startSession={startSession} resetSession={resetSession}
            endAndSaveSession={endAndSaveSession} messages={messages} lastCorrection={lastCorrection}
            input={input} setInput={setInput} onSend={onSend} scenarioLabel={scenarioLabel}
            turnCount={turnCount} mistakeCount={mistakeCount} bottomRef={bottomRef}
            students={students} selectedStudentId={selectedStudentId}
            setSelectedStudentId={setSelectedStudentId} newStudentName={newStudentName}
            setNewStudentName={setNewStudentName} newStudentCourse={newStudentCourse}
            setNewStudentCourse={setNewStudentCourse} setStudents={setStudents}
            downloadTranscript={downloadTranscript} isLoading={isLoading} aiError={aiError}
            apiKey={apiKey}
          />
        ) : (
          <ErrorBoundary>
            <TeacherPanel
              students={students || []} progress={progress || {}} byScenario={byScenario || {}}
              totalSessions={totalSessions || 0} totalTurns={totalTurns || 0} totalMistakes={totalMistakes || 0}
              exportProgressCSV={exportProgressCSV} apiKey={apiKey || ""} setApiKey={setApiKey}
            />
          </ErrorBoundary>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          {apiKey ? "🤖 Powered by Google Gemini 3.5 Flash" : "Demo mode — enter your Google AI Studio API Key in the Teacher Panel."}
        </p>
      </div>
    </div>
  );
}

// ── Student Mode ──────────────────────────────────────────────────────────────
function StudentMode({ scenario, setScenario, level, setLevel, started, startSession, resetSession,
  endAndSaveSession, messages, lastCorrection, input, setInput, onSend, scenarioLabel, turnCount,
  mistakeCount, bottomRef, students, selectedStudentId, setSelectedStudentId, newStudentName,
  setNewStudentName, newStudentCourse, setNewStudentCourse, setStudents, downloadTranscript,
  isLoading, aiError, apiKey }) {

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Left: config + chat */}
      <div className="md:col-span-2 space-y-4">

        {/* Config */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold">Scenario, Level & Student</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {SCENARIOS.map(s => (
              <button key={s.key} onClick={() => setScenario(s.key)}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${scenario === s.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {LEVELS.map(l => (
              <button key={l.key} onClick={() => setLevel(l.key)}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${level === l.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}>
                {l.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              <b>Scenario:</b> {scenarioLabel} · <b>Level:</b> {level}
            </span>
          </div>

          {/* Student selector */}
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Select student</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
                {students.length === 0 && <option value="">— No students yet —</option>}
                {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.course ? ` · ${s.course}` : ""}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">New student name</label>
              <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)}
                placeholder="e.g. Ana Pérez" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="w-full md:w-36">
              <label className="text-xs text-slate-500 block mb-1">Course</label>
              <input type="text" value={newStudentCourse} onChange={e => setNewStudentCourse(e.target.value)}
                placeholder="e.g. 3rd Grade B" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button onClick={() => {
              const name = newStudentName.trim(); if (!name) return;
              const id = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
              setStudents(prev => [...prev, { id, name, course: newStudentCourse.trim() }]);
              setSelectedStudentId(id); setNewStudentName(""); setNewStudentCourse("");
            }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700">
              Add
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          {!apiKey && (
            <div className="flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-semibold block text-amber-800">Modo Demostración Activo (Sin Clave IA)</span>
                <span>Las respuestas del tutor serán predefinidas y repetitivas. Para activar la Inteligencia Artificial real, el profesor debe ingresar la clave API de Gemini en el <b>Teacher Panel</b> (arriba a la derecha).</span>
              </div>
            </div>
          )}
          <div className="h-[400px] overflow-y-auto pr-1 mb-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 italic p-3">Press <b>Start Scenario</b> to begin the conversation.</p>
            )}
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className={`mb-3 flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
                    ${m.role === "student"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex justify-start mb-3">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              </motion.div>
            )}

            {aiError && (
              <div className="flex gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span><b>Error:</b> {aiError}</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div className="flex gap-2 mb-3">
            <input type="text"
              placeholder={started ? "Write your reply in English..." : "Click Start Scenario first"}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !isLoading) onSend(); }}
              disabled={!started || isLoading}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50" />
            <button onClick={onSend} disabled={!started || !input.trim() || isLoading}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-700 disabled:opacity-40">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={startSession} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700">
              <Sparkles className="h-4 w-4" /> {started ? "Restart" : "Start Scenario"}
            </button>
            <button onClick={resetSession} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white border border-slate-200 text-sm shadow-sm hover:shadow">
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
            <button onClick={downloadTranscript} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-slate-200 text-sm shadow-sm hover:shadow">
              <Download className="h-4 w-4" /> Export
            </button>
            <button onClick={endAndSaveSession} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-amber-500 text-white text-sm shadow hover:bg-amber-600">
              Save session
            </button>
            <span className="ml-auto text-xs text-slate-500">
              💬 Turns: <b>{turnCount}</b> · ⚠️ Mistakes: <b>{mistakeCount}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        {/* Correction panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            {lastCorrection?.notes?.length === 0
              ? <CheckCircle className="h-4 w-4 text-emerald-600" />
              : <XCircle className="h-4 w-4 text-amber-500" />}
            <span className="text-sm font-semibold">Correction & Notes</span>
          </div>
          {lastCorrection
            ? <ul className="list-disc pl-4 text-sm text-slate-600 space-y-1">
                {lastCorrection.notes.length > 0
                  ? lastCorrection.notes.map((n, i) => <li key={i}>{n}</li>)
                  : <li>Well phrased. Keep going!</li>}
              </ul>
            : <p className="text-sm text-slate-500">Corrections will appear here after your first message.</p>
          }
        </div>

        {/* Student history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold">Student Progress</span>
          </div>
          {!selectedStudentId
            ? <p className="text-sm text-slate-500">Select a student to view their history.</p>
            : <StudentHistory studentId={selectedStudentId} />
          }
        </div>
      </div>
    </div>
  );
}

// ── Student History ───────────────────────────────────────────────────────────
function StudentHistory({ studentId }) {
  const [prog, setProg] = useState(() => loadLS("povedano_progress_v1") || {});
  useEffect(() => {
    const fn = () => setProg(loadLS("povedano_progress_v1") || {});
    window.addEventListener("storage", fn); return () => window.removeEventListener("storage", fn);
  }, []);
  const data = (prog[studentId] || []).slice().reverse();
  if (data.length === 0) return <p className="text-sm text-slate-500">No sessions recorded yet.</p>;
  return (
    <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl text-xs">
      <table className="w-full">
        <thead><tr className="bg-slate-50 text-slate-400 sticky top-0">
          <th className="px-2 py-1.5 text-left">Date</th>
          <th className="px-2 py-1.5 text-left">Scenario</th>
          <th className="px-2 py-1.5 text-center">Lvl</th>
          <th className="px-2 py-1.5 text-right">Turns</th>
          <th className="px-2 py-1.5 text-right">Err</th>
        </tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50">
              <td className="px-2 py-1">{fmtDate(r.ts)}</td>
              <td className="px-2 py-1">{r.scenario}</td>
              <td className="px-2 py-1 text-center">{r.level}</td>
              <td className="px-2 py-1 text-right">{r.turns}</td>
              <td className="px-2 py-1 text-right">{r.mistakes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeacherPanel({ students, progress, byScenario, totalSessions, totalTurns, totalMistakes, exportProgressCSV, apiKey, setApiKey }) {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);

  const avgTurns    = totalSessions ? (totalTurns / totalSessions).toFixed(1) : "0.0";
  const avgMistakes = totalSessions ? (totalMistakes / totalSessions).toFixed(1) : "0.0";

  const handleSave = () => {
    setApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim();
    if (!keyToTest) {
      setTestResult({ success: false, msg: "Por favor, introduce una clave API antes de probar." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${keyToTest}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Respond only with the word OK." }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Error ${res.status}`);
      }
      const data = await res.json();
      const txt = data.candidates[0].content.parts[0].text.trim();
      if (txt.toLowerCase().includes("ok")) {
        setTestResult({ success: true, msg: "¡Conexión exitosa! La clave es válida y está activa." });
      } else {
        setTestResult({ success: true, msg: `Conexión establecida, pero la IA respondió algo inusual: "${txt}"` });
      }
    } catch (err) {
      setTestResult({ success: false, msg: `Error de conexión: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* API Key Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Key className="h-5 w-5 text-indigo-600" />
          <span className="text-base font-bold text-slate-800">Google Gemini API Key</span>
          {apiKey && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" /> Active
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Get your free API key at{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
            aistudio.google.com/apikey
          </a>{" "}
          (starts with <code className="bg-slate-100 px-1 rounded">AIza…</code>).
          The key is stored only in this browser.
        </p>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setSaved(false); setTestResult(null); }}
              placeholder="AIza..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button type="button" onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 transition min-w-[90px]">
            {saved ? "✅ Saved!" : "Save Key"}
          </button>
          <button onClick={handleTestKey} disabled={testing}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold shadow transition disabled:opacity-50 min-w-[100px]">
            {testing ? "Testing..." : "Test Key"}
          </button>
          {apiKey && (
            <button onClick={() => { setKeyInput(""); setApiKey(""); setTestResult(null); }}
              className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold border border-red-200 hover:bg-red-100 transition">
              Remove
            </button>
          )}
        </div>

        {testResult && (
          <div className={`mt-3 flex gap-2 text-xs border rounded-xl px-3 py-2.5 ${
            testResult.success
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}>
            {testResult.success ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{testResult.msg}</span>
          </div>
        )}

        {!apiKey && (
          <div className="mt-3 flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>No API key — students receive static responses. Add your Gemini key above to enable AI-powered conversations.</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />}        label="Students"          value={students.length} />
        <StatCard icon={<BookOpenCheck className="h-5 w-5" />} label="Sessions"          value={totalSessions} />
        <StatCard icon={<LineChart className="h-5 w-5" />}     label="Turns / session"   value={avgTurns} />
        <StatCard icon={<BarChart2 className="h-5 w-5" />}     label="Mistakes / session" value={avgMistakes} />
      </div>

      {/* Scenario breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold">Breakdown by scenario</span>
          </div>
          <button onClick={exportProgressCSV} className="text-sm rounded-xl px-3 py-1.5 bg-indigo-600 text-white shadow hover:bg-indigo-700">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Scenario</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">Turns</th>
              <th className="px-3 py-2 text-right">Mistakes</th>
            </tr></thead>
            <tbody>
              {Object.entries(byScenario).length === 0
                ? <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No data yet.</td></tr>
                : Object.entries(byScenario).map(([sc, v]) => (
                  <tr key={sc} className="odd:bg-white even:bg-slate-50 border-t border-slate-100">
                    <td className="px-3 py-2 capitalize">{sc}</td>
                    <td className="px-3 py-2 text-right">{v.sessions}</td>
                    <td className="px-3 py-2 text-right">{v.turns}</td>
                    <td className="px-3 py-2 text-right">{v.mistakes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Students table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold">Students & sessions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Course</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">Turns</th>
              <th className="px-3 py-2 text-right">Mistakes</th>
            </tr></thead>
            <tbody>
              {students.length === 0
                ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No students yet.</td></tr>
                : students.map(s => {
                  const arr = progress[s.id] || [];
                  return (
                    <tr key={s.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-slate-500">{s.course || "—"}</td>
                      <td className="px-3 py-2 text-right">{arr.length}</td>
                      <td className="px-3 py-2 text-right">{arr.reduce((a,b)=>a+b.turns,0)}</td>
                      <td className="px-3 py-2 text-right">{arr.reduce((a,b)=>a+b.mistakes,0)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-1">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
