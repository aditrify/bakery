// app.js (module) — Supabase-based auth + UI, orders persistence (lighter main app)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://dprmcjetkzrmwydzodiv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcm1jamV0a3pybXd5ZHpvZGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTEzNTgsImV4cCI6MjA4NTM2NzM1OH0.F6jeejegiXgKcnIXRspCehi9SLCtAqbBds4JGd9lxcc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// PHONE & SHOP INFO
const bakeryName = "Gurj Bakery";
const bakeryPhone = "917417191948";

// --- state
let cart = JSON.parse(localStorage.getItem('cart_v1') || '[]');
let menuItems = []; // will be loaded from Supabase
let guestCheckout = false; // when user chooses "Continue as guest"

// UI elements
const itemsEl = document.getElementById('items');
const totalEl = document.getElementById('total');
const orderBtn = document.getElementById('orderBtn');
const categoriesEl = document.getElementById('categories');
const searchInput = document.getElementById('search');

const modal = document.getElementById('orderModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalItemsEl = document.getElementById('modalItems');
const modalTotalEl = document.getElementById('modalTotal');
const modalSendBtn = document.getElementById('modalSend');
const modalCancelBtn = document.getElementById('modalCancel');
const modalQueueBtn = document.getElementById('modalQueue');
const modalCloseBtn = document.getElementById('closeModal');

const custName = document.getElementById('custName');
const custPhone = document.getElementById('custPhone');
const custPickup = document.getElementById('custPickup');
const custAddress = document.getElementById('custAddress');

const signInBtnTop = document.getElementById('signInBtn');
const accountBadge = document.getElementById('accountBadge');
const accountName = document.getElementById('accountName');
const signOutBtn = document.getElementById('signOutBtn');

const authModal = document.getElementById('authModal');
const authBackdrop = document.getElementById('authBackdrop');
const closeAuth = document.getElementById('closeAuth');

const authChoice = document.getElementById('authChoice');
const guestPrimary = document.getElementById('guestPrimary');
const gotoSignin = document.getElementById('gotoSignin');

const authForms = document.getElementById('authForms');
const tabSignIn = document.getElementById('tabSignIn');
const tabSignUp = document.getElementById('tabSignUp');
const signInPanel = document.getElementById('signInPanel');
const signUpPanel = document.getElementById('signUpPanel');

const signinBtn = document.getElementById('signinBtn');
const signupBtn = document.getElementById('signupBtn');
const guestBtn = document.getElementById('guestBtn');

const signin_username = document.getElementById('signin_username');
const signin_password = document.getElementById('signin_password');
const signup_username = document.getElementById('signup_username');
const signup_password = document.getElementById('signup_password');
const signup_name = document.getElementById('signup_name');
const signup_phone = document.getElementById('signup_phone');
const signup_address = document.getElementById('signup_address');
const signinMsg = document.getElementById('signinMsg');
const signupMsg = document.getElementById('signupMsg');

const loadMoreWrap = document.getElementById('loadMoreWrap');

// account
const accountModal = document.getElementById('accountModal');
const accountBackdrop = document.getElementById('accountBackdrop');
const closeAccount = document.getElementById('closeAccount');
const acctCancel = document.getElementById('acctCancel');
const acctSave = document.getElementById('acctSave');
const acctName = document.getElementById('acct_name');
const acctPhone = document.getElementById('acct_phone');
const acctAddress = document.getElementById('acct_address');
const accountMsg = document.getElementById('accountMsg');
const current_password = document.getElementById('current_password');
const new_password = document.getElementById('new_password');
const confirm_new_password = document.getElementById('confirm_new_password');
const changePassBtn = document.getElementById('changePassBtn');
const passMsg = document.getElementById('passMsg');

const toastEl = document.getElementById('toast');

// categories order / generation
const desiredOrder = ["All","New Arrival","Cakes","Dessert","Snacks","On Demand","Breads","Biscuits","Cookies","Pastry","Muffins","Confectionery"];
function computeCategoriesFrom(items){
  const categoriesSet = new Set((items||[]).map(m => m.category));
  const unique = desiredOrder.filter(c => c === 'All' || categoriesSet.has(c));
  Array.from(categoriesSet).forEach(c => { if(!unique.includes(c)) unique.push(c); });
  return unique;
}

// ---------------------- small utilities ----------------------
function showToast(msg, timeout = 2800){
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  toastEl.setAttribute('aria-hidden','false');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> {
    toastEl.style.display = 'none';
    toastEl.setAttribute('aria-hidden','true');
  }, timeout);
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------------------- Supabase helpers ----------------------
async function getProfileFromSupabase(){
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user || null;
    if(!user) return null;
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      username: user.email || user.id,
      email: user.email || '',
      name: metadata.name || '',
      phone: metadata.phone || '',
      address: metadata.address || '',
      role: metadata.role || ''
    };
  } catch(e){ console.warn('getProfile error', e); return null; }
}

