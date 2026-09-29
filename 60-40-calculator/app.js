(() => {
  const MODES = {
    government: {
      label: "เงินรัฐบาลมีเท่าไหร่?",
      help: "เช่น มีเงินรัฐบาล 600 บาท",
      explain: "ต้องเติมเงินประชาชนอีก {citizen} บาท",
    },
    citizen: {
      label: "เงินประชาชนมีเท่าไหร่?",
      help: "เช่น มีเงินประชาชน 400 บาท",
      explain: "ใช้เงินรัฐบาลอีก {government} บาท",
    },
    total: {
      label: "สินค้าราคาเท่าไหร่?",
      help: "เช่น สินค้าราคา 1,000 บาท",
      explain: "แบ่งจ่ายตามสัดส่วน 60/40",
    },
  };

  let currentMode = "government";

  const amountInput = document.querySelector("#amount");
  const amountLabel = document.querySelector("#amount-label");
  const inputHelp = document.querySelector("#input-help");
  const inputError = document.querySelector("#input-error");
  const governmentResult = document.querySelector("#government-result");
  const citizenResult = document.querySelector("#citizen-result");
  const totalResult = document.querySelector("#total-result");
  const resultExplanation = document.querySelector("#result-explanation");
  const modeTabs = [...document.querySelectorAll(".mode-tab")];
  const clearButton = document.querySelector("#clear-button");

  const parseAmount = (value) => Number(value.replace(/,/g, "").trim());

  const formatMoney = (number) =>
    new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(number);

  const getBreakdown = (mode, amount) => {
    if (mode === "government") {
      return { government: amount, citizen: amount * (40 / 60), total: amount / 0.6 };
    }
    if (mode === "citizen") {
      return { government: amount * (60 / 40), citizen: amount, total: amount / 0.4 };
    }
    return { government: amount * 0.6, citizen: amount * 0.4, total: amount };
  };

  const resetResults = () => {
    governmentResult.textContent = "—";
    citizenResult.textContent = "—";
    totalResult.textContent = "—";
    resultExplanation.textContent = "กรอกจำนวนเงินด้านบนเพื่อเริ่มคำนวณ";
  };

  const render = () => {
    const raw = amountInput.value;
    inputError.textContent = "";
    amountInput.classList.remove("has-error");

    if (!raw.trim()) {
      resetResults();
      return;
    }

    const amount = parseAmount(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      resetResults();
      inputError.textContent = "กรุณากรอกจำนวนเงินเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
      amountInput.classList.add("has-error");
      return;
    }

    const result = getBreakdown(currentMode, amount);
    governmentResult.textContent = formatMoney(result.government);
    citizenResult.textContent = formatMoney(result.citizen);
    totalResult.textContent = formatMoney(result.total);
    resultExplanation.textContent = MODES[currentMode].explain
      .replace("{citizen}", formatMoney(result.citizen))
      .replace("{government}", formatMoney(result.government));
  };

  const setMode = (mode) => {
    currentMode = mode;
    modeTabs.forEach((tab) => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    amountLabel.lastChild.textContent = ` ${MODES[mode].label}`;
    inputHelp.textContent = MODES[mode].help;
    render();
    amountInput.focus();
  };

  modeTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + modeTabs.length) % modeTabs.length;
      setMode(modeTabs[nextIndex].dataset.mode);
    });
  });

  amountInput.addEventListener("input", () => {
    amountInput.value = amountInput.value.replace(/[^0-9.,]/g, "").replace(/(\..*)\./g, "$1");
    render();
  });

  amountInput.addEventListener("blur", () => {
    if (!amountInput.value.trim()) return;
    const amount = parseAmount(amountInput.value);
    if (Number.isFinite(amount) && amount >= 0) amountInput.value = formatMoney(amount);
  });

  amountInput.addEventListener("focus", () => {
    amountInput.value = amountInput.value.replace(/,/g, "");
  });

  clearButton.addEventListener("click", () => {
    amountInput.value = "";
    resetResults();
    inputError.textContent = "";
    amountInput.classList.remove("has-error");
    amountInput.focus();
  });

  if (document.modelContext?.registerTool) {
    try {
      document.modelContext.registerTool({
        name: "calculate_60_40_split",
        title: "คำนวณสัดส่วน 60/40",
        description: "คำนวณส่วนรัฐบาล ส่วนประชาชน และยอดรวม จากจำนวนเงินที่ทราบ",
        inputSchema: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["government", "citizen", "total"] },
            amount: { type: "number", minimum: 0 },
          },
          required: ["mode", "amount"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ mode, amount }) => {
          if (!MODES[mode] || !Number.isFinite(amount) || amount < 0) throw new Error("ข้อมูลไม่ถูกต้อง");
          setMode(mode);
          amountInput.value = String(amount);
          render();
          return getBreakdown(mode, amount);
        },
      });
    } catch (_) {
      // The calculator remains fully usable in browsers without WebMCP support.
    }
  }

  resetResults();
})();
