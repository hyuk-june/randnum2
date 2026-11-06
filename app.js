(() => {
  "use strict";

  const STORAGE_KEY = "randnum_master_state_v1";
  const PRESETS_KEY = "randnum_master_presets_v1";

  // 기본 상태
  const state = {
    presetTitle: "기본 문제집",
    rawText: "",
    // items: [{ id: string, label: string, solved: boolean, wrongCount: number, attempts: number }]
    items: [],
    currentId: null,
    lastShownId: null,
    phase: "empty", // 'empty' | 'ready' | 'countdown' | 'question' | 'complete'
    totalStudySeconds: 0,
    currentProblemSeconds: 0,
    undoStack: [],
    settings: {
      countdownEnabled: true,
      countdownStepMs: 900,
      weightedRandom: false,
      autoNext: true,
      soundEnabled: true,
      theme: "dark",
    },
  };

  let presets = [];
  let countdownTimerId = null;
  let problemStopwatchId = null;
  let audioCtx = null;

  // DOM 참조
  const el = {
    currentPresetTitle: document.getElementById("currentPresetTitle"),
    soundToggleBtn: document.getElementById("soundToggleBtn"),
    soundIcon: document.getElementById("soundIcon"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIcon: document.getElementById("themeIcon"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    emptyOpenSettingsBtn: document.getElementById("emptyOpenSettingsBtn"),

    timerDot: document.getElementById("timerDot"),
    problemTimerText: document.getElementById("problemTimerText"),
    undoBtn: document.getElementById("undoBtn"),

    emptyStateView: document.getElementById("emptyStateView"),
    readyStateView: document.getElementById("readyStateView"),
    readyRemainDesc: document.getElementById("readyRemainDesc"),
    drawProblemBtn: document.getElementById("drawProblemBtn"),

    countdownStateView: document.getElementById("countdownStateView"),
    countdownCircleFg: document.getElementById("countdownCircleFg"),
    countdownNumber: document.getElementById("countdownNumber"),
    skipCountdownBtn: document.getElementById("skipCountdownBtn"),

    questionStateView: document.getElementById("questionStateView"),
    questionBadges: document.getElementById("questionBadges"),
    questionNumberDisplay: document.getElementById("questionNumberDisplay"),
    correctBtn: document.getElementById("correctBtn"),
    wrongBtn: document.getElementById("wrongBtn"),
    redrawBtn: document.getElementById("redrawBtn"),

    completeStateView: document.getElementById("completeStateView"),
    completeSummaryText: document.getElementById("completeSummaryText"),
    statTotalAttempts: document.getElementById("statTotalAttempts"),
    statFirstTryRate: document.getElementById("statFirstTryRate"),
    statTotalTime: document.getElementById("statTotalTime"),
    hardestProblemsBox: document.getElementById("hardestProblemsBox"),
    hardestProblemsList: document.getElementById("hardestProblemsList"),
    retryWrongOnlyBtn: document.getElementById("retryWrongOnlyBtn"),
    restartAllBtn: document.getElementById("restartAllBtn"),

    progressRatioText: document.getElementById("progressRatioText"),
    progressPercentText: document.getElementById("progressPercentText"),
    remainCountText: document.getElementById("remainCountText"),
    totalWrongClicksText: document.getElementById("totalWrongClicksText"),
    progressBarTrack: document.getElementById("progressBarTrack"),
    progressBarFill: document.getElementById("progressBarFill"),

    problemChipsContainer: document.getElementById("problemChipsContainer"),

    settingsModalBackdrop: document.getElementById("settingsModalBackdrop"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),

    presetTitleInput: document.getElementById("presetTitleInput"),
    savePresetBtn: document.getElementById("savePresetBtn"),
    savedPresetsWrap: document.getElementById("savedPresetsWrap"),
    savedPresetsList: document.getElementById("savedPresetsList"),

    rangePrefixInput: document.getElementById("rangePrefixInput"),
    rangeStartInput: document.getElementById("rangeStartInput"),
    rangeEndInput: document.getElementById("rangeEndInput"),
    appendRangeBtn: document.getElementById("appendRangeBtn"),

    problemListTextarea: document.getElementById("problemListTextarea"),
    textareaLineCount: document.getElementById("textareaLineCount"),

    countdownEnabledToggle: document.getElementById("countdownEnabledToggle"),
    countdownSpeedSelect: document.getElementById("countdownSpeedSelect"),
    weightedRandomToggle: document.getElementById("weightedRandomToggle"),
    autoNextToggle: document.getElementById("autoNextToggle"),

    resetProgressOnlyBtn: document.getElementById("resetProgressOnlyBtn"),
    resetAllBtn: document.getElementById("resetAllBtn"),

    toastContainer: document.getElementById("toastContainer"),
    confettiCanvas: document.getElementById("confettiCanvas"),
  };

  // ==================== 효과음 (Web Audio API) ====================
  function playTone(type) {
    if (!state.settings.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      if (type === "tick") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "reveal") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "correct") {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.09, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.18);
        });
      } else if (type === "wrong") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(170, now + 0.22);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === "complete") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.11, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.32);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.32);
        });
      }
    } catch {
      // 오디오 컨텍스트 제한 시 무시
    }
  }

  // ==================== 유틸리티: 문제 목록 파싱 ====================
  /**
   * 줄바꿈으로 구분된 텍스트를 파싱하여 고유 문제 배열로 반환합니다.
   * 한 줄에 '1~10' 형식의 순수 숫자 범위가 있으면 자동으로 펼쳐줍니다.
   */
  function parseProblemLines(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const result = [];
    const seen = new Set();

    const addUnique = (label) => {
      const normalized = label.trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    };

    for (const line of lines) {
      // '1~10' 또는 '1 ~ 10' 범위 패턴 감지 (단, 200개 이하 범위만 자동 확장)
      const tildeMatch = line.match(/^([0-9]{1,4})\s*~\s*([0-9]{1,4})$/);
      if (tildeMatch) {
        const start = parseInt(tildeMatch[1], 10);
        const end = parseInt(tildeMatch[2], 10);
        if (!Number.isNaN(start) && !Number.isNaN(end) && Math.abs(end - start) <= 300) {
          const step = start <= end ? 1 : -1;
          for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
            addUnique(String(n));
          }
          continue;
        }
      }
      addUnique(line);
    }

    return result;
  }

  // ==================== 상태 저장 및 불러오기 ====================
  function saveState() {
    try {
      const payload = {
        presetTitle: state.presetTitle,
        rawText: state.rawText,
        items: state.items,
        currentId: state.currentId,
        lastShownId: state.lastShownId,
        phase: state.phase === "countdown" ? "ready" : state.phase,
        totalStudySeconds: state.totalStudySeconds,
        settings: state.settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 저장 용량 초과 등 예외 무시
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          state.presetTitle = parsed.presetTitle || "기본 문제집";
          state.rawText = typeof parsed.rawText === "string" ? parsed.rawText : "";
          state.items = parsed.items;
          state.currentId = parsed.currentId || null;
          state.lastShownId = parsed.lastShownId || null;
          state.totalStudySeconds = Number(parsed.totalStudySeconds) || 0;
          if (parsed.settings) {
            state.settings = { ...state.settings, ...parsed.settings };
          }
        }
      }

      const rawPresets = localStorage.getItem(PRESETS_KEY);
      if (rawPresets) {
        const parsedPresets = JSON.parse(rawPresets);
        if (Array.isArray(parsedPresets)) {
          presets = parsedPresets;
        }
      }
    } catch {
      // 파싱 실패 시 기본값 사용
    }

    syncPhaseWithItems();
  }

  function savePresets() {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // 무시
    }
  }

  function syncPhaseWithItems() {
    if (state.items.length === 0) {
      state.phase = "empty";
      state.currentId = null;
      return;
    }

    const unsolved = state.items.filter((it) => !it.solved);
    if (unsolved.length === 0) {
      state.phase = "complete";
      state.currentId = null;
      return;
    }

    // 만약 현재 선택된 문제가 있고 아직 미해결이면 question 상태 유지
    if (state.currentId) {
      const currentItem = state.items.find((it) => it.id === state.currentId && !it.solved);
      if (currentItem) {
        state.phase = "question";
        return;
      }
    }

    state.currentId = null;
    state.phase = "ready";
  }

  // ==================== 타이머 관리 ====================
  function startProblemStopwatch() {
    stopProblemStopwatch();
    state.currentProblemSeconds = 0;
    updateStopwatchUI();
    el.timerDot.classList.add("active");

    problemStopwatchId = setInterval(() => {
      state.currentProblemSeconds += 1;
      state.totalStudySeconds += 1;
      updateStopwatchUI();
    }, 1000);
  }

  function stopProblemStopwatch() {
    if (problemStopwatchId) {
      clearInterval(problemStopwatchId);
      problemStopwatchId = null;
    }
    el.timerDot.classList.remove("active");
  }

  function updateStopwatchUI() {
    const mins = Math.floor(state.currentProblemSeconds / 60);
    const secs = state.currentProblemSeconds % 60;
    el.problemTimerText.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function formatDurationKorean(totalSec) {
    if (totalSec < 60) return `${totalSec}초`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}분 ${secs}초`;
  }

  // ==================== 랜덤 출제 및 3, 2, 1 카운트다운 ====================
  function pickRandomUnsolvedItem() {
    const unsolved = state.items.filter((it) => !it.solved);
    if (unsolved.length === 0) return null;
    if (unsolved.length === 1) return unsolved[0];

    // 직전에 출제된 번호가 연속으로 또 나오는 것을 방지 (남은 문제가 2개 이상일 때)
    let candidates = unsolved.filter((it) => it.id !== state.lastShownId);
    if (candidates.length === 0) {
      candidates = unsolved;
    }

    if (state.settings.weightedRandom) {
      // 오답 횟수가 많을수록 가중치 부여 (기본 1 + 오답횟수 * 1.5)
      const weights = candidates.map((it) => 1 + it.wrongCount * 1.5);
      const totalWeight = weights.reduce((acc, w) => acc + w, 0);
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < candidates.length; i++) {
        rand -= weights[i];
        if (rand <= 0) return candidates[i];
      }
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  function clearCountdownTimer() {
    if (countdownTimerId) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function startDrawProblem() {
    clearCountdownTimer();
    stopProblemStopwatch();

    const nextItem = pickRandomUnsolvedItem();
    if (!nextItem) {
      syncPhaseWithItems();
      renderAll();
      return;
    }

    state.currentId = nextItem.id;

    // 카운트다운 비활성화 설정인 경우 즉시 출력
    if (!state.settings.countdownEnabled) {
      revealCurrentProblem();
      return;
    }

    state.phase = "countdown";
    renderAll();

    const stepMs = Number(state.settings.countdownStepMs) || 900;
    const circumference = 326.72;
    let count = 3;

    const updateCountdownStep = (num) => {
      el.countdownNumber.textContent = String(num);
      el.countdownNumber.classList.remove("countdown-pop");
      void el.countdownNumber.offsetWidth; // 리플로우로 애니메이션 재시작
      el.countdownNumber.classList.add("countdown-pop");

      const progress = (3 - num) / 3;
      el.countdownCircleFg.style.strokeDashoffset = String(circumference * progress);
      playTone("tick");
    };

    updateCountdownStep(count);

    countdownTimerId = setInterval(() => {
      count -= 1;
      if (count >= 1) {
        updateCountdownStep(count);
      } else {
        clearCountdownTimer();
        el.countdownCircleFg.style.strokeDashoffset = String(circumference);
        revealCurrentProblem();
      }
    }, stepMs);
  }

  function revealCurrentProblem() {
    clearCountdownTimer();
    const item = state.items.find((it) => it.id === state.currentId);
    if (!item) {
      syncPhaseWithItems();
      renderAll();
      return;
    }

    state.lastShownId = item.id;
    state.phase = "question";
    playTone("reveal");
    startProblemStopwatch();
    saveState();
    renderAll();
  }

  // ==================== 정답 / 오답 처리 ====================
  function handleJudge(isCorrect) {
    if (state.phase !== "question" || !state.currentId) return;
    const item = state.items.find((it) => it.id === state.currentId);
    if (!item) return;

    // 실행 취소(Undo) 스택에 기록
    state.undoStack.push({
      id: item.id,
      prevSolved: item.solved,
      prevWrongCount: item.wrongCount,
      prevAttempts: item.attempts,
      actionLabel: isCorrect ? `정답 (${item.label})` : `오답 (${item.label})`,
    });
    if (state.undoStack.length > 30) {
      state.undoStack.shift();
    }

    item.attempts += 1;

    if (isCorrect) {
      item.solved = true;
      playTone("correct");
      showToast(`⭕ [${item.label}] 정답 처리 완료! 다음 출제에서 제외됩니다.`);
    } else {
      item.solved = false;
      item.wrongCount += 1;
      playTone("wrong");
      showToast(`❌ [${item.label}] 오답 등록 (누적 ${item.wrongCount}회) — 다음 후보에 유지됩니다.`);
    }

    stopProblemStopwatch();
    state.currentId = null;

    const remaining = state.items.filter((it) => !it.solved);
    if (remaining.length === 0) {
      state.phase = "complete";
      playTone("complete");
      launchConfetti();
      saveState();
      renderAll();
      return;
    }

    saveState();

    if (state.settings.autoNext) {
      startDrawProblem();
    } else {
      state.phase = "ready";
      renderAll();
    }
  }

  function handleUndo() {
    if (state.undoStack.length === 0) return;
    clearCountdownTimer();
    stopProblemStopwatch();

    const last = state.undoStack.pop();
    const item = state.items.find((it) => it.id === last.id);
    if (!item) return;

    item.solved = last.prevSolved;
    item.wrongCount = last.prevWrongCount;
    item.attempts = last.prevAttempts;

    state.currentId = item.id;
    state.phase = "question";
    startProblemStopwatch();
    saveState();
    renderAll();
    showToast(`↩ 실행 취소됨: ${last.actionLabel}`);
  }

  // ==================== 보드 칩 직접 클릭 토글 ====================
  function toggleItemManualStatus(itemId) {
    const item = state.items.find((it) => it.id === itemId);
    if (!item) return;

    item.solved = !item.solved;
    if (item.solved && state.currentId === item.id) {
      clearCountdownTimer();
      stopProblemStopwatch();
      state.currentId = null;
    }

    syncPhaseWithItems();
    saveState();
    renderAll();
    showToast(
      item.solved
        ? `✅ [${item.label}] 수동으로 정답 완료 처리했습니다.`
        : `🔄 [${item.label}] 미해결 상태로 되돌렸습니다.`
    );
  }

  // ==================== UI 렌더링 ====================
  function renderAll() {
    // 테마 및 사운드 아이콘 반영
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    el.themeIcon.textContent = state.settings.theme === "dark" ? "🌙" : "☀️";
    el.soundIcon.textContent = state.settings.soundEnabled ? "🔊" : "🔇";
    el.currentPresetTitle.textContent = state.presetTitle || "기본 문제집";

    // 실행 취소 버튼 활성화 여부
    el.undoBtn.disabled = state.undoStack.length === 0;

    // 진행도 계산 ("정답처리한 갯수 / 총갯수")
    const totalCount = state.items.length;
    const solvedCount = state.items.filter((it) => it.solved).length;
    const remainCount = totalCount - solvedCount;
    const totalWrongClicks = state.items.reduce((sum, it) => sum + it.wrongCount, 0);
    const percent = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

    el.progressRatioText.textContent = `${solvedCount} / ${totalCount}`;
    el.progressPercentText.textContent = `(${percent}%)`;
    el.remainCountText.textContent = `${remainCount}`;
    el.totalWrongClicksText.textContent = `${totalWrongClicks}`;
    el.progressBarFill.style.width = `${percent}%`;
    el.progressBarTrack.setAttribute("aria-valuenow", String(percent));

    // 스테이지 뷰 전환
    el.emptyStateView.classList.toggle("hidden", state.phase !== "empty");
    el.readyStateView.classList.toggle("hidden", state.phase !== "ready");
    el.countdownStateView.classList.toggle("hidden", state.phase !== "countdown");
    el.questionStateView.classList.toggle("hidden", state.phase !== "question");
    el.completeStateView.classList.toggle("hidden", state.phase !== "complete");

    if (state.phase === "ready") {
      el.readyRemainDesc.textContent = `남은 미해결 문제 ${remainCount}개 중에서 랜덤으로 하나를 출제합니다.`;
    } else if (state.phase === "question") {
      const currentItem = state.items.find((it) => it.id === state.currentId);
      if (currentItem) {
        el.questionNumberDisplay.textContent = currentItem.label;
        el.questionBadges.innerHTML = "";

        if (currentItem.wrongCount > 0) {
          const wrongBadge = document.createElement("span");
          wrongBadge.className = "q-badge q-badge-wrong";
          wrongBadge.textContent = `🔥 오답 ${currentItem.wrongCount}회 누적 문제`;
          el.questionBadges.appendChild(wrongBadge);
        } else {
          const firstBadge = document.createElement("span");
          firstBadge.className = "q-badge q-badge-first";
          firstBadge.textContent = "✨ 첫 도전 문제";
          el.questionBadges.appendChild(firstBadge);
        }
      }
    } else if (state.phase === "complete") {
      renderCompleteSummary();
    }

    renderProblemBoard();
  }

  function renderCompleteSummary() {
    const totalCount = state.items.length;
    const totalAttempts = state.items.reduce((sum, it) => sum + Math.max(1, it.attempts), 0);
    const firstTryCorrectCount = state.items.filter((it) => it.wrongCount === 0).length;
    const firstTryRate = totalCount > 0 ? Math.round((firstTryCorrectCount / totalCount) * 100) : 0;

    el.completeSummaryText.textContent = `총 ${totalCount}개의 문제를 끝까지 모두 해결하셨습니다!`;
    el.statTotalAttempts.textContent = `${totalAttempts}회`;
    el.statFirstTryRate.textContent = `${firstTryRate}%`;
    el.statTotalTime.textContent = formatDurationKorean(state.totalStudySeconds);

    const wrongItems = state.items
      .filter((it) => it.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount);

    if (wrongItems.length > 0) {
      el.hardestProblemsBox.classList.remove("hidden");
      el.retryWrongOnlyBtn.classList.remove("hidden");
      el.retryWrongOnlyBtn.textContent = `🔥 틀렸던 문제만 다시 풀기 (${wrongItems.length}개)`;

      el.hardestProblemsList.innerHTML = "";
      wrongItems.forEach((it) => {
        const chip = document.createElement("span");
        chip.className = "problem-chip chip-wrong";
        chip.innerHTML = `<span>${escapeHtml(it.label)}</span><span class="chip-wrong-count">오답 ${it.wrongCount}</span>`;
        el.hardestProblemsList.appendChild(chip);
      });
    } else {
      el.hardestProblemsBox.classList.add("hidden");
      el.retryWrongOnlyBtn.classList.add("hidden");
    }
  }

  function renderProblemBoard() {
    el.problemChipsContainer.innerHTML = "";
    if (state.items.length === 0) {
      const emptyMsg = document.createElement("span");
      emptyMsg.className = "board-hint";
      emptyMsg.textContent = "환경설정에서 문제 번호를 입력하면 이곳에 전체 번호 현황이 표시됩니다.";
      el.problemChipsContainer.appendChild(emptyMsg);
      return;
    }

    state.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "problem-chip";
      if (item.id === state.currentId && state.phase === "question") {
        btn.classList.add("chip-current");
      }
      if (item.solved) {
        btn.classList.add("chip-solved");
      } else if (item.wrongCount > 0) {
        btn.classList.add("chip-wrong");
      }

      btn.title = item.solved
        ? `[${item.label}] 정답 완료됨 (클릭 시 미해결로 전환)`
        : `[${item.label}] 미해결 · 오답 ${item.wrongCount}회 (클릭 시 정답 완료로 전환)`;

      const labelSpan = document.createElement("span");
      labelSpan.textContent = item.label;
      btn.appendChild(labelSpan);

      if (item.wrongCount > 0) {
        const badge = document.createElement("span");
        badge.className = "chip-wrong-count";
        badge.textContent = `×${item.wrongCount}`;
        btn.appendChild(badge);
      }

      btn.addEventListener("click", () => toggleItemManualStatus(item.id));
      el.problemChipsContainer.appendChild(btn);
    });
  }

  // ==================== 환경설정 모달 동작 ====================
  function openSettingsModal() {
    clearCountdownTimer();
    if (state.phase === "countdown") {
      state.phase = "ready";
      renderAll();
    }

    // 현재 목록을 textarea에 채워넣기
    const textFromItems =
      state.items.length > 0 ? state.items.map((it) => it.label).join("\n") : state.rawText;
    el.problemListTextarea.value = textFromItems;
    el.presetTitleInput.value = state.presetTitle === "기본 문제집" ? "" : state.presetTitle;

    el.countdownEnabledToggle.checked = state.settings.countdownEnabled;
    el.countdownSpeedSelect.value = String(state.settings.countdownStepMs);
    el.weightedRandomToggle.checked = state.settings.weightedRandom;
    el.autoNextToggle.checked = state.settings.autoNext;

    updateTextareaCountBadge();
    renderPresetsList();

    el.settingsModalBackdrop.classList.remove("hidden");
    setTimeout(() => el.problemListTextarea.focus(), 50);
  }

  function closeSettingsModal() {
    el.settingsModalBackdrop.classList.add("hidden");
  }

  function updateTextareaCountBadge() {
    const parsed = parseProblemLines(el.problemListTextarea.value);
    el.textareaLineCount.textContent = `${parsed.length}개`;
  }

  function applySettingsAndProblemList() {
    const raw = el.problemListTextarea.value;
    const parsedLabels = parseProblemLines(raw);

    // 기존에 풀었던 상태(solved, wrongCount)를 번호 기준으로 보존
    const existingMap = new Map(state.items.map((it) => [it.label, it]));
    const newItems = parsedLabels.map((label, idx) => {
      const prev = existingMap.get(label);
      if (prev) {
        return { ...prev };
      }
      return {
        id: `prob_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        label,
        solved: false,
        wrongCount: 0,
        attempts: 0,
      };
    });

    state.rawText = newItems.map((it) => it.label).join("\n");
    state.items = newItems;
    state.presetTitle = el.presetTitleInput.value.trim() || "기본 문제집";

    state.settings.countdownEnabled = el.countdownEnabledToggle.checked;
    state.settings.countdownStepMs = Number(el.countdownSpeedSelect.value) || 900;
    state.settings.weightedRandom = el.weightedRandomToggle.checked;
    state.settings.autoNext = el.autoNextToggle.checked;

    syncPhaseWithItems();
    saveState();
    renderAll();
    closeSettingsModal();
    showToast(`✅ 총 ${newItems.length}개의 문제 목록이 적용되었습니다.`);
  }

  // 범위 번호 빠른 추가 도우미
  function handleAppendRange() {
    const prefix = el.rangePrefixInput.value.trim();
    const start = parseInt(el.rangeStartInput.value, 10);
    const end = parseInt(el.rangeEndInput.value, 10);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      showToast("⚠️ 시작 번호와 끝 번호를 숫자로 입력해 주세요.");
      return;
    }
    if (Math.abs(end - start) > 300) {
      showToast("⚠️ 한 번에 최대 300개까지만 추가할 수 있습니다.");
      return;
    }

    const generated = [];
    const step = start <= end ? 1 : -1;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      generated.push(`${prefix}${n}`);
    }

    const currentVal = el.problemListTextarea.value.trim();
    el.problemListTextarea.value = currentVal
      ? `${currentVal}\n${generated.join("\n")}`
      : generated.join("\n");

    updateTextareaCountBadge();
    showToast(`➕ ${generated.length}개의 번호가 입력창에 추가되었습니다.`);
  }

  // ==================== 초기화 기능 (진행도 초기화 / 모두 초기화) ====================
  function resetProgressOnly() {
    if (state.items.length === 0 && !el.problemListTextarea.value.trim()) {
      showToast("초기화할 문제 목록이 없습니다.");
      return;
    }

    clearCountdownTimer();
    stopProblemStopwatch();

    state.items.forEach((it) => {
      it.solved = false;
      it.wrongCount = 0;
      it.attempts = 0;
    });
    state.currentId = null;
    state.lastShownId = null;
    state.totalStudySeconds = 0;
    state.currentProblemSeconds = 0;
    state.undoStack = [];
    updateStopwatchUI();

    syncPhaseWithItems();
    saveState();
    renderAll();
    showToast("🔄 모든 문제가 미해결 상태(0 / 총갯수)로 초기화되었습니다.");
  }

  function resetAllEverything() {
    clearCountdownTimer();
    stopProblemStopwatch();

    state.presetTitle = "기본 문제집";
    state.rawText = "";
    state.items = [];
    state.currentId = null;
    state.lastShownId = null;
    state.phase = "empty";
    state.totalStudySeconds = 0;
    state.currentProblemSeconds = 0;
    state.undoStack = [];

    el.problemListTextarea.value = "";
    el.presetTitleInput.value = "";
    updateTextareaCountBadge();
    updateStopwatchUI();

    saveState();
    renderAll();
    showToast("🗑️ 문제 목록과 진행 기록이 모두 초기화되었습니다.");
  }

  // 틀렸던 문제만 다시 풀기
  function retryWrongProblemsOnly() {
    const wrongItems = state.items.filter((it) => it.wrongCount > 0);
    if (wrongItems.length === 0) return;

    state.items.forEach((it) => {
      if (it.wrongCount > 0) {
        it.solved = false;
      } else {
        it.solved = true;
      }
    });
    state.currentId = null;
    state.lastShownId = null;
    state.undoStack = [];
    syncPhaseWithItems();
    saveState();
    renderAll();
    startDrawProblem();
  }

  // ==================== 프리셋 보관함 ====================
  function handleSavePreset() {
    const parsed = parseProblemLines(el.problemListTextarea.value);
    if (parsed.length === 0) {
      showToast("⚠️ 먼저 문제 번호 목록을 입력해 주세요.");
      return;
    }
    const title = el.presetTitleInput.value.trim() || `문제집 (${parsed.length}문항)`;

    const existingIdx = presets.findIndex((p) => p.title === title);
    const presetObj = {
      id: `preset_${Date.now()}`,
      title,
      rawText: parsed.join("\n"),
      count: parsed.length,
    };

    if (existingIdx >= 0) {
      presets[existingIdx] = presetObj;
    } else {
      presets.unshift(presetObj);
    }

    savePresets();
    renderPresetsList();
    showToast(`💾 [${title}] 보관함에 저장되었습니다.`);
  }

  function renderPresetsList() {
    if (presets.length === 0) {
      el.savedPresetsWrap.classList.add("hidden");
      return;
    }
    el.savedPresetsWrap.classList.remove("hidden");
    el.savedPresetsList.innerHTML = "";

    presets.forEach((preset) => {
      const chip = document.createElement("div");
      chip.className = "preset-chip";

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "preset-chip-load";
      loadBtn.textContent = `📘 ${preset.title} (${preset.count})`;
      loadBtn.addEventListener("click", () => {
        el.presetTitleInput.value = preset.title;
        el.problemListTextarea.value = preset.rawText;
        updateTextareaCountBadge();
        showToast(`📂 [${preset.title}] 목록을 불러왔습니다. 하단의 [적용하기]를 눌러주세요.`);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "preset-chip-del";
      delBtn.title = "보관함에서 삭제";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        presets = presets.filter((p) => p.id !== preset.id);
        savePresets();
        renderPresetsList();
      });

      chip.appendChild(loadBtn);
      chip.appendChild(delBtn);
      el.savedPresetsList.appendChild(chip);
    });
  }

  // ==================== 토스트 & 컨페티 효과 ====================
  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  function launchConfetti() {
    const canvas = el.confettiCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#38bdf8", "#a855f7"];
    const particles = Array.from({ length: 90 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      size: Math.random() * 7 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10,
    }));

    let frame = 0;
    function animate() {
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // 중력
        p.rotation += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      });

      if (frame < 110) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(animate);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (ch) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[ch] || ch;
    });
  }

  // ==================== 이벤트 바인딩 ====================
  function bindEvents() {
    el.openSettingsBtn.addEventListener("click", openSettingsModal);
    el.emptyOpenSettingsBtn.addEventListener("click", openSettingsModal);
    el.closeSettingsBtn.addEventListener("click", closeSettingsModal);
    el.cancelSettingsBtn.addEventListener("click", closeSettingsModal);

    el.settingsModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.settingsModalBackdrop) {
        closeSettingsModal();
      }
    });

    el.problemListTextarea.addEventListener("input", updateTextareaCountBadge);
    el.appendRangeBtn.addEventListener("click", handleAppendRange);
    el.savePresetBtn.addEventListener("click", handleSavePreset);
    el.saveSettingsBtn.addEventListener("click", applySettingsAndProblemList);

    el.resetProgressOnlyBtn.addEventListener("click", () => {
      resetProgressOnly();
      closeSettingsModal();
    });

    el.resetAllBtn.addEventListener("click", () => {
      resetAllEverything();
    });

    el.drawProblemBtn.addEventListener("click", startDrawProblem);
    el.skipCountdownBtn.addEventListener("click", revealCurrentProblem);

    el.correctBtn.addEventListener("click", () => handleJudge(true));
    el.wrongBtn.addEventListener("click", () => handleJudge(false));
    el.redrawBtn.addEventListener("click", startDrawProblem);
    el.undoBtn.addEventListener("click", handleUndo);

    el.restartAllBtn.addEventListener("click", () => {
      resetProgressOnly();
      startDrawProblem();
    });
    el.retryWrongOnlyBtn.addEventListener("click", retryWrongProblemsOnly);

    el.soundToggleBtn.addEventListener("click", () => {
      state.settings.soundEnabled = !state.settings.soundEnabled;
      saveState();
      renderAll();
      showToast(state.settings.soundEnabled ? "🔊 효과음이 켜졌습니다." : "🔇 효과음이 꺼졌습니다.");
    });

    el.themeToggleBtn.addEventListener("click", () => {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      saveState();
      renderAll();
    });

    // 키보드 단축키 지원
    window.addEventListener("keydown", (e) => {
      const isModalOpen = !el.settingsModalBackdrop.classList.contains("hidden");
      if (isModalOpen) {
        if (e.key === "Escape") {
          closeSettingsModal();
        }
        return;
      }

      // 입력 요소 포커스 중이면 단축키 무시
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space" || e.key === "Enter") {
        if (state.phase === "ready") {
          e.preventDefault();
          startDrawProblem();
        } else if (state.phase === "countdown") {
          e.preventDefault();
          revealCurrentProblem();
        }
      } else if (state.phase === "question") {
        if (e.key === "o" || e.key === "O" || e.key === "1") {
          e.preventDefault();
          handleJudge(true);
        } else if (e.key === "x" || e.key === "X" || e.key === "2") {
          e.preventDefault();
          handleJudge(false);
        }
      }

      if ((e.key === "z" || e.key === "Z") && !e.ctrlKey && !e.metaKey) {
        if (state.undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    });
  }

  // 초기화 실행
  loadState();
  bindEvents();
  renderAll();
})();
