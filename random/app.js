(() => {
  const STORAGE_KEY = "good-vibes-share-v1";
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

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const parsed = JSON.parse(raw);
      const left = clamp(Math.round(Number(parsed.left)));
      const right = 100 - left;
      return { left, right };
    } catch {
      return { ...DEFAULT };
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ left: state.left, right: state.right, updatedAt: Date.now() })
    );
  }

  function clamp(n) {
    if (Number.isNaN(n)) return 50;
    return Math.max(0, Math.min(100, n));
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
    sendRightBtn.disabled = amount <= 0 || state.left < amount;
    sendLeftBtn.disabled = amount <= 0 || state.right < amount;
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

  function send(direction) {
    const amount = getAmount();
    if (amount <= 0) return;

    if (direction === "right") {
      if (state.left < amount) {
        setStatus("Not enough vibes on your side");
        return;
      }
      state.left -= amount;
      state.right += amount;
      setStatus(`Beamed ${amount}% to Yassiii`);
      pulseBucket(bucketRight);
    } else {
      if (state.right < amount) {
        setStatus("Not enough vibes on Yassiii's side");
        return;
      }
      state.right -= amount;
      state.left += amount;
      setStatus(`Beamed ${amount}% back to you`);
      pulseBucket(bucketLeft);
    }

    save();
    render();

    transmitter.classList.remove("is-sending");
    void transmitter.offsetWidth;
    transmitter.classList.add("is-sending");
    fireBeam(direction);
    window.setTimeout(() => transmitter.classList.remove("is-sending"), 950);
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

  resetBtn.addEventListener("click", () => {
    state = { ...DEFAULT };
    save();
    render();
    setStatus("Balanced again — 50 · 50");
  });

  spawnFloaters();
  render();
  syncChips(getAmount());
})();
