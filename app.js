// app.js (module) — Supabase-based auth + UI, orders persistence (lighter main app)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://dprmcjetkzrmwydzodiv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcm1jamV0a3pybXd5ZHpvZGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTEzNTgsImV4cCI6MjA4NTM2NzM1OH0.F6jeejegiXgKcnIXRspCehi9SLCtAqbBds4JGd9lxcc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// PHONE & SHOP INFO
const bakeryName = "Gurj Bakery";

// --- state
let cart = JSON.parse(localStorage.getItem('cart_v1') || '[]');
let menuItems = []; // will be loaded from Supabase
let guestCheckout = false; // when user chooses "Continue as guest"
let orderType = 'pickup';
const DELIVERY_FEE = 50;
const DELIVERY_MIN_TOTAL = 199;
const PICKUP_ADDRESS_DEFAULT = 'Always Shine Location';
const DEFAULT_CAKE_WEIGHTS = ['0.5 kg','1 kg','2 kg'];

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
const modalCloseBtn = document.getElementById('closeModal');
const deliveryNote = document.getElementById('deliveryNote');
const pickupLabel = document.getElementById('pickupLabel');
const orderTypeInputs = Array.from(document.querySelectorAll('input[name="orderType"]'));

const custName = document.getElementById('custName');
const custPhone = document.getElementById('custPhone');
const custPickup = document.getElementById('custPickup');
const custAddress = document.getElementById('custAddress');
const cakeModal = document.getElementById('cakeModal');
const cakeBackdrop = document.getElementById('cakeBackdrop');
const closeCakeModalBtn = document.getElementById('closeCakeModal');
const cakeCancelBtn = document.getElementById('cakeCancelBtn');
const cakeConfirmBtn = document.getElementById('cakeConfirmBtn');
const cakeWeightSelect = document.getElementById('cakeWeightSelect');
const cakeEggSelect = document.getElementById('cakeEggSelect');
const cakeModalItemName = document.getElementById('cakeModalItemName');

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
const contactModal = document.getElementById('contactModal');
const contactBackdrop = document.getElementById('contactBackdrop');
const closeContact = document.getElementById('closeContact');
const contactCloseBtn = document.getElementById('contactCloseBtn');

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
function isAnonymousUser(user){
  return Boolean(user?.is_anonymous || user?.app_metadata?.provider === 'anonymous');
}

