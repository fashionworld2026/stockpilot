const SUPABASE_URL="https://dcrzycefzfrcmbqcecmm.supabase.co";
const SUPABASE_KEY="sb_publishable_yEJVgMqnuf_Eyj5IKvAPJQ_VAQqa2y5";
const {createClient}=window.supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let products=[],session=null,editingId=null,currentPhoto=null,isSignup=false,deferredPrompt=null;

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg,error=false){$("toast").innerHTML=`<div class="toast-message ${error?"toast-error":""}">${esc(msg)}</div>`;setTimeout(()=>$("toast").innerHTML="",2600)}
function status(p){if(Number(p.quantity)<=0)return["out","Out of stock"];if(Number(p.quantity)<=Number(p.min_stock||0))return["low","Low stock"];return["in","In stock"]}
function setSync(ok){$("syncText").textContent=ok?"Cloud synced":"Syncing…";$("syncDot").style.background=ok?"#4f775d":"#a5793e"}

async function loadProducts(){
  if(!session)return;
  setSync(false);
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error){toast(error.message,true);setSync(false);return}
  products=data||[];
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
  $("recentList").innerHTML=recent.length?recent.map(p=>`<div class="recent-item"><div class="thumb">${p.image_url?`<img class="thumb" src="${p.image_url}" alt="">`:"SP"}</div><div class="recent-info"><strong>${esc(p.item_name)}</strong><small>${esc(p.category||"Uncategorized")} · ${esc(p.sku||"No SKU")}</small></div><span class="stock-number">${Number(p.quantity||0)} pcs</span></div>`).join(""):`<div class="empty">Your catalog is ready for its first product.</div>`;
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
  return products.filter(p=>(!q||[p.item_name,p.sku,p.category,p.location].join(" ").toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!st||status(p)[0]===st));
}
function renderTable(){
  const list=filtered();$("resultCount").textContent=`${list.length} ${list.length===1?"product":"products"}`;$("emptyState").classList.toggle("hidden",list.length!==0);
  $("productBody").innerHTML=list.map(p=>{const [cls,label]=status(p);return `<tr><td><div class="product-cell">${p.image_url?`<img class="row-photo" src="${p.image_url}" alt="">`:`<div class="row-photo"></div>`}<div><strong>${esc(p.item_name)}</strong><small>${esc(p.location||"No location")}</small></div></div></td><td>${esc(p.sku||"—")}</td><td>${esc(p.category||"—")}</td><td><strong>${Number(p.quantity||0)}</strong> / min ${Number(p.min_stock||0)}</td><td>${money(p.purchase_price)}</td><td>${money(p.selling_price)}</td><td><span class="status ${cls}">${label}</span></td><td><div class="row-actions"><button class="icon-btn" onclick="editProduct('${p.id}')">✎</button><button class="icon-btn" onclick="deleteProduct('${p.id}')">×</button></div></td></tr>`}).join("");
}
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
  ["itemName","sku","category","location","quantity","minStock","purchasePrice","sellingPrice"].forEach(k=>{if(p&&$(k))$(k).value=p[k]??""});
  $("quantity").value=p?.quantity??0;$("minStock").value=p?.min_stock??5;$("purchasePrice").value=p?.purchase_price??0;$("sellingPrice").value=p?.selling_price??0;
  $("photoPreview").innerHTML=p?.image_url?`<img src="${p.image_url}" alt="">`:"+";
  $("productModal").classList.remove("hidden");
}
function closeModal(){$("productModal").classList.add("hidden");editingId=null;currentPhoto=null}
async function uploadPhoto(file,id){
  if(!file)return null;
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`${session.user.id}/${id}-${Date.now()}.${ext}`;
  const {error}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
  if(error)throw error;return path;
}
async function saveProduct(e){
  e.preventDefault();if(!session)return;
  const id=editingId||crypto.randomUUID();
  const payload={user_id:session.user.id,item_name:$("itemName").value.trim(),sku:$("sku").value.trim(),category:$("category").value.trim(),location:$("location").value.trim(),quantity:Number($("quantity").value)||0,min_stock:Number($("minStock").value)||0,purchase_price:Number($("purchasePrice").value)||0,selling_price:Number($("sellingPrice").value)||0,updated_at:new Date().toISOString()};
  try{
    if($("productPhoto").files[0])payload.image_path=await uploadPhoto($("productPhoto").files[0],id);
    if(editingId){const old=products.find(x=>x.id===id);const {error}=await db.from("products").update(payload).eq("id",id);if(error)throw error;if(old?.image_path&&payload.image_path&&old.image_path!==payload.image_path)await db.storage.from("product-images").remove([old.image_path])}
    else{payload.id=id;payload.created_at=new Date().toISOString();const {error}=await db.from("products").insert(payload);if(error)throw error}
    closeModal();await loadProducts();toast(editingId?"Product updated":"Product added");
  }catch(err){toast(err.message,true)}
}
async function deleteProduct(id){const p=products.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.item_name}"?`))return;const {error}=await db.from("products").delete().eq("id",id);if(error){toast(error.message,true);return}if(p.image_path)await db.storage.from("product-images").remove([p.image_path]);await loadProducts();toast("Product removed")}
window.editProduct=id=>openModal(products.find(p=>p.id===id));
window.deleteProduct=deleteProduct;

