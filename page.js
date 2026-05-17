'use client';

import { useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ENTIDADES = {
  DGA: {
    nombre: "Diputación General de Aragón", siglas: "DGA", color: "#C8102E",
    temas: [
      { id: "constitucion", label: "Constitución Española (1978)" },
      { id: "estatuto", label: "Estatuto de Autonomía de Aragón" },
      { id: "ley39", label: "Ley 39/2015 · Procedimiento Administrativo" },
      { id: "ley40", label: "Ley 40/2015 · Régimen Jurídico del Sector Público" },
      { id: "igualdad", label: "Ley Orgánica 3/2007 · Igualdad" },
      { id: "transparencia", label: "Ley 19/2013 · Transparencia" },
    ],
  },
  AYZ: {
    nombre: "Ayuntamiento de Zaragoza", siglas: "AYZ", color: "#0057A8",
    temas: [
      { id: "constitucion", label: "Constitución Española (1978)" },
      { id: "estatuto", label: "Estatuto de Autonomía de Aragón" },
      { id: "ley7", label: "Ley 7/1985 · Bases de Régimen Local" },
      { id: "ley39", label: "Ley 39/2015 · Procedimiento Administrativo" },
      { id: "ley40", label: "Ley 40/2015 · Régimen Jurídico del Sector Público" },
      { id: "igualdad", label: "Ley Orgánica 3/2007 · Igualdad" },
    ],
  },
  DPZ: {
    nombre: "Diputación Provincial de Zaragoza", siglas: "DPZ", color: "#2D6A4F",
    temas: [
      { id: "constitucion", label: "Constitución Española (1978)" },
      { id: "estatuto", label: "Estatuto de Autonomía de Aragón" },
      { id: "ley7", label: "Ley 7/1985 · Bases de Régimen Local" },
      { id: "ley39", label: "Ley 39/2015 · Procedimiento Administrativo" },
      { id: "ley40", label: "Ley 40/2015 · Régimen Jurídico del Sector Público" },
      { id: "transparencia", label: "Ley 19/2013 · Transparencia" },
    ],
  },
};

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

async function generarPreguntas(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.content[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON válido");

  return JSON.parse(jsonMatch[0]);
}

export default function App() {
  const [activeTab, setActiveTab] = useState("comun");
  const [step, setStep] = useState("selector");
  const [entidadKey, setEntidadKey] = useState(null);
  const [temaId, setTemaId] = useState(null);

  const [convStep, setConvStep] = useState("input");
  const [convUrl, setConvUrl] = useState("");
  const [convText, setConvText] = useState("");
  const [convPdfB64, setConvPdfB64] = useState(null);
  const [convFileName, setConvFileName] = useState("");
  const [convTitulo, setConvTitulo] = useState("");
  const [convTemas, setConvTemas] = useState([]);
  const fileRef = useRef(null);

  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [revisando, setRevisando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const entidad = entidadKey ? ENTIDADES[entidadKey] : null;
  const tabColors = { comun: entidad?.color || "#C8102E", convocatoria: "#6B4C9A", historial: "#1a1a1a" };
  const ac = tabColors[activeTab];

  function addHistory(entry) {
    setHistory(prev => [entry, ...prev].slice(0, 50));
  }

  function resetTest() {
    setPreguntas([]);
    setRespuestas({});
    setRevisando(false);
    setError(null);
  }

  function resetAll() {
    resetTest();
    setStep("selector");
    setTemaId(null);
    setEntidadKey(null);
    setConvStep("input");
    setConvUrl("");
    setConvText("");
    setConvPdfB64(null);
    setConvFileName("");
    setConvTitulo("");
    setConvTemas([]);
  }

  async function generarTestComun() {
    setLoading(true);
    setError(null);
    resetTest();

    try {
      const e = ENTIDADES[entidadKey];
      const t = e.temas.find(x => x.id === temaId);

      const system = `Eres un experto en oposiciones de Administración Pública en Aragón.
Genera 5 preguntas tipo test de examen, con 4 opciones cada una (A, B, C, D).
Solo una opción debe ser correcta.
Incluye una breve explicación de por qué es correcta.
Responde SOLO con JSON válido sin texto adicional.`;

      const prompt = `Genera 5 preguntas de examen sobre: ${t.label}
Entidad: ${e.nombre}
Nivel: Auxiliar Administrativo
Responde en este formato JSON:
{
  "preguntas": [
    {
      "pregunta": "...",
      "opciones": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correcta": 0,
      "explicacion": "..."
    }
  ]
}`;

      const resultado = await generarPreguntas(system, [{ role: "user", content: prompt }]);
      setPreguntas(resultado.preguntas || []);
      setStep("test");
    } catch (err) {
      setError("Error: " + err.message);
    }

    setLoading(false);
  }

  async function generarTestConv() {
    setLoading(true);
    setError(null);
    resetTest();

    try {
      const system = `Eres un experto en oposiciones de Administración Pública en Aragón.
Analiza el temario de la convocatoria proporcionada.
Genera 5 preguntas tipo test basadas en ese temario.
4 opciones por pregunta, solo una correcta.
Responde SOLO con JSON válido sin texto adicional.`;

      let messages;

      if (convText.trim()) {
        messages = [{
          role: "user",
          content: `Analiza esta convocatoria y genera 5 preguntas tipo test.
Responde SOLO en este formato JSON:
{
  "titulo_convocatoria": "...",
  "temas_detectados": ["tema1", "tema2"],
  "preguntas": [{"pregunta": "...","opciones": ["A) ...","B) ...","C) ...","D) ..."],"correcta": 0,"explicacion": "..."}]
}

CONVOCATORIA:
${convText}`
        }];
      } else if (convPdfB64) {
        messages = [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: convPdfB64 } },
            { type: "text", text: `Analiza esta convocatoria y genera 5 preguntas tipo test basadas en su temario.` }
          ]
        }];
      } else {
        messages = [{
          role: "user",
          content: `Analiza la convocatoria en: ${convUrl}\nGenera 5 preguntas tipo test basadas en su temario.`
        }];
      }

      const resultado = await generarPreguntas(system, messages);
      setPreguntas(resultado.preguntas || []);
      setConvTitulo(resultado.titulo_convocatoria || "Convocatoria específica");
      setConvTemas(resultado.temas_detectados || []);
      setConvStep("test");
    } catch (err) {
      setError("Error: " + err.message);
    }

    setLoading(false);
  }

  function seleccionar(idx, op) {
    if (revisando) return;
    setRespuestas(prev => ({ ...prev, [idx]: op }));
  }

  const aciertos = () => preguntas.reduce((a, p, i) => a + (respuestas[i] === p.correcta ? 1 : 0), 0);
  const nota = () => preguntas.length ? ((aciertos() / preguntas.length) * 10).toFixed(1) : "0.0";

  function finalizarTest(tipo) {
    const temaLabel = tipo === "conv"
      ? convTitulo
      : entidad?.temas.find(t => t.id === temaId)?.label || temaId;

    addHistory({
      id: Date.now(),
      timestamp: Date.now(),
      tipo,
      entidadNombre: tipo === "conv" ? "Convocatoria" : entidad?.nombre,
      temaLabel,
      aciertos: aciertos(),
      total: preguntas.length,
      nota: parseFloat(nota()),
    });

    setRevisando(true);
    if (tipo === "conv") setConvStep("resultado");
    else setStep("resultado");
  }

  function getEstado(pi, oi) {
    if (!revisando) return respuestas[pi] === oi ? "sel" : "none";
    if (oi === preguntas[pi].correcta) return "ok";
    if (respuestas[pi] === oi) return "err";
    return "none";
  }

  const byTema = {};
  history.forEach(h => {
    if (!byTema[h.temaLabel]) byTema[h.temaLabel] = { ok: 0, total: 0, count: 0 };
    byTema[h.temaLabel].ok += h.aciertos;
    byTema[h.temaLabel].total += h.total;
    byTema[h.temaLabel].count++;
  });
  const temaStats = Object.entries(byTema)
    .map(([label, v]) => ({ label, pct: Math.round((v.ok / v.total) * 100), count: v.count }))
    .sort((a, b) => a.pct - b.pct);
  const chartData = [...history].reverse().map((h, i) => ({ n: i + 1, nota: h.nota }));
  const avgNota = history.length ? (history.reduce((a, h) => a + h.nota, 0) / history.length).toFixed(1) : "—";

  const S = {
    app: { minHeight: "100vh", background: "#F5F4F0", fontFamily: "'Georgia','Times New Roman',serif", color: "#1a1a1a" },
    header: { background: "#1a1a1a", padding: "16px 24px", display: "flex", alignItems: "center", gap: "12px", borderBottom: `4px solid ${ac}` },
    shield: { width: 36, height: 36, background: ac, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, flexShrink: 0 },
    hTitle: { color: "#fff", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "Georgia", fontWeight: "normal", margin: 0 },
    hSub: { color: "#888", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, fontFamily: "monospace" },
    tabBar: { background: "#fff", borderBottom: "2px solid #e0e0e0" },
    tabWrap: { maxWidth: 720, margin: "0 auto", display: "flex" },
    tab: (active, color) => ({ padding: "13px 16px", fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer", border: "none", background: "transparent", fontFamily: "Georgia", color: active ? color : "#888", borderBottom: active ? `3px solid ${color}` : "3px solid transparent", marginBottom: -2, fontWeight: active ? "bold" : "normal" }),
    main: { maxWidth: 720, margin: "0 auto", padding: "28px 20px" },
    title: { fontSize: 24, fontWeight: "normal", marginBottom: 8, lineHeight: 1.2 },
    sub: { fontSize: 14, color: "#666", marginBottom: 24 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 24 },
    card: (sel, color) => ({ background: sel ? color : "#fff", border: `2px solid ${sel ? color : "#ddd"}`, borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center" }),
    cTitle: (sel) => ({ fontSize: 14, fontWeight: "bold", color: sel ? "#fff" : "#1a1a1a", marginBottom: 4 }),
    cSub: (sel) => ({ fontSize: 12, color: sel ? "rgba(255,255,255,0.8)" : "#888", lineHeight: 1.4 }),
    tList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 },
    tBtn: (sel, color) => ({ background: sel ? color : "#fff", border: `2px solid ${sel ? color : "#ddd"}`, borderRadius: 6, padding: "12px 14px", cursor: "pointer", textAlign: "left", fontSize: 14, color: sel ? "#fff" : "#1a1a1a", fontFamily: "Georgia" }),
    btn: (color, dis) => ({ background: dis ? "#ccc" : color, color: "#fff", border: "none", borderRadius: 6, padding: "12px 26px", fontSize: 13, letterSpacing: "0.07em", textTransform: "uppercase", cursor: dis ? "not-allowed" : "pointer", fontFamily: "Georgia" }),
    btnSec: { background: "transparent", color: "#666", border: "2px solid #ddd", borderRadius: 6, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "Georgia" },
    pCard: (ok) => ({ background: "#fff", border: `1px solid #e0e0e0`, borderLeft: revisando ? `4px solid ${ok ? "#28a745" : "#dc3545"}` : "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 }),
    pNum: { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: 8, fontFamily: "monospace" },
    pText: { fontSize: 15, lineHeight: 1.6, marginBottom: 16 },
    op: (est, color) => {
      const b = { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 6, border: "1.5px solid #e0e0e0", marginBottom: 6, cursor: "pointer", fontSize: 14, lineHeight: 1.5, background: "#fff", color: "#1a1a1a" };
      if (est === "ok") return { ...b, background: "#d4edda", borderColor: "#28a745", color: "#155724" };
      if (est === "err") return { ...b, background: "#f8d7da", borderColor: "#dc3545", color: "#721c24" };
      if (est === "sel") return { ...b, background: ac + "18", borderColor: ac };
      return b;
    },
    expl: { marginTop: 10, padding: "10px 12px", background: "#f0f7f0", borderLeft: "3px solid #28a745", borderRadius: "0 4px 4px 0", fontSize: 13, color: "#2d5a3d", lineHeight: 1.5 },
    resBox: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 24 },
    bigNote: (color) => ({ fontSize: 64, fontWeight: "normal", color, lineHeight: 1, marginBottom: 8 }),
    spin: { width: 36, height: 36, border: `3px solid #e0e0e0`, borderTop: `3px solid ${ac}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" },
    bc: { display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 11, color: "#999", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" },
    bcA: { color: ac, fontWeight: "bold" },
    input: { width: "100%", padding: "11px 13px", border: "1.5px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "Georgia", outline: "none", boxSizing: "border-box", background: "#fafafa" },
    textarea: { width: "100%", padding: "11px 13px", border: "1.5px solid #ddd", borderRadius: 6, fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box", background: "#fafafa", minHeight: 120, resize: "vertical" },
    divRow: { display: "flex", alignItems: "center", gap: 12, margin: "14px 0", color: "#bbb", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" },
    divLine: { flex: 1, height: 1, background: "#e0e0e0" },
    upload: (has) => ({ border: `2px dashed ${has ? ac : "#ddd"}`, borderRadius: 8, padding: 22, textAlign: "center", cursor: "pointer", background: has ? ac + "08" : "#fafafa" }),
    statCard: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 },
    label: { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: 4, fontFamily: "monospace" },
    histRow: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 },
    bar: (pct) => ({ height: 8, width: `${pct}%`, background: pct >= 50 ? "#28a745" : "#dc3545", borderRadius: 4 }),
    tagWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
    tag: { background: ac + "18", color: ac, borderRadius: 4, padding: "3px 9px", fontSize: 12, fontFamily: "monospace" },
  };

  function PreguntasList() {
    return preguntas.map((p, i) => {
      const ok = respuestas[i] === p.correcta;
      return (
        <div key={i} style={S.pCard(ok)}>
          <div style={S.pNum}>
            Pregunta {i + 1} de {preguntas.length}
            {revisando && (ok ? " · ✓ Correcta" : " · ✗ Incorrecta")}
          </div>
          <p style={S.pText}>{p.pregunta}</p>
          {p.opciones.map((op, j) => (
            <div key={j} style={S.op(getEstado(i, j), ac)} onClick={() => seleccionar(i, j)}>
              <span style={{ fontWeight: "bold", flexShrink: 0 }}>{["A", "B", "C", "D"][j]})</span>
              <span>{op.replace(/^[ABCD]\)\s*/, "")}</span>
            </div>
          ))}
          {revisando && <div style={S.expl}><strong>Explicación:</strong> {p.explicacion}</div>}
        </div>
      );
    });
  }

  function ResHeader() {
    const n = nota();
    const ap = parseFloat(n) >= 5;
    return (
      <div style={S.resBox}>
        <div style={S.label}>Resultado</div>
        <div style={S.bigNote(ap ? "#28a745" : "#dc3545")}>{n}</div>
        <p style={{ fontSize: 16, color: "#666", marginBottom: 6 }}>{aciertos()} de {preguntas.length} correctas</p>
        <p style={{ fontSize: 13, color: "#999" }}>{ap ? "✓ Aprobado · Guardado en historial" : "✗ Suspenso · Guardado en historial"}</p>
      </div>
    );
  }

  const respTotal = Object.keys(respuestas).length;

  return (
    <div style={S.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={S.header}>
        <div style={S.shield}>⚖</div>
        <div>
          <p style={S.hTitle}>Preparador de Oposiciones · Aragón</p>
          <p style={S.hSub}>
            {activeTab === "historial" ? `${history.length} test realizados`
              : activeTab === "convocatoria" ? "Convocatoria específica"
              : entidad ? entidad.nombre : "Temario general"}
          </p>
        </div>
      </div>

      <div style={S.tabBar}>
        <div style={S.tabWrap}>
          <button style={S.tab(activeTab === "comun", tabColors.comun)} onClick={() => { setActiveTab("comun"); resetAll(); }}>📚 Temario Común</button>
          <button style={S.tab(activeTab === "convocatoria", tabColors.convocatoria)} onClick={() => { setActiveTab("convocatoria"); resetAll(); }}>📋 Convocatoria</button>
          <button style={S.tab(activeTab === "historial", tabColors.historial)} onClick={() => { setActiveTab("historial"); resetAll(); }}>
            📊 Historial{history.length > 0 && <span style={{ background: "#555", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 5 }}>{history.length}</span>}
          </button>
        </div>
      </div>

      <div style={S.main}>
        {activeTab === "comun" && <>
          {step === "selector" && <>
            <h1 style={S.title}>¿A qué entidad quieres opositar?</h1>
            <p style={S.sub}>Selecciona la administración convocante para adaptar los test a su temario.</p>
            <div style={S.grid}>
              {Object.entries(ENTIDADES).map(([key, e]) => (
                <div key={key} style={S.card(entidadKey === key, e.color)} onClick={() => setEntidadKey(key)}>
                  <div style={S.cTitle(entidadKey === key)}>{e.siglas}</div>
                  <div style={S.cSub(entidadKey === key)}>{e.nombre}</div>
                </div>
              ))}
            </div>
            <button style={S.btn(ac, !entidadKey)} disabled={!entidadKey} onClick={() => setStep("temas")}>Continuar →</button>
          </>}

          {step === "temas" && <>
            <div style={S.bc}>
              <span style={{ cursor: "pointer" }} onClick={() => { setStep("selector"); setTemaId(null); }}>Entidad</span>
              <span>›</span><span style={S.bcA}>Bloque temático</span>
            </div>
            <h1 style={S.title}>Elige el bloque temático</h1>
            <p style={S.sub}>Temario común · <strong>{entidad?.nombre}</strong></p>
            <div style={S.tList}>
              {entidad?.temas.map(t => (
                <button key={t.id} style={S.tBtn(temaId === t.id, ac)} onClick={() => setTemaId(t.id)}>{t.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => setStep("selector")}>← Volver</button>
              <button style={S.btn(ac, !temaId || loading)} disabled={!temaId || loading} onClick={generarTestComun}>
                {loading ? "Generando…" : "Generar test →"}
              </button>
            </div>
            {error && <p style={{ color: "#dc3545", marginTop: 12, fontSize: 13 }}>{error}</p>}
          </>}

          {loading && <div style={{ textAlign: "center", padding: 60 }}><div style={S.spin}/><p style={{ color: "#666", fontSize: 14 }}>Generando preguntas…</p></div>}

          {step === "test" && !loading && preguntas.length > 0 && <>
            <h1 style={S.title}>Test de examen</h1>
            <p style={S.sub}>{preguntas.length} preguntas · {entidad?.nombre}</p>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => setStep("temas")}>← Cambiar tema</button>
              <button style={S.btn(ac, respTotal < preguntas.length)} disabled={respTotal < preguntas.length}
                onClick={() => finalizarTest("comun")}>Corregir y guardar →</button>
              {respTotal < preguntas.length && <span style={{ fontSize: 12, color: "#999", alignSelf: "center" }}>Responde todas ({respTotal}/{preguntas.length})</span>}
            </div>
          </>}

          {step === "resultado" && !loading && <>
            <ResHeader />
            <h2 style={{ ...S.title, fontSize: 18, marginBottom: 14 }}>Revisión de respuestas</h2>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <button style={S.btnSec} onClick={() => setStep("selector")}>← Cambiar entidad</button>
              <button style={S.btn(ac, false)} onClick={() => { setTemaId(null); setStep("temas"); setRevisando(false); setRespuestas({}); setPreguntas([]); }}>Nuevo test →</button>
              <button style={S.btnSec} onClick={() => { resetAll(); setActiveTab("historial"); }}>Ver historial</button>
            </div>
          </>}
        </>}

        {activeTab === "convocatoria" && <>
          {convStep === "input" && <>
            <h1 style={S.title}>Convocatoria específica</h1>
            <p style={S.sub}>Elige la opción más cómoda: enlace, texto pegado o PDF.</p>
            
            <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>🔗 Opción 1: Enlace a la convocatoria</div>
              <input style={S.input} type="url" placeholder="https://www.boa.aragon.es/..."
                value={convUrl} onChange={e => { setConvUrl(e.target.value); setConvPdfB64(null); setConvFileName(""); setConvText(""); }} />
            </div>

            <div style={S.divRow}><div style={S.divLine}/><span>o bien</span><div style={S.divLine}/></div>

            <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>📝 Opción 2: Pega el texto de la convocatoria</div>
              <textarea style={S.textarea}
                placeholder="Copia y pega el temario de la convocatoria aquí..." 
                value={convText} onChange={e => { setConvText(e.target.value); setConvUrl(""); setConvPdfB64(null); setConvFileName(""); }} />
              <p style={{ fontSize: 11, color: "#999", marginTop: 6, marginBottom: 0, fontFamily: "monospace" }}>
                Útil si el enlace no funciona
              </p>
            </div>

            <div style={S.divRow}><div style={S.divLine}/><span>o bien</span><div style={S.divLine}/></div>

            <div style={S.upload(!!convPdfB64)} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { 
                const file = e.target.files?.[0];
                if (file) {
                  setConvFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = () => { setConvPdfB64(reader.result?.split(",")[1] || ""); setConvUrl(""); setConvText(""); };
                  reader.readAsDataURL(file);
                }
              }} />
              <div style={{ ...S.label, marginBottom: 10, color: "#666" }}>📄 Opción 3: Sube un PDF</div>
              {convPdfB64
                ? <><p style={{ fontSize: 14, color: ac, fontWeight: "bold", margin: 0 }}>✅ {convFileName}</p></>
                : <><p style={{ fontSize: 14, color: "#666", margin: 0 }}>Haz clic para seleccionar</p></>
              }
            </div>

            <div style={{ marginTop: 20 }}>
              <button style={S.btn(ac, (!convUrl.trim() && !convText.trim() && !convPdfB64) || loading)}
                disabled={(!convUrl.trim() && !convText.trim() && !convPdfB64) || loading} onClick={generarTestConv}>
                {loading ? "Analizando…" : "Analizar y generar test →"}
              </button>
            </div>
            {error && <p style={{ color: "#dc3545", marginTop: 12, fontSize: 13 }}>{error}</p>}
          </>}

          {loading && <div style={{ textAlign: "center", padding: 60 }}><div style={S.spin}/><p style={{ color: "#666", fontSize: 14 }}>Analizando la convocatoria…</p></div>}

          {convStep === "test" && !loading && preguntas.length > 0 && <>
            {convTemas.length > 0 && (
              <div style={{ background: ac + "0a", border: `1px solid ${ac}30`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ ...S.label, color: ac, marginBottom: 6 }}>📋 Convocatoria detectada</div>
                <p style={{ fontSize: 14, fontWeight: "bold", margin: "0 0 8px" }}>{convTitulo}</p>
                <div style={S.tagWrap}>{convTemas.map((t, i) => <span key={i} style={S.tag}>{t}</span>)}</div>
              </div>
            )}
            <h1 style={S.title}>Test de examen</h1>
            <p style={S.sub}>{preguntas.length} preguntas · {convTitulo}</p>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => { setConvStep("input"); resetTest(); }}>← Volver</button>
              <button style={S.btn(ac, respTotal < preguntas.length)} disabled={respTotal < preguntas.length}
                onClick={() => finalizarTest("conv")}>Corregir y guardar →</button>
              {respTotal < preguntas.length && <span style={{ fontSize: 12, color: "#999", alignSelf: "center" }}>Responde todas ({respTotal}/{preguntas.length})</span>}
            </div>
          </>}

          {convStep === "resultado" && !loading && <>
            <ResHeader />
            <h2 style={{ ...S.title, fontSize: 18, marginBottom: 14 }}>Revisión de respuestas</h2>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <button style={S.btnSec} onClick={() => { setConvStep("input"); resetTest(); setConvUrl(""); setConvText(""); setConvPdfB64(null); setConvFileName(""); }}>Nuevo test →</button>
              <button style={S.btnSec} onClick={() => { resetAll(); setActiveTab("historial"); }}>Ver historial</button>
            </div>
          </>}
        </>}

        {activeTab === "historial" && <>
          <h1 style={S.title}>Historial de resultados</h1>
          {!history.length
            ? <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ fontSize: 14 }}>Aún no hay tests realizados.</p>
              </div>
            : <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Tests", value: history.length },
                    { label: "Nota media", value: avgNota + "/10" },
                    { label: "Aprobados", value: history.filter(h => h.nota >= 5).length + "/" + history.length },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, textAlign: "center" }}>
                      <div style={S.label}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: "bold" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {chartData.length >= 2 && (
                  <div style={S.statCard}>
                    <div style={{ ...S.label, marginBottom: 12 }}>Evolución de notas</div>
                    <div style={{ height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="n" tick={{ fontSize: 11, fontFamily: "monospace" }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 11, fontFamily: "monospace" }} />
                          <Tooltip formatter={v => [v + "/10", "Nota"]} contentStyle={{ fontSize: 12 }} />
                          <Line type="monotone" dataKey="nota" stroke="#1a1a1a" strokeWidth={2} dot={{ fill: "#1a1a1a", r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {temaStats.length > 0 && (
                  <div style={S.statCard}>
                    <div style={{ ...S.label, marginBottom: 14 }}>Rendimiento por bloque temático</div>
                    {temaStats.map((t, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, flex: 1, marginRight: 8 }}>{t.label}</span>
                          <span style={{ fontSize: 12, fontFamily: "monospace", color: t.pct >= 50 ? "#28a745" : "#dc3545", flexShrink: 0 }}>{t.pct}%</span>
                        </div>
                        <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}><div style={S.bar(t.pct)} /></div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ ...S.label, marginBottom: 10 }}>Últimos tests</div>
                {history.map(h => (
                  <div key={h.id} style={S.histRow}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: h.nota >= 5 ? "#d4edda" : "#f8d7da", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {h.nota >= 5 ? "✓" : "✗"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.temaLabel}</div>
                      <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{h.entidadNombre} · {formatDate(h.timestamp)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: h.nota >= 5 ? "#28a745" : "#dc3545" }}>{h.nota}</div>
                      <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{h.aciertos}/{h.total}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button style={{ ...S.btnSec, color: "#dc3545", borderColor: "#dc3545", fontSize: 12 }}
                    onClick={() => { if (window.confirm("¿Borrar todo el historial?")) setHistory([]); }}>
                    🗑 Borrar historial
                  </button>
                </div>
              </>
          }
        </>}
      </div>
    </div>
  );
}
