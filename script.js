const SUPABASE_URL="https://dcrzycefzfrcmbqcecmm.supabase.co";
const SUPABASE_KEY="sb_publishable_yEJVgMqnuf_Eyj5IKvAPJQ_VAQqa2y5";
const {createClient}=window.supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let products=[], session=null, editingPhoto=null, deferredInstall=null, signUpMode=false;

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const statusOf=p=>Number(p.quantity)<=0?"out":Number(p.quantity)<=Number(p.min_stock||0)?"low":"in";
const statusLabel=s=>s==="out"?"Out of stock":s==="low"?"Low stock":"In stock";
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function setSync(ok=true){$("syncText").textContent=ok?"Synced":"Syncing…";document.querySelector(".sync-pill i").style.background=ok?"#22c55e":"#f59e0b"}

async function init(){
  const {data}=await db.auth.getSession(); session=data.session;
  if(session) showApp(); else showAuth();
  db.auth.onAuthStateChange((_e,s)=>{session=s;if(s)showApp();else showAuth()});
  setupUI();
}
function showAuth(){ $("authScreen").classList.remove("hidden");$("app").classList.add("hidden") }
async function showApp(){
  $("authScreen").classList.add("hidden");$("app").classList.remove("hidden");
  $("accountEmail").textContent=session?.user?.email||"—";
  await loadProducts();
}
async function loadProducts(){
  setSync(false);
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error){toast(error.message);setSync(false);return}
  products=data||[]; setSync(true); renderAll();
}
function renderAll(){renderDashboard();renderInventory();renderAnalytics();populateCategories()}
function populateCategories(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const current=$("categoryFilter").value;
  $("categoryFilter").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("");
  $("categoryFilter").value=cats.includes(current)?current:"";
}
function renderDashboard(){
  const units=products.reduce((a,p)=>a+Number(p.quantity||0),0);
  const value=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0);
  const low=products.filter(p=>statusOf(p)==="low").length;
  $("statProducts").textContent=products.length;$("statUnits").textContent=units;$("statValue").textContent=money(value);$("statLow").textContent=low;
  const counts={in:products.filter(p=>statusOf(p)==="in").length,low,out:products.filter(p=>statusOf(p)==="out").length};
  $("healthIn").textContent=counts.in;$("healthLow").textContent=counts.low;$("healthOut").textContent=counts.out;
  const total=Math.max(products.length,1);
  $("barIn").style.width=counts.in/total*100+"%";$("barLow").style.width=counts.low/total*100+"%";$("barOut").style.width=counts.out/total*100+"%";
  $("recentList").innerHTML=products.slice(0,6).map(rowHTML).join("")||'<div class="empty"><p>No products yet.</p></div>';
}
function rowHTML(p){
  const s=statusOf(p), photo=p.image_url?`<img src="${p.image_url}" alt="">`:"▣";
  return `<div class="product-row"><div class="thumb">${photo}</div><div class="product-info"><strong>${esc(p.item_name)}</strong><small>${esc(p.sku||"No SKU")} · ${Number(p.quantity||0)} units</small></div><span class="badge ${s}">${statusLabel(s)}</span></div>`;
}
function renderInventory(){
  const q=$("search").value.trim().toLowerCase(), cat=$("categoryFilter").value, st=$("statusFilter").value;
  const filtered=products.filter(p=>{
    const text=`${p.item_name||""} ${p.sku||""} ${p.category||""} ${p.location||""}`.toLowerCase();
    return (!q||text.includes(q))&&(!cat||p.category===cat)&&(!st||statusOf(p)===st);
  });
  $("inventoryBody").innerHTML=filtered.map(p=>{
    const s=statusOf(p),photo=p.image_url?`<img src="${p.image_url}" alt="">`:"▣";
    return `<tr><td><div class="table-product"><div class="thumb">${photo}</div><strong>${esc(p.item_name)}</strong></div></td><td>${esc(p.sku||"—")}</td><td>${esc(p.category||"—")}</td><td><strong>${Number(p.quantity||0)}</strong></td><td>${money(p.purchase_price)}</td><td>${money(p.selling_price)}</td><td>${esc(p.location||"—")}</td><td><span class="badge ${s}">${statusLabel(s)}</span></td><td><button class="action-btn" onclick="editProduct('${p.id}')">Edit</button><button class="action-btn" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`
  }).join("");
  $("emptyState").classList.toggle("hidden",filtered.length>0);
}
function renderAnalytics(){
  const purchase=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.purchase_price||0),0);
  const sales=products.reduce((a,p)=>a+Number(p.quantity||0)*Number(p.selling_price||0),0);
  $("purchaseTotal").textContent=money(purchase);$("salesTotal").textContent=money(sales);$("marginTotal").textContent=money(sales-purchase);
  const cats={};products.forEach(p=>{const c=p.category||"Uncategorized";cats[c]=(cats[c]||0)+Number(p.quantity||0)});
  const vals=Object.values(cats),max=Math.max(...vals,1);
  $("categoryBars").innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="cat-line"><div><span>${esc(c)}</span><strong>${v}</strong></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join("")||"<p class='muted'>No data yet.</p>";
  const attention=products.filter(p=>statusOf(p)!=="in");
  $("attentionList").innerHTML=attention.map(p=>`<div class="attention-item"><div><strong>${esc(p.item_name)}</strong><div class="muted">${Number(p.quantity||0)} units · ${esc(p.location||"No location")}</div></div><span class="badge ${statusOf(p)}">${statusLabel(statusOf(p))}</span></div>`).join("")||"<p class='muted'>Everything looks healthy.</p>";
}
function switchView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(view+"View").classList.remove("hidden");
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  window.scrollTo({top:0,behavior:"smooth"});
}
function setupUI(){
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
  ["addTop","dashboardAdd","inventoryAdd","emptyAdd"].forEach(id=>$(id).onclick=()=>openModal());
  $("search").oninput=renderInventory;$("categoryFilter").onchange=renderInventory;$("statusFilter").onchange=renderInventory;
  $("refreshData").onclick=loadProducts;
  $("signOut").onclick=async()=>{await db.auth.signOut();toast("Signed out")};
  $("toggleAuth").onclick=()=>{signUpMode=!signUpMode;$("authSubmit").textContent=signUpMode?"Create account":"Sign in";$("toggleAuth").textContent=signUpMode?"Already have an account? Sign in":"Create a new account"};
  $("authForm").onsubmit=authSubmit;
  $("productForm").onsubmit=saveProduct;$("photo").onchange=photoSelected;$("removePhoto").onclick=removePhoto;
  document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);
  $("exportCsv").onclick=exportCsv;$("importCsv").onchange=importCsv;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").classList.remove("hidden")});
  $("installBtn").onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();deferredInstall=null;$("installBtn").classList.add("hidden")};
}
async function authSubmit(e){
  e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
  const r=signUpMode?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(r.error){toast(r.error.message);return}toast(signUpMode?"Account created.":"Signed in.");
}
function openModal(p=null){
  $("modal").classList.remove("hidden");$("modalTitle").textContent=p?"Edit product":"Add product";$("productId").value=p?.id||"";
  $("itemName").value=p?.item_name||"";$("sku").value=p?.sku||"";$("category").value=p?.category||"";$("location").value=p?.location||"";
  $("quantity").value=p?.quantity??0;$("minStock").value=p?.min_stock??5;$("purchasePrice").value=p?.purchase_price??0;$("sellingPrice").value=p?.selling_price??0;
  editingPhoto=p?.image_path||null;$("photoPreview").innerHTML=p?.image_url?`<img src="${p.image_url}" alt="">`:"＋";$("removePhoto").classList.toggle("hidden",!p?.image_path);
}
function closeModal(){ $("modal").classList.add("hidden");$("photo").value="";editingPhoto=null }
function editProduct(id){const p=products.find(x=>x.id===id);if(p)openModal(p)}
async function photoSelected(){
  const file=$("photo").files[0];if(!file)return;
  const url=URL.createObjectURL(file);$("photoPreview").innerHTML=`<img src="${url}" alt="">`;$("removePhoto").classList.remove("hidden");
}
function removePhoto(){editingPhoto="REMOVE";$("photoPreview").innerHTML="＋";$("photo").value="";$("removePhoto").classList.add("hidden")}
async function uploadPhoto(file,userId){
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`${userId}/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;return path;
}
async function signedUrl(path){if(!path)return null;const {data,error}=await db.storage.from("product-images").createSignedUrl(path,3600);return error?null:data.signedUrl}
async function saveProduct(e){
  e.preventDefault();if(!session)return;
  setSync(false);
  try{
    const id=$("productId").value||null;
    let image_path=editingPhoto==="REMOVE"?null:editingPhoto;
    const file=$("photo").files[0];if(file)image_path=await uploadPhoto(file,session.user.id);
    const payload={item_name:$("itemName").value.trim(),sku:$("sku").value.trim()||null,category:$("category").value.trim()||null,location:$("location").value.trim()||null,quantity:Number($("quantity").value)||0,min_stock:Number($("minStock").value)||0,purchase_price:Number($("purchasePrice").value)||0,selling_price:Number($("sellingPrice").value)||0,image_path,updated_at:new Date().toISOString()};
    let result=id?await db.from("products").update(payload).eq("id",id).select().single():await db.from("products").insert({...payload,user_id:session.user.id}).select().single();
    if(result.error)throw result.error;
    if(id&&editingPhoto==="REMOVE"){} 
    const signed=await signedUrl(result.data.image_path);result.data.image_url=signed;
    products=id?products.map(p=>p.id===id?result.data:p):[result.data,...products];
    closeModal();renderAll();setSync(true);toast(id?"Product updated":"Product added");
  }catch(err){setSync(false);toast(err.message)}
}
async function deleteProduct(id){
  const p=products.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.item_name}"?`))return;
  setSync(false);const {error}=await db.from("products").delete().eq("id",id);
  if(error){toast(error.message);setSync(false);return}
  products=products.filter(x=>x.id!==id);renderAll();setSync(true);toast("Product deleted");
}
async function hydrateImages(){
  for(const p of products)if(p.image_path)p.image_url=await signedUrl(p.image_path);
}
async function exportCsv(){
  const headers=["ID","Item Name","Category","SKU","Quantity","Purchase Price","Selling Price","Location","Min Stock","Created"];
  const rows=products.map(p=>[p.id,p.item_name,p.category,p.sku,p.quantity,p.purchase_price,p.selling_price,p.location,p.min_stock,p.created_at]);
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="stockpilot-inventory.csv";a.click();URL.revokeObjectURL(a.href);
}
function parseCsv(text){
  const lines=text.split(/\r?\n/).filter(Boolean);if(!lines.length)return [];
  return lines.slice(1).map(line=>{const out=[],re=/"([^"]*(?:""[^"]*)*)"|([^,]+)/g;let m;while((m=re.exec(line)))out.push(m[1]!==undefined?m[1].replace(/""/g,'"'):m[2]);return out});
}
async function importCsv(e){
  const file=e.target.files[0];if(!file)return;const rows=parseCsv(await file.text());
  if(!rows.length){toast("No rows found");return}
  setSync(false);let ok=0;
  for(const r of rows){const [id,item,cat,sku,qty,pur,sell,loc,min]=r;if(!item)continue;const {error}=await db.from("products").insert({user_id:session.user.id,item_name:item,category:cat||null,sku:sku||null,quantity:Number(qty)||0,purchase_price:Number(pur)||0,selling_price:Number(sell)||0,location:loc||null,min_stock:Number(min)||0});if(!error)ok++}
  await loadProducts();toast(`${ok} product${ok===1?"":"s"} imported`);
}
init();
