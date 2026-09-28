const SUPABASE_URL = "https://dcrzycefzfrcmbqcecmm.supabase.co";
const SUPABASE_KEY = "sb_publishable_yEJVgMqnuf_Eyj5IKvAPJQ_VAQqa2y5";
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let inventory = [];
let currentUser = null;
let editingImagePath = null;
let selectedPhoto = null;
let authMode = "login";

const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function toast(msg){
  const t=$("toast"); t.textContent=msg; t.style.display="block";
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>t.style.display="none",2600);
}

function showPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
  $(page).classList.add("active");
  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add("active");
  if(page==="inventory") renderInventory();
  if(page==="analytics") renderAnalytics();
}

document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("dashboardInventoryBtn").onclick=()=>showPage("inventory");

function setAuthMessage(msg){$("authMessage").textContent=msg||""}

$("loginTab").onclick=()=>{
  authMode="login";
  $("loginTab").classList.add("active"); $("signupTab").classList.remove("active");
  $("authButton").textContent="Login"; $("authPassword").autocomplete="current-password"; setAuthMessage("");
};
$("signupTab").onclick=()=>{
  authMode="signup";
  $("signupTab").classList.add("active"); $("loginTab").classList.remove("active");
  $("authButton").textContent="Create account"; $("authPassword").autocomplete="new-password"; setAuthMessage("");
};

$("authForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("authEmail").value.trim(), password=$("authPassword").value;
  $("authButton").disabled=true;
  setAuthMessage(authMode==="login"?"Signing in...":"Creating account...");
  try{
    if(authMode==="login"){
      const {error}=await db.auth.signInWithPassword({email,password});
      if(error) throw error;
    }else{
      const {data,error}=await db.auth.signUp({email,password});
      if(error) throw error;
      if(!data.session){
        setAuthMessage("Account created. Check your email to confirm it, then log in.");
      }else{
        setAuthMessage("");
      }
    }
  }catch(err){setAuthMessage(err.message||"Authentication failed.");}
  finally{$("authButton").disabled=false}
};

$("logoutBtn").onclick=async()=>{await db.auth.signOut();location.reload()};

db.auth.onAuthStateChange(async(_event,session)=>{
  if(session?.user){
    currentUser=session.user;
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("userEmail").textContent=currentUser.email||"";
    await loadInventory();
  }else{
    currentUser=null;
    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
  }
});

async function loadInventory(){
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error){toast(error.message);return}
  inventory=data||[];
  updateDashboard();
  renderInventory();
  renderAnalytics();
}

function statusOf(p){
  if(Number(p.quantity)<=0) return ["out","Out of stock"];
  if(Number(p.quantity)<=Number(p.min_stock||0)) return ["low","Low stock"];
  return ["ok","In stock"];
}

async function signedImage(path){
  if(!path) return null;
  const {data,error}=await db.storage.from("product-images").createSignedUrl(path,3600);
  return error?null:data?.signedUrl||null;
}

async function imageHTML(path, cls="thumb"){
  const url=await signedImage(path);
  return url ? `<img class="${cls}" src="${url}" loading="lazy">` : `<div class="${cls}">📦</div>`;
}

function updateDashboard(){
  $("totalProducts").textContent=inventory.length;
  $("totalUnits").textContent=inventory.reduce((a,p)=>a+Number(p.quantity||0),0);
  $("inventoryValue").textContent=money(inventory.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0));
  $("lowStock").textContent=inventory.filter(p=>statusOf(p)[0]!=="ok").length;

  const recent=inventory.slice(0,4);
  $("recentProducts").innerHTML=recent.length?recent.map(p=>`
    <div class="recent-item">
      <div class="recent-photo" data-photo="${esc(p.id)}">${p.image_path?"Loading…":"📦"}</div>
      <div class="recent-name">${esc(p.item_name)}</div>
      <div class="recent-meta">${esc(p.category||"Uncategorized")} · ${Number(p.quantity||0)} units</div>
    </div>`).join(""):`<div class="empty">No products yet. Add your first product.</div>`;

  recent.forEach(async p=>{
    const el=document.querySelector(`.recent-photo[data-photo="${p.id}"]`);
    if(el) el.innerHTML=await imageHTML(p.image_path,"thumb");
  });
}

function refreshCategoryFilter(){
  const current=$("categoryFilter").value;
  const cats=[...new Set(inventory.map(p=>p.category).filter(Boolean))].sort();
  $("categoryFilter").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("categoryFilter").value=current;
}

