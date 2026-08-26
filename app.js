let rows = [];
let chartInstances = {};

const $ = (id) => document.getElementById(id);

function cleanNumber(v){
  if(v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g,'').replace(/[^\d.-]/g,''));
  return Number.isFinite(n) ? n : 0;
}

function parseSimpleFee(v){
  if(v === null || v === undefined) return null;
  const s = String(v).trim();
  if(!s) return null;
  const normalized = s.replace(/\s+/g, "");
  if(!/^[0-9,]+(?:\.[0-9]+)?원?$/.test(normalized)) return null;
  const n = Number(normalized.replace(/원$/,'').replace(/,/g,''));
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolPaid(row){
  const raw = String(
    row["유료사용여부"] ??
    row["유료여부"] ??
    row["유료사용"] ??
    ""
  ).trim().toUpperCase();

  const feeRaw = row["사용료"] ?? row["기본사용료"] ?? row["이용료"] ?? "";
  const fee = parseSimpleFee(feeRaw);

  if(["Y","YES","유료","1","TRUE","O"].includes(raw)) return true;
  if(["N","NO","무료","0","FALSE","X"].includes(raw)) return false;

  return fee !== null ? fee > 0 : /[1-9]/.test(String(feeRaw));
}

function parseHour(v){
  if(!v) return null;
  const s = String(v).trim();
  const m = s.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if(!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  return h + min / 60;
}

function operatingHours(row, prefix){
  const start = parseHour(row[`${prefix}운영시작시각`]);
  const end = parseHour(row[`${prefix}운영종료시각`]);
  if(start === null || end === null) return null;
  return end >= start ? end - start : (24 - start + end);
}

function facilityName(r){
  return r["개방시설명"] || r["개방장소명"] || "시설명 없음";
}

function formatNum(n, digits=0){
  return Number(n || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function destroyChart(name){
  if(chartInstances[name]) chartInstances[name].destroy();
}

function getTopCount(field, limit=10){
  const map = {};
  rows.forEach(r=>{
    const key = String(r[field] ?? "").trim() || "미분류";
    map[key]=(map[key]||0)+1;
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,limit);
}

function renderKpis(){
  const total = rows.length;
  const paid = rows.filter(normalizeBoolPaid).length;
  const free = total - paid;
  const fees = rows.map(r=>parseSimpleFee(r["사용료"])).filter(v=>v !== null && v>0);
  const capacities = rows.map(r=>cleanNumber(r["수용가능인원수"])).filter(v=>v>0);
  const areas = rows.map(r=>cleanNumber(r["면적"])).filter(v=>v>0);

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  $("kpiTotal").textContent = formatNum(total);
  $("kpiPaid").textContent = formatNum(paid);
  $("kpiFree").textContent = formatNum(free);
  $("kpiFee").textContent = formatNum(avg(fees));
  $("kpiCapacity").textContent = formatNum(avg(capacities),1);
  $("kpiArea").textContent = formatNum(avg(areas),1);

  const typeTop = getTopCount("개방시설유형구분", 1)[0];
  const weekendCount = rows.filter(r => operatingHours(r,"주말") > 0).length;
  const paidRate = total ? paid/total*100 : 0;

  let text = `전체 ${formatNum(total)}개 시설 중 유료 시설은 ${formatNum(paid)}개(${paidRate.toFixed(1)}%), 무료 시설은 ${formatNum(free)}개입니다.`;
  if(typeTop) text += ` 가장 많이 등록된 시설유형은 '${typeTop[0]}'으로 ${typeTop[1]}개입니다.`;
  if(capacities.length) text += ` 평균 수용가능인원은 ${formatNum(avg(capacities),1)}명이며, 시설 규모를 비교할 때는 평균값뿐 아니라 상·하위 시설의 편차도 함께 보는 것이 좋습니다.`;
  if(fees.length) text += ` 단일 금액으로 명확하게 입력된 유료 시설의 평균 기본사용료는 약 ${formatNum(avg(fees))}원입니다. 복합요금표는 평균에서 제외했습니다.`;
  if(weekendCount) text += ` 주말 운영시간이 확인되는 시설은 ${formatNum(weekendCount)}개입니다.`;
  text += `\n\n해석 포인트: 시설 수 자체보다 '유형별 공급', '수용인원', '시간당 비용', '주말 이용 가능성'을 함께 보면 실제 이용 관점에서 더 의미 있는 판단이 가능합니다.`;

  $("overviewInsight").textContent = text;
}

function renderTypeCharts(){
  const typeData = getTopCount("개방시설유형구분", 12);
  destroyChart("type");
  chartInstances.type = new Chart($("typeChart"),{
    type:"bar",
    data:{
      labels:typeData.map(x=>x[0]),
      datasets:[{label:"시설 수",data:typeData.map(x=>x[1])}]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true,ticks:{precision:0}}}
    }
  });

  const paid = rows.filter(normalizeBoolPaid).length;
  const free = rows.length-paid;
  destroyChart("fee");
  chartInstances.fee = new Chart($("feeChart"),{
    type:"doughnut",
    data:{
      labels:["유료","무료"],
      datasets:[{data:[paid,free]}]
    },
    options:{responsive:true,plugins:{legend:{position:"bottom"}}}
  });

  if(typeData.length){
    const top = typeData[0];
    const second = typeData[1];
    let msg = `'${top[0]}' 유형이 ${top[1]}개로 가장 많습니다.`;
    if(second) msg += ` 다음은 '${second[0]}' ${second[1]}개입니다.`;
    msg += ` 특정 유형에 시설이 집중되어 있다면 이용자의 선택 폭이 제한될 수 있으므로, 유형별 공급 편차를 함께 확인하는 것이 좋습니다.`;
    $("typeInsight").textContent = msg;
  }
}

function enrichRows(){
  rows = rows.map(r=>{
    const fee = parseSimpleFee(r["사용료"]);
    const baseHours = cleanNumber(r["사용기준시간"]);
    const cap = cleanNumber(r["수용가능인원수"]);
    const area = cleanNumber(r["면적"]);
    return {
      ...r,
      _fee:fee,
      _capacity:cap,
      _area:area,
      _hourlyFee: (fee !== null && baseHours > 0) ? fee/baseHours : null,
      _perPersonFee: (fee !== null && cap > 0) ? fee/cap : null,
      _areaPerPerson: cap > 0 ? area/cap : null
    };
  });
}

function renderCostCharts(){
  const capTop = [...rows].filter(r=>r._capacity>0).sort((a,b)=>b._capacity-a._capacity).slice(0,10);
  destroyChart("capacity");
  chartInstances.capacity = new Chart($("capacityChart"),{
    type:"bar",
    data:{
      labels:capTop.map(facilityName),
      datasets:[{label:"수용가능인원",data:capTop.map(r=>r._capacity)}]
    },
    options:{
      indexAxis:"y",
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}
    }
  });

  const hourlyTop = [...rows].filter(r=>r._hourlyFee>0).sort((a,b)=>b._hourlyFee-a._hourlyFee).slice(0,10);
  destroyChart("hourly");
  chartInstances.hourly = new Chart($("hourlyFeeChart"),{
    type:"bar",
    data:{
      labels:hourlyTop.map(facilityName),
      datasets:[{label:"시간당 사용료",data:hourlyTop.map(r=>Math.round(r._hourlyFee))}]
    },
    options:{
      indexAxis:"y",
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true}}
    }
  });

  const scatterRows = rows.filter(r=>r._capacity>0 && r._hourlyFee !== null);
  destroyChart("scatter");
  chartInstances.scatter = new Chart($("scatterChart"),{
    type:"scatter",
    data:{
      datasets:[{
        label:"시설",
        data:scatterRows.map(r=>({
          x:r._capacity,
          y:r._hourlyFee,
          name:facilityName(r)
        }))
      }]
    },
    options:{
      responsive:true,
      plugins:{
        tooltip:{
          callbacks:{
            label:(ctx)=>{
              const d=ctx.raw;
              return `${d.name}: ${formatNum(d.x)}명 / ${formatNum(d.y)}원·시간`;
            }
          }
        }
      },
      scales:{
        x:{title:{display:true,text:"수용가능인원(명)"},beginAtZero:true},
        y:{title:{display:true,text:"시간당 사용료(원)"},beginAtZero:true}
      }
    }
  });

  const maxCap = capTop[0];
  const lowHourly = [...rows].filter(r=>r._hourlyFee>0).sort((a,b)=>a._hourlyFee-b._hourlyFee)[0];
  let msg = "";
  if(maxCap) msg += `수용인원이 가장 큰 시설은 '${facilityName(maxCap)}'으로 ${formatNum(maxCap._capacity)}명입니다. `;
  if(lowHourly) msg += `시간당 사용료가 가장 낮은 유료 시설은 '${facilityName(lowHourly)}'으로 약 ${formatNum(lowHourly._hourlyFee)}원/시간입니다. `;
  msg += `산점도에서는 오른쪽 아래에 위치한 시설이 대체로 '많은 인원을 상대적으로 낮은 시간당 비용으로 수용하는 시설'에 해당합니다.`;
  $("costInsight").textContent = msg;
}