// ---------------------- Supabase helpers ----------------------
async function getProfileFromSupabase(){
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user || null;
    if(!user || isAnonymousUser(user)) return null;
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

async function ensureGuestSession(){
  try {
    const { data } = await supabase.auth.getUser();
    if(data?.user) return data.user;
    const { data: anonData, error } = await supabase.auth.signInAnonymously();
    if(error) { console.warn('anonymous sign-in failed', error); return null; }
    return anonData?.user || null;
  } catch(e){
    console.warn('ensureGuestSession error', e);
    return null;
  }
}

async function activateGuestMode(){
  guestCheckout = true;
  localStorage.setItem('guest_mode_v1','1');
  return true;
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
supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if(!user || !isAnonymousUser(user)){
    guestCheckout = false;
    localStorage.removeItem('guest_mode_v1');
  }
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
        image_path: row.image_path || null,
        item_type: row.item_type || 'veg',
        meat_type: row.meat_type || 'veg',
        is_cake: Boolean(row.is_cake),
        weight_options: Array.isArray(row.weight_options) && row.weight_options.length ? row.weight_options : DEFAULT_CAKE_WEIGHTS,
        egg_options: Array.isArray(row.egg_options) && row.egg_options.length ? row.egg_options : ['egg', 'eggless']
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
  return '/icons/192.png';
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

  // add/remove helper class when only one item present (prevents elongated single-item card)
  if(filtered.length === 1) itemsEl.classList.add('single-item');
  else itemsEl.classList.remove('single-item');

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
    img.onerror = function(){ this.onerror = null; this.src = '/icons/192.png'; };

    const title = document.createElement('h3');
    title.textContent = item.name;

    const price = document.createElement('div');
    price.className = 'price-badge';
    price.textContent = `₹${item.price}`;

    const qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';
    const tags = [item.item_type, item.meat_type, item.category].filter(Boolean);
    qtyRow.innerHTML = `
      <div class="qty-controls">
        <button class="minus" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
        <div class="qty-display" data-id="${item.id}" aria-live="polite">${getQty(item.id)}</div>
        <button class="plus" aria-label="Increase ${escapeHtml(item.name)}">+</button>
      </div>
      <div>
        <div class="item-meta">${tags.map(tag => `<span class="item-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>
    `;

    div.appendChild(img);
    div.appendChild(price);
    div.appendChild(title);
    div.appendChild(qtyRow);

    div.querySelector('.plus').addEventListener('click', ()=> handleAddItem(item));
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
function cartItemKey(item){
  return `${item.id}::${item.weight || ''}::${item.egg_preference || ''}`;
}
function getQty(id){ return cart.filter(c=>c.id===id).reduce((sum, entry)=> sum + Number(entry.qty || 0), 0); }
function openCakeModal(item){
  if(!cakeModal || !item) return;
  cakeModalItemName.textContent = item.name;
  cakeWeightSelect.innerHTML = (item.weight_options || DEFAULT_CAKE_WEIGHTS).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
  cakeEggSelect.innerHTML = (item.egg_options || ['egg', 'eggless']).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
  cakeModal.dataset.itemId = String(item.id);
  cakeModal.style.display = 'block';
  cakeModal.setAttribute('aria-hidden', 'false');
}
function closeCakeModal(){
  if(!cakeModal) return;
  cakeModal.style.display = 'none';
  cakeModal.setAttribute('aria-hidden', 'true');
  delete cakeModal.dataset.itemId;
}
function handleAddItem(item){
  if(!item) return;
  if(item.is_cake){
    openCakeModal(item);
    return;
  }
  addToCart(item);
}
function addToCart(item){
  if(!item) return;
  const key = cartItemKey(item);
  const found = cart.find(c=>cartItemKey(c)===key);
  if(found) found.qty++;
  else cart.push({
    id:item.id,
    name:item.name,
    price:item.price,
    qty:1,
    category:item.category || '',
    item_type:item.item_type || '',
    meat_type:item.meat_type || '',
    weight:item.weight || null,
    egg_preference:item.egg_preference || null
  });
  saveCart(); renderCart(); updateQtyDisplay(item.id);
}
function removeFromCart(item){ if(!item) return; const found = cart.find(c=>cartItemKey(c)===cartItemKey(item)); if(!found) return; found.qty--; if(found.qty<=0) cart = cart.filter(c=>cartItemKey(c)!==cartItemKey(item)); saveCart(); renderCart(); updateQtyDisplay(item.id); }
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

  const subtotal = cart.reduce((s,i)=> s + (i.price*i.qty), 0);
  if(orderType === 'delivery' && subtotal < DELIVERY_MIN_TOTAL){
    const diff = DELIVERY_MIN_TOTAL - subtotal;
    showToast(`Home delivery is available on orders above ₹${DELIVERY_MIN_TOTAL}. Please add items worth ₹${diff}.`);
    return;
  }
  let guestUser = null;
  if(!profile && isGuest){
    guestUser = await ensureGuestSession();
  }
  const total = orderType === 'delivery' ? subtotal + DELIVERY_FEE : subtotal;

  const selectedDateTime = (custPickup.value || '').trim();
  if(!selectedDateTime){
    showToast('Please select pickup/delivery date and time');
    return;
  }
  const orderAddress = orderType === 'pickup'
    ? PICKUP_ADDRESS_DEFAULT
    : ((custAddress.value || (profile ? profile.address : '') || '').trim());
  if(orderType === 'delivery' && !orderAddress){
    showToast('Please provide delivery address');
    return;
  }

  const payload = {
    user_id: profile ? profile.id : (guestUser ? guestUser.id : null),
    items: cart,
    total,
    name: custName.value || (profile ? profile.name : '') || '',
    phone: custPhone.value || (profile ? profile.phone : '') || '',
    pickup: selectedDateTime,
    address: orderAddress,
    order_mode: orderType,
    scheduled_at: new Date(selectedDateTime).toISOString(),
    order_status: 'pending',
    payment_status: 'pending'
  };

  // if signed-in user updated address/name, save back to profile
  if(profile && orderType === 'delivery' && payload.address && payload.address !== profile.address){
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

function setDefaultDateTime(){
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0,16);
}

function updateOrderTypeUI(){
  if(pickupLabel){
    pickupLabel.textContent = orderType === 'delivery' ? 'Delivery Date & Time' : 'Pickup Date & Time';
  }
  if(custPickup && !custPickup.value){
    custPickup.value = setDefaultDateTime();
  }
  if(orderType === 'pickup'){
    custAddress.value = PICKUP_ADDRESS_DEFAULT;
    custAddress.setAttribute('readonly', 'true');
  } else {
    if(custAddress.value === PICKUP_ADDRESS_DEFAULT) custAddress.value = '';
    custAddress.removeAttribute('readonly');
  }
  renderOrderModal();
}

function setupOrderTypeControls(){
  if(orderTypeInputs.length === 0) return;
  const checked = orderTypeInputs.find(input => input.checked);
  if(checked) orderType = checked.value;
  orderTypeInputs.forEach(input => {
    input.addEventListener('change', () => {
      orderType = input.value;
      updateOrderTypeUI();
    });
  });
  updateOrderTypeUI();
}

function openOrderModal(){
  (async ()=>{
    const profile = await getProfileFromSupabase();
    if(profile){
      custName.value = profile.name || '';
      custPhone.value = profile.phone || '';
      custAddress.value = profile.address || '';
    }
    if(!custPickup.value) custPickup.value = setDefaultDateTime();
  })();
  updateOrderTypeUI();
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
    const rowKey = cartItemKey(item);
    const cakeText = [item.weight, item.egg_preference].filter(Boolean).join(' • ');
    itemWrap.className = 'modal-item';
    itemWrap.innerHTML = `
      <div style="flex:1">
        <h4>${escapeHtml(item.name)}</h4>
        <div style="font-size:13px;color:var(--muted)">₹${item.price} each${cakeText ? ` • ${escapeHtml(cakeText)}` : ''}</div>
      </div>
      <div>
        <div class="m-qty">
          <button class="m-minus" data-key="${escapeHtml(rowKey)}" aria-label="Decrease">−</button>
          <span class="m-qty-display" data-key="${escapeHtml(rowKey)}">${item.qty}</span>
          <button class="m-plus" data-key="${escapeHtml(rowKey)}" aria-label="Increase">+</button>
        </div>
        <div style="text-align:right;margin-top:6px">
          <button class="m-delete" data-key="${escapeHtml(rowKey)}" style="font-size:12px;color:#b00;background:transparent;border:none;cursor:pointer">Delete</button>
        </div>
      </div>
    `;
    modalItemsEl.appendChild(itemWrap);
  });

  modalItemsEl.querySelectorAll('.m-plus').forEach(b=>{ b.addEventListener('click', ()=> { const key = b.getAttribute('data-key'); const item = cart.find(c=>cartItemKey(c)===key); if(item){ addToCart(item); renderOrderModal(); } }); });
  modalItemsEl.querySelectorAll('.m-minus').forEach(b=>{ b.addEventListener('click', ()=> { const key = b.getAttribute('data-key'); const item = cart.find(c=>cartItemKey(c)===key); if(item){ removeFromCart(item); renderOrderModal(); } }); });
  modalItemsEl.querySelectorAll('.m-delete').forEach(b=>{ b.addEventListener('click', ()=> { const key = b.getAttribute('data-key'); cart = cart.filter(c=>cartItemKey(c)!==key); saveCart(); renderCart(); renderOrderModal(); }); });

  const subtotal = cart.reduce((s,i)=> s + (i.price*i.qty), 0);
  let total = subtotal;
  if(orderType === 'delivery'){
    total += DELIVERY_FEE;
  }
  modalTotalEl.textContent = `Total: ₹${total}`;
  if(deliveryNote){
    if(orderType === 'delivery'){
      if(subtotal < DELIVERY_MIN_TOTAL){
        const diff = DELIVERY_MIN_TOTAL - subtotal;
        deliveryNote.textContent = `Home delivery is available on orders above ₹${DELIVERY_MIN_TOTAL}. Please add items worth ₹${diff}.`;
      } else {
        deliveryNote.textContent = `Extra ₹${DELIVERY_FEE} for Home Delivery.`;
      }
    } else {
      deliveryNote.textContent = '';
    }
  }
}

// modal send -> now places order to server
modalSendBtn.addEventListener('click', ()=> {
  placeOrderToServer();
});


if(cakeConfirmBtn){
  cakeConfirmBtn.addEventListener('click', ()=> {
    const id = Number(cakeModal?.dataset?.itemId || 0);
    const selected = menuItems.find(m => m.id === id);
    if(!selected) return;
    addToCart({
      ...selected,
      weight: cakeWeightSelect?.value || '0.5 kg',
      egg_preference: cakeEggSelect?.value || 'egg'
    });
    closeCakeModal();
  });
}
if(closeCakeModalBtn) closeCakeModalBtn.addEventListener('click', closeCakeModal);
if(cakeCancelBtn) cakeCancelBtn.addEventListener('click', closeCakeModal);
if(cakeBackdrop) cakeBackdrop.addEventListener('click', closeCakeModal);

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
  (async ()=> {
    const ok = await activateGuestMode();
    if(!ok) return;
    closeAuthModal();
    if(pendingOrderAttempt){
      pendingOrderAttempt = false;
      openOrderModal();
    }
  })();
});
gotoSignin.addEventListener('click', ()=> showAuthForms('signin'));

// tabs and guest
tabSignIn.addEventListener('click', ()=> showAuthForms('signin'));
tabSignUp.addEventListener('click', ()=> showAuthForms('signup'));
guestBtn.addEventListener('click', ()=> {
  (async ()=> {
    const ok = await activateGuestMode();
    if(!ok) return;
    closeAuthModal();
    if(pendingOrderAttempt){
      pendingOrderAttempt = false;
      openOrderModal();
    }
  })();
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

function openContactModal(){
  if(!contactModal) return;
  contactModal.setAttribute('aria-hidden','false');
  contactModal.style.display = 'block';
}
function closeContactModal(){
  if(!contactModal) return;
  contactModal.setAttribute('aria-hidden','true');
  contactModal.style.display = 'none';
}
if(closeContact) closeContact.addEventListener('click', closeContactModal);
if(contactBackdrop) contactBackdrop.addEventListener('click', closeContactModal);
if(contactCloseBtn) contactCloseBtn.addEventListener('click', closeContactModal);

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
      else if(action === 'feedback'){
        const text = encodeURIComponent(`Feedback for ${bakeryName}: `);
        window.location.href = `https://wa.me/9501800529?text=${text}`;
      }
      else if(action === 'contact'){
        openContactModal();
      }
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
  setupOrderTypeControls();
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
