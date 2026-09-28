'use client';

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import BANCO from "./preguntas.json";
import BANCO_LAB from "./preguntas_laboratorio.json";
import BANCO_SANITARIO from "./preguntas_sanitario.json";

// ====== BANCOS DE PREGUNTAS ======
// Acepta tanto array pelado [...] como objeto { "preguntas": [...] }
function normalizarBanco(b) {
  if (Array.isArray(b)) return b;
  if (Array.isArray(b?.preguntas)) return b.preguntas;
  return [];
}

// ====== OPOSICIONES DISPONIBLES ======
const OPOSICIONES = {
  dpz: {
    id: "dpz",
    nombre: "Diputación Provincial de Zaragoza",
    nombreCorto: "DPZ · Administrativo/a",
    color: "#2D6A4F", // verde Diputación Provincial de Zaragoza
    preguntas: normalizarBanco(BANCO),
  },
  laboratorio: {
    id: "laboratorio",
    nombre: "Ayto. Zaragoza · Téc. Aux. Laboratorio",
    nombreCorto: "Ayto. Zaragoza · Laboratorio",
    color: "#0057A8", // azul Ayuntamiento de Zaragoza
    preguntas: normalizarBanco(BANCO_LAB),
  },
};

const CANTIDADES = [5, 10, 20, 50, 100];

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("tests");
  const [step, setStep] = useState("config"); // config | test | resultado

  // ---- Oposición seleccionada ----
  const [oposicionId, setOposicionId] = useState("dpz"); // dpz | laboratorio
  const oposicion = OPOSICIONES[oposicionId] || OPOSICIONES.dpz;
  const PREGUNTAS = oposicion.preguntas;
  const ACCENT = oposicion.color;

  // ---- Filtros del test ----
  const [bloque, setBloque] = useState("todos");   // todos | comun | especifica
  const [ambito, setAmbito] = useState("todos");   // todos | estatal | aragon
  const [tema, setTema] = useState("todos");        // todos | <número>
  const [cantidad, setCantidad] = useState(20);
  const [penalizacion, setPenalizacion] = useState(true);

  // ---- Estado del test en curso ----
  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [revisando, setRevisando] = useState(false);
  const [testLabel, setTestLabel] = useState("");
  const [testPenalizada, setTestPenalizada] = useState(true);

  // ---- Historial (persistente en el navegador) ----
  const [history, setHistory] = useState([]);
  useEffect(() => {
    try { const raw = localStorage.getItem("oposiciones_history"); if (raw) setHistory(JSON.parse(raw)); } catch (e) {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("oposiciones_history", JSON.stringify(history)); } catch (e) {}
  }, [history]);

  const ac = activeTab === "historial" ? "#1a1a1a" : ACCENT;

  // ---- Cálculo de pools según filtros ----
  const poolBase = PREGUNTAS.filter(p =>
    (bloque === "todos" || p.bloque === bloque) &&
    (ambito === "todos" || p.ambito === ambito)
  );
  const temasDisponibles = [...new Map(poolBase.map(p => [p.tema, p.tema_nombre])).entries()]
    .sort((a, b) => a[0] - b[0]);
  const pool = poolBase.filter(p => tema === "todos" || p.tema === Number(tema));
  const disponibles = pool.length;
  const cantidadReal = Math.min(cantidad, disponibles);

  function addHistory(entry) { setHistory(prev => [entry, ...prev].slice(0, 100)); }

  function cambiarOposicion(nuevaId) {
    if (nuevaId === oposicionId) return;
    setOposicionId(nuevaId);
    // Los temas y bloques difieren entre oposiciones: reseteamos filtros
    setBloque("todos");
    setAmbito("todos");
    setTema("todos");
    setStep("config");
    resetTest();
  }

  function construirLabel() {
    if (tema !== "todos") {
      const nombre = (temasDisponibles.find(t => t[0] === Number(tema)) || [])[1] || "";
      return `Tema ${tema} · ${nombre}`;
    }
    if (bloque === "todos" && ambito === "todos") return "Examen general";
    const partes = [];
    if (bloque === "comun") partes.push("Comunes");
    else if (bloque === "especifica") partes.push("Específicas");
    else partes.push("Todos los bloques");
    if (ambito === "estatal") partes.push("Estatal");
    else if (ambito === "aragon") partes.push("Aragón");
    return partes.join(" · ");
  }

  function comenzarTest() {
    if (disponibles === 0) return;
    setPreguntas(shuffle(pool).slice(0, cantidadReal));
    setRespuestas({});
    setRevisando(false);
    setTestLabel(construirLabel());
    setTestPenalizada(penalizacion);
    setStep("test");
  }

  function seleccionar(idx, op) {
    if (revisando) return;
    setRespuestas(prev => ({ ...prev, [idx]: op }));
  }

  const aciertos = () => preguntas.reduce((a, p, i) => a + (respuestas[i] === p.correcta ? 1 : 0), 0);

  function calcularNota(penaliza) {
    const n = preguntas.length;
    if (!n) return 0;
    const ac_ = aciertos();
    const err = n - ac_; // en la app se responden todas antes de corregir
    const bruta = (ac_ / n) * 10;
    const pen = Math.max(0, (ac_ - err / 3) / n * 10);
    return penaliza ? pen : bruta;
  }

  function finalizarTest() {
    const notaFinal = parseFloat(calcularNota(testPenalizada).toFixed(1));
    addHistory({
      id: Date.now(),
      timestamp: Date.now(),
      temaLabel: testLabel,
      entidadNombre: oposicion.nombre,
      oposicionId: oposicionId,
      aciertos: aciertos(),
      total: preguntas.length,
      nota: notaFinal,
      penalizada: testPenalizada,
    });
    setRevisando(true);
    setStep("resultado");
  }

  function getEstado(pi, oi) {
    if (!revisando) return respuestas[pi] === oi ? "sel" : "none";
    if (oi === preguntas[pi].correcta) return "ok";
    if (respuestas[pi] === oi) return "err";
    return "none";
  }

  // ---- Estadísticas de historial ----
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
  const respTotal = Object.keys(respuestas).length;

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
    label: { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: 4, fontFamily: "monospace" },
    secTitle: { fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555", margin: "22px 0 10px", fontFamily: "monospace" },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
    chip: (sel, color, dis) => ({ background: sel ? color : "#fff", border: `2px solid ${sel ? color : "#ddd"}`, borderRadius: 6, padding: "9px 16px", cursor: dis ? "not-allowed" : "pointer", fontSize: 14, color: dis ? "#ccc" : (sel ? "#fff" : "#1a1a1a"), fontFamily: "Georgia", opacity: dis ? 0.5 : 1 }),
    select: { width: "100%", padding: "11px 13px", border: "1.5px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "Georgia", outline: "none", boxSizing: "border-box", background: "#fafafa", cursor: "pointer" },
    countBox: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "14px 18px", margin: "22px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
    btn: (color, dis) => ({ background: dis ? "#ccc" : color, color: "#fff", border: "none", borderRadius: 6, padding: "12px 26px", fontSize: 13, letterSpacing: "0.07em", textTransform: "uppercase", cursor: dis ? "not-allowed" : "pointer", fontFamily: "Georgia" }),
    btnSec: { background: "transparent", color: "#666", border: "2px solid #ddd", borderRadius: 6, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "Georgia" },
    check: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "#333", userSelect: "none" },
    pCard: (ok) => ({ background: "#fff", border: `1px solid #e0e0e0`, borderLeft: revisando ? `4px solid ${ok ? "#28a745" : "#dc3545"}` : "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 }),
    pNum: { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: 8, fontFamily: "monospace" },
    pText: { fontSize: 15, lineHeight: 1.6, marginBottom: 16 },
    op: (est) => {
      const b = { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 6, border: "1.5px solid #e0e0e0", marginBottom: 6, cursor: revisando ? "default" : "pointer", fontSize: 14, lineHeight: 1.5, background: "#fff", color: "#1a1a1a" };
      if (est === "ok") return { ...b, background: "#d4edda", borderColor: "#28a745", color: "#155724" };
      if (est === "err") return { ...b, background: "#f8d7da", borderColor: "#dc3545", color: "#721c24" };
      if (est === "sel") return { ...b, background: ac + "18", borderColor: ac };
      return b;
    },
    expl: { marginTop: 10, padding: "10px 12px", background: "#f0f7f0", borderLeft: "3px solid #28a745", borderRadius: "0 4px 4px 0", fontSize: 13, color: "#2d5a3d", lineHeight: 1.5 },
    resBox: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 24 },
    bigNote: (color) => ({ fontSize: 64, fontWeight: "normal", color, lineHeight: 1, marginBottom: 8 }),
    statCard: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 14 },
    histRow: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 },
    bar: (pct) => ({ height: 8, width: `${pct}%`, background: pct >= 50 ? "#28a745" : "#dc3545", borderRadius: 4 }),
  };

  function PreguntasList() {
    return preguntas.map((p, i) => {
      const ok = respuestas[i] === p.correcta;
      return (
        <div key={i} style={S.pCard(ok)}>
          <div style={S.pNum}>
            Pregunta {i + 1} de {preguntas.length}
            {p.tema ? ` · Tema ${p.tema}` : ""}
            {revisando && (ok ? " · ✓ Correcta" : " · ✗ Incorrecta")}
          </div>
          <p style={S.pText}>{p.pregunta}</p>
          {p.opciones.map((op, j) => (
            <div key={j} style={S.op(getEstado(i, j))} onClick={() => seleccionar(i, j)}>
              <span style={{ fontWeight: "bold", flexShrink: 0 }}>{["A", "B", "C", "D"][j]})</span>
              <span>{String(op).replace(/^[ABCD]\)\s*/, "")}</span>
            </div>
          ))}
          {revisando && <div style={S.expl}><strong>Explicación:</strong> {p.explicacion}</div>}
        </div>
      );
    });
  }

  function ResHeader() {
    const n = calcularNota(testPenalizada).toFixed(1);
    const ap = parseFloat(n) >= 5;
    return (
      <div style={S.resBox}>
        <div style={S.label}>Resultado{testPenalizada ? " · con penalización" : ""}</div>
        <div style={S.bigNote(ap ? "#28a745" : "#dc3545")}>{n}</div>
        <p style={{ fontSize: 16, color: "#666", marginBottom: 6 }}>{aciertos()} de {preguntas.length} correctas</p>
        <p style={{ fontSize: 13, color: "#999" }}>{ap ? "✓ Aprobado · Guardado en historial" : "✗ Suspenso · Guardado en historial"}</p>
        {testPenalizada && <p style={{ fontSize: 11, color: "#bbb", fontFamily: "monospace", marginTop: 8 }}>Fórmula: aciertos − (errores ÷ 3), como el examen real</p>}
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={S.header}>
        <div style={S.shield}>⚖</div>
        <div>
          <p style={S.hTitle}>Preparador de Oposiciones · Aragón</p>
          <p style={S.hSub}>
            {activeTab === "historial"
              ? `${history.length} test realizados`
              : `${oposicion.nombreCorto} · ${PREGUNTAS.length} preguntas`}
          </p>
        </div>
      </div>

      <div style={S.tabBar}>
        <div style={S.tabWrap}>
          <button style={S.tab(activeTab === "tests", ACCENT)} onClick={() => { setActiveTab("tests"); setStep("config"); resetTest(); }}>📝 Tests</button>
          <button style={S.tab(activeTab === "historial", "#1a1a1a")} onClick={() => { setActiveTab("historial"); }}>
            📊 Historial{history.length > 0 && <span style={{ background: "#555", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 5 }}>{history.length}</span>}
          </button>
        </div>
      </div>

      <div style={S.main}>
        {activeTab === "tests" && <>
          {step === "config" && <>
            <h1 style={S.title}>Configura tu test</h1>
            <p style={S.sub}>Elige la oposición y ajusta los filtros. Deja todo en “Todos” para un examen general, o filtra para machacar un tema concreto.</p>

            <div style={S.secTitle}>Oposición</div>
            <select style={S.select} value={oposicionId} onChange={e => cambiarOposicion(e.target.value)}>
              {Object.values(OPOSICIONES).map(o => (
                <option key={o.id} value={o.id}>{o.nombre} ({o.preguntas.length} preguntas)</option>
              ))}
            </select>

            <div style={S.secTitle}>Bloque</div>
            <div style={S.chipRow}>
              {[["todos", "Todos"], ["comun", "Comunes"], ["especifica", "Específicas"]].map(([v, l]) => (
                <button key={v} style={S.chip(bloque === v, ACCENT)} onClick={() => { setBloque(v); setTema("todos"); }}>{l}</button>
              ))}
            </div>

            <div style={S.secTitle}>Ámbito</div>
            <div style={S.chipRow}>
              {[["todos", "Todos"], ["estatal", "Estatal"], ["aragon", "Solo Aragón"]].map(([v, l]) => (
                <button key={v} style={S.chip(ambito === v, ACCENT)} onClick={() => { setAmbito(v); setTema("todos"); }}>{l}</button>
              ))}
            </div>

            <div style={S.secTitle}>Tema</div>
            <select style={S.select} value={tema} onChange={e => setTema(e.target.value)}>
              <option value="todos">Todos los temas ({poolBase.length} preguntas)</option>
              {temasDisponibles.map(([num, nombre]) => (
                <option key={num} value={num}>Tema {num} · {nombre}</option>
              ))}
            </select>

            <div style={S.secTitle}>Número de preguntas</div>
            <div style={S.chipRow}>
              {CANTIDADES.map(c => (
                <button key={c} disabled={c > disponibles && disponibles > 0}
                  style={S.chip(cantidad === c, ACCENT, c > disponibles && disponibles > 0)}
                  onClick={() => setCantidad(c)}>{c}</button>
              ))}
            </div>

            <label style={{ ...S.check, marginTop: 22 }}>
              <input type="checkbox" checked={penalizacion} onChange={e => setPenalizacion(e.target.checked)} style={{ width: 17, height: 17 }} />
              Aplicar penalización por error (como el examen real: cada 3 fallos restan 1 acierto)
            </label>

            <div style={S.countBox}>
              <div>
                <div style={S.label}>Preguntas disponibles con estos filtros</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: disponibles ? ACCENT : "#dc3545" }}>{disponibles}</div>
              </div>
              <button style={S.btn(ACCENT, disponibles === 0)} disabled={disponibles === 0} onClick={comenzarTest}>
                Comenzar test →
              </button>
            </div>
            {disponibles > 0 && cantidad > disponibles &&
              <p style={{ fontSize: 12, color: "#999" }}>Con estos filtros solo hay {disponibles} preguntas: el test tendrá {cantidadReal}.</p>}
            {disponibles === 0 && <p style={{ fontSize: 13, color: "#dc3545" }}>No hay preguntas con esa combinación de filtros. Prueba a ampliar la selección.</p>}
          </>}

          {step === "test" && preguntas.length > 0 && <>
            <h1 style={S.title}>Test de examen</h1>
            <p style={S.sub}>{preguntas.length} preguntas · {testLabel}{testPenalizada ? " · con penalización" : ""}</p>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => { setStep("config"); resetTest(); }}>← Cambiar filtros</button>
              <button style={S.btn(ACCENT, respTotal < preguntas.length)} disabled={respTotal < preguntas.length}
                onClick={finalizarTest}>Corregir y guardar →</button>
              {respTotal < preguntas.length && <span style={{ fontSize: 12, color: "#999", alignSelf: "center" }}>Responde todas ({respTotal}/{preguntas.length})</span>}
            </div>
          </>}

          {step === "resultado" && <>
            <ResHeader />
            <h2 style={{ ...S.title, fontSize: 18, marginBottom: 14 }}>Revisión de respuestas</h2>
            <PreguntasList />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <button style={S.btn(ACCENT, false)} onClick={() => { setStep("config"); resetTest(); }}>Nuevo test →</button>
              <button style={S.btnSec} onClick={() => { setActiveTab("historial"); }}>Ver historial</button>
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
                    <div style={{ ...S.label, marginBottom: 14 }}>Rendimiento por tipo de test</div>
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
                      <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{formatDate(h.timestamp)}{h.penalizada ? " · penalización" : ""}</div>
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

  function resetTest() { setPreguntas([]); setRespuestas({}); setRevisando(false); }
}
