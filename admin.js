// admin.js — light admin page (menu management + orders)
// Note: similar supabase config as app.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://dprmcjetkzrmwydzodiv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcm1jamV0a3pybXd5ZHpvZGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTEzNTgsImV4cCI6MjA4NTM2NzM1OH0.F6jeejegiXgKcnIXRspCehi9SLCtAqbBds4JGd9lxcc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const menuList = document.getElementById('menuList');
const ordersList = document.getElementById('ordersList');
const admin_name = document.getElementById('admin_name');
const admin_price = document.getElementById('admin_price');
const admin_category = document.getElementById('admin_category');
const admin_item_type = document.getElementById('admin_item_type');
const admin_is_cake = document.getElementById('admin_is_cake');
const admin_photo = document.getElementById('admin_photo');
const adminSaveBtn = document.getElementById('adminSaveBtn');
const adminCancelBtn = document.getElementById('adminCancelBtn');
const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');
const cropBtn = document.getElementById('cropBtn');
const uploadStatus = document.getElementById('uploadStatus');
const signOutBtn = document.getElementById('signOutBtn');
const adminRefreshBtn = document.getElementById('adminRefreshBtn');
const signInBtn = document.getElementById('signInBtn');
const accountBadge = document.getElementById('accountBadge');
const accountName = document.getElementById('accountName');

const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const menuBackdrop = document.getElementById('menuBackdrop');
const adminTabs = document.getElementById('adminTabs');
const panelAdd = document.getElementById('panel-add');
const panelMenu = document.getElementById('panel-menu');
const panelOrders = document.getElementById('panel-orders');
const menuSearch = document.getElementById('menuSearch');
const menuSearchClear = document.getElementById('menuSearchClear');
const ordersRefreshBtn = document.getElementById('ordersRefreshBtn');

let editingId = null;
let selectedFile = null;
let useImagePath = null;
let menuItemsCache = [];

// side menu handlers (same as main site)
function openSideMenu(){ sideMenu.classList.add('open'); menuBackdrop.classList.add('visible'); menuBackdrop.hidden = false; document.body.classList.add('menu-open'); sideMenu.setAttribute('aria-hidden','false'); menuBtn.setAttribute('aria-expanded','true'); closeMenuBtn.focus(); }
function closeSideMenu(){ sideMenu.classList.remove('open'); menuBackdrop.classList.remove('visible'); setTimeout(()=> { menuBackdrop.hidden = true; }, 260); document.body.classList.remove('menu-open'); sideMenu.setAttribute('aria-hidden','true'); menuBtn.setAttribute('aria-expanded','false'); menuBtn.focus(); }
if(menuBtn) menuBtn.addEventListener('click', openSideMenu);
if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenu);
if(menuBackdrop) menuBackdrop.addEventListener('click', closeSideMenu);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && sideMenu.classList.contains('open')) closeSideMenu(); });

document.querySelectorAll('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-action');
    closeSideMenu();
    setTimeout(() => {
      if(action === 'home'){ window.location.href = '/'; }
      else if(action === 'account'){ window.location.href = '/'; }
      else if(action === 'admin'){ window.location.href = '/admin.html'; }
      else if(action === 'feedback'){ window.location.href = 'mailto:feedback@gurjbakery.com?subject=Feedback%20for%20Gurj%20Bakery'; }
      else if(action === 'contact'){ window.location.href = 'tel:+917417191948'; }
    }, 300);
  });
});

function setActivePanel(panel){
  const buttons = adminTabs?.querySelectorAll('.category') || [];
  buttons.forEach(btn => {
    const isActive = btn.getAttribute('data-panel') === panel;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if(panelAdd) panelAdd.hidden = panel !== 'add';
  if(panelMenu) panelMenu.hidden = panel !== 'menu';
  if(panelOrders) panelOrders.hidden = panel !== 'orders';
}

if(adminTabs){
  adminTabs.querySelectorAll('.category').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel');
      setActivePanel(panel);
    });
  });
  setActivePanel('add');
}

if(menuSearch){
  menuSearch.addEventListener('input', () => renderMenuItems());
}
if(menuSearchClear){
  menuSearchClear.addEventListener('click', () => {
    if(menuSearch) menuSearch.value = '';
    renderMenuItems();
  });
}

// back & sign out (safe guards)
if(signOutBtn) signOutBtn.addEventListener('click', async ()=> { await supabase.auth.signOut(); window.location.href = '/'; });
if(adminRefreshBtn) adminRefreshBtn.addEventListener('click', ()=> fetchAndRender());
if(ordersRefreshBtn) ordersRefreshBtn.addEventListener('click', ()=> renderOrders());
if(signInBtn) signInBtn.addEventListener('click', ()=> { window.location.href = '/'; });

