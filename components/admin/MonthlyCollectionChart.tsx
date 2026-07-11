"use client";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { taka, toBnDigits } from "@/lib/format";
import { useI18n } from "@/components/providers/I18nProvider";

const BN_SHORT = ["জা", "ফে", "মা", "এ", "মে", "জু", "জু", "আ", "সে", "অ", "ন", "ডি"];
const EN_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const { locale } = useI18n();
  const en = locale === "en";
  const short = en ? EN_SHORT : BN_SHORT;
  const max = Math.max(1, ...monthly);
  const W = 640;
  const H = 220;
  const pad = { top: 18, right: 14, bottom: 28, left: 14 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const slot = chartW / 12;
  const barW = slot * 0.52;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {en ? "Monthly Collection" : "মাসিক আদায়"} — {toBnDigits(year, locale)}
        </Typography>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Box
            component="svg"
            viewBox={`0 0 ${W} ${H}`}
            sx={{
              width: "100%",
              minWidth: 420,
              height: "auto",
              display: "block",
              "& rect.bar": {
                transformBox: "fill-box",
                transformOrigin: "bottom",
                animation: "barGrow .5s cubic-bezier(.22,1,.36,1) both",
              },
              "@keyframes barGrow": { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
            }}
            role="img"
            aria-label={en ? `Monthly collection for ${year}` : `${year} সালের মাসিক আদায়`}
          >
            <defs>
              <linearGradient id="barTeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3FA595" />
                <stop offset="100%" stopColor="#0F7A6B" />
              </linearGradient>
              <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F6B24A" />
                <stop offset="100%" stopColor="#E4890B" />
              </linearGradient>
            </defs>

            {/* horizontal gridlines */}
            {gridLines.map((g) => {
              const y = pad.top + chartH - g * chartH;
              return (
                <line
                  key={g}
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + chartW}
                  y2={y}
                  stroke="rgba(17,34,29,0.08)"
                  strokeWidth={1}
                  strokeDasharray={g === 0 ? "none" : "3 4"}
                />
              );
            })}

            {monthly.map((v, i) => {
              const h = (v / max) * chartH;
              const x = pad.left + i * slot + (slot - barW) / 2;
              const y = pad.top + chartH - h;
              const isCurrent = i + 1 === currentMonth;
              return (
                <g key={i}>
                  <title>{`${short[i]}: ${taka(v, locale)}`}</title>
                  <rect
                    className="bar"
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(h, v > 0 ? 2 : 0)}
                    rx={5}
                    fill={isCurrent ? "url(#barGold)" : "url(#barTeal)"}
                    opacity={v > 0 ? 1 : 0.22}
                    style={{ animationDelay: `${i * 35}ms` }}
                  />
                  <text
                    x={x + barW / 2}
                    y={pad.top + chartH + 18}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={isCurrent ? 700 : 500}
                    fill={isCurrent ? "#B96F00" : "rgba(17,34,29,0.55)"}
                  >
                    {short[i]}
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