async function updateAuthUI(){
  const profile = await getProfileFromSupabase();
  if(profile){
    signInBtnTop.classList.add('hidden');
    accountBadge.classList.remove('hidden');
    accountName.textContent = profile.name || profile.username;
    // show/hide admin link visually (side menu logic uses role)
    document.querySelectorAll('.side-link').forEach(btn=>{
      if(btn.getAttribute('data-action') === 'admin'){
        btn.style.display = profile.role === 'admin' ? 'block' : 'none';
      }
    });
    if(profile.name) custName.value = profile.name;
    if(profile.phone) custPhone.value = profile.phone;
    if(profile.address) custAddress.value = profile.address;
    // clear any guest marker when real user signs in
    guestCheckout = false;
    localStorage.removeItem('guest_mode_v1');
  } else {
    signInBtnTop.classList.remove('hidden');
    accountBadge.classList.add('hidden');
    accountName.textContent = '';
    document.querySelectorAll('.side-link').forEach(btn=>{
      if(btn.getAttribute('data-action') === 'admin'){
        btn.style.display = 'none';
      }
    });
  }
}

// ensure guest mode cleared when auth state changes to avoid confusion
supabase.auth.onAuthStateChange(() => {
  guestCheckout = false;
  localStorage.removeItem('guest_mode_v1');
  updateAuthUI();
});

// signup/login/signout/update profile wrappers
async function signupSupabase({ username, password, name, phone, address }){
  try {
    const { data, error } = await supabase.auth.signUp({
      email: username,
      password,
      options: { data: { name, phone, address } }
    });
    if(error) return { ok:false, msg: error.message };
    return { ok:true, data };
  } catch(e){ return { ok:false, msg: e.message || 'Signup error' }; }
}
async function loginSupabase({ username, password }){
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
    if(error) return { ok:false, msg: error.message };
    return { ok:true, data };
  } catch(e){ return { ok:false, msg: e.message || 'Login error' }; }
}
async function signoutSupabase(){
  try { await supabase.auth.signOut(); } catch(e){ /* ignore */ }
  guestCheckout = false;
  localStorage.removeItem('guest_mode_v1');
  updateAuthUI();
}
async function updateSupabaseProfile({ name, phone, address }){
  try {
    const { data, error } = await supabase.auth.updateUser({ data: { name, phone, address }});
    if(error) return { ok:false, msg: error.message };
    return { ok:true, data };
  } catch(e){ return { ok:false, msg: e.message || 'Update error' }; }
}
async function changeSupabasePassword({ currentPassword, newPassword }){
  try {
    const user = (await supabase.auth.getUser()).data?.user;
    if(!user || !user.email) return { ok:false, msg:'No signed-in user' };
    const r = await loginSupabase({ username: user.email, password: currentPassword });
    if(!r.ok) return { ok:false, msg:'Current password incorrect' };
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if(error) return { ok:false, msg: error.message };
    return { ok:true, data };
  } catch(e){ return { ok:false, msg: e.message || 'Password change error' }; }
}

