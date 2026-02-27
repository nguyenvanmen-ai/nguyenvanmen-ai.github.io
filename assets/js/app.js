/** =========================
 *  CẤU HÌNH (tuỳ chọn)
 *  Nếu bạn có Apps Script upload lên Drive: dán URL vào UPLOAD_API.
 *  Nếu để trống: chỉ lưu danh sách file theo ngày trong trình duyệt.
 *  ========================= */
const UPLOAD_API = ""; // ví dụ: "https://script.google.com/macros/s/.../exec"

const LS_KEY = "tonkho_daily_files_v1";

const $ = (id)=>document.getElementById(id);

function nowVNDate(){
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth()+1).padStart(2,"0");
  const dd = String(t.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadFiles(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function saveFiles(arr){
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}
function setCount(n){
  $("countText").textContent = `${n} file`;
}
function setHint(text, ok=true){
  const el = $("uploadHint");
  el.style.color = ok ? "rgba(255,255,255,.7)" : "#ffd0d0";
  el.textContent = text;
}

async function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result||"").split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

let state = {
  files: loadFiles(),     // [{date,name,size,url?}]
  activeDate: null
};

function renderList(){
  const list = $("fileList");
  list.innerHTML = "";

  if (!state.files.length){
    const div = document.createElement("div");
    div.className = "file-empty";
    div.id = "fileEmpty";
    div.textContent = "Chưa có file nào";
    list.appendChild(div);
  } else {
    state.files
      .slice()
      .sort((a,b)=> (a.date<b.date?1:-1))
      .forEach(item=>{
        const el = document.createElement("div");
        el.className = "file-item" + (item.date===state.activeDate ? " active":"");
        el.innerHTML = `
          <div class="file-meta">
            <div class="file-name">${item.name}</div>
            <div class="file-date">${item.date}</div>
          </div>
          <div class="pill">${item.size || ""}</div>
        `;
        el.onclick = ()=> selectFile(item.date);
        list.appendChild(el);
      });
  }

  setCount(state.files.length);
}

function selectFile(date){
  state.activeDate = date;
  const item = state.files.find(x=>x.date===date);

  renderList();

  $("emptyPanel").style.display = "none";
  $("workArea").classList.add("show");

  $("activeFileTitle").textContent = item?.name || "File tồn kho";
  $("activeFileSub").textContent = `Ngày: ${date}` + (item?.url ? ` • Có link Drive` : "");
}

async function handleUpload(){
  const date = $("dateInput").value || nowVNDate();
  const file = $("fileInput").files[0];
  if (!file) return setHint("Bạn chưa chọn file.", false);

  const ext = (file.name.split(".").pop() || "xlsx").toLowerCase();
  const dailyName = `${date}.${ext}`;

  setHint("Đang upload...", true);

  let driveUrl = "";
  if (UPLOAD_API){
    try{
      const b64 = await fileToBase64(file);
      const res = await fetch(UPLOAD_API, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          date,
          fileName: dailyName,
          base64: b64,
          overwrite: true
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Upload thất bại");
      driveUrl = json.url || "";
      setHint("✅ Upload thành công lên Drive", true);
    }catch(e){
      console.error(e);
      return setHint("❌ Lỗi upload Drive: " + e.message, false);
    }
  } else {
    setHint("✅ Đã lưu danh sách file trong trình duyệt (chưa upload Drive)", true);
  }

  const sizeText = file.size ? (file.size/1024/1024).toFixed(2) + " MB" : "";
  const newItem = { date, name: dailyName, size: sizeText, url: driveUrl };

  const idx = state.files.findIndex(x=>x.date===date);
  if (idx>=0) state.files[idx] = newItem; else state.files.push(newItem);

  saveFiles(state.files);
  renderList();
  selectFile(date);

  $("fileInput").value = "";
}

function clearList(){
  localStorage.removeItem(LS_KEY);
  state.files = [];
  state.activeDate = null;

  renderList();
  $("workArea").classList.remove("show");
  $("emptyPanel").style.display = "grid";
  setHint("Tip: mỗi ngày 1 file (YYYY-MM-DD.xlsx)", true);
}

function setupDropzone(){
  const dz = $("dropzone");
  dz.addEventListener("dragover", (e)=>{ e.preventDefault(); dz.style.background="rgba(255,255,255,.07)"; });
  dz.addEventListener("dragleave", ()=>{ dz.style.background="rgba(255,255,255,.04)"; });
  dz.addEventListener("drop", (e)=>{
    e.preventDefault();
    dz.style.background="rgba(255,255,255,.04)";
    const f = e.dataTransfer.files?.[0];
    if (f){
      $("fileInput").files = e.dataTransfer.files;
      setHint("Đã nhận file, bấm Upload theo ngày.", true);
    }
  });
}

function setupSearchDemo(){
  $("searchBtn").addEventListener("click", ()=>{
    const q = $("q").value.trim();
    const tb = $("tbody");
    tb.innerHTML = `
      <tr>
        <td class="muted" colspan="6">
          Bạn vừa tìm: <b>${q || "(trống)"}</b>.
          (Demo UI — khi bạn muốn tra cứu thật theo file ngày <b>${state.activeDate || "—"}</b> mình sẽ nối API)
        </td>
      </tr>
    `;
  });
}

(function init(){
  $("dateInput").value = nowVNDate();
  renderList();
  setupDropzone();
  setupSearchDemo();

  $("uploadBtn").addEventListener("click", handleUpload);
  $("clearBtn").addEventListener("click", clearList);
})();
