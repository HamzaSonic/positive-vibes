(() => {
  const STORAGE_KEY = "good-vibes-share-v1";
  const REMOTE_URL = "https://mantledb.sh/v2/good-vibes-you-yassiii/state";
  const POLL_MS = 4000;
  const EMERGENCY_CODE = 0.5;
  const DEFAULT = { left: 50, right: 50, emergency: false };

  const liquidLeft = document.getElementById("liquid-left");
  const liquidRight = document.getElementById("liquid-right");
  const pctLeft = document.getElementById("pct-left");
  const pctRight = document.getElementById("pct-right");
  const overflowTag = document.getElementById("overflow-tag");
  const emergencyBanner = document.getElementById("emergency-banner");
  const emergencyMessage = document.getElementById("emergency-message");
  const amountInput = document.getElementById("amount");
  const amountHint = document.getElementById("amount-hint");
  const sendLeftBtn = document.getElementById("send-left");
  const sendRightBtn = document.getElementById("send-right");
  const resetBtn = document.getElementById("reset");
  const statusEl = document.getElementById("status");
  const transmitter = document.querySelector(".transmitter");
  const beams = document.getElementById("beams");
  const floaters = document.getElementById("floaters");
  const chips = [...document.querySelectorAll(".chip")];
  const bucketLeft = document.querySelector('.bucket[data-side="left"]');
  const bucketRight = document.querySelector('.bucket[data-side="right"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = { ...DEFAULT };
  let busy = false;
  let lastRemoteUpdatedAt = 0;
  let emergencyLoop = null;
  let overflowDisplay = 100;

  const emergencyLines = [
    "Yassiii’s bucket can’t hold this much love",
    "Critical overflow — good vibes everywhere",
    "Emergency warmth protocol fully engaged",
    "Too many vibes · containment failing",
    "Flooding Yassiii with maximum good energy",
  ];

  let emergencyMsgIndex = 0;

  function clamp(n) {
    if (Number.isNaN(n)) return 50;
    return Math.max(0, Math.min(100, n));
  }

  function normalize(raw) {
    const left = clamp(Math.round(Number(raw?.left)));
    return {
      left,
      right: 100 - left,
      updatedAt: Number(raw?.updatedAt) || Date.now(),
      emergency: Boolean(raw?.emergency),
    };
  }

  function isEmergencyCode(value = Number(amountInput.value)) {
    return Math.abs(Number(value) - EMERGENCY_CODE) < 0.0001;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function saveLocal(next = state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          left: next.left,
          right: next.right,
          updatedAt: next.updatedAt,
          emergency: Boolean(next.emergency),
        })
      );
    } catch {
      /* storage blocked */
    }
  }

  async function fetchRemote() {
    const res = await fetch(REMOTE_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Remote read failed (${res.status})`);
    return normalize(await res.json());
  }

  async function pushRemote(next) {
    const res = await fetch(REMOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        left: next.left,
        right: next.right,
        updatedAt: next.updatedAt,
        emergency: Boolean(next.emergency),
      }),
    });
    if (!res.ok) throw new Error(`Remote write failed (${res.status})`);
  }

  function applyState(next, { announce } = {}) {
    const prevLeft = state.left;
    const wasEmergency = state.emergency;
    state = normalize(next);
    lastRemoteUpdatedAt = state.updatedAt;
    saveLocal(state);
    render();
    setEmergencyMode(state.emergency, { silent: wasEmergency === state.emergency });
    if (announce && state.left !== prevLeft && !state.emergency) {
      setStatus(`Synced — Hamza ${state.left}% · Yassiii ${state.right}%`);
    }
  }

  function render() {
    liquidLeft.style.setProperty("--fill", state.left);
    if (!state.emergency) {
      liquidRight.style.setProperty("--fill", state.right);
      pctRight.textContent = `${state.right}%`;
    }
    pctLeft.textContent = `${state.left}%`;
    updateButtons();
    updateArmedUI();
  }

  function getAmount() {
    const raw = Number(amountInput.value);
    if (isEmergencyCode(raw)) return EMERGENCY_CODE;
    return clamp(Math.round(raw || 0));
  }

  function updateArmedUI() {
    const armed = isEmergencyCode() && !state.emergency;
    amountInput.classList.toggle("is-armed", armed || state.emergency);
    amountHint.hidden = !armed;
    chips.forEach((chip) => {
      chip.classList.toggle("is-active", Number(chip.dataset.amount) === getAmount());
    });
    if (state.emergency) {
      sendRightBtn.textContent = "Flooding Yassiii...";
      sendLeftBtn.textContent = "← Rescue · Send to Hamza";
    } else if (armed) {
      sendRightBtn.textContent = "EMERGENCY → Yassiii";
      sendLeftBtn.textContent = "← Send to Hamza";
    } else {
      sendRightBtn.textContent = "Send → Yassiii";
      sendLeftBtn.textContent = "← Send to Hamza";
    }
  }

  function updateButtons() {
    const amount = getAmount();
    const locked = busy;
    const emergencyArmed = isEmergencyCode(amount);

    if (state.emergency) {
      sendRightBtn.disabled = true;
      sendLeftBtn.disabled = locked;
    } else if (emergencyArmed) {
      sendRightBtn.disabled = locked;
      sendLeftBtn.disabled = locked || state.right < 1;
    } else {
      sendRightBtn.disabled = locked || amount <= 0 || state.left < amount;
      sendLeftBtn.disabled = locked || amount <= 0 || state.right < amount;
    }
    resetBtn.disabled = locked;
  }

  function setStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.remove("is-flash");
    void statusEl.offsetWidth;
    statusEl.classList.add("is-flash");
  }

  function pulseBucket(el) {
    el.classList.remove("is-pulse");
    void el.offsetWidth;
    el.classList.add("is-pulse");
    window.setTimeout(() => el.classList.remove("is-pulse"), 700);
  }

  function fireBeam(direction, { emergency = false } = {}) {
    const img = transmitter.querySelector(".transmitter__img");
    const rect = img.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const target = direction === "right" ? bucketRight : bucketLeft;
    const targetRect = target.querySelector(".bucket__jar").getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height * 0.25;

    const dx = endX - originX;
    const dy = endY - originY;
    const dist = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const beam = document.createElement("span");
    beam.className = "beam";
    beam.style.left = `${originX}px`;
    beam.style.top = `${originY}px`;
    beam.style.width = `${dist}px`;
    beam.style.transform = `rotate(${angle}deg)`;
    if (emergency) beam.style.height = "5px";
    beams.appendChild(beam);
    window.setTimeout(() => beam.remove(), 750);

    const count = emergency ? 10 : 14;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("span");
      spark.className = emergency ? "spark spark--emergency" : "spark";
      const t = (i + 1) / count;
      const jitterX = (Math.random() - 0.5) * (emergency ? 50 : 36);
      const jitterY = (Math.random() - 0.5) * (emergency ? 50 : 36);
      spark.style.left = `${originX}px`;
      spark.style.top = `${originY}px`;
      spark.style.setProperty("--dx", `${dx * t + jitterX}px`);
      spark.style.setProperty("--dy", `${dy * t + jitterY}px`);
      spark.style.animationDelay = `${i * 0.02}s`;
      spark.style.width = `${6 + Math.random() * 10}px`;
      spark.style.height = spark.style.width;
      beams.appendChild(spark);
      window.setTimeout(() => spark.remove(), 950);
    }
  }

  function spawnOverflowDroplets() {
    if (reduceMotion) return;
    const jar = bucketRight.querySelector(".bucket__jar");
    const rect = jar.getBoundingClientRect();

    for (let i = 0; i < 3; i++) {
      const drop = document.createElement("span");
      drop.className = "spark spark--emergency";
      const startX = rect.left + rect.width * (0.2 + Math.random() * 0.6);
      const startY = rect.top - 8;
      drop.style.left = `${startX}px`;
      drop.style.top = `${startY}px`;
      drop.style.setProperty("--dx", `${(Math.random() - 0.5) * 40}px`);
      drop.style.setProperty("--dy", `${40 + Math.random() * 70}px`);
      drop.style.width = `${5 + Math.random() * 8}px`;
      drop.style.height = drop.style.width;
      beams.appendChild(drop);
      window.setTimeout(() => drop.remove(), 900);
    }
  }

  function setEmergencyMode(on, { silent = false } = {}) {
    const active = Boolean(on);
    document.body.classList.toggle("is-emergency", active);
    overflowTag.hidden = !active;
    emergencyBanner.hidden = !active;

    if (active) {
      if (!emergencyLoop) {
        overflowDisplay = Math.max(state.right, 100);
        emergencyMsgIndex = 0;
        emergencyMessage.textContent = emergencyLines[0];
        emergencyLoop = window.setInterval(() => {
          overflowDisplay = Math.min(999, overflowDisplay + (2 + Math.floor(Math.random() * 5)));
          pctRight.textContent = `${overflowDisplay}%`;
          fireBeam("right", { emergency: true });
          spawnOverflowDroplets();
          if (Math.random() > 0.45) {
            emergencyMsgIndex = (emergencyMsgIndex + 1) % emergencyLines.length;
            emergencyMessage.textContent = emergencyLines[emergencyMsgIndex];
            setStatus(emergencyLines[emergencyMsgIndex]);
          }
        }, reduceMotion ? 1600 : 900);
      }
      if (!silent) setStatus("Emergency vibes flooding Yassiii");
    } else if (emergencyLoop) {
      window.clearInterval(emergencyLoop);
      emergencyLoop = null;
      overflowDisplay = state.right;
      pctRight.textContent = `${state.right}%`;
      liquidRight.style.setProperty("--fill", state.right);
    }

    updateButtons();
    updateArmedUI();
  }

  async function persist(next) {
    saveLocal(next);
    await pushRemote(next);
    lastRemoteUpdatedAt = next.updatedAt;
  }

  async function startEmergency() {
    if (busy || state.emergency) return;
    busy = true;
    updateButtons();
    setStatus("Engaging emergency vibes...");

    try {
      try {
        const remote = await fetchRemote();
        applyState(remote);
      } catch {
        /* keep local */
      }

      if (state.emergency) {
        setStatus("Emergency already in progress");
        return;
      }

      const next = { ...state, emergency: true, updatedAt: Date.now() };
      state = next;
      saveLocal(next);
      setEmergencyMode(true);
      await persist(next);
      fireBeam("right", { emergency: true });
      pulseBucket(bucketRight);
    } catch {
      setStatus("Couldn't start emergency — check connection");
      setEmergencyMode(false);
      state = { ...state, emergency: false };
    } finally {
      busy = false;
      updateButtons();
    }
  }

  async function stopEmergencyAndSendHome() {
    if (!state.emergency) return;
    busy = true;
    updateButtons();
    setStatus("Pulling vibes back to Hamza...");

    try {
      try {
        const remote = await fetchRemote();
        state = normalize({ ...remote, emergency: true });
      } catch {
        /* keep local */
      }

      const typed = Number(amountInput.value);
      const transfer = isEmergencyCode(typed)
        ? Math.min(15, state.right)
        : Math.min(state.right, clamp(Math.round(typed || 15)));

      const next = normalize({
        left: state.left + transfer,
        emergency: false,
        updatedAt: Date.now(),
      });

      state = next;
      setEmergencyMode(false);
      render();
      await persist(next);
      setStatus(
        transfer > 0
          ? `Emergency cleared — ${transfer}% returned to Hamza`
          : "Emergency cleared"
      );
      pulseBucket(bucketLeft);
      fireBeam("left");
      transmitter.classList.remove("is-sending");
      void transmitter.offsetWidth;
      transmitter.classList.add("is-sending");
      window.setTimeout(() => transmitter.classList.remove("is-sending"), 950);
    } catch {
      setStatus("Couldn't stop emergency — check connection");
    } finally {
      busy = false;
      updateButtons();
      updateArmedUI();
    }
  }

  async function send(direction) {
    if (busy) return;

    if (direction === "right" && isEmergencyCode()) {
      await startEmergency();
      return;
    }

    if (direction === "left" && state.emergency) {
      await stopEmergencyAndSendHome();
      return;
    }

    const amount = getAmount();
    if (amount <= 0 || amount === EMERGENCY_CODE) return;

    busy = true;
    updateButtons();
    setStatus("Syncing vibes...");

    try {
      try {
        const remote = await fetchRemote();
        applyState(remote);
      } catch {
        /* keep local if offline */
      }

      if (state.emergency) {
        busy = false;
        if (direction === "left") await stopEmergencyAndSendHome();
        else updateButtons();
        return;
      }

      const next = { ...state, updatedAt: Date.now() };

      if (direction === "right") {
        if (next.left < amount) {
          setStatus("Not enough vibes on Hamza's side");
          return;
        }
        next.left -= amount;
        next.right = 100 - next.left;
        setStatus(`Beamed ${amount}% to Yassiii`);
        pulseBucket(bucketRight);
      } else {
        if (next.right < amount) {
          setStatus("Not enough vibes on Yassiii's side");
          return;
        }
        next.right -= amount;
        next.left = 100 - next.right;
        setStatus(`Beamed ${amount}% back to Hamza`);
        pulseBucket(bucketLeft);
      }

      state = next;
      render();
      await persist(next);

      transmitter.classList.remove("is-sending");
      void transmitter.offsetWidth;
      transmitter.classList.add("is-sending");
      fireBeam(direction);
      window.setTimeout(() => transmitter.classList.remove("is-sending"), 950);
    } catch {
      setStatus("Couldn't save — check your connection");
    } finally {
      busy = false;
      updateButtons();
    }
  }

  async function reset() {
    if (busy) return;
    busy = true;
    updateButtons();
    try {
      const next = { ...DEFAULT, updatedAt: Date.now() };
      state = next;
      setEmergencyMode(false);
      render();
      await persist(next);
      setStatus("Balanced again — 50 · 50");
    } catch {
      setStatus("Couldn't save — check your connection");
    } finally {
      busy = false;
      updateButtons();
    }
  }

  async function syncFromRemote({ announce = false } = {}) {
    if (busy) return;
    try {
      const remote = await fetchRemote();
      if (
        remote.updatedAt > lastRemoteUpdatedAt ||
        remote.left !== state.left ||
        remote.emergency !== state.emergency
      ) {
        applyState(remote, { announce });
      }
    } catch {
      /* keep local cache while offline */
    }
  }

  function spawnFloaters() {
    if (reduceMotion || !floaters) return;
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement("span");
      dot.className = "floater";
      const size = 4 + Math.random() * 8;
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.animationDuration = `${9 + Math.random() * 14}s`;
      dot.style.animationDelay = `${Math.random() * 10}s`;
      floaters.appendChild(dot);
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = Number(chip.dataset.amount);
      amountInput.value = String(value);
      updateArmedUI();
      updateButtons();
    });
  });

  amountInput.addEventListener("input", () => {
    updateArmedUI();
    updateButtons();
  });

  sendRightBtn.addEventListener("click", () => send("right"));
  sendLeftBtn.addEventListener("click", () => send("left"));
  resetBtn.addEventListener("click", () => reset());

  async function boot() {
    const local = loadLocal();
    if (local) applyState(local);

    spawnFloaters();
    render();
    updateArmedUI();
    setStatus("Loading shared vibes...");

    try {
      const remote = await fetchRemote();
      applyState(remote);
      setStatus(remote.emergency ? "Emergency vibes flooding Yassiii" : "Ready to beam");
    } catch {
      if (local) {
        setStatus("Offline — using last saved vibes");
      } else {
        setStatus("Ready to beam");
      }
    }

    window.setInterval(() => syncFromRemote({ announce: true }), POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncFromRemote({ announce: true });
    });
  }

  boot();
})();