function isAnonymousUser(user){
  return Boolean(user?.is_anonymous || user?.app_metadata?.provider === 'anonymous');
}

async function getProfile(){
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  if(!user || isAnonymousUser(user)) return null;
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    name: metadata.name || user.email || 'Admin',
    role: metadata.role || ''
  };
}

async function updateAuthUI(){
  const profile = await getProfile();
  if(profile){
    signInBtn?.classList.add('hidden');
    accountBadge?.classList.remove('hidden');
    if(accountName) accountName.textContent = profile.name || 'Admin';
    document.querySelectorAll('.side-link').forEach(btn=>{
      if(btn.getAttribute('data-action') === 'admin'){
        btn.style.display = profile.role === 'admin' ? 'block' : 'none';
      }
    });
  } else {
    signInBtn?.classList.remove('hidden');
    accountBadge?.classList.add('hidden');
    if(accountName) accountName.textContent = '';
    document.querySelectorAll('.side-link').forEach(btn=>{
      if(btn.getAttribute('data-action') === 'admin'){
        btn.style.display = 'none';
      }
    });
  }
}

// auth guard: only admin role allowed
(async function ensureAdmin(){
  await updateAuthUI();
  const profile = await getProfile();
  if(!profile){
    alert('Please sign in as admin first.');
    window.location.href = '/';
    return;
  }
  if(profile.role !== 'admin'){
    alert('Admin access required.');
    window.location.href = '/';
    return;
  }
  await fetchAndRender();
})();

async function fetchAndRender(){
  await renderMenuItems();
  await renderOrders();
  // poll for new orders every few seconds so admin sees new orders without refresh
  if(!fetchAndRender._poll) {
    fetchAndRender._poll = setInterval(async ()=> {
      await renderOrders();
    }, 60000);
  }
}