// ---------------------- Menu loading from Supabase ----------------------
async function loadMenuFromSupabase(){
  try {
    const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
    if(error || !data) {
      console.warn('menu_items not available or fetch error', error);
      menuItems = [];
    } else {
      menuItems = data.map(row => ({
        id: Number(row.id),
        name: row.name,
        price: Number(row.price),
        category: row.category || 'Uncategorized',
        image_path: row.image_path || null
      }));
    }
  } catch(e){
    console.warn('menu load error', e);
    menuItems = [];
  }
  uniqueCategories = computeCategoriesFrom(menuItems);
}

// ---------------------- rendering ----------------------
let currentRenderLimit = 24;
let currentCategory = 'All';
let currentQuery = '';
let currentRenderedCount = 0;
let uniqueCategories = [];

function imageUrlForItem(item){
  if(item.image_path){
    try {
      const url = supabase.storage.from('menu-images').getPublicUrl(item.image_path).data.publicUrl;
      if(url) return url;
    } catch(e){}
  }
  let key = (item.name || '').split(/[\s,()]+/).slice(0,2).join(' ');
  if(!key) key = item.category || 'bakery';
  const q = encodeURIComponent(key + ',' + item.category);
  return `https://source.unsplash.com/400x300/?${q}`;
}
function placeholderSvgDataUri(text){
  const label = (text||'item').slice(0,18);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <rect width='100%' height='100%' rx='12' ry='12' fill='#fff'/>
    <text x='50%' y='45%' font-size='64' text-anchor='middle' dominant-baseline='middle'>🥖</text>
    <text x='50%' y='85%' font-size='20' text-anchor='middle' fill='#777'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function renderCategories(){
  categoriesEl.innerHTML = '';
  uniqueCategories.forEach(cat=>{
    const btn = document.createElement('button');
    btn.className = 'category' + (cat==='All' ? ' active' : '');
    btn.textContent = cat;
    btn.setAttribute('aria-pressed', cat === 'All' ? 'true' : 'false');
    btn.addEventListener('click', ()=> {
      document.querySelectorAll('.category').forEach(b=> { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
      currentRenderLimit = Infinity;
      renderMenu(cat, '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    categoriesEl.appendChild(btn);
  });
}

function renderMenu(category='All', query='', limit = currentRenderLimit){
  currentCategory = category;
  currentQuery = query || '';
  itemsEl.innerHTML = '';
  loadMoreWrap.innerHTML = '';
  const q = (query || '').trim().toLowerCase();
  const filtered = menuItems.filter(m => {
    const byCat = (category === 'All') || (m.category === category);
    const byQuery = !q || (m.name || '').toLowerCase().includes(q);
    return byCat && byQuery;
  });

  if(filtered.length === 0){
    itemsEl.innerHTML = '<p style="padding:12px;color:var(--muted)">No items found</p>';
    return;
  }

  const finiteLimit = Number.isFinite(limit) ? limit : filtered.length;
  const toRender = filtered.slice(0, finiteLimit);
  currentRenderedCount = toRender.length;

  toRender.forEach(item=>{
    const div = document.createElement('div');
    div.className = 'card';

    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = `${item.name} - ${item.category}`;
    img.loading = 'lazy';
    img.src = imageUrlForItem(item);
    img.onerror = function(){ this.onerror = null; this.src = placeholderSvgDataUri(item.name); };

    const title = document.createElement('h3');
    title.textContent = item.name;

    const price = document.createElement('div');
    price.className = 'price-badge';
    price.textContent = `₹${item.price}`;

    const qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';
    qtyRow.innerHTML = `
      <div class="qty-controls">
        <button class="minus" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
        <div class="qty-display" data-id="${item.id}" aria-live="polite">${getQty(item.id)}</div>
        <button class="plus" aria-label="Increase ${escapeHtml(item.name)}">+</button>
      </div>
      <div class="cat" style="font-size:12px;color:var(--muted)">${escapeHtml(item.category)}</div>
    `;

    div.appendChild(img);
    div.appendChild(price);
    div.appendChild(title);
    div.appendChild(qtyRow);

    div.querySelector('.plus').addEventListener('click', ()=> addToCart(item));
    div.querySelector('.minus').addEventListener('click', ()=> removeFromCart(item));

    itemsEl.appendChild(div);
  });

  if(finiteLimit < filtered.length){
    const remaining = filtered.length - finiteLimit;
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = `Load more (${remaining} more)`;
    btn.addEventListener('click', ()=> {
      const add = 24;
      currentRenderLimit = finiteLimit + add;
      renderMenu(category, query, currentRenderLimit);
    });
    loadMoreWrap.appendChild(btn);
  } else {
    if(category === 'All' && currentRenderLimit !== Infinity && filtered.length > 24){
      const btn = document.createElement('button');
      btn.className = 'btn-ghost';
      btn.textContent = 'Show fewer';
      btn.addEventListener('click', ()=> {
        currentRenderLimit = 24;
        renderMenu('All', '');
      });
      loadMoreWrap.appendChild(btn);
    }
  }
}

// ---------------------- cart ----------------------
function getQty(id){ const f = cart.find(c=>c.id===id); return f ? f.qty : 0; }
function addToCart(item){ if(!item) return; const found = cart.find(c=>c.id===item.id); if(found) found.qty++; else cart.push({id:item.id,name:item.name,price:item.price,qty:1}); saveCart(); renderCart(); updateQtyDisplay(item.id); }
function removeFromCart(item){ if(!item) return; const found = cart.find(c=>c.id===item.id); if(!found) return; found.qty--; if(found.qty<=0) cart = cart.filter(c=>c.id!==item.id); saveCart(); renderCart(); updateQtyDisplay(item.id); }
function saveCart(){ localStorage.setItem('cart_v1', JSON.stringify(cart)); }
function renderCart(){ const total = cart.reduce((s,i)=> s + (i.price*i.qty), 0); totalEl.textContent = 'Total — ₹' + total; }
function updateQtyDisplay(id){ document.querySelectorAll('.qty-display').forEach(el=>{ if(Number(el.getAttribute('data-id')) === id) el.textContent = getQty(id); }); }

// ---------------------- order persistence (to Supabase) ----------------------
async function placeOrderToServer(){
  if(!cart || cart.length === 0){ showToast('Cart is empty'); return; }

  // determine if guest mode is allowed (persisted)
  const persistedGuest = localStorage.getItem('guest_mode_v1') === '1';
  const profile = await getProfileFromSupabase();
  const isGuest = guestCheckout || persistedGuest;

  if(!profile && !isGuest){
    // explicitly require user to choose guest or sign in
    showToast('Please sign in or continue as guest to place order');
    pendingOrderAttempt = true;
    openAuthModal('choice');
    return;
  }

  const total = cart.reduce((s,i)=> s + (i.price*i.qty), 0);
  const payload = {
    // store null for user_id if guest
    user_id: profile ? profile.id : null,
    items: cart,
    total,
    name: custName.value || (profile ? profile.name : '') || '',
    phone: custPhone.value || (profile ? profile.phone : '') || '',
    pickup: custPickup.value || '',
    address: custAddress.value || (profile ? profile.address : '') || ''
  };

  // if signed-in user updated address/name, save back to profile
  if(profile && payload.address && payload.address !== profile.address){
    await updateSupabaseProfile({ name: payload.name, phone: payload.phone, address: payload.address });
  }

  try {
    const { data, error } = await supabase.from('orders').insert([payload]);
    if(error){
      console.error('order insert error', error);
      showToast('Order failed to save (server): ' + (error.message || 'unknown'));
      return;
    }
    // success
    showToast('Order placed — admin will process it');
    // clear cart and UI
    cart = [];
    saveCart();
    renderCart();
    renderOrderModal();
    closeOrderModal();
    // clear guest marker after successful order
    guestCheckout = false;
    localStorage.removeItem('guest_mode_v1');
  } catch(e){
    console.error('unexpected order error', e);
    showToast('Order failed (unexpected).');
  }
}

// ---------------------- modal logic ----------------------
let pendingOrderAttempt = false;

function openOrderModal(){
  (async ()=>{
    const profile = await getProfileFromSupabase();
    if(profile){
      custName.value = profile.name || '';
      custPhone.value = profile.phone || '';
      custAddress.value = profile.address || '';
    }
  })();
  renderOrderModal();
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'block';
  setTimeout(()=> { custName.focus(); }, 120);
}
function closeOrderModal(){ modal.setAttribute('aria-hidden','true'); modal.style.display = 'none'; }

function renderOrderModal(){
  modalItemsEl.innerHTML = '';
  if(!cart || cart.length === 0){
    modalItemsEl.innerHTML = '<p style="color:var(--muted)">No items in your cart.</p>';
    modalTotalEl.textContent = 'Total: ₹0';
    return;
  }
  cart.forEach(item => {
    const itemWrap = document.createElement('div');
    itemWrap.className = 'modal-item';
    itemWrap.innerHTML = `
      <div style="flex:1">
        <h4>${escapeHtml(item.name)}</h4>
        <div style="font-size:13px;color:var(--muted)">₹${item.price} each</div>
      </div>
      <div>
        <div class="m-qty">
          <button class="m-minus" data-id="${item.id}" aria-label="Decrease">−</button>
          <span class="m-qty-display" data-id="${item.id}">${item.qty}</span>
          <button class="m-plus" data-id="${item.id}" aria-label="Increase">+</button>
        </div>
        <div style="text-align:right;margin-top:6px">
          <button class="m-delete" data-id="${item.id}" style="font-size:12px;color:#b00;background:transparent;border:none;cursor:pointer">Delete</button>
        </div>
      </div>
    `;
    modalItemsEl.appendChild(itemWrap);
  });

  modalItemsEl.querySelectorAll('.m-plus').forEach(b=>{ b.addEventListener('click', (e)=> { const id = Number(b.getAttribute('data-id')); const mi = menuItems.find(m=>m.id===id); addToCart(mi); renderOrderModal(); }); });
  modalItemsEl.querySelectorAll('.m-minus').forEach(b=>{ b.addEventListener('click', (e)=> { const id = Number(b.getAttribute('data-id')); const mi = menuItems.find(m=>m.id===id); removeFromCart(mi); renderOrderModal(); }); });
  modalItemsEl.querySelectorAll('.m-delete').forEach(b=>{ b.addEventListener('click', (e)=> { const id = Number(b.getAttribute('data-id')); cart = cart.filter(c=>c.id !== id); saveCart(); renderCart(); renderOrderModal(); }); });

  const total = cart.reduce((s,i)=> s + (i.price*i.qty), 0);
  modalTotalEl.textContent = 'Total: ₹' + total;
}

// Save offline
modalQueueBtn.addEventListener('click', ()=> {
  const q = JSON.parse(localStorage.getItem('orders_queue')||'[]');
  q.push({
    cart: cart,
    created: new Date().toISOString(),
    meta: { name: custName.value || '', phone: custPhone.value || '', pickup: custPickup.value || '', address: custAddress.value || '' }
  });
  localStorage.setItem('orders_queue', JSON.stringify(q));
  showToast('Order saved locally (offline).');
  closeOrderModal();
});

// modal send -> now places order to server
modalSendBtn.addEventListener('click', ()=> {
  placeOrderToServer();
});

// handle saved orders when online (kept simple)
window.addEventListener('online', ()=> {
  const q = JSON.parse(localStorage.getItem('orders_queue')||'[]');
  if(q.length>0){
    if(confirm(`You have ${q.length} saved order(s). Do you want to send the first one now?`)){
      const first = q.shift();
      localStorage.setItem('orders_queue', JSON.stringify(q));
      const oldCart = cart;
      cart = first.cart; saveCart(); renderCart();
      renderMenu(document.querySelector('.category.active')?.textContent || 'All', searchInput.value || '');
      if(first.meta){ custName.value = first.meta.name || ''; custPhone.value = first.meta.phone || ''; custPickup.value = first.meta.pickup || ''; custAddress.value = first.meta.address || ''; }
      placeOrderToServer();
      cart = oldCart; saveCart(); renderCart();
    }
  }
});

// ---------------------- auth modal UI ----------------------
function showAuthChoice(){
  authChoice.style.display = 'block';
  authForms.style.display = 'none';
  document.getElementById('authTitle').textContent = 'Continue or Sign In';
}
function showAuthForms(mode='signin'){
  authChoice.style.display = 'none';
  authForms.style.display = 'block';
  document.getElementById('authTitle').textContent = 'Sign In / Sign Up';
  if(mode === 'signin'){
    tabSignIn.classList.add('active'); tabSignUp.classList.remove('active');
    signInPanel.classList.remove('hidden'); signUpPanel.classList.add('hidden');
    setTimeout(()=> signin_username.focus(), 80);
  } else {
    tabSignIn.classList.remove('active'); tabSignUp.classList.add('active');
    signInPanel.classList.add('hidden'); signUpPanel.classList.remove('hidden');
    setTimeout(()=> signup_username.focus(), 80);
  }
}

function openAuthModal(mode = 'choice'){
  authModal.setAttribute('aria-hidden','false');
  authModal.style.display = 'block';
  signinMsg.textContent = '';
  signupMsg.textContent = '';
  if(mode === 'choice') showAuthChoice();
  else if(mode === 'signin') showAuthForms('signin');
  else if(mode === 'signup') showAuthForms('signup');
}
function closeAuthModal(){
  authModal.setAttribute('aria-hidden','true');
  authModal.style.display = 'none';
}

// hooks
signInBtnTop.addEventListener('click', ()=> openAuthModal('choice'));
closeAuth.addEventListener('click', closeAuthModal);
authBackdrop.addEventListener('click', closeAuthModal);

// choice actions
guestPrimary.addEventListener('click', ()=> {
  // set guest mode and proceed (persist it so it doesn't disappear accidentally)
  guestCheckout = true;
  localStorage.setItem('guest_mode_v1','1');
  closeAuthModal();
  if(pendingOrderAttempt){
    pendingOrderAttempt = false;
    openOrderModal();
  }
});
gotoSignin.addEventListener('click', ()=> showAuthForms('signin'));

// tabs and guest
tabSignIn.addEventListener('click', ()=> showAuthForms('signin'));
tabSignUp.addEventListener('click', ()=> showAuthForms('signup'));
guestBtn.addEventListener('click', ()=> {
  guestCheckout = true;
  localStorage.setItem('guest_mode_v1','1');
  closeAuthModal();
  if(pendingOrderAttempt){
    pendingOrderAttempt = false;
    openOrderModal();
  }
});

// signin
signinBtn.addEventListener('click', async ()=> {
  const user = (signin_username.value || '').trim();
  const pass = signin_password.value || '';
  signinMsg.textContent = '';
  if(!user || !pass){ signinMsg.textContent = 'Email & password required.'; return; }
  const r = await loginSupabase({ username: user, password: pass });
  if(!r.ok){ signinMsg.textContent = r.msg || 'Login failed'; return; }
  guestCheckout = false;
  localStorage.removeItem('guest_mode_v1');
  await updateAuthUI();
  closeAuthModal();
  const profile = await getProfileFromSupabase();
  if(profile){
    custName.value = profile.name || '';
    custPhone.value = profile.phone || '';
    custAddress.value = profile.address || '';
  }
  if(pendingOrderAttempt){
    pendingOrderAttempt = false;
    openOrderModal();
  }
});

// signup
signupBtn.addEventListener('click', async ()=> {
  const user = (signup_username.value || '').trim();
  const pass = signup_password.value || '';
  const name = (signup_name.value || '').trim();
  const phone = (signup_phone.value || '').trim();
  const address = (signup_address.value || '').trim();
  signupMsg.textContent = '';
  if(!user || !pass || !name || !phone || !address){
    signupMsg.textContent = 'All fields are required.'; return;
  }
  const r = await signupSupabase({ username: user, password: pass, name, phone, address });
  if(!r.ok){ signupMsg.textContent = r.msg || 'Signup failed'; return; }

  guestCheckout = false;
  localStorage.removeItem('guest_mode_v1');
  await updateAuthUI();
  closeAuthModal();
  showToast('Account created successfully');
  openOrderModal();
});

// signout
signOutBtn.addEventListener('click', async ()=> {
  await signoutSupabase();
  await updateAuthUI();
  showToast('Signed out');
});

// ---------------------- account modal handlers ----------------------
function openAccountModal(){
  accountModal.setAttribute('aria-hidden','false');
  accountModal.style.display = 'block';
  accountMsg.textContent = '';
  passMsg.textContent = '';
  (async ()=> {
    const profile = await getProfileFromSupabase();
    if(profile){
      acctName.value = profile.name || '';
      acctPhone.value = profile.phone || '';
      acctAddress.value = profile.address || '';
    }
  })();
}
function closeAccountModal(){
  accountModal.setAttribute('aria-hidden','true');
  accountModal.style.display = 'none';
}
closeAccount.addEventListener('click', closeAccountModal);
accountBackdrop.addEventListener('click', closeAccountModal);
acctCancel.addEventListener('click', closeAccountModal);

acctSave.addEventListener('click', async ()=> {
  const name = (acctName.value || '').trim();
  const phone = (acctPhone.value || '').trim();
  const address = (acctAddress.value || '').trim();
  accountMsg.textContent = 'Saving…';
  const r = await updateSupabaseProfile({ name, phone, address });
  if(!r.ok){
    accountMsg.style.color = '#b00';
    accountMsg.textContent = 'Update failed: ' + (r.msg || 'unknown error');
    return;
  }
  accountMsg.style.color = 'green';
  accountMsg.textContent = 'Saved successfully.';
  await updateAuthUI();
  setTimeout(()=> { closeAccountModal(); accountMsg.textContent = ''; }, 900);
});

// change password
changePassBtn.addEventListener('click', async ()=> {
  passMsg.textContent = '';
  const cur = (current_password.value || '').trim();
  const nw = (new_password.value || '').trim();
  const conf = (confirm_new_password.value || '').trim();
  if(!cur || !nw || !conf) { passMsg.textContent = 'All fields are required.'; return; }
  if(nw !== conf){ passMsg.textContent = 'New passwords do not match.'; return; }
  passMsg.textContent = 'Updating…';
  const r = await changeSupabasePassword({ currentPassword: cur, newPassword: nw });
  if(!r.ok){ passMsg.style.color = '#b00'; passMsg.textContent = r.msg || 'Password change failed'; return; }
  passMsg.style.color = 'green';
  passMsg.textContent = 'Password updated.';
  current_password.value = new_password.value = confirm_new_password.value = '';
  setTimeout(()=> { passMsg.textContent = ''; }, 2000);
});

// ---------------------- side menu + install + search ----------------------
const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const menuBackdrop = document.getElementById('menuBackdrop');
const closeMenuBtn = document.getElementById('closeMenuBtn');
function openSideMenu(){ sideMenu.classList.add('open'); menuBackdrop.classList.add('visible'); menuBackdrop.hidden = false; document.body.classList.add('menu-open'); sideMenu.setAttribute('aria-hidden','false'); menuBtn.setAttribute('aria-expanded','true'); closeMenuBtn.focus(); }
function closeSideMenu(){ sideMenu.classList.remove('open'); menuBackdrop.classList.remove('visible'); setTimeout(()=> { menuBackdrop.hidden = true; }, 260); document.body.classList.remove('menu-open'); sideMenu.setAttribute('aria-hidden','true'); menuBtn.setAttribute('aria-expanded','false'); menuBtn.focus(); }
if(menuBtn) menuBtn.addEventListener('click', openSideMenu);
if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenu);
if(menuBackdrop) menuBackdrop.addEventListener('click', closeSideMenu);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && sideMenu.classList.contains('open')) closeSideMenu(); });

document.querySelectorAll('.side-link').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const action = btn.getAttribute('data-action');
    closeSideMenu();
    setTimeout(async () => {
      if(action === 'home'){ renderCategories(); currentRenderLimit = 24; renderMenu('All', ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if(action === 'account'){
        const profile = await getProfileFromSupabase();
        if(!profile){
          openAuthModal('choice');
        } else {
          openAccountModal();
        }
      }
      else if(action === 'admin'){
        const profile = await getProfileFromSupabase();
        if(!profile || profile.role !== 'admin'){
          showToast('Admin access required');
          return;
        }
        window.location.href = '/admin.html';
      }
      else if(action === 'feedback'){ const subject = encodeURIComponent(`Feedback for ${bakeryName}`); window.location.href = `mailto:feedback@${bakeryName.replace(/\s+/g,'').toLowerCase()}.com?subject=${subject}`; }
      else if(action === 'contact'){ window.location.href = `tel:+${bakeryPhone}`; }
    }, 300);
  });
});

