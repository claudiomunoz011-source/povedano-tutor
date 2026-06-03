import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, BookOpenCheck, Users, Download, RefreshCw, Languages, Settings2, Sparkles, CheckCircle, XCircle, ClipboardList, LineChart, BarChart2 } from "lucide-react";

const SCHOOL_NAME = "Liceo San Pedro Poveda";
const LOGO_PATH = "/logo.png";
const BRAND = {
  primary: "indigo-900",
  accent: "red-600",
  bgFrom: "slate-50",
  bgTo: "slate-100",
};

const SCENARIOS = [
  { key: "airport", label: "✈️ Airport" },
  { key: "restaurant", label: "🍽️ Restaurant" },
  { key: "hotel", label: "🏨 Hotel" },
  { key: "school", label: "🏫 School" },
  { key: "hospital", label: "🏥 Hospital" },
  { key: "store", label: "🛍️ Store" },
  { key: "street", label: "🚕 Street" },
];

const LEVELS = [
  { key: "A1", label: "A1 Beginner" },
  { key: "A2", label: "A2 Elementary" },
  { key: "B1", label: "B1 Intermediate" },
  { key: "B2", label: "B2 Upper-Int" },
  { key: "C1", label: "C1 Advanced" },
];

const scenarioOpeners = {
  airport: "You are at the airport check-in counter. I am the airline agent. Hello! May I have your passport, please?",
  restaurant: "Welcome to The Blue Café. I'll be your waiter today. May I take your order?",
  hotel: "Good evening! Welcome to Sunrise Hotel. Do you have a reservation?",
  school: "Hi there! I'm your English teacher today. What would you like to practice?",
  hospital: "Hello. I'm the nurse on duty. What brings you to the hospital today?",
  store: "Hi! Welcome to City Mart. How can I help you today?",
  street: "Excuse me! You look lost. Are you looking for a place?",
};

const CORRECTION_RULES = [
  { pattern: /\bI want\b/gi, replace: "I'd like", reasonEn: "In service contexts, 'I'd like' is more polite than 'I want'." },
  { pattern: /\bI am agree\b/gi, replace: "I agree", reasonEn: "The verb 'agree' doesn't use 'am': say 'I agree'." },
  { pattern: /\bmore better\b/gi, replace: "better", reasonEn: "'Better' is already comparative; don't use 'more better'." },
  { pattern: /\bpeoples\b/gi, replace: "people", reasonEn: "'People' is already plural; don't add 's'." },
  { pattern: /\bI have (\d+) years\b/gi, replace: (m,p)=>`I am ${p} years old`, reasonEn: "For age, say 'I am … years old'." },
  { pattern: /\bI no understand\b/gi, replace: "I don't understand", reasonEn: "To negate in simple present, use: 'don't' + base verb." },
  { pattern: /\bI am not agree\b/gi, replace: "I don't agree", reasonEn: "Use 'I don't agree', not 'I am not agree'." },
];

function applyCorrections(input){
  let corrected = input;
  const notes = [];
  for(const rule of CORRECTION_RULES){
    if(rule.pattern.test(corrected)){
      corrected = corrected.replace(rule.pattern, rule.replace);
      notes.push(rule.reasonEn);
    }
  }
  corrected = corrected.trim();
  if(corrected.length>0){
    corrected = corrected[0].toUpperCase() + corrected.slice(1);
    if(!/[.!?]$/.test(corrected)) corrected += ".";
  }
  return { corrected, notes };
}

function nextFollowUpByScenario(scenario, level){
  const map = {
    airport: ["How many bags are you checking in?","Where are you flying today?","Would you like a window or an aisle seat?"],
    restaurant: ["Would you like anything to drink?","How would you like your steak cooked?","Do you have any allergies?"],
    hotel: ["How many nights will you be staying?","Would you prefer a double or a twin room?","Do you need breakfast included?"],
    school: ["What topics would you like to review today?","Could you give me an example sentence using the past simple?","What's your learning goal for this week?"],
    hospital: ["How long have you had these symptoms?","Are you taking any medication?","On a scale of 1 to 10, how strong is the pain?"],
    store: ["What size are you looking for?","Would you like to try a different color?","Is this for a special occasion?"],
    street: ["Where would you like to go?","Do you prefer the bus or the subway?","Do you have a map or use your phone?"],
  };
  const options = map[scenario] || ["Could you tell me more?"];
  return options[Math.floor(Math.random()*options.length)];
}

