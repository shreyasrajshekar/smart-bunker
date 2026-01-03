"use client";
import { useState } from "react";

type SubjectData = {
  name: string;
  classesPerWeek?: number;
  tcc?: number;
  tca?: number;
};

export default function Page() {
  const [timetableImage, setTimetableImage] = useState<File | null>(null);
  const [attendanceImage, setAttendanceImage] = useState<File | null>(null);
  const [examDate, setExamDate] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const subjectsList = [
    "MAT106",
    "PHY102",
    "ECE101",
    "CSE102",
    "EEE102",
    "HSS102",
    "HSS133",
  ];

  const toBase64 = (file: File) =>
    new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const callGemini = async (file: File, mode: "timetable" | "attendance") => {
    const base64 = (await toBase64(file)).split(",")[1];

    const prompt =
      mode === "timetable"
        ? `
From this timetable screenshot, extract subjects and number of classes per week.
Subjects: ${subjectsList.join(", ")}.

Important:
- Count each lecture, tutorial, lab, or remedial separately.
- Consider Labs along with the Course they belong to (e.g., "CSE102 Lab" counts towards "CSE102").
- HSS102 has 2 classes per week, HSS133 has 1 class per week.
- ignore classes that have (remedial) in their title.
- Return ONLY JSON in this exact format:
{
  "subjects": [
    { "name": string, "classesPerWeek": number }
  ]
}`
        : `
From this attendance screenshot, extract TCC and TCA per subject.
Subjects: ${subjectsList.join(", ")}.
Return ONLY JSON in this exact format:
{
  "subjects": [
    { "name": string, "tcc": number, "tca": number }
  ]
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: file.type, data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) throw new Error("Gemini API failed");

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(text).subjects;
    } catch (e) {
      console.error("Failed to parse Gemini output:", text);
      throw new Error("Gemini output invalid JSON");
    }
  };

  const handleAnalyze = async () => {
    if (!timetableImage || !attendanceImage || !examDate) {
      alert("Upload both images and select exam date");
      return;
    }
    setLoading(true);
    try {
      const timetable = await callGemini(timetableImage, "timetable");
      const attendance = await callGemini(attendanceImage, "attendance");

      const weeksLeft = Math.max(
        0,
        Math.ceil(
          (new Date(examDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      );

      const subjectResults = timetable.map((sub: any) => {
        const att = attendance.find((a: any) => a.name === sub.name);
        if (!att) return { subject: sub.name, bunkable: 0 };

        const futureClasses = sub.classesPerWeek * weeksLeft;
        const totalAfter = att.tcc + futureClasses;
        const minRequired = Math.ceil(0.85 * totalAfter);
        const bunkable = Math.max(0, futureClasses - (minRequired - att.tca));
        const projectedAttendance = (
          ((att.tca + (futureClasses - bunkable)) / totalAfter) *
          100
        ).toFixed(2);

        return {
          subject: sub.name,
          classesPerWeek: sub.classesPerWeek,
          weeksLeft,
          futureClasses,
          tcc: att.tcc,
          tca: att.tca,
          minRequired,
          bunkable,
          projectedAttendance,
        };
      });

      setResults(subjectResults);
    } catch (e: any) {
      console.error(e);
      alert("Analysis failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
  style={{
    padding: "40px 16px",
    maxWidth: 950,
    margin: "auto",
    fontFamily: "'Space Grotesk', 'Inter', sans-serif", // A very "human/edgy" font
    background: "#FFFBF2", // Warm paper-like background
    minHeight: "100vh",
    color: "#1A1A1A",
  }}
>
  {/* STICKER-STYLE HEADER */}
  <header style={{ textAlign: "center", marginBottom: 50, position: "relative" }}>
    <div style={{
      display: 'inline-block',
      padding: '4px 12px',
      background: '#FFD600',
      border: '3px solid #1A1A1A',
      transform: 'rotate(-2deg) translateY(10px)',
      fontWeight: 900,
      fontSize: 14,
      boxShadow: '4px 4px 0px #1A1A1A',
      zIndex: 2,
      position: 'relative'
    }}>
      THE ULTIMATE HACK
    </div>
    <h1
      style={{
        fontSize: "clamp(2.2rem, 10vw, 4.5rem)",
        fontWeight: 900,
        margin: "0 auto",
        lineHeight: 0.9,
        textTransform: "uppercase",
        letterSpacing: "-2px",
        color: "#1A1A1A",
      }}
    >
      Smart <br /> 
      <span style={{ color: '#6366f1', textDecoration: 'underline wavy #FF6B6B' }}>Bunker</span>
    </h1>
    <p style={{ 
      marginTop: 20, 
      fontSize: 18, 
      fontWeight: 500, 
      fontStyle: 'italic',
      color: "#4A4A4A" 
    }}>
      "Because 100% attendance is a myth."
    </p>
  </header>

  {/* ROUGH-CUT INPUT SECTION */}
  <section
    style={{
      background: "#fff",
      border: "4px solid #1A1A1A",
      boxShadow: "12px 12px 0px #1A1A1A",
      padding: "clamp(20px, 5vw, 40px)",
      borderRadius: "2px", // Sharp corners for that "manual" look
      marginBottom: 60
    }}
  >
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 30 }}>
      {[
        { label: "Timetable Pic", type: "file", setter: setTimetableImage, color: "#C3FFAD" },
        { label: "Attendance Pic", type: "file", setter: setAttendanceImage, color: "#FFADF0" },
        { label: "When do exams start?", type: "date", setter: setExamDate, color: "#ADF0FF" },
      ].map((input) => (
        <label
          key={input.label}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span style={{ background: input.color, display: 'inline-block', width: 'fit-content', padding: '0 5px' }}>
            {input.label}
          </span>
          <input
            type={input.type}
            onChange={(e) =>
              input.type === "file"
                ? input.setter(e.target.files?.[0] || null)
                : input.setter(e.target.value)
            }
            style={{
              padding: "12px",
              border: "3px solid #1A1A1A",
              borderRadius: "0px",
              background: "#fff",
              fontSize: 15,
              fontWeight: 600,
              outline: 'none',
              boxShadow: 'inset 4px 4px 0px #f0f0f0'
            }}
          />
        </label>
      ))}
    </div>

    <button
      onClick={handleAnalyze}
      disabled={loading}
      style={{
        width: "100%",
        marginTop: 40,
        padding: "20px",
        background: "#1A1A1A",
        color: "#fff",
        fontWeight: 900,
        fontSize: 20,
        border: "none",
        cursor: "pointer",
        transition: "all 0.1s",
        textTransform: "uppercase",
        letterSpacing: "1px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 15
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = "translate(4px, 4px)"}
      onMouseUp={(e) => e.currentTarget.style.transform = "translate(0, 0)"}
    >
      {loading ? "CRUNCHING DATA..." : "CAN I BUNK? →"}
    </button>
  </section>

  {/* RESULTS SECTION */}
  {results.length > 0 && (
    <div style={{ position: "relative" }}>
      <h2 style={{ 
        fontSize: "2.5rem", 
        fontWeight: 900, 
        marginBottom: 40,
        transform: 'rotate(-1deg)'
      }}>
        The Verdict:
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 40,
        }}
      >
        {results.map((r, index) => {
          const attendancePercent = Number(r.projectedAttendance);
          const isSafe = attendancePercent >= 75;
          const rotation = index % 2 === 0 ? '1deg' : '-1deg';

          return (
            <div
              key={r.subject}
              style={{
                background: "#fff",
                border: "4px solid #1A1A1A",
                padding: "25px",
                position: "relative",
                boxShadow: "8px 8px 0px #1A1A1A",
                transform: `rotate(${rotation})`,
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02) rotate(0deg)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = `rotate(${rotation})`}
            >
              {/* STATUS STICKER */}
              <div style={{
                position: 'absolute',
                top: -15,
                right: -10,
                padding: '5px 15px',
                background: isSafe ? '#C3FFAD' : '#FF6B6B',
                border: '3px solid #1A1A1A',
                fontWeight: 900,
                fontSize: 12,
                transform: 'rotate(15deg)'
              }}>
                {isSafe ? 'YOU GOOD' : 'DANGER'}
              </div>

              <h3 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 20, textTransform: 'uppercase', borderBottom: '4px solid #1A1A1A', paddingBottom: 10 }}>
                {r.subject}
              </h3>

              <div style={{ marginBottom: 25 }}>
                <div style={{ fontWeight: 800, marginBottom: 5 }}>PROJECTION: {attendancePercent}%</div>
                <div style={{ height: 25, border: '3px solid #1A1A1A', background: '#f0f0f0', position: 'relative' }}>
                  <div style={{ 
                    width: `${attendancePercent}%`, 
                    height: '100%', 
                    background: isSafe ? '#C3FFAD' : '#FF6B6B',
                    borderRight: '3px solid #1A1A1A'
                  }} />
                  <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: 2, background: '#1A1A1A', borderLeft: '1px dashed #fff' }} />
                </div>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8 }}>
                <div>• Class / Week: {r.classesPerWeek}</div>
                <div>• Weeks Left: {r.weeksLeft}</div>
                <div>• Attended: {r.tca} / {r.tcc}</div>
              </div>

              <div style={{ 
                marginTop: 25, 
                padding: '15px', 
                background: isSafe ? '#6366f1' : '#1A1A1A', 
                color: '#fff',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 400, textTransform: 'uppercase' }}>Classes you can skip:</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 900 }}>{r.bunkable}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )}
</main>



  );
}
