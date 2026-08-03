import brandOverlay from '@/assets/branding/BLACK.png'
import lpMonogram from '@/assets/branding/LP_Gold.png'

type AuthBrandPanelProps = {
  step?: 1 | 2
  totalSteps?: 1 | 2
  variant?: 'login' | 'signup'
}

export function AuthBrandPanel({
  step = 1,
  totalSteps = 2,
  variant = 'login',
}: AuthBrandPanelProps) {
  const isSignup = variant === 'signup'

  return (
    <section className="relative hidden h-svh w-[45%] shrink-0 flex-col overflow-hidden md:flex">
      <div className="relative z-10 p-12">
        {isSignup ? (
          <span className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tighter text-[var(--color-gold)]">
            LP
          </span>
        ) : (
          <img
            src={lpMonogram}
            alt="LocalPRO"
            className="h-14 w-auto object-contain object-left"
          />
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 text-center">
        <div className="max-w-md text-left md:text-center">
          <h1
            className={`mb-4 font-[family-name:var(--font-display)] font-bold text-[var(--color-gold)] uppercase tracking-widest ${
              isSignup ? 'text-2xl' : 'text-[28px] text-[var(--color-white)] normal-case tracking-normal'
            }`}
          >
            LocalPRO Hub
          </h1>
          {!isSignup ? <div className="mb-4 h-px w-12 bg-[var(--color-gold)] md:mx-auto" /> : null}
          <p
            className={`leading-relaxed ${
              isSignup
                ? 'text-base text-white/80'
                : 'text-[14px] tracking-widest text-[var(--color-text-secondary)] uppercase'
            }`}
          >
            {isSignup
              ? 'Exclusive portal for Local Pro Realty agents. Professionalism in every frame.'
              : 'Command center for Local Pro Realty'}
          </p>
          {isSignup ? (
            <div className="mt-12 flex items-center justify-center gap-4 md:justify-center">
              <div className="h-px w-8 bg-[var(--color-gold)]/30" />
              <span className="text-[12px] tracking-widest text-[var(--color-gold)] uppercase">
                Step {String(step).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
              </span>
              <div className="h-px w-8 bg-[var(--color-gold)]/30" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 p-12">
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Local Pro Real Estate · Dallas, TX
        </p>
      </div>

      {!isSignup ? (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-[1] h-1/2 opacity-20 grayscale mix-blend-overlay">
          <img
            src={brandOverlay}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        </div>
      ) : null}
    </section>
  )
}
