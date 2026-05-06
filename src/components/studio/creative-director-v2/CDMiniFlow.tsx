"use client";

/**
 * CDMiniFlow — cinematic scene-based onboarding diagram.
 *
 * Layout philosophy:
 *   Center = the scene (a cinematic viewport, NOT a card — no border, no radius).
 *   Nodes  = lightweight floating control modules around the scene.
 *   Lines  = barely visible bezier guides (stroke 0.12 opacity).
 *   Motion = organic, overlapping timings — nothing steps cleanly.
 *
 * Animation plays once on mount and holds final state.
 * No external dependencies — CSS keyframes only, transform + opacity throughout.
 */

// ─── Geometry (single source of truth for both DOM layout and SVG paths) ──────

const CW = 640;  // container width  (px)
const CH = 300;  // container height (px)

// Cinematic scene viewport dimensions
const SCENE_W = 284;
const SCENE_H = 204;
const SCENE_X = Math.round((CW - SCENE_W) / 2);  // 178
const SCENE_Y = Math.round((CH - SCENE_H) / 2);  // 48

// Floating node module dimensions
const NODE_W = 114;
const NODE_H = 42;

// Node positions
const L_TOP_Y = SCENE_Y + 10;                        // 58  — Subject
const L_BOT_Y = SCENE_Y + SCENE_H - NODE_H - 10;    // 200 — World
const R_TOP_Y = L_TOP_Y;                             // 58  — Lighting
const R_BOT_Y = L_BOT_Y;                             // 200 — Objects

const L_NODE_X  = 0;                // left column
const R_NODE_X  = CW - NODE_W;     // 526 — right column

// SVG coordinate: right edge of left nodes, left edge of right nodes
const L_EDGE = NODE_W;              // 114
const R_EDGE = R_NODE_X;            // 526

// Node center Ys
const TOP_CY = L_TOP_Y + NODE_H / 2;  // 79
const BOT_CY = L_BOT_Y + NODE_H / 2;  // 221

// Scene edge connection points (where lines terminate)
const SL_X     = SCENE_X;              // 178 — scene left  edge
const SR_X     = SCENE_X + SCENE_W;   // 462 — scene right edge
const SL_TOP_Y = SCENE_Y + Math.round(SCENE_H * 0.36);  // 48 + 73 = 121
const SL_BOT_Y = SCENE_Y + Math.round(SCENE_H * 0.68);  // 48 + 138 = 186
const SR_TOP_Y = SL_TOP_Y;
const SR_BOT_Y = SL_BOT_Y;

// SVG cubic bezier paths: node edge → scene edge, 24px control-point pull
const PATH_SUBJECT  = `M ${L_EDGE} ${TOP_CY} C ${L_EDGE + 24} ${TOP_CY}, ${SL_X} ${SL_TOP_Y - 8}, ${SL_X} ${SL_TOP_Y}`;
const PATH_WORLD    = `M ${L_EDGE} ${BOT_CY} C ${L_EDGE + 24} ${BOT_CY}, ${SL_X} ${SL_BOT_Y + 8}, ${SL_X} ${SL_BOT_Y}`;
const PATH_LIGHTING = `M ${R_EDGE} ${TOP_CY} C ${R_EDGE - 24} ${TOP_CY}, ${SR_X} ${SR_TOP_Y - 8}, ${SR_X} ${SR_TOP_Y}`;
const PATH_OBJECTS  = `M ${R_EDGE} ${BOT_CY} C ${R_EDGE - 24} ${BOT_CY}, ${SR_X} ${SR_BOT_Y + 8}, ${SR_X} ${SR_BOT_Y}`;

// Approximate midpoints for static pulse circles (x, y)
const PULSE_PTS: [number, number][] = [
  [Math.round((L_EDGE + SL_X) / 2), Math.round((TOP_CY + SL_TOP_Y) / 2)],  // Subject midpoint
  [Math.round((L_EDGE + SL_X) / 2), Math.round((BOT_CY + SL_BOT_Y) / 2)],  // World midpoint
  [Math.round((R_EDGE + SR_X) / 2), Math.round((TOP_CY + SR_TOP_Y) / 2)],  // Lighting midpoint
  [Math.round((R_EDGE + SR_X) / 2), Math.round((BOT_CY + SR_BOT_Y) / 2)],  // Objects midpoint
];

