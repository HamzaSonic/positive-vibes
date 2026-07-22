(() => {
  const STORAGE_KEY = "good-vibes-share-v1";
  const REMOTE_URL = "https://mantledb.sh/v2/good-vibes-you-yassiii/state";
  const POLL_MS = 4000;
  const DEFAULT = { left: 50, right: 50 };

  const liquidLeft = document.getElementById("liquid-left");
  const liquidRight = document.getElementById("liquid-right");
  const pctLeft = document.getElementById("pct-left");
  const pctRight = document.getElementById("pct-right");
  const amountInput = document.getElementById("amount");
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
    };
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
        JSON.stringify({ left: next.left, right: next.right, updatedAt: next.updatedAt })
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
      }),
    });
    if (!res.ok) throw new Error(`Remote write failed (${res.status})`);
  }

  function applyState(next, { announce } = {}) {
    const prevLeft = state.left;
    state = normalize(next);
    lastRemoteUpdatedAt = state.updatedAt;
    saveLocal(state);
    render();
    if (announce && state.left !== prevLeft) {
      setStatus(`Synced — You ${state.left}% · Yassiii ${state.right}%`);
    }
  }

  function render() {
    liquidLeft.style.setProperty("--fill", state.left);
    liquidRight.style.setProperty("--fill", state.right);
    pctLeft.textContent = `${state.left}%`;
    pctRight.textContent = `${state.right}%`;
    updateButtons();
  }

  function getAmount() {
    return clamp(Math.round(Number(amountInput.value) || 0));
  }

  function updateButtons() {
    const amount = getAmount();
    const locked = busy;
    sendRightBtn.disabled = locked || amount <= 0 || state.left < amount;
    sendLeftBtn.disabled = locked || amount <= 0 || state.right < amount;
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

  function fireBeam(direction) {
    const img = transmitter.querySelector(".transmitter__img");
    const rect = img.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const target = direction === "right" ? bucketRight : bucketLeft;
    const targetRect = target.querySelector(".bucket__jar").getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height * 0.4;

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
    beams.appendChild(beam);
    window.setTimeout(() => beam.remove(), 750);

    for (let i = 0; i < 14; i++) {
      const spark = document.createElement("span");
      spark.className = "spark";
      const t = (i + 1) / 14;
      const jitterX = (Math.random() - 0.5) * 36;
      const jitterY = (Math.random() - 0.5) * 36;
      spark.style.left = `${originX}px`;
      spark.style.top = `${originY}px`;
      spark.style.setProperty("--dx", `${dx * t + jitterX}px`);
      spark.style.setProperty("--dy", `${dy * t + jitterY}px`);
      spark.style.animationDelay = `${i * 0.025}s`;
      spark.style.width = `${6 + Math.random() * 8}px`;
      spark.style.height = spark.style.width;
      beams.appendChild(spark);
      window.setTimeout(() => spark.remove(), 950);
    }
  }

  async function persist(next) {
    saveLocal(next);
    await pushRemote(next);
    lastRemoteUpdatedAt = next.updatedAt;
  }

  async function send(direction) {
    if (busy) return;
    const amount = getAmount();
    if (amount <= 0) return;

    busy = true;
    updateButtons();
    setStatus("Syncing vibes...");

    try {
      // Pull latest first so another browser's changes aren't overwritten.
      try {
        const remote = await fetchRemote();
        applyState(remote);
      } catch {
        /* keep local if offline */
      }

      const next = { ...state, updatedAt: Date.now() };

      if (direction === "right") {
        if (next.left < amount) {
          setStatus("Not enough vibes on your side");
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
        setStatus(`Beamed ${amount}% back to you`);
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
      if (remote.updatedAt > lastRemoteUpdatedAt || remote.left !== state.left) {
        applyState(remote, { announce });
      }
    } catch {
      /* keep local cache while offline */
    }
  }

  function syncChips(value) {
    chips.forEach((chip) => {
      chip.classList.toggle("is-active", Number(chip.dataset.amount) === value);
    });
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
      syncChips(value);
      updateButtons();
    });
  });

  amountInput.addEventListener("input", () => {
    syncChips(getAmount());
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
    syncChips(getAmount());
    setStatus("Loading shared vibes...");

    try {
      const remote = await fetchRemote();
      applyState(remote);
      setStatus("Ready to beam");
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