function renderRankLists(){
  const valueRows = [...rows]
    .filter(r=>r._perPersonFee !== null && r._perPersonFee >= 0 && r._capacity>0)
    .sort((a,b)=>a._perPersonFee-b._perPersonFee)
    .slice(0,10);

  const spaceRows = [...rows]
    .filter(r=>r._areaPerPerson !== null && r._areaPerPerson>0)
    .sort((a,b)=>b._areaPerPerson-a._areaPerPerson)
    .slice(0,10);

  $("bestValueList").innerHTML = valueRows.length ? valueRows.map((r,i)=>`
    <div class="rank-item">
      <div class="rank-no">${i+1}</div>
      <div class="rank-name" title="${facilityName(r)}">${facilityName(r)}</div>
      <div class="rank-value">${formatNum(r._perPersonFee)}원/인</div>
    </div>
  `).join("") : `<div class="empty">계산 가능한 데이터가 없습니다.</div>`;

  $("spaceList").innerHTML = spaceRows.length ? spaceRows.map((r,i)=>`
    <div class="rank-item">
      <div class="rank-no">${i+1}</div>
      <div class="rank-name" title="${facilityName(r)}">${facilityName(r)}</div>
      <div class="rank-value">${formatNum(r._areaPerPerson,2)}㎡/인</div>
    </div>
  `).join("") : `<div class="empty">계산 가능한 데이터가 없습니다.</div>`;
}

