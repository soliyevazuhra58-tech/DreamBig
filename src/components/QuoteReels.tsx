import { useMemo, useState } from 'react'
import { Heart, Sparkles } from 'lucide-react'
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
const STORAGE_KEY = 'dreambig-reels-likes-v1'
export default function QuoteReels() {
  const [liked, setLiked] = useState<boolean[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return quotes.map((_, i) => Boolean(saved[i])) }
    catch { return quotes.map(() => false) }
  })
  const totalLikes = useMemo(() => liked.filter(Boolean).length, [liked])
  function toggleLike(index: number) {
    setLiked(previous => {
      const next = previous.map((value, i) => i === index ? !value : value)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }
  return <section className="quote-reels-page" aria-label="Inspirational vertical reels">
    <div className="reels-topbar"><div><span className="eyebrow"><span className="eyebrow-line"/> DREAMBIG DAILY</span><h1>Reels <span>for your mind.</span></h1></div><span className="reels-like-total"><Heart size={14} fill="currentColor"/> {totalLikes} liked</span></div>
    <div className="quote-reels-feed">
      {quotes.map((item, index) => <article className="quote-reel-screen" key={item.category}>
        <div className="reel-screen-bg" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></div>
        <div className="reel-screen-content">
          <div className="reel-screen-meta"><span><Sparkles size={14}/> DREAMBIG DAILY</span><span>{item.category}</span></div>
          <div className="reel-screen-quote"><span className="reel-quote-mark">“</span><h2>{item.text}</h2><p>— {item.author}</p></div>
          <div className="reel-screen-footer"><span>TAKE WHAT YOU NEED. KEEP MOVING.</span><button type="button" className={liked[index] ? 'reel-like-button liked' : 'reel-like-button'} onClick={() => toggleLike(index)} aria-pressed={liked[index]} aria-label={liked[index] ? 'Unlike this reel' : 'Like this reel'}><Heart size={23} fill={liked[index] ? 'currentColor' : 'none'}/><b>{liked[index] ? 'Liked' : 'Like'}</b></button></div>
        </div>
        <span className="reel-index">{String(index + 1).padStart(2, '0')} / {String(quotes.length).padStart(2, '0')}</span>
      </article>)}
    </div>
  </section>
}
