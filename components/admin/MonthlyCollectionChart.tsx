"use client";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { taka, toBnDigits } from "@/lib/format";

const BN_SHORT = ["জা", "ফে", "মা", "এ", "মে", "জু", "জু", "আ", "সে", "অ", "ন", "ডি"];

/**
 * Lightweight inline-SVG bar chart of monthly collection for the year — no
 * external chart lib. Current month highlighted in the accent colour.
 */
export default function MonthlyCollectionChart({
  monthly,
  year,
  currentMonth,
}: {
  monthly: number[];
  year: number;
  currentMonth: number;
}) {
  const max = Math.max(1, ...monthly);
  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 12, bottom: 26, left: 12 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const slot = chartW / 12;
  const barW = slot * 0.56;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          মাসিক আদায় — {toBnDigits(year)}
        </Typography>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Box
            component="svg"
            viewBox={`0 0 ${W} ${H}`}
            sx={{ width: "100%", minWidth: 420, height: "auto", display: "block" }}
            role="img"
            aria-label={`${year} সালের মাসিক আদায়`}
          >
            {/* baseline */}
            <line
              x1={pad.left}
              y1={pad.top + chartH}
              x2={pad.left + chartW}
              y2={pad.top + chartH}
              stroke="rgba(18,36,31,0.15)"
              strokeWidth={1}
            />
            {monthly.map((v, i) => {
              const h = (v / max) * chartH;
              const x = pad.left + i * slot + (slot - barW) / 2;
              const y = pad.top + chartH - h;
              const isCurrent = i + 1 === currentMonth;
              return (
                <g key={i}>
                  <title>{`${BN_SHORT[i]}: ${taka(v)}`}</title>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(h, v > 0 ? 2 : 0)}
                    rx={4}
                    fill={isCurrent ? "#E4890B" : "#0F7A6B"}
                    opacity={v > 0 ? 1 : 0.25}
                  />
                  <text
                    x={x + barW / 2}
                    y={pad.top + chartH + 18}
                    textAnchor="middle"
                    fontSize={12}
                    fill="rgba(18,36,31,0.6)"
                  >
                    {BN_SHORT[i]}
                  </text>
                </g>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
