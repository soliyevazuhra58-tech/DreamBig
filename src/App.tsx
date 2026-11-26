import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, BadgeCheck, Clock3, Flame, Globe2, Heart, LogOut, MessageCircle, Plus, Send, ShieldCheck, Sparkles, Target, UserRound, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Profile = { id: string; first_name: string; last_name: string; username: string; card_id: string; date_of_birth: string; gender: string; created_at: string }
type Post = { id: string; message: string; created_at: string; user_id: string; first_name: string; username: string; card_id: string }

const samplePosts: Post[] = [
  { id: 'sample-1', user_id: 'a', message: 'Your future is built by what you do today, not what you plan to do tomorrow.', created_at: new Date(Date.now() - 1000 * 60 * 34).toISOString(), first_name: 'Amina', username: 'aminavibes', card_id: 'DB-A8F31C2D' },
  { id: 'sample-2', user_id: 'b', message: 'Small progress is still progress. Keep showing up for the dream you believe in.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), first_name: 'Jasur', username: 'jasurcreates', card_id: 'DB-71BC902A' },
  { id: 'sample-3', user_id: 'c', message: 'You do not need to have it all figured out. You just need the courage to begin.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), first_name: 'Madina', username: 'madina.dreams', card_id: 'DB-2D9E5A10' },
]

function timeAgo(value: string) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>(samplePosts)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [lastPostAt, setLastPostAt] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data as Profile | null)
    if (!data) setShowProfile(true)
    if (data) {
      const { data: recent } = await supabase.from('posts').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      setLastPostAt(recent?.created_at ?? null)
    }
  }, [])

  const loadPosts = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('public_feed').select('*').order('created_at', { ascending: false }).limit(50)
    if (!error && data) setPosts(data as Post[])
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) void loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) void loadProfile(next.user.id)
      else { setProfile(null); setLastPostAt(null) }
    })
    void loadPosts()
    return () => listener.subscription.unsubscribe()
  }, [loadPosts, loadProfile])

  const cooldownMs = lastPostAt ? Math.max(0, 86400000 - (Date.now() - new Date(lastPostAt).getTime())) : 0
  const canPost = !lastPostAt || cooldownMs <= 0
  const cooldownText = useMemo(() => {
    if (!lastPostAt || canPost) return 'Ready when you are'
    const hours = Math.floor(cooldownMs / 3600000)
    const mins = Math.floor((cooldownMs % 3600000) / 60000)
    return `Next post in ${hours}h ${mins}m`
  }, [lastPostAt, canPost, cooldownMs])

  async function handleAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setNotice('')
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email'))
    const password = String(fd.get('password'))
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setNotice(result.error.message)
    else if (authMode === 'signup' && !result.data.session) setNotice('Check your email to confirm your account, then sign in.')
    else { setShowAuth(false); setShowProfile(true) }
    setBusy(false)
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !session) return
    setBusy(true); setNotice('')
    const fd = new FormData(e.currentTarget)
    const values = {
      id: session.user.id,
      first_name: String(fd.get('first_name')).trim(),
      last_name: String(fd.get('last_name')).trim(),
      username: String(fd.get('username')).replace(/^@/, '').trim().toLowerCase(),
      date_of_birth: String(fd.get('date_of_birth')),
      gender: String(fd.get('gender')),
    }
    const { error } = await supabase.from('profiles').insert(values)
    if (error) setNotice(error.message)
    else { await loadProfile(session.user.id); setShowProfile(false); setNotice('Your DreamID is ready. Welcome to DreamBig!') }
    setBusy(false)
  }

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !profile || !canPost || !message.trim()) return
    setBusy(true); setNotice('')
    const { error } = await supabase.from('posts').insert({ user_id: profile.id, message: message.trim() })
    if (error) setNotice(error.message)
    else {
      setMessage(''); setShowComposer(false)
      await loadPosts(); await loadProfile(profile.id)
      setNotice('Your thought is live. Keep inspiring!')
    }
    setBusy(false)
  }

  async function signOut() {
    await supabase?.auth.signOut()
    setShowProfile(false)
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Sparkles size={19} /></span><span>dream<span className="brand-accent">big</span><i>.</i></span></a>
      <nav className="nav-links"><a className="active" href="#feed">Explore</a><a href="#how">How it works</a><a href="#about">About</a></nav>
      <div className="top-actions">
        {profile ? <button className="profile-chip" onClick={() => setShowProfile(true)}><span className="mini-avatar">{profile.first_name[0]}</span><span>@{profile.username}</span></button> : <button className="btn btn-ghost" onClick={() => { setAuthMode('signin'); setShowAuth(true) }}>Log in</button>}
        <button className="btn btn-primary top-cta" onClick={() => profile ? setShowComposer(true) : (setAuthMode('signup'), setShowAuth(true))}>{profile ? <><Plus size={16}/> Write a thought</> : <>Join DreamBig <ArrowUpRight size={16}/></>}</button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot"/> A COMMUNITY BUILT ON POSSIBILITY</div>
          <h1>Your dreams deserve<br/>to be <span className="gradient-text">seen.</span></h1>
          <p className="hero-sub">One thought. One moment. A thousand possibilities.<br className="desktop-break"/> Share a little motivation and make someone’s day.</p>
          <div className="hero-buttons"><button className="btn btn-primary btn-large" onClick={() => profile ? setShowComposer(true) : (setAuthMode('signup'), setShowAuth(true))}>Share your first thought <ArrowRight size={17}/></button><a className="text-link" href="#feed">Explore the feed <ArrowUpRight size={16}/></a></div>
          <div className="hero-proof"><div className="avatar-stack"><span>A</span><span>J</span><span>M</span><span>+</span></div><div><strong>A space for every dreamer</strong><small>Read. Reflect. Rise together.</small></div></div>
        </div>
        <div className="hero-art" aria-label="DreamBig inspiration artwork">
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/>
          <div className="art-glow"/>
          <div className="floating-card card-main"><div className="card-top"><span className="tiny-star"><Sparkles size={14}/></span><span>DAILY REMINDER</span><span className="card-dots">•••</span></div><div className="quote-mark">“</div><h3>Great things<br/>start with<br/><em>one brave step.</em></h3><div className="card-bottom"><span className="card-avatar">D</span><span><b>DreamBig</b><small>Believe in your next.</small></span><Heart size={17}/></div></div>
          <div className="float-pill pill-top"><span className="pill-icon"><Flame size={15}/></span> Your next chapter starts now</div>
          <div className="float-pill pill-bottom"><span className="online-dot"/> Every dream has a place here</div>
          <div className="spark spark-a">✳</div><div className="spark spark-b">✧</div><div className="spark spark-c">✳</div>
        </div>
        <div className="hero-scroll"><span/> SCROLL TO GET INSPIRED</div>
      </section>

      <section className="stats-strip" id="about"><div><strong>01</strong><span>thought every 24 hours</span></div><i/><div><strong>∞</strong><span>ways to inspire</span></div><i/><div><strong>01</strong><span>community, worldwide</span></div></section>

      <section className="feed-section" id="feed">
        <div className="section-heading"><div><div className="eyebrow"><span className="pulse-dot"/> THE COMMUNITY</div><h2>A little inspiration<br className="mobile-break"/> goes a <span className="gradient-text">long way.</span></h2></div><div className="feed-side"><p>Real thoughts from dreamers around the world. Take a moment, find your spark.</p><span className="live-label"><span className="online-dot"/> LIVE COMMUNITY FEED</span></div></div>
        <div className="feed-toolbar"><div className="feed-tab"><Globe2 size={16}/> Latest thoughts <span>{posts.length}</span></div><div className="feed-note"><ShieldCheck size={15}/> One post per person, every 24 hours</div></div>
        <div className="post-grid">{posts.map((post, i) => <article className="post-card" key={post.id}><div className="post-card-head"><div className="post-user"><div className={`post-avatar avatar-${i % 4}`}>{post.first_name?.[0] ?? 'D'}</div><div><strong>{post.first_name}</strong><span>@{post.username}</span></div></div><span className="post-time">{timeAgo(post.created_at)}</span></div><p className="post-message">{post.message}</p><div className="post-card-foot"><span className="card-id"><BadgeCheck size={13}/> {post.card_id}</span><span className="inspire-tag"><Sparkles size={13}/> Keep inspiring</span></div></article>)}</div>
        {!isSupabaseConfigured && <div className="demo-note"><Sparkles size={15}/> Preview mode · Connect Supabase to load the live community feed and publish posts.</div>}
        <div className="feed-bottom"><span>Every great journey begins with a thought.</span><button className="btn btn-outline" onClick={() => profile ? setShowComposer(true) : (setAuthMode('signup'), setShowAuth(true))}>Add your voice <ArrowUpRight size={16}/></button></div>
      </section>

      <section className="how-section" id="how"><div className="eyebrow"><span className="pulse-dot"/> SIMPLE BY DESIGN</div><h2>Three steps. <span className="gradient-text">Big impact.</span></h2><div className="steps"><div className="step"><span className="step-num">01</span><div className="step-icon"><UserRound/></div><h3>Create your DreamID</h3><p>Set up your identity and get your own unique CardID. Your journey starts here.</p></div><div className="step"><span className="step-num">02</span><div className="step-icon"><MessageCircle/></div><h3>Share one thought</h3><p>Write a quote, a lesson, or a few words that might inspire someone today.</p></div><div className="step"><span className="step-num">03</span><div className="step-icon"><Target/></div><h3>Inspire the world</h3><p>Your words join a public feed where anyone can pause, read, and feel encouraged.</p></div></div></section>

      <section className="closing-cta"><div className="cta-orb"/><div className="eyebrow"><span className="pulse-dot"/> YOUR STORY STARTS HERE</div><h2>Think bigger.<br/><span className="gradient-text">Start today.</span></h2><p>The world could use the thought only you can share.</p><button className="btn btn-primary btn-large" onClick={() => profile ? setShowComposer(true) : (setAuthMode('signup'), setShowAuth(true))}>Become a dreamer <ArrowRight size={17}/></button></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><Sparkles size={17}/></span><span>dream<span className="brand-accent">big</span><i>.</i></span></a><span>© 2026 DreamBig. Built for dreamers.</span><a href="#feed">Back to top ↑</a></footer>

    {showAuth && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowAuth(false)}><section className="modal"><button className="modal-close" onClick={() => setShowAuth(false)}><X/></button><div className="modal-icon"><Sparkles/></div><div className="eyebrow">WELCOME TO DREAMBIG</div><h2>{authMode === 'signup' ? 'Your story starts here.' : 'Welcome back.'}</h2><p className="modal-desc">{authMode === 'signup' ? 'Create an account, then build your DreamID.' : 'Sign in to continue your journey.'}</p><form onSubmit={handleAuth} className="form-stack"><label>Email address<input name="email" type="email" placeholder="you@example.com" required/></label><label>Password<input name="password" type="password" placeholder="At least 6 characters" minLength={6} required/></label><button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Log in'} <ArrowRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}<p className="switch-auth">{authMode === 'signup' ? 'Already have an account?' : 'New to DreamBig?'} <button onClick={() => {setAuthMode(authMode === 'signup' ? 'signin' : 'signup');setNotice('')}}>{authMode === 'signup' ? 'Log in' : 'Create account'}</button></p></section></div>}

    {showProfile && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowProfile(false)}><section className="modal"><button className="modal-close" onClick={() => setShowProfile(false)}><X/></button>{profile ? <><div className="profile-large">{profile.first_name[0]}</div><div className="eyebrow">YOUR DREAMID</div><h2>{profile.first_name} {profile.last_name}</h2><p className="modal-desc">@{profile.username}</p><div className="id-display"><span>YOUR CARD ID</span><strong>{profile.card_id}</strong></div><p className="private-note"><ShieldCheck size={15}/> Your birthday and gender are private.</p><button className="btn btn-outline btn-full" onClick={signOut}><LogOut size={16}/> Sign out</button></> : <><div className="modal-icon"><UserRound/></div><div className="eyebrow">ONE LAST STEP</div><h2>Create your DreamID</h2><p className="modal-desc">Your unique CardID will be generated automatically.</p><form onSubmit={saveProfile} className="form-stack"><div className="form-row"><label>First name<input name="first_name" required maxLength={40} placeholder="First name"/></label><label>Last name<input name="last_name" required maxLength={60} placeholder="Last name"/></label></div><label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" placeholder="@yourname"/></label><label>Date of birth<input name="date_of_birth" type="date" required max={new Date().toISOString().slice(0,10)}/></label><label>Gender<select name="gender" required defaultValue=""><option value="" disabled>Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><p className="private-note"><ShieldCheck size={15}/> Birthday, surname and gender are private. Only first name, username and CardID appear publicly.</p><button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Creating…' : 'Create my DreamID'} <ArrowRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</>}</section></div>}

    {showComposer && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowComposer(false)}><section className="modal"><button className="modal-close" onClick={() => setShowComposer(false)}><X/></button><div className="modal-icon"><Send/></div><div className="eyebrow">YOUR DAILY THOUGHT</div><h2>Put good into the world.</h2><p className="modal-desc">One meaningful message every 24 hours. Make yours count.</p><form className="form-stack" onSubmit={publish}><label>Your thought<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="A thought that could inspire someone…" required/></label><div className="composer-meta"><span>{message.length}/500 characters</span><span><Clock3 size={14}/> {cooldownText}</span></div><button className="btn btn-primary btn-full" disabled={busy || !canPost || !message.trim()}>{busy ? 'Publishing…' : 'Publish to the world'} <ArrowUpRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</section></div>}

    {notice && !showAuth && !showProfile && !showComposer && <div className="toast"><span><BadgeCheck size={16}/></span>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
    {loading && <div className="loading-screen"><span className="brand-mark"><Sparkles/></span><p>Finding your spark…</p></div>}
  </div>
}
