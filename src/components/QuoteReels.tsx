import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play, Quote, Sparkles } from 'lucide-react'
import './quote-reels.css'

type QuoteItem = { text: string; author: string; category: string }

const quotes: QuoteItem[] = [
  { text: 'The future changes when you give today a clear direction.', author: 'DreamBig', category: 'PURPOSE' },
  { text: 'You do not need a perfect plan. You need the courage to begin.', author: 'DreamBig', category: 'COURAGE' },
  { text: 'Small steps, repeated with patience, become remarkable progress.', author: 'DreamBig', category: 'GROWTH' },
  { text: 'Your pace is allowed to be different. Keep moving forward.', author: 'DreamBig', category: 'CONFIDENCE' },
  { text: 'Discipline is choosing the dream even on an ordinary day.', author: 'DreamBig', category: 'DISCIPLINE' },
  { text: 'Let your curiosity be louder than your fear of getting it wrong.', author: 'DreamBig', category: 'LEARNING' },
  { text: 'A kind word can become the beginning of someone’s better day.', author: 'DreamBig', category: 'KINDNESS' },
  { text: 'You are building a life, not racing against someone else’s clock.', author: 'DreamBig', category: 'PATIENCE' },
  { text: 'Make room for the person you are becoming.', author: 'DreamBig', category: 'POTENTIAL' },
  { text: 'Progress starts when excuses stop making your decisions.', author: 'DreamBig', category: 'ACTION' },
  { text: 'Protect your focus. Give your best energy to what matters.', author: 'DreamBig', category: 'FOCUS' },
  { text: 'Every expert was once a beginner who kept asking questions.', author: 'DreamBig', category: 'LEARNING' },
]

export default function QuoteReels() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const current = quotes[active]
  const next = () => { setActive(value => (value + 1) % quotes.length); setProgress(0) }
  const previous = () => { setActive(value => (value - 1 + quotes.length) % quotes.length); setProgress(0) }

  useEffect(() => {
    if (!playing) return
    const started = Date.now()
    const duration = 7000
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started
      setProgress(Math.min(100, elapsed / duration * 100))
      if (elapsed >= duration) {
        setActive(value => (value + 1) % quotes.length)
        setProgress(0)
      }
    }, 80)
    return () => window.clearInterval(tick)
  }, [active, playing])

  const count = useMemo(() => String(active + 1).padStart(2, '0'), [active])

  return <section className="quote-reels-section" aria-label="Inspirational quote reels">
    <div className="quote-reels-heading">
      <div><div className="eyebrow"><span className="eyebrow-line"/> A MOMENT OF INSPIRATION</div><h2>Quote <span>reels.</span></h2></div>
      <p>Swipe, pause, and find a thought worth keeping.</p>
    </div>
    <div className="quote-reels-layout">
      <div className="quote-reel-card" key={active}>
        <div className="quote-reel-progress" aria-label={`Quote ${active + 1} of ${quotes.length}`}>
          {quotes.map((quote, index) => <span key={quote.text} className="quote-reel-track"><i style={{ width: index < active ? '100%' : index === active ? `${progress}%` : '0%' }}/></span>)}
        </div>
        <div className="quote-reel-top"><span><Sparkles size={14}/> DREAMBIG DAILY</span><span>{count} / {String(quotes.length).padStart(2, '0')}</span></div>
        <div className="quote-reel-content" aria-live="polite">
          <span className="quote-reel-category">{current.category}</span>
          <Quote className="quote-reel-mark" size={30}/>
          <h3>{current.text}</h3>
          <div className="quote-reel-author"><span className="quote-reel-avatar">D</span><span><strong>{current.author}</strong><small>A thought for your journey</small></span></div>
        </div>
        <div className="quote-reel-bottom"><span>TAKE WHAT YOU NEED. KEEP MOVING.</span><span className="quote-reel-spark">✳</span></div>
      </div>
      <div className="quote-reel-controls">
        <div className="quote-reel-counter"><strong>{count}</strong><span>of {String(quotes.length).padStart(2, '0')} thoughts</span></div>
        <div className="quote-reel-buttons">
          <button type="button" onClick={previous} aria-label="Previous quote"><ArrowLeft size={18}/></button>
          <button type="button" className="quote-reel-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause reels' : 'Play reels'}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
          <button type="button" onClick={next} aria-label="Next quote"><ArrowRight size={18}/></button>
        </div>
        <div className="quote-reel-hint">Auto-advances every 7 seconds. Use arrows or swipe on mobile.</div>
        <div className="quote-reel-dots">{quotes.map((quote, index) => <button key={quote.text} type="button" aria-label={`Go to quote ${index + 1}`} aria-current={index === active ? 'step' : undefined} onClick={() => { setActive(index); setProgress(0) }}/>)}</div>
      </div>
    </div>
  </section>
}