$("toggleAuth").onclick=()=>{isSignup=!isSignup;$("authSubmit").textContent=isSignup?"Create account":"Sign in";$("toggleAuth").textContent=isSignup?"Already have an account? Sign in":"Create a new account"};
$("googleBtn").onclick=async()=>{
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await db.auth.signInWithOAuth({
    provider:"google",
    options:{redirectTo}
  });
  if(error)toast(error.message,true);
};
$("authForm").onsubmit=async e=>{e.preventDefault();const email=$("authEmail").value.trim(),password=$("authPassword").value;if(isSignup){const {error}=await db.auth.signUp({email,password});if(error)toast(error.message,true);else toast("Account created. Check your email if confirmation is required.")}else{const {error}=await db.auth.signInWithPassword({email,password});if(error)toast(error.message,true)}};
$("signOutBtn").onclick=()=>db.auth.signOut();
$("addTopBtn").onclick=()=>openModal();
$("closeModal").onclick=closeModal;$("cancelModal").onclick=closeModal;$("modal-backdrop")?.addEventListener("click",closeModal);
$("productForm").onsubmit=saveProduct;
$("productPhoto").onchange=e=>{const f=e.target.files[0];if(f){currentPhoto=f;const u=URL.createObjectURL(f);$("photoPreview").innerHTML=`<img src="${u}" alt="">`}};
["searchInput","categoryFilter","statusFilter"].forEach(id=>$(id).addEventListener("input",renderTable));
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
$("refreshBtn").onclick=()=>loadProducts();
$("accountEmail").textContent="—";
$("exportBtn").onclick=()=>{const rows=[["ID","Item Name","Category","SKU","Quantity","Purchase Price","Selling Price","Location","Min Stock","Created"],...products.map(p=>[p.id,p.item_name,p.category,p.sku,p.quantity,p.purchase_price,p.selling_price,p.location,p.min_stock,p.created_at])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="stockpilot-inventory.csv";a.click()};
$("importBtn").onclick=()=>$("csvFile").click();
$("csvFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;const text=await f.text(),lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)return;const rows=lines.slice(1).map(x=>x.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replace(/""/g,'"'))||[]);let added=0;for(const r of rows){if(!r[1])continue;const payload={user_id:session.user.id,item_name:r[1],category:r[2]||"",sku:r[3]||"",quantity:Number(r[4])||0,purchase_price:Number(r[5])||0,selling_price:Number(r[6])||0,location:r[7]||"",min_stock:Number(r[8])||0,created_at:r[9]||new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await db.from("products").insert(payload);if(!error)added++}await loadProducts();toast(`${added} products imported`)};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null;$("installBtn").classList.add("hidden")};
db.auth.onAuthStateChange(async(_event,s)=>{session=s;$("authView").classList.toggle("hidden",!!s);$("appView").classList.toggle("hidden",!s);if(s){$("accountEmail").textContent=s.user.email||"—";await loadProducts()}});
(async()=>{const {data}=await db.auth.getSession();session=data.session;$("authView").classList.toggle("hidden",!!session);$("appView").classList.toggle("hidden",!session);if(session){$("accountEmail").textContent=session.user.email||"—";await loadProducts()}})();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