function buildTypeFilter(){
  const vals = [...new Set(rows.map(r=>String(r["개방시설유형구분"] ?? "").trim()).filter(Boolean))].sort();
  $("typeFilter").innerHTML = `<option value="">전체 시설유형</option>` +
    vals.map(v=>`<option value="${v}">${v}</option>`).join("");
}

function renderTable(){
  const q = $("searchInput").value.trim().toLowerCase();
  const t = $("typeFilter").value;
  const filtered = rows.filter(r=>{
    const text = [
      facilityName(r),
      r["개방장소명"],
      r["개방시설유형구분"],
      r["소재지도로명주소"],
      r["소재지지번주소"],
      r["관리기관명"]
    ].join(" ").toLowerCase();
    const typeOk = !t || String(r["개방시설유형구분"] ?? "").trim() === t;
    return typeOk && (!q || text.includes(q));
  });

  $("facilityTableBody").innerHTML = filtered.length ? filtered.map(r=>`
    <tr>
      <td>${facilityName(r)}</td>
      <td>${r["개방장소명"] ?? ""}</td>
      <td>${r["개방시설유형구분"] ?? ""}</td>
      <td>${r._capacity ? formatNum(r._capacity) : "-"}</td>
      <td>${r._area ? formatNum(r._area,1) : "-"}</td>
      <td>${String(r["사용료"] ?? "").trim() || "미입력"}</td>
      <td>${r._hourlyFee !== null ? formatNum(r._hourlyFee) + "원" : "-"}</td>
      <td>${r["신청방법구분"] ?? ""}</td>
      <td>${r["소재지도로명주소"] ?? r["소재지지번주소"] ?? ""}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="empty">조건에 맞는 시설이 없습니다.</td></tr>`;
}

function renderAll(){
  enrichRows();
  renderKpis();
  renderTypeCharts();
  renderCostCharts();
  renderRankLists();
  buildTypeFilter();
  renderTable();
}

$("csvFile").addEventListener("change",(e)=>{
  const file = e.target.files[0];
  if(!file) return;
  $("fileName").textContent = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const buffer = reader.result;
      let text = "";

      const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
      if (replacementCount > 0) {
        text = new TextDecoder("euc-kr", { fatal: false }).decode(buffer);
      } else {
        text = utf8Text;
      }

      Papa.parse(text,{
        header:true,
        skipEmptyLines:true,
        complete:(result)=>{
          rows = result.data
            .map(r => {
              const cleaned = {};
              Object.entries(r).forEach(([k,v]) => {
                const key = String(k ?? "")
                  .replace(/^\uFEFF/, "")
                  .replace(/\s+/g, "")
                  .trim();
                cleaned[key] = v;
              });
              return cleaned;
            })
            .filter(r=>Object.values(r).some(v=>String(v??"").trim()!==""));

          if (rows.length && !("유료사용여부" in rows[0])) {
            console.log("읽힌 열 이름:", Object.keys(rows[0]));
            alert("'유료사용여부' 열을 찾지 못했습니다. CSV 인코딩 또는 열 이름을 확인해 주세요.");
          }

          renderAll();
          document.querySelector(".container").scrollIntoView({behavior:"smooth",block:"start"});
        },
        error:(err)=>{
          alert("CSV 내용을 분석하는 중 오류가 발생했습니다: " + err.message);
        }
      });
    } catch (err) {
      alert("CSV 파일의 문자 인코딩을 읽는 중 오류가 발생했습니다: " + err.message);
    }
  };
  reader.onerror = () => alert("CSV 파일을 읽을 수 없습니다.");
  reader.readAsArrayBuffer(file);
});

$("searchInput").addEventListener("input",renderTable);
$("typeFilter").addEventListener("change",renderTable);