async function renderMenuItems(){
  menuList.innerHTML = 'Loading…';
  try {
    const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
    if(error){ menuList.innerHTML = 'Error loading items'; console.error('menu_items fetch error', error); return; }
    menuItemsCache = data || [];
    const query = (menuSearch?.value || '').trim().toLowerCase();
    const filtered = menuItemsCache.filter(it => {
      if(!query) return true;
      return (it.name || '').toLowerCase().includes(query) || (it.category || '').toLowerCase().includes(query);
    });
    if(!filtered || filtered.length === 0){ menuList.innerHTML = '<div style="color:var(--muted)">No items</div>'; return; }
    menuList.innerHTML = '';
    filtered.forEach(it=>{
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const imgUrl = it.image_path ? supabase.storage.from('menu-images').getPublicUrl(it.image_path).data.publicUrl : '';
      div.innerHTML = `
        <img src="${imgUrl || '/icons/192.png'}" class="thumb" onerror="this.src='/icons/192.png'"/>
        <div style="flex:1">
          <strong>${escapeHtml(it.name)}</strong><div style="font-size:13px;color:var(--muted)">₹${it.price} • ${escapeHtml(it.category)} • ${escapeHtml(it.item_type || 'veg')}${it.is_cake ? ' • cake' : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="editBtn" data-id="${it.id}">Edit</button>
          <button class="delBtn" data-id="${it.id}" style="color:#b00">Delete</button>
        </div>
      `;
      menuList.appendChild(div);
    });

    // hook up edit/delete
    menuList.querySelectorAll('.editBtn').forEach(b=>{
      b.addEventListener('click', async () => {
        const id = Number(b.getAttribute('data-id'));
        const { data, error } = await supabase.from('menu_items').select('*').eq('id', id).single();
        if(error || !data) { alert('Could not fetch item'); return; }
        editingId = id;
        admin_name.value = data.name || '';
        admin_price.value = data.price || '';
        admin_category.value = data.category || '';
        if(admin_item_type) admin_item_type.value = data.item_type || 'veg';
        if(admin_is_cake) admin_is_cake.checked = Boolean(data.is_cake);
        useImagePath = data.image_path || null;
        previewWrap.style.display = 'none';
        setActivePanel('add');
        panelAdd?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    menuList.querySelectorAll('.delBtn').forEach(b=>{
      b.addEventListener('click', async () => {
        const id = Number(b.getAttribute('data-id'));
        if(!confirm('Delete item?')) return;
        const { error } = await supabase.from('menu_items').delete().eq('id', id);
        if(error){ alert('Delete failed'); console.error('delete error', error); return; }
        await renderMenuItems();
      });
    });

  } catch(e){
    menuList.innerHTML = 'Unexpected error';
    console.error('renderMenuItems unexpected', e);
  }
}

async function getNextMenuItemId(){
  const { data, error } = await supabase.from('menu_items').select('id').order('id', { ascending: false }).limit(1);
  if(error || !data || data.length === 0) return 1;
  return Number(data[0].id || 0) + 1;
}

async function updateOrderState(id, updates){
  const { error } = await supabase.from('orders').update(updates).eq('id', id);
  if(error){
    alert(`Update failed: ${error.message || 'unknown error'}`);
    console.error('order update error', error);
    return false;
  }
  return true;
}

function statusChip(label, css){
  return `<span class="status-chip ${css}">${escapeHtml(label)}</span>`;
}

async function renderOrders(){
  ordersList.innerHTML = 'Loading…';
  try {
    let resp = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
    if(resp.error){
      console.warn('order fetch by created_at failed, falling back to created column', resp.error);
      resp = await supabase.from('orders').select('*').order('created', { ascending: false }).limit(50);
    }
    const { data, error } = resp;
    if(error){
      ordersList.innerHTML = `Error loading orders: ${escapeHtml(error.message || 'unknown error')}`;
      console.error('orders fetch error', error);
      return;
    }
    if(!data || data.length===0){ ordersList.innerHTML = '<div style="color:var(--muted)">No orders</div>'; return; }
    ordersList.innerHTML = '';
    data.forEach(o=>{
      const cre = o.created_at || o.created || o.createdAt || o.created_on || null;
      const when = cre ? new Date(cre).toLocaleString() : '(unknown)';
      const scheduled = o.scheduled_at ? new Date(o.scheduled_at).toLocaleString() : (o.pickup || '(not set)');
      const orderMode = o.order_mode || ((String(o.pickup || '').toLowerCase().includes('delivery')) ? 'delivery' : 'pickup');
      const orderStatus = o.order_status || 'pending';
      const paymentStatus = o.payment_status || 'pending';
      let items = [];
      if(Array.isArray(o.items)) items = o.items;
      else if(typeof o.items === 'string'){
        try { items = JSON.parse(o.items); } catch(e){ items = []; }
      }
      const wrap = document.createElement('div');
      wrap.style.border = '1px solid #f0eaea';
      wrap.style.padding = '10px';
      wrap.style.marginBottom = '10px';
      wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div><strong>#${o.id} ${escapeHtml(o.name || 'Guest')}</strong> • ₹${o.total}</div>
          <div style="font-size:12px;color:var(--muted)">${when}</div>
        </div>
        <div class="order-badges">
          ${statusChip(`Mode: ${orderMode}`, 'status-chip')}
          ${statusChip(`Order: ${orderStatus}`, `order-${escapeHtml(orderStatus)}`)}
          ${statusChip(`Payment: ${paymentStatus}`, paymentStatus === 'done' ? 'payment-done' : 'status-chip')}
        </div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">Phone: ${escapeHtml(o.phone || '-')}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:2px">Address: ${escapeHtml(o.address || '-')}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:2px">Scheduled: ${escapeHtml(scheduled)}</div>
        <div style="margin-top:8px;border-top:1px dashed #eee;padding-top:8px">
          ${ items.map(it=>`<div style="font-size:13px">${escapeHtml(it.name)}${it.weight ? ` (${escapeHtml(it.weight)})` : ''}${it.egg_preference ? ` (${escapeHtml(it.egg_preference)})` : ''} x ${it.qty} = ₹${Number(it.price||0)*Number(it.qty||0)}</div>`).join('') }
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="markDeliveredBtn" data-id="${o.id}">Mark Delivered</button>
          <button class="markPaymentBtn" data-id="${o.id}">Payment Done</button>
          <button class="markCancelledBtn" data-id="${o.id}" style="color:#b00">Cancel Order</button>
        </div>
      `;
      ordersList.appendChild(wrap);
    });

    ordersList.querySelectorAll('.markDeliveredBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-id'));
        if(await updateOrderState(id, { order_status: 'delivered' })) await renderOrders();
      });
    });
    ordersList.querySelectorAll('.markPaymentBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-id'));
        if(await updateOrderState(id, { payment_status: 'done' })) await renderOrders();
      });
    });
    ordersList.querySelectorAll('.markCancelledBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-id'));
        if(!confirm('Mark this order as cancelled?')) return;
        if(await updateOrderState(id, { order_status: 'cancelled' })) await renderOrders();
      });
    });
  } catch(e){
    ordersList.innerHTML = 'Unexpected error';
    console.error('renderOrders unexpected', e);
  }
}

// image preview and client-side resize (simple)
if(admin_photo) admin_photo.addEventListener('change', (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  selectedFile = f;
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImg.src = ev.target.result;
    previewWrap.style.display = 'block';
    useImagePath = null;
  };
  reader.readAsDataURL(f);
});

// resize image using canvas (maintain aspect, max width 1200)
async function resizeImageDataURL(dataUrl, maxW = 1200, maxH = 900){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

// when admin clicks crop (resize) -> prepare upload
cropBtn.addEventListener('click', async ()=>{
  if(!previewImg.src) return;
  cropBtn.disabled = true;
  try {
    const blob = await resizeImageDataURL(previewImg.src, 1200, 900);
    selectedFile = new File([blob], `menu-${Date.now()}.jpg`, { type: 'image/jpeg' });
    showTemp('Image ready to upload');
  } catch(e){
    alert('Resize failed');
    console.error('resize error', e);
  } finally { cropBtn.disabled = false; }
});

function showTemp(msg){
  uploadStatus.style.display = 'inline-block';
  uploadStatus.textContent = msg;
  setTimeout(()=> { uploadStatus.style.display = 'none'; }, 1600);
}

adminSaveBtn.addEventListener('click', async ()=>{
  const name = (admin_name.value || '').trim();
  const price = Number(admin_price.value || 0);
  const category = (admin_category.value || '').trim() || 'Uncategorized';
  const item_type = (admin_item_type?.value || 'veg').trim();
  const is_cake = Boolean(admin_is_cake?.checked);
  if(!name || !price){ alert('Name & price required'); return; }

  adminSaveBtn.disabled = true;
  uploadStatus.style.display = 'inline-block';
  uploadStatus.textContent = 'Uploading image…';

  let image_path = useImagePath || null;

  if(selectedFile){
    // generate path and upload to bucket 'menu-images'
    const safeName = selectedFile.name.replace(/\s+/g,'_');
    const uniqueId = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
    const path = `menu-${uniqueId}-${safeName}`;
    try {
      const { data, error } = await supabase.storage.from('menu-images').upload(path, selectedFile, { cacheControl: '3600', upsert: true });
      if(error){
        console.error('upload error', error);
        alert(`Image upload failed: ${error.message || 'check storage policies for menu-images bucket.'}`);
        image_path = null;
      }
      else image_path = data.path;
    } catch(e){
      console.error(e);
      alert('Image upload failed. Check storage policies for menu-images bucket.');
    }
  }

  uploadStatus.textContent = 'Saving item…';
  try {
    if(editingId){
      const updates = { name, price, category, item_type, is_cake };
      if(image_path) updates.image_path = image_path;
      const { error } = await supabase.from('menu_items').update(updates).eq('id', editingId);
      if(error) { alert('Update failed'); console.error('update error', error); }
      else { showTemp('Updated'); }
    } else {
      const nextId = await getNextMenuItemId();
      const { error } = await supabase.from('menu_items').insert([{ id: nextId, name, price, category, item_type, meat_type: item_type, is_cake, image_path }]);
      if(error){
        if(error.code === '23505'){
          alert('Add failed: duplicate ID. Try again.');
          console.error('insert error', error);
        } else {
          alert('Add failed');
          console.error('insert error', error);
        }
      } else { showTemp('Added'); }
    }
    // reset form
    admin_name.value = admin_price.value = admin_category.value = '';
    if(admin_item_type) admin_item_type.value = 'veg';
    if(admin_is_cake) admin_is_cake.checked = false;
    admin_photo.value = '';
    previewWrap.style.display = 'none';
    selectedFile = null;
    editingId = null;
    useImagePath = null;
    await fetchAndRender();
  } catch(e){
    console.error(e);
    alert('Server error');
  } finally {
    uploadStatus.style.display = 'none';
    adminSaveBtn.disabled = false;
  }
});

adminCancelBtn.addEventListener('click', ()=>{
  admin_name.value = admin_price.value = admin_category.value = '';
  if(admin_item_type) admin_item_type.value = 'veg';
  if(admin_is_cake) admin_is_cake.checked = false;
  admin_photo.value = '';
  previewWrap.style.display = 'none';
  selectedFile = null;
  editingId = null;
  useImagePath = null;
});

// small helper
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
