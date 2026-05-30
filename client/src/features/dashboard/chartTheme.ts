import {
  Chart,
  ArcElement,
  BarElement,
  BubbleController,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  BarController,
  type ChartOptions,
} from 'chart.js';

Chart.register(
  ArcElement,
  BarElement,
  BubbleController,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  BarController,
);

Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#8a97a8';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.maintainAspectRatio = false;
// Disable animations — Chart.js v4 + React StrictMode race their animator
// against effect cleanup/MutationObserver, throwing "this._fn is not a function".
Chart.defaults.animation = false;
Chart.defaults.animations.colors = false;
Chart.defaults.animations.numbers = false;
Chart.defaults.transitions.active.animation.duration = 0;

export const C = {
  ink: '#16202e',
  ink2: '#4a566a',
  ink3: '#8a97a8',
  line: '#e6e9ee',
  line2: '#eef1f5',
  brand: '#b97f17',
  brand2: '#d8a23a',
  good: '#15a34a',
  warn: '#e08a1e',
  bad: '#d6342c',
  info: '#2f6fed',
  neutral: '#5d6b7e',
};

export const tooltipStyle: NonNullable<NonNullable<ChartOptions['plugins']>['tooltip']> = {
  backgroundColor: '#16202e',
  padding: 11,
  cornerRadius: 9,
  titleFont: { family: "'Sora'", size: 12, weight: 600 },
  bodyFont: { family: "'IBM Plex Mono'", size: 11.5 },
  displayColors: true,
  boxPadding: 5,
  usePointStyle: true,
  titleColor: '#fff',
  bodyColor: '#cdd5e0',
};

export const gridX = {
  grid: { display: false },
  border: { display: false },
  ticks: { color: C.ink3 },
};

export const gridY = {
  grid: { color: C.line2, drawTicks: false },
  border: { display: false },
  ticks: { color: C.ink3, padding: 8 },
};

export function gradient(
  ctx: CanvasRenderingContext2D,
  h: number,
  c1: string,
  c2: string,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}