async function renderInventory(){
  refreshCategoryFilter();
  const q=$("search").value.trim().toLowerCase(), cat=$("categoryFilter").value, stat=$("statusFilter").value;
  const rows=inventory.filter(p=>{
    const text=[p.item_name,p.sku,p.location,p.category].join(" ").toLowerCase();
    const s=statusOf(p)[0];
    return (!q||text.includes(q))&&(!cat||p.category===cat)&&(!stat||s===stat);
  });
  $("emptyState").classList.toggle("hidden",rows.length>0);
  $("inventoryBody").innerHTML=rows.map(p=>{
    const [cls,label]=statusOf(p);
    return `<tr>
      <td><div class="product-cell"><span class="mini-photo" data-mini="${p.id}">${p.image_path?"…":"📦"}</span><strong>${esc(p.item_name)}</strong></div></td>
      <td>${esc(p.sku||"—")}</td>
      <td>${esc(p.category||"—")}</td>
      <td>${Number(p.quantity||0)}</td>
      <td>${money(p.purchase_price)}</td>
      <td>${money(p.selling_price)}</td>
      <td>${esc(p.location||"—")}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td><button class="action-btn" onclick="editProduct('${p.id}')">✏️</button><button class="action-btn" onclick="deleteProduct('${p.id}')">🗑️</button></td>
    </tr>`;
  }).join("");
  rows.forEach(async p=>{
    const el=document.querySelector(`[data-mini="${p.id}"]`);
    if(el) el.innerHTML=await imageHTML(p.image_path,"mini-thumb");
  });
}

$("search").oninput=renderInventory;
$("categoryFilter").onchange=renderInventory;
$("statusFilter").onchange=renderInventory;

function openModal(p=null){
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent=p?"Edit Product":"Add Product";
  $("productId").value=p?.id||"";
  $("itemName").value=p?.item_name||"";
  $("category").value=p?.category||"";
  $("sku").value=p?.sku||"";
  $("quantity").value=p?.quantity??0;
  $("purchasePrice").value=p?.purchase_price??0;
  $("sellingPrice").value=p?.selling_price??0;
  $("location").value=p?.location||"";
  $("minStock").value=p?.min_stock??0;
  selectedPhoto=null;
  editingImagePath=p?.image_path||null;
  $("itemPhoto").value="";
  $("removePhoto").style.display=p?.image_path?"inline-block":"none";
  $("photoPreview").innerHTML="📷";
  if(p?.image_path) signedImage(p.image_path).then(url=>{if(url)$("photoPreview").innerHTML=`<img src="${url}">`});
}
function closeModal(){$("modal").classList.add("hidden")}
$("closeModal").onclick=closeModal;$("cancelBtn").onclick=closeModal;
$("addBtn").onclick=()=>openModal();$("addBtn2").onclick=()=>openModal();

$("itemPhoto").onchange=e=>{
  const f=e.target.files?.[0]; if(!f)return;
  selectedPhoto=f;
  $("removePhoto").style.display="inline-block";
  const r=new FileReader();
  r.onload=()=>$("photoPreview").innerHTML=`<img src="${r.result}">`;
  r.readAsDataURL(f);
};
$("removePhoto").onclick=()=>{
  selectedPhoto=null; editingImagePath=null; $("itemPhoto").value="";
  $("photoPreview").innerHTML="📷"; $("removePhoto").style.display="none";
};

