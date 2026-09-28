const SUPABASE_URL="https://dcrzycefzfrcmbqcecmm.supabase.co";
const SUPABASE_KEY="sb_publishable_yEJVgMqnuf_Eyj5IKvAPJQ_VAQqa2y5";
const {createClient}=window.supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let products=[],session=null,editingId=null,currentPhoto=null,isSignup=false,deferredPrompt=null,recoveryMode=false;

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
const productName=p=>String(p?.item_name??p?.name??p?.product_name??p?.itemName??"");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg,error=false){$("toast").innerHTML=`<div class="toast-message ${error?"toast-error":""}">${esc(msg)}</div>`;setTimeout(()=>$("toast").innerHTML="",2600)}
function status(p){if(Number(p.quantity)<=0)return["out","Out of stock"];if(Number(p.quantity)<=Number(p.min_stock||0))return["low","Low stock"];return["in","In stock"]}
function setSync(ok){$("syncText").textContent=ok?"Cloud synced":"Syncing…";$("syncDot").style.background=ok?"#4f775d":"#a5793e"}

async function loadProducts(){
  if(!session)return;
  setSync(false);
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error){toast(error.message,true);setSync(false);return}
  products=(data||[]).map(p=>({...p,item_name:productName(p)}));
  await hydrateImages();
  setSync(true);renderAll();
}
async function hydrateImages(){
  await Promise.all(products.map(async p=>{
    if(!p.image_path){p.image_url="";return}
    const {data}=await db.storage.from("product-images").createSignedUrl(p.image_path,3600);
    p.image_url=data?.signedUrl||"";
  }));
}
function renderAll(){renderDashboard();renderFilters();renderTable();renderAnalytics()}
function renderDashboard(){
  const units=products.reduce((a,p)=>a+Number(p.quantity||0),0);
  const value=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0);
  const attention=products.filter(p=>status(p)[0]!=="in").length;
  $("mProducts").textContent=products.length;$("mUnits").textContent=units.toLocaleString("en-IN");$("mValue").textContent=money(value);$("mAttention").textContent=attention;
  const recent=products.slice(0,5);
  $("recentList").innerHTML=recent.length?recent.map(p=>`<div class="recent-item"><div class="thumb">${p.image_url?`<img class="thumb" src="${p.image_url}" alt="">`:"SP"}</div><div class="recent-info"><strong>${esc(p.item_name)}</strong><small>${esc(p.category||"Uncategorized")}</small></div><span class="stock-number">${Number(p.quantity||0)} pcs</span></div>`).join(""):`<div class="empty">Your catalog is ready for its first product.</div>`;
  const total=Math.max(products.length,1),inStock=products.filter(p=>status(p)[0]==="in").length,low=products.filter(p=>status(p)[0]==="low").length,out=products.filter(p=>status(p)[0]==="out").length;
  $("healthBars").innerHTML=[["Healthy stock",inStock,"#4f775d"],["Low stock",low,"#a5793e"],["Out of stock",out,"#a6534d"]].map(x=>`<div><div class="bar-label"><span>${x[0]}</span><span>${x[1]}</span></div><div class="bar"><i style="width:${Math.max(3,x[1]/total*100)}%;background:${x[2]}"></i></div></div>`).join("");
}
function renderFilters(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const val=$("categoryFilter").value;
  $("categoryFilter").innerHTML=`<option value="">All categories</option>`+cats.map(c=>`<option ${c===val?"selected":""} value="${esc(c)}">${esc(c)}</option>`).join("");
}
function filtered(){
  const q=$("searchInput").value.toLowerCase().trim(),cat=$("categoryFilter").value,st=$("statusFilter").value;
  return products.filter(p=>(!q||[p.item_name,p.category,p.location].join(" ").toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!st||status(p)[0]===st));
}
function renderTable(){
  const list=filtered();
  $("resultCount").textContent=`${list.length} ${list.length===1?"product":"products"}`;
  $("emptyState").classList.toggle("hidden",list.length!==0);
  $("productBody").innerHTML=list.map(p=>{
    const [cls,label]=status(p);
    return `<tr class="product-row" data-product-id="${p.id}" onclick="viewProduct('${p.id}')"><td><div class="product-cell">${p.image_url?`<img class="row-photo" src="${p.image_url}" alt="">`:`<div class="row-photo"></div>`}<div><strong>${esc(p.item_name)}</strong><small>${esc(p.location||"No location")}</small></div></div></td><td>${esc(p.category||"—")}</td><td><strong>${Number(p.quantity||0)}</strong><small style="display:block;color:#9a9187;margin-top:4px">min ${Number(p.min_stock||0)}</small></td><td>${money(p.purchase_price)}</td><td>${money(p.selling_price)}</td><td><span class="status ${cls}">${label}</span></td><td><div class="row-actions"><button type="button" class="icon-btn" title="View details" onclick="event.stopPropagation();viewProduct('${p.id}')">👁</button><button type="button" class="icon-btn" title="Edit product" onclick="event.stopPropagation();editProduct('${p.id}')">✎</button><button type="button" class="icon-btn" title="Delete product" onclick="event.stopPropagation();deleteProduct('${p.id}')">×</button></div></td></tr>`
  }).join("");
}

