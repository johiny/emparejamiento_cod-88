let pairs = [];
let score = 0;
let draggingCable = null;
let activeConnections = []; // {termPort, descPort, group}
let timeLeft = 60;
let timerInterval = null;
let gameActive = true;

const svg = document.getElementById('cables-svg');
const gameContainer = document.getElementById('game-container');

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = 60;
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      verifyConnections();
    }
  }, 1000);
}

function updateTimerUI() {
  const timerEl = document.getElementById('timer');
  timerEl.textContent = timeLeft;
  if (timeLeft < 10) {
    timerEl.style.color = 'var(--neon-pink)';
  } else {
    timerEl.style.color = 'var(--neon-cyan)';
  }
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]
  }
}

async function loadData(){
  try{
    const res = await fetch('data.json');
    pairs = await res.json();
  }catch(e){
    pairs = [
      {"id":"1","term":"BIOS-7","description":"Sistema básico integrado de procesamiento neuronal."},
      {"id":"2","term":"Cyber-Link","description":"Cable de alta velocidad para transferencia de datos entre robots."}
    ];
  }
}

function render(){
  const termsList = document.getElementById('termsList');
  const descList = document.getElementById('descList');
  termsList.innerHTML = '';
  descList.innerHTML = '';
  
  while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
  }
  
  activeConnections = [];
  score = 0;
  gameActive = true;
  updateScore();
  startTimer();

  // Mezclamos el array original primero
  shuffle(pairs);

  // Mapeamos y volvemos a mezclar cada columna de forma independiente
  const terms = pairs.map(p=>({id:p.id, text:p.term}));
  const descs = pairs.map(p=>({id:p.id, text:p.description}));
  
  shuffle(terms); 
  shuffle(descs);

  document.getElementById('total').textContent = pairs.length;


  terms.forEach(t => {
    const li = createItem(t.text, t.id, 'term');
    termsList.appendChild(li);
  });

  descs.forEach(d => {
    const li = createItem(d.text, d.id, 'desc');
    descList.appendChild(li);
  });
}

function createItem(text, id, type) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = id;
  
  const label = document.createElement('span');
  label.textContent = text;
  
  const port = document.createElement('div');
  port.className = 'port';
  port.dataset.id = id;
  port.dataset.type = type;

  if (type === 'term') {
    li.appendChild(label);
    li.appendChild(port);
  } else {
    li.appendChild(port);
    li.appendChild(label);
  }

  port.addEventListener('mousedown', startCable);
  return li;
}

function startCable(e) {
  if (!gameActive) return;
  const port = e.target;
  if (port.classList.contains('connected')) return;

  const rect = port.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  
  const startX = rect.left + rect.width / 2 - containerRect.left;
  const startY = rect.top + rect.height / 2 - containerRect.top;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'cable-group');

  const outerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outerPath.setAttribute('class', 'cable-outer');
  
  const innerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  innerPath.setAttribute('class', 'cable-inner');

  group.appendChild(outerPath);
  group.appendChild(innerPath);
  svg.appendChild(group);

  draggingCable = {
    group,
    outerPath,
    innerPath,
    startX,
    startY,
    startPort: port,
    type: port.dataset.type,
    id: port.dataset.id
  };

  window.addEventListener('mousemove', moveCable);
  window.addEventListener('mouseup', endCable);
}

function moveCable(e) {
  if (!draggingCable) return;
  const containerRect = gameContainer.getBoundingClientRect();
  const mouseX = e.clientX - containerRect.left;
  const mouseY = e.clientY - containerRect.top;

  updatePath(draggingCable.outerPath, draggingCable.startX, draggingCable.startY, mouseX, mouseY);
  updatePath(draggingCable.innerPath, draggingCable.startX, draggingCable.startY, mouseX, mouseY);
}