async function uploadPhoto(productId,file,oldPath){
  if(!file)return oldPath;
  if(oldPath) await db.storage.from("product-images").remove([oldPath]);
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${currentUser.id}/${productId}.${ext}`;
  const {error}=await db.storage.from("product-images").upload(path,file,{contentType:file.type||"image/jpeg"});
  if(error)throw error;
  return path;
}

$("productForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;
  const btn=$("saveProductBtn"); btn.disabled=true; btn.textContent="Saving...";
  try{
    const id=$("productId").value||crypto.randomUUID();
    const old=inventory.find(p=>p.id===id);
    const product={
      id,user_id:currentUser.id,
      item_name:$("itemName").value.trim(),
      category:$("category").value.trim(),
      sku:$("sku").value.trim(),
      quantity:Number($("quantity").value||0),
      purchase_price:Number($("purchasePrice").value||0),
      selling_price:Number($("sellingPrice").value||0),
      location:$("location").value.trim(),
      min_stock:Number($("minStock").value||0),
      image_path:editingImagePath,
      updated_at:new Date().toISOString()
    };
    if(!product.item_name)throw new Error("Item name is required.");

    if(selectedPhoto) product.image_path=await uploadPhoto(id,selectedPhoto,old?.image_path||null);
    else if(!editingImagePath && old?.image_path){
      await db.storage.from("product-images").remove([old.image_path]);
      product.image_path=null;
    }

    if(old){
      const {error}=await db.from("products").update(product).eq("id",id).eq("user_id",currentUser.id);
      if(error)throw error;
    }else{
      const {error}=await db.from("products").insert(product);
      if(error)throw error;
    }
    closeModal(); toast("Product saved"); await loadInventory();
  }catch(err){toast(err.message||"Could not save product")}
  finally{btn.disabled=false;btn.textContent="Save Product"}
};

window.editProduct=id=>openModal(inventory.find(p=>p.id===id));

window.deleteProduct=async id=>{
  const p=inventory.find(x=>x.id===id); if(!p)return;
  if(!confirm(`Delete "${p.item_name}"?`))return;
  try{
    if(p.image_path)await db.storage.from("product-images").remove([p.image_path]);
    const {error}=await db.from("products").delete().eq("id",id).eq("user_id",currentUser.id);
    if(error)throw error;
    toast("Product deleted"); await loadInventory();
  }catch(err){toast(err.message||"Delete failed")}
};

function renderAnalytics(){
  const groups={};
  inventory.forEach(p=>groups[p.category||"Other"]=(groups[p.category||"Other"]||0)+Number(p.quantity||0));
  const vals=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...vals.map(x=>x[1]));
  $("categoryChart").innerHTML=vals.length?vals.map(([k,v])=>`
    <div class="bar-row"><div class="bar-label"><span>${esc(k)}</span><strong>${v}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div></div>`).join(""):"<p class='muted'>No data yet.</p>";
  const totalUnits=inventory.reduce((a,p)=>a+Number(p.quantity||0),0);
  const cost=inventory.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0);
  const retail=inventory.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.selling_price||0),0);
  $("summaryChart").innerHTML=`
    <div class="summary-row"><span>Total products</span><strong>${inventory.length}</strong></div>
    <div class="summary-row"><span>Total units</span><strong>${totalUnits}</strong></div>
    <div class="summary-row"><span>Cost value</span><strong>${money(cost)}</strong></div>
    <div class="summary-row"><span>Potential sales value</span><strong>${money(retail)}</strong></div>
    <div class="summary-row"><span>Potential gross margin</span><strong>${money(retail-cost)}</strong></div>`;
}

$("exportBtn").onclick=()=>{
  const headers=["ID","Item Name","Category","SKU","Quantity","Purchase Price","Selling Price","Location","Min Stock","Created"];
  const rows=inventory.map(p=>[p.id,p.item_name,p.category,p.sku,p.quantity,p.purchase_price,p.selling_price,p.location,p.min_stock,p.created_at]);
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="stockpilot-inventory.csv";a.click();URL.revokeObjectURL(a.href);
};

$("importBtn").onclick=()=>$("csvFile").click();
$("csvFile").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const text=await file.text();
    const lines=text.split(/\r?\n/).filter(Boolean);
    if(lines.length<2)throw new Error("CSV has no product rows.");
    const parse=line=>{const out=[];let cur="",quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;continue}if(c==='"'){quote=!quote;continue}if(c===","&&!quote){out.push(cur);cur="";continue}cur+=c}out.push(cur);return out};
    const head=parse(lines[0]).map(x=>x.trim().toLowerCase());
    const idx=n=>head.indexOf(n);
    const products=lines.slice(1).map(line=>{
      const r=parse(line);
      return {
        id:crypto.randomUUID(),user_id:currentUser.id,
        item_name:r[idx("item name")]||r[1]||"Unnamed",
        category:r[idx("category")]||"",
        sku:r[idx("sku")]||"",
        quantity:Number(r[idx("quantity")]||0),
        purchase_price:Number(r[idx("purchase price")]||0),
        selling_price:Number(r[idx("selling price")]||0),
        location:r[idx("location")]||"",
        min_stock:Number(r[idx("min stock")]||0)
      };
    });
    const {error}=await db.from("products").insert(products);if(error)throw error;
    toast(`${products.length} products imported`);await loadInventory();
  }catch(err){toast(err.message||"CSV import failed")}
  finally{e.target.value=""}
};

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}