// Search
document.getElementById('searchBtn').addEventListener('click', ()=> {
  const q = searchInput.value || '';
  const active = document.querySelector('.category.active')?.textContent || 'All';
  currentRenderLimit = Infinity;
  renderMenu(active, q, currentRenderLimit);
});
searchInput.addEventListener('keyup', (e)=> { if(e.key === 'Enter') document.getElementById('searchBtn').click(); });

// Install prompt handling
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; installBtn.setAttribute('aria-hidden','false'); });
installBtn.addEventListener('click', async ()=>{ if(deferredPrompt){ deferredPrompt.prompt(); try { const choice = await deferredPrompt.userChoice; installBtn.hidden = true; deferredPrompt = null; } catch(e){ installBtn.hidden = true; deferredPrompt = null; } } else { alert("If Install isn't available, add from Chrome menu → 'Add to Home screen' (Android)."); } });
window.addEventListener('appinstalled', () => { installBtn.hidden = true; deferredPrompt = null; });
(function maybeShowManualInstallHint(){ const visits = Number(localStorage.getItem('visits_count_v1') || 0) + 1; localStorage.setItem('visits_count_v1', visits); if(visits >= 3 && !deferredPrompt && !navigator.standalone){ installBtn.hidden = false; installBtn.addEventListener('click', ()=> { alert("To install: open Chrome menu → 'Add to Home screen'."); }, { once: true }); } })();