function fmtDate(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function loadLS(key){ try{ return JSON.parse(localStorage.getItem(key)||"null") }catch{ return null } }
function saveLS(key, v){ localStorage.setItem(key, JSON.stringify(v)) }

export default function EnglishDialogueTutor(){

  const [mode, setMode] = useState("student");
  const [students, setStudents] = useState(()=> loadLS("povedano_students_v1") || []);
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentCourse, setNewStudentCourse] = useState("");
  const [progress, setProgress] = useState(()=> loadLS("povedano_progress_v1") || {});

  const [scenario, setScenario] = useState("restaurant");
  const [level, setLevel] = useState("A2");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [lastCorrection, setLastCorrection] = useState(null);
  const [turnCount, setTurnCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}) }, [messages, lastCorrection, mode]);

  useEffect(()=>saveLS("povedano_students_v1", students), [students]);
  useEffect(()=>saveLS("povedano_progress_v1", progress), [progress]);

  useEffect(()=>{
    if(students.length>0 && !students.find(s=>s.id===selectedStudentId)) setSelectedStudentId(students[0].id)
  }, [students]);

  const scenarioLabel = useMemo(()=> SCENARIOS.find(s=>s.key===scenario)?.label || "Scenario", [scenario]);
  const selectedStudent = useMemo(()=> students.find(s=>s.id===selectedStudentId) || null, [students, selectedStudentId]);

  const startSession = ()=> {
    setMessages([{ role: "tutor", text: scenarioOpeners[scenario] }]);
    setStarted(true); setLastCorrection(null); setTurnCount(0); setMistakeCount(0);
  };
  const resetSession = ()=>{ setStarted(false); setMessages([]); setInput(""); setLastCorrection(null); setTurnCount(0); setMistakeCount(0); }

  const endAndSaveSession = ()=>{
    if(!selectedStudent) return;
    const rec = { ts: Date.now(), scenario, level, turns: turnCount, mistakes: mistakeCount };
    setProgress(prev=>{
      const arr = prev[selectedStudent.id] ? [...prev[selectedStudent.id]] : [];
      arr.push(rec);
      return { ...prev, [selectedStudent.id]: arr };
    });
    resetSession();
  };

  const onSend = ()=>{
    if(!started) return;
    const content = input.trim();
    if(!content) return;
    const studentMsg = { role: "student", text: content };
    const correction = applyCorrections(content);
    const follow = nextFollowUpByScenario(scenario, level);
    const reply = `👍 Good!\n\n✔ Corrected version: ${correction.corrected}\n📝 Note: ${correction.notes[0] || "Well phrased. Keep going!"}\n\n${follow}`;
    const tutorMsg = { role: "tutor", text: reply };
    setMessages(m=>[...m, studentMsg, tutorMsg]);
    setLastCorrection(correction); setInput(""); setTurnCount(t=>t+1); setMistakeCount(m=>m+(correction.notes?.length||0));
  };

  const downloadTranscript = ()=>{
    const lines = messages.map(m=>`${m.role.toUpperCase()}: ${m.text.replace(/\n/g," ")}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `english_dialogue_${scenario}_${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  const exportProgressCSV = ()=>{
    const header = ["student_id","name","course","date","scenario","level","turns","mistakes"];
    const rows = [header.join(",")];
    students.forEach(st=>{
      const arr = progress[st.id] || [];
      arr.forEach(r=>rows.push([st.id, `"${st.name.replace(/"/g,'""')}"`, `"${(st.course||"").replace(/"/g,'""')}"`, fmtDate(r.ts), r.scenario, r.level, r.turns, r.mistakes].join(",")));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `povedano_english_progress_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const computeStats = ()=>{
    let totalSessions=0,totalTurns=0,totalMistakes=0;
    const byScenario = {};
    Object.entries(progress).forEach(([sid, arr])=>arr.forEach(r=>{
      totalSessions+=1; totalTurns+=r.turns; totalMistakes+=r.mistakes;
      if(!byScenario[r.scenario]) byScenario[r.scenario]={sessions:0,turns:0,mistakes:0};
      byScenario[r.scenario].sessions+=1; byScenario[r.scenario].turns+=r.turns; byScenario[r.scenario].mistakes+=r.mistakes;
    }));
    return { totalSessions, totalTurns, totalMistakes, byScenario };
  };

  const { totalSessions, totalTurns, totalMistakes, byScenario } = computeStats();

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b from-${BRAND.bgFrom} to-${BRAND.bgTo} text-slate-800`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={LOGO_PATH} alt="logo" className="h-12 w-12 rounded-full border" style={{objectFit:"cover"}} />
            <div>
              <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight text-${BRAND.primary} flex items-center gap-3`}>
                <Languages className="h-7 w-7" /> {SCHOOL_NAME} · English Dialogue Tutor
              </h1>
              <p className="text-sm md:text-base text-slate-600 mt-1">Practice real English conversations. Automatic correction and progress tracking per student.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode==="student"?(
              <button onClick={()=>setMode("teacher")} className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-indigo-900 text-white shadow hover:opacity-90 transition`}>
                <Users className="h-4 w-4" /> Teacher Panel
              </button>
            ):(
              <button onClick={()=>setMode("student")} className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-indigo-900 text-white shadow hover:opacity-90 transition`}>
                <BookOpenCheck className="h-4 w-4" /> Student Mode
              </button>
            )}
          </div>
        </div>

        {mode==="student" ? (
          <StudentMode
            scenario={scenario} setScenario={setScenario} level={level} setLevel={setLevel}
            started={started} startSession={startSession} resetSession={resetSession} endAndSaveSession={endAndSaveSession}
            messages={messages} lastCorrection={lastCorrection} input={input} setInput={setInput} onSend={onSend}
            scenarioLabel={scenarioLabel} turnCount={turnCount} mistakeCount={mistakeCount} bottomRef={bottomRef}
            students={students} selectedStudentId={selectedStudentId} setSelectedStudentId={setSelectedStudentId}
            newStudentName={newStudentName} setNewStudentName={setNewStudentName} newStudentCourse={newStudentCourse} setNewStudentCourse={setNewStudentCourse}
            setStudents={setStudents} downloadTranscript={downloadTranscript}
          />
        ) : (
          <TeacherPanel students={students} progress={progress} byScenario={byScenario} totalSessions={totalSessions} totalTurns={totalTurns} totalMistakes={totalMistakes} exportProgressCSV={exportProgressCSV} />
        )}

        <div className="text-center text-xs text-slate-500 mt-6">Demo — connect OpenAI in <code>onSend()</code> for AI-powered corrections.</div>
      </div>
    </div>
  );
}

function StudentMode(props){
  const { scenario, setScenario, level, setLevel, started, startSession, resetSession, endAndSaveSession, messages, lastCorrection, input, setInput, onSend, scenarioLabel, turnCount, mistakeCount, bottomRef, students, selectedStudentId, setSelectedStudentId, newStudentName, setNewStudentName, newStudentCourse, setNewStudentCourse, setStudents, downloadTranscript } = props;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2"><Settings2 className="h-4 w-4" /><span className="text-sm font-semibold">Scenario, Level & Student</span></div>

          <div className="flex flex-wrap gap-2 mb-3">
            {SCENARIOS.map(s=><button key={s.key} onClick={()=>setScenario(s.key)} className={`px-3 py-1.5 rounded-full border text-sm transition ${scenario===s.key?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>{s.label}</button>)}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {LEVELS.map(l=><button key={l.key} onClick={()=>setLevel(l.key)} className={`px-3 py-1.5 rounded-full border text-sm transition ${level===l.key?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>{l.label}</button>)}
            <div className="ml-auto text-sm text-slate-600"><span className="font-medium">Scenario:</span> {scenarioLabel} · <span className="font-medium">Level:</span> {level}</div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500">Select student</label>
              <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
                {students.length===0 && <option value="">— No students yet —</option>}
                {students.map(s=><option key={s.id} value={s.id}>{s.name} {s.course?`· ${s.course}`:''}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500">New student name</label>
              <input type="text" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} placeholder="e.g. Ana Pérez" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="w-full md:w-40">
              <label className="text-xs text-slate-500">Class / Course</label>
              <input type="text" value={newStudentCourse} onChange={e=>setNewStudentCourse(e.target.value)} placeholder="e.g. 3rd Grade B" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button onClick={()=>{ const name=newStudentName.trim(); if(!name) return; const id=`${Date.now()}_${Math.random().toString(36).slice(2,8)}`; const st={id,name,course:newStudentCourse.trim()}; setStudents(prev=>[...prev, st]); setSelectedStudentId(id); setNewStudentName(''); setNewStudentCourse(''); }} className="rounded-xl px-4 py-2 bg-emerald-600 text-white shadow hover:bg-emerald-700">Add</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="h-[420px] overflow-y-auto pr-2">
            {messages.length===0 && <div className="text-sm text-slate-500 p-4 italic">Press <b>Start Scenario</b> to begin.</div>}
            <AnimatePresence>
              {messages.map((m,idx)=>(
                <motion.div key={idx} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className={`mb-3 flex ${m.role==="student"?"justify-end":"justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role==="student"?'bg-indigo-600 text-white rounded-br-sm':'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>{m.text}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input type="text" placeholder={started?"Write your reply in English...":"Click Start Scenario first"} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") onSend(); }} disabled={!started} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            <button onClick={onSend} disabled={!started || !input.trim()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:opacity-50"><Send className="h-4 w-4" /> Send</button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={startSession} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white shadow hover:bg-emerald-700"><Sparkles className="h-4 w-4" /> {started?"Restart Scenario":"Start Scenario"}</button>
            <button onClick={resetSession} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white border border-slate-200 shadow-sm hover:shadow"><RefreshCw className="h-4 w-4" /> Reset</button>
            <button onClick={downloadTranscript} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white border border-slate-200 shadow-sm hover:shadow"><Download className="h-4 w-4" /> Export dialogue</button>
            <button onClick={endAndSaveSession} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-amber-500 text-white shadow hover:brightness-95">Save session</button>
            <div className="ml-auto text-xs text-slate-600"><span className="mr-3">💬 Turns: <b>{turnCount}</b></span><span>⚠️ Mistakes: <b>{mistakeCount}</b></span></div>
          </div>
        </div>
      </div>

      <div className="md:col-span-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">{lastCorrection && lastCorrection.notes.length===0 ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}<span className="text-sm font-semibold">Correction & Notes</span></div>
          {lastCorrection ? <div><p className="text-sm mb-2"><span className="font-semibold">Corrected:</span> {lastCorrection.corrected}</p><ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">{lastCorrection.notes.length>0 ? lastCorrection.notes.map((n,i)=><li key={i}>{n}</li>) : <li>Well phrased. Keep going!</li>}</ul></div> : <p className="text-sm text-slate-600">Corrections will appear here after your first message.</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mt-4">
          <div className="flex items-center gap-2 mb-2"><ClipboardList className="h-4 w-4" /><span className="text-sm font-semibold">Student Progress</span></div>
          {students.length===0 || !selectedStudentId ? <p className="text-sm text-slate-600">Add and select a student to see their history.</p> : <StudentHistory studentId={selectedStudentId} />}
        </div>
      </div>
    </div>
  );
}

function StudentHistory({ studentId }){
  const [progress, setProgress] = useState(()=> loadLS("povedano_progress_v1") || {});
  useEffect(()=>{ const onStorage=()=>setProgress(loadLS("povedano_progress_v1")||{}); window.addEventListener("storage", onStorage); return ()=>window.removeEventListener("storage", onStorage); }, []);
  const data = progress[studentId] || [];
  if(data.length===0) return <p className="text-sm text-slate-600">No sessions recorded yet.</p>;
  return (
    <div className="text-xs">
      <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
        <table className="w-full">
          <thead><tr className="bg-slate-50 text-slate-500"><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Scenario</th><th className="px-2 py-1 text-left">Level</th><th className="px-2 py-1 text-right">Turns</th><th className="px-2 py-1 text-right">Mistakes</th></tr></thead>
          <tbody>{data.slice().reverse().map((r,i)=>(<tr key={i} className="odd:bg-white even:bg-slate-50"><td className="px-2 py-1">{fmtDate(r.ts)}</td><td className="px-2 py-1">{r.scenario}</td><td className="px-2 py-1">{r.level}</td><td className="px-2 py-1 text-right">{r.turns}</td><td className="px-2 py-1 text-right">{r.mistakes}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherPanel({ students, progress, byScenario, totalSessions, totalTurns, totalMistakes, exportProgressCSV }){
  const avgTurns = totalSessions ? (totalTurns/totalSessions).toFixed(1) : "0.0";
  const avgMistakes = totalSessions ? (totalMistakes/totalSessions).toFixed(1) : "0.0";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Students" value={students.length} />
        <StatCard icon={<BookOpenCheck className="h-5 w-5" />} label="Sessions" value={totalSessions} />
        <StatCard icon={<LineChart className="h-5 w-5" />} label="Turns / session" value={avgTurns} />
        <StatCard icon={<BarChart2 className="h-5 w-5" />} label="Mistakes / session" value={avgMistakes} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><span className="text-sm font-semibold">Breakdown by scenario</span></div>
          <button onClick={exportProgressCSV} className="text-sm rounded-xl px-3 py-1.5 bg-indigo-600 text-white shadow hover:bg-indigo-700">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500"><th className="px-2 py-2 text-left">Scenario</th><th className="px-2 py-2 text-right">Sessions</th><th className="px-2 py-2 text-right">Turns</th><th className="px-2 py-2 text-right">Mistakes</th></tr></thead>
            <tbody>{Object.entries(byScenario).length===0 ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500">No data yet.</td></tr> : Object.entries(byScenario).map(([sc,v])=>(<tr key={sc} className="odd:bg-white even:bg-slate-50"><td className="px-2 py-2">{sc}</td><td className="px-2 py-2 text-right">{v.sessions}</td><td className="px-2 py-2 text-right">{v.turns}</td><td className="px-2 py-2 text-right">{v.mistakes}</td></tr>))}</tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4" /><span className="text-sm font-semibold">Students & sessions</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500"><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Course</th><th className="px-2 py-2 text-right">Sessions</th><th className="px-2 py-2 text-right">Turns</th><th className="px-2 py-2 text-right">Mistakes</th></tr></thead>
            <tbody>{students.length===0 ? <tr><td colSpan={5} className="px-2 py-4 text-center text-slate-500">No students yet.</td></tr> : students.map(s=>{ const arr = progress[s.id] || []; const tTurns = arr.reduce((a,b)=>a+b.turns,0); const tMist = arr.reduce((a,b)=>a+b.mistakes,0); return (<tr key={s.id} className="odd:bg-white even:bg-slate-50"><td className="px-2 py-2">{s.name}</td><td className="px-2 py-2">{s.course || "—"}</td><td className="px-2 py-2 text-right">{arr.length}</td><td className="px-2 py-2 text-right">{tTurns}</td><td className="px-2 py-2 text-right">{tMist}</td></tr>) })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }){
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-600 mb-1">{icon}<span className="text-xs font-semibold">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
