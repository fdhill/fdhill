/**
 * Generate SVG "dot style" GitHub contribution graph (mirip pixel-art bubble)
 * Data diambil dari GitHub GraphQL API (contributionsCollection.contributionCalendar)
 *
 * Cara pakai:
 *   GITHUB_TOKEN=xxxx GITHUB_USERNAME=fdhill node generate-dot-graph.js
 *
 * Output: contribution-graph.svg
 */

const fs = require("fs");

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;

// Palet warna custom per level (0 = tidak kontribusi, 4 = paling banyak)
// Silakan ganti hex sesuai selera
const PALETTE = {
  0: "#161B22", // kosong / background dot
  1: "#3B82F6", // biru
  2: "#EAB308", // kuning
  3: "#22C55E", // hijau
  4: "#EF4444", // merah
};

const CELL = 12; // jarak antar dot (px)
const RADIUS = 4.5; // radius lingkaran
const PADDING_LEFT = 30;
const PADDING_TOP = 24;
const BG = "#0D1117";

async function fetchContributions(username, token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

// Bagi count jadi level 0-4 (kuartil sederhana, auto-scale ke data user)
function buildLevelMapper(weeks) {
  const counts = weeks
    .flatMap((w) => w.contributionDays.map((d) => d.contributionCount))
    .filter((c) => c > 0)
    .sort((a, b) => a - b);

  if (counts.length === 0) return () => 0;

  const q = (p) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
  const t1 = q(0.25) || 1;
  const t2 = q(0.5) || 2;
  const t3 = q(0.75) || 3;

  return (count) => {
    if (count === 0) return 0;
    if (count <= t1) return 1;
    if (count <= t2) return 2;
    if (count <= t3) return 3;
    return 4;
  };
}

function monthLabelsFor(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const firstDay = week.contributionDays[0];
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      labels.push({ week: i, text: firstDay.date.slice(0, 7) });
      lastMonth = month;
    }
  });
  return labels;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function generateSVG(weeks, username) {
  const level = buildLevelMapper(weeks);
  const width = PADDING_LEFT + weeks.length * CELL + 20;
  const height = PADDING_TOP + 7 * CELL + 20;

  let dots = "";
  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day) => {
      const x = PADDING_LEFT + wi * CELL + CELL / 2;
      const y = PADDING_TOP + day.weekday * CELL + CELL / 2;
      const lvl = level(day.contributionCount);
      const color = PALETTE[lvl];
      dots += `<circle cx="${x}" cy="${y}" r="${RADIUS}" fill="${color}">
  <title>${day.date}: ${day.contributionCount} contributions</title>
</circle>\n`;
    });
  });

  let monthLabels = "";
  monthLabelsFor(weeks).forEach(({ week, text }) => {
    const month = MONTH_NAMES[parseInt(text.slice(5, 7), 10) - 1];
    const x = PADDING_LEFT + week * CELL;
    monthLabels += `<text x="${x}" y="16" font-size="10" fill="#8B949E" font-family="Segoe UI, Helvetica, Arial, sans-serif">${month}</text>\n`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="${BG}"/>
  ${monthLabels}
  ${dots}
</svg>`;
}

async function main() {
  if (!USERNAME || !TOKEN) {
    console.error("Set env GITHUB_USERNAME dan GITHUB_TOKEN dulu.");
    process.exit(1);
  }
  const weeks = await fetchContributions(USERNAME, TOKEN);
  const svg = generateSVG(weeks, USERNAME);
  fs.writeFileSync("contribution-graph.svg", svg);
  console.log("Saved contribution-graph.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