// ------------------- initial boot -------------------
async function boot(){
  await loadMenuFromSupabase();
  uniqueCategories = computeCategoriesFrom(menuItems);
  renderCategories();
  currentRenderLimit = 24;
  renderMenu('All', '', currentRenderLimit);
  renderCart();
  await updateAuthUI();
}
boot();

// ------------------- Add missing order button handler (was absent) -------------------
orderBtn.addEventListener('click', async ()=> {
  if(!cart || cart.length === 0){ showToast('Cart is empty'); return; }
  const profile = await getProfileFromSupabase();
  const persistedGuest = localStorage.getItem('guest_mode_v1') === '1';
  if(!profile && !persistedGuest && !guestCheckout){
    pendingOrderAttempt = true;
    openAuthModal('choice');
    return;
  }
  openOrderModal();
});

// ------------------- simple keyboard / modal close handlers -------------------
modalCloseBtn.addEventListener('click', closeOrderModal);
modalCancelBtn.addEventListener('click', closeOrderModal);
modalBackdrop.addEventListener('click', closeOrderModal);

// quick open account from header badge
accountBadge.addEventListener('click', async ()=> {
  const profile = await getProfileFromSupabase();
  if(!profile) openAuthModal('choice'); else openAccountModal();
});

// expose a small API for debugging in console
window.Gurj = {
  supabase,
  reloadMenu: async ()=> { await loadMenuFromSupabase(); renderCategories(); renderMenu('All',''); },
  showToast
};
