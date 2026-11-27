import React from 'react';

export type BotExchangeAvatarMood =
  | 'OFF'
  | 'WATCHING'
  | 'BUY'
  | 'EXCHANGE'
  | 'WAIT'
  | 'SLEEP_30M';

interface BotExchangeAvatarSceneProps {
  mood: BotExchangeAvatarMood;
  activeSymbol: string | null;
  statusLabel: string;
  countdownText: string | null;
}

export const BotExchangeAvatarScene: React.FC<BotExchangeAvatarSceneProps> = ({
  mood,
  activeSymbol,
  statusLabel,
  countdownText
}) => {
  const isSleeping = mood === 'SLEEP_30M';
  const isBuying = mood === 'BUY';
  const isExchanging = mood === 'EXCHANGE';
  const isWaiting = mood === 'WAIT';
  const isWatching = mood === 'WATCHING';
  const isOff = mood === 'OFF';

  const screenAccent = isBuying
    ? '#10B981'
    : isExchanging
    ? '#A78BFA'
    : isWaiting
    ? '#F59E0B'
    : isSleeping
    ? '#6366F1'
    : isOff
    ? '#64748B'
    : '#8B5CF6';

  const bodyAnimClass = isSleeping
    ? 'bot3-breathe'
    : isBuying || isExchanging
    ? 'bot3-smile-bounce'
    : 'bot3-breathe';

  const actionTag = isBuying
    ? 'ACHAT SPOT'
    : isExchanging
    ? 'ÉCHANGE SPOT'
    : isWaiting
    ? 'ATTEND USDT'
    : isSleeping
    ? `REPOS ${countdownText || '30:00'}`
    : isOff
    ? 'ARRÊTÉ'
    : 'ANALYSE';

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#170C38] via-[#12092B] to-[#0D0620] border border-[#8B5CF6]/45 overflow-hidden p-3 space-y-2">
      {/* Compact Top Bar */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-purple-200 truncate">
          {activeSymbol ? `${activeSymbol}/USDT · Spot uniquement` : 'Robot Échange · Spot Bybit'}
        </span>
        <span
          className={`font-mono-num font-black text-[10px] shrink-0 ${
            isBuying || isExchanging
              ? 'text-emerald-400'
              : isSleeping
              ? 'text-amber-300'
              : isOff
              ? 'text-slate-400'
              : 'text-purple-200'
          }`}
        >
          {actionTag}
        </span>
      </div>

      {/* Animated SVG Character Sitting in Front of Computer */}
      <div className="relative w-full aspect-[16/9] max-h-48 rounded-xl bg-gradient-to-b from-[#1E1047] via-[#150B33] to-[#0D0620] border border-purple-500/25 overflow-hidden">
        <svg
          viewBox="0 0 400 225"
          className="w-full h-full select-none"
          role="img"
          aria-label={`Personnage Robot Échange - ${statusLabel}`}
        >
          <defs>
            <radialGradient id="bxRoomGlow" cx="65%" cy="40%" r="65%">
              <stop offset="0%" stopColor={screenAccent} stopOpacity="0.32" />
              <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0D0620" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bxSkin" cx="42%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#F5C9A6" />
              <stop offset="60%" stopColor="#DFA178" />
              <stop offset="100%" stopColor="#B8764E" />
            </radialGradient>
            <radialGradient id="bxSkinShadow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#D6946B" />
              <stop offset="100%" stopColor="#9E5E3A" />
            </radialGradient>
            <linearGradient id="bxHoodie" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="55%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
            <linearGradient id="bxDesk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D1D56" />
              <stop offset="100%" stopColor="#170D33" />
            </linearGradient>
          </defs>

          <rect width="400" height="225" fill="url(#bxRoomGlow)" />
          <ellipse cx="200" cy="212" rx="160" ry="10" fill="#060312" opacity="0.7" />

          {/* Chair */}
          <rect
            x="88"
            y={isWaiting ? '60' : '64'}
            width="72"
            height="98"
            rx="24"
            fill="#24164A"
            stroke="#6D28D9"
            strokeWidth="2"
            transform={isWaiting ? 'rotate(-6 124 120)' : undefined}
          />
          <rect x="118" y="160" width="12" height="44" rx="4" fill="#1A1038" />
          <path d="M94 205 L124 196 L154 205" stroke="#312061" strokeWidth="5" strokeLinecap="round" fill="none" />

          {/* Character */}
          <g
            className={bodyAnimClass}
            transform={
              isSleeping
                ? 'translate(10, 22) rotate(14 134 132)'
                : isWaiting
                ? 'translate(-5, 2) rotate(-5 134 132)'
                : isBuying || isExchanging
                ? 'translate(4, -2)'
                : undefined
            }
          >
            {/* Torso */}
            <path d="M92 162 C92 122, 108 110, 134 110 C160 110, 176 124, 176 162 Z" fill="url(#bxHoodie)" />
            <circle cx="150" cy="136" r="4.5" fill="#10B981" />

            {/* Neck */}
            <rect x="126" y="92" width="16" height="20" rx="7" fill="url(#bxSkinShadow)" />

            {/* Head */}
            <g className={isWatching || isBuying || isExchanging ? 'bot3-head-nod' : undefined}>
              <ellipse cx="136" cy="72" rx="28" ry="30" fill="url(#bxSkin)" />
              {/* Hair */}
              <path
                d="M106 70 C104 47, 120 35, 140 37 C158 38, 166 50, 164 62 C158 55, 146 52, 132 54 C120 55, 115 62, 112 72 Z"
                fill="#171124"
              />
              {/* Eyes */}
              {isSleeping ? (
                <>
                  <path d="M122 68 Q129 73 135 68" stroke="#1E1630" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  <path d="M144 68 Q151 73 157 68" stroke="#1E1630" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                </>
              ) : (
                <g className="bot3-blink">
                  <ellipse cx="129" cy="68" rx="4.8" ry="5.6" fill="#FFFFFF" />
                  <circle cx={isWatching ? '131' : '130'} cy="68.5" r="3" fill="#1F1510" />
                  <circle cx="132" cy="67" r="1.2" fill="#FFFFFF" />

                  <ellipse cx="149" cy="68" rx="4.6" ry="5.4" fill="#FFFFFF" />
                  <circle cx={isWatching ? '151' : '150'} cy="68.5" r="2.9" fill="#1F1510" />
                  <circle cx="152" cy="67" r="1.2" fill="#FFFFFF" />
                </g>
              )}

              {/* Mouth */}
              {isExchanging || isBuying ? (
                <path d="M131 84 Q142 92 152 83" fill="none" stroke="#78350F" strokeWidth="2.2" strokeLinecap="round" />
              ) : isSleeping ? (
                <ellipse cx="141" cy="86" rx="2.8" ry="2" fill="#9E5E3A" />
              ) : (
                <path d="M133 85 Q141 88 149 84" fill="none" stroke="#8C482B" strokeWidth="1.9" strokeLinecap="round" />
              )}
            </g>

            {/* Arms */}
            {isSleeping ? (
              <g>
                <path d="M142 124 C160 135, 178 145, 192 146" fill="none" stroke="#6D28D9" strokeWidth="13" strokeLinecap="round" />
                <circle cx="194" cy="146" r="6.5" fill="url(#bxSkin)" />
              </g>
            ) : isWaiting ? (
              <g>
                <path d="M140 124 C154 138, 168 146, 184 146" fill="none" stroke="#6D28D9" strokeWidth="13" strokeLinecap="round" />
                <circle cx="186" cy="146" r="6.5" fill="url(#bxSkin)" />
              </g>
            ) : (
              <g className={isBuying || isExchanging ? 'bot3-key-tap' : undefined}>
                <path
                  d={isBuying || isExchanging ? 'M144 122 C168 134, 194 144, 222 148' : 'M142 124 C162 136, 182 146, 208 150'}
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
                <circle cx={isBuying || isExchanging ? '224' : '210'} cy={isBuying || isExchanging ? '148' : '150'} r="6.8" fill="url(#bxSkin)" />
              </g>
            )}
          </g>

          {/* Desk */}
          <rect x="44" y="154" width="318" height="12" rx="5" fill="url(#bxDesk)" stroke="#7C3AED" strokeWidth="1.4" />
          <rect x="64" y="166" width="11" height="44" rx="4" fill="#170E33" />
          <rect x="326" y="166" width="11" height="44" rx="4" fill="#170E33" />

          {/* Keyboard */}
          <polygon points="190,154 256,154 262,148 196,148" fill="#1E1B4B" stroke="#6D28D9" strokeWidth="1" />
          <rect x="200" y="149" width="18" height="3.5" rx="1" fill={isBuying ? '#10B981' : '#334155'} />
          <rect x="223" y="149" width="20" height="3.5" rx="1" fill={isExchanging ? '#A78BFA' : '#334155'} />

          {/* Monitor */}
          <rect x="300" y="135" width="12" height="19" rx="3" fill="#312E81" />
          <rect x="282" y="150" width="48" height="4.5" rx="2" fill="#4C1D95" />
          <rect x="240" y="48" width="128" height="88" rx="9" fill="#1E103E" stroke="#8B5CF6" strokeWidth="2.2" />
          <rect x="247" y="55" width="114" height="74" rx="5" fill="#090F20" />

          {isSleeping ? (
            <g>
              <text x="304" y="86" textAnchor="middle" fill="#FBBF24" fontSize="13" fontWeight="900" fontFamily="monospace">
                REPOS 30m
              </text>
              <text x="304" y="105" textAnchor="middle" fill="#FDE68A" fontSize="12" fontWeight="800" fontFamily="monospace">
                {countdownText || '30:00'}
              </text>
              <text x="304" y="120" textAnchor="middle" fill="#94A3B8" fontSize="7" fontWeight="700">
                STOP LOSS -2%
              </text>
            </g>
          ) : isOff ? (
            <g>
              <text x="304" y="91" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="900" fontFamily="monospace">
                ROBOT OFF
              </text>
              <text x="304" y="107" textAnchor="middle" fill="#64748B" fontSize="7.5" fontWeight="700">
                PRÊT À DÉMARRER
              </text>
            </g>
          ) : (
            <g>
              <text x="304" y="68" textAnchor="middle" fill="#E9D5FF" fontSize="8" fontWeight="900" fontFamily="monospace">
                {activeSymbol ? `${activeSymbol}/USDT` : 'SPOT SCAN'}
              </text>
              <path
                d={isBuying || isExchanging ? 'M255 110 L272 100 L286 105 L302 86 L320 90 L348 72' : 'M255 104 L274 98 L294 104 L314 92 L334 96 L350 86'}
                fill="none"
                stroke={isExchanging ? '#A78BFA' : '#10B981'}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <rect x="266" y="92" width="5" height="14" rx="1" fill="#10B981" />
              <rect x="282" y="96" width="5" height="10" rx="1" fill="#EF4444" />
              <rect x="298" y="84" width="5" height="16" rx="1" fill="#10B981" />
              <rect x="314" y="78" width="5" height="18" rx="1" fill="#A78BFA" />
              <rect x="256" y="114" width="44" height="11" rx="3" fill={isBuying ? '#10B981' : '#064E3B'} />
              <text x="278" y="122" textAnchor="middle" fill="#FFFFFF" fontSize="6.8" fontWeight="900">
                BUY
              </text>
              <rect x="308" y="114" width="44" height="11" rx="3" fill={isExchanging ? '#7C3AED' : '#3B0764'} />
              <text x="330" y="122" textAnchor="middle" fill="#FFFFFF" fontSize="6.8" fontWeight="900">
                ÉCHANGE
              </text>
            </g>
          )}

          {/* ZZZ when sleeping */}
          {isSleeping && (
            <g>
              <text x="164" y="48" fill="#FDE68A" fontSize="14" fontWeight="900" className="bot3-zzz-1">
                Z
              </text>
              <text x="178" y="36" fill="#C4B5FD" fontSize="11" fontWeight="900" className="bot3-zzz-2">
                z
              </text>
              <text x="190" y="26" fill="#FBBF24" fontSize="15" fontWeight="900" className="bot3-zzz-3">
                Z
              </text>
            </g>
          )}

          {isBuying && (
            <text x="176" y="42" fill="#10B981" fontSize="10.5" fontWeight="900">
              BUY SPOT!
            </text>
          )}
          {isExchanging && (
            <text x="172" y="42" fill="#C4B5FD" fontSize="10.5" fontWeight="900">
              ÉCHANGE SPOT!
            </text>
          )}
        </svg>
      </div>

      {/* Live Status Caption Directly Underneath */}
      <div className="px-2.5 py-2 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/35 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-white truncate">{statusLabel}</span>
        {isSleeping && countdownText && (
          <span className="text-xs font-mono-num font-black text-amber-300 shrink-0">
            {countdownText}
          </span>
        )}
      </div>
    </div>
  );
};