// Use delegated click handling so product details work reliably on desktop and mobile.
function bindProductTable(){
  const body=$("productBody");
  if(!body || body.dataset.bound === "1") return;
  body.dataset.bound="1";
  body.addEventListener("click",e=>{
    if(e.target.closest("button, a, input, select, textarea")) return;
    const row=e.target.closest("tr.product-row[data-product-id]");
    if(!row) return;
    viewProduct(row.dataset.productId);
  });
}
async function adjustQuantity(id,delta){
  if(!session){toast("Sign in to change stock.",true);openAuthModal("login");return}
  const p=products.find(x=>x.id===id);
  if(!p)return;
  const next=Math.max(0,Number(p.quantity||0)+delta);
  if(next===Number(p.quantity||0))return;
  const {error}=await db.from("products").update({quantity:next,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast(error.message,true);return}
  p.quantity=next;
  renderAll();
  toast(delta>0?"1 unit added":"1 unit removed");
}
window.adjustQuantity=adjustQuantity;

function renderAnalytics(){
  const purchase=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0),sales=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.selling_price||0),0);
  $("aPurchase").textContent=money(purchase);$("aSales").textContent=money(sales);$("aMargin").textContent=money(sales-purchase);
  const map={};products.forEach(p=>map[p.category||"Uncategorized"]=(map[p.category||"Uncategorized"]||0)+Number(p.quantity||0));
  const max=Math.max(...Object.values(map),1);
  $("categoryBars").innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="cat-row"><div class="cat-meta"><span>${esc(k)}</span><span>${v} units</span></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join("")||`<div class="empty">No category data yet.</div>`;
  const att=products.filter(p=>status(p)[0]!=="in");
  $("attentionList").innerHTML=att.length?att.map(p=>{const [c,l]=status(p);return `<div class="attention-item"><div class="thumb">${p.image_url?"": "!"}</div><div class="recent-info"><strong>${esc(p.item_name)}</strong><small>${l} · ${Number(p.quantity||0)} units remaining</small></div><span class="status ${c}">${l}</span></div>`}).join(""):`<div class="empty">Everything looks beautifully in order.</div>`;
}
function go(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(`${page}Page`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const names={dashboard:["YOUR BUSINESS, IN ORDER","Overview"],inventory:["YOUR CATALOG","Inventory"],analytics:["NUMBERS, CLARIFIED","Insights"],settings:["YOUR SPACE","Settings"]};
  $("pageEyebrow").textContent=names[page][0];$("pageTitle").textContent=names[page][1];
}
function openModal(p=null){
  editingId=p?.id||null;currentPhoto=null;$("modalTitle").textContent=p?"Edit product":"Add product";$("productForm").reset();$("productId").value=p?.id||"";
  if(p){
    $("itemName").value=productName(p);
    $("category").value=p.category??"";
    $("location").value=p.location??"";
    $("quantity").value=p.quantity??0;
    $("minStock").value=p.min_stock??5;
    $("purchasePrice").value=p.purchase_price??0;
    $("sellingPrice").value=p.selling_price??0;
  }else{
    $("quantity").value=0;$("minStock").value=5;$("purchasePrice").value=0;$("sellingPrice").value=0;
  }
  $("photoPreview").innerHTML=p?.image_url?`<img src="${p.image_url}" alt="">`:"+";
  $("productModal").classList.remove("hidden");
}
function closeModal(){$("productModal").classList.add("hidden");editingId=null;currentPhoto=null}
async function preparePhoto(file){
  if(!file)return null;
  if(!file.type || !file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const maxBytes=8*1024*1024;
  if(file.size<=maxBytes && !/heic|heif/i.test(file.type)) return file;
  try{
    const bitmap=await createImageBitmap(file);
    const maxSide=1800;
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not process this photo.")),"image/jpeg",0.82));
    return new File([blob],"photo.jpg",{type:"image/jpeg",lastModified:Date.now()});
  }catch(err){
    if(file.size>maxBytes) throw new Error("This photo is too large. Please choose a smaller photo.");
    return file;
  }
}
async function uploadPhoto(file,id){
  if(!file)return null;
  if(!session?.user?.id) throw new Error("Your session has expired. Please sign in again.");
  const prepared=await preparePhoto(file);
  if($("photoStatus")) $("photoStatus").textContent="Uploading photo…";
  const path=`${session.user.id}/${id}-${Date.now()}.jpg`;
  const {error}=await db.storage.from("product-images").upload(path,prepared,{upsert:false,contentType:"image/jpeg",cacheControl:"3600"});
  if(error){
    if($("photoStatus")) $("photoStatus").textContent="Upload failed";
    const msg=error.message||"Photo upload failed";
    if(/row-level security|policy|not authorized|permission/i.test(msg)) throw new Error("Photo storage permission is not configured. In Supabase, check Storage → product-images policies.");
    throw new Error(msg);
  }
  if($("photoStatus")) $("photoStatus").textContent="Photo uploaded ✓";
  return path;
}
async function saveProduct(e){
  e.preventDefault();if(!session){toast("Sign in to save inventory.",true);openAuthModal("login");return;}
  const wasEditing=!!editingId;
  const id=editingId||crypto.randomUUID();
  const existing=wasEditing?products.find(x=>x.id===id):null;
  const payload={user_id:session.user.id,item_name:$("itemName").value.trim(),category:$("category").value.trim(),location:$("location").value.trim(),quantity:Number($("quantity").value)||0,min_stock:Number($("minStock").value)||0,purchase_price:Number($("purchasePrice").value)||0,selling_price:Number($("sellingPrice").value)||0,updated_at:new Date().toISOString()};
  try{
    if($("productPhoto").files[0])payload.image_path=await uploadPhoto($("productPhoto").files[0],id);
    if(wasEditing){const {error}=await db.from("products").update(payload).eq("id",id);if(error)throw error;if(existing?.image_path&&payload.image_path&&existing.image_path!==payload.image_path)await db.storage.from("product-images").remove([existing.image_path])}
    else{payload.id=id;payload.created_at=new Date().toISOString();const {error}=await db.from("products").insert(payload);if(error)throw error}
    closeModal();await loadProducts();toast(wasEditing?"Product updated":"Product added");
  }catch(err){toast(err.message,true)}
}
async function deleteProduct(id){const p=products.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.item_name}"?`))return;const {error}=await db.from("products").delete().eq("id",id);if(error){toast(error.message,true);return}if(p.image_path)await db.storage.from("product-images").remove([p.image_path]);await loadProducts();toast("Product removed")}
function formatDate(value){return value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—"}
function viewProduct(id){
  const p=products.find(x=>x.id===id);
  if(!p)return;
  const [cls,label]=status(p);
  $("detailTitle").textContent=p.item_name||"Product";
  $("detailPhoto").innerHTML=p.image_url?`<img src="${p.image_url}" alt="${esc(p.item_name)}" title="Click to view full photo">`:`<span>SP</span>`;
  if(p.image_url){
    $("detailPhoto").onclick=()=>openPhotoLightbox(p.image_url,p.item_name||"Product");
    $("detailPhoto").querySelector("img")?.addEventListener("click",e=>{e.stopPropagation();openPhotoLightbox(p.image_url,p.item_name||"Product")});
    $("detailPhoto").classList.add("has-photo");
  }else{
    $("detailPhoto").onclick=null;
    $("detailPhoto").classList.remove("has-photo");
  }
  $("detailCategory").textContent=p.category||"—";
  $("detailQuantity").textContent=Number(p.quantity||0).toLocaleString("en-IN");
  $("detailMinStock").textContent=Number(p.min_stock||0).toLocaleString("en-IN");
  $("detailStatus").innerHTML=`<span class="status ${cls}">${label}</span>`;
  $("detailPurchase").textContent=money(p.purchase_price);
  $("detailSelling").textContent=money(p.selling_price);
  $("detailStockValue").textContent=money(Number(p.quantity||0)*Number(p.purchase_price||0));
  $("detailSalesValue").textContent=money(Number(p.quantity||0)*Number(p.selling_price||0));
  $("detailModal").dataset.productId=p.id;
  $("detailModal").dataset.productId=p.id;
  $("detailModal").classList.remove("hidden");

}
function closeDetailModal(){$("detailModal").classList.add("hidden")}
function openPhotoLightbox(src,alt){
  $("fullProductPhoto").src=src;
  $("fullProductPhoto").alt=alt||"Product photo";
  $("photoLightbox").classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closePhotoLightbox(){
  $("photoLightbox").classList.add("hidden");
  $("fullProductPhoto").src="";
  document.body.style.overflow="";
}

window.viewProduct=viewProduct;
window.editProduct=id=>openModal(products.find(p=>p.id===id));
window.deleteProduct=deleteProduct;


function openAuthModal(mode="login"){
  $("authModal").classList.remove("hidden");
  $("authLoginPanel").classList.toggle("hidden",mode!=="login");
  $("forgotPanel").classList.toggle("hidden",mode!=="forgot");
  $("resetPanel").classList.toggle("hidden",mode!=="reset");
  $("authModalTitle").textContent=mode==="forgot"?"Reset your password":mode==="reset"?"Choose a new password":(isSignup?"Create your account":"Sign in to StockPilot");
}
function closeAuthModal(){$("authModal").classList.add("hidden");}
function updateAccountUI(){
  const signed=!!session;
  $("accountEmail").textContent=signed?(session.user.email||"Signed in") : "—";
  $("accountStatus").textContent=signed?"Signed in":"Not signed in";
  $("cloudStatus").textContent=signed?"Connected":"Sign in required";
  $("syncText").textContent=signed?"Cloud synced":"Sign in to sync";
  $("syncDot").style.background=signed?"#4f775d":"#a5793e";
  $("accountBtn").textContent=signed?"Sign out":"Sign in to sync";
  $("settingsAccountBtn").textContent=signed?"Account signed in":"Sign in to sync";
  $("settingsAccountBtn").disabled=signed;
  $("settingsSignOutBtn").classList.toggle("hidden",!signed);
}
$("closeAuthModal").onclick=closeAuthModal;
$("authModal").querySelector(".modal-backdrop").onclick=closeAuthModal;
$("accountBtn").onclick=()=>session?db.auth.signOut():openAuthModal("login");
$("settingsAccountBtn").onclick=()=>{if(!session)openAuthModal("login")};
$("settingsSignOutBtn").onclick=()=>db.auth.signOut();
$("forgotPasswordBtn").onclick=()=>{$("forgotEmail").value=$("authEmail").value.trim();openAuthModal("forgot");};
$("backToLoginBtn").onclick=()=>openAuthModal("login");
$("forgotForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("forgotEmail").value.trim();
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){toast(error.message,true);return}
  toast("Reset link sent. Check your email.");
  openAuthModal("login");
};
$("resetForm").onsubmit=async e=>{
  e.preventDefault();
  const p1=$("newPassword").value,p2=$("confirmPassword").value;
  if(p1!==p2){toast("Passwords do not match.",true);return}
  if(p1.length<6){toast("Password must be at least 6 characters.",true);return}
  const {error}=await db.auth.updateUser({password:p1});
  if(error){toast(error.message,true);return}
  recoveryMode=false;
  $("newPassword").value=$("confirmPassword").value="";
  toast("Password updated successfully.");
  closeAuthModal();
};
$("toggleAuth").onclick=()=>{isSignup=!isSignup;$("authSubmit").textContent=isSignup?"Create account":"Sign in";$("toggleAuth").textContent=isSignup?"Already have an account? Sign in":"Create a new account";$("authModalTitle").textContent=isSignup?"Create your account":"Sign in to StockPilot"};
$("googleBtn").onclick=async()=>{
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
  if(error)toast(error.message,true);
};
$("authForm").onsubmit=async e=>{e.preventDefault();const email=$("authEmail").value.trim(),password=$("authPassword").value;if(isSignup){const {error}=await db.auth.signUp({email,password});if(error)toast(error.message,true);else{toast("Account created. Check your email if confirmation is required.");closeAuthModal()}}else{const {error}=await db.auth.signInWithPassword({email,password});if(error)toast(error.message,true)}};
$("addTopBtn").onclick=()=>session?openModal():openAuthModal("login");
$("closeModal").onclick=closeModal;$("cancelModal").onclick=closeModal;$("modal-backdrop")?.addEventListener("click",closeModal);
$("closeDetailModal").onclick=closeDetailModal;
$("detailCloseBtn").onclick=closeDetailModal;
$("detailEditBtn").onclick=()=>{const id=$("detailModal").dataset.productId;const p=products.find(x=>x.id===id);if(!p){toast("Product not found.",true);return}closeDetailModal();openModal(p)};
$("closePhotoLightbox").onclick=closePhotoLightbox;
$("photoLightbox").onclick=e=>{if(e.target.id==="photoLightbox")closePhotoLightbox()};
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePhotoLightbox()});
$("detailModal").querySelector(".modal-backdrop").onclick=closeDetailModal;
$("productForm").onsubmit=saveProduct;
$("choosePhotoBtn").onclick=()=>$("productPhoto").click();
$("productPhoto").onchange=e=>{const f=e.target.files[0];if(f){currentPhoto=f;const u=URL.createObjectURL(f);$("photoPreview").innerHTML=`<img src="${u}" alt="">`;$("photoStatus").textContent=`${(f.size/1024/1024).toFixed(1)} MB selected`}};
$("qtyMinus").onclick=()=>$("quantity").value=Math.max(0,(Number($("quantity").value)||0)-1);
$("qtyPlus").onclick=()=>$("quantity").value=Math.max(0,(Number($("quantity").value)||0)+1);

["searchInput","categoryFilter","statusFilter"].forEach(id=>$(id).addEventListener("input",renderTable));
bindProductTable();
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
$("refreshBtn").onclick=()=>session?loadProducts():openAuthModal("login");
$("accountEmail").textContent="—";
$("exportBtn").onclick=()=>{const rows=[["ID","Item Name","Category","Quantity","Purchase Price","Selling Price","Location","Min Stock","Created"],...products.map(p=>[p.id,p.item_name,p.category,p.quantity,p.purchase_price,p.selling_price,p.location,p.min_stock,p.created_at])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="stockpilot-inventory.csv";a.click()};
$("importBtn").onclick=()=>session?$("csvFile").click():openAuthModal("login");
$("csvFile").onchange=async e=>{if(!session){openAuthModal("login");return}const f=e.target.files[0];if(!f)return;const text=await f.text(),lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)return;const rows=lines.slice(1).map(x=>x.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replace(/""/g,'"'))||[]);let added=0;for(const r of rows){if(!r[1])continue;const payload={user_id:session.user.id,item_name:r[1],category:r[2]||"",quantity:Number(r[3])||0,purchase_price:Number(r[4])||0,selling_price:Number(r[5])||0,location:r[6]||"",min_stock:Number(r[7])||0,created_at:r[8]||new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await db.from("products").insert(payload);if(!error)added++}await loadProducts();toast(`${added} products imported`)};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null;$("installBtn").classList.add("hidden")};
db.auth.onAuthStateChange(async(_event,s)=>{
  session=s;
  updateAccountUI();
  if(_event==="PASSWORD_RECOVERY"){
    recoveryMode=true;
    $("newPassword").value=$("confirmPassword").value="";
    openAuthModal("reset");
    return;
  }
  if(s&&!recoveryMode){
    closeAuthModal();
    await loadProducts();
  }else if(!s&&!recoveryMode){
    products=[];renderAll();
  }
});
(async()=>{
  const {data}=await db.auth.getSession();
  session=data.session;
  const hash=window.location.hash||"";
  const isRecovery=hash.includes("type=recovery")||hash.includes("access_token=")&&hash.includes("type=recovery");
  updateAccountUI();
  if(isRecovery){
    recoveryMode=true;
    openAuthModal("reset");
    return;
  }
  if(session)await loadProducts();
  else {products=[];renderAll();}
})();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