// ─── Role data ─────────────────────────────────────────────────────────────────

const NODES = [
  {
    id:    "subject",
    label: "Subject",
    color: "rgba(59,130,246,1)",
    x:     L_NODE_X,
    y:     L_TOP_Y,
    path:  PATH_SUBJECT,
    // Organic timing — overlapping, not step-based
    nodeDelay:  0.40,
    lineDelay:  1.22,
    pulseDelay: 2.10,
    pulseDur:   2.8,
  },
  {
    id:    "world",
    label: "World",
    color: "rgba(34,197,94,1)",
    x:     L_NODE_X,
    y:     L_BOT_Y,
    path:  PATH_WORLD,
    nodeDelay:  0.65,
    lineDelay:  1.38,
    pulseDelay: 2.55,
    pulseDur:   3.1,
  },
  {
    id:    "lighting",
    label: "Lighting",
    color: "rgba(251,191,36,1)",
    x:     R_NODE_X,
    y:     R_TOP_Y,
    path:  PATH_LIGHTING,
    nodeDelay:  0.75,
    lineDelay:  1.29,
    pulseDelay: 2.35,
    pulseDur:   2.95,
  },
  {
    id:    "objects",
    label: "Objects",
    color: "rgba(249,115,22,1)",
    x:     R_NODE_X,
    y:     R_BOT_Y,
    path:  PATH_OBJECTS,
    nodeDelay:  0.95,
    lineDelay:  1.46,
    pulseDelay: 2.80,
    pulseDur:   3.3,
  },
] as const;

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes cd-ob-scene-in {
  from { opacity: 0; transform: scale(0.975); }
  to   { opacity: 1; transform: scale(1);     }
}
@keyframes cd-ob-node-in {
  from { opacity: 0; transform: scale(0.93) translateY(4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);   }
}
@keyframes cd-ob-line-draw {
  from { stroke-dashoffset: 220; stroke-opacity: 0; }
  to   { stroke-dashoffset: 0;   stroke-opacity: 1; }
}
@keyframes scene-breathe {
  0%, 100% { opacity: 0.42; transform: scale(1);    }
  50%       { opacity: 0.82; transform: scale(1.10); }
}
@keyframes cd-ob-pulse {
  0%, 100% { opacity: 0;    transform: scale(0.7); }
  45%, 55% { opacity: 0.55; transform: scale(1.3); }
}
`;

// ─── Component ─────────────────────────────────────────────────────────────────

export function CDMiniFlow() {
  return (
    <>
      <style>{KEYFRAMES}</style>

      <div
        aria-hidden
        style={{
          position:   "relative",
          width:      CW,
          height:     CH,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {/* ── 1. SCENE — cinematic viewport (no border, no radius, no card) ─── */}
        <div
          style={{
            position:   "absolute",
            left:       SCENE_X,
            top:        SCENE_Y,
            width:      SCENE_W,
            height:     SCENE_H,
            // Layered gradient composition: sky → focal glow → ground shadow
            background: [
              "#080c18",
              "radial-gradient(ellipse at 50% 22%, rgba(55,32,120,0.78) 0%, transparent 52%)",
              "radial-gradient(circle   at 48% 58%, rgba(72,42,190,0.42) 0%, transparent 30%)",
              "radial-gradient(ellipse at 28% 80%, rgba(20,10,55,0.55)  0%, transparent 42%)",
              "linear-gradient(to top,  rgba(4,3,10,0.68) 0%, transparent 32%)",
            ].join(", "),
            overflow:    "hidden",
            animation:   `cd-ob-scene-in 0.9s cubic-bezier(0.16,1,0.3,1) 0s both`,
            // Very faint inner highlight so the frame reads against the overlay bg
            boxShadow:   "inset 0 0 0 1px rgba(255,255,255,0.045)",
          }}
        >
          {/* Breathing atmospheric haze — transform + opacity only */}
          <div
            style={{
              position:        "absolute",
              inset:           0,
              background:      "radial-gradient(circle at 48% 52%, rgba(90,52,230,0.30) 0%, transparent 52%)",
              animation:       "scene-breathe 5.5s ease-in-out infinite",
              transformOrigin: "center",
              pointerEvents:   "none",
            }}
          />

          {/* Vignette — pure CSS, no filter */}
          <div
            style={{
              position:      "absolute",
              inset:         0,
              background:    "radial-gradient(ellipse at center, transparent 36%, rgba(0,0,0,0.74) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Subtle "Creative Director" micro-label — barely visible */}
          <span
            style={{
              position:      "absolute",
              bottom:        7,
              left:          9,
              fontSize:      7,
              fontFamily:    "var(--font-sans)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "rgba(255,255,255,0.18)",
              pointerEvents: "none",
              lineHeight:    1,
            }}
          >
            Creative Director
          </span>
        </div>

        {/* ── 2. FLOATING NODE MODULES ─────────────────────────────────────── */}
        {NODES.map((node) => (
          <div
            key={node.id}
            style={{
              position:             "absolute",
              left:                 node.x,
              top:                  node.y,
              width:                NODE_W,
              height:               NODE_H,
              background:           "rgba(255,255,255,0.04)",
              border:               "1px solid rgba(255,255,255,0.07)",
              borderRadius:         8,
              backdropFilter:       "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display:              "flex",
              alignItems:           "center",
              gap:                  8,
              padding:              "0 10px",
              animation:            `cd-ob-node-in 0.55s cubic-bezier(0.16,1,0.3,1) ${node.nodeDelay}s both`,
            }}
          >
            {/* Role color indicator */}
            <div
              style={{
                width:        6,
                height:       6,
                borderRadius: "50%",
                flexShrink:   0,
                background:   node.color,
                boxShadow:    `0 0 5px ${node.color.replace("1)", "0.45)")}`,
              }}
            />

            {/* Label */}
            <span
              style={{
                fontSize:      11,
                fontFamily:    "var(--font-sans)",
                color:         "rgba(255,255,255,0.62)",
                flex:          1,
                lineHeight:    1,
                letterSpacing: "0.02em",
              }}
            >
              {node.label}
            </span>

            {/* Tiny tinted preview strip */}
            <div
              style={{
                width:        20,
                height:       20,
                borderRadius: 4,
                flexShrink:   0,
                background:   `linear-gradient(135deg, ${node.color.replace("1)", "0.28)")}, ${node.color.replace("1)", "0.08)")})`,
              }}
            />
          </div>
        ))}

        {/* ── 3. SVG: connection lines + pulse dots ────────────────────────── */}
        <svg
          style={{
            position:      "absolute",
            inset:         0,
            width:         CW,
            height:        CH,
            pointerEvents: "none",
            overflow:      "visible",
            zIndex:        1,          // behind node divs (z-index auto)
          }}
        >
          {/* Connection lines — stroke-dashoffset draw animation */}
          {NODES.map((node) => (
            <path
              key={`line-${node.id}`}
              d={node.path}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1.1}
              strokeLinecap="round"
              strokeDasharray={220}
              strokeDashoffset={220}
              style={{
                animation: `cd-ob-line-draw 0.85s cubic-bezier(0.4,0,0.2,1) ${node.lineDelay}s both`,
              }}
            />
          ))}

          {/* Pulse dots — static circles at path midpoints that fade in/out */}
          {NODES.map((node, i) => {
            const [px, py] = PULSE_PTS[i];
            return (
              <circle
                key={`pulse-${node.id}`}
                cx={px}
                cy={py}
                r={2.5}
                fill="rgba(255,255,255,0.50)"
                style={{
                  animation: `cd-ob-pulse ${node.pulseDur}s ease-in-out ${node.pulseDelay}s infinite`,
                  opacity:   0,
                }}
              />
            );
          })}
        </svg>
      </div>
    </>
  );
}