function endCable(e) {
  if (!draggingCable) return;
  
  const targetPort = document.elementFromPoint(e.clientX, e.clientY);
  
  if (targetPort && 
      targetPort.classList.contains('port') && 
      !targetPort.classList.contains('connected') &&
      targetPort.dataset.type !== draggingCable.type) {
    
    const rect = targetPort.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();
    const endX = rect.left + rect.width / 2 - containerRect.left;
    const endY = rect.top + rect.height / 2 - containerRect.top;

    updatePath(draggingCable.outerPath, draggingCable.startX, draggingCable.startY, endX, endY);
    updatePath(draggingCable.innerPath, draggingCable.startX, draggingCable.startY, endX, endY);
    
    draggingCable.startPort.classList.add('connected');
    targetPort.classList.add('connected');

    activeConnections.push({
      termPort: draggingCable.type === 'term' ? draggingCable.startPort : targetPort,
      descPort: draggingCable.type === 'desc' ? draggingCable.startPort : targetPort,
      group: draggingCable.group
    });

  } else {
    svg.removeChild(draggingCable.group);
  }

  draggingCable = null;
  window.removeEventListener('mousemove', moveCable);
  window.removeEventListener('mouseup', endCable);
}

function verifyConnections() {
  if (!gameActive) return;
  gameActive = false;
  clearInterval(timerInterval);
  
  score = 0;
  activeConnections.forEach(conn => {
    if (conn.termPort.dataset.id === conn.descPort.dataset.id) {
      conn.group.classList.add('correct');
      score++;
    } else {
      conn.group.classList.add('wrong');
      const inner = conn.group.querySelector('.cable-inner');
      inner.classList.add('fail');
    }
  });

  updateScore();
  showResultModal();
}

function showResultModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const percent = Math.round((score / pairs.length) * 100);
  
  let msg = `Sistemas Sincronizados: <span class="modal-stat">${score} / ${pairs.length}</span>\n`;
  msg += `Eficiencia del Nexo: <span class="modal-stat">${percent}%</span>\n\n`;
  
  if (percent === 100) {
    msg += "ESTADO: OPTIMIZADO. El núcleo es estable y todas las transmisiones fluyen sin errores.";
  } else if (percent >= 70) {
    msg += "ESTADO: FUNCIONAL. Sincronización suficiente para mantener la red, pero se recomienda revisión.";
  } else {
    msg += "ESTADO: CRÍTICO. Pérdida de datos masiva detectada. Reinicie el protocolo de emergencia.";
  }

  content.innerHTML = msg;
  overlay.classList.remove('hidden');
}

document.getElementById('modalCloseBtn').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});

function updatePath(path, x1, y1, x2, y2) {
  const offset = Math.abs(x2 - x1) / 2;
  const cp1x = x1 + offset;
  const cp2x = x2 - offset;
  path.setAttribute('d', `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`);
}

function updateScore() {
  document.getElementById('score').textContent = score;
}

document.getElementById('verifyBtn').addEventListener('click', verifyConnections);
document.getElementById('resetBtn').addEventListener('click', async () => {
  initBinaryBg(); // Regenerar fondo binario
  await loadData();
  render();
});


(async () => {
  initBinaryBg();
  await loadData();
  render();
})();

function initBinaryBg() {
  const bg = document.getElementById('binary-bg');
  const rows = Math.ceil(window.innerHeight / 14);
  const cols = Math.ceil(window.innerWidth / 8);
  let binaryString = "";
  
  for (let i = 0; i < rows * cols; i++) {
    binaryString += Math.round(Math.random());
  }
  
  bg.textContent = binaryString;

  // Hacer que cambie ligeramente con el tiempo
  setInterval(() => {
    let arr = bg.textContent.split("");
    for (let i = 0; i < 50; i++) {
      let idx = Math.floor(Math.random() * arr.length);
      arr[idx] = arr[idx] === "0" ? "1" : "0";
    }
    bg.textContent = arr.join("");
  }, 100);
}



