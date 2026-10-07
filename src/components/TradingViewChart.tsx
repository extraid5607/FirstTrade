'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { Candle, Quote } from '@/types/market';
import { useTheme } from '@/lib/themeContext';
import { Layers, Activity, Maximize2, RefreshCw, Radio } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  currentQuote?: Quote;
  onOpenOptionChain?: () => void;
  onTrade?: (side: 'BUY' | 'SELL') => void;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  currentQuote,
  onOpenOptionChain,
  onTrade,
}) => {
  const { theme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const lastCandleRef = useRef<CandlestickData | null>(null);
  const rawCandlesRef = useRef<Candle[]>([]);

  const [chartInterval, setChartInterval] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('5m');
  const [showEMA, setShowEMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isTickLive, setIsTickLive] = useState(true);
  const [lastTickTime, setLastTickTime] = useState<number>(Date.now());

  // Helper to calculate EMA
  const calculateEMA = (candles: Candle[], period: number) => {
    if (candles.length < period) return [];
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    const result = [];

    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        ema = candles[i].close;
      } else {
        ema = candles[i].close * k + ema * (1 - k);
      }
      result.push({
        time: candles[i].time as Time,
        value: Math.round(ema * 100) / 100,
      });
    }
    return result;
  };

  // 1. Initial Chart Creation & Historical Load
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function initChartAndCandles() {
      try {
        const res = await fetch(`/api/market/charts?symbol=${encodeURIComponent(symbol)}&interval=${chartInterval}`);
        if (!res.ok) throw new Error('Failed to load chart');
        const data = await res.json();
        const candles: Candle[] = data.candles || [];

        if (!isMounted || !chartContainerRef.current) return;

        // Cleanup existing chart
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }

        const isDark = theme === 'dark';

        // Initialize Lightweight Chart with theme colors
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 480,
          layout: {
            background: { color: isDark ? '#0E121A' : '#FFFFFF' },
            textColor: isDark ? '#848E9C' : '#475569',
          },
          grid: {
            vertLines: { color: isDark ? '#161B26' : '#F1F5F9' },
            horzLines: { color: isDark ? '#161B26' : '#F1F5F9' },
          },
          crosshair: {
            mode: 1, // Magnet crosshair
            vertLine: {
              color: isDark ? '#3B455B' : '#94A3B8',
              width: 1,
              style: 3,
            },
            horzLine: {
              color: isDark ? '#3B455B' : '#94A3B8',
              width: 1,
              style: 3,
            },
          },
          rightPriceScale: {
            borderColor: isDark ? '#1E2433' : '#E2E8F0',
            scaleMargins: {
              top: 0.1,
              bottom: 0.2,
            },
          },
          timeScale: {
            borderColor: isDark ? '#1E2433' : '#E2E8F0',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        chartRef.current = chart;

        // Volume series
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '', // overlay
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
        volumeSeriesRef.current = volumeSeries;

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#00D09C',
          downColor: '#EB5B3C',
          borderVisible: false,
          wickUpColor: '#00D09C',
          wickDownColor: '#EB5B3C',
        });
        candleSeriesRef.current = candleSeries;

        // EMA Lines
        const ema9Series = chart.addLineSeries({
          color: '#38BDF8',
          lineWidth: 1,
          title: 'EMA 9',
        });
        ema9SeriesRef.current = ema9Series;

        const ema21Series = chart.addLineSeries({
          color: '#F59E0B',
          lineWidth: 1,
          title: 'EMA 21',
        });
        ema21SeriesRef.current = ema21Series;

        // Set Data
        rawCandlesRef.current = candles;
        const formattedCandles: CandlestickData[] = candles.map(c => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        candleSeries.setData(formattedCandles);

        if (formattedCandles.length > 0) {
          lastCandleRef.current = formattedCandles[formattedCandles.length - 1];
        }

        if (showVolume) {
          const volData = candles.map(c => ({
            time: c.time as Time,
            value: c.volume || 0,
            color: c.close >= c.open ? 'rgba(0, 208, 156, 0.25)' : 'rgba(235, 91, 60, 0.25)',
          }));
          volumeSeries.setData(volData);
        }

        if (showEMA) {
          ema9Series.setData(calculateEMA(candles, 9));
          ema21Series.setData(calculateEMA(candles, 21));
        }

        chart.timeScale().fitContent();
      } catch (err) {
        console.error('Failed to init chart', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initChartAndCandles();

    // Resize observer
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 480,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, chartInterval, showEMA, showVolume, theme]);

  // Dynamic Theme Options Update without reloading
  useEffect(() => {
    if (!chartRef.current) return;
    const isDark = theme === 'dark';
    chartRef.current.applyOptions({
      layout: {
        background: { color: isDark ? '#0E121A' : '#FFFFFF' },
        textColor: isDark ? '#848E9C' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? '#161B26' : '#F1F5F9' },
        horzLines: { color: isDark ? '#161B26' : '#F1F5F9' },
      },
      crosshair: {
        vertLine: { color: isDark ? '#3B455B' : '#94A3B8' },
        horzLine: { color: isDark ? '#3B455B' : '#94A3B8' },
      },
      rightPriceScale: {
        borderColor: isDark ? '#1E2433' : '#E2E8F0',
      },
      timeScale: {
        borderColor: isDark ? '#1E2433' : '#E2E8F0',
      },
    });
  }, [theme]);

  // 2. Real-Time Tick Update: Dynamic Formation of Current Candlestick on Incoming Live Price!
  useEffect(() => {
    if (!currentQuote?.ltp || !candleSeriesRef.current || !lastCandleRef.current) return;

    const ltp = currentQuote.ltp;
    const last = lastCandleRef.current;
    const intervalSec = chartInterval === '1m' ? 60 : chartInterval === '5m' ? 300 : chartInterval === '15m' ? 900 : chartInterval === '1h' ? 3600 : 86400;
    const nowSec = Math.floor(Date.now() / 1000);
    const lastTime = Number(last.time);

    let updatedBar: CandlestickData;

    // Check if enough time has passed to form a new candle bar
    if (nowSec >= lastTime + intervalSec) {
      const newCandleTime = (Math.floor(nowSec / intervalSec) * intervalSec) as Time;
      updatedBar = {
        time: newCandleTime,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
      };
    } else {
      // Update the current candle dynamically
      updatedBar = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high, ltp),
        low: Math.min(last.low, ltp),
        close: ltp,
      };
    }

    lastCandleRef.current = updatedBar;
    candleSeriesRef.current.update(updatedBar);
    setLastTickTime(Date.now());
  }, [currentQuote?.ltp, chartInterval]);

  // 3. Periodic Background Historical Candle Polling (every 4 seconds)
  useEffect(() => {
    const syncInterval = window.setInterval(async () => {
      if (!candleSeriesRef.current) return;

      try {
        const res = await fetch(`/api/market/charts?symbol=${encodeURIComponent(symbol)}&interval=${chartInterval}`);
        if (!res.ok) return;
        const data = await res.json();
        const serverCandles: Candle[] = data.candles || [];

        if (serverCandles.length > 0 && candleSeriesRef.current) {
          const formatted: CandlestickData[] = serverCandles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));

          // Merge latest live tick into the rightmost candle
          if (currentQuote?.ltp && formatted.length > 0) {
            const rightmost = formatted[formatted.length - 1];
            rightmost.high = Math.max(rightmost.high, currentQuote.ltp);
            rightmost.low = Math.min(rightmost.low, currentQuote.ltp);
            rightmost.close = currentQuote.ltp;
          }

          candleSeriesRef.current.setData(formatted);
          lastCandleRef.current = formatted[formatted.length - 1];
          rawCandlesRef.current = serverCandles;

          if (showEMA && ema9SeriesRef.current && ema21SeriesRef.current) {
            ema9SeriesRef.current.setData(calculateEMA(serverCandles, 9));
            ema21SeriesRef.current.setData(calculateEMA(serverCandles, 21));
          }
        }
      } catch (err) {
        // Silent catch for background polling
      }
    }, 4000);

    return () => window.clearInterval(syncInterval);
  }, [symbol, chartInterval, showEMA, currentQuote?.ltp]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E121A] relative select-none transition-colors">
      {/* Chart Top Toolbar */}
      <div className="p-3 border-b border-slate-200 dark:border-[#1E2430] flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-[#0F131C]">
        {/* Symbol Title & Live Quote */}
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{symbol}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#181E2B] text-slate-700 dark:text-slate-400 font-mono border border-slate-300 dark:border-[#232B3D]">
                NSE
              </span>
              
              {/* Pulsing Live Chart Indicator */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D09C] animate-ping" />
                <span>LIVE AUTO-UPDATE</span>
              </div>
            </div>
          </div>

          {currentQuote && (
            <div className="flex items-baseline gap-2 pl-3 border-l border-slate-200 dark:border-[#1F2636]">
              <span className="text-sm sm:text-lg font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                ₹{currentQuote.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-mono font-semibold tabular-nums ${
                currentQuote.dayChange >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
              }`}>
                {currentQuote.dayChange >= 0 ? '+' : ''}{currentQuote.dayChange.toFixed(1)} ({currentQuote.dayChangePerc >= 0 ? '+' : ''}{currentQuote.dayChangePerc.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Chart Controls: Timeframe & Indicators */}
        <div className="flex items-center gap-2">
          {/* Timeframe switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-[#151A26] rounded-lg p-0.5 border border-slate-200 dark:border-[#202738]">
            {(['1m', '5m', '15m', '1h', '1d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setChartInterval(tf)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  chartInterval === tf
                    ? 'bg-white dark:bg-[#222A3A] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
              showEMA
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                : 'bg-slate-100 dark:bg-[#151A26] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#202738] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            EMA (9/21)
          </button>

          {/* Option Chain Button */}
          {onOpenOptionChain && (
            <button
              onClick={onOpenOptionChain}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-[#00D09C] border border-emerald-500/25 flex items-center gap-1 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Option Chain</span>
            </button>
          )}

          {/* Quick Trade Buttons */}
          {onTrade && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-[#1F2636]">
              <button
                onClick={() => onTrade('BUY')}
                className="px-3 py-1 bg-[#00D09C] hover:bg-[#00B887] text-black font-bold text-xs rounded-lg transition-colors"
              >
                BUY
              </button>
              <button
                onClick={() => onTrade('SELL')}
                className="px-3 py-1 bg-[#EB5B3C] hover:bg-[#D84A2C] text-white font-bold text-xs rounded-lg transition-colors"
              >
                SELL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightweight Chart Canvas */}
      <div className="flex-1 w-full h-full min-h-[380px] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-[#0E121A]/60 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#161B26] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#232A3B] shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              <span>Loading real-time candles...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
