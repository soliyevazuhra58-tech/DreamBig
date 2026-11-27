import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, BadgeCheck, Clock3, Compass, Heart, MessageCircle, Plus, Search, ShieldCheck, Sparkles, Target, UserRound, X, Moon, Sun, Home, Film, Pencil, Trash2, Shield, LayoutDashboard, Ban, UserCheck, LockKeyhole, Globe, RefreshCw } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Settings, Eye, EyeOff, Download, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import QuoteReels from './components/QuoteReels'

type Profile = { dreamid_changed_at?: string | null; is_banned?: boolean; is_verified?: boolean; is_private?: boolean; id: string; first_name: string; last_name: string; username: string; card_id: string; date_of_birth: string; gender: string; country?: string | null; city?: string | null; bio?: string; avatar_url?: string | null; visibility?: Record<string, boolean>; created_at: string }
type PublicDreamID = { id:string; avatar_url:string|null; first_name:string|null; last_name:string|null; username:string|null; date_of_birth:string|null; gender:string|null; country:string|null; city:string|null; bio:string|null; created_at:string|null }
type Post = { id: string; message: string; created_at: string; user_id: string; first_name: string; username: string; card_id: string; is_verified?: boolean }
type AdminUser = { id:string; first_name:string; last_name:string; username:string; created_at:string; is_banned:boolean; ban_reason:string|null; is_verified:boolean; is_private:boolean }

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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dreambig-theme') === 'dark')
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminSearch, setAdminSearch] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [ownerClaimCode, setOwnerClaimCode] = useState('')
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editMessage, setEditMessage] = useState('')
  const [showEditDreamID, setShowEditDreamID] = useState(false)
  const [sharedDreamID, setSharedDreamID] = useState<PublicDreamID | null>(null)
  const [visibility, setVisibility] = useState<Record<string,boolean>>({avatar_url:true,first_name:true,last_name:false,username:true,date_of_birth:false,gender:false,country:false,city:false,bio:true,created_at:true})
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) { setNotice(error.message); return }
    if (data?.is_banned) { setNotice('Your DreamBig account is suspended. Contact an administrator.'); setProfile(null); setIsAdmin(false); setSession(null); await supabase.auth.signOut(); return }
    setProfile(data as Profile | null)
    if (data) { const { data: admin } = await supabase.rpc('is_dreambig_admin'); setIsAdmin(Boolean(admin)) } else setIsAdmin(false)
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

  const loadAdminUsers = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setAdminLoading(true)
    const { data, error } = await supabase.from('profiles').select('id,first_name,last_name,username,created_at,is_banned,ban_reason,is_verified,is_private').order('created_at',{ascending:false}).limit(200)
    if (error) setNotice(error.message); else setAdminUsers((data ?? []) as AdminUser[])
    setAdminLoading(false)
  }, [isAdmin])

  useEffect(() => { if (isAdmin) void loadAdminUsers(); else setAdminUsers([]) }, [isAdmin, loadAdminUsers])

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
      else { setProfile(null); setLastPostAt(null); setIsAdmin(false); setAdminUsers([]) }
    })
    void loadPosts()
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [loadPosts, loadProfile])

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get('dreamid')
    if (!sharedId || !supabase) return
    supabase.rpc('get_dreamid', { target_id: sharedId }).then(({ data, error }) => {
      if (error) setNotice(error.message)
      else if (data && data[0]) setSharedDreamID(data[0] as PublicDreamID)
      else setNotice('This DreamID was not found.')
    })
  }, [])

  const cooldownMs = lastPostAt ? Math.max(0, 86400000 - (clock - new Date(lastPostAt).getTime())) : 0
  const canPost = !lastPostAt || cooldownMs <= 0
  const countdown = Math.max(0, Math.ceil(cooldownMs / 1000))
  const countdownText = [Math.floor(countdown / 86400), Math.floor((countdown % 86400) / 3600), Math.floor((countdown % 3600) / 60), countdown % 60].map(v => String(v).padStart(2, '0')).join(':')
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('dreambig-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!profile || !lastPostAt || cooldownMs > 0 || !('Notification' in window)) return
    const key = 'dreambig-notified-' + profile.id + '-' + lastPostAt
    if (localStorage.getItem(key) === '1') return
    if (Notification.permission === 'granted') {
      new Notification('DreamBig · Daily thought is ready', { body: 'Your 24-hour countdown is over. You can share a new thought now.' })
      localStorage.setItem(key, '1')
    }
  }, [profile, lastPostAt, cooldownMs])

  const visiblePosts = useMemo(() => posts.filter(post => `${post.first_name} @${post.username} ${post.message}`.toLowerCase().includes(search.toLowerCase())), [posts, search])
  const filteredAdminUsers = useMemo(() => adminUsers.filter(user => `${user.first_name} ${user.last_name} @${user.username}`.toLowerCase().includes(adminSearch.toLowerCase())), [adminUsers, adminSearch])
  const dreamIDLocked = Boolean(profile?.dreamid_changed_at && clock - new Date(profile.dreamid_changed_at).getTime() < 7 * 86400000)
  const dreamIDUnlockAt = profile?.dreamid_changed_at ? new Date(new Date(profile.dreamid_changed_at).getTime() + 7 * 86400000) : null
  const profileEmoji = profile?.gender === 'male' ? '👨🏻' : profile?.gender === 'female' ? '👩🏻' : '👤'
  function goTo(tab: string) { setActiveTab(tab); if (tab === 'settings') { if (!profile) void startDreaming(); else setShowSettings(true); return } if (tab === 'profile') { if (!profile) void startDreaming(); else setShowProfile(true); return } if (tab === 'home') window.scrollTo({top:0,behavior:'smooth'}); else if (tab === 'reels') document.getElementById('reels')?.scrollIntoView({behavior:'smooth'}); else if (tab === 'discover') document.getElementById('feed')?.scrollIntoView({behavior:'smooth'}); else if (tab === 'admin') document.getElementById('admin-panel')?.scrollIntoView({behavior:'smooth'}) }
  async function updateDreamID(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!supabase || !profile || dreamIDLocked) return; const fd=new FormData(e.currentTarget); setBusy(true); const values={first_name:String(fd.get('first_name')).trim(),last_name:String(fd.get('last_name')).trim(),username:String(fd.get('username')).replace(/^@/,'').trim().toLowerCase(),date_of_birth:String(fd.get('date_of_birth')),gender:String(fd.get('gender')),country:String(fd.get('country')||'').trim()||null,city:String(fd.get('city')||'').trim()||null,bio:String(fd.get('bio')||'').trim()}; const {error}=await supabase.from('profiles').update(values).eq('id',profile.id); if(error)setNotice(error.message.includes('7 days')?'DreamID can only be changed once every 7 days.':error.message); else { await loadProfile(profile.id); setShowEditDreamID(false); setNotice('DreamID updated. You can edit it again in 7 days.'); } setBusy(false) }
  async function savePostEdit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if(!supabase||!profile||!editingPost||!editMessage.trim())return; setBusy(true); const {error}=await supabase.from('posts').update({message:editMessage.trim()}).eq('id',editingPost.id).eq('user_id',profile.id); if(error)setNotice(error.message); else {setEditingPost(null);setEditMessage('');await loadPosts();setNotice('Post updated.')} setBusy(false) }
  async function deletePost(post: Post) { if(!supabase||!profile||!window.confirm('Ushbu postni o‘chirmoqchimisiz?'))return; const {error}=await supabase.from('posts').delete().eq('id',post.id).eq('user_id',profile.id); if(error)setNotice(error.message); else {await loadPosts();setNotice('Post deleted.')} }
  async function adminDeletePost(post: Post) { if(!supabase||!isAdmin||!window.confirm('Admin sifatida ushbu postni o‘chirasizmi?'))return; const {error}=await supabase.from('posts').delete().eq('id',post.id); if(error)setNotice(error.message); else {await loadPosts();setNotice('Post removed by admin.')} }

  async function claimOwnerAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !profile || !ownerClaimCode.trim()) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('admin-user-action',{body:{action:'claim_owner',code:ownerClaimCode.trim()}})
    if (error || data?.error) setNotice(data?.error || error?.message || 'Owner activation failed.')
    else { setOwnerClaimCode(''); setShowSettings(false); await loadProfile(profile.id); setNotice(data?.message || 'Owner access activated.') }
    setBusy(false)
  }

  async function adminUserAction(user: AdminUser, action: string) {
    if (!supabase || !isAdmin || (user.id === profile?.id && ['ban','delete'].includes(action))) return
    let reason = ''
    if (action === 'ban') { const answer = window.prompt('Ban sababi (ixtiyoriy):','Community guidelines violation'); if (answer === null) return; reason = answer }
    if (action === 'delete' && !window.confirm(`@${user.username} akkaunti, profili va postlarini butunlay o‘chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo‘lmaydi.`)) return
    if (action !== 'delete' && action !== 'ban' && !window.confirm(`@${user.username} uchun ushbu amalni bajarasizmi?`)) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('admin-user-action',{body:{action,userId:user.id,reason}})
    if (error || data?.error) setNotice(data?.error || error?.message || 'Admin action failed.')
    else { setNotice(data?.message || 'User updated.'); await loadAdminUsers(); await loadPosts() }
    setBusy(false)
  }

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

  async function downloadDreamID() {
    if (!cardRef.current) return
    try {
      const png = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = 'DreamBig-DreamID.png'
      link.href = png
      link.click()
    } catch { setNotice('DreamID image could not be created. Try again.') }
  }

  async function shareDreamID() {
    if (!profile) return
    const url = window.location.origin + '/?dreamid=' + profile.id
    try {
      if (navigator.share) await navigator.share({ title: 'My DreamBig DreamID', url })
      else { await navigator.clipboard.writeText(url); setNotice('DreamID link copied.') }
    } catch { /* share dismissed */ }
  }

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !profile || !canPost || !message.trim()) return
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
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

  return <div className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
    <header className="topbar">
      <a className="brand" href="#" aria-label="DreamBig home"><span className="brand-mark brand-logo-mark" aria-hidden="true">D</span><span>dreambig<span className="brand-period">.</span></span></a>
      <nav className="nav-links"><a href="#feed" className="active">Discover</a><a href="#how">How it works</a></nav>
      <div className="top-actions">{profile && lastPostAt && !canPost && <span className="header-countdown"><Clock3 size={13}/><b>{countdownText}</b></span>}<button className="theme-toggle" onClick={() => setDarkMode(v => !v)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'}>{darkMode ? <Sun size={16}/> : <Moon size={16}/>}</button>
        {profile ? <button className="profile-chip" onClick={() => goTo('profile')}><span className="mini-avatar">{profileEmoji}</span>@{profile.username}</button> : <button className="btn btn-quiet" onClick={startDreaming} disabled={busy}>{busy ? 'Please wait…' : 'Create DreamID'}</button>}
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

      <div id="reels"><QuoteReels /></div>

      <section className="feed-section" id="feed">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> COMMUNITY</div><h2>Ideas worth<br className="mobile-break"/> <span>sharing.</span></h2></div><p className="section-description">A collection of thoughts from people moving forward. Find one that stays with you.</p></div>
        <div className="feed-toolbar"><div className="feed-label"><Compass size={16}/> Latest thoughts <span>{visiblePosts.length}</span></div><label className="search-box"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thoughts or people"/></label></div>
        <div className="post-grid">{visiblePosts.map(post => <article className="post-card" key={post.id}><div className="post-card-head"><div className="post-user"><div className="post-avatar">{post.first_name?.[0] ?? 'D'}</div><div><strong>{post.first_name} {post.is_verified && <span className="verified-mark" title="Verified DreamBig account"><BadgeCheck size={13}/></span>}</strong><span>@{post.username}</span></div></div><span className="post-time">{timeAgo(post.created_at)}</span></div><p className="post-message">{post.message}</p><div className="post-card-foot"><span><BadgeCheck size={13}/> DreamBig member</span><span className="inspire-tag"><Heart size={13}/> Keep going</span></div>{profile?.id===post.user_id && <div className="post-owner-actions"><button type="button" onClick={()=>{setEditingPost(post);setEditMessage(post.message)}}><Pencil size={13}/> Edit</button><button type="button" onClick={()=>void deletePost(post)}><Trash2 size={13}/> Delete</button></div>}{isAdmin && profile?.id!==post.user_id && <div className="post-owner-actions"><button type="button" onClick={()=>void adminDeletePost(post)}><Shield size={13}/> Remove</button></div>}</article>)}</div>
        {visiblePosts.length === 0 && <div className="empty-state">No thoughts found. Try another search.</div>}
        {!isSupabaseConfigured && <div className="demo-note"><Sparkles size={14}/> Preview mode · Connect Supabase to create DreamIDs and publish live thoughts.</div>}
        <div className="feed-bottom"><span>One thoughtful post. Every 24 hours.</span><button className="btn btn-outline" onClick={() => profile ? setShowComposer(true) : void startDreaming()}>Share your thought <ArrowUpRight size={15}/></button></div>
      </section>

      <section className="how-section" id="how"><div className="eyebrow"><span className="eyebrow-line"/> HOW IT WORKS</div><h2>Simple from the <span>start.</span></h2><div className="steps"><article className="step"><span>01</span><UserRound/><h3>Create your DreamID</h3><p>Choose a username, add a few details, and receive your unique CardID.</p></article><article className="step"><span>02</span><MessageCircle/><h3>Share one thought</h3><p>Post a quote, lesson, or idea that could brighten someone's day.</p></article><article className="step"><span>03</span><Target/><h3>Grow together</h3><p>Explore the community and discover perspectives worth remembering.</p></article></div></section>
      <section className="closing-cta"><div className="eyebrow"><span className="eyebrow-line"/> START WHERE YOU ARE</div><h2>Think clearly.<br/><span>Dream boldly.</span></h2><p>Your next idea might be exactly what someone needs.</p><button className="btn btn-primary btn-large" onClick={() => profile ? setShowComposer(true) : void startDreaming()}>Join DreamBig <ArrowRight size={16}/></button></section>
    </main>
    {isAdmin && <section className="admin-section" id="admin-panel"><div className="admin-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> OWNER CONSOLE</div><h2><LayoutDashboard size={22}/> Admin panel</h2><p className="section-description">Manage DreamBig members, safety and community content.</p></div><button className="btn btn-outline" onClick={()=>{void loadAdminUsers();void loadPosts()}} disabled={adminLoading}><RefreshCw size={14}/> Refresh</button></div><div className="admin-stats"><div><strong>{adminUsers.length}</strong><span>Users</span></div><div><strong>{adminUsers.filter(u=>u.is_verified).length}</strong><span>Verified</span></div><div><strong>{adminUsers.filter(u=>u.is_banned).length}</strong><span>Banned</span></div><div><strong>{posts.length}</strong><span>Loaded posts</span></div></div><div className="admin-subheading"><h3><UserRound size={17}/> User management</h3><label className="admin-search"><Search size={15}/><input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Search by name or @username"/></label></div>{adminLoading ? <p className="admin-empty">Loading users…</p> : <div className="admin-users">{filteredAdminUsers.map(user=><article className="admin-user-card" key={user.id}><div className="admin-user-main"><div className="admin-user-avatar">{user.first_name?.[0]||'D'}</div><div className="admin-user-info"><b>{user.first_name} {user.last_name} {user.is_verified&&<BadgeCheck size={14} className="verified-mark"/>}</b><span>@{user.username}</span><small>Joined {new Date(user.created_at).toLocaleDateString()} · {user.is_private?'Private profile':'Public profile'}</small>{user.is_banned&&<small className="admin-ban-note">Banned · {user.ban_reason||'No reason provided'}</small>}</div><div className="admin-user-status">{user.is_banned?<span className="status-pill danger">Banned</span>:<span className="status-pill good">Active</span>}{user.is_verified&&<span className="status-pill verified">Verified</span>}</div></div><div className="admin-user-actions"><button onClick={()=>void adminUserAction(user,user.is_verified?'unverify':'verify')} disabled={busy}><BadgeCheck size={14}/>{user.is_verified?'Remove verify':'Verify'}</button><button onClick={()=>void adminUserAction(user,user.is_banned?'unban':'ban')} disabled={busy||user.id===profile?.id}>{user.is_banned?<UserCheck size={14}/>:<Ban size={14}/>} {user.is_banned?'Unban':'Ban'}</button><button onClick={()=>void adminUserAction(user,user.is_private?'make_public':'make_private')} disabled={busy}>{user.is_private?<Globe size={14}/>:<LockKeyhole size={14}/>} {user.is_private?'Make public':'Make private'}</button><button className="danger-action" onClick={()=>void adminUserAction(user,'delete')} disabled={busy||user.id===profile?.id}><Trash2 size={14}/> Delete</button></div></article>)}</div>}{filteredAdminUsers.length===0&&!adminLoading&&<p className="admin-empty">No users found.</p>}<div className="admin-subheading admin-post-heading"><h3><MessageCircle size={17}/> Post moderation</h3><span>{posts.length} recent posts</span></div><div className="admin-list">{posts.map(post=><div className="admin-row" key={post.id}><div><b>{post.first_name} · @{post.username}</b><p>{post.message}</p></div><button type="button" onClick={()=>void adminDeletePost(post)}><Trash2 size={14}/> Remove post</button></div>)}</div></section>}
    <footer><a className="brand" href="#"><span className="brand-mark brand-logo-mark" aria-hidden="true">D</span><span>dreambig<span className="brand-period">.</span></span></a><span>© 2026 DreamBig</span><a href="#feed">Back to top ↑</a></footer>

    {sharedDreamID && <div className="shared-dreamid-wrap"><section className="modal shared-dreamid"><div className="dreamid-card"><div className="dreamid-card-head"><span className="card-brand">DREAMBIG</span><span>IDENTITY CARD</span></div><div className="card-chip" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><div className="dreamid-card-name">{sharedDreamID.first_name || ''} {sharedDreamID.last_name || ''}</div>{sharedDreamID.username && <p>@{sharedDreamID.username}</p>}{sharedDreamID.date_of_birth && <p>Date of birth · {sharedDreamID.date_of_birth}</p>}{sharedDreamID.gender && <p>Gender · {sharedDreamID.gender}</p>}{sharedDreamID.country && <p>Country · {sharedDreamID.country}</p>}{sharedDreamID.city && <p>City · {sharedDreamID.city}</p>}{sharedDreamID.bio && <p>{sharedDreamID.bio}</p>}{sharedDreamID.created_at && <small>Member since {new Date(sharedDreamID.created_at).toLocaleDateString()}</small>}<div className="dreamid-card-foot">MY IDENTITY · MY JOURNEY</div></div><button className="btn btn-outline btn-full" onClick={()=>{window.history.replaceState({},'',window.location.pathname);setSharedDreamID(null)}}>Close shared DreamID</button></section></div>}
    {showProfile && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowProfile(false)}><section className="modal"><button className="modal-close" onClick={() => setShowProfile(false)}><X/></button>{profile ? <><div className="profile-large">{profileEmoji}</div><div className="eyebrow">YOUR DREAMID</div><h2>{profile.first_name} {profile.last_name}</h2><p className="modal-desc">@{profile.username}</p><div className="dreamid-card" ref={cardRef}><div className="dreamid-card-head"><span className="card-brand">DREAMBIG</span><span>IDENTITY CARD</span></div><div className="card-chip" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><QRCodeSVG value={window.location.origin + "/?dreamid=" + profile.id} size={68} bgColor="#ffffff" fgColor="#242331" level="M"/><div className="dreamid-card-name">{visibility.first_name && profile.first_name} {visibility.last_name && profile.last_name}</div>{visibility.username && <p>@{profile.username}</p>}{visibility.date_of_birth && <p>Date of birth · {profile.date_of_birth}</p>}{visibility.gender && <p>Gender · {profile.gender}</p>}{visibility.country && profile.country && <p>Country · {profile.country}</p>}{visibility.city && profile.city && <p>City · {profile.city}</p>}{visibility.bio && profile.bio && <p>{profile.bio}</p>}{visibility.created_at && <small>Member since {new Date(profile.created_at).toLocaleDateString()}</small>}<div className="dreamid-card-foot">MY IDENTITY · MY JOURNEY</div></div><div className="dreamid-actions"><button className="btn btn-outline" onClick={()=>setShowEditDreamID(true)}><Pencil size={14}/> Edit DreamID</button><button className="btn btn-outline" onClick={downloadDreamID}><Download size={14}/> Save PNG</button><button className="btn btn-outline" onClick={shareDreamID}><Share2 size={14}/> Share</button><button className="btn btn-primary" onClick={() => setShowSettings(true)}><Settings size={14}/> Settings</button></div><p className="private-note"><ShieldCheck size={15}/> Your date of birth and gender are private.</p><p className="account-note">DreamID changes are limited to once every 7 days.</p><p className="account-note">This DreamID stays signed in on this device. Keep this device data safe so you can continue using the same identity.</p></> : <><div className="modal-icon"><UserRound/></div><div className="eyebrow">NO EMAIL NEEDED</div><h2>Create your DreamID</h2><p className="modal-desc">Just a few details. Your unique CardID is generated automatically.</p><form onSubmit={saveProfile} className="form-stack"><div className="form-row"><label>First name<input name="first_name" required maxLength={40} placeholder="First name"/></label><label>Last name<input name="last_name" required maxLength={60} placeholder="Last name"/></label></div><label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" placeholder="yourname"/></label><label>Date of birth<input name="date_of_birth" type="date" required max={new Date().toISOString().slice(0,10)}/></label><label>Gender<select name="gender" required defaultValue=""><option value="" disabled>Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><p className="private-note"><ShieldCheck size={15}/> Your surname, birthday and gender are private. Only first name, username and CardID are public.</p><label>Country<input name="country" maxLength={60} placeholder="Country"/></label><label>City<input name="city" maxLength={60} placeholder="City"/></label><label>About me<textarea name="bio" rows={3} maxLength={180} placeholder="A short introduction…"/></label><p className="account-note">No email or confirmation code. DreamID is saved to this device. The @owner username is reserved; create your DreamID first, then claim @owner from Settings.</p><button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Creating…' : 'Create my DreamID'} <ArrowRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</>}</section></div>}

    <div>{showSettings && profile && <div className="modal-backdrop"><section className="modal"><button className="modal-close" onClick={() => setShowSettings(false)}><X/></button><div className="eyebrow">PRIVACY CONTROL</div><h2>DreamID visibility</h2><p className="modal-desc">CardID is not displayed. Choose which other details are visible.</p>{Object.entries({avatar_url:"Profile photo",first_name:"First name",last_name:"Last name",username:"Username",date_of_birth:"Date of birth",gender:"Gender",country:"Country",city:"City",bio:"About me",created_at:"Joined date"}).map(([key,label]) => <label className="visibility-row" key={key}><span>{label}</span><button type="button" onClick={async()=>{const next={...visibility,[key]:!visibility[key]};setVisibility(next);const {error}=await supabase!.from("profiles").update({visibility:next}).eq("id",profile.id);if(error)setNotice(error.message)}}>{visibility[key]?<><Eye size={14}/> On</>:<><EyeOff size={14}/> Off</>}</button></label>)}<div className="owner-claim-box"><div className="eyebrow">OWNER ACCOUNT</div><h3>Claim @owner access</h3><p className="modal-desc">If you are the DreamBig owner, enter your one-time activation code. This changes your username to @owner and grants admin access.</p><form className="form-stack" onSubmit={claimOwnerAccess}><label>One-time activation code<input value={ownerClaimCode} onChange={e=>setOwnerClaimCode(e.target.value)} placeholder="Paste owner code" autoComplete="off" required/></label><button className="btn btn-primary btn-full" disabled={busy||!ownerClaimCode.trim()}>{busy?'Activating…':'Activate @owner'}</button></form></div></section></div>}</div>
    {showEditDreamID && profile && <div className="modal-backdrop"><section className="modal"><button className="modal-close" onClick={()=>setShowEditDreamID(false)}><X/></button><div className="eyebrow">EDIT YOUR IDENTITY</div><h2>Update DreamID</h2>{dreamIDLocked && <p className="account-note">You can edit your DreamID again on {dreamIDUnlockAt?.toLocaleString()}.</p>}<form className="form-stack" onSubmit={updateDreamID}><div className="form-row"><label>First name<input name="first_name" defaultValue={profile.first_name} required maxLength={40}/></label><label>Last name<input name="last_name" defaultValue={profile.last_name} required maxLength={60}/></label></div><label>Username<input name="username" defaultValue={profile.username} required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}"/></label><label>Date of birth<input name="date_of_birth" type="date" defaultValue={profile.date_of_birth} required/></label><label>Gender<select name="gender" defaultValue={profile.gender}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><label>Country<input name="country" defaultValue={profile.country||''}/></label><label>City<input name="city" defaultValue={profile.city||''}/></label><label>About me<textarea name="bio" defaultValue={profile.bio||''} maxLength={180}/></label><button className="btn btn-primary btn-full" disabled={busy||dreamIDLocked}>{busy?'Saving…':'Save DreamID changes'}</button></form>{notice&&<p className="form-notice">{notice}</p>}</section></div>}
    {editingPost && <div className="modal-backdrop"><section className="modal"><button className="modal-close" onClick={()=>setEditingPost(null)}><X/></button><div className="eyebrow">YOUR POST</div><h2>Edit post</h2><form className="form-stack" onSubmit={savePostEdit}><label>Message<textarea value={editMessage} onChange={e=>setEditMessage(e.target.value)} maxLength={500} rows={5} required/></label><button className="btn btn-primary btn-full" disabled={busy||!editMessage.trim()}>{busy?'Saving…':'Save changes'}</button></form></section></div>}
    {showComposer && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowComposer(false)}><section className="modal"><button className="modal-close" onClick={() => setShowComposer(false)}><X/></button><div className="modal-icon"><MessageCircle/></div><div className="eyebrow">YOUR DAILY THOUGHT</div><h2>Make it meaningful.</h2><p className="modal-desc">One post every 24 hours. Make yours count.</p><form className="form-stack" onSubmit={publish}><label>Your thought<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="Write something worth sharing…" required/></label><div className="composer-meta"><span>{message.length}/500</span><span className={canPost ? 'countdown-ready' : 'countdown-live'}><Clock3 size={14}/>{canPost ? ' Ready to post' : <><b className="countdown-digits">{countdownText}</b><small> until your next thought</small></>}</span></div><button className="btn btn-primary btn-full" disabled={busy || !canPost || !message.trim()}>{busy ? 'Publishing…' : 'Publish thought'} <ArrowUpRight size={16}/></button></form>{notice && <p className="form-notice">{notice}</p>}</section></div>}

    <nav className="mobile-app-nav" aria-label="Main navigation"><button className={activeTab==='home'?'selected':''} onClick={()=>goTo('home')}><Home size={18}/><span>Home</span></button><button className={activeTab==='reels'?'selected':''} onClick={()=>goTo('reels')}><Film size={18}/><span>Reels</span></button><button className={activeTab==='discover'?'selected':''} onClick={()=>goTo('discover')}><Compass size={18}/><span>Discover</span></button><button className={activeTab==='settings'?'selected':''} onClick={()=>goTo('settings')}><Settings size={18}/><span>Settings</span></button>{isAdmin&&<button className={activeTab==='admin'?'selected':''} onClick={()=>goTo('admin')}><Shield size={18}/><span>Admin</span></button>}</nav>
    {notice && !showProfile && !showComposer && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
    {loading && <div className="loading-screen"><span className="brand-mark"><Sparkles/></span><p>Loading DreamBig…</p></div>}
  </div>
}
