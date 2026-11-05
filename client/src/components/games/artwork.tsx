import type { GameId } from "@boardroom/shared";

export function GameArtwork({ id }: { id: GameId }) {
  return (
    <svg viewBox="0 0 320 180" aria-hidden="true" className="size-full">
      {renderArt(id)}
    </svg>
  );
}

function renderArt(id: GameId) {
  switch (id) {
    case "battleship":
      return <BattleshipArt />;
    case "uno":
      return <UnoArt />;
    case "poker":
      return <PokerArt />;
    case "monopoly":
      return <MonopolyArt />;
    case "risk":
      return <RiskArt />;
    case "catan":
      return <CatanArt />;
    case "ticket-to-ride":
      return <RouteArt />;
    case "wingspan":
      return <BirdArt />;
    case "splendor":
      return <GemArt />;
  }
}

function TableBackground() {
  return (
    <>
      <rect width="320" height="180" fill="var(--felt)" />
      <rect
        x="16"
        y="16"
        width="288"
        height="148"
        rx="18"
        fill="none"
        stroke="var(--on-felt)"
        strokeOpacity="0.18"
      />
    </>
  );
}

function BattleshipArt() {
  const cells = [];
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      cells.push(
        <rect
          key={`${row}-${column}`}
          x={48 + column * 22}
          y={32 + row * 20}
          width="16"
          height="14"
          rx="2"
          fill="var(--on-felt)"
          fillOpacity="0.1"
        />,
      );
    }
  }

  return (
    <>
      <TableBackground />
      {cells}
      <rect x="70" y="52" width="82" height="14" rx="3" fill="var(--brass)" />
      <rect x="158" y="72" width="16" height="54" rx="3" fill="var(--foam)" />
      <circle cx="224" cy="59" r="5" fill="var(--brass)" />
    </>
  );
}

function UnoArt() {
  return (
    <>
      <TableBackground />
      <rect x="96" y="36" width="78" height="112" rx="10" fill="var(--on-felt)" transform="rotate(-10 135 92)" />
      <rect x="128" y="34" width="78" height="112" rx="10" fill="var(--foam)" transform="rotate(7 167 90)" />
      <circle cx="168" cy="90" r="16" fill="none" stroke="var(--felt)" strokeWidth="5" />
    </>
  );
}

function PokerArt() {
  const ranks = ["A", "K", "Q", "J"];
  return (
    <>
      <TableBackground />
      {ranks.map((rank, index) => (
        <g key={rank} transform={`translate(${48 + index * 64} 38)`}>
          <rect width="52" height="104" rx="8" fill={index % 2 === 0 ? "var(--on-felt)" : "var(--foam)"} />
          <text
            x="10"
            y="28"
            fill="var(--felt)"
            fontFamily="Outfit Variable, sans-serif"
            fontSize="18"
            fontWeight="600"
          >
            {rank}
          </text>
        </g>
      ))}
    </>
  );
}

function MonopolyArt() {
  const cells = [];
  for (let index = 0; index < 8; index += 1) {
    cells.push(<rect key={`top-${index}`} x={48 + index * 28} y="36" width="22" height="22" rx="3" />);
    cells.push(<rect key={`bottom-${index}`} x={48 + index * 28} y="122" width="22" height="22" rx="3" />);
  }
  for (let index = 1; index < 3; index += 1) {
    cells.push(<rect key={`left-${index}`} x="48" y={36 + index * 28} width="22" height="22" rx="3" />);
    cells.push(<rect key={`right-${index}`} x="244" y={36 + index * 28} width="22" height="22" rx="3" />);
  }

  return (
    <>
      <TableBackground />
      <g fill="var(--on-felt)" fillOpacity="0.85">
        {cells}
      </g>
      <rect x="118" y="72" width="84" height="36" rx="8" fill="var(--brass)" />
    </>
  );
}

function RiskArt() {
  return (
    <>
      <TableBackground />
      <polygon points="54,100 112,42 168,74 138,128" fill="var(--foam)" />
      <polygon points="146,58 236,46 258,112 176,124" fill="var(--brass)" />
      <polygon points="78,124 150,132 168,164 62,158" fill="var(--on-felt)" fillOpacity="0.88" />
    </>
  );
}

function hexPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

function CatanArt() {
  const centers = [
    [160, 78],
    [124, 98],
    [196, 98],
    [142, 128],
    [178, 128],
    [160, 48],
    [160, 148],
  ];
  const fills = [
    "var(--brass)",
    "var(--foam)",
    "var(--on-felt)",
    "var(--foam)",
    "var(--brass)",
    "var(--on-felt)",
    "var(--foam)",
  ];

  return (
    <>
      <TableBackground />
      {centers.map(([cx, cy], index) => (
        <polygon
          key={`${cx}-${cy}`}
          points={hexPoints(cx, cy, 24)}
          fill={fills[index]}
          fillOpacity="0.92"
          stroke="var(--felt)"
          strokeWidth="3"
        />
      ))}
    </>
  );
}

function RouteArt() {
  const cities = [
    [58, 124],
    [112, 68],
    [176, 96],
    [236, 52],
    [262, 128],
  ];
  const routes = [
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [0, 2],
  ];

  return (
    <>
      <TableBackground />
      {routes.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          x1={cities[from][0]}
          y1={cities[from][1]}
          x2={cities[to][0]}
          y2={cities[to][1]}
          stroke="var(--brass)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
      {cities.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="var(--on-felt)" />
      ))}
    </>
  );
}

function BirdArt() {
  return (
    <>
      <TableBackground />
      <ellipse cx="148" cy="104" rx="72" ry="28" fill="var(--foam)" />
      <ellipse cx="112" cy="90" rx="38" ry="16" fill="var(--brass)" transform="rotate(-18 112 90)" />
      <circle cx="206" cy="82" r="22" fill="var(--on-felt)" />
      <polygon points="224,78 252,86 224,94" fill="var(--brass)" />
      <circle cx="214" cy="78" r="2.5" fill="var(--felt)" />
    </>
  );
}

function GemArt() {
  return (
    <>
      <TableBackground />
      <circle cx="92" cy="96" r="26" fill="var(--foam)" />
      <circle cx="140" cy="78" r="26" fill="var(--brass)" />
      <circle cx="132" cy="124" r="26" fill="var(--on-felt)" />
      <rect x="186" y="42" width="74" height="100" rx="10" fill="var(--on-felt)" />
      <circle cx="223" cy="84" r="12" fill="var(--brass)" />
    </>
  );
}
