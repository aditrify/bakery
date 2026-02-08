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
const admin_photo = document.getElementById('admin_photo');
const adminSaveBtn = document.getElementById('adminSaveBtn');
const adminCancelBtn = document.getElementById('adminCancelBtn');
const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');
const cropBtn = document.getElementById('cropBtn');
const uploadStatus = document.getElementById('uploadStatus');
const backBtn = document.getElementById('backBtn'); // backBtn may not exist in all header variations
const signOutBtn = document.getElementById('signOutBtn');
const adminRefreshBtn = document.getElementById('adminRefreshBtn');

const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const menuBackdrop = document.getElementById('menuBackdrop');

let editingId = null;
let selectedFile = null;
let useImagePath = null;

// side menu handlers (same as main site)
function openSideMenu(){ sideMenu.classList.add('open'); menuBackdrop.classList.add('visible'); menuBackdrop.hidden = false; document.body.classList.add('menu-open'); sideMenu.setAttribute('aria-hidden','false'); menuBtn.setAttribute('aria-expanded','true'); closeMenuBtn.focus(); }
function closeSideMenu(){ sideMenu.classList.remove('open'); menuBackdrop.classList.remove('visible'); setTimeout(()=> { menuBackdrop.hidden = true; }, 260); document.body.classList.remove('menu-open'); sideMenu.setAttribute('aria-hidden','true'); menuBtn.setAttribute('aria-expanded','false'); menuBtn.focus(); }
if(menuBtn) menuBtn.addEventListener('click', openSideMenu);
if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenu);
if(menuBackdrop) menuBackdrop.addEventListener('click', closeSideMenu);

// back & sign out (safe guards)
if(backBtn) backBtn.addEventListener('click', ()=> { window.location.href = '/'; });
if(signOutBtn) signOutBtn.addEventListener('click', async ()=> { await supabase.auth.signOut(); window.location.href = '/'; });
if(adminRefreshBtn) adminRefreshBtn.addEventListener('click', ()=> fetchAndRender());

// auth guard: only admin role allowed
(async function ensureAdmin(){
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  if(!user){
    alert('Please sign in as admin first.');
    window.location.href = '/';
    return;
  }
  const role = user.user_metadata?.role || '';
  if(role !== 'admin'){
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
    }, 6000);
  }
}

async function renderMenuItems(){
  menuList.innerHTML = 'Loading…';
  try {
    const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
    if(error){ menuList.innerHTML = 'Error loading items'; console.error('menu_items fetch error', error); return; }
    if(!data || data.length === 0){ menuList.innerHTML = '<div style="color:var(--muted)">No items</div>'; return; }
    menuList.innerHTML = '';
    data.forEach(it=>{
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const imgUrl = it.image_path ? supabase.storage.from('menu-images').getPublicUrl(it.image_path).data.publicUrl : '';
      div.innerHTML = `
        <img src="${imgUrl || '/icons/192.png'}" class="thumb" onerror="this.src='/icons/192.png'"/>
        <div style="flex:1">
          <strong>${escapeHtml(it.name)}</strong><div style="font-size:13px;color:var(--muted)">₹${it.price} • ${escapeHtml(it.category)}</div>
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
        useImagePath = data.image_path || null;
        previewWrap.style.display = 'none';
        window.scrollTo({ top: 120, behavior: 'smooth' });
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

async function renderOrders(){
  ordersList.innerHTML = 'Loading…';
  try {
    // Try ordering by created_at column first; if that errors (some schemas use 'created'), fallback.
    let resp = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
    if(resp.error){
      console.warn('order fetch by created_at failed, falling back to created column', resp.error);
      resp = await supabase.from('orders').select('*').order('created', { ascending: false }).limit(50);
    }
    const { data, error } = resp;
    if(error){ ordersList.innerHTML = 'Error loading orders'; console.error('orders fetch error', error); return; }
    if(!data || data.length===0){ ordersList.innerHTML = '<div style="color:var(--muted)">No orders</div>'; return; }
    ordersList.innerHTML = '';
    data.forEach(o=>{
      const cre = o.created_at || o.created || o.createdAt || o.created_on || null;
      const when = cre ? new Date(cre).toLocaleString() : '(unknown)';
      const wrap = document.createElement('div');
      wrap.style.border = '1px solid #f0eaea';
      wrap.style.padding = '8px';
      wrap.style.marginBottom = '8px';
      wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between">
          <div><strong>${escapeHtml(o.name || 'Guest')}</strong> • ₹${o.total}</div>
          <div style="font-size:12px;color:var(--muted)">${when}</div>
        </div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">${escapeHtml(o.address || '')}</div>
        <div style="margin-top:6px">
          ${ (o.items || []).map(it=>`<div style="font-size:13px">${escapeHtml(it.name)} x ${it.qty} = ₹${it.price*it.qty}</div>`).join('') }
        </div>
      `;
      ordersList.appendChild(wrap);
    });
  } catch(e){
    ordersList.innerHTML = 'Unexpected error';
    console.error('renderOrders unexpected', e);
  }
}

// image preview and client-side resize (simple)
admin_photo.addEventListener('change', (e)=>{
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
  if(!name || !price){ alert('Name & price required'); return; }

  adminSaveBtn.disabled = true;
  uploadStatus.style.display = 'inline-block';
  uploadStatus.textContent = 'Uploading image…';

  let image_path = useImagePath || null;

  if(selectedFile){
    // generate path and upload to bucket 'menu-images'
    const path = `menu-${Date.now()}-${selectedFile.name.replace(/\s+/g,'_')}`;
    try {
      const { data, error } = await supabase.storage.from('menu-images').upload(path, selectedFile, { cacheControl: '3600', upsert: false });
      if(error){ console.error('upload error', error); alert('Image upload failed'); image_path = null; }
      else image_path = data.path;
    } catch(e){
      console.error(e);
      alert('Image upload failed');
    }
  }

  uploadStatus.textContent = 'Saving item…';
  try {
    if(editingId){
      const updates = { name, price, category };
      if(image_path) updates.image_path = image_path;
      const { error } = await supabase.from('menu_items').update(updates).eq('id', editingId);
      if(error) { alert('Update failed'); console.error('update error', error); }
      else { showTemp('Updated'); }
    } else {
      const { data, error } = await supabase.from('menu_items').insert([{ name, price, category, image_path }]);
      if(error){ alert('Add failed'); console.error('insert error', error); }
      else { showTemp('Added'); }
    }
    // reset form
    admin_name.value = admin_price.value = admin_category.value = '';
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
  admin_photo.value = '';
  previewWrap.style.display = 'none';
  selectedFile = null;
  editingId = null;
  useImagePath = null;
});

// small helper
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
