import React from 'react';

export type Bot3AvatarMood =
  | 'OFF'
  | 'WATCHING'
  | 'BUY'
  | 'SELL'
  | 'REST'
  | 'SLEEP_30M'
  | 'SLEEP_MIDNIGHT';

interface Bot3AvatarSceneProps {
  mood: Bot3AvatarMood;
  activeSymbol: string | null;
  statusLabel: string;
  countdownText: string | null;
  lastPnlAr: number | null;
}

export const Bot3AvatarScene: React.FC<Bot3AvatarSceneProps> = ({
  mood,
  activeSymbol,
  statusLabel,
  countdownText,
  lastPnlAr
}) => {
  const isSleeping = mood === 'SLEEP_30M' || mood === 'SLEEP_MIDNIGHT';
  const isBuying = mood === 'BUY';
  const isSelling = mood === 'SELL';
  const isResting = mood === 'REST';
  const isWatching = mood === 'WATCHING';
  const isOff = mood === 'OFF';

  const screenAccent = isBuying
    ? '#10B981'
    : isSelling
    ? '#34D399'
    : isResting
    ? '#F59E0B'
    : isSleeping
    ? '#6366F1'
    : isOff
    ? '#64748B'
    : '#8B5CF6';

  const bodyAnimClass = isSleeping
    ? 'bot3-breathe'
    : isBuying || isSelling
    ? 'bot3-smile-bounce'
    : 'bot3-breathe';

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-[#170C38] via-[#12092B] to-[#0D0620] border border-[#8B5CF6]/45 overflow-hidden p-3">
      {/* Studio backdrop header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-[11px] font-black text-white block truncate">
            {statusLabel}
          </span>
          <span className="text-[10px] text-purple-300 font-mono block truncate">
            {isSleeping
              ? mood === 'SLEEP_30M'
                ? 'Réveil automatique à 00:00 — ne touchez à rien'
                : 'Objectif journalier atteint — réveil auto à 00:00H'
              : activeSymbol
              ? `Coin actif : ${activeSymbol}/USDT • Limit Order`
              : 'Analyse autonome 1m sur tous les coins'}
          </span>
        </div>

        {isSleeping && countdownText ? (
          <div className="shrink-0 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/70 text-right">
            <span className="text-[9px] font-bold text-amber-200 block leading-none">
              {mood === 'SLEEP_30M' ? 'DORT (30 MIN)' : 'DORT JUSQU’À 00:00H'}
            </span>
            <span className="text-xs font-mono-num font-black text-amber-300">
              {countdownText}
            </span>
          </div>
        ) : (
          <div
            className={`shrink-0 px-2.5 py-1 rounded-xl border text-[10px] font-black ${
              isBuying
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                : isSelling
                ? 'bg-emerald-500/30 border-emerald-300 text-emerald-200'
                : isResting
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : isOff
                ? 'bg-slate-700/40 border-slate-500/50 text-slate-300'
                : 'bg-[#7C3AED]/30 border-[#8B5CF6] text-purple-100'
            }`}
          >
            {isBuying
              ? 'APPUIE BUY'
              : isSelling
              ? `APPUIE SELL${lastPnlAr !== null ? ` (${lastPnlAr >= 0 ? '+' : ''}${lastPnlAr} Ar)` : ''}`
              : isResting
              ? 'PAUSE CAFÉ'
              : isOff
              ? 'ARRÊTÉ (OFF)'
              : 'SCAN COURBE'}
          </div>
        )}
      </div>

      {/* Pixar-inspired 3D-shaded Cartoon Scene */}
      <div className="relative w-full aspect-[16/10] max-h-60 rounded-xl bg-gradient-to-b from-[#1E1047] via-[#160B35] to-[#0E0722] border border-purple-500/25 overflow-hidden">
        <svg
          viewBox="0 0 400 250"
          className="w-full h-full select-none"
          role="img"
          aria-label={`Avatar 3D Trader SALOMA - ${statusLabel}`}
        >
          <defs>
            {/* 3D Studio Lighting & Gradients */}
            <radialGradient id="bot3RoomGlow" cx="62%" cy="40%" r="65%">
              <stop offset="0%" stopColor={screenAccent} stopOpacity="0.32" />
              <stop offset="55%" stopColor="#7C3AED" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0D0620" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="bot3Skin" cx="42%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#F5C9A6" />
              <stop offset="60%" stopColor="#DFA178" />
              <stop offset="100%" stopColor="#B8764E" />
            </radialGradient>

            <radialGradient id="bot3SkinShadow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#D6946B" />
              <stop offset="100%" stopColor="#9E5E3A" />
            </radialGradient>

            <linearGradient id="bot3Hair" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2C223B" />
              <stop offset="55%" stopColor="#171124" />
              <stop offset="100%" stopColor="#0D0916" />
            </linearGradient>

            <linearGradient id="bot3Hoodie" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="50%" stopColor="#5B21B6" />
              <stop offset="100%" stopColor="#3B1280" />
            </linearGradient>

            <linearGradient id="bot3Chair" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#33235C" />
              <stop offset="100%" stopColor="#191033" />
            </linearGradient>

            <linearGradient id="bot3Desk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D1D56" />
              <stop offset="100%" stopColor="#170D33" />
            </linearGradient>

            <linearGradient id="bot3ScreenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#060B19" />
            </linearGradient>

            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#05020F" floodOpacity="0.55" />
            </filter>

            <filter id="screenGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={screenAccent} floodOpacity="0.65" />
            </filter>
          </defs>

          {/* Background Wall & Window Ambience */}
          <rect width="400" height="250" fill="url(#bot3RoomGlow)" />
          <ellipse cx="200" cy="236" rx="165" ry="12" fill="#060312" opacity="0.7" />

          {/* Studio Night Lamp / Moon Window */}
          <rect x="24" y="22" width="66" height="84" rx="12" fill="#12092A" stroke="#4C1D95" strokeWidth="1.5" opacity="0.75" />
          {isSleeping ? (
            <>
              <circle cx="46" cy="48" r="10" fill="#FDE68A" opacity="0.85" />
              <circle cx="50" cy="46" r="9" fill="#12092A" />
              <circle cx="72" cy="38" r="1.5" fill="#FDE68A" opacity="0.8" />
              <circle cx="68" cy="64" r="1.2" fill="#E9D5FF" opacity="0.7" />
              <circle cx="40" cy="76" r="1.3" fill="#E9D5FF" opacity="0.6" />
            </>
          ) : (
            <>
              <path d="M32 82 L44 64 L56 72 L70 46 L82 54" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
              <circle cx="70" cy="46" r="2.5" fill="#10B981" opacity="0.85" />
            </>
          )}

          {/* Ergonomic Chair Backrest (behind character) */}
          <g filter="url(#softShadow)">
            <rect
              x="92"
              y={isResting ? '64' : '68'}
              width="78"
              height="108"
              rx="26"
              fill="url(#bot3Chair)"
              stroke="#6D28D9"
              strokeWidth="2"
              transform={isResting ? 'rotate(-7 130 130)' : undefined}
            />
            <rect
              x="104"
              y={isResting ? '78' : '82'}
              width="54"
              height="24"
              rx="11"
              fill="#4C1D95"
              opacity="0.65"
              transform={isResting ? 'rotate(-7 130 130)' : undefined}
            />
            {/* Chair Stand */}
            <rect x="125" y="175" width="12" height="52" rx="4" fill="#1E133E" />
            <path d="M98 228 L131 218 L164 228" stroke="#312061" strokeWidth="6" strokeLinecap="round" fill="none" />
          </g>

          {/* Character (Young man with short hair, Pixar-3D shaded) */}
          <g
            className={bodyAnimClass}
            transform={
              isSleeping
                ? 'translate(8, 22) rotate(13 138 145)'
                : isResting
                ? 'translate(-4, 2) rotate(-5 138 145)'
                : isBuying || isSelling
                ? 'translate(4, -2)'
                : undefined
            }
          >
            {/* Torso / 3D Hoodie */}
            <g filter="url(#softShadow)">
              <path
                d="M94 176 C94 134, 110 120, 138 120 C166 120, 182 136, 182 176 Z"
                fill="url(#bot3Hoodie)"
              />
              {/* Hoodie Rim Highlight & Collar */}
              <path
                d="M112 124 Q138 136 164 124"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.7"
              />
              {/* SALOMA chest emblem */}
              <circle cx="155" cy="148" r="5" fill="#10B981" opacity="0.9" />
            </g>

            {/* Neck */}
            <rect x="129" y="102" width="18" height="22" rx="8" fill="url(#bot3SkinShadow)" />

            {/* Head Group */}
            <g className={isWatching || isBuying || isSelling ? 'bot3-head-nod' : undefined}>
              {/* Back Ear */}
              <ellipse cx="110" cy="83" rx="6.5" ry="9" fill="url(#bot3SkinShadow)" />

              {/* Head Sphere (3D Pixar Volume) */}
              <ellipse cx="140" cy="80" rx="31" ry="33" fill="url(#bot3Skin)" filter="url(#softShadow)" />

              {/* Subtle Cheek Blush */}
              <ellipse cx="127" cy="90" rx="6" ry="3.2" fill="#F43F5E" opacity={isSelling ? '0.32' : '0.16'} />
              <ellipse cx="158" cy="90" rx="5.5" ry="3.2" fill="#F43F5E" opacity={isSelling ? '0.32' : '0.16'} />

              {/* Front Ear */}
              <ellipse cx="109" cy="84" rx="5.5" ry="8" fill="url(#bot3Skin)" />
              <path d="M108 80 Q111 84 108 88" stroke="#9E5E3A" strokeWidth="1.5" fill="none" strokeLinecap="round" />

              {/* Short Sculpted Dark Hair */}
              <path
                d="M107 78 C105 53, 122 40, 144 42 C164 43, 173 56, 171 69 C165 61, 152 58, 136 60 C123 61, 117 69, 114 80 Z"
                fill="url(#bot3Hair)"
              />
              {/* Hair 3D Specular Sheen */}
              <path
                d="M122 50 Q142 44 159 53"
                fill="none"
                stroke="#6D5894"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.55"
              />

              {/* Eyebrows */}
              <path
                d={isSleeping ? 'M126 69 Q132 71 138 69' : isSelling ? 'M125 63 Q132 59 138 63' : 'M126 65 Q132 63 138 65'}
                stroke="#1E1630"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={isSleeping ? 'M148 69 Q154 71 160 69' : isSelling ? 'M148 63 Q154 59 160 63' : 'M148 65 Q154 63 160 65'}
                stroke="#1E1630"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              />

              {/* Eyes (Expressive Pixar Eyes with Specular Highlights or Closed Sleeping Eyelids) */}
              {isSleeping ? (
                <>
                  <path d="M125 76 Q132 81 139 76" stroke="#1E1630" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                  <path d="M148 76 Q155 81 162 76" stroke="#1E1630" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                </>
              ) : (
                <g className="bot3-blink">
                  {/* Left Eye */}
                  <ellipse cx="132" cy="76" rx="5.5" ry="6.4" fill="#FFFFFF" />
                  <circle cx="134" cy="76.5" r="3.5" fill="#2A1C15" />
                  <circle cx="134.5" cy="76.5" r="1.8" fill="#0B0712" />
                  <circle cx="135.8" cy="74.6" r="1.4" fill="#FFFFFF" />

                  {/* Right Eye */}
                  <ellipse cx="154" cy="76" rx="5.3" ry="6.2" fill="#FFFFFF" />
                  <circle cx="156" cy="76.5" r="3.4" fill="#2A1C15" />
                  <circle cx="156.5" cy="76.5" r="1.7" fill="#0B0712" />
                  <circle cx="157.8" cy="74.6" r="1.35" fill="#FFFFFF" />
                </g>
              )}

              {/* Cute 3D Nose */}
              <path
                d="M145 77 Q150 84 144 87"
                fill="none"
                stroke="#B8764E"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Expressive Mouth */}
              {isSelling ? (
                /* Big joyful smile */
                <g>
                  <path d="M133 93 Q146 105 158 93 Z" fill="#7F1D1D" />
                  <path d="M135 93.5 Q146 97 156 93.5 Z" fill="#FFFFFF" />
                  <path d="M133 93 Q146 105 158 93" fill="none" stroke="#8C482B" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              ) : isBuying ? (
                /* Confident happy smile */
                <path d="M134 94 Q146 102 157 93" fill="none" stroke="#78350F" strokeWidth="2.4" strokeLinecap="round" />
              ) : isResting ? (
                /* Relaxed cozy smile */
                <path d="M136 94 Q146 99 154 94" fill="none" stroke="#8C482B" strokeWidth="2.1" strokeLinecap="round" />
              ) : isSleeping ? (
                /* Peaceful sleeping mouth */
                <ellipse cx="145" cy="96" rx="3.2" ry="2.2" fill="#9E5E3A" />
              ) : (
                /* Focused slight smile */
                <path d="M137 95 Q146 98 154 94" fill="none" stroke="#8C482B" strokeWidth="2" strokeLinecap="round" />
              )}
            </g>

            {/* Arms & Hands based on State */}
            {isResting ? (
              /* Holding Steaming Coffee Mug */
              <g>
                <path
                  d="M148 134 C162 146, 175 150, 185 144"
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <circle cx="187" cy="143" r="7.5" fill="url(#bot3Skin)" />
                {/* Coffee Mug */}
                <rect x="184" y="128" width="18" height="20" rx="4" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
                <path d="M202 133 C208 133, 208 143, 202 143" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                <rect x="186" y="130" width="14" height="3.5" rx="1.5" fill="#78350F" />
                {/* Animated Steam */}
                <path d="M190 124 Q187 117 192 112" stroke="#E9D5FF" strokeWidth="1.8" fill="none" strokeLinecap="round" className="bot3-steam-1" />
                <path d="M197 125 Q200 118 195 112" stroke="#FDE68A" strokeWidth="1.8" fill="none" strokeLinecap="round" className="bot3-steam-2" />
              </g>
            ) : isSleeping ? (
              /* Arms folded on desk supporting sleeping posture */
              <g>
                <path d="M146 135 C166 146, 182 158, 198 158" fill="none" stroke="#6D28D9" strokeWidth="14" strokeLinecap="round" />
                <circle cx="200" cy="158" r="7" fill="url(#bot3Skin)" />
              </g>
            ) : (
              /* Working on Computer — Reaching / Pressing BUY or SELL or Watching Curve */
              <g className={isBuying || isSelling ? 'bot3-key-tap' : undefined}>
                <path
                  d={
                    isBuying || isSelling
                      ? 'M148 134 C168 144, 196 154, 224 162'
                      : 'M146 136 C164 148, 184 160, 212 164'
                  }
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <circle cx={isBuying || isSelling ? '226' : '214'} cy={isBuying || isSelling ? '162' : '164'} r="7.5" fill="url(#bot3Skin)" />
              </g>
            )}
          </g>

          {/* Desk Surface (Foreground) */}
          <g filter="url(#softShadow)">
            <rect x="44" y="168" width="322" height="14" rx="6" fill="url(#bot3Desk)" stroke="#7C3AED" strokeWidth="1.4" />
            <rect x="64" y="182" width="12" height="54" rx="4" fill="#170E33" />
            <rect x="330" y="182" width="12" height="54" rx="4" fill="#170E33" />
          </g>

          {/* Keyboard on Desk with glowing BUY / SELL action keys */}
          <g>
            <polygon points="194,168 258,168 264,162 200,162" fill="#1E1B4B" stroke="#6D28D9" strokeWidth="1" />
            <rect x="204" y="163" width="18" height="4" rx="1" fill={isBuying ? '#10B981' : '#334155'} />
            <rect x="226" y="163" width="18" height="4" rx="1" fill={isSelling ? '#34D399' : '#334155'} />
          </g>

          {/* Desktop Monitor / Computer Screen */}
          <g filter="url(#screenGlow)">
            {/* Monitor Stand */}
            <rect x="304" y="148" width="14" height="20" rx="3" fill="#312E81" />
            <rect x="286" y="164" width="48" height="5" rx="2.5" fill="#4C1D95" />

            {/* Monitor Frame */}
            <rect x="242" y="56" width="128" height="94" rx="10" fill="#1E103E" stroke="#8B5CF6" strokeWidth="2.5" />
            <rect x="249" y="63" width="114" height="78" rx="6" fill="url(#bot3ScreenGrad)" />

            {/* Live Monitor Content */}
            {isSleeping ? (
              <g>
                <text x="306" y="96" textAnchor="middle" fill="#FBBF24" fontSize="14" fontWeight="900" fontFamily="monospace">
                  {mood === 'SLEEP_30M' ? 'DORT 30m' : 'DORT 00:00H'}
                </text>
                <text x="306" y="116" textAnchor="middle" fill="#FDE68A" fontSize="12" fontWeight="800" fontFamily="monospace">
                  {countdownText || '00:00'}
                </text>
                <text x="306" y="131" textAnchor="middle" fill="#94A3B8" fontSize="7" fontWeight="700">
                  RÉVEIL AUTO
                </text>
              </g>
            ) : isOff ? (
              <g>
                <text x="306" y="102" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="900" fontFamily="monospace">
                  BOT 3 OFF
                </text>
                <text x="306" y="118" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="700">
                  EN ATTENTE
                </text>
              </g>
            ) : (
              <g>
                {/* Mini Live Chart on Computer Monitor */}
                <path
                  d={
                    isBuying || isSelling
                      ? 'M256 124 L272 114 L286 118 L302 98 L318 102 L338 80 L356 74'
                      : 'M256 116 L274 110 L292 118 L312 104 L330 108 L354 94'
                  }
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Candlesticks inside computer monitor */}
                <rect x="266" y="104" width="5" height="15" rx="1" fill="#10B981" />
                <rect x="280" y="108" width="5" height="12" rx="1" fill="#EF4444" />
                <rect x="294" y="96" width="5" height="18" rx="1" fill="#10B981" />
                <rect x="308" y="88" width="5" height="20" rx="1" fill="#10B981" />

                {/* Interactive BUY / SELL Button on Computer Screen */}
                <rect
                  x="257"
                  y="124"
                  width="44"
                  height="13"
                  rx="3.5"
                  fill={isBuying ? '#10B981' : '#064E3B'}
                  stroke="#34D399"
                  strokeWidth="1"
                />
                <text x="279" y="133" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                  BUY
                </text>

                <rect
                  x="309"
                  y="124"
                  width="44"
                  height="13"
                  rx="3.5"
                  fill={isSelling ? '#10B981' : '#7F1D1D'}
                  stroke={isSelling ? '#6EE7B7' : '#F87171'}
                  strokeWidth="1"
                />
                <text x="331" y="133" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                  SELL
                </text>

                <text x="306" y="75" textAnchor="middle" fill="#E9D5FF" fontSize="8" fontWeight="900" fontFamily="monospace">
                  {activeSymbol ? `${activeSymbol}/USDT` : 'SCAN 1m'}
                </text>
              </g>
            )}
          </g>

          {/* Sleeping ZZZ Floating Particles */}
          {isSleeping && (
            <g>
              <text x="166" y="54" fill="#FDE68A" fontSize="15" fontWeight="900" className="bot3-zzz-1">
                Z
              </text>
              <text x="180" y="42" fill="#C4B5FD" fontSize="12" fontWeight="900" className="bot3-zzz-2">
                z
              </text>
              <text x="193" y="30" fill="#FBBF24" fontSize="17" fontWeight="900" className="bot3-zzz-3">
                Z
              </text>
            </g>
          )}

          {/* Celebratory Profit Glints on SELL */}
          {isSelling && (
            <g>
              <circle cx="182" cy="54" r="3" fill="#34D399" />
              <circle cx="198" cy="68" r="2.2" fill="#FDE68A" />
              <text x="186" y="46" fill="#34D399" fontSize="11" fontWeight="900">
                +PROFIT!
              </text>
            </g>
          )}

          {/* BUY Action Indicator */}
          {isBuying && (
            <text x="185" y="46" fill="#10B981" fontSize="11" fontWeight="900">
              BUY LIMIT!
            </text>
          )}
        </svg>
      </div>
    </div>
  );
};
