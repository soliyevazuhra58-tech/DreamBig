import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, BadgeCheck, Clock3, Compass, Heart, MessageCircle, Plus, Search, ShieldCheck, Sparkles, Target, UserRound, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Settings, Eye, EyeOff } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Profile = { id: string; first_name: string; last_name: string; username: string; card_id: string; date_of_birth: string; gender: string; country?: string | null; city?: string | null; bio?: string; avatar_url?: string | null; visibility?: Record<string, boolean>; created_at: string }
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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [showProfile, setShowProfile] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [message, setMessage] = useState('')
  const [lastPostAt, setLastPostAt] = useState<string | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [visibility, setVisibility] = useState<Record<string,boolean>>({avatar_url:true,first_name:true,last_name:false,username:true,date_of_birth:false,gender:false,country:false,city:false,bio:true,created_at:true})

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) { setNotice(error.message); return }
    setProfile(data as Profile | null)
    if (data?.visibility) setVisibility(data.visibility)
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
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
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
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [loadPosts, loadProfile])

  const cooldownMs = lastPostAt ? Math.max(0, 86400000 - (clock - new Date(lastPostAt).getTime())) : 0
  const canPost = !lastPostAt || cooldownMs <= 0
  const cooldownText = useMemo(() => {
    if (!lastPostAt || canPost) return 'Ready to share'
    const hours = Math.floor(cooldownMs / 3600000)
    const mins = Math.floor((cooldownMs % 3600000) / 60000)
    return `Next post in ${hours}h ${mins}m`
  }, [lastPostAt, canPost, cooldownMs])
  const visiblePosts = useMemo(() => posts.filter(post => `${post.first_name} @${post.username} ${post.message}`.toLowerCase().includes(search.toLowerCase())), [posts, search])

  async function startDreaming() {
    if (!supabase) { setNotice('Connect Supabase to create your DreamID.'); return }
    setBusy(true); setNotice('')
    const { data: current } = await supabase.auth.getSession()
    if (current.session) {
      setSession(current.session)
      await loadProfile(current.session.user.id)
      setShowProfile(true)
      setBusy(false)
      return
    }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) setNotice(error.message)
    else if (data.session) {
      setSession(data.session)
      await loadProfile(data.session.user.id)
      setShowProfile(true)
    }
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
      country: String(fd.get('country') || '').trim() || null,
      city: String(fd.get('city') || '').trim() || null,
      bio: String(fd.get('bio') || '').trim(),
      visibility,
    }
    const { error } = await supabase.from('profiles').insert(values)
    if (error) setNotice(error.message.includes('username') ? 'This username is already taken. Try another one.' : error.message)
    else {
      await loadProfile(session.user.id)
      setShowProfile(false)
      setNotice('Your DreamID is ready. Welcome to DreamBig!')
    }
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
      setNotice('Your thought is now live.')
    }
    setBusy(false)
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Sparkles size={17}/></span><span>dreambig<span className="brand-period">.</span></span></a>
      <nav className="nav-links"><a href="#feed" className="active">Discover</a><a href="#how">How it works</a></nav>
      <div className="top-actions">
        {profile ? <button className="profile-chip" onClick={() => setShowProfile(true)}><span className="mini-avatar">{profile.first_name[0]}</span>@{profile.username}</button> : <button className="btn btn-quiet" onClick={startDreaming} disabled={busy}>{busy ? 'Please wait…' : 'Create DreamID'}</button>}
        <button className="btn btn-primary top-cta" onClick={() => profile ? setShowComposer(true) : void startDreaming()}>{profile ? <><Plus size={16}/> Share thought</> : <>Get started <ArrowUpRight size={16}/></>}</button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line"/> A PLACE FOR BIG IDEAS</div>
          <h1>Make your<br/>next thought <span>matter.</span></h1>
          <p className="hero-sub">A simple space to share what moves you, discover new perspectives, and keep growing — one thought at a time.</p>
          <div className="hero-buttons"><button className="btn btn-primary btn-large" onClick={() => profile ? setShowComposer(true) : void startDreaming()} disabled={busy}>{profile ? 'Write a thought' : busy ? 'Creating your space…' : 'Create your DreamID'} <ArrowRight size={17}/></button><a className="text-link" href="#feed">Explore community <ArrowUpRight size={16}/></a></div>
          <div className="hero-meta"><span><span className="status-dot"/> Open community</span><span><ShieldCheck size={14}/> Your private details stay private</span></div>
        </div>
        <div className="hero-panel">
          <div className="panel-top"><span>DAILY NOTE</span><span className="panel-date">01 / EVERY DAY</span></div>
          <div className="panel-symbol">“</div>
          <blockquote>Small steps.<br/>Clear mind.<br/><em>Big dreams.</em></blockquote>
          <div className="panel-bottom"><span className="panel-avatar">D</span><span><b>DreamBig</b><small>Make today count.</small></span><Sparkles size={17}/></div>
        </div>
      </section>

      <section className="quick-facts">
        <div><strong>01</strong><span>thought every 24 hours</span></div><div><strong>∞</strong><span>ways to grow</span></div><div><strong>100%</strong><span>your own journey</span></div>
      </section>

      <section className="feed-section" id="feed">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> COMMUNITY</div><h2>Ideas worth<br className="mobile-break"/> <span>sharing.</span></h2></div><p className="section-description">A collection of thoughts from people moving forward. Find one that stays with you.</p></div>
        <div className="feed-toolbar"><div className="feed-label"><Compass size={16}/> Latest thoughts <span>{visiblePosts.length}</span></div><label className="search-box"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thoughts or people"/></label></div>
        <div className="post-grid">{visiblePosts.map((post, i) => <article className="post-card" key={post.id}><div className="post-card-head"><div className="post-user"><div className="post-avatar">{post.first_name?.[0] ?? 'D'}</div><div><strong>{post.first_name}</strong><span>@{post.username}</span></div></div><span className="post-time">{timeAgo(post.created_at)}</span></div><p className="post-message">{post.message}</p><div className="post-card-foot"><span><BadgeCheck size={13}/> {post.card_id}</span><span className="inspire-tag"><Heart size={13}/> Keep going</span></div></article>)}</div>
        {visiblePosts.length === 0 && <div className="empty-state">No thoughts found. Try another search.</div>}
        {!isSupabaseConfigured && <div className="demo-note"><Sparkles size={14}/> Preview mode · Connect Supabase to create DreamIDs and publish live thoughts.</div>}
        <div className="feed-bottom"><span>One thoughtful post. Every 24 hours.</span><button className="btn btn-outline" onClick={() => profile ? setShowComposer(true) : void startDreaming()}>Share your thought <ArrowUpRight size={15}/></button></div>
      </section>

      <section className="how-section" id="how"><div className="eyebrow"><span className="eyebrow-line"/> HOW IT WORKS</div><h2>Simple from the <span>start.</span></h2><div className="steps"><article className="step"><span>01</span><UserRound/><h3>Create your DreamID</h3><p>Choose a username, add a few details, and receive your unique CardID.</p></article><article className="step"><span>02</span><MessageCircle/><h3>Share one thought</h3><p>Post a quote, lesson, or idea that could brighten someone's day.</p></article><article className="step"><span>03</span><Target/><h3>Grow together</h3><p>Explore the community and discover perspectives worth remembering.</p></article></div></section>
      <section className="closing-cta"><div className="eyebrow"><span className="eyebrow-line"/> START WHERE YOU ARE</div><h2>Think clearly.<br/><span>Dream boldly.</span></h2><p>Your next idea might be exactly what someone needs.</p><button className="btn btn-primary btn-large" onClick={() => profile ? setShowComposer(true) : void startDreaming()}>Join DreamBig <ArrowRight size={16}/></button></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><Sparkles size={16}/></span><span>dreambig<span className="brand-period">.</span></span></a><span>© 2026 DreamBig</span><a href="#feed">Back to top ↑</a></footer>

    {showProfile && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowProfile(false)}><section className="modal"><button className="modal-close" onClick={() => setShowProfile(false)}><X/></button>{profile ? <><div className="profile-large">{profile.first_name[0]}</div><div className="eyebrow">YOUR DREAMID</div><h2>{profile.first_name} {profile.last_name}</h2><p className="modal-desc">@{profile.username}</p><div className="dreamid-card"><div className="dreamid-card-head">DREAMBIG <span>IDENTITY CARD</span></div><div className="dreamid-card-name">{visibility.first_name && profile.first_name} {visibility.last_name && profile.last_name}</div>{visibility.username && <p>@{profile.username}</p>}{visibility.date_of_birth && <p>Date of birth · {profile.date_of_birth}</p>}{visibility.gender && <p>Gender · {profile.gender}</p>}{visibility.country && profile.country && <p>Country · {profile.country}</p>}{visibility.city && profile.city && <p>City · {profile.city}</p>}{visibility.bio && profile.bio && <p>{profile.bio}</p>}{visibility.created_at && <small>Member since {new Date(profile.created_at).toLocaleDateString()}</small>}<div className="dreamid-card-foot">MY IDENTITY · MY JOURNEY</div></div><button className="btn btn-outline btn-full" onClick={() => setShowSettings(true)}><Settings size={15}/> DreamID visibility settings</button><p className="private-note"><ShieldCheck size={15}/> Your date of birth and gender are private.</p><p className="account-note">This DreamID stays signed in on this device. Keep this device data safe so you can continue using the same identity.</p></> : <><div className="modal-icon"><UserRound/></div><div className="eyebrow">NO EMAIL NEEDED</div><h2>Create your DreamID</h2><p className="modal-desc">Just a few details. Your unique CardID is generated automatically.</p><form onSubmit={saveProfile} className="form-stack"><div className="form-row"><label>First name<input name="first_name" required maxLength={40} placeholder="First name"/></label><label>Last name<input name="last_name" required maxLength={60} placeholder="Last name"/></label></div><label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" placeholder="yourname"/></label><label>Date of birth<input name="date_of_birth" type="date" required max={new Date().toISOString().slice(0,10)}/></label><label>Gender<select name="gender" required defaultValue=""><option value="" disabled>Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><p className="private-note"><ShieldCheck size={15}/> Your surname, birthday and gender are private. Only first name, username and CardID are public.</p><label>Country<input name="country" maxLength={60} placeholder="Country"/></label><label>City<input name="city" maxLength={60} placeholder="City"/></label><label>About me<textarea name="bio" rows={3} maxLength={180} placeholder="A short introduction…"/></label><p className="account-note">No email or confirmation code. DreamID is saved to this device.</p><button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Creating…' : 'Create my DreamID'} <ArrowRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</>}</section></div>}

    <div>{showSettings && profile && <div className="modal-backdrop"><section className="modal"><button className="modal-close" onClick={() => setShowSettings(false)}><X/></button><div className="eyebrow">PRIVACY CONTROL</div><h2>DreamID visibility</h2><p className="modal-desc">CardID is not displayed. Choose which other details are visible.</p>{Object.entries({avatar_url:"Profile photo",first_name:"First name",last_name:"Last name",username:"Username",date_of_birth:"Date of birth",gender:"Gender",country:"Country",city:"City",bio:"About me",created_at:"Joined date"}).map(([key,label]) => <label className="visibility-row" key={key}><span>{label}</span><button type="button" onClick={async()=>{const next={...visibility,[key]:!visibility[key]};setVisibility(next);const {error}=await supabase!.from("profiles").update({visibility:next}).eq("id",profile.id);if(error)setNotice(error.message)}}>{visibility[key]?<><Eye size={14}/> On</>:<><EyeOff size={14}/> Off</>}</button></label>)}</section></div>}</div>
    {showComposer && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowComposer(false)}><section className="modal"><button className="modal-close" onClick={() => setShowComposer(false)}><X/></button><div className="modal-icon"><MessageCircle/></div><div className="eyebrow">YOUR DAILY THOUGHT</div><h2>Make it meaningful.</h2><p className="modal-desc">One post every 24 hours. Make yours count.</p><form className="form-stack" onSubmit={publish}><label>Your thought<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="Write something worth sharing…" required/></label><div className="composer-meta"><span>{message.length}/500</span><span><Clock3 size={14}/> {cooldownText}</span></div><button className="btn btn-primary btn-full" disabled={busy || !canPost || !message.trim()}>{busy ? 'Publishing…' : 'Publish thought'} <ArrowUpRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</section></div>}

    {notice && !showProfile && !showComposer && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
    {loading && <div className="loading-screen"><span className="brand-mark"><Sparkles/></span><p>Loading DreamBig…</p></div>}
  </div>
}
